import { getDistance, getRhumbLineBearing } from 'geolib'
import { renderLayer, byId, type Grid } from './indicators'
import { paintClipped, type Ring } from './raster'
import { farmRing, history, loadFrame, loadScene, type Candle, type FarmGeo, type Scene } from './seva'
import type { Weather } from './agro'

export type ClassRow = { id: string; name: string; color: string; pct: number; ha: number; note?: string }
export type MapResult = { url: string; rows: ClassRow[]; validHa: number }

export const dirOf = (deg: number) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const cellHa = (g: Grid) => (g.dx * g.dy) / 10000
const usable = (g: Grid, i: number) => !!g.inside[i] && !!g.ok[i]

function tally(g: Grid, ring: Ring, defs: { id: string; name: string; color: string; note?: string }[], pick: (i: number) => number): MapResult {
  const counts = new Array(defs.length).fill(0)
  let total = 0
  const cls = new Int8Array(g.w * g.h).fill(-1)
  for (let i = 0; i < cls.length; i++) {
    if (!usable(g, i)) continue
    const k = pick(i)
    if (k < 0) continue
    cls[i] = k; counts[k]++; total++
  }
  const url = paintClipped(g.w, g.h, g.bbox, ring, i => (cls[i] >= 0 ? hex(defs[cls[i]].color) : null), true, 0.25)
  const ha = cellHa(g)
  return { url, validHa: total * ha, rows: defs.map((d, k) => ({ ...d, pct: total ? (counts[k] / total) * 100 : 0, ha: counts[k] * ha })) }
}

export const LANDCOVER = [
  { id: 'water', name: 'Open or flooded water', color: '#2b83ba', note: 'MNDWI > 0.10 and NDVI < 0.20. Includes flooded paddy before transplanting.' },
  { id: 'dense', name: 'Dense canopy / tall crop', color: '#006837', note: 'NDVI ≥ 0.60. Orchards, sugarcane, peak-season cereals.' },
  { id: 'crop', name: 'Active crop', color: '#66bd63', note: 'NDVI 0.40 to 0.60. Growing field crops.' },
  { id: 'sparse', name: 'Sparse or early crop', color: '#d9ef8b', note: 'NDVI 0.20 to 0.40. Seedlings, stressed crop, grass.' },
  { id: 'fallow', name: 'Fallow / bare soil', color: '#d8b365', note: 'NDVI < 0.20 and low built-up signal.' },
  { id: 'built', name: 'Built-up / rock', color: '#9e9e9e', note: 'NDBI > 0.15 and NDVI < 0.15. Sheds, roads, threshing floors.' },
]

export function landCover(g: Grid, ring: Ring): MapResult {
  const { B03, B04, B08, B11 } = g.b
  return tally(g, ring, LANDCOVER, i => {
    const ndvi = (B08[i] - B04[i]) / (B08[i] + B04[i] + 1e-9), mndwi = (B03[i] - B11[i]) / (B03[i] + B11[i] + 1e-9), ndbi = (B11[i] - B08[i]) / (B11[i] + B08[i] + 1e-9)
    if (!Number.isFinite(ndvi)) return -1
    if (mndwi > 0.1 && ndvi < 0.2) return 0
    if (ndvi >= 0.6) return 1
    if (ndvi >= 0.4) return 2
    if (ndvi >= 0.2) return 3
    return ndbi > 0.15 && ndvi < 0.15 ? 5 : 4
  })
}

const ZONE_COLORS = ['#a50026', '#f46d43', '#fee08b', '#66bd63', '#006837']

