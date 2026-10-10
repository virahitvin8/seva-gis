import { insideMask, paintClipped, pixelAt, rampColor, statsOf, type Bbox, type Ring, type Stat } from './raster'

export type Bands = Record<string, Float32Array | Float64Array>
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
export const CALIBRATED_SPECS: Record<string, { min: number; max: number }> = {
  B02: { min: 0.015, max: 0.22 },
  B03: { min: 0.020, max: 0.24 },
  B04: { min: 0.015, max: 0.26 },
  B05: { min: 0.020, max: 0.30 },
  B06: { min: 0.035, max: 0.45 },
  B07: { min: 0.045, max: 0.52 },
  B08: { min: 0.050, max: 0.58 },
  B11: { min: 0.020, max: 0.42 },
  B12: { min: 0.015, max: 0.36 },
}

const stretchBand = (v: number, band: string, gamma = 1.25) => {
  if (!Number.isFinite(v)) return 0
  const spec = CALIBRATED_SPECS[band] ?? { min: 0.02, max: 0.30 }
  const norm = Math.min(1, Math.max(0, (v - spec.min) / (spec.max - spec.min)))
  return Math.round(255 * Math.pow(norm, 1 / gamma))
}

const composite = (r: string, g: string, bl: string) => (b: Bands, i: number): [number, number, number] => [
  stretchBand(b[r]?.[i] ?? 0, r),
  stretchBand(b[g]?.[i] ?? 0, g),
  stretchBand(b[bl]?.[i] ?? 0, bl),
]

