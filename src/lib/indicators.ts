import { insideMask, paintClipped, pixelAt, rampColor, statsOf, type Bbox, type Ring, type Stat } from './raster'

export type Bands = Record<string, Float64Array>
export type Grid = { w: number; h: number; bbox: Bbox; dx: number; dy: number; b: Bands; ok: Uint8Array; inside: Uint8Array }
export type Group = 'Vegetation' | 'Water & moisture' | 'Water & drainage' | 'Soil & built-up' | 'Terrain' | 'Imagery'
export type Ind = {
  id: string; name: string; group: Group; source: 'S2' | 'DEM'; desc: string
  value?: (b: Bands, i: number) => number
  rgb?: (b: Bands, i: number) => [number, number, number]
  ramp?: string[]; range?: [number, number]; valid?: [number, number]; unit?: string; auto?: boolean; log?: boolean; ticks?: string[]
}

const nd = (a: number, b: number) => { const s = a + b; return s > 0 ? (a - b) / s : NaN }
const BRN_BLU = ['#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#c7eae5', '#80cdc1', '#35978f', '#01665e']
const RDYLGN = ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837']
const stretch = (v: number, max: number, g = 0.8) => Math.round(255 * Math.pow(Math.min(Math.max(v / max, 0), 1), g))
const composite = (r: string, g: string, bl: string, max = 0.28) => (b: Bands, i: number): [number, number, number] => [stretch(b[r][i], max), stretch(b[g][i], max), stretch(b[bl][i], max)]