// Unsupervised k-means (the ee.Clusterer.wekaKMeans idea) on NDVI, NDMI and NDRE, ordered by vigour.
export function managementZones(g: Grid, ring: Ring, k = 5): MapResult & { means: { ndvi: number; ndmi: number }[] } {
  const { B03, B04, B05, B08, B11 } = g.b
  const n = g.w * g.h, F = [new Float64Array(n), new Float64Array(n), new Float64Array(n)], idx: number[] = []
  for (let i = 0; i < n; i++) {
    if (!usable(g, i)) continue
    const a = (B08[i] - B04[i]) / (B08[i] + B04[i] + 1e-9), b = (B08[i] - B11[i]) / (B08[i] + B11[i] + 1e-9), c = (B08[i] - B05[i]) / (B08[i] + B05[i] + 1e-9)
    if (![a, b, c].every(Number.isFinite)) continue
    F[0][i] = a; F[1][i] = b; F[2][i] = c; idx.push(i)
  }
  const empty = { url: '', rows: [], validHa: 0, means: [] }
  if (idx.length < k * 8) return empty
  const sd = F.map(f => { let m = 0, s = 0; idx.forEach(i => (m += f[i])); m /= idx.length; idx.forEach(i => (s += (f[i] - m) ** 2)); return Math.sqrt(s / idx.length) || 1 })

  // Use a stratified sample of up to 1200 points for centroid training to keep clustering under 5ms
  const step = Math.max(1, Math.floor(idx.length / 1200))
  const trainIdx: number[] = []
  for (let i = 0; i < idx.length; i += step) trainIdx.push(idx[i])
  const sorted = [...trainIdx].sort((p, q) => F[0][p] - F[0][q])
  let cent = Array.from({ length: k }, (_, c) => { const i = sorted[Math.floor(((c + 0.5) / k) * sorted.length)]; return F.map(f => f[i]) })

  for (let it = 0; it < 8; it++) {
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0])
    for (const i of trainIdx) {
      let best = 0, bd = Infinity
      for (let c = 0; c < k; c++) { let d = 0; for (let j = 0; j < 3; j++) d += ((F[j][i] - cent[c][j]) / sd[j]) ** 2; if (d < bd) { bd = d; best = c } }
      const s = sum[best]; s[0] += F[0][i]; s[1] += F[1][i]; s[2] += F[2][i]; s[3]++
    }
    cent = cent.map((c, ci) => (sum[ci][3] ? [sum[ci][0] / sum[ci][3], sum[ci][1] / sum[ci][3], sum[ci][2] / sum[ci][3]] : c))
  }

  // Final single assignment pass over all pixels
  const label = new Int8Array(n).fill(-1)
  for (const i of idx) {
    let best = 0, bd = Infinity
    for (let c = 0; c < k; c++) { let d = 0; for (let j = 0; j < 3; j++) d += ((F[j][i] - cent[c][j]) / sd[j]) ** 2; if (d < bd) { bd = d; best = c } }
    label[i] = best
  }

  const order = cent.map((c, i) => [c[0], i]).sort((a, b) => a[0] - b[0]).map(x => x[1])
  const rank = new Array(k); order.forEach((c, r) => (rank[c] = r))
  const defs = order.map((_, r) => ({ id: `z${r}`, name: r === 0 ? 'Zone 1 · lowest vigour' : r === k - 1 ? `Zone ${k} · highest vigour` : `Zone ${r + 1}`, color: ZONE_COLORS[Math.round((r / (k - 1)) * 4)] }))
  const res = tally(g, ring, defs, i => (label[i] >= 0 ? rank[label[i]] : -1))
  return { ...res, means: order.map(c => ({ ndvi: cent[c][0], ndmi: cent[c][1] })) }
}

export const CHANGE_CLASSES = [
  { id: 'sd', name: 'Strong decline', color: '#b2182b', note: 'NDVI fell by more than 0.15' },
  { id: 'd', name: 'Decline', color: '#ef8a62', note: 'NDVI fell by 0.05 to 0.15' },
  { id: 's', name: 'Stable', color: '#f7f7f7', note: 'Change within ±0.05' },
  { id: 'i', name: 'Improvement', color: '#a6d96a', note: 'NDVI rose by 0.05 to 0.15' },
  { id: 'si', name: 'Strong improvement', color: '#1a9850', note: 'NDVI rose by more than 0.15' },
]

export type ChangeResult = MapResult & { mean: number; meanMoisture: number; a: Scene; b: Scene }

export async function changeAnalysis(farm: FarmGeo, a: Scene, b: Scene): Promise<ChangeResult> {
  const [ga, gb] = await Promise.all([loadScene(a, farm), loadScene(b, farm)])
  const ring = farmRing(farm), n = ga.w * ga.h, nd = byId('ndvi').value!, nm = byId('ndmi').value!
  const d = new Float64Array(n).fill(NaN)
  let sum = 0, cnt = 0, ms = 0
  for (let i = 0; i < n; i++) {
    if (!usable(ga, i) || !usable(gb, i)) continue
    const v = nd(gb.b, i) - nd(ga.b, i)
    if (!Number.isFinite(v)) continue
    d[i] = v; sum += v; cnt++; ms += nm(gb.b, i) - nm(ga.b, i)
  }
  const res = tally(ga, ring, CHANGE_CLASSES, i => (Number.isNaN(d[i]) ? -1 : d[i] < -0.15 ? 0 : d[i] < -0.05 ? 1 : d[i] <= 0.05 ? 2 : d[i] <= 0.15 ? 3 : 4))
  return { ...res, mean: cnt ? sum / cnt : NaN, meanMoisture: cnt ? ms / cnt : NaN, a, b }
}

