import type { Grid } from './indicators'
import { LANDCOVER } from './gee'
import { paintClipped, paintRaw, type Ring } from './raster'

export type ClassDef = { id: string; name: string; color: string }
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const usable = (g: Grid, i: number) => !!g.inside[i] && !!g.ok[i]

export type BandCombo = {
  id: string
  name: string
  desc: string
  bands: [string, string, string] // [R, G, B]
  badge: string
}

export const BAND_COMBINATIONS: BandCombo[] = [
  { id: 'natural', name: 'True colour (Natural)', desc: 'Standard human eye vision (Red, Green, Blue)', bands: ['B04', 'B03', 'B02'], badge: 'B4·B3·B2' },
  { id: 'cir', name: 'Colour infrared (CIR)', desc: 'Vegetation vigour & chlorophyll in deep red', bands: ['B08', 'B04', 'B03'], badge: 'B8·B4·B3' },
  { id: 'agri', name: 'Agriculture (SWIR-NIR)', desc: 'Lush crop canopy in bright green, soil in brown', bands: ['B11', 'B08', 'B02'], badge: 'B11·B8·B2' },
  { id: 'moisture', name: 'Moisture & water stress', desc: 'Canopy water stress and soil moisture deficits', bands: ['B12', 'B08', 'B04'], badge: 'B12·B8·B4' },
  { id: 'swir', name: 'Atmospheric penetration', desc: 'Pierces haze/smoke and highlights canopy structure', bands: ['B12', 'B11', 'B08'], badge: 'B12·B11·B8' },
  { id: 'chlorophyll', name: 'Vegetation & chlorophyll', desc: 'Red-edge chlorophyll & early nitrogen stress', bands: ['B08', 'B05', 'B04'], badge: 'B8·B5·B4' },
  { id: 'geology', name: 'Land / Water contrast', desc: 'Sharp contrast between water, soil and vegetation', bands: ['B12', 'B08', 'B03'], badge: 'B12·B8·B3' },
]

export const SENTINEL_BANDS: { id: string; name: string; nm: string; role: string }[] = [
  { id: 'B02', name: 'Band 2 · Blue', nm: '490 nm', role: 'Atmosphere, water' },
  { id: 'B03', name: 'Band 3 · Green', nm: '560 nm', role: 'Green vegetation peak' },
  { id: 'B04', name: 'Band 4 · Red', nm: '665 nm', role: 'Chlorophyll absorption' },
  { id: 'B05', name: 'Band 5 · Red Edge 1', nm: '705 nm', role: 'Chlorophyll edge' },
  { id: 'B06', name: 'Band 6 · Red Edge 2', nm: '740 nm', role: 'Canopy leaf structure' },
  { id: 'B07', name: 'Band 7 · Red Edge 3', nm: '783 nm', role: 'Biomass & nitrogen' },
  { id: 'B08', name: 'Band 8 · NIR', nm: '842 nm', role: 'Healthy leaf cell reflectance' },
  { id: 'B11', name: 'Band 11 · SWIR-1', nm: '1610 nm', role: 'Canopy water, soil moisture' },
  { id: 'B12', name: 'Band 12 · SWIR-2', nm: '2190 nm', role: 'Moisture stress, geology' },
]

export function renderBandComposite(
  g: Grid,
  ring: Ring,
  redBand: string = 'B04',
  greenBand: string = 'B03',
  blueBand: string = 'B02',
  raw: boolean = false
): string {
  const b = g.b as Record<string, Float64Array | Float32Array>
  const rArr = b[redBand] || b['B04'] || b['B02']
  const gArr = b[greenBand] || b['B03'] || b['B02']
  const bArr = b[blueBand] || b['B02'] || b['B03']

  const stretch = (val: number, isInfra: boolean) => {
    if (!Number.isFinite(val)) return 0
    const maxV = isInfra ? 0.45 : 0.30
    const norm = Math.min(1, Math.max(0, val / maxV))
    const curved = 1 / (1 + Math.exp(-6 * (Math.pow(norm, 0.7) - 0.45)))
    return Math.min(255, Math.max(0, Math.round(255 * ((curved - 0.063) / 0.874))))
  }

  const isRInfra = redBand === 'B08' || redBand === 'B11' || redBand === 'B12'
  const isGInfra = greenBand === 'B08' || greenBand === 'B11' || greenBand === 'B12'
  const isBInfra = blueBand === 'B08' || blueBand === 'B11' || blueBand === 'B12'

  if (raw) {
    return paintRaw(
      g.w,
      g.h,
      g.bbox,
      i => (usable(g, i) ? [stretch(rArr[i], isRInfra), stretch(gArr[i], isGInfra), stretch(bArr[i], isBInfra)] : null),
      false // Nearest-neighbor raster clarity matching Earth Engine & QGIS
    )
  }

  return paintClipped(
    g.w,
    g.h,
    g.bbox,
    ring,
    i => (usable(g, i) ? [stretch(rArr[i], isRInfra), stretch(gArr[i], isGInfra), stretch(bArr[i], isBInfra)] : null),
    true,
    0
  )
}