export const INDICATORS: Ind[] = [
  { id: 'ndvi', name: 'NDVI', group: 'Vegetation', source: 'S2', desc: 'A 0–1 style green-cover signal. Compare the same field over time and inspect thin-looking patches.', ramp: RDYLGN, range: [0, 0.9], valid: [-1, 1] },
  { id: 'evi', name: 'EVI', group: 'Vegetation', source: 'S2', desc: 'Another view of crop cover, useful when the canopy is dense. It cannot tell you yield or the cause of a weak patch.', ramp: RDYLGN, range: [0, 0.8], valid: [-1, 2] },
  { id: 'savi', name: 'SAVI', group: 'Vegetation', source: 'S2', desc: 'Tracks crop cover where soil is still visible between rows. A low early-season value may be expected.', ramp: RDYLGN, range: [0, 0.8], valid: [-1, 1.5] },
  { id: 'msavi', name: 'MSAVI', group: 'Vegetation', source: 'S2', desc: 'A crop-cover view for sparse stands; compare with planting date and check the rows on foot.', ramp: RDYLGN, range: [0, 0.8], valid: [-1, 1] },
  { id: 'gndvi', name: 'GNDVI', group: 'Vegetation', source: 'S2', desc: 'A leaf-greenness signal. It can highlight differences, but does not confirm a nitrogen shortage.', ramp: RDYLGN, range: [0, 0.8], valid: [-1, 1] },
  { id: 'ndre', name: 'NDRE', group: 'Vegetation', source: 'S2', desc: 'Helps compare dense crop areas that look similar from above; check unusual patches before changing inputs.', ramp: RDYLGN, range: [0, 0.6], valid: [-1, 1] },
  { id: 'cire', name: 'CIre', group: 'Vegetation', source: 'S2', desc: 'A leaf-colour signal for comparing crop areas. It is not a direct chlorophyll or fertilizer test.', ramp: ['#ffffe5', '#d9f0a3', '#78c679', '#238443', '#004529'], range: [0, 4], valid: [-1, 12] },
  { id: 'nbr', name: 'NBR', group: 'Vegetation', source: 'S2', desc: 'Highlights changes in crop cover. Check for harvest, dry residue, fire, or damage on the ground.', ramp: RDYLGN, range: [-0.2, 0.8], valid: [-1, 1] },
  { id: 'ndwi', name: 'NDWI', group: 'Water & moisture', source: 'S2', desc: 'Highlights possible open water or very wet surfaces. Confirm ponding in the field.', ramp: BRN_BLU, range: [-0.5, 0.5], valid: [-1, 1] },
  { id: 'mndwi', name: 'MNDWI', group: 'Water & moisture', source: 'S2', desc: 'Another way to find possible open water; wet soil and other surfaces can also affect the signal.', ramp: BRN_BLU, range: [-0.6, 0.6], valid: [-1, 1] },
  { id: 'ndmi', name: 'NDMI', group: 'Water & moisture', source: 'S2', desc: 'A canopy-moisture signal from the satellite image, not a soil or root-zone moisture reading.', ramp: BRN_BLU, range: [-0.4, 0.6], valid: [-1, 1] },
  { id: 'msi', name: 'MSI', group: 'Water & moisture', source: 'S2', desc: 'Higher values can point to a drier-looking canopy. Check soil near the roots before irrigation.', ramp: ['#2166ac', '#67a9cf', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'], range: [0.3, 1.8], valid: [0, 6] },
  { id: 'ndbi', name: 'NDBI', group: 'Soil & built-up', source: 'S2', desc: 'Finds surfaces that may be bare or built. Dry soil, roads, roofs, and residue can look alike.', ramp: ['#2b83ba', '#abdda4', '#ffffbf', '#fdae61', '#d7191c'], range: [-0.5, 0.3], valid: [-1, 1] },
  { id: 'bsi', name: 'BSI', group: 'Soil & built-up', source: 'S2', desc: 'Highlights places where soil may show through the crop. Compare with the expected crop stage.', ramp: ['#1a9850', '#a6d96a', '#ffffbf', '#d8a46a', '#8c510a'], range: [-0.4, 0.4], valid: [-1, 1] },
  { id: 'stress', name: 'Combined stress flag', group: 'Vegetation', source: 'S2', desc: 'A simple combination of satellite signals that points to places worth checking; it cannot identify a cause.', ramp: ['#1a9850', '#a6d96a', '#fee08b', '#fdae61', '#d73027'], range: [0, 1], valid: [0, 1] },
  { id: 'reip', name: 'REIP', group: 'Vegetation', source: 'S2', desc: 'Tracks a change in canopy colour response. Compare the same crop and stage; this is not a nitrogen test.', ramp: ['#a50026', '#fdae61', '#ffffbf', '#a6d96a', '#006837'], range: [700, 735], unit: 'nm', valid: [680, 760] },
  { id: 'lai', name: 'LAI', group: 'Vegetation', source: 'S2', desc: 'A rough model of leaf cover above the ground, not a leaf count or harvest estimate.', ramp: ['#ffffe5', '#d9f0a3', '#78c679', '#238443', '#004529'], range: [0, 5], unit: 'm²/m²', valid: [0, 10] },
  { id: 'chla', name: 'Chlorophyll (CIgreen)', group: 'Vegetation', source: 'S2', desc: 'A satellite estimate related to leaf greenness; confirm suspected nutrient problems with a test.', ramp: ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837'], range: [0, 5], valid: [-1, 15] },
  { id: 'aspect', name: 'Aspect (orientation)', group: 'Terrain', source: 'DEM', desc: 'Slope compass direction (0° N, 90° E, 180° S, 270° W). Sun exposure and runoff orientation.', ramp: ['#2b83ba', '#abdda4', '#ffffbf', '#fdae61', '#d7191c', '#2b83ba'], range: [0, 360], unit: '°', valid: [0, 360] },
  { id: 'dem', name: 'Elevation (DEM)', group: 'Terrain', source: 'DEM', desc: 'Copernicus GLO-30 digital surface model, 30 m.', ramp: ['#2b8a5e', '#7fbf6b', '#e8dc8a', '#c9a066', '#8a6a4a', '#f2f2f2'], unit: 'm', auto: true, valid: [-500, 9000] },
  { id: 'slope', name: 'Slope', group: 'Terrain', source: 'DEM', desc: 'Terrain slope from the DEM (Horn method).', ramp: ['#f7fcb9', '#addd8e', '#fdae61', '#f46d43', '#a50026'], range: [0, 15], unit: '°', valid: [0, 90] },
  { id: 'hillshade', name: 'Hillshade', group: 'Terrain', source: 'DEM', desc: 'Relief shading, sun azimuth 315°, altitude 45°.', valid: [0, 255] },
  { id: 'rgb', name: 'True colour', group: 'Imagery', source: 'S2', desc: 'Sentinel-2 red / green / blue, 10 m (Default).', rgb: composite('B04', 'B03', 'B02') },
  { id: 'cir', name: 'Colour infrared', group: 'Imagery', source: 'S2', desc: 'NIR / red / green. Healthy crops appear bright red.', rgb: composite('B08', 'B04', 'B03') },
  { id: 'agri', name: 'Agriculture', group: 'Imagery', source: 'S2', desc: 'SWIR1 / NIR / blue. Crops bright green, bare soil magenta.', rgb: composite('B11', 'B08', 'B02') },
  { id: 'moist_rgb', name: 'Moisture stress composite', group: 'Imagery', source: 'S2', desc: 'SWIR2 / NIR / red. Water stress and canopy hydration deficit.', rgb: composite('B12', 'B08', 'B04') },
  { id: 'swir_rgb', name: 'Atmospheric penetration', group: 'Imagery', source: 'S2', desc: 'SWIR2 / SWIR1 / NIR. Pierces haze and highlights canopy structure.', rgb: composite('B12', 'B11', 'B08') },
  { id: 're_rgb', name: 'Chlorophyll red-edge', group: 'Imagery', source: 'S2', desc: 'NIR / Red Edge 1 / red. Early chlorophyll breakdown and nitrogen deficit.', rgb: composite('B08', 'B05', 'B04') },
  { id: 'geology_rgb', name: 'Land / Water contrast', group: 'Imagery', source: 'S2', desc: 'SWIR2 / NIR / green. High contrast between water, soil, and vegetation.', rgb: composite('B12', 'B08', 'B03') },
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

export function terrainBands(elev: Float32Array | Float64Array, w: number, h: number, dx: number, dy: number): { elev: Float32Array | Float64Array; slope: Float64Array; aspect: Float64Array; hill: Float64Array } {
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

export type Layer = { url: string; stat: Stat | null; range: [number, number] | null; ind: Ind; bbox: Bbox; cellSizeM: number }

export type RenderOptions = {
  smooth?: boolean
  dra?: boolean
  sharpen?: number
}

const rangeOf = (ind: Ind, g: Grid, dra = false, stat?: Stat | null): [number, number] | null => {
  if (dra && stat && stat.p90 > stat.p10 && ind.ramp) {
    const span = stat.p90 - stat.p10
    const lo = Math.max(ind.valid?.[0] ?? -1e9, stat.p10 - span * 0.05)
    const hi = Math.min(ind.valid?.[1] ?? 1e9, stat.p90 + span * 0.05)
    return [lo, hi]
  }
  if (ind.range) return ind.range
  if (!ind.auto || !ind.value) return null
  const s = statsOf(g.b.elev, i => !!g.inside[i], ind.valid ?? [-1e9, 1e9])
  return s ? (s.max - s.min < 2 ? [s.min - 1, s.max + 1] : [s.min, s.max]) : null
}

export function renderLayer(ind: Ind, g: Grid, ring: Ring, opts: RenderOptions = {}): Layer {
  const { smooth = true, dra = false, sharpen = 0.35 } = opts
  const valid = ind.valid ?? [-1, 1]
  let stat: Stat | null = null
  if (ind.value) {
    const vals = new Float32Array(g.w * g.h)
    for (let i = 0; i < vals.length; i++) vals[i] = ind.value(g.b, i)
    stat = statsOf(vals, i => !!g.inside[i] && !!g.ok[i], valid)
  }
  const range = rangeOf(ind, g, dra, stat)

  let draStretch: ((b: Bands, i: number) => [number, number, number]) | null = null
  if (dra && ind.rgb) {
    const getPercentiles = (arr: Float32Array | Float64Array): [number, number] => {
      const vs: number[] = []
      const step = Math.max(1, Math.floor(arr.length / 3000))
      for (let i = 0; i < arr.length; i += step) {
        if (g.inside[i] && g.ok[i]) {
          const v = arr[i]
          if (Number.isFinite(v) && v > -0.2 && v < 2.0) vs.push(v)
        }
      }
      if (vs.length < 8) return [0.02, 0.30]
      vs.sort((a, b) => a - b)
      const lo = vs[Math.min(vs.length - 1, Math.max(0, Math.floor(0.02 * vs.length)))]
      const hi = vs[Math.min(vs.length - 1, Math.max(0, Math.floor(0.98 * vs.length)))]
      return hi - lo > 0.02 ? [lo, hi] : [0.02, 0.30]
    }
    const bandMap: Record<string, [string, string, string]> = {
      rgb: ['B04', 'B03', 'B02'],
      cir: ['B08', 'B04', 'B03'],
      agri: ['B11', 'B08', 'B02'],
      moist_rgb: ['B12', 'B08', 'B04'],
      swir_rgb: ['B12', 'B11', 'B08'],
      re_rgb: ['B08', 'B05', 'B04'],
      geology_rgb: ['B12', 'B08', 'B03'],
    }
    const bands = bandMap[ind.id]
    if (bands && g.b[bands[0]] && g.b[bands[1]] && g.b[bands[2]]) {
      const [rLo, rHi] = getPercentiles(g.b[bands[0]])
      const [gLo, gHi] = getPercentiles(g.b[bands[1]])
      const [bLo, bHi] = getPercentiles(g.b[bands[2]])
      const stretchCh = (v: number, lo: number, hi: number) => {
        if (!Number.isFinite(v)) return 0
        const norm = Math.min(1, Math.max(0, (v - lo) / (hi - lo)))
        return Math.round(255 * Math.pow(norm, 1 / 1.25))
      }
      draStretch = (b, i) => [
        stretchCh(b[bands[0]][i], rLo, rHi),
        stretchCh(b[bands[1]][i], gLo, gHi),
        stretchCh(b[bands[2]][i], bLo, bHi),
      ]
    }
  }

  const paint = (i: number): [number, number, number] | null => {
    if (!g.ok[i]) return null
    if (draStretch) return draStretch(g.b, i)
    if (ind.rgb) return ind.rgb(g.b, i)
    const v = ind.value!(g.b, i)
    if (!Number.isFinite(v) || v < valid[0] || v > valid[1]) return null
    if (!ind.ramp) { const c = Math.round(v); return [c, c, c] }
    return ind.log ? rampColor(ind.ramp, (Math.log10(v) - Math.log10(range![0])) / (Math.log10(range![1]) - Math.log10(range![0]))) : rampColor(ind.ramp, (v - range![0]) / (range![1] - range![0]))
  }
  // Grid dx/dy are already measured in meters by rasterSize(). Do not
  // convert them as if they were degrees; that inflated the displayed
  // output-cell estimate by roughly 111,320x.
  const cellSizeM = Math.max(g.dx, g.dy)
  return { url: paintClipped(g.w, g.h, g.bbox, ring, paint, smooth, sharpen), stat, range, ind, bbox: g.bbox, cellSizeM }
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
const veg = (a: number, b: number, c: number): Band[] => [{ to: a, label: 'Very little cover signal', color: '#d73027' }, { to: b, label: 'Thin cover signal', color: '#fdae61' }, { to: c, label: 'Cover building', color: '#d9ef8b' }, { to: Infinity, label: 'Stronger cover signal', color: '#1a9850' }]
const wet: Band[] = [{ to: -0.3, label: 'Lower surface-water signal', color: '#8c510a' }, { to: 0, label: 'Middle-low signal', color: '#dfc27d' }, { to: 0.3, label: 'Middle-high signal', color: '#80cdc1' }, { to: Infinity, label: 'Higher signal; check for open water', color: '#01665e' }]
export const MEANING: Record<string, Band[]> = {
  ndvi: [{ to: 0.2, label: 'Very little green cover', color: '#a50026' }, { to: 0.35, label: 'Thin green cover', color: '#f46d43' }, { to: 0.5, label: 'Cover building', color: '#fee08b' }, { to: 0.6, label: 'Steady green cover', color: '#a6d96a' }, { to: Infinity, label: 'Strong green-cover signal', color: '#1a9850' }],
  evi: veg(0.15, 0.3, 0.5), savi: veg(0.15, 0.3, 0.5), msavi: veg(0.15, 0.3, 0.5), gndvi: veg(0.2, 0.4, 0.6),
  ndre: [{ to: 0.15, label: 'Lower signal', color: '#d73027' }, { to: 0.3, label: 'Middle signal', color: '#fee08b' }, { to: 0.45, label: 'Stronger signal', color: '#a6d96a' }, { to: Infinity, label: 'High signal', color: '#1a9850' }],
  cire: [{ to: 1, label: 'Lower leaf-colour signal', color: '#d73027' }, { to: 2.5, label: 'Middle signal', color: '#fee08b' }, { to: Infinity, label: 'Higher signal', color: '#1a9850' }],
  chla: [{ to: 1, label: 'Lower greenness signal', color: '#d73027' }, { to: 2.5, label: 'Middle signal', color: '#fee08b' }, { to: Infinity, label: 'Higher signal', color: '#1a9850' }],
  reip: [{ to: 708, label: 'Lower colour response', color: '#a50026' }, { to: 715, label: 'Lower-middle response', color: '#fdae61' }, { to: 724, label: 'Middle-high response', color: '#a6d96a' }, { to: Infinity, label: 'Higher colour response', color: '#006837' }],
  lai: [{ to: 0.8, label: 'Light leaf cover', color: '#d73027' }, { to: 2.0, label: 'Cover building', color: '#fee08b' }, { to: 3.5, label: 'Broad leaf cover', color: '#a6d96a' }, { to: Infinity, label: 'Dense estimated cover', color: '#004529' }],
  stress: [{ to: 0.25, label: 'Few warning signals', color: '#1a9850' }, { to: 0.5, label: 'Some areas to check', color: '#fee08b' }, { to: 0.75, label: 'More areas to check', color: '#fdae61' }, { to: Infinity, label: 'Strong combined signal', color: '#d73027' }],
  aspect: [{ to: 45, label: 'North', color: '#2b83ba' }, { to: 135, label: 'East (morning sun)', color: '#abdda4' }, { to: 225, label: 'South (high solar heat)', color: '#fdae61' }, { to: 315, label: 'West (evening heat)', color: '#d7191c' }, { to: Infinity, label: 'North', color: '#2b83ba' }],
  nbr: [{ to: 0.1, label: 'Little crop cover signal', color: '#d73027' }, { to: 0.3, label: 'Thinner cover signal', color: '#fee08b' }, { to: Infinity, label: 'Stronger cover signal', color: '#1a9850' }],
  ndwi: wet,
  mndwi: [{ to: 0, label: 'Lower surface-water signal', color: '#dfc27d' }, { to: 0.3, label: 'Possible wet surface', color: '#80cdc1' }, { to: Infinity, label: 'Check for open water', color: '#01665e' }],
  ndmi: [{ to: -0.1, label: 'Lower canopy-moisture signal', color: '#8c510a' }, { to: 0.2, label: 'Middle-low signal', color: '#dfc27d' }, { to: 0.4, label: 'Middle-high signal', color: '#80cdc1' }, { to: Infinity, label: 'Higher canopy-moisture signal', color: '#01665e' }],
  msi: [{ to: 0.6, label: 'Lower dryness signal', color: '#2166ac' }, { to: 1, label: 'Middle signal', color: '#f7f7f7' }, { to: 1.5, label: 'Higher dryness signal', color: '#ef8a62' }, { to: Infinity, label: 'Strong dryness signal', color: '#b2182b' }],
  ndbi: [{ to: -0.2, label: 'Vegetation / water', color: '#2b83ba' }, { to: 0, label: 'Mixed soil', color: '#ffffbf' }, { to: Infinity, label: 'Built-up / bare', color: '#d7191c' }],
  bsi: [{ to: -0.1, label: 'Vegetated', color: '#1a9850' }, { to: 0.1, label: 'Mixed', color: '#ffffbf' }, { to: Infinity, label: 'Bare soil', color: '#8c510a' }],
  twi: [{ to: 6, label: 'Higher ground; water may run off', color: '#8c510a' }, { to: 9, label: 'Middle terrain signal', color: '#dfc27d' }, { to: 12, label: 'Water may collect nearby', color: '#80cdc1' }, { to: Infinity, label: 'Low area to check after rain', color: '#01665e' }],
  flow: [{ to: 1, label: 'Little upslope area drains here', color: '#f7fbff' }, { to: 10, label: 'Some water may pass through', color: '#9ecae1' }, { to: 50, label: 'Runoff may concentrate here', color: '#4292c6' }, { to: Infinity, label: 'Likely drainage path; inspect after rain', color: '#08306b' }],
  sink: [{ to: 1, label: 'No modelled hollow', color: '#f7fcf0' }, { to: 10, label: 'Small hollow to inspect', color: '#bae4bc' }, { to: 30, label: 'May hold water after rain', color: '#4eb3d3' }, { to: Infinity, label: 'Larger hollow; check for ponding', color: '#081d58' }],
  bw: [{ to: 30, label: 'Lower terrain score', color: '#8c510a' }, { to: 50, label: 'Middle terrain score', color: '#dfc27d' }, { to: 70, label: 'Higher terrain score', color: '#80cdc1' }, { to: Infinity, label: 'Highest terrain score', color: '#01665e' }],
  slope: [{ to: 2, label: 'Nearly level', color: '#f7fcb9' }, { to: 5, label: 'Gentle slope', color: '#addd8e' }, { to: 8, label: 'Moderate slope', color: '#fdae61' }, { to: 15, label: 'Steeper ground', color: '#f46d43' }, { to: Infinity, label: 'Very steep ground', color: '#a50026' }],
}
export const bandFor = (id: string, v: number) => MEANING[id]?.find(b => v < b.to)
export const bandRange = (id: string, i: number) => { const b = MEANING[id]; const lo = i ? b[i - 1].to : null, hi = b[i].to; return lo === null ? `< ${hi}` : hi === Infinity ? `≥ ${lo}` : `${lo} to ${hi}` }

export type Tone = 'good' | 'ok' | 'bad' | 'info'
const T = (...a: [string, Tone][]) => a
const vegV = T(['Very little cover', 'bad'], ['Thin cover', 'ok'], ['Cover building', 'ok'], ['Strong cover signal', 'good'])
const VERDICT: Record<string, [string, Tone][]> = {
  ndvi: T(['Very little cover', 'bad'], ['Thin cover', 'bad'], ['Cover building', 'ok'], ['Steady cover', 'good'], ['Strong cover signal', 'good']),
  evi: vegV, savi: vegV, msavi: vegV, gndvi: vegV,
  ndre: T(['Lower signal', 'info'], ['Middle signal', 'info'], ['Stronger signal', 'info'], ['High signal', 'info']),
  cire: T(['Lower leaf-colour signal', 'info'], ['Middle signal', 'info'], ['Higher signal', 'info']),
  chla: T(['Lower greenness signal', 'info'], ['Middle signal', 'info'], ['Higher signal', 'info']),
  reip: T(['Lower colour response', 'info'], ['Lower-middle response', 'info'], ['Middle-high response', 'info'], ['Higher colour response', 'info']),
  lai: T(['Light leaf cover', 'info'], ['Cover building', 'info'], ['Broad leaf cover', 'info'], ['Dense estimated cover', 'info']),
  stress: T(['Few warning signals', 'good'], ['Some areas to check', 'ok'], ['More areas to check', 'bad'], ['Strong combined signal', 'bad']),
  aspect: T(['North', 'info'], ['East', 'info'], ['South', 'info'], ['West', 'info'], ['North', 'info']),
  nbr: T(['Little cover signal', 'bad'], ['Thinner cover signal', 'ok'], ['Stronger cover signal', 'good']),
  ndwi: T(['Lower surface-water signal', 'info'], ['Middle-low signal', 'info'], ['Middle-high signal', 'info'], ['Higher signal; check for water', 'info']),
  mndwi: T(['Lower surface-water signal', 'info'], ['Possible wet surface', 'info'], ['Check for open water', 'info']),
  ndmi: T(['Lower canopy-moisture signal', 'info'], ['Middle-low signal', 'info'], ['Middle-high signal', 'info'], ['Higher canopy-moisture signal', 'info']),
  msi: T(['Lower dryness signal', 'info'], ['Middle signal', 'info'], ['Higher dryness signal', 'info'], ['Strong dryness signal', 'info']),
  ndbi: T(['Vegetation or water signal', 'info'], ['Mixed surface signal', 'info'], ['Bare or built-looking signal', 'info']),
  bsi: T(['More crop cover signal', 'info'], ['Mixed surface signal', 'info'], ['More exposed soil signal', 'info']),
  twi: T(['Drains fast', 'info'], ['Moderate', 'good'], ['Slow drain', 'ok'], ['Waterlogging risk', 'bad']),
  flow: T(['Low flow', 'good'], ['Some flow', 'ok'], ['Strong flow', 'bad'], ['Drain / channel', 'info']),
  sink: T(['No ponding', 'good'], ['Minor', 'ok'], ['Ponds', 'bad'], ['Waterlogged', 'bad']),
  bw: T(['Low', 'bad'], ['Medium', 'ok'], ['Good', 'good'], ['High', 'good']),
  slope: T(['Low (flat)', 'good'], ['Low (gentle)', 'good'], ['Medium', 'ok'], ['High', 'bad'], ['Very high', 'bad']),
}

export function verdict(id: string, v: number | undefined): { word: string; tone: Tone; why: string } | null {
  if (v === undefined || !Number.isFinite(v)) return null
  const bands = MEANING[id], words = VERDICT[id]
  if (bands && words) { const i = bands.findIndex(b => v < b.to); const k = Math.max(0, i), [word, tone] = words[k], b = bands[k]; return { word, tone, why: `The farm's average reading is ${v.toFixed(2)}. ${b.label} is a guide to what the image shows, not a diagnosis.` } }
  if (id === 'dem') return v < 100 ? { word: 'Low land', tone: 'info', why: 'Average height is under 100 m above sea level.' } : v < 500 ? { word: 'Mid land', tone: 'info', why: 'Average height is 100 to 500 m above sea level.' } : { word: 'High land', tone: 'info', why: 'Average height is above 500 m above sea level.' }
  return null
}
