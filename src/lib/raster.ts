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
  if (!ring || ring.length < 3) return out

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = ring[i]
    if (x < minLon) minLon = x
    if (x > maxLon) maxLon = x
    if (y < minLat) minLat = y
    if (y > maxLat) maxLat = y
  }

  const nEdges = ring.length
  const latStep = (north - south) / h
  const lonStep = (east - west) / w

  for (let y = 0; y < h; y++) {
    const lat = north - (y + 0.5) * latStep
    if (lat < minLat || lat > maxLat) continue

    const xNodes: number[] = []
    for (let i = 0, j = nEdges - 1; i < nEdges; j = i++) {
      const yi = ring[i][1], yj = ring[j][1]
      if ((yi < lat && yj >= lat) || (yj < lat && yi >= lat)) {
        const xi = ring[i][0], xj = ring[j][0]
        xNodes.push(xi + ((lat - yi) / (yj - yi)) * (xj - xi))
      }
    }
    if (xNodes.length < 2) continue
    xNodes.sort((a, b) => a - b)

    const rowOffset = y * w
    for (let k = 0; k < xNodes.length; k += 2) {
      if (k + 1 >= xNodes.length) break
      const xStart = Math.max(0, Math.floor((xNodes[k] - west) / lonStep))
      const xEnd = Math.min(w - 1, Math.floor((xNodes[k + 1] - west) / lonStep))
      for (let x = xStart; x <= xEnd; x++) {
        out[rowOffset + x] = 1
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

/**
 * Longest side a raster grid may have, and the shortest side it must have.
 *
 * `maxPx` keeps a very large area of interest from requesting an enormous grid.
 * `minPx` exists because of a real defect: a small area of interest used to
 * collapse to the hard floor of 8 x 8 cells, so a 0.5 ha field was analysed from
 * ~64 pixels and then magnified on screen — that is the "blurry / pixelated"
 * complaint. Asking the tile service for a denser grid resamples the source
 * smoothly (the same thing QGIS bilinear resampling does) instead of magnifying
 * a handful of blocks.
 */
export const MIN_GRID_PX = 256

export function rasterSize(bbox: Bbox, res: number, maxPx: number, minPx = MIN_GRID_PX) {
  const [west, south, east, north] = bbox
  const wm = (east - west) * 111320 * Math.cos((((south + north) / 2) * Math.PI) / 180), hm = (north - south) * 111320
  let w = Math.max(Math.round(wm / res), 8), h = Math.max(Math.round(hm / res), 8)
  const longest = Math.max(w, h)

  if (longest > maxPx) {
    const k = maxPx / longest
    w = Math.max(Math.round(w * k), 8); h = Math.max(Math.round(h * k), 8)
  } else if (longest < minPx) {
    const k = minPx / longest
    w = Math.max(Math.round(w * k), 8); h = Math.max(Math.round(h * k), 8)
  }

  return { w, h, wm, hm }
}

const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
export function rampColor(ramp: string[], t: number): [number, number, number] {
  const x = Math.min(Math.max(t, 0), 1) * (ramp.length - 1), i = Math.min(Math.floor(x), ramp.length - 2), f = x - i
  const a = hex(ramp[i]), b = hex(ramp[i + 1])
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

export type Stat = { mean: number; min: number; max: number; p10: number; p50: number; p90: number; n: number; stdDev?: number }
/**
 * Samples at or below this size use an exact order-statistic sort. Above it, a
 * histogram is used instead, because sorting is what froze the page: a 900 x 900
 * grid is 810,000 values, and `Float32Array.prototype.sort` over that costs
 * roughly 16 million comparisons *per indicator*, on the main thread, for a
 * dozen indicators at once.
 */
const EXACT_QUANTILE_LIMIT = 4096

/** Histogram resolution for the large-raster path. */
const QUANTILE_BINS = 2048

export function statsOf(values: Float32Array | Float64Array, ok: (i: number) => boolean, range: [number, number]): Stat | null {
  const inRange = (v: number) => Number.isFinite(v) && v >= range[0] && v <= range[1]

  // Pass 1 — exact count, sum, min and max. Always exact, never approximated.
  let n = 0, sum = 0, min = Infinity, max = -Infinity
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (!ok(i) || !inRange(v)) continue
    n++
    sum += v
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!n) return null
  const mean = sum / n

  let p10: number, p50: number, p90: number

  if (n <= EXACT_QUANTILE_LIMIT) {
    // Small samples (unit tests, tiny areas): exact order statistics.
    const xs = new Float32Array(n)
    let k = 0
    for (let i = 0; i < values.length; i++) {
      const v = values[i]
      if (!ok(i) || !inRange(v)) continue
      xs[k++] = v
    }
    xs.sort()
    const q = (p: number) => xs[Math.min(n - 1, Math.floor(p * n))]
    p10 = q(0.1); p50 = q(0.5); p90 = q(0.9)
  } else if (max <= min) {
    p10 = min; p50 = min; p90 = min
  } else {
    // Large rasters: O(n) histogram instead of an O(n log n) sort. The bin width
    // is (max - min) / 2048, which is far finer than any legend or dashboard tile
    // can render, and the exact mean, min and max are still reported above.
    const span = max - min
    const binWidth = span / QUANTILE_BINS
    const scale = QUANTILE_BINS / span
    const hist = new Uint32Array(QUANTILE_BINS)

    for (let i = 0; i < values.length; i++) {
      const v = values[i]
      if (!ok(i) || !inRange(v)) continue
      let b = Math.floor((v - min) * scale)
      if (b < 0) b = 0
      else if (b >= QUANTILE_BINS) b = QUANTILE_BINS - 1
      hist[b]++
    }

    const quantile = (p: number) => {
      const target = Math.floor(p * n)
      let cumulative = 0
      for (let b = 0; b < QUANTILE_BINS; b++) {
        cumulative += hist[b]
        if (cumulative > target) return Math.min(max, min + (b + 0.5) * binWidth)
      }
      return max
    }

    p10 = quantile(0.1); p50 = quantile(0.5); p90 = quantile(0.9)
  }

  return { mean, min, max, p10, p50, p90, n }
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

export type ResamplingMethod = 'nearest' | 'bilinear' | 'cubic'

function cubicWeight(x: number): number {
  const absX = Math.abs(x)
  const a = -0.5
  if (absX <= 1) {
    return (a + 2) * absX * absX * absX - (a + 3) * absX * absX + 1
  } else if (absX < 2) {
    return a * absX * absX * absX - 5 * a * absX * absX + 8 * a * absX - 4 * a
  }
  return 0
}

/**
 * Resamples a discrete w x h satellite raster into a high-resolution W x H continuous surface
 * using 4x4 Bicubic Spline (Cubic Convolution, Keys a = -0.5) interpolation, matching
 * QGIS / ArcGIS 'Cubic' resampling and Google Earth Engine resample('bicubic').
 * Highly optimized with precomputed 1D weights and unrolled kernel evaluations.
 */
function resampleBicubic(
  w: number,
  h: number,
  W: number,
  H: number,
  paint: Painter
): ImageData {
  const imgData = new ImageData(W, H)
  const d = imgData.data

  const srcR = new Float32Array(w * h)
  const srcG = new Float32Array(w * h)
  const srcB = new Float32Array(w * h)
  const srcA = new Float32Array(w * h)

  for (let i = 0; i < w * h; i++) {
    const c = paint(i)
    if (c) {
      srcR[i] = c[0]
      srcG[i] = c[1]
      srcB[i] = c[2]
      srcA[i] = 1.0
    }
  }

  const denomH = Math.max(1, H - 1)
  const denomW = Math.max(1, W - 1)
  const spanH = Math.max(0, h - 1)
  const spanW = Math.max(0, w - 1)

  // Pre-calculate horizontal 1D cubic weights and source indices for all X
  const allWx = new Float32Array(W * 4)
  const allXInt = new Int32Array(W)
  for (let X = 0; X < W; X++) {
    const srcX = (X / denomW) * spanW
    const xInt = Math.floor(srcX)
    allXInt[X] = xInt
    const dx = srcX - xInt
    const base = X * 4
    allWx[base] = cubicWeight(-1 - dx)
    allWx[base + 1] = cubicWeight(0 - dx)
    allWx[base + 2] = cubicWeight(1 - dx)
    allWx[base + 3] = cubicWeight(2 - dx)
  }

  for (let Y = 0; Y < H; Y++) {
    const srcY = (Y / denomH) * spanH
    const yInt = Math.floor(srcY)
    const dy = srcY - yInt
    const rowOffset = Y * W * 4

    const wy0 = cubicWeight(-1 - dy)
    const wy1 = cubicWeight(0 - dy)
    const wy2 = cubicWeight(1 - dy)
    const wy3 = cubicWeight(2 - dy)

    const y0 = Math.min(h - 1, Math.max(0, yInt - 1)) * w
    const y1 = Math.min(h - 1, Math.max(0, yInt)) * w
    const y2 = Math.min(h - 1, Math.max(0, yInt + 1)) * w
    const y3 = Math.min(h - 1, Math.max(0, yInt + 2)) * w

    for (let X = 0; X < W; X++) {
      const xInt = allXInt[X]
      const wxBase = X * 4
      const wx0 = allWx[wxBase]
      const wx1 = allWx[wxBase + 1]
      const wx2 = allWx[wxBase + 2]
      const wx3 = allWx[wxBase + 3]

      const xm0 = Math.min(w - 1, Math.max(0, xInt - 1))
      const xm1 = Math.min(w - 1, Math.max(0, xInt))
      const xm2 = Math.min(w - 1, Math.max(0, xInt + 1))
      const xm3 = Math.min(w - 1, Math.max(0, xInt + 2))

      let rSum = 0, gSum = 0, bSum = 0, weightSum = 0, alphaSum = 0

      if (wy0 !== 0) {
        const i0 = y0 + xm0, a0 = srcA[i0]; if (a0) { const w = wy0 * wx0; rSum += srcR[i0] * w; gSum += srcG[i0] * w; bSum += srcB[i0] * w; weightSum += w; alphaSum += a0 * w }
        const i1 = y0 + xm1, a1 = srcA[i1]; if (a1) { const w = wy0 * wx1; rSum += srcR[i1] * w; gSum += srcG[i1] * w; bSum += srcB[i1] * w; weightSum += w; alphaSum += a1 * w }
        const i2 = y0 + xm2, a2 = srcA[i2]; if (a2) { const w = wy0 * wx2; rSum += srcR[i2] * w; gSum += srcG[i2] * w; bSum += srcB[i2] * w; weightSum += w; alphaSum += a2 * w }
        const i3 = y0 + xm3, a3 = srcA[i3]; if (a3) { const w = wy0 * wx3; rSum += srcR[i3] * w; gSum += srcG[i3] * w; bSum += srcB[i3] * w; weightSum += w; alphaSum += a3 * w }
      }
      if (wy1 !== 0) {
        const i0 = y1 + xm0, a0 = srcA[i0]; if (a0) { const w = wy1 * wx0; rSum += srcR[i0] * w; gSum += srcG[i0] * w; bSum += srcB[i0] * w; weightSum += w; alphaSum += a0 * w }
        const i1 = y1 + xm1, a1 = srcA[i1]; if (a1) { const w = wy1 * wx1; rSum += srcR[i1] * w; gSum += srcG[i1] * w; bSum += srcB[i1] * w; weightSum += w; alphaSum += a1 * w }
        const i2 = y1 + xm2, a2 = srcA[i2]; if (a2) { const w = wy1 * wx2; rSum += srcR[i2] * w; gSum += srcG[i2] * w; bSum += srcB[i2] * w; weightSum += w; alphaSum += a2 * w }
        const i3 = y1 + xm3, a3 = srcA[i3]; if (a3) { const w = wy1 * wx3; rSum += srcR[i3] * w; gSum += srcG[i3] * w; bSum += srcB[i3] * w; weightSum += w; alphaSum += a3 * w }
      }
      if (wy2 !== 0) {
        const i0 = y2 + xm0, a0 = srcA[i0]; if (a0) { const w = wy2 * wx0; rSum += srcR[i0] * w; gSum += srcG[i0] * w; bSum += srcB[i0] * w; weightSum += w; alphaSum += a0 * w }
        const i1 = y2 + xm1, a1 = srcA[i1]; if (a1) { const w = wy2 * wx1; rSum += srcR[i1] * w; gSum += srcG[i1] * w; bSum += srcB[i1] * w; weightSum += w; alphaSum += a1 * w }
        const i2 = y2 + xm2, a2 = srcA[i2]; if (a2) { const w = wy2 * wx2; rSum += srcR[i2] * w; gSum += srcG[i2] * w; bSum += srcB[i2] * w; weightSum += w; alphaSum += a2 * w }
        const i3 = y2 + xm3, a3 = srcA[i3]; if (a3) { const w = wy2 * wx3; rSum += srcR[i3] * w; gSum += srcG[i3] * w; bSum += srcB[i3] * w; weightSum += w; alphaSum += a3 * w }
      }
      if (wy3 !== 0) {
        const i0 = y3 + xm0, a0 = srcA[i0]; if (a0) { const w = wy3 * wx0; rSum += srcR[i0] * w; gSum += srcG[i0] * w; bSum += srcB[i0] * w; weightSum += w; alphaSum += a0 * w }
        const i1 = y3 + xm1, a1 = srcA[i1]; if (a1) { const w = wy3 * wx1; rSum += srcR[i1] * w; gSum += srcG[i1] * w; bSum += srcB[i1] * w; weightSum += w; alphaSum += a1 * w }
        const i2 = y3 + xm2, a2 = srcA[i2]; if (a2) { const w = wy3 * wx2; rSum += srcR[i2] * w; gSum += srcG[i2] * w; bSum += srcB[i2] * w; weightSum += w; alphaSum += a2 * w }
        const i3 = y3 + xm3, a3 = srcA[i3]; if (a3) { const w = wy3 * wx3; rSum += srcR[i3] * w; gSum += srcG[i3] * w; bSum += srcB[i3] * w; weightSum += w; alphaSum += a3 * w }
      }

      const pixelIdx = rowOffset + X * 4
      if (weightSum > 0.01 && alphaSum > 0.02) {
        const invW = 1 / weightSum
        d[pixelIdx] = Math.min(255, Math.max(0, Math.round(rSum * invW)))
        d[pixelIdx + 1] = Math.min(255, Math.max(0, Math.round(gSum * invW)))
        d[pixelIdx + 2] = Math.min(255, Math.max(0, Math.round(bSum * invW)))
        d[pixelIdx + 3] = Math.min(255, Math.max(0, Math.round(Math.min(1, alphaSum) * 255)))
      }
    }
  }

  return imgData
}

/**
 * Resamples a discrete w x h satellite raster into a high-resolution W x H continuous surface
 * using weighted bilinear interpolation, matching Google Earth Engine's resample('bilinear').
 */
function resampleBilinear(
  w: number,
  h: number,
  W: number,
  H: number,
  paint: Painter
): ImageData {
  const imgData = new ImageData(W, H)
  const d = imgData.data

  const srcR = new Float32Array(w * h)
  const srcG = new Float32Array(w * h)
  const srcB = new Float32Array(w * h)
  const srcA = new Float32Array(w * h)

  for (let i = 0; i < w * h; i++) {
    const c = paint(i)
    if (c) {
      srcR[i] = c[0]
      srcG[i] = c[1]
      srcB[i] = c[2]
      srcA[i] = 1.0
    }
  }

  const denomH = Math.max(1, H - 1)
  const denomW = Math.max(1, W - 1)
  const spanH = Math.max(0, h - 1)
  const spanW = Math.max(0, w - 1)

  const allX0 = new Int32Array(W)
  const allX1 = new Int32Array(W)
  const allFx = new Float32Array(W)
  for (let X = 0; X < W; X++) {
    const srcX = (X / denomW) * spanW
    const x0 = Math.floor(srcX)
    allX0[X] = x0
    allX1[X] = Math.min(w - 1, x0 + 1)
    allFx[X] = srcX - x0
  }

  for (let Y = 0; Y < H; Y++) {
    const srcY = (Y / denomH) * spanH
    const y0 = Math.floor(srcY)
    const y1 = Math.min(h - 1, y0 + 1)
    const fy = srcY - y0
    const rowOffset = Y * W * 4

    const i0_base = y0 * w
    const i1_base = y1 * w

    for (let X = 0; X < W; X++) {
      const x0 = allX0[X]
      const x1 = allX1[X]
      const fx = allFx[X]

      const i00 = i0_base + x0
      const i10 = i0_base + x1
      const i01 = i1_base + x0
      const i11 = i1_base + x1

      const w00 = (1 - fx) * (1 - fy)
      const w10 = fx * (1 - fy)
      const w01 = (1 - fx) * fy
      const w11 = fx * fy

      const totalA = srcA[i00] * w00 + srcA[i10] * w10 + srcA[i01] * w01 + srcA[i11] * w11
      const pixelIdx = rowOffset + (X * 4)

      if (totalA > 0.02) {
        const invA = 1 / totalA
        const r = (srcR[i00] * w00 + srcR[i10] * w10 + srcR[i01] * w01 + srcR[i11] * w11) * invA
        const g = (srcG[i00] * w00 + srcG[i10] * w10 + srcG[i01] * w01 + srcG[i11] * w11) * invA
        const b = (srcB[i00] * w00 + srcB[i10] * w10 + srcB[i01] * w01 + srcB[i11] * w11) * invA

        d[pixelIdx] = Math.min(255, Math.max(0, Math.round(r)))
        d[pixelIdx + 1] = Math.min(255, Math.max(0, Math.round(g)))
        d[pixelIdx + 2] = Math.min(255, Math.max(0, Math.round(b)))
        d[pixelIdx + 3] = Math.min(255, Math.max(0, Math.round(totalA * 255)))
      }
    }
  }

  return imgData
}

/**
 * Renders AOI clipped raster image with subpixel vector boundary anti-aliasing
 * and high-DPI scaling. Dimensions are bounded up to 512px for lightning-fast 60fps rendering
 * without browser unresponsiveness on large agricultural holdings.
 */
export function paintClipped(
  w: number,
  h: number,
  bbox: Bbox,
  ring: Ring,
  paint: Painter,
  smooth = true,
  sharpen = 0.25,
  resampling: ResamplingMethod = 'cubic'
): string {
  const maxDim = Math.max(w, h)
  const targetDim = maxDim >= 128 ? Math.min(512, maxDim) : Math.min(512, Math.max(256, maxDim * 8))
  const scale = Math.max(1, Math.min(16, Math.round(targetDim / maxDim)))
  const W = Math.min(512, Math.max(128, w * scale))
  const H = Math.min(512, Math.max(128, h * scale))

  const outCanvas = document.createElement('canvas')
  outCanvas.width = W
  outCanvas.height = H
  const ctx = outCanvas.getContext('2d')!

  if (smooth && resampling !== 'nearest') {
    const continuousData = resampling === 'cubic'
      ? resampleBicubic(w, h, W, H, paint)
      : resampleBilinear(w, h, W, H, paint)
    ctx.putImageData(continuousData, 0, 0)
    if (sharpen > 0) {
      applyUnsharp(ctx, W, H, sharpen)
    }
  } else {
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
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(srcCanvas, 0, 0, W, H)
  }

  // Exact subpixel vector clipping strictly to farm polygon boundary
  const [west, south, east, north] = bbox
  const ringPx: [number, number][] = ring.map(([lon, lat]) => {
    const px = ((lon - west) / (east - west)) * W
    const py = ((north - lat) / (north - south)) * H
    return [px, py]
  })

  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.beginPath()
  ringPx.forEach(([px, py], i) => {
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
 * at high-DPI resolution with bounded dimensions to prevent page unresponsiveness.
 */
export function paintRaw(
  w: number,
  h: number,
  _bbox: Bbox,
  paint: Painter,
  smooth = false,
  sharpen = 0,
  resampling: ResamplingMethod = 'cubic'
): string {
  const maxDim = Math.max(w, h)
  const targetDim = maxDim >= 128 ? Math.min(512, maxDim) : Math.min(512, Math.max(256, maxDim * 8))
  const scale = Math.max(1, Math.min(16, Math.round(targetDim / maxDim)))
  const W = Math.min(512, Math.max(128, w * scale))
  const H = Math.min(512, Math.max(128, h * scale))

  const outCanvas = document.createElement('canvas')
  outCanvas.width = W
  outCanvas.height = H
  const ctx = outCanvas.getContext('2d')!
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)

  if (smooth && resampling !== 'nearest') {
    const continuousData = resampling === 'cubic'
      ? resampleBicubic(w, h, W, H, paint)
      : resampleBilinear(w, h, W, H, paint)
    ctx.putImageData(continuousData, 0, 0)
    if (sharpen > 0) {
      applyUnsharp(ctx, W, H, sharpen)
    }
  } else {
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
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(srcCanvas, 0, 0, W, H)
  }

  return outCanvas.toDataURL('image/png')
}