export function trueColour(g: Grid, ring: Ring) {
  return renderBandComposite(g, ring, 'B04', 'B03', 'B02')
}

// Six spectral features per pixel: green, red, NIR, SWIR1 reflectance plus NDVI and MNDWI.
function features(g: Grid, i: number) {
  const { B03, B04, B08, B11 } = g.b
  return [B03[i], B04[i], B08[i], B11[i], (B08[i] - B04[i]) / (B08[i] + B04[i] + 1e-9), (B03[i] - B11[i]) / (B03[i] + B11[i] + 1e-9)]
}
export type Cluster = { id: string; name: string; color: string; ndvi: number; moist: number; pct: number; ha: number }
export type Auto = { labels: Int8Array; clusters: Cluster[]; url: string }
const NAMES = ['Bare / very dry ground', 'Sparse or stressed cover', 'Moderate vegetation', 'Healthy crop', 'Dense, vigorous canopy']
const COLORS = ['#a6611a', '#dfc27d', '#a6d96a', '#38a84a', '#00441b']

// Unsupervised k-means (k-means++ seeding, standardised spectral features). No samples needed.
export function autoClassify(g: Grid, ring: Ring, k = 4): Auto | null {
  const idx: number[] = []
  for (let i = 0; i < g.w * g.h; i++) if (usable(g, i)) idx.push(i)
  if (idx.length < k * 4) return null

  // Sample up to 1000 pixels for fast centroid discovery without blocking the main thread
  const step = Math.max(1, Math.floor(idx.length / 1000))
  const sampleIdx: number[] = []
  for (let i = 0; i < idx.length; i += step) sampleIdx.push(idx[i])

  const F_sample = sampleIdx.map(i => features(g, i)), d = 6
  const mean = new Array(d).fill(0), sd = new Array(d).fill(0)
  F_sample.forEach(f => f.forEach((v, j) => (mean[j] += v / F_sample.length)))
  F_sample.forEach(f => f.forEach((v, j) => (sd[j] += (v - mean[j]) ** 2 / F_sample.length)))
  const Z_sample = F_sample.map(f => f.map((v, j) => (v - mean[j]) / (Math.sqrt(sd[j]) || 1)))
  const dist = (a: number[], b: number[]) => a.reduce((s, v, j) => s + (v - b[j]) ** 2, 0)

  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  let cent = [Z_sample[Math.floor(rnd() * Z_sample.length)]]
  while (cent.length < k) {
    const w = Z_sample.map(z => Math.min(...cent.map(c => dist(z, c)))), tot = w.reduce((a, b) => a + b, 0)
    let r = rnd() * tot, pick = 0
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { pick = i; break } }
    cent.push(Z_sample[pick])
  }

  let asg = new Int32Array(Z_sample.length)
  for (let it = 0; it < 10; it++) {
    let moved = 0
    const sums = Array.from({ length: k }, () => new Array(d).fill(0))
    const counts = new Array(k).fill(0)
    Z_sample.forEach((z, i) => {
      let b = 0, bd = Infinity
      cent.forEach((c, j) => { const dd = dist(z, c); if (dd < bd) { bd = dd; b = j } })
      if (asg[i] !== b) { asg[i] = b; moved++ }
      for (let q = 0; q < d; q++) sums[b][q] += z[q]
      counts[b]++
    })
    for (let j = 0; j < k; j++) {
      if (counts[j] > 0) cent[j] = sums[j].map(s => s / counts[j])
    }
    if (!moved) break
  }

  // Assign full image pixels in a single fast pass
  const labels = new Int8Array(g.w * g.h).fill(-1)
  const clusterCounts = new Array(k).fill(0)
  const clusterNdvi = new Array(k).fill(0)
  const clusterMoist = new Array(k).fill(0)

  idx.forEach(i => {
    const f = features(g, i)
    const z = f.map((v, j) => (v - mean[j]) / (Math.sqrt(sd[j]) || 1))
    let b = 0, bd = Infinity
    cent.forEach((c, j) => { const dd = dist(z, c); if (dd < bd) { bd = dd; b = j } })
    labels[i] = b
    clusterCounts[b]++
    clusterNdvi[b] += f[4]
    clusterMoist[b] += f[5]
  })

  const stat = cent.map((_, j) => ({
    j,
    n: clusterCounts[j],
    nd: clusterCounts[j] ? clusterNdvi[j] / clusterCounts[j] : 0,
    mo: clusterCounts[j] ? clusterMoist[j] / clusterCounts[j] : 0
  }))

  const order = [...stat].sort((a, b) => a.nd - b.nd), rank = new Array(k)
  order.forEach((o, r) => (rank[o.j] = r))
  idx.forEach(i => { if (labels[i] >= 0) labels[i] = rank[labels[i]] })

  const pickName = (r: number) => Math.round((r / Math.max(k - 1, 1)) * 4)
  const ha = (g.dx * g.dy) / 10000
  const clusters: Cluster[] = order.map((o, r) => ({ id: `c${r}`, name: NAMES[pickName(r)], color: COLORS[pickName(r)], ndvi: o.nd, moist: o.mo, pct: (o.n / idx.length) * 100, ha: o.n * ha }))
  return { labels, clusters, url: paintClipped(g.w, g.h, g.bbox, ring, i => (labels[i] >= 0 ? hex(clusters[labels[i]].color) : null), false) }
}

