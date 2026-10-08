import type { Bbox } from './raster'

type Heap = { k: number[]; v: number[] }
const push = (h: Heap, key: number, val: number) => {
  let i = h.k.length; h.k.push(key); h.v.push(val)
  while (i > 0) { const p = (i - 1) >> 1; if (h.k[p] <= h.k[i]) break; [h.k[p], h.k[i]] = [h.k[i], h.k[p]]; [h.v[p], h.v[i]] = [h.v[i], h.v[p]]; i = p }
}
const pop = (h: Heap) => {
  const val = h.v[0], lk = h.k.pop()!, lv = h.v.pop()!
  if (h.k.length) {
    h.k[0] = lk; h.v[0] = lv
    let i = 0
    for (;;) { const l = 2 * i + 1, r = l + 1; let m = i
      if (l < h.k.length && h.k[l] < h.k[m]) m = l
      if (r < h.k.length && h.k[r] < h.k[m]) m = r
      if (m === i) break
      ;[h.k[m], h.k[i]] = [h.k[i], h.k[m]]; [h.v[m], h.v[i]] = [h.v[i], h.v[m]]; i = m }
  }
  return val
}

const N8: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]

export function hydroBands(elev: Float64Array, slope: Float64Array, w: number, h: number, dx: number, dy: number) {
  const n = w * h, filled = new Float64Array(elev), seen = new Uint8Array(n), heap: Heap = { k: [], v: [] }
  const edge = (x: number, y: number) => x === 0 || y === 0 || x === w - 1 || y === h - 1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (edge(x, y)) { seen[y * w + x] = 1; push(heap, filled[y * w + x], y * w + x) }
  while (heap.k.length) {
    const c = pop(heap), cx = c % w, cy = (c / w) | 0
    for (const [ox, oy] of N8) {
      const x = cx + ox, y = cy + oy
      if (x < 0 || y < 0 || x >= w || y >= h) continue
      const i = y * w + x
      if (seen[i]) continue
      seen[i] = 1; filled[i] = Math.max(elev[i], filled[c] + 1e-4); push(heap, filled[i], i)
    }
  }
  const dir = new Int32Array(n).fill(-1)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let best = 0
    for (const [ox, oy] of N8) {
      const nx = x + ox, ny = y + oy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const drop = (filled[i] - filled[ny * w + nx]) / Math.hypot(ox * dx, oy * dy)
      if (drop > best) { best = drop; dir[i] = ny * w + nx }
    }
  }
  const order = Uint32Array.from({ length: n }, (_, i) => i).sort((a, b) => filled[b] - filled[a])
  const acc = new Float64Array(n).fill(1)
  for (const i of order) if (dir[i] >= 0) acc[dir[i]] += acc[i]
  const cell = dx * dy, cw = (dx + dy) / 2
  const twi = new Float64Array(n), flow = new Float64Array(n), sink = new Float64Array(n), bw = new Float64Array(n)
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  for (let i = 0; i < n; i++) {
    const tanB = Math.max(Math.tan((slope[i] * Math.PI) / 180), 0.005)
    twi[i] = Math.log(((acc[i] * cell) / cw) / tanB)
    flow[i] = (acc[i] * cell) / 10000
    sink[i] = (filled[i] - elev[i]) * 100
    bw[i] = 100 * (0.5 * clamp((twi[i] - 5) / 9) + 0.25 * clamp((Math.log10(flow[i]) + 1) / 3) + 0.25 * clamp(1 - slope[i] / 8))
  }
  return { twi, flow, sink, bw }
}

