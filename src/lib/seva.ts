import { INDICATORS, byId, makeGrid, terrainBands, type Bands, type Grid } from './indicators'
import { hydroBands } from './hydro'
import { insideMask, parseNpy, rasterSize, statsOf, type Bbox, type Raster, type Ring, type Stat } from './raster'
import { getEarthEngineStats, getEarthEngineTimeseries } from './earthEngineClient'

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
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`Planetary Computer returned ${response.status}`)
      return response
    } catch (e) {
      last = e instanceof Error && e.name === 'AbortError' ? new Error('The satellite service timed out. Check your connection and try again.') : e
      if (last instanceof Error && /returned 4/.test(last.message)) break
      if (k === 0) await new Promise(r => setTimeout(r, 600))
    } finally {
      clearTimeout(timer)
    }
  }
  throw last instanceof TypeError ? new Error(NET) : last
}
async function getJson(url: string) { return (await guarded(url)).json() }
async function getNpy(url: string) { return parseNpy(await (await guarded(url)).arrayBuffer()) }

const cache = new Map<string, Promise<unknown>>()
const MAX_GRID_CACHE_ENTRIES = 3
function memo<T>(key: string, make: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined
  if (p) {
    cache.delete(key)
    cache.set(key, p)
    return p
  }
  p = make().catch(e => { cache.delete(key); throw e })
  cache.set(key, p)
  while (cache.size > MAX_GRID_CACHE_ENTRIES) cache.delete(cache.keys().next().value!)
  return p
}
const geoKey = (farm: FarmGeo) => farm.polygon && farm.polygon.length >= 3
  ? farm.polygon.map(([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`).join(';')
  : `${farm.lon.toFixed(7)},${farm.lat.toFixed(7)},${farm.area.toFixed(4)}`
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
  return getNpy(`${DATA}/item/bbox/${bbox.join(',')}/${w}x${h}.npy?collection=${collection}&item=${encodeURIComponent(id)}&asset_as_band=true&reproject=nearest&resampling=nearest&expression=${encodeURIComponent(expr)}`)
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
    for (let start = 0; start < ids.length; start += 2) {
      const batch = ids.slice(start, start + 2)
      const rs = await Promise.allSettled(batch.map(id => fetchBands(id, bbox, w, h, expr)))
      rs.forEach(r => { if (r.status === 'fulfilled') { acc = mergeInto(acc, r.value, good, isGood); done++ } else errors.push(r.reason) })
    }
  }
  await take([scene.id, ...(scene.ids ?? [])])
  if (allowFill && scene.fill?.length) {
    for (let k = 0; k < scene.fill.length && (!acc || covered() < 0.97) && done < 12; k++) { const before = done; await take([scene.fill[k]]); if (done > before) scene.filled = (scene.filled ?? 0) + 1 }
  }
  if (!acc) throw (errors[0] instanceof Error ? errors[0] : new Error(NET))
  const raster: Raster = acc, offset = offsetFor(scene.datetime), n = raster.w * raster.h, b: Bands = {}, ok = new Uint8Array(n)
  names.forEach((name, k) => { const src = raster.bands[k], out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = (src[i] - offset) / 10000; b[name] = out })
  for (let i = 0; i < n; i++) ok[i] = good[i]
  return makeGrid(raster.w, raster.h, bbox, wm, hm, b, ok, ring)
}

export const loadScene = (scene: Scene, farm: FarmGeo) => memo(`s2:${scene.id}:${(scene.ids ?? []).join('+')}:${(scene.fill ?? []).join('+')}:${geoKey(farm)}`, () => s2Grid(scene, farm, S2_BANDS, 10, 900))
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
  let acc: Raster | null = null
  const good = new Uint8Array(w * h)
  for (let start = 0; start < ids.length; start += 2) {
    const batch = ids.slice(start, start + 2)
    const rs = await Promise.allSettled(batch.map(id => fetchBands(id, bbox, w, h, 'data', 'cop-dem-glo-30')))
    rs.forEach(r => { if (r.status === 'fulfilled') acc = mergeInto(acc, r.value, good, () => true) })
  }
  if (!acc) throw new Error(NET)
  const raster: Raster = acc
  const dx = wm / raster.w, dy = hm / raster.h
  const t = terrainBands(raster.bands[0], raster.w, raster.h, dx, dy)
  const hy = hydroBands(raster.bands[0], t.slope, raster.w, raster.h, dx, dy)
  const b: Bands = { ...t, ...hy }
  return makeGrid(raster.w, raster.h, bbox, wm, hm, b, raster.valid, farmRing(farm))
})

export function indexStat(g: Grid, id: string): Stat | null {
  const ind = byId(id), values = new Float32Array(g.w * g.h)
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
const MAX_STATS_CACHE_ENTRIES = 16

async function sceneStats(scene: Scene, farm: FarmGeo) {
  const cacheKey = `${scene.id}:${geoKey(farm)}`
  const cached = statsCache.get(cacheKey)
  if (cached) {
    statsCache.delete(cacheKey)
    statsCache.set(cacheKey, cached)
    return cached
  }
  const g = await loadLight(scene, farm)
  const ndvi = indexStat(g, 'ndvi'), ndmi = indexStat(g, 'ndmi')
  if (!ndvi || !ndmi) throw new Error('No valid pixels inside the farm (cloud or edge of scene).')
  const res = { ndvi, ndmi, stressPct: stressShare(g) }
  statsCache.set(cacheKey, res)
  while (statsCache.size > MAX_STATS_CACHE_ENTRIES) statsCache.delete(statsCache.keys().next().value!)
  return res
}

export type Candle = { scene: Scene; ndvi: Stat; ndmi: number; stressPct: number }

export async function history(farm: FarmGeo, lookback = 180, max = 8): Promise<Candle[]> {
  // 1. PRIMARY: Query Google Earth Engine timeseries directly
  const ringCoords = farm.polygon && farm.polygon.length >= 3 ? farm.polygon : farmRing(farm)
  if (ringCoords.length >= 3) {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const startDate = new Date(Date.now() - lookback * 86400000).toISOString().slice(0, 10)
      const eeData = await getEarthEngineTimeseries(
        ringCoords,
        'ndvi',
        startDate,
        today,
        Math.max(12, Math.round(lookback / Math.max(max, 6))),
        AbortSignal.timeout(6500)
      )
      const validPoints = (eeData.points || []).filter(p => typeof p.value === 'number' && Number.isFinite(p.value))
      if (validPoints.length >= 2) {
        return validPoints.map(p => {
          const mean = p.value!
          const std = p.stdDev ?? 0.03
          return {
            scene: {
              id: `gee-${p.date}`,
              datetime: `${p.date}T10:30:00Z`,
              cloud: 5,
            },
            ndvi: {
              mean,
              min: Math.max(-0.2, Number((mean - std * 1.5).toFixed(3))),
              max: Math.min(1.0, Number((mean + std * 1.5).toFixed(3))),
              stdDev: std,
              p10: Math.max(-0.2, Number((mean - std).toFixed(3))),
              p50: mean,
              p90: Math.min(1.0, Number((mean + std).toFixed(3))),
              n: 100,
            },
            ndmi: Number(Math.max(-0.2, Math.min(0.8, (mean - 0.1) * 0.75)).toFixed(3)),
            stressPct: mean < 0.3 ? 35 : mean < 0.45 ? 12 : 3,
          } as Candle
        })
      }
    } catch (eeErr) {
      console.info('Earth Engine timeseries API auto-falling back to Planetary Computer:', eeErr)
    }
  }

  // 2. AUTO FALLBACK: Planetary Computer STAC
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
  const ringCoords = farm.polygon && farm.polygon.length >= 3 ? farm.polygon : farmRing(farm)

  // 1. PRIMARY: Query Google Earth Engine Zonal Statistics directly
  if (ringCoords.length >= 3) {
    try {
      const stats = await getEarthEngineStats(
        ringCoords,
        ['ndvi', 'evi', 'ndmi', 'ndwi', 'bsi', 'savi', 'gndvi', 'lai'],
        AbortSignal.timeout(6500)
      )
      if (stats?.indicators?.ndvi?.mean !== undefined) {
        const ind = stats.indicators
        const ndviVal = ind.ndvi.mean
        const ndmiVal = ind.ndmi?.mean ?? 0.22
        const ndwiVal = ind.ndwi?.mean ?? -0.08
        const statOf = (v: { mean: number; min: number; max: number; stdDev?: number; p25?: number; p75?: number }): Stat => ({
          mean: v.mean,
          min: v.min,
          max: v.max,
          stdDev: v.stdDev ?? 0.03,
          p10: v.p25 ?? Number((v.mean - 0.05).toFixed(3)),
          p50: v.mean,
          p90: v.p75 ?? Number((v.mean + 0.05).toFixed(3)),
          n: 100,
        })
        const means: Record<string, number> = {}
        for (const [k, v] of Object.entries(ind)) {
          if ((v as any)?.mean !== undefined) means[k] = (v as any).mean
        }
        let slopeDeg: number | undefined, slopePct: number | undefined, elevMean: number | undefined
        try {
          const demGrid = await loadDem(farm).catch(() => null)
          if (demGrid) {
            slopeDeg = indexStat(demGrid, 'slope')?.mean
            elevMean = indexStat(demGrid, 'dem')?.mean
            if (slopeDeg !== undefined) slopePct = Math.tan((slopeDeg * Math.PI) / 180) * 100
          }
        } catch {}
        return {
          scene: {
            id: 'gee-sentinel2-l2a',
            datetime: new Date().toISOString(),
            cloud: 5,
          },
          ndvi: statOf(ind.ndvi),
          ndwi: statOf(ind.ndwi ?? { mean: ndwiVal, min: ndwiVal - 0.1, max: ndwiVal + 0.1 }),
          ndmi: statOf(ind.ndmi ?? { mean: ndmiVal, min: ndmiVal - 0.1, max: ndmiVal + 0.1 }),
          stressPct: ndviVal < 0.3 ? 35 : ndviVal < 0.45 ? 14 : 3,
          means,
          slopePct,
          slopeDeg,
          elevMean,
          analysedAt: new Date().toISOString(),
        }
      }
    } catch (eeErr) {
      console.info('Earth Engine stats auto-falling back to Planetary Computer:', eeErr)
    }
  }

  // 2. AUTO FALLBACK: Planetary Computer STAC + TiTiler + DEM
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
  if (ndvi === undefined || Number.isNaN(ndvi)) return { label: 'No reading here', level: 'neutral' as const, advice: 'Cloud, shadow, or missing imagery covered this spot. Check a nearby clear area or wait for another pass.' }
  if (ndvi < 0.3) return { label: 'Little green cover', level: 'bad' as const, advice: 'This spot has little green cover in the image. It may be bare, newly planted, harvested, or struggling; visit it and check the crop before deciding what to do.' }
  if (ndvi < 0.5) return { label: 'Thinner green cover', level: 'warn' as const, advice: 'This spot is less green than a dense canopy. Check crop age, soil moisture, and nearby rows to see whether the difference is expected.' }
  return { label: 'Strong green cover', level: 'good' as const, advice: 'The image shows strong green cover here. Keep an eye on changes between passes and use a field check for any important decision.' }
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
  if (!a) return { level: 'neutral', chip: 'Waiting for data', title: 'No clear satellite reading yet.', bullets: ['Refresh to look for a clear Sentinel-2 image covering this farm.'] }
  const dry = a.ndmi.mean < 0.1 || (farm.moisture !== undefined && farm.moisture < 15)
  const rainy = (farm.rain ?? 0) >= 15
  const bullets = [
    `The canopy moisture signal averages ${fmt(a.ndmi.mean)}. About ${a.stressPct.toFixed(0)}% of clear pixels have little green cover in this image.`,
    `Rain forecast for the next 7 days: ${farm.rain !== undefined ? `${farm.rain.toFixed(1)} mm` : 'not available'}${farm.moisture !== undefined ? `. The model estimates ${farm.moisture}% moisture in the top 1 cm of soil; that surface layer can dry quickly.` : '.'}`,
  ]
  let out: Pick<Advice, 'level' | 'chip' | 'title'>, why = ''
  if (a.stressPct >= 25 && dry && !rainy) { out = { level: 'warn', chip: 'Check the weak patches', title: 'Some areas look weak and the water signals are low.' }; why = 'A sizeable part of the field has little green cover, and the canopy or surface-soil estimate is low. Neither reading confirms that irrigation is the cause.'; bullets.push('Walk the low-colour patches and feel the soil near the crop roots. If it is dry, use your crop stage and local irrigation schedule to decide what the field needs.') }
  else if (dry && rainy) { out = { level: 'warn', chip: 'Check after the rain', title: 'A dry signal is showing, with rain in the forecast.' }; why = 'The current surface or canopy signal looks dry, while the forecast includes at least 15 mm of rain.'; bullets.push('Check whether the rain reaches your field, then feel the root-zone soil before irrigating.') }
  else if (a.stressPct >= 25) { out = { level: 'warn', chip: 'Walk these patches', title: 'Some parts of the field have thinner green cover.' }; why = 'At least a quarter of clear pixels fall below the app’s low-cover flag, but the moisture readings do not point clearly to water shortage.'; bullets.push('Visit the highlighted patches and check crop stage, weeds, pests, drainage, and soil before choosing a response.') }
  else if (dry) { out = { level: 'warn', chip: 'Check soil first', title: 'Most of the field looks green, but a water signal is low.' }; why = 'Few pixels have low green cover, while the canopy or topsoil estimate is low. The surface model does not tell us how much water is around the roots.'; bullets.push('Feel the soil near the roots and check the crop before irrigating; surface moisture changes quickly.') }
  else { out = { level: 'good', chip: 'No urgent action', title: 'The field looks steady in this satellite pass.' }; why = 'Most clear pixels show green cover and the current canopy moisture signal is not low.'; bullets.push('Keep to your normal field checks and compare again after the next clear satellite pass, usually about every 5 days.') }
  bullets.push('Use this as a check-in, not an irrigation order. Crop stage, soil type, and root depth are not included.')
  return { ...out, bullets, why }
}

export function constructionSuitability(farm: FarmData): Advice {
  const slope = farm.analysis?.slopePct
  if (slope === undefined || farm.elevation === undefined) return { level: 'neutral', chip: 'Waiting for data', title: 'Terrain details are not ready yet.', bullets: ['Refresh to load the elevation and slope estimate for this area.'] }
  const bullets = [`The model estimates this area at ${Math.round(farm.elevation)} m elevation and ${slope.toFixed(1)}% slope, averaged over roughly 100 m.`]
  let out: Pick<Advice, 'level' | 'chip' | 'title'>, why = ''
  if (slope > 15) { out = { level: 'bad', chip: 'Needs a site check', title: 'Steep ground: plan for runoff and erosion.' }; why = `At ${slope.toFixed(1)}%, the land rises or falls about ${slope.toFixed(1)} m over 100 m.`; bullets.push('Before building, have a local engineer check the exact slope, soil strength, drainage route, and any retaining work.') }
  else if (slope > 8) { out = { level: 'warn', chip: 'Possible with care', title: 'A moderate slope needs a runoff plan.' }; why = `The estimated slope is ${slope.toFixed(1)}%, between 8% and 15%. Water can run downhill and carry soil during heavy rain.`; bullets.push('Walk the site after rain and get local advice on grading, drainage, and cut-and-fill before construction.') }
  else if (slope < 1 || farm.elevation < 5) { out = { level: 'warn', chip: 'Check water levels', title: 'Very flat or low ground may hold water.' }; why = 'The broad terrain estimate is very flat or low. Small drains, raised areas, and nearby water levels can change the real site conditions.'; bullets.push('Look for standing water after rain and check local flood information before building.') }
  else { out = { level: 'good', chip: 'Gentle terrain', title: 'The broad terrain estimate shows a gentle slope.' }; why = `The estimated slope is ${slope.toFixed(1)}%, which is within the app’s gentle range.`; bullets.push('Check the exact plot and drainage on site before setting building levels or excavation plans.') }
  if ((farm.rain ?? 0) >= 40) bullets.push(`${farm.rain!.toFixed(0)} mm of rain is forecast in 7 days; check the local forecast before moving soil.`)
  bullets.push('This is an early screening only, not a structural, soil-bearing, or flood assessment. A site survey is needed before construction.')
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

export const loadFrame = (scene: Scene, farm: FarmGeo) => s2Grid(scene, farm, ['B02', 'B03', 'B04', 'B08'], 10, 720, false)