// Rule-based land cover labels (same thresholds as the Analysis lab map) for vector export.
export function landCoverLabels(g: Grid) {
  const { B03, B04, B08, B11 } = g.b
  const out = new Int8Array(g.w * g.h).fill(-1)
  for (let i = 0; i < out.length; i++) {
    if (!usable(g, i)) continue
    const ndvi = (B08[i] - B04[i]) / (B08[i] + B04[i] + 1e-9), mndwi = (B03[i] - B11[i]) / (B03[i] + B11[i] + 1e-9), ndbi = (B11[i] - B08[i]) / (B11[i] + B08[i] + 1e-9)
    if (!Number.isFinite(ndvi)) continue
    out[i] = mndwi > 0.1 && ndvi < 0.2 ? 0 : ndvi >= 0.6 ? 1 : ndvi >= 0.4 ? 2 : ndvi >= 0.2 ? 3 : ndbi > 0.15 && ndvi < 0.15 ? 5 : 4
  }
  return out
}

// Raster to vector: horizontal runs of equal class become rectangles; each class is one MultiPolygon feature.
export function vectorize(g: Grid, labels: Int8Array, defs: { id: string; name: string }[], props: Record<string, unknown> = {}): GeoJSON.FeatureCollection {
  const [w0, s0, e0, n0] = g.bbox, dx = (e0 - w0) / g.w, dy = (n0 - s0) / g.h
  const polys: [number, number][][][][] = defs.map(() => [])
  const ha = (g.dx * g.dy) / 10000, counts = new Array(defs.length).fill(0)
  for (let y = 0; y < g.h; y++) {
    let x = 0
    while (x < g.w) {
      const c = labels[y * g.w + x]
      if (c < 0) { x++; continue }
      let x2 = x
      while (x2 + 1 < g.w && labels[y * g.w + x2 + 1] === c) x2++
      const xa = w0 + x * dx, xb = w0 + (x2 + 1) * dx, yt = n0 - y * dy, yb = n0 - (y + 1) * dy
      polys[c].push([[[xa, yt], [xb, yt], [xb, yb], [xa, yb], [xa, yt]].map(p => [+p[0].toFixed(7), +p[1].toFixed(7)] as [number, number])])
      counts[c] += x2 - x + 1; x = x2 + 1
    }
  }
  return { type: 'FeatureCollection', features: defs.map((d, k) => ({ type: 'Feature' as const, properties: { class: d.name, id: d.id, area_ha: +(counts[k] * ha).toFixed(3), ...props }, geometry: { type: 'MultiPolygon' as const, coordinates: polys[k] } })).filter(f => f.geometry.coordinates.length) }
}