export async function sceneNdvi(farm: FarmGeo, scene: Scene) {
  const g = await loadScene(scene, farm)
  return renderLayer(byId('ndvi'), g, farmRing(farm))
}

export type Phenology = { points: { t: number; date: string; ndvi: number; ndmi: number; z: number }[]; mean: number; sd: number; slope30: number; peak?: { date: string; ndvi: number }; start?: string; end?: string; anomalies: number }

export function phenology(rows: Candle[]): Phenology | null {
  if (rows.length < 4) return null
  const vals = rows.map(r => r.ndvi.mean), mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1e-6
  const t0 = new Date(rows[0].scene.datetime).getTime()
  const points = rows.map(r => ({ t: (new Date(r.scene.datetime).getTime() - t0) / 86400000, date: r.scene.datetime.slice(0, 10), ndvi: r.ndvi.mean, ndmi: r.ndmi, z: (r.ndvi.mean - mean) / sd }))
  const mt = points.reduce((a, p) => a + p.t, 0) / points.length
  const sxx = points.reduce((a, p) => a + (p.t - mt) ** 2, 0) || 1, sxy = points.reduce((a, p) => a + (p.t - mt) * (p.ndvi - mean), 0)
  const peakIdx = vals.indexOf(Math.max(...vals)), lo = Math.min(...vals), half = lo + (vals[peakIdx] - lo) / 2
  let start: string | undefined, end: string | undefined
  for (let i = peakIdx; i >= 0; i--) if (vals[i] < half) { start = points[Math.min(i + 1, peakIdx)].date; break }
  for (let i = peakIdx; i < vals.length; i++) if (vals[i] < half) { end = points[i].date; break }
  return { points, mean, sd, slope30: (sxy / sxx) * 30, peak: { date: points[peakIdx].date, ndvi: vals[peakIdx] }, start, end, anomalies: points.filter(p => p.z < -1.5).length }
}

export const loadHistory = (farm: FarmGeo) => history(farm, 365, 16)

export const HOTSPOT = [
  { id: 'watch', name: 'Watch', color: '#fee08b', note: 'Weaker than field average by 1 to 1.5 standard deviations' },
  { id: 'alert', name: 'Alert', color: '#f46d43', note: '1.5 to 2.5 standard deviations below field average' },
  { id: 'severe', name: 'Severe', color: '#a50026', note: 'More than 2.5 standard deviations below field average' },
]
const SIGNATURE = ['canopy density (NDVI)', 'chlorophyll (NDRE)', 'canopy water (NDMI)']
export type Patch = { n: number; ha: number; lat: number; lon: number; z: number; signature: string; bearing: string; distM: number }
export type Hotspots = MapResult & { patches: Patch[]; signatures: { name: string; pct: number }[]; healthyPct: number; clustered: boolean }

