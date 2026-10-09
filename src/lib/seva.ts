import { INDICATORS, byId, makeGrid, terrainBands, type Bands, type Grid } from './indicators'
import { hydroBands, resample } from './hydro'
import { insideMask, parseNpy, rasterSize, statsOf, type Bbox, type Raster, type Ring, type Stat } from './raster'

export type { Bbox, Stat }
export type Scene = { id: string; datetime: string; cloud: number; ids?: string[]; fill?: string[]; filled?: number }
export type SceneOpts = { mode?: 'latest' | 'date' | 'range'; date?: string; from?: string; to?: string; maxCloud?: number }
export type Analysis = {
  scene: Scene; ndvi: Stat; ndwi: Stat; ndmi: Stat; stressPct: number
  means?: Record<string, number>; slopePct?: number; slopeDeg?: number; elevMean?: number; analysedAt: string
}
export type FarmGeo = { lat: number; lon: number; area: number; polygon?: [number, number][] }
export type FarmData = FarmGeo & { moisture?: number; rain?: number; elevation?: number; analysis?: Analysis }
export type Advice = { level: 'good' | 'warn' | 'bad' | 'neutral'; chip: string; title: string; bullets: string[]; why?: string }

const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1'
const DATA = 'https://planetarycomputer.microsoft.com/api/data/v1'
const COLLECTION = 'sentinel-2-l2a'
const DEFAULT_HA = 4
export const S2_BANDS = ['B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B11', 'B12']

export function farmBBox(farm: FarmGeo): Bbox {
  if (farm.polygon && farm.polygon.length >= 3) {
    const lons = farm.polygon.map(p => p[0]), lats = farm.polygon.map(p => p[1])
    return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
  }
  const side = Math.sqrt((farm.area || DEFAULT_HA) * 10000) / 2
  const dLat = side / 111320
  const dLon = side / (111320 * Math.max(Math.cos((farm.lat * Math.PI) / 180), 0.01))
  return [farm.lon - dLon, farm.lat - dLat, farm.lon + dLon, farm.lat + dLat]
}

export function farmRing(farm: FarmGeo): Ring {
  if (farm.polygon && farm.polygon.length >= 3) return farm.polygon
  const [w, s, e, n] = farmBBox(farm)
  return [[w, s], [e, s], [e, n], [w, n]]
}

