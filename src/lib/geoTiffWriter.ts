/**
 * SEVA·GIS Authentic Client-Side GeoTIFF Writer
 * Encodes baseline uncompressed georeferenced TIFF with WGS84 (EPSG:4326) tags:
 * - ModelPixelScaleTag (33550)
 * - ModelTiepointTag (33922)
 * - GeoKeyDirectoryTag (34735) -> EPSG:4326 / Geographic WGS84
 */

export type GeoTiffOptions = {
  samplesPerPixel?: 3 | 4
}

export function createGeoTiffBlob(
  width: number,
  height: number,
  bbox: [number, number, number, number], // [west, south, east, north]
  pixelData: Uint8ClampedArray | Uint8Array,
  options: GeoTiffOptions = {}
): Blob {
  const [west, south, east, north] = bbox
  const spp = options.samplesPerPixel ?? 4 // RGBA default

  const scaleX = Math.abs(east - west) / width
  const scaleY = Math.abs(north - south) / height

  // Pixel bytes
  const bytesPerPixel = spp
  const imageBytes = width * height * bytesPerPixel
  const rawPixels = new Uint8Array(imageBytes)

  if (spp === 4) {
    if (pixelData.length >= imageBytes) {
      rawPixels.set(pixelData.subarray(0, imageBytes))
    }
  } else {
    // Convert RGBA to RGB
    let srcIdx = 0
    let dstIdx = 0
    for (let i = 0; i < width * height; i++) {
      rawPixels[dstIdx++] = pixelData[srcIdx++]
      rawPixels[dstIdx++] = pixelData[srcIdx++]
      rawPixels[dstIdx++] = pixelData[srcIdx++]
      srcIdx++ // skip alpha
    }
  }

  // Double data for ModelPixelScale (3 doubles = 24 bytes)
  const pixelScale = new Float64Array([scaleX, scaleY, 0.0])
  // Double data for ModelTiepoint (6 doubles = 48 bytes)
  const tiePoint = new Float64Array([0.0, 0.0, 0.0, west, north, 0.0])

  // GeoKeyDirectory:
  // Header: Version=1, KeyRevision=1, MinorRevision=0, NumberOfKeys=3 (4 shorts)
  // Key 1: KeyID=1024 (GTModelTypeGeoKey), Location=0, Count=1, Value=2 (ModelTypeGeographic)
  // Key 2: KeyID=1025 (GTRasterTypeGeoKey), Location=0, Count=1, Value=1 (RasterPixelIsArea)
  // Key 3: KeyID=2048 (GeographicTypeGeoKey), Location=0, Count=1, Value=4326 (GCS_WGS_84)
  const geoKeys = new Uint16Array([
    1, 1, 0, 3,
    1024, 0, 1, 2,
    1025, 0, 1, 1,
    2048, 0, 1, 4326,
  ]) // 16 shorts = 32 bytes

  // BitsPerSample (spp shorts = 6 or 8 bytes)
  const bitsPerSample = new Uint16Array(spp === 4 ? [8, 8, 8, 8] : [8, 8, 8])

  // Layout calculation
  const headerSize = 8
  const numTags = 13
  const ifdSize = 2 + numTags * 12 + 4 // 2 + 156 + 4 = 162 bytes
  let currentOffset = headerSize + ifdSize
  if (currentOffset % 4 !== 0) currentOffset += 4 - (currentOffset % 4)

  // Align data blocks
  const bitsPerSampleOffset = currentOffset
  currentOffset += bitsPerSample.byteLength
  if (currentOffset % 8 !== 0) currentOffset += 8 - (currentOffset % 8)

  const pixelScaleOffset = currentOffset
  currentOffset += pixelScale.byteLength
  if (currentOffset % 8 !== 0) currentOffset += 8 - (currentOffset % 8)

  const tiePointOffset = currentOffset
  currentOffset += tiePoint.byteLength
  if (currentOffset % 4 !== 0) currentOffset += 4 - (currentOffset % 4)

  const geoKeysOffset = currentOffset
  currentOffset += geoKeys.byteLength
  if (currentOffset % 4 !== 0) currentOffset += 4 - (currentOffset % 4)

  const pixelDataOffset = currentOffset
  const totalFileSize = pixelDataOffset + imageBytes

  // Allocate binary buffer
  const buffer = new ArrayBuffer(totalFileSize)
  const view = new DataView(buffer)
  const u8View = new Uint8Array(buffer)

  // 1. TIFF Header
  view.setUint8(0, 0x49) // 'I'
  view.setUint8(1, 0x49) // 'I'
  view.setUint16(2, 42, true) // Version 42
  view.setUint32(4, headerSize, true) // Offset to IFD0 (8)

  // 2. IFD0
  let ifdOffset = headerSize
  view.setUint16(ifdOffset, numTags, true)
  ifdOffset += 2

  const writeTag = (tag: number, type: number, count: number, valueOrOffset: number) => {
    view.setUint16(ifdOffset, tag, true)
    view.setUint16(ifdOffset + 2, type, true)
    view.setUint32(ifdOffset + 4, count, true)
    view.setUint32(ifdOffset + 8, valueOrOffset, true)
    ifdOffset += 12
  }

  // Tag list must be sorted by tag number in TIFF specification!
  writeTag(256, 4, 1, width) // 0x0100 ImageWidth (LONG)
  writeTag(257, 4, 1, height) // 0x0101 ImageLength (LONG)
  writeTag(258, 3, spp, bitsPerSampleOffset) // 0x0102 BitsPerSample (SHORT array)
  writeTag(259, 3, 1, 1) // 0x0103 Compression = 1 (Uncompressed)
  writeTag(262, 3, 1, 2) // 0x0106 PhotometricInterpretation = 2 (RGB)
  writeTag(273, 4, 1, pixelDataOffset) // 0x0111 StripOffsets (LONG)
  writeTag(277, 3, 1, spp) // 0x0115 SamplesPerPixel = 3 or 4
  writeTag(278, 4, 1, height) // 0x0116 RowsPerStrip = height (1 strip)
  writeTag(279, 4, 1, imageBytes) // 0x0117 StripByteCounts (LONG)
  writeTag(284, 3, 1, 1) // 0x011C PlanarConfiguration = 1 (Chunky)
  writeTag(33550, 12, 3, pixelScaleOffset) // 0x830E ModelPixelScaleTag (DOUBLE x3)
  writeTag(33922, 12, 6, tiePointOffset) // 0x8482 ModelTiepointTag (DOUBLE x6)
  writeTag(34735, 3, geoKeys.length, geoKeysOffset) // 0x87AF GeoKeyDirectoryTag (SHORT x16)

  view.setUint32(ifdOffset, 0, true) // Next IFD = 0

  // 3. Write Extra Data Blocks
  new Uint16Array(buffer, bitsPerSampleOffset, spp).set(bitsPerSample)
  new Float64Array(buffer, pixelScaleOffset, 3).set(pixelScale)
  new Float64Array(buffer, tiePointOffset, 6).set(tiePoint)
  new Uint16Array(buffer, geoKeysOffset, geoKeys.length).set(geoKeys)

  // 4. Write Pixels
  u8View.set(rawPixels, pixelDataOffset)

  return new Blob([buffer], { type: 'image/tiff' })
}

/**
 * Generates an ESRI WorldFile (.tfw) companion text string for the bounding box and resolution.
 */
export function generateWorldFileText(
  width: number,
  height: number,
  bbox: [number, number, number, number]
): string {
  const [west, south, east, north] = bbox
  const dx = (east - west) / width
  const dy = -((north - south) / height)
  return `${dx.toFixed(10)}\n0.0000000000\n0.0000000000\n${dy.toFixed(10)}\n${west.toFixed(10)}\n${north.toFixed(10)}\n`
}