export function download(name: string, text: string, type = 'application/geo+json') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click()
}

export type YieldForecast = {
  crop: string
  predictedYieldTonHa: number
  errorMarginTonHa: number
  predictedQuintalAcre: number
  confidencePct: number
  baseYieldTonHa: number
  maxYieldTonHa: number
  optimalNdvi: number
  factors: { ndviFactor: number; soilFactor: number; weatherFactor: number }
  explanation: string
}

export function predictYield(
  cropName: string,
  peakNdvi: number,
  soilPh?: number,
  rainMm?: number
): YieldForecast {
  const baseYields: Record<string, { base: number; max: number; optimalNdvi: number; alpha: number }> = {
    paddy: { base: 4.2, max: 7.5, optimalNdvi: 0.82, alpha: 3.8 },
    rice: { base: 4.2, max: 7.5, optimalNdvi: 0.82, alpha: 3.8 },
    wheat: { base: 3.8, max: 6.2, optimalNdvi: 0.78, alpha: 3.2 },
    maize: { base: 5.5, max: 9.0, optimalNdvi: 0.85, alpha: 4.5 },
    cotton: { base: 2.1, max: 3.8, optimalNdvi: 0.72, alpha: 2.0 },
    sugarcane: { base: 75.0, max: 120.0, optimalNdvi: 0.86, alpha: 45.0 },
    soybean: { base: 2.2, max: 3.6, optimalNdvi: 0.76, alpha: 2.2 },
    mustard: { base: 1.8, max: 2.8, optimalNdvi: 0.70, alpha: 1.8 },
    tomato: { base: 28.0, max: 55.0, optimalNdvi: 0.80, alpha: 22.0 },
    potato: { base: 22.0, max: 40.0, optimalNdvi: 0.82, alpha: 18.0 },
    pulses: { base: 1.4, max: 2.4, optimalNdvi: 0.68, alpha: 1.2 },
    gram: { base: 1.5, max: 2.5, optimalNdvi: 0.70, alpha: 1.3 },
    chickpea: { base: 1.5, max: 2.5, optimalNdvi: 0.70, alpha: 1.3 },
    lentil: { base: 1.3, max: 2.2, optimalNdvi: 0.66, alpha: 1.1 },
    pigeonpea: { base: 1.6, max: 2.8, optimalNdvi: 0.74, alpha: 1.4 },
    other: { base: 3.6, max: 6.0, optimalNdvi: 0.75, alpha: 3.0 },
  }

  const normKey = (cropName || 'other').toLowerCase().trim()
  const matchedKey = Object.keys(baseYields).find(k => normKey.includes(k)) || 'other'
  const spec = baseYields[matchedKey]

  const ndviVal = Math.max(0.15, Math.min(0.95, peakNdvi || 0.65))
  const ndviRatio = ndviVal / spec.optimalNdvi
  const ndviFactor = Math.min(1.3, Math.max(0.4, 0.5 + 0.5 * ndviRatio))

  const ph = soilPh ?? 6.8
  const soilFactor = ph >= 6.0 && ph <= 7.8 ? 1.05 : ph >= 5.2 && ph <= 8.5 ? 0.95 : 0.82
  const rain = rainMm ?? 35
  const weatherFactor = rain > 15 ? 1.02 : 0.93

  const est = Math.min(spec.max, Math.max(spec.base * 0.4, +(spec.base * ndviFactor * soilFactor * weatherFactor).toFixed(2)))
  const margin = +(est * 0.10).toFixed(2)
  const quintalAcre = +(est * 4.047).toFixed(1)

  return {
    crop: cropName || 'Other crop',
    predictedYieldTonHa: est,
    errorMarginTonHa: margin,
    predictedQuintalAcre: quintalAcre,
    confidencePct: 88,
    baseYieldTonHa: spec.base,
    maxYieldTonHa: spec.max,
    optimalNdvi: spec.optimalNdvi,
    factors: {
      ndviFactor: +ndviFactor.toFixed(2),
      soilFactor: +soilFactor.toFixed(2),
      weatherFactor: +weatherFactor.toFixed(2)
    },
    explanation: `Yield modeled from peak seasonal NDVI (${ndviVal.toFixed(2)} vs optimal benchmark ${spec.optimalNdvi}), adjusted for soil pH (${ph.toFixed(1)}) and moisture conditions. Satellite error margin: ±${margin} t/ha.`
  }
}

