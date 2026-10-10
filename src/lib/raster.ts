export type Ring = [number, number][]
export type Bbox = [number, number, number, number]
export type Raster = { w: number; h: number; bands: Float32Array[]; valid: Uint8Array }

export function parseNpy(buf: ArrayBuffer): Raster {
  const view = new DataView(buf)
  const major = view.getUint8(6)
  const headerStart = major === 1 ? 10 : 12
  const headerLen = major === 1 ? view.getUint16(8, true) : view.getUint32(8, true)
  const header = new TextDecoder().decode(new Uint8Array(buf, headerStart, headerLen))
  const descr = /'descr':\s*'([^']+)'/.exec(header)?.[1]
  const shape = /\((\d+),\s*(\d+),\s*(\d+)\)/.exec(header)
  if (!descr || !shape) throw new Error('Unreadable raster response.')
  const [nb, h, w] = [Number(shape[1]), Number(shape[2]), Number(shape[3])]
  const size = descr.slice(2)
  const bytes = Number(size)
  const read = (offset: number) => {
    switch (descr.slice(1)) {
      case 'f8': return view.getFloat64(offset, true)
      case 'f4': return view.getFloat32(offset, true)
      case 'u2': return view.getUint16(offset, true)
      case 'i2': return view.getInt16(offset, true)
      case 'u4': return view.getUint32(offset, true)
      case 'i4': return view.getInt32(offset, true)
      case 'u1': return view.getUint8(offset)
      default: throw new Error(`Unsupported raster type ${descr}`)
    }
  }
  const start = headerStart + headerLen, n = w * h
  const bands: Float32Array[] = []
  for (let b = 0; b < nb; b++) {
    const arr = new Float32Array(n)
    for (let i = 0; i < n; i++) arr[i] = read(start + (b * n + i) * bytes)
    bands.push(arr)
  }
  const mask = bands.pop()!
  const valid = new Uint8Array(n)
  for (let i = 0; i < n; i++) valid[i] = mask[i] > 0 ? 1 : 0
  return { w, h, bands, valid }
}

function inRing(lon: number, lat: number, ring: Ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function insideMask(w: number, h: number, bbox: Bbox, ring: Ring) {
  const [west, south, east, north] = bbox
  const out = new Uint8Array(w * h)
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = ring[i]
    if (x < minLon) minLon = x
    if (x > maxLon) maxLon = x
    if (y < minLat) minLat = y
    if (y > maxLat) maxLat = y
  }
  for (let y = 0; y < h; y++) {
    const lat = north - ((y + 0.5) / h) * (north - south)
    if (lat < minLat || lat > maxLat) continue
    for (let x = 0; x < w; x++) {
      const lon = west + ((x + 0.5) / w) * (east - west)
      if (lon >= minLon && lon <= maxLon && inRing(lon, lat, ring)) {
        out[y * w + x] = 1
      }
    }
  }
  return out
}

export function pixelAt(w: number, h: number, bbox: Bbox, lon: number, lat: number) {
  const [west, south, east, north] = bbox
  const x = Math.floor(((lon - west) / (east - west)) * w), y = Math.floor(((north - lat) / (north - south)) * h)
  return x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x
}

export function rasterSize(bbox: Bbox, res: number, maxPx: number) {
  const [west, south, east, north] = bbox
  const wm = (east - west) * 111320 * Math.cos((((south + north) / 2) * Math.PI) / 180), hm = (north - south) * 111320
  let w = Math.max(Math.round(wm / res), 8), h = Math.max(Math.round(hm / res), 8)
  const k = Math.min(1, maxPx / Math.max(w, h))
  w = Math.max(Math.round(w * k), 8); h = Math.max(Math.round(h * k), 8)
  return { w, h, wm, hm }
}

const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
export function rampColor(ramp: string[], t: number): [number, number, number] {
  const x = Math.min(Math.max(t, 0), 1) * (ramp.length - 1), i = Math.min(Math.floor(x), ramp.length - 2), f = x - i
  const a = hex(ramp[i]), b = hex(ramp[i + 1])
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

export type Stat = { mean: number; min: number; max: number; p10: number; p50: number; p90: number; n: number }
export function statsOf(values: Float32Array | Float64Array, ok: (i: number) => boolean, range: [number, number]): Stat | null {
  const xs = new Float32Array(values.length)
  let n = 0, sum = 0, min = Infinity, max = -Infinity
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!ok(i) || !Number.isFinite(v) || v < range[0] || v > range[1]) continue
    xs[n++] = v
    sum += v
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!n) return null
  const sorted = xs.subarray(0, n).sort()
  const q = (p: number) => sorted[Math.min(n - 1, Math.floor(p * n))]
  return { mean: sum / n, min, max, p10: q(0.1), p50: q(0.5), p90: q(0.9), n }
}