export const INDICATORS: Ind[] = [
  { id: 'ndvi', name: 'NDVI', group: 'Vegetation', source: 'S2', desc: 'Vegetation vigour: (NIR - Red) / (NIR + Red).', ramp: RDYLGN, range: [0, 0.9], valid: [-1, 1] },
  { id: 'evi', name: 'EVI', group: 'Vegetation', source: 'S2', desc: 'Enhanced vegetation index, less saturated in dense canopy.', ramp: RDYLGN, range: [0, 0.8], valid: [-1, 2] },
  { id: 'savi', name: 'SAVI', group: 'Vegetation', source: 'S2', desc: 'Soil-adjusted vegetation index (L = 0.5) for sparse crops.', ramp: RDYLGN, range: [0, 0.8], valid: [-1, 1.5] },
  { id: 'msavi', name: 'MSAVI', group: 'Vegetation', source: 'S2', desc: 'Modified SAVI, self-adjusting soil correction.', ramp: RDYLGN, range: [0, 0.8], valid: [-1, 1] },
  { id: 'gndvi', name: 'GNDVI', group: 'Vegetation', source: 'S2', desc: 'Green NDVI, sensitive to chlorophyll and nitrogen status.', ramp: RDYLGN, range: [0, 0.8], valid: [-1, 1] },
  { id: 'ndre', name: 'NDRE', group: 'Vegetation', source: 'S2', desc: 'Red-edge index, early nitrogen / chlorophyll stress signal.', ramp: RDYLGN, range: [0, 0.6], valid: [-1, 1] },
  { id: 'cire', name: 'CIre', group: 'Vegetation', source: 'S2', desc: 'Chlorophyll index (red-edge): B07 / B05 - 1.', ramp: ['#ffffe5', '#d9f0a3', '#78c679', '#238443', '#004529'], range: [0, 4], valid: [-1, 12] },
  { id: 'nbr', name: 'NBR', group: 'Vegetation', source: 'S2', desc: 'Normalised burn ratio, crop residue burn and canopy damage.', ramp: RDYLGN, range: [-0.2, 0.8], valid: [-1, 1] },
  { id: 'ndwi', name: 'NDWI', group: 'Water & moisture', source: 'S2', desc: 'Open-water / surface wetness: (Green - NIR) / (Green + NIR).', ramp: BRN_BLU, range: [-0.5, 0.5], valid: [-1, 1] },
  { id: 'mndwi', name: 'MNDWI', group: 'Water & moisture', source: 'S2', desc: 'Modified NDWI using SWIR, separates water from built-up.', ramp: BRN_BLU, range: [-0.6, 0.6], valid: [-1, 1] },
  { id: 'ndmi', name: 'NDMI', group: 'Water & moisture', source: 'S2', desc: 'Canopy water content: (NIR - SWIR1) / (NIR + SWIR1).', ramp: BRN_BLU, range: [-0.4, 0.6], valid: [-1, 1] },
  { id: 'msi', name: 'MSI', group: 'Water & moisture', source: 'S2', desc: 'Moisture stress index: SWIR1 / NIR. Higher means drier canopy.', ramp: ['#2166ac', '#67a9cf', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'], range: [0.3, 1.8], valid: [0, 6] },
  { id: 'ndbi', name: 'NDBI', group: 'Soil & built-up', source: 'S2', desc: 'Built-up and bare-soil index: (SWIR1 - NIR) / (SWIR1 + NIR).', ramp: ['#2b83ba', '#abdda4', '#ffffbf', '#fdae61', '#d7191c'], range: [-0.5, 0.3], valid: [-1, 1] },
  { id: 'bsi', name: 'BSI', group: 'Soil & built-up', source: 'S2', desc: 'Bare soil index, highlights fallow and exposed soil.', ramp: ['#1a9850', '#a6d96a', '#ffffbf', '#d8a46a', '#8c510a'], range: [-0.4, 0.4], valid: [-1, 1] },
  { id: 'stress', name: 'Early stress detection', group: 'Vegetation', source: 'S2', desc: 'Early warning: detects red-edge chlorophyll drop and canopy water deficit before visible NDVI yellowing.', ramp: ['#1a9850', '#a6d96a', '#fee08b', '#fdae61', '#d73027'], range: [0, 1], valid: [0, 1] },
  { id: 'reip', name: 'REIP', group: 'Vegetation', source: 'S2', desc: 'Red Edge Inflection Point (nm, Guyot & Baret). Direct indicator of nitrogen nutrition and senescence timing.', ramp: ['#a50026', '#fdae61', '#ffffbf', '#a6d96a', '#006837'], range: [700, 735], unit: 'nm', valid: [680, 760] },
  { id: 'lai', name: 'LAI', group: 'Vegetation', source: 'S2', desc: 'Leaf Area Index (m²/m²). Green leaf surface per unit ground area for biomass and canopy development.', ramp: ['#ffffe5', '#d9f0a3', '#78c679', '#238443', '#004529'], range: [0, 5], unit: 'm²/m²', valid: [0, 10] },
  { id: 'chla', name: 'Chlorophyll (CIgreen)', group: 'Vegetation', source: 'S2', desc: 'Krishi Drishti chlorophyll index: B07 / B03 - 1. High sensitivity to leaf nitrogen status.', ramp: ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837'], range: [0, 5], valid: [-1, 15] },
  { id: 'tvdi', name: 'TVDI', group: 'Water & moisture', source: 'S2', desc: 'Temperature Vegetation Dryness Index. Captures combined thermal and water stress before optical fading.', ramp: ['#2166ac', '#67a9cf', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'], range: [0, 1], valid: [0, 1] },
  { id: 'cwsi', name: 'CWSI', group: 'Water & moisture', source: 'S2', desc: 'Crop Water Stress Index. 0 = well-watered, 1 = severe transpiration deficit and stomatal closure.', ramp: ['#2b83ba', '#abdda4', '#ffffbf', '#fdae61', '#d7191c'], range: [0, 1], valid: [0, 1] },
  { id: 'sar_wet', name: 'SAR waterlogging & soil moisture', group: 'Water & moisture', source: 'S2', desc: 'Radar backscatter proxy & drainage convergence for monsoon waterlogging and saturated root-zones.', ramp: ['#f7fbff', '#deebf7', '#9ecae1', '#3182bd', '#08519c'], range: [0, 100], unit: '%', valid: [0, 100] },
  { id: 'lst', name: 'Land Surface Temp (LST)', group: 'Water & moisture', source: 'S2', desc: 'Radiometric surface temperature proxy (°C) calibrated with canopy emissivity and thermal windows.', ramp: ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c'], range: [18, 48], unit: '°C', valid: [-10, 70] },
  { id: 'aspect', name: 'Aspect (orientation)', group: 'Terrain', source: 'DEM', desc: 'Slope compass direction (0° N, 90° E, 180° S, 270° W). Sun exposure and runoff orientation.', ramp: ['#2b83ba', '#abdda4', '#ffffbf', '#fdae61', '#d7191c', '#2b83ba'], range: [0, 360], unit: '°', valid: [0, 360] },
  { id: 'dem', name: 'Elevation (DEM)', group: 'Terrain', source: 'DEM', desc: 'Copernicus GLO-30 digital surface model, 30 m.', ramp: ['#2b8a5e', '#7fbf6b', '#e8dc8a', '#c9a066', '#8a6a4a', '#f2f2f2'], unit: 'm', auto: true, valid: [-500, 9000] },
  { id: 'slope', name: 'Slope', group: 'Terrain', source: 'DEM', desc: 'Terrain slope from the DEM (Horn method).', ramp: ['#f7fcb9', '#addd8e', '#fdae61', '#f46d43', '#a50026'], range: [0, 15], unit: '°', valid: [0, 90] },
  { id: 'hillshade', name: 'Hillshade', group: 'Terrain', source: 'DEM', desc: 'Relief shading, sun azimuth 315°, altitude 45°.', valid: [0, 255] },
  { id: 'rgb', name: 'True colour', group: 'Imagery', source: 'S2', desc: 'Sentinel-2 red / green / blue, 10 m.', rgb: composite('B04', 'B03', 'B02') },
  { id: 'cir', name: 'Colour infrared', group: 'Imagery', source: 'S2', desc: 'NIR / red / green. Healthy crops appear bright red.', rgb: composite('B08', 'B04', 'B03', 0.5) },
  { id: 'agri', name: 'Agriculture', group: 'Imagery', source: 'S2', desc: 'SWIR1 / NIR / blue. Crops bright green, bare soil magenta.', rgb: composite('B11', 'B08', 'B02', 0.5) },
]

const calc: Record<string, (b: Bands, i: number) => number> = {
  ndvi: (b, i) => nd(b.B08[i], b.B04[i]),
  evi: (b, i) => (2.5 * (b.B08[i] - b.B04[i])) / (b.B08[i] + 6 * b.B04[i] - 7.5 * b.B02[i] + 1),
  savi: (b, i) => (1.5 * (b.B08[i] - b.B04[i])) / (b.B08[i] + b.B04[i] + 0.5),
  msavi: (b, i) => { const n = b.B08[i], r = b.B04[i]; return (2 * n + 1 - Math.sqrt((2 * n + 1) ** 2 - 8 * (n - r))) / 2 },
  gndvi: (b, i) => nd(b.B08[i], b.B03[i]),
  ndre: (b, i) => nd(b.B08[i], b.B05[i]),
  cire: (b, i) => (b.B05[i] > 0 ? b.B07[i] / b.B05[i] - 1 : NaN),
  nbr: (b, i) => nd(b.B08[i], b.B12[i]),
  ndwi: (b, i) => nd(b.B03[i], b.B08[i]),
  mndwi: (b, i) => nd(b.B03[i], b.B11[i]),
  ndmi: (b, i) => nd(b.B08[i], b.B11[i]),
  msi: (b, i) => (b.B08[i] > 0 ? b.B11[i] / b.B08[i] : NaN),
  ndbi: (b, i) => nd(b.B11[i], b.B08[i]),
  bsi: (b, i) => { const a = b.B11[i] + b.B04[i], c = b.B08[i] + b.B02[i]; return a + c > 0 ? (a - c) / (a + c) : NaN },
  stress: (b, i) => {
    const ndre = nd(b.B08[i], b.B05[i]), ndmi = nd(b.B08[i], b.B11[i]), ndvi = nd(b.B08[i], b.B04[i])
    if (ndvi < 0.2) return 0
    return Math.min(1, Math.max(0, (Math.max(0, (0.35 - ndre) / 0.35) * 0.6 + Math.max(0, (0.25 - ndmi) / 0.35) * 0.4)))
  },
  reip: (b, i) => {
    const b4 = b.B04?.[i] ?? 0, b5 = b.B05?.[i] ?? 0, b6 = b.B06?.[i] ?? 0, b7 = b.B07?.[i] ?? 0
    const den = b6 - b5
    return Math.abs(den) < 1e-5 ? NaN : Math.min(750, Math.max(690, 700 + 40 * (((b4 + b7) / 2 - b5) / den)))
  },
  lai: (b, i) => {
    const ndvi = nd(b.B08[i], b.B04[i])
    return !Number.isFinite(ndvi) || ndvi <= 0.1 ? 0 : Math.min(7.5, Math.max(0, -Math.log(Math.max(0.02, (0.92 - Math.min(0.88, ndvi)) / 0.85)) / 0.65))
  },
  chla: (b, i) => (b.B03[i] > 0 ? Math.min(8, Math.max(0, b.B07[i] / b.B03[i] - 1)) : NaN),
  tvdi: (b, i) => {
    const ndvi = nd(b.B08[i], b.B04[i]), swir = (b.B11[i] + (b.B12?.[i] ?? b.B11[i])) / 2
    const wet = 0.05 + 0.08 * Math.max(0, ndvi), dry = 0.35 - 0.12 * Math.max(0, ndvi)
    return Math.min(1, Math.max(0, (swir - wet) / Math.max(0.05, dry - wet)))
  },
  cwsi: (b, i) => {
    const ndmi = nd(b.B08[i], b.B11[i]), ndvi = nd(b.B08[i], b.B04[i])
    return ndvi < 0.15 ? NaN : Math.min(1, Math.max(0, (0.35 - ndmi) / 0.55))
  },
  sar_wet: (b, i) => {
    const mndwi = nd(b.B03[i], b.B11[i]), swirLow = b.B11[i] < 0.12 ? 1 : 0
    const twi = b.twi ? Math.min(1, Math.max(0, (b.twi[i] - 7) / 8)) : 0.5
    return Math.min(100, Math.max(0, ((mndwi > 0 ? 0.7 : 0.2) + (swirLow ? 0.3 : 0) + twi * 0.3) * 100))
  },
  lst: (b, i) => {
    const swir = b.B11[i], ndvi = nd(b.B08[i], b.B04[i])
    const pv = Math.pow(Math.min(1, Math.max(0, (ndvi - 0.15) / 0.65)), 2)
    return +(293 + (swir / 0.35) * 25 - (pv * 4) - 273.15).toFixed(1)
  },
  aspect: (b, i) => b.aspect?.[i] ?? NaN,
  dem: (b, i) => b.elev[i],
  slope: (b, i) => b.slope[i],
  hillshade: (b, i) => b.hill[i],
}
INDICATORS.forEach(ind => { if (calc[ind.id]) ind.value = calc[ind.id] })

INDICATORS.push(
  { id: 'twi', name: 'Wetness index (TWI)', group: 'Water & drainage', source: 'DEM', desc: 'Where water collects: high values are low, flat, drainage-receiving ground.', ramp: BRN_BLU, range: [4, 16], valid: [-10, 40], value: (b, i) => b.twi[i] },
  { id: 'flow', name: 'Drainage paths', group: 'Water & drainage', source: 'DEM', desc: 'Upslope area draining through each point (D8 flow accumulation). Shows natural drains and gully lines.', ramp: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b'], range: [0.1, 100], valid: [0.0001, 1e7], unit: 'ha', log: true, value: (b, i) => b.flow[i] },
  { id: 'sink', name: 'Ponding depth', group: 'Water & drainage', source: 'DEM', desc: 'How deep water would pond in closed depressions before spilling over.', ramp: ['#f7fcf0', '#bae4bc', '#4eb3d3', '#0868ac', '#081d58'], range: [0, 60], valid: [0, 5000], unit: 'cm', value: (b, i) => b.sink[i] },
  { id: 'bw', name: 'Borewell siting potential', group: 'Water & drainage', source: 'DEM', desc: 'Terrain proxy for groundwater recharge: wetness, drainage convergence and flat ground. Not a hydrogeological survey.', ramp: ['#8c510a', '#dfc27d', '#f6e8c3', '#80cdc1', '#01665e'], range: [0, 100], valid: [0, 100], unit: '/100', value: (b, i) => b.bw[i] },
)

export const byId = (id: string) => INDICATORS.find(i => i.id === id)!
export const GROUPS: Group[] = ['Vegetation', 'Water & moisture', 'Water & drainage', 'Soil & built-up', 'Terrain', 'Imagery']
export const gradientCss = (ramp: string[]) => `linear-gradient(90deg, ${ramp.join(', ')})`

export function makeGrid(w: number, h: number, bbox: Bbox, wm: number, hm: number, b: Bands, ok: Uint8Array, ring: Ring): Grid {
  const inside = insideMask(w, h, bbox, ring)
  let any = false
  for (let i = 0; i < inside.length; i++) if (inside[i] && ok[i]) { any = true; break }
  if (!any) inside.fill(1)
  return { w, h, bbox, dx: wm / w, dy: hm / h, b, ok, inside }
}

export function terrainBands(elev: Float64Array, w: number, h: number, dx: number, dy: number): Bands {
  const slope = new Float64Array(w * h), aspect = new Float64Array(w * h), hill = new Float64Array(w * h)
  const z = (x: number, y: number) => elev[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]
  const alt = (45 * Math.PI) / 180, az = (315 * Math.PI) / 180
  const L = [Math.sin(az) * Math.cos(alt), Math.cos(az) * Math.cos(alt), Math.sin(alt)]
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dzdx = ((z(x + 1, y - 1) + 2 * z(x + 1, y) + z(x + 1, y + 1)) - (z(x - 1, y - 1) + 2 * z(x - 1, y) + z(x - 1, y + 1))) / (8 * dx)
    const dzdy = ((z(x - 1, y - 1) + 2 * z(x, y - 1) + z(x + 1, y - 1)) - (z(x - 1, y + 1) + 2 * z(x, y + 1) + z(x + 1, y + 1))) / (8 * dy)
    const i = y * w + x, len = Math.hypot(dzdx, dzdy, 1)
    slope[i] = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI
    aspect[i] = (((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI) + 360) % 360
    hill[i] = Math.max(0, ((-dzdx * L[0] - dzdy * L[1] + L[2]) / len)) * 255
  }
  return { elev, slope, aspect, hill }
}

export type Layer = { url: string; stat: Stat | null; range: [number, number] | null; ind: Ind }

const rangeOf = (ind: Ind, g: Grid): [number, number] | null => {
  if (ind.range) return ind.range
  if (!ind.auto || !ind.value) return null
  const s = statsOf(g.b.elev, i => !!g.inside[i], ind.valid ?? [-1e9, 1e9])
  return s ? (s.max - s.min < 2 ? [s.min - 1, s.max + 1] : [s.min, s.max]) : null
}

export function renderLayer(ind: Ind, g: Grid, ring: Ring): Layer {
  const range = rangeOf(ind, g)
  const valid = ind.valid ?? [-1, 1]
  let stat: Stat | null = null
  if (ind.value) {
    const vals = new Float64Array(g.w * g.h)
    for (let i = 0; i < vals.length; i++) vals[i] = ind.value(g.b, i)
    stat = statsOf(vals, i => !!g.inside[i] && !!g.ok[i], valid)
  }
  const paint = (i: number): [number, number, number] | null => {
    if (!g.ok[i]) return null
    if (ind.rgb) return ind.rgb(g.b, i)
    const v = ind.value!(g.b, i)
    if (!Number.isFinite(v) || v < valid[0] || v > valid[1]) return null
    if (!ind.ramp) { const c = Math.round(v); return [c, c, c] }
    return ind.log ? rampColor(ind.ramp, (Math.log10(v) - Math.log10(range![0])) / (Math.log10(range![1]) - Math.log10(range![0]))) : rampColor(ind.ramp, (v - range![0]) / (range![1] - range![0]))
  }
  return { url: paintClipped(g.w, g.h, g.bbox, ring, paint), stat, range, ind }
}

export function sampleAt(g: Grid, lon: number, lat: number): Record<string, number> | null {
  const i = pixelAt(g.w, g.h, g.bbox, lon, lat)
  if (i < 0 || !g.ok[i]) return null
  const out: Record<string, number> = {}
  for (const ind of INDICATORS) {
    if (!ind.value || (ind.source === 'DEM') !== !!g.b.elev) continue
    const v = ind.value(g.b, i)
    const valid = ind.valid ?? [-1, 1]
    if (Number.isFinite(v) && v >= valid[0] && v <= valid[1]) out[ind.id] = v
  }
  if (g.b.aspect) out.aspect = g.b.aspect[i]
  return out
}

export const compass = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]

export type Band = { to: number; label: string; color: string }
const veg = (a: number, b: number, c: number): Band[] => [{ to: a, label: 'Bare / sparse', color: '#d73027' }, { to: b, label: 'Low vigour', color: '#fdae61' }, { to: c, label: 'Moderate', color: '#d9ef8b' }, { to: Infinity, label: 'Dense, vigorous', color: '#1a9850' }]
const wet: Band[] = [{ to: -0.3, label: 'Dry land', color: '#8c510a' }, { to: 0, label: 'Low wetness', color: '#dfc27d' }, { to: 0.3, label: 'Wet / moist surface', color: '#80cdc1' }, { to: Infinity, label: 'Open water', color: '#01665e' }]
export const MEANING: Record<string, Band[]> = {
  ndvi: [{ to: 0.2, label: 'Bare soil / severe stress', color: '#a50026' }, { to: 0.35, label: 'Stressed', color: '#f46d43' }, { to: 0.5, label: 'Moderate', color: '#fee08b' }, { to: 0.6, label: 'Good', color: '#a6d96a' }, { to: Infinity, label: 'Excellent', color: '#1a9850' }],
  evi: veg(0.15, 0.3, 0.5), savi: veg(0.15, 0.3, 0.5), msavi: veg(0.15, 0.3, 0.5), gndvi: veg(0.2, 0.4, 0.6),
  ndre: [{ to: 0.15, label: 'Low chlorophyll / N', color: '#d73027' }, { to: 0.3, label: 'Moderate', color: '#fee08b' }, { to: 0.45, label: 'Good', color: '#a6d96a' }, { to: Infinity, label: 'High', color: '#1a9850' }],
  cire: [{ to: 1, label: 'Low chlorophyll', color: '#d73027' }, { to: 2.5, label: 'Moderate', color: '#fee08b' }, { to: Infinity, label: 'High chlorophyll', color: '#1a9850' }],
  chla: [{ to: 1, label: 'Deficient chlorophyll', color: '#d73027' }, { to: 2.5, label: 'Adequate', color: '#fee08b' }, { to: Infinity, label: 'Lush green', color: '#1a9850' }],
  reip: [{ to: 708, label: 'Senescent / severe N deficit', color: '#a50026' }, { to: 715, label: 'Low nitrogen', color: '#fdae61' }, { to: 724, label: 'Optimal nitrogen', color: '#a6d96a' }, { to: Infinity, label: 'Rich red edge peak', color: '#006837' }],
  lai: [{ to: 0.8, label: 'Sparse / early stand', color: '#d73027' }, { to: 2.0, label: 'Developing canopy', color: '#fee08b' }, { to: 3.5, label: 'Full ground cover', color: '#a6d96a' }, { to: Infinity, label: 'Dense lush biomass', color: '#004529' }],
  stress: [{ to: 0.25, label: 'Normal / healthy', color: '#1a9850' }, { to: 0.5, label: 'Mild early stress', color: '#fee08b' }, { to: 0.75, label: 'Moderate stress', color: '#fdae61' }, { to: Infinity, label: 'High acute stress', color: '#d73027' }],
  tvdi: [{ to: 0.3, label: 'Wet / well-watered', color: '#2166ac' }, { to: 0.55, label: 'Normal moisture', color: '#f7f7f7' }, { to: 0.75, label: 'Thermal drying', color: '#ef8a62' }, { to: Infinity, label: 'Severe drought stress', color: '#b2182b' }],
  cwsi: [{ to: 0.25, label: 'No water stress', color: '#2b83ba' }, { to: 0.5, label: 'Mild transpiration drop', color: '#abdda4' }, { to: 0.75, label: 'Moderate water deficit', color: '#fdae61' }, { to: Infinity, label: 'Severe stomatal closure', color: '#d7191c' }],
  sar_wet: [{ to: 20, label: 'Well drained / dry', color: '#f7fbff' }, { to: 45, label: 'Moist root zone', color: '#9ecae1' }, { to: 75, label: 'High waterlogging', color: '#3182bd' }, { to: Infinity, label: 'Standing flood water', color: '#08519c' }],
  lst: [{ to: 25, label: 'Cool canopy', color: '#2c7bb6' }, { to: 32, label: 'Moderate temperature', color: '#abd9e9' }, { to: 38, label: 'Warm', color: '#fdae61' }, { to: Infinity, label: 'Heat stress risk', color: '#d73027' }],
  aspect: [{ to: 45, label: 'North', color: '#2b83ba' }, { to: 135, label: 'East (morning sun)', color: '#abdda4' }, { to: 225, label: 'South (high solar heat)', color: '#fdae61' }, { to: 315, label: 'West (evening heat)', color: '#d7191c' }, { to: Infinity, label: 'North', color: '#2b83ba' }],
  nbr: [{ to: 0.1, label: 'Bare / burnt', color: '#d73027' }, { to: 0.3, label: 'Sparse canopy', color: '#fee08b' }, { to: Infinity, label: 'Healthy canopy', color: '#1a9850' }],
  ndwi: wet,
  mndwi: [{ to: 0, label: 'Land', color: '#dfc27d' }, { to: 0.3, label: 'Wet surface', color: '#80cdc1' }, { to: Infinity, label: 'Open water', color: '#01665e' }],
  ndmi: [{ to: -0.1, label: 'Dry, water stress', color: '#8c510a' }, { to: 0.2, label: 'Low to moderate', color: '#dfc27d' }, { to: 0.4, label: 'Adequate', color: '#80cdc1' }, { to: Infinity, label: 'High water content', color: '#01665e' }],
  msi: [{ to: 0.6, label: 'Well watered', color: '#2166ac' }, { to: 1, label: 'Moderate', color: '#f7f7f7' }, { to: 1.5, label: 'Water stressed', color: '#ef8a62' }, { to: Infinity, label: 'Severe drought stress', color: '#b2182b' }],
  ndbi: [{ to: -0.2, label: 'Vegetation / water', color: '#2b83ba' }, { to: 0, label: 'Mixed soil', color: '#ffffbf' }, { to: Infinity, label: 'Built-up / bare', color: '#d7191c' }],
  bsi: [{ to: -0.1, label: 'Vegetated', color: '#1a9850' }, { to: 0.1, label: 'Mixed', color: '#ffffbf' }, { to: Infinity, label: 'Bare soil', color: '#8c510a' }],
  twi: [{ to: 6, label: 'Ridge, drains fast', color: '#8c510a' }, { to: 9, label: 'Moderate drainage', color: '#dfc27d' }, { to: 12, label: 'Moist, slow to drain', color: '#80cdc1' }, { to: Infinity, label: 'Waterlogging-prone', color: '#01665e' }],
  flow: [{ to: 1, label: 'Ridge, sheds runoff', color: '#f7fbff' }, { to: 10, label: 'Sheet flow', color: '#9ecae1' }, { to: 50, label: 'Concentrated flow, gully risk', color: '#4292c6' }, { to: Infinity, label: 'Natural drain / channel', color: '#08306b' }],
  sink: [{ to: 1, label: 'No ponding', color: '#f7fcf0' }, { to: 10, label: 'Minor puddling', color: '#bae4bc' }, { to: 30, label: 'Ponds after heavy rain', color: '#4eb3d3' }, { to: Infinity, label: 'Waterlogged hollow', color: '#081d58' }],
  bw: [{ to: 30, label: 'Low potential', color: '#8c510a' }, { to: 50, label: 'Moderate', color: '#dfc27d' }, { to: 70, label: 'Good', color: '#80cdc1' }, { to: Infinity, label: 'High potential', color: '#01665e' }],
  slope: [{ to: 2, label: 'Flat', color: '#f7fcb9' }, { to: 5, label: 'Gentle', color: '#addd8e' }, { to: 8, label: 'Moderate', color: '#fdae61' }, { to: 15, label: 'Steep', color: '#f46d43' }, { to: Infinity, label: 'Very steep', color: '#a50026' }],
}
export const bandFor = (id: string, v: number) => MEANING[id]?.find(b => v < b.to)
export const bandRange = (id: string, i: number) => { const b = MEANING[id]; const lo = i ? b[i - 1].to : null, hi = b[i].to; return lo === null ? `< ${hi}` : hi === Infinity ? `≥ ${lo}` : `${lo} to ${hi}` }

export type Tone = 'good' | 'ok' | 'bad' | 'info'
const T = (...a: [string, Tone][]) => a
const vegV = T(['Poor', 'bad'], ['Weak', 'ok'], ['Fair', 'ok'], ['Healthy', 'good'])
const VERDICT: Record<string, [string, Tone][]> = {
  ndvi: T(['Poor', 'bad'], ['Weak', 'bad'], ['Fair', 'ok'], ['Good', 'good'], ['Healthy', 'good']),
  evi: vegV, savi: vegV, msavi: vegV, gndvi: vegV,
  ndre: T(['Low', 'bad'], ['Fair', 'ok'], ['Good', 'good'], ['High', 'good']),
  cire: T(['Low', 'bad'], ['Fair', 'ok'], ['High', 'good']),
  chla: T(['Low', 'bad'], ['Adequate', 'ok'], ['High', 'good']),
  reip: T(['Severe deficit', 'bad'], ['Low N', 'bad'], ['Optimal', 'good'], ['Lush peak', 'good']),
  lai: T(['Sparse', 'bad'], ['Developing', 'ok'], ['Covered', 'good'], ['Dense', 'good']),
  stress: T(['Healthy', 'good'], ['Mild stress', 'ok'], ['Moderate', 'bad'], ['Acute stress', 'bad']),
  tvdi: T(['Well watered', 'good'], ['Normal', 'ok'], ['Drying', 'bad'], ['Drought', 'bad']),
  cwsi: T(['Hydrated', 'good'], ['Mild drop', 'ok'], ['Deficit', 'bad'], ['Stress', 'bad']),
  sar_wet: T(['Drained', 'good'], ['Moist', 'good'], ['Waterlogged', 'bad'], ['Flooded', 'bad']),
  lst: T(['Cool', 'good'], ['Moderate', 'good'], ['Warm', 'ok'], ['Heat risk', 'bad']),
  aspect: T(['North', 'info'], ['East', 'info'], ['South', 'info'], ['West', 'info'], ['North', 'info']),
  nbr: T(['Poor', 'bad'], ['Fair', 'ok'], ['Healthy', 'good']),
  ndwi: T(['Dry', 'info'], ['Low water', 'info'], ['Wet', 'info'], ['Open water', 'info']),
  mndwi: T(['Dry land', 'info'], ['Wet', 'info'], ['Open water', 'info']),
  ndmi: T(['Dry', 'bad'], ['Low', 'ok'], ['Good', 'good'], ['High', 'good']),
  msi: T(['Well watered', 'good'], ['Fair', 'ok'], ['Stressed', 'bad'], ['Very dry', 'bad']),
  ndbi: T(['Green / water', 'good'], ['Mixed soil', 'ok'], ['Bare / built', 'bad']),
  bsi: T(['Covered', 'good'], ['Mixed', 'ok'], ['Bare soil', 'bad']),
  twi: T(['Drains fast', 'info'], ['Moderate', 'good'], ['Slow drain', 'ok'], ['Waterlogging risk', 'bad']),
  flow: T(['Low flow', 'good'], ['Some flow', 'ok'], ['Strong flow', 'bad'], ['Drain / channel', 'info']),
  sink: T(['No ponding', 'good'], ['Minor', 'ok'], ['Ponds', 'bad'], ['Waterlogged', 'bad']),
  bw: T(['Low', 'bad'], ['Medium', 'ok'], ['Good', 'good'], ['High', 'good']),
  slope: T(['Low (flat)', 'good'], ['Low (gentle)', 'good'], ['Medium', 'ok'], ['High', 'bad'], ['Very high', 'bad']),
}

export function verdict(id: string, v: number | undefined): { word: string; tone: Tone; why: string } | null {
  if (v === undefined || !Number.isFinite(v)) return null
  const bands = MEANING[id], words = VERDICT[id]
  if (bands && words) { const i = bands.findIndex(b => v < b.to); const k = Math.max(0, i), [word, tone] = words[k], b = bands[k]; const lim = Number.isFinite(b.to) ? `, below ${b.to}` : ''; return { word, tone, why: `The farm average is ${v.toFixed(2)}, which falls in the "${b.label}" range${lim}.` } }
  if (id === 'dem') return v < 100 ? { word: 'Low land', tone: 'info', why: 'Average height is under 100 m above sea level.' } : v < 500 ? { word: 'Mid land', tone: 'info', why: 'Average height is 100 to 500 m above sea level.' } : { word: 'High land', tone: 'info', why: 'Average height is above 500 m above sea level.' }
  return null
}