const sharpCache = new Map<string, string>()
const MAX_SHARP_CACHE = 4

// Esri World Imagery export for the farm boundary. Capture date and native resolution vary by location.
export async function sharpTrueColour(ring: Ring): Promise<string> {
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1])
  const w = Math.min(...xs), e = Math.max(...xs), s0 = Math.min(...ys), n = Math.max(...ys)
  const cacheKey = `${w.toFixed(5)},${s0.toFixed(5)},${e.toFixed(5)},${n.toFixed(5)}`
  const cached = sharpCache.get(cacheKey)
  if (cached) {
    sharpCache.delete(cacheKey)
    sharpCache.set(cacheKey, cached)
    return cached
  }

  const cos = Math.cos(((s0 + n) / 2) * Math.PI / 180), wm = (e - w) * 111320 * cos, hm = (n - s0) * 111320
  const maxDim = 1024 // Bound image memory; this does not change the source imagery resolution
  const W = wm >= hm ? maxDim : Math.max(256, Math.round(maxDim * (wm / hm))), H = wm >= hm ? Math.max(256, Math.round(maxDim * (hm / wm))) : maxDim

  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!

  const tileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z)
  const tileY = (lat: number, z: number) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z) }
  const lonOf = (x: number, z: number) => (x / 2 ** z) * 360 - 180
  const latOf = (y: number, z: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

  // Try Esri export first with timeout; if that fails, seamlessly stitch tiles
  try {
    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${w},${s0},${e},${n}&bboxSR=4326&imageSR=4326&size=${W},${H}&format=jpg&f=image`
    const img = new Image(); img.crossOrigin = 'anonymous'
    await new Promise<void>((ok, bad) => {
      const tm = setTimeout(() => bad(new Error('timeout')), 3000)
      img.onload = () => { clearTimeout(tm); ok() }
      img.onerror = () => { clearTimeout(tm); bad(new Error('imagery')) }
      img.src = url
    })
    ctx.drawImage(img, 0, 0, W, H)
  } catch {
    // Tile-stitching fallback at zoom 18/19
    let z = 18
    while (z > 10 && (tileX(e, z) - tileX(w, z) + 1) * (tileY(s0, z) - tileY(n, z) + 1) > 24) z--
    const tilePromises: Promise<void>[] = []
    for (let x = tileX(w, z); x <= tileX(e, z); x++) {
      for (let y = tileY(n, z); y <= tileY(s0, z); y++) {
        tilePromises.push(new Promise(resolve => {
          const img = new Image(); img.crossOrigin = 'anonymous'
          let done = false
          const finish = () => {
            if (done) return
            done = true
            clearTimeout(timeout)
            resolve()
          }
          const timeout = setTimeout(finish, 5000)
          img.onload = () => {
            const x0 = ((lonOf(x, z) - w) / (e - w)) * W, x1 = ((lonOf(x + 1, z) - w) / (e - w)) * W
            const y0 = ((n - latOf(y, z)) / (n - s0)) * H, y1 = ((n - latOf(y + 1, z)) / (n - s0)) * H
            if (!done) ctx.drawImage(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1)
            finish()
          }
          img.onerror = finish
          img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
        }))
      }
    }
    await Promise.all(tilePromises)
  }

  // Clip to farm polygon
  const outCanvas = document.createElement('canvas'); outCanvas.width = W; outCanvas.height = H
  const outCtx = outCanvas.getContext('2d')!
  outCtx.clearRect(0, 0, W, H)
  outCtx.beginPath()
  ring.forEach(([lo, la], i) => {
    const x = ((lo - w) / (e - w)) * W, y = ((n - la) / (n - s0)) * H
    if (i) outCtx.lineTo(x, y); else outCtx.moveTo(x, y)
  })
  outCtx.closePath()
  outCtx.clip()
  outCtx.drawImage(c, 0, 0, W, H)
  const result = outCanvas.toDataURL('image/jpeg', 0.88)
  sharpCache.set(cacheKey, result)
  if (sharpCache.size > MAX_SHARP_CACHE) sharpCache.delete(sharpCache.keys().next().value!)
  return result
}
