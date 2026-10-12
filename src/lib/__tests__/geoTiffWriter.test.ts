import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFloat32GeoTiffBlob } from '../geoTiffWriter.ts'

// A minimal, independent TIFF reader. It does not share any code with the writer, so
// it cannot "agree" with a bug: it walks the IFD the same way GDAL or QGIS would.
type Parsed = {
  littleEndian: boolean
  entries: Map<number, { type: number; count: number; values: number[]; text?: string }>
  bytes: DataView
}

async function parseTiff(blob: Blob): Promise<Parsed> {
  const buffer = await blob.arrayBuffer()
  const view = new DataView(buffer)
  const littleEndian = view.getUint16(0, false) === 0x4949
  assert.equal(view.getUint16(0, littleEndian), 0x4949, 'byte-order mark should be II')
  assert.equal(view.getUint16(2, littleEndian), 42, 'TIFF version should be 42')

  const ifdOffset = view.getUint32(4, littleEndian)
  const count = view.getUint16(ifdOffset, littleEndian)
  const entries: Parsed['entries'] = new Map()

  const TYPE_SIZE: Record<number, number> = { 2: 1, 3: 2, 4: 4, 12: 8 }

  for (let i = 0; i < count; i++) {
    const at = ifdOffset + 2 + i * 12
    const tag = view.getUint16(at, littleEndian)
    const type = view.getUint16(at + 2, littleEndian)
    const n = view.getUint32(at + 4, littleEndian)
    const size = (TYPE_SIZE[type] ?? 1) * n
    const valueAt = size <= 4 ? at + 8 : view.getUint32(at + 8, littleEndian)

    const values: number[] = []
    for (let k = 0; k < n; k++) {
      if (type === 3) values.push(view.getUint16(valueAt + k * 2, littleEndian))
      else if (type === 4) values.push(view.getUint32(valueAt + k * 4, littleEndian))
      else if (type === 12) values.push(view.getFloat64(valueAt + k * 8, littleEndian))
    }

    let text: string | undefined
    if (type === 2) {
      let s = ''
      for (let k = 0; k < n; k++) {
        const c = view.getUint8(valueAt + k)
        if (c === 0) break
        s += String.fromCharCode(c)
      }
      text = s
    }

    entries.set(tag, { type, count: n, values, text })
  }

  return { littleEndian, entries, bytes: view }
}

const BBOX: [number, number, number, number] = [78.4, 17.4, 78.42, 17.42]

test('the GeoTIFF declares itself as classic little-endian TIFF', async () => {
  const blob = createFloat32GeoTiffBlob(2, 2, BBOX, [new Float32Array([1, 2, 3, 4])])
  assert.equal(blob.type, 'image/tiff')
  const parsed = await parseTiff(blob)
  assert.equal(parsed.littleEndian, true)
})

test('the GeoTIFF is a Float32 data raster, not an 8-bit picture', async () => {
  const blob = createFloat32GeoTiffBlob(2, 2, BBOX, [new Float32Array([1, 2, 3, 4])])
  const { entries } = await parseTiff(blob)

  assert.deepEqual(entries.get(258)!.values, [32], 'BitsPerSample must be 32')
  assert.deepEqual(entries.get(339)!.values, [3], 'SampleFormat must be 3 (IEEE float)')
  assert.equal(entries.get(262)!.values[0], 1, 'PhotometricInterpretation must be BlackIsZero')
  assert.equal(entries.get(259)!.values[0], 1, 'Compression must be none')
  assert.equal(entries.get(277)!.values[0], 1, 'SamplesPerPixel must be 1')
  assert.equal(entries.get(284)!.values[0], 1, 'PlanarConfiguration must be chunky')
})