const NET = 'Could not reach the satellite service. Check your internet connection and press Refresh.'
async function guarded(url: string) {
  let last: unknown
  for (let k = 0; k < 2; k++) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Planetary Computer returned ${response.status}`)
      return response
    } catch (e) { last = e; if (e instanceof Error && /returned 4/.test(e.message)) break; await new Promise(r => setTimeout(r, 600)) }
  }
  throw last instanceof TypeError ? new Error(NET) : last
}
async function getJson(url: string) { return (await guarded(url)).json() }
async function getNpy(url: string) { return parseNpy(await (await guarded(url)).arrayBuffer()) }

const cache = new Map<string, Promise<unknown>>()
function memo<T>(key: string, make: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined
  if (!p) { p = make().catch(e => { cache.delete(key); throw e }); cache.set(key, p) }
  return p
}
const geoKey = (farm: FarmGeo) => farmBBox(farm).map(v => v.toFixed(6)).join(',') + (farm.polygon ? `:${farm.polygon.length}` : '')
const stamp = (d: Date) => d.toISOString().replace(/\.\d+Z$/, 'Z')

type Item = { id: string; day: string; datetime: string; cloud: number }
async function searchItems(bbox: Bbox, start: string, end: string, maxCloud: number, limit: number): Promise<Item[]> {
  const q = new URLSearchParams({
    collections: COLLECTION, bbox: bbox.join(','), datetime: `${start}/${end}`, limit: String(limit),
    sortby: '-datetime', query: JSON.stringify({ 'eo:cloud_cover': { lt: maxCloud } }),
  })
  const data = await getJson(`${STAC}/search?${q}`)
  return (data.features ?? []).map((item: { id: string; properties: Record<string, unknown> }) => ({ id: item.id, day: String(item.properties.datetime).slice(0, 10), datetime: String(item.properties.datetime), cloud: Math.round(Number(item.properties['eo:cloud_cover'] ?? 0)) }))
}

function group(items: Item[], opts: SceneOpts): Scene | undefined {
  const days = new Map<string, Item[]>()
  items.forEach(i => days.set(i.day, [...(days.get(i.day) ?? []), i]))
  const list = [...days.entries()].map(([day, its]) => ({ day, its, cloud: Math.round(its.reduce((a, b) => a + b.cloud, 0) / its.length) }))
  if (!list.length) return undefined
  const mode = opts.mode ?? 'latest'
  list.sort((a, b) => mode === 'range' ? a.cloud - b.cloud || b.day.localeCompare(a.day) : b.day.localeCompare(a.day))
  const main = list[0]
  const fill = mode === 'date' ? [] : list.slice(1, 5).flatMap(g => g.its.slice(0, 3).map(i => i.id))
  return { id: main.its[0].id, ids: main.its.slice(1, 9).map(i => i.id), fill, datetime: main.its[0].datetime, cloud: main.cloud }
}

export async function findScene(bbox: Bbox, opts: SceneOpts = {}): Promise<Scene> {
  const maxCloud = opts.maxCloud ?? 30, day = 86400000, now = new Date()
  const iso = (d: Date) => stamp(d)
  const at = (d: string, end?: boolean) => `${d}T${end ? '23:59:59' : '00:00:00'}Z`
  let scene: Scene | undefined
  if (opts.mode === 'date' && opts.date) scene = group(await searchItems(bbox, at(opts.date), at(opts.date, true), 101, 40), opts)
  else if (opts.mode === 'range' && opts.from && opts.to) scene = group(await searchItems(bbox, at(opts.from), at(opts.to, true), maxCloud, 80), opts)
  else {
    scene = group(await searchItems(bbox, iso(new Date(now.getTime() - 45 * day)), iso(now), maxCloud, 40), opts)
      || group(await searchItems(bbox, iso(new Date(now.getTime() - 180 * day)), iso(now), Math.max(maxCloud, 60), 40), opts)
  }
  if (!scene) throw new Error(opts.mode === 'date' ? 'No Sentinel-2 picture exists for that date over this area. Try another date or a range.' : 'No Sentinel-2 scene with that little cloud covers this area in that period. Raise the cloud limit or widen the dates.')
  return scene
}

const offsetFor = (datetime: string) => (datetime >= '2022-01-25' ? 1000 : 0)
const CLEAR = new Set([4, 5, 6, 7])

async function fetchBands(id: string, bbox: Bbox, w: number, h: number, expr: string, collection = COLLECTION) {
  return getNpy(`${DATA}/item/bbox/${bbox.join(',')}/${w}x${h}.npy?collection=${collection}&item=${encodeURIComponent(id)}&asset_as_band=true&expression=${encodeURIComponent(expr)}`)
}

function mergeInto(acc: Raster | null, r: Raster, good: Uint8Array, isGood: (r: Raster, i: number) => boolean): Raster {
  if (!acc) { const g = r.valid.length; for (let i = 0; i < g; i++) good[i] = r.valid[i] && isGood(r, i) ? 1 : 0; return r }
  for (let i = 0; i < good.length; i++) {
    if (good[i] || !r.valid[i]) continue
    const ok = isGood(r, i)
    if (ok || !acc.valid[i]) { acc.bands.forEach((band, k) => { band[i] = r.bands[k][i] }); acc.valid[i] = 1; good[i] = ok ? 1 : 0 }
  }
  return acc
}

async function s2Grid(scene: Scene, farm: FarmGeo, names: string[], res: number, maxPx: number, allowFill = true): Promise<Grid> {
  const bbox = farmBBox(farm), { w, h, wm, hm } = rasterSize(bbox, res, maxPx), ring = farmRing(farm)
  const expr = [...names, 'SCL'].join(';'), sclAt = names.length
  const isGood = (r: Raster, i: number) => r.bands[0][i] > 0 && CLEAR.has(r.bands[sclAt][i])
  const inside = insideMask(w, h, bbox, ring)
  let total = 0
  for (let i = 0; i < inside.length; i++) total += inside[i]
  const good = new Uint8Array(w * h)
  let acc: Raster | null = null, errors: unknown[] = [], done = 0
  const covered = () => { let c = 0; for (let i = 0; i < good.length; i++) if (good[i] && inside[i]) c++; return total ? c / total : 1 }
  const take = async (ids: string[]) => {
    const rs = await Promise.allSettled(ids.map(id => fetchBands(id, bbox, w, h, expr)))
    rs.forEach(r => { if (r.status === 'fulfilled') { acc = mergeInto(acc, r.value, good, isGood); done++ } else errors.push(r.reason) })
  }
  await take([scene.id, ...(scene.ids ?? [])])
  if (allowFill && scene.fill?.length) {
    for (let k = 0; k < scene.fill.length && (!acc || covered() < 0.97) && done < 12; k++) { const before = done; await take([scene.fill[k]]); if (done > before) scene.filled = (scene.filled ?? 0) + 1 }
  }
  if (!acc) throw (errors[0] instanceof Error ? errors[0] : new Error(NET))
  const raster: Raster = acc, offset = offsetFor(scene.datetime), n = raster.w * raster.h, b: Bands = {}, ok = new Uint8Array(n)
  names.forEach((name, k) => { const src = raster.bands[k], out = new Float64Array(n); for (let i = 0; i < n; i++) out[i] = (src[i] - offset) / 10000; b[name] = out })
  for (let i = 0; i < n; i++) ok[i] = good[i]
  return makeGrid(raster.w, raster.h, bbox, wm, hm, b, ok, ring)
}

export const loadScene = (scene: Scene, farm: FarmGeo) => memo(`s2:${scene.id}:${(scene.ids ?? []).join('+')}:${geoKey(farm)}`, () => s2Grid(scene, farm, S2_BANDS, 10, 700))
const loadLight = (scene: Scene, farm: FarmGeo) => memo(`s2l:${scene.id}:${(scene.ids ?? []).join('+')}:${geoKey(farm)}`, () => s2Grid(scene, farm, ['B03', 'B04', 'B08', 'B11'], 10, 200, false))

export const loadDem = (farm: FarmGeo) => memo(`dem3:${geoKey(farm)}`, async () => {
  const fb = farmBBox(farm), c: [number, number] = [(fb[0] + fb[2]) / 2, (fb[1] + fb[3]) / 2]
  const padM = Math.max(600, Math.max((fb[2] - fb[0]) * 111320 * Math.cos((c[1] * Math.PI) / 180), (fb[3] - fb[1]) * 111320) * 0.05)
  const padLat = padM / 111320, padLon = padLat / Math.max(Math.cos((c[1] * Math.PI) / 180), 0.01)
  const bbox: Bbox = [fb[0] - padLon, fb[1] - padLat, fb[2] + padLon, fb[3] + padLat]
  const found = await getJson(`${STAC}/search?collections=cop-dem-glo-30&bbox=${bbox.join(',')}&limit=12`)
  const ids: string[] = (found.features ?? []).map((f: { id: string }) => f.id)
  if (!ids.length) throw new Error('No elevation tile covers this location.')
  const { w, h, wm, hm } = rasterSize(bbox, 30, 500)
  const rs = await Promise.allSettled(ids.map(id => fetchBands(id, bbox, w, h, 'data', 'cop-dem-glo-30')))
  let acc: Raster | null = null
  const good = new Uint8Array(w * h)
  rs.forEach(r => { if (r.status === 'fulfilled') acc = mergeInto(acc, r.value, good, () => true) })
  if (!acc) throw new Error(NET)
  const raster: Raster = acc
  const dx = wm / raster.w, dy = hm / raster.h
  const t = terrainBands(raster.bands[0], raster.w, raster.h, dx, dy)
  const hy = hydroBands(raster.bands[0], t.slope, raster.w, raster.h, dx, dy)
  const src: Bands = { ...t, ...hy }, out = rasterSize(fb, 10, 300)
  const b: Bands = {}
  for (const k of Object.keys(src)) b[k] = resample(src[k], raster.w, raster.h, bbox, out.w, out.h, fb, k === 'aspect')
  return makeGrid(out.w, out.h, fb, out.wm, out.hm, b, new Uint8Array(out.w * out.h).fill(1), farmRing(farm))
})

export function indexStat(g: Grid, id: string): Stat | null {
  const ind = byId(id), values = new Float64Array(g.w * g.h)
  for (let i = 0; i < values.length; i++) values[i] = ind.value!(g.b, i)
  return statsOf(values, i => !!g.inside[i] && !!g.ok[i], ind.valid ?? [-1, 1])
}

function stressShare(g: Grid) {
  const ind = byId('ndvi')
  let total = 0, low = 0
  for (let i = 0; i < g.w * g.h; i++) {
    if (!g.inside[i] || !g.ok[i]) continue
    const v = ind.value!(g.b, i)
    if (!Number.isFinite(v) || v < -1 || v > 1) continue
    total++; if (v < 0.3) low++
  }
  return total ? (low / total) * 100 : 0
}

const statsCache = new Map<string, { ndvi: Stat; ndmi: Stat; stressPct: number }>()

async function sceneStats(scene: Scene, farm: FarmGeo) {
  const cacheKey = `${scene.id}:${geoKey(farm)}`
  const cached = statsCache.get(cacheKey)
  if (cached) return cached
  const g = await loadLight(scene, farm)
  const ndvi = indexStat(g, 'ndvi'), ndmi = indexStat(g, 'ndmi')
  if (!ndvi || !ndmi) throw new Error('No valid pixels inside the farm (cloud or edge of scene).')
  const res = { ndvi, ndmi, stressPct: stressShare(g) }
  statsCache.set(cacheKey, res)
  return res
}

export type Candle = { scene: Scene; ndvi: Stat; ndmi: number; stressPct: number }

export async function history(farm: FarmGeo, lookback = 180, max = 8): Promise<Candle[]> {
  const end = new Date(), start = new Date(end.getTime() - lookback * 86400000)
  const q = new URLSearchParams({ collections: COLLECTION, bbox: farmBBox(farm).join(','), datetime: `${stamp(start)}/${stamp(end)}`, limit: '100', sortby: '-datetime', query: JSON.stringify({ 'eo:cloud_cover': { lt: 30 } }) })
  const data = await getJson(`${STAC}/search?${q}`)
  const days = new Map<string, { id: string; datetime: string; cloud: number }[]>()
  for (const item of data.features ?? []) {
    const day = String(item.properties.datetime).slice(0, 10)
    days.set(day, [...(days.get(day) ?? []), { id: item.id, datetime: item.properties.datetime, cloud: Math.round(item.properties['eo:cloud_cover'] ?? 0) }])
  }
  const scenes: Scene[] = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, Math.min(max, 10)).map(([, its]) => ({ id: its[0].id, ids: its.slice(1, 6).map(i => i.id), datetime: its[0].datetime, cloud: Math.round(its.reduce((a, b) => a + b.cloud, 0) / its.length) }))

  // Process in small batches of 2 with 60ms breathers to ensure the main thread never freezes
  const results: Candle[] = []
  const BATCH_SIZE = 2
  for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
    const chunk = scenes.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(chunk.map(async scene => {
      const s = await sceneStats(scene, farm)
      return { scene, ndvi: s.ndvi, ndmi: s.ndmi.mean, stressPct: s.stressPct } as Candle
    }))
    settled.forEach(r => { if (r.status === 'fulfilled') results.push(r.value) })
    // Yield to the browser event loop between batches so UI stays 100% interactive
    await new Promise(r => setTimeout(r, 60))
  }
  return results.sort((a, b) => a.scene.datetime.localeCompare(b.scene.datetime))
}

export type WeekRec = { week: string; date: string; ndvi: number; ndmi: number; stressPct: number; cloud: number }

export const weekKey = (iso: string) => {
  const d = new Date(iso)
  const day = (d.getUTCDay() + 6) % 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10)
}

export async function weeklyRecords(farm: FarmGeo): Promise<WeekRec[]> {
  const rows = await history(farm, 180, 8)
  return rows.map(c => ({ week: c.scene.datetime.slice(0, 10), date: c.scene.datetime, ndvi: c.ndvi.mean, ndmi: c.ndmi, stressPct: c.stressPct, cloud: c.scene.cloud }))
}

export function mergeWeekly(old: WeekRec[] | undefined, fresh: WeekRec[]): WeekRec[] {
  const map = new Map((old ?? []).map(r => [r.week, r]))
  fresh.forEach(r => map.set(r.week, r))
  return [...map.values()].sort((a, b) => a.week.localeCompare(b.week)).slice(-120)
}

export async function analyze(farm: FarmGeo, opts: SceneOpts = {}): Promise<Analysis> {
  const scene = await findScene(farmBBox(farm), opts)
  const [g, dem] = await Promise.all([loadScene(scene, farm), loadDem(farm).catch(() => null)])
  const ndvi = indexStat(g, 'ndvi'), ndwi = indexStat(g, 'ndwi'), ndmi = indexStat(g, 'ndmi')
  if (!ndvi || !ndwi || !ndmi) throw new Error('No valid pixels inside the farm (cloud or edge of scene).')
  const means: Record<string, number> = {}
  for (const ind of INDICATORS) if (ind.source === 'S2' && ind.value) { const s = indexStat(g, ind.id); if (s) means[ind.id] = s.mean }
  let slopeDeg: number | undefined, slopePct: number | undefined, elevMean: number | undefined
  if (dem) {
    slopeDeg = indexStat(dem, 'slope')?.mean
    elevMean = indexStat(dem, 'dem')?.mean
    if (slopeDeg !== undefined) slopePct = Math.tan((slopeDeg * Math.PI) / 180) * 100
  }
  return { scene, ndvi, ndwi, ndmi, stressPct: stressShare(g), means, slopePct, slopeDeg, elevMean, analysedAt: new Date().toISOString() }
}

export function classify(ndvi?: number) {
  if (ndvi === undefined || Number.isNaN(ndvi)) return { label: 'No valid pixel', level: 'neutral' as const, advice: 'This pixel is masked (cloud, shadow, or outside the scene). Try a neighbouring spot.' }
  if (ndvi < 0.3) return { label: 'Severe stress or bare soil', level: 'bad' as const, advice: 'Very low vegetation vigour. Inspect on the ground for water shortage, pests, nutrient problems, or simply bare or harvested soil.' }
  if (ndvi < 0.5) return { label: 'Moderate stress', level: 'warn' as const, advice: 'Vigour is below healthy range. Check soil moisture and irrigation here; it may also be an early growth stage.' }
  return { label: 'Healthy vegetation', level: 'good' as const, advice: 'Dense, vigorous canopy. No action suggested from satellite data alone.' }
}

export function farmNeedsAttention(farm: FarmData) {
  const a = farm.analysis
  return !!a && (a.stressPct > 20 || a.ndvi.mean < 0.4)
}

export function farmStatus(a: Analysis) {
  if (a.ndvi.mean < 0.4 && a.ndmi.mean < 0.1) return 'Water stress'
  if (a.stressPct > 20 || a.ndvi.mean < 0.4) return 'Needs attention'
  return 'Healthy'
}

const fmt = (v: number, d = 2) => v.toFixed(d)

export function irrigationAdvice(farm: FarmData): Advice {
  const a = farm.analysis
  if (!a) return { level: 'neutral', chip: 'Awaiting data', title: 'Satellite analysis not available yet', bullets: ['Press Refresh to fetch the latest Sentinel-2 scene for this farm.'] }
  const dry = a.ndmi.mean < 0.1 || (farm.moisture !== undefined && farm.moisture < 15)
  const rainy = (farm.rain ?? 0) >= 15
  const bullets = [
    `Canopy moisture index (NDMI) averages ${fmt(a.ndmi.mean)}; ${a.stressPct.toFixed(0)}% of pixels show NDVI below 0.3.`,
    `Forecast rain, next 7 days: ${farm.rain !== undefined ? `${farm.rain.toFixed(1)} mm` : 'not fetched'}${farm.moisture !== undefined ? `. Modelled surface soil moisture ${farm.moisture}%.` : '.'}`,
  ]
  let out: Pick<Advice, 'level' | 'chip' | 'title'>, why = ''
  if (a.stressPct >= 25 && dry && !rainy) { out = { level: 'bad', chip: 'Irrigate soon', title: 'Dry and stressed: plan irrigation within days.' }; why = 'A quarter or more of the farm looks stressed, the leaves and soil read dry, and little rain is coming.'; bullets.push('Start with the red zones on the map, and check channels and pumps for blockages.') }
  else if (dry && rainy) { out = { level: 'warn', chip: 'Hold, rain due', title: 'Soil looks dry, but meaningful rain is forecast.' }; why = 'It reads dry now, but 15 mm or more of rain is forecast in the next 7 days.'; bullets.push('Consider waiting for the forecast rain before irrigating, then re-check after the next satellite pass.') }
  else if (a.stressPct >= 25) { out = { level: 'warn', chip: 'Inspect zones', title: 'Stress is present without clear dryness.' }; why = 'Many pixels look weak, but the moisture readings are not low, so water may not be the cause.'; bullets.push('Moisture is not the obvious cause. Check for pests, nutrient deficiency, waterlogging, or recent harvest.') }
  else { out = { level: 'good', chip: 'No action now', title: 'Crop vigour and moisture look adequate.' }; why = 'Less than a quarter of the farm looks stressed and moisture is not low.'; bullets.push('Re-check after the next clear Sentinel-2 pass (about every 5 days).') }
  bullets.push('Indicative only. Crop stage, soil type and root depth are not modelled.')
  return { ...out, bullets, why }
}

export function constructionSuitability(farm: FarmData): Advice {
  const slope = farm.analysis?.slopePct
  if (slope === undefined || farm.elevation === undefined) return { level: 'neutral', chip: 'Awaiting data', title: 'Terrain data not available yet', bullets: ['Press Refresh to fetch elevation and slope for this location.'] }
  const bullets = [`Elevation ${Math.round(farm.elevation)} m; estimated local slope ${slope.toFixed(1)}% (about 100 m sample).`]
  let out: Pick<Advice, 'level' | 'chip' | 'title'>, why = ''
  if (slope > 15) { out = { level: 'bad', chip: 'Challenging', title: 'Steep ground: heavy earthworks and erosion risk.' }; why = `The ground rises ${slope.toFixed(1)} m for every 100 m, which is above 15%.`; bullets.push('Slopes above 15% usually need terracing or retaining structures.') }
  else if (slope > 8) { out = { level: 'warn', chip: 'Possible with care', title: 'Moderate slope: manage runoff and erosion.' }; why = `The slope is ${slope.toFixed(1)}%, between 8% and 15%.`; bullets.push('Good drainage, but plan cut-and-fill and surface water control.') }
  else if (slope < 1 || farm.elevation < 5) { out = { level: 'warn', chip: 'Check drainage', title: 'Very flat or low-lying: ponding and flood risk.' }; why = 'The slope is under 1% or the land is under 5 m above sea level, so water drains slowly.'; bullets.push('Water may stand after heavy rain. Verify local flood maps and groundwater level.') }
  else { out = { level: 'good', chip: 'Favourable', title: 'Gentle slope with natural drainage.' }; why = `The slope is ${slope.toFixed(1)}%, in the 1 to 8% range that usually drains well.`; bullets.push('Slope of 1–8% generally drains well without major earthworks.') }
  if ((farm.rain ?? 0) >= 40) bullets.push(`Heavy rain forecast (${farm.rain!.toFixed(0)} mm in 7 days); avoid ground works until it passes.`)
  bullets.push('Screening only. Not an engineering, soil-bearing, or flood assessment; a site survey is required.')
  return { ...out, bullets, why }
}

export function barsFromStat(s: Stat, lo: number, hi: number, count = 24): number[] {
  const pts = [s.p10, s.p50, s.p90]
  return Array.from({ length: count }, (_, i) => {
    const t = (i / (count - 1)) * 2
    const k = Math.min(Math.floor(t), 1)
    const v = pts[k] + (pts[k + 1] - pts[k]) * (t - k)
    return Math.round(Math.min(Math.max((v - lo) / (hi - lo), 0), 1) * 7)
  })
}

export async function searchScenes(farm: FarmGeo, from: string, to: string, maxCloud: number, maxFrames = 12): Promise<Scene[]> {
  const items = await searchItems(farmBBox(farm), `${from}T00:00:00Z`, `${to}T23:59:59Z`, maxCloud, 150)
  const days = new Map<string, Item[]>()
  items.forEach(i => days.set(i.day, [...(days.get(i.day) ?? []), i]))
  let list = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  if (list.length > maxFrames) list = Array.from({ length: maxFrames }, (_, k) => list[Math.round((k * (list.length - 1)) / (maxFrames - 1))])
  return list.map(([, its]) => ({ id: its[0].id, ids: its.slice(1, 6).map(i => i.id), datetime: its[0].datetime, cloud: Math.round(its.reduce((a, b) => a + b.cloud, 0) / its.length) }))
}

export const loadFrame = (scene: Scene, farm: FarmGeo) => s2Grid(scene, farm, ['B02', 'B03', 'B04', 'B08'], 10, 480, false)
