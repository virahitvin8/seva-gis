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

export type Stat = { mean: number; min: number; max: number; p10: number; p50: number; p90: number; n: number; stdDev?: number }
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

  for (let Y = 0; Y < H; Y++) {
    const srcY = (Y / denomH) * spanH
    const yInt = Math.floor(srcY)
    const dy = srcY - yInt
    const rowOffset = Y * W * 4

    const wy = [
      cubicWeight(-1 - dy),
      cubicWeight(0 - dy),
      cubicWeight(1 - dy),
      cubicWeight(2 - dy)
    ]

    for (let X = 0; X < W; X++) {
      const srcX = (X / denomW) * spanW
      const xInt = Math.floor(srcX)
      const dx = srcX - xInt

      const wx = [
        cubicWeight(-1 - dx),
        cubicWeight(0 - dx),
        cubicWeight(1 - dx),
        cubicWeight(2 - dx)
      ]

      let rSum = 0
      let gSum = 0
      let bSum = 0
      let weightSum = 0
      let alphaSum = 0

      for (let n = -1; n <= 2; n++) {
        const yn = Math.min(h - 1, Math.max(0, yInt + n))
        const wY = wy[n + 1]
        const yBase = yn * w

        for (let m = -1; m <= 2; m++) {
          const xm = Math.min(w - 1, Math.max(0, xInt + m))
          const w2D = wY * wx[m + 1]
          const idx = yBase + xm
          const a = srcA[idx]

          if (a > 0) {
            const effW = w2D * a
            rSum += srcR[idx] * effW
            gSum += srcG[idx] * effW
            bSum += srcB[idx] * effW
            weightSum += effW
            alphaSum += a * Math.max(0, w2D)
          }
        }
      }

      const pixelIdx = rowOffset + X * 4
      if (weightSum > 0.01 && alphaSum > 0.05) {
        d[pixelIdx] = Math.min(255, Math.max(0, Math.round(rSum / weightSum)))
        d[pixelIdx + 1] = Math.min(255, Math.max(0, Math.round(gSum / weightSum)))
        d[pixelIdx + 2] = Math.min(255, Math.max(0, Math.round(bSum / weightSum)))
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

  for (let Y = 0; Y < H; Y++) {
    const srcY = (Y / denomH) * spanH
    const y0 = Math.floor(srcY)
    const y1 = Math.min(h - 1, y0 + 1)
    const fy = srcY - y0
    const rowOffset = Y * W * 4

    const i0_base = y0 * w
    const i1_base = y1 * w

    for (let X = 0; X < W; X++) {
      const srcX = (X / denomW) * spanW
      const x0 = Math.floor(srcX)
      const x1 = Math.min(w - 1, x0 + 1)
      const fx = srcX - x0

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
        const r = (srcR[i00] * w00 + srcR[i10] * w10 + srcR[i01] * w01 + srcR[i11] * w11) / totalA
        const g = (srcG[i00] * w00 + srcG[i10] * w10 + srcG[i01] * w01 + srcG[i11] * w11) / totalA
        const b = (srcB[i00] * w00 + srcB[i10] * w10 + srcB[i01] * w01 + srcB[i11] * w11) / totalA

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
 * and high-DPI scaling (1024px minimum dimension, matching Earth Engine / QGIS quality).
 * Supports Cubic Spline, Bilinear, and Nearest Neighbour resampling.
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
  const targetDim = 1024
  const scale = Math.max(1, Math.min(32, Math.ceil(targetDim / Math.max(w, h))))
  const W = Math.max(targetDim, w * scale)
  const H = Math.max(targetDim, h * scale)

  const outCanvas = document.createElement('canvas')
  outCanvas.width = W
  outCanvas.height = H
  const ctx = outCanvas.getContext('2d')!

  if (smooth && resampling !== 'nearest') {
    // Cubic or Bilinear continuous surface reconstruction
    const continuousData = resampling === 'cubic'
      ? resampleBicubic(w, h, W, H, paint)
      : resampleBilinear(w, h, W, H, paint)
    ctx.putImageData(continuousData, 0, 0)
    if (sharpen > 0) {
      applyUnsharp(ctx, W, H, sharpen)
    }
  } else {
    // Discrete 10m grid cell inspection (Nearest Neighbour)
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
    ctx.imageSmoothingEnabled = false
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
 * at high-DPI resolution with configurable resampling method.
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
  const targetDim = 1024
  const scale = Math.max(1, Math.min(32, Math.ceil(targetDim / Math.max(w, h))))
  const W = Math.max(targetDim, w * scale)
  const H = Math.max(targetDim, h * scale)

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
      } else {
        srcImg.data[i * 4] = 0
        srcImg.data[i * 4 + 1] = 0
        srcImg.data[i * 4 + 2] = 0
        srcImg.data[i * 4 + 3] = 255
      }
    }
    srcCtx.putImageData(srcImg, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(srcCanvas, 0, 0, W, H)
  }

  return outCanvas.toDataURL('image/png')
}