export function hotspots(g: Grid, ring: Ring, center: { lat: number; lon: number }): Hotspots | null {
  const { B04, B05, B08, B11 } = g.b, n = g.w * g.h
  const F = [new Float64Array(n), new Float64Array(n), new Float64Array(n)], idx: number[] = []
  for (let i = 0; i < n; i++) {
    if (!usable(g, i)) continue
    const a = (B08[i] - B04[i]) / (B08[i] + B04[i] + 1e-9), b = (B08[i] - B05[i]) / (B08[i] + B05[i] + 1e-9), c = (B08[i] - B11[i]) / (B08[i] + B11[i] + 1e-9)
    if (![a, b, c].every(Number.isFinite) || a < 0.05) continue
    F[0][i] = a; F[1][i] = b; F[2][i] = c; idx.push(i)
  }
  if (idx.length < 30) return null
  const st = F.map(f => { let m = 0, s = 0; idx.forEach(i => (m += f[i])); m /= idx.length; idx.forEach(i => (s += (f[i] - m) ** 2)); return { m, s: Math.sqrt(s / idx.length) || 1e-6 } })
  const zmin = new Float64Array(n).fill(0), sig = new Int8Array(n).fill(-1)
  for (const i of idx) {
    let best = 0, bz = Infinity
    for (let j = 0; j < 3; j++) { const z = (F[j][i] - st[j].m) / st[j].s; if (z < bz) { bz = z; best = j } }
    zmin[i] = bz; sig[i] = best
  }
  const level = (i: number) => (sig[i] < 0 ? -1 : zmin[i] < -2.5 ? 2 : zmin[i] < -1.5 ? 1 : zmin[i] < -1 ? 0 : -1)
  const res = tally(g, ring, HOTSPOT, level)
  const seen = new Uint8Array(n), patches: Patch[] = [], ha = cellHa(g), sigCount = [0, 0, 0]
  let flagged = 0
  const lonAt = (x: number) => g.bbox[0] + ((x + 0.5) / g.w) * (g.bbox[2] - g.bbox[0]), latAt = (y: number) => g.bbox[3] - ((y + 0.5) / g.h) * (g.bbox[3] - g.bbox[1])
  for (const s of idx) {
    if (level(s) < 1) continue
    flagged++; sigCount[sig[s]]++
    if (seen[s]) continue
    const stack = [s]; seen[s] = 1
    let cnt = 0, sx = 0, sy = 0, sz = 0
    const sc = [0, 0, 0]
    while (stack.length) {
      const p = stack.pop()!, x = p % g.w, y = (p - x) / g.w
      cnt++; sx += x; sy += y; sz += zmin[p]; sc[sig[p]]++
      for (const q of [p - 1, p + 1, p - g.w, p + g.w]) {
        if (q < 0 || q >= n || seen[q] || level(q) < 1) continue
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === g.w - 1)) continue
        seen[q] = 1; stack.push(q)
      }
    }
    if (cnt < 3) continue
    const lat = latAt(sy / cnt), lon = lonAt(sx / cnt)
    patches.push({ n: cnt, ha: cnt * ha, lat, lon, z: sz / cnt, signature: SIGNATURE[sc.indexOf(Math.max(...sc))], bearing: dirOf(getRhumbLineBearing(center, { latitude: lat, longitude: lon })), distM: getDistance(center, { latitude: lat, longitude: lon }) })
  }
  patches.sort((a, b) => b.ha * -b.z - a.ha * -a.z)
  const inPatches = patches.reduce((a, p) => a + p.n, 0)
  return { ...res, patches: patches.slice(0, 6), signatures: SIGNATURE.map((name, k) => ({ name, pct: flagged ? (sigCount[k] / flagged) * 100 : 0 })), healthyPct: 100 - res.rows.reduce((a, r) => a + r.pct, 0), clustered: flagged > 0 && inPatches / flagged > 0.6 }
}

export type Risk = { id: string; name: string; score: number; why: string; targets: string }
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const fit = (t: number, lo: number, hi: number, soft = 8) => (t >= lo && t <= hi ? 1 : clamp(1 - (t < lo ? lo - t : t - hi) / soft))