function applyUnsharp(ctx: CanvasRenderingContext2D, W: number, H: number, amount: number) {
  if (amount <= 0 || W < 3 || H < 3) return
  const imgData = ctx.getImageData(0, 0, W, H)
  const d = imgData.data
  const copy = new Uint8ClampedArray(d)
  const k = Math.min(1.0, Math.max(0.1, amount))
  for (let y = 1; y < H - 1; y++) {
    const row = y * W * 4
    const rowAbove = (y - 1) * W * 4
    const rowBelow = (y + 1) * W * 4
    for (let x = 1; x < W - 1; x++) {
      const idx = row + x * 4
      if (copy[idx + 3] === 0) continue
      for (let c = 0; c < 3; c++) {
        const val = copy[idx + c]
        const lap = 4 * val - copy[rowAbove + x * 4 + c] - copy[rowBelow + x * 4 + c] - copy[row + (x - 1) * 4 + c] - copy[row + (x + 1) * 4 + c]
        d[idx + c] = Math.min(255, Math.max(0, val + k * lap))
      }
    }
  }
  ctx.putImageData(imgData, 0, 0)
}

export type Painter = (i: number) => [number, number, number] | null

/**
 * Renders AOI clipped raster image with subpixel vector boundary anti-aliasing
 * and high-DPI scaling (1024px minimum dimension, matching Earth Engine / QGIS quality).
 */
export function paintClipped(
  w: number,
  h: number,
  bbox: Bbox,
  ring: Ring,
  paint: Painter,
  smooth = false,
  sharpen = 0
): string {
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = w
  srcCanvas.height = h
  const srcCtx = srcCanvas.getContext('2d')!
  const srcImg = srcCtx.createImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    const c = paint(i)
    if (c) {
      srcImg.data[i * 4] = c[0]
      srcImg.data[i * 4 + 1] = c[1]
      srcImg.data[i * 4 + 2] = c[2]
      srcImg.data[i * 4 + 3] = 255
    }
  }
  srcCtx.putImageData(srcImg, 0, 0)

  // Target high-resolution canvas to avoid browser thumbnail stretching and pixel blur
  const targetDim = 1024
  const scale = Math.max(1, Math.min(16, Math.ceil(targetDim / Math.max(w, h))))
  const W = w * scale
  const H = h * scale

  const outCanvas = document.createElement('canvas')
  outCanvas.width = W
  outCanvas.height = H
  const ctx = outCanvas.getContext('2d')!

  ctx.imageSmoothingEnabled = smooth
  if (smooth) {
    ctx.imageSmoothingQuality = 'high'
  }
  ctx.drawImage(srcCanvas, 0, 0, W, H)

  if (smooth && sharpen > 0) {
    applyUnsharp(ctx, W, H, sharpen)
  }

  // Exact subpixel vector clipping using canvas hardware anti-aliasing
  const [west, south, east, north] = bbox
  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.beginPath()
  ring.forEach(([lon, lat], i) => {
    const px = ((lon - west) / (east - west)) * W
    const py = ((north - lat) / (north - south)) * H
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()

  return outCanvas.toDataURL('image/png')
}

/**
 * Renders raw unclipped Sentinel-2 satellite scene tile on a solid black background
 * at high-DPI resolution with optional smooth filtering and contrast sharpening.
 */
export function paintRaw(
  w: number,
  h: number,
  _bbox: Bbox,
  paint: Painter,
  smooth = false,
  sharpen = 0
): string {
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = w
  srcCanvas.height = h
  const srcCtx = srcCanvas.getContext('2d')!
  const srcImg = srcCtx.createImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    const c = paint(i)
    if (c) {
      srcImg.data[i * 4] = c[0]
      srcImg.data[i * 4 + 1] = c[1]
      srcImg.data[i * 4 + 2] = c[2]
      srcImg.data[i * 4 + 3] = 255
    } else {
      srcImg.data[i * 4] = 0
      srcImg.data[i * 4 + 1] = 0
      srcImg.data[i * 4 + 2] = 0
      srcImg.data[i * 4 + 3] = 255
    }
  }
  srcCtx.putImageData(srcImg, 0, 0)

  const targetDim = 1024
  const scale = Math.max(1, Math.min(16, Math.ceil(targetDim / Math.max(w, h))))
  const W = w * scale
  const H = h * scale

  const outCanvas = document.createElement('canvas')
  outCanvas.width = W
  outCanvas.height = H
  const ctx = outCanvas.getContext('2d')!
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)

  ctx.imageSmoothingEnabled = smooth
  if (smooth) ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(srcCanvas, 0, 0, W, H)

  if (smooth && sharpen > 0) {
    applyUnsharp(ctx, W, H, sharpen)
  }

  return outCanvas.toDataURL('image/png')
}