test('georeferencing is exact: pixel scale, tie point and EPSG:4326', async () => {
  const width = 100, height = 50
  const blob = createFloat32GeoTiffBlob(width, height, BBOX, [new Float32Array(width * height)])
  const { entries } = await parseTiff(blob)

  const scale = entries.get(33550)!.values
  assert.ok(Math.abs(scale[0] - (BBOX[2] - BBOX[0]) / width) < 1e-12, 'x pixel scale')
  assert.ok(Math.abs(scale[1] - (BBOX[3] - BBOX[1]) / height) < 1e-12, 'y pixel scale is positive (north-up)')

  const tie = entries.get(33922)!.values
  assert.deepEqual(tie.slice(0, 3), [0, 0, 0])
  assert.equal(tie[3], BBOX[0], 'tie point x must be the west edge')
  assert.equal(tie[4], BBOX[3], 'tie point y must be the north edge')

  const keys = entries.get(34735)!.values
  assert.deepEqual(keys.slice(0, 4), [1, 1, 0, 3], 'three GeoKeys declared')
  assert.equal(keys[4], 1024, 'GTModelTypeGeoKey')
  assert.equal(keys[7], 2, 'model type must be geographic')
  assert.equal(keys[12], 2048, 'GeographicTypeGeoKey')
  assert.equal(keys[15], 4326, 'must be WGS 84')
})

test('pixel values round-trip exactly, and no-data survives', async () => {
  const values = new Float32Array([0.1234567, -1.5, 3.14159265, Number.NaN])
  const blob = createFloat32GeoTiffBlob(2, 2, BBOX, [values])
  const { entries, bytes, littleEndian } = await parseTiff(blob)

  const offset = entries.get(273)!.values[0]
  const byteCount = entries.get(279)!.values[0]
  assert.equal(byteCount, 2 * 2 * 4, 'strip holds width x height x 4 bytes')

  const readBack: number[] = []
  for (let i = 0; i < 4; i++) readBack.push(bytes.getFloat32(offset + i * 4, littleEndian))

  assert.equal(readBack[0], values[0])
  assert.equal(readBack[1], values[1])
  assert.equal(readBack[2], values[2])
  assert.ok(Number.isNaN(readBack[3]), 'no-data pixel must read back as NaN')
})

test('the no-data value is declared so GIS tools clip instead of drawing the box', async () => {
  const blob = createFloat32GeoTiffBlob(2, 2, BBOX, [new Float32Array(4)])
  const { entries } = await parseTiff(blob)
  const nodata = entries.get(42113)
  assert.ok(nodata, 'GDAL_NODATA tag must be present')
  assert.equal(nodata!.text, 'nan')
})

test('a declared numeric no-data value is written verbatim', async () => {
  const blob = createFloat32GeoTiffBlob(2, 2, BBOX, [new Float32Array(4)], { nodata: -9999 })
  const { entries } = await parseTiff(blob)
  assert.equal(entries.get(42113)!.text, '-9999')
})

test('multiple bands are written chunky and declared correctly', async () => {
  const band0 = new Float32Array([1, 2, 3, 4])
  const band1 = new Float32Array([10, 20, 30, 40])
  const blob = createFloat32GeoTiffBlob(2, 2, BBOX, [band0, band1])
  const { entries, bytes, littleEndian } = await parseTiff(blob)

  assert.equal(entries.get(277)!.values[0], 2, 'SamplesPerPixel must be 2')
  assert.deepEqual(entries.get(258)!.values, [32, 32])
  assert.deepEqual(entries.get(339)!.values, [3, 3])

  const offset = entries.get(273)!.values[0]
  // Chunky layout: band0/b1 of pixel 0, then band0/b1 of pixel 1, and so on.
  assert.equal(bytes.getFloat32(offset + 0, littleEndian), 1)
  assert.equal(bytes.getFloat32(offset + 4, littleEndian), 10)
  assert.equal(bytes.getFloat32(offset + 8, littleEndian), 2)
  assert.equal(bytes.getFloat32(offset + 12, littleEndian), 20)
})

test('the IFD tag list is sorted, as the TIFF specification requires', async () => {
  const blob = createFloat32GeoTiffBlob(2, 2, BBOX, [new Float32Array(4)])
  const { entries } = await parseTiff(blob)
  const tags = [...entries.keys()]
  assert.deepEqual(tags, [...tags].sort((a, b) => a - b), `tags out of order: ${tags.join(', ')}`)
})

test('a band shorter than the raster is rejected rather than silently truncated', () => {
  assert.throws(
    () => createFloat32GeoTiffBlob(4, 4, BBOX, [new Float32Array(3)]),
    /band has 3 values but the raster is 16 pixels/,
  )
})

test('zero bands is rejected', () => {
  assert.throws(() => createFloat32GeoTiffBlob(4, 4, BBOX, []), /at least one band/)
})
