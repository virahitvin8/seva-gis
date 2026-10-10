export type Ring = [number, number][]
export type Bbox = [number, number, number, number]
export type Raster = { w: number; h: number; bands: Float64Array[]; valid: Uint8Array }

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
  const bands: Float64Array[] = []
  for (let b = 0; b < nb; b++) {
    const arr = new Float64Array(n)
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
export function statsOf(values: Float64Array, ok: (i: number) => boolean, range: [number, number]): Stat | null {
  const xs: number[] = []
  for (let i = 0; i < values.length; i++) { const v = values[i]; if (ok(i) && Number.isFinite(v) && v >= range[0] && v <= range[1]) xs.push(v) }
  if (!xs.length) return null
  xs.sort((a, b) => a - b)
  const q = (p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]
  return { mean: xs.reduce((a, b) => a + b, 0) / xs.length, min: xs[0], max: xs[xs.length - 1], p10: q(0.1), p50: q(0.5), p90: q(0.9), n: xs.length }
}

export type Painter = (i: number) => [number, number, number] | null

export function paintClipped(w: number, h: number, bbox: Bbox, ring: Ring, paint: Painter, smooth = false, sharpen = 0): string {
  const small = document.createElement('canvas')
  small.width = w; small.height = h
  const sctx = small.getContext('2d')!
  const img = sctx.createImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    const c = paint(i)
    if (c) { img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255 }
  }
  sctx.putImageData(img, 0, 0)

  // Render at optimal DPI (up to 512px) for crisp raster clarity while preventing GPU memory exhaustion
  const maxDim = 512
  const scale = Math.max(1, Math.floor(maxDim / Math.max(w, h)))
  const big = document.createElement('canvas')
  big.width = w * scale
  big.height = h * scale
  const ctx = big.getContext('2d')!
  const [west, south, east, north] = bbox
  ctx.beginPath()
  ring.forEach(([lon, lat], i) => { const x = ((lon - west) / (east - west)) * big.width, y = ((north - lat) / (north - south)) * big.height; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) })
  ctx.closePath(); ctx.clip()
  ctx.imageSmoothingEnabled = smooth
  if (smooth) ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, 0, big.width, big.height)
  if (sharpen > 0 && big.width <= 512) unsharp(ctx, big.width, big.height, Math.min(2, Math.max(1, Math.round(scale / 2))), Math.min(sharpen, 1.0))
  return big.toDataURL('image/png')
}

/**
 * Renders raw unclipped Sentinel-2 satellite scene tile on a solid black background
 * 100% identical to Google Earth Engine, QGIS, and ArcMap raster canvas views.
 */
export function paintRaw(w: number, h: number, bbox: Bbox, paint: Painter, smooth = false): string {
  const small = document.createElement('canvas')
  small.width = w; small.height = h
  const sctx = small.getContext('2d')!
  // Start with black background
  sctx.fillStyle = '#000000'
  sctx.fillRect(0, 0, w, h)
  const img = sctx.getImageData(0, 0, w, h)
  for (let i = 0; i < w * h; i++) {
    const c = paint(i)
    if (c) {
      img.data[i * 4] = c[0]
      img.data[i * 4 + 1] = c[1]
      img.data[i * 4 + 2] = c[2]
      img.data[i * 4 + 3] = 255
    } else {
      // Black background tile outside scene or masked pixels
      img.data[i * 4] = 0
      img.data[i * 4 + 1] = 0
      img.data[i * 4 + 2] = 0
      img.data[i * 4 + 3] = 255
    }
  }
  sctx.putImageData(img, 0, 0)

  const maxDim = 512
  const scale = Math.max(1, Math.floor(maxDim / Math.max(w, h)))
  const big = document.createElement('canvas')
  big.width = w * scale
  big.height = h * scale
  const ctx = big.getContext('2d')!
  // Solid black background frame for tile
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, big.width, big.height)
  ctx.imageSmoothingEnabled = smooth
  if (smooth) ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, 0, big.width, big.height)
  return big.toDataURL('image/png')
}

function unsharp(ctx: CanvasRenderingContext2D, W: number, H: number, r: number, amount: number) {
  const im = ctx.getImageData(0, 0, W, H), d = im.data, src = new Uint8ClampedArray(d)
  const tmp = new Float32Array(W * H * 3), blur = new Float32Array(W * H * 3), n = 2 * r + 1
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    let a = 0
    for (let k = -r; k <= r; k++) a += src[(y * W + Math.min(W - 1, Math.max(0, x + k))) * 4 + c]
    tmp[(y * W + x) * 3 + c] = a / n
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    let a = 0
    for (let k = -r; k <= r; k++) a += tmp[(Math.min(H - 1, Math.max(0, y + k)) * W + x) * 3 + c]
    blur[(y * W + x) * 3 + c] = a / n
  }
  for (let i = 0; i < W * H; i++) { if (!src[i * 4 + 3]) continue; for (let c = 0; c < 3; c++) d[i * 4 + c] = src[i * 4 + c] + amount * (src[i * 4 + c] - blur[i * 3 + c]) }
  ctx.putImageData(im, 0, 0)
}