// Rule-of-thumb weather suitability models for common crop threats, not calibrated forecasts.
export function pestRisks(w: Weather): Risk[] {
  const wet = w.rain7 + w.rainNext7
  const r = (id: string, name: string, score: number, why: string, targets: string): Risk => ({ id, name, score: Math.round(clamp(score) * 100), why, targets })
  return [
    r('fungal', 'Fungal leaf disease', 0.4 * clamp((w.rh - 60) / 30) + 0.25 * (1 - clamp(w.vpd / 1.5)) + 0.2 * fit(w.temp, 18, 26) + 0.15 * clamp(wet / 40), `Humidity ${w.rh.toFixed(0)}%, VPD ${w.vpd.toFixed(1)} kPa, ${wet.toFixed(0)} mm rain ±7 days`, 'Blight, rust, blast, downy mildew'),
    r('mildew', 'Powdery mildew', 0.45 * fit(w.temp, 18, 30, 6) + 0.35 * fit(w.rh, 45, 80, 25) + 0.2 * (1 - clamp(w.rain7 / 25)), `${w.temp.toFixed(0)} °C with moderate humidity and dry leaves`, 'Cucurbits, peas, grapes, mango, wheat'),
    r('bacterial', 'Bacterial blight and leaf spot', 0.4 * fit(w.temp, 25, 34, 6) + 0.35 * clamp(wet / 50) + 0.25 * clamp(w.wind / 25), `Warm, wet and windy: ${w.temp.toFixed(0)} °C, ${w.wind.toFixed(0)} km/h wind`, 'Rice, cotton, tomato, pomegranate'),
    r('sucking', 'Sucking pests', 0.4 * fit(w.temp, 22, 32, 7) + 0.3 * (1 - clamp(w.rain7 / 30)) + 0.3 * clamp(w.gdd30 / 450), `${w.gdd30.toFixed(0)} growing degree-days in 30 days, ${w.rain7.toFixed(0)} mm rain last week`, 'Aphids, whitefly, jassids, thrips'),
    r('chewing', 'Borers and caterpillars', 0.45 * fit(w.temp, 24, 33, 6) + 0.3 * clamp((w.rh - 55) / 30) + 0.25 * clamp(w.gdd30 / 450), `Warm humid nights favour egg-laying and larval growth`, 'Stem borer, fall armyworm, bollworm'),
    r('heat', 'Heat stress', (w.tmaxNext7 - 32) / 9, `Hottest day in the next 7 days: ${w.tmaxNext7.toFixed(0)} °C`, 'Flowering and grain-fill stages'),
    r('frost', 'Frost and cold injury', (6 - w.tminNext7) / 8, `Coldest night in the next 7 days: ${w.tminNext7.toFixed(0)} °C`, 'Vegetables, banana, pulses at flowering'),
  ]
}

export const RISK_BANDS = [
  { to: 25, label: 'Low', color: '#1a9850' }, { to: 50, label: 'Moderate', color: '#fee08b' }, { to: 75, label: 'High', color: '#f46d43' }, { to: Infinity, label: 'Very high', color: '#a50026' },
]
export const riskBand = (s: number) => RISK_BANDS.find(b => s < b.to)!

export type Frame = { scene: Scene; url: string; ndvi: number; delta: number }
export type TimelapseMode = 'rgb' | 'ndvi' | 'change'
export type Timelapse = { frames: Frame[]; w: number; h: number; mode: TimelapseMode }

const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

export async function timelapse(farm: FarmGeo, scenes: Scene[], mode: TimelapseMode, onFrame?: (done: number, total: number) => void): Promise<Timelapse> {
  const ring = farmRing(farm), nd = byId('ndvi').value!
  let base: Float64Array | null = null
  const frames: Frame[] = []
  let w = 0, h = 0, done = 0
  for (const scene of scenes) {
    try {
      const g = await loadFrame(scene, farm)
      w = g.w; h = g.h
      const n = g.w * g.h, v = new Float64Array(n).fill(NaN)
      let s = 0, c = 0
      for (let i = 0; i < n; i++) if (usable(g, i)) { const x = nd(g.b, i); if (Number.isFinite(x) && x > -1 && x < 1) { v[i] = x; s += x; c++ } }
      if (c < 20) continue
      if (!base) base = v
      let url: string, delta = 0
      if (mode === 'change') {
        const ref = base
        let ds = 0, dc = 0
        const cols = CHANGE_CLASSES.map(k => hexRgb(k.color))
        url = paintClipped(g.w, g.h, g.bbox, ring, i => {
          if (Number.isNaN(v[i]) || Number.isNaN(ref[i])) return null
          const d = v[i] - ref[i]; ds += d; dc++
          return cols[d < -0.15 ? 0 : d < -0.05 ? 1 : d <= 0.05 ? 2 : d <= 0.15 ? 3 : 4]
        })
        delta = dc ? ds / dc : 0
      } else {
        url = renderLayer(byId(mode === 'rgb' ? 'rgb' : 'ndvi'), g, ring).url
        delta = c ? s / c - (frames[0]?.ndvi ?? s / c) : 0
      }
      frames.push({ scene, url, ndvi: s / c, delta })
    } catch { /* skip a scene that fails to download */ }
    onFrame?.(++done, scenes.length)
  }
  if (frames.length < 2) throw new Error('Fewer than two usable clear pictures in that range. Widen the dates or raise the cloud limit.')
  return { frames, w, h, mode }
}