export function resample(src: Float64Array, sw: number, sh: number, sb: Bbox, dw: number, dh: number, db: Bbox, nearest = false) {
  const out = new Float64Array(dw * dh)
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const lon = db[0] + ((x + 0.5) / dw) * (db[2] - db[0]), lat = db[3] - ((y + 0.5) / dh) * (db[3] - db[1])
    const fx = ((lon - sb[0]) / (sb[2] - sb[0])) * sw - 0.5, fy = ((sb[3] - lat) / (sb[3] - sb[1])) * sh - 0.5
    const cx = Math.min(sw - 1, Math.max(0, fx)), cy = Math.min(sh - 1, Math.max(0, fy))
    if (nearest) { out[y * dw + x] = src[Math.round(cy) * sw + Math.round(cx)]; continue }
    const x0 = Math.floor(cx), y0 = Math.floor(cy), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1), tx = cx - x0, ty = cy - y0
    const a = src[y0 * sw + x0] * (1 - tx) + src[y0 * sw + x1] * tx, b = src[y1 * sw + x0] * (1 - tx) + src[y1 * sw + x1] * tx
    out[y * dw + x] = a * (1 - ty) + b * ty
  }
  return out
}

// Saxton & Rawls (2006) pedotransfer. sand, clay in %, om in %.
export function soilHydraulics(sandPct: number, clayPct: number, omPct: number) {
  const S = sandPct / 100, C = clayPct / 100, OM = omPct
  const t1500 = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031
  const pwp = t1500 + (0.14 * t1500 - 0.02)
  const t33 = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299
  const fc = t33 + (1.283 * t33 * t33 - 0.374 * t33 - 0.015)
  const tS33 = 0.278 * S + 0.034 * C + 0.022 * OM - 0.018 * S * OM - 0.027 * C * OM - 0.584 * S * C + 0.078
  const sat = fc + (tS33 + (0.636 * tS33 - 0.107)) - 0.097 * S + 0.043
  const lambda = (Math.log(fc) - Math.log(pwp)) / (Math.log(1500) - Math.log(33))
  const ks = 1930 * Math.pow(Math.max(sat - fc, 0.001), 3 - lambda)
  return { pwp, fc, sat, ks, awc: (fc - pwp) * 1000 }
}

export const CROPS = [
  { id: 'rice', name: 'Rice', kc: 1.15, root: 0.5 }, { id: 'wheat', name: 'Wheat', kc: 1.05, root: 1.0 }, { id: 'maize', name: 'Maize', kc: 1.15, root: 1.0 },
  { id: 'cotton', name: 'Cotton', kc: 1.1, root: 1.2 }, { id: 'sugarcane', name: 'Sugarcane', kc: 1.2, root: 1.2 }, { id: 'veg', name: 'Vegetables', kc: 0.95, root: 0.5 },
  { id: 'pulses', name: 'Pulses', kc: 0.9, root: 0.8 }, { id: 'groundnut', name: 'Groundnut', kc: 1.0, root: 0.6 }, { id: 'orchard', name: 'Orchard / fruit trees', kc: 0.85, root: 1.5 },
  { id: 'pasture', name: 'Pasture / fodder', kc: 0.9, root: 0.6 },
]
export const METHODS = [
  { id: 'flood', name: 'Flood', eff: 0.55, head: 2 }, { id: 'furrow', name: 'Furrow', eff: 0.65, head: 3 },
  { id: 'sprinkler', name: 'Sprinkler', eff: 0.75, head: 25 }, { id: 'drip', name: 'Drip', eff: 0.9, head: 12 },
]

// Hazen-Williams head loss (m) for flow m3/h, inside diameter mm, length m.
export function pipeHydraulics(flowM3h: number, diaMm: number, lengthM: number, c = 150) {
  const q = flowM3h / 3600, d = diaMm / 1000
  const area = (Math.PI * d * d) / 4
  return { velocity: q / area, headLoss: q > 0 ? (10.67 * lengthM * Math.pow(q, 1.852)) / (Math.pow(c, 1.852) * Math.pow(d, 4.87)) : 0 }
}
export function pumpKw(flowM3h: number, headM: number, eff = 0.55) { return (1000 * 9.81 * (flowM3h / 3600) * headM) / eff / 1000 }
