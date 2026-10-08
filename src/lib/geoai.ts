import type { Grid } from './indicators'
import { LANDCOVER } from './gee'
import { paintClipped, type Ring } from './raster'

export type ClassDef = { id: string; name: string; color: string }
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const usable = (g: Grid, i: number) => !!g.inside[i] && !!g.ok[i]

export function trueColour(g: Grid, ring: Ring) {
  const { B02, B03, B04 } = g.b
  const s = (v: number) => { const t = Math.min(1, Math.max(0, v / 0.3)); return Math.min(255, Math.round(255 * (1 / (1 + Math.exp(-6 * (Math.pow(t, 0.7) - 0.45))) - 0.063) / 0.874)) }
  return paintClipped(g.w, g.h, g.bbox, ring, i => (usable(g, i) ? [s(B04[i]), s(B03[i]), s(B02[i])] : null), true, 1.4)
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
  const F = idx.map(i => features(g, i)), d = 6
  const mean = new Array(d).fill(0), sd = new Array(d).fill(0)
  F.forEach(f => f.forEach((v, j) => (mean[j] += v / F.length)))
  F.forEach(f => f.forEach((v, j) => (sd[j] += (v - mean[j]) ** 2 / F.length)))
  const Z = F.map(f => f.map((v, j) => (v - mean[j]) / (Math.sqrt(sd[j]) || 1)))
  const dist = (a: number[], b: number[]) => a.reduce((s, v, j) => s + (v - b[j]) ** 2, 0)
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const cent = [Z[Math.floor(rnd() * Z.length)]]
  while (cent.length < k) {
    const w = Z.map(z => Math.min(...cent.map(c => dist(z, c)))), tot = w.reduce((a, b) => a + b, 0)
    let r = rnd() * tot, pick = 0
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { pick = i; break } }
    cent.push(Z[pick])
  }
  let asg = new Int32Array(Z.length)
  for (let it = 0; it < 25; it++) {
    let moved = 0
    Z.forEach((z, i) => { let b = 0, bd = Infinity; cent.forEach((c, j) => { const dd = dist(z, c); if (dd < bd) { bd = dd; b = j } }); if (asg[i] !== b) { asg[i] = b; moved++ } })
    cent.forEach((_, j) => { const m = Z.filter((_, i) => asg[i] === j); if (m.length) cent[j] = m[0].map((_, q) => m.reduce((s, z) => s + z[q], 0) / m.length) })
    if (!moved) break
  }
  const stat = cent.map((_, j) => { const m = idx.filter((_, i) => asg[i] === j); const nd = m.reduce((s, i) => s + features(g, i)[4], 0) / (m.length || 1), mo = m.reduce((s, i) => s + features(g, i)[5], 0) / (m.length || 1); return { j, n: m.length, nd, mo } })
  const order = [...stat].sort((a, b) => a.nd - b.nd), rank = new Array(k)
  order.forEach((o, r) => (rank[o.j] = r))
  const pickName = (r: number) => Math.round((r / Math.max(k - 1, 1)) * 4)
  const labels = new Int8Array(g.w * g.h).fill(-1)
  idx.forEach((i, q) => (labels[i] = rank[asg[q]]))
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

export type Method = 'kmeans' | 'mindist' | 'ml'
export const METHODS: { id: Method; name: string; kind: string; why: string }[] = [
  { id: 'kmeans', name: 'K-means', kind: 'Unsupervised', why: 'Finds natural groups by itself. Same idea as scikit-learn KMeans and ISODATA in ENVI and ERDAS.' },
  { id: 'mindist', name: 'Minimum distance', kind: 'Supervised', why: 'Each pixel joins the nearest class average. Classic in GDAL, Orfeo Toolbox and QGIS Semi-Automatic Classification.' },
  { id: 'ml', name: 'Maximum likelihood', kind: 'Supervised', why: 'Each pixel joins the most probable class using spread as well as average. Standard in SNAP, ENVI and ArcGIS.' },
]
export type Sup = { labels: Int8Array; classes: { id: string; name: string; color: string; pct: number; ha: number }[]; url: string }

// Supervised classifiers trained automatically: confident pixels from the rule-based land cover act as training samples.
export function superviseAuto(g: Grid, ring: Ring, method: 'mindist' | 'ml'): Sup | null {
  const rules = landCoverLabels(g), idx: number[] = []
  for (let i = 0; i < rules.length; i++) if (rules[i] >= 0) idx.push(i)
  if (idx.length < 40) return null
  const F = (i: number) => features(g, i), d = 6
  const stats = LANDCOVER.map((_, c) => {
    const m = idx.filter(i => rules[i] === c)
    if (m.length < 12) return null
    const mean = new Array(d).fill(0), v = new Array(d).fill(0)
    m.forEach(i => F(i).forEach((x, j) => (mean[j] += x / m.length)))
    m.forEach(i => F(i).forEach((x, j) => (v[j] += (x - mean[j]) ** 2 / m.length)))
    return { mean, v: v.map(x => Math.max(x, 1e-5)) }
  })
  const gv = new Array(d).fill(0)
  const all = idx.map(F)
  const gm = new Array(d).fill(0)
  all.forEach(f => f.forEach((x, j) => (gm[j] += x / all.length)))
  all.forEach(f => f.forEach((x, j) => (gv[j] += (x - gm[j]) ** 2 / all.length)))
  const labels = new Int8Array(g.w * g.h).fill(-1), counts = new Array(LANDCOVER.length).fill(0)
  idx.forEach(i => {
    const f = F(i); let best = -1, bs = Infinity
    stats.forEach((st, c) => {
      if (!st) return
      const sc = method === 'mindist' ? f.reduce((s, x, j) => s + (x - st.mean[j]) ** 2 / gv[j], 0) : f.reduce((s, x, j) => s + Math.log(st.v[j]) + (x - st.mean[j]) ** 2 / st.v[j], 0)
      if (sc < bs) { bs = sc; best = c }
    })
    if (best >= 0) { labels[i] = best; counts[best]++ }
  })
  const ha = (g.dx * g.dy) / 10000
  const classes = LANDCOVER.map((c, k) => ({ id: c.id, name: c.name, color: c.color, pct: (counts[k] / idx.length) * 100, ha: counts[k] * ha }))
  return { labels, classes, url: paintClipped(g.w, g.h, g.bbox, ring, i => (labels[i] >= 0 ? hex(classes[labels[i]].color) : null), false) }
}

// Sharp true colour: Esri World Imagery (sub-metre) exported for the farm bbox and clipped to the boundary.
export async function sharpTrueColour(ring: Ring): Promise<string> {
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1])
  const w = Math.min(...xs), e = Math.max(...xs), s0 = Math.min(...ys), n = Math.max(...ys)
  const cos = Math.cos(((s0 + n) / 2) * Math.PI / 180), wm = (e - w) * 111320 * cos, hm = (n - s0) * 111320
  const W = wm >= hm ? 1600 : Math.round(1600 * (wm / hm)), H = wm >= hm ? Math.round(1600 * (hm / wm)) : 1600
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${w},${s0},${e},${n}&bboxSR=4326&imageSR=4326&size=${W},${H}&format=jpg&f=image`
  const img = new Image(); img.crossOrigin = 'anonymous'
  await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('imagery')); img.src = url })
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  ctx.beginPath()
  ring.forEach(([lo, la], i) => { const x = ((lo - w) / (e - w)) * W, y = ((n - la) / (n - s0)) * H; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) })
  ctx.closePath(); ctx.clip(); ctx.drawImage(img, 0, 0, W, H)
  return c.toDataURL('image/jpeg', 0.92)
}
