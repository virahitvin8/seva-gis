import type { Ring } from './raster'

export type CatId = 'wells' | 'handpumps' | 'ponds' | 'streams' | 'canals' | 'pipes' | 'poles' | 'transformers' | 'lines' | 'pumps'
export const CATS: { id: CatId; name: string; color: string; kind: 'water' | 'power'; note: string }[] = [
  { id: 'wells', name: 'Borewells and tube wells', color: '#0284c7', kind: 'water', note: 'Wells and boreholes tagged on OpenStreetMap' },
  { id: 'handpumps', name: 'Hand pumps and taps', color: '#06b6d4', kind: 'water', note: 'Hand pumps, drinking-water points and taps' },
  { id: 'ponds', name: 'Lakes and ponds', color: '#2563eb', kind: 'water', note: 'Still water: lakes, ponds, tanks, reservoirs' },
  { id: 'streams', name: 'Streams and rivers', color: '#38bdf8', kind: 'water', note: 'Natural flowing water' },
  { id: 'canals', name: 'Canals and drains', color: '#0d9488', kind: 'water', note: 'Built channels for irrigation and drainage' },
  { id: 'pipes', name: 'Water pipelines and tanks', color: '#6366f1', kind: 'water', note: 'Pipelines, water towers, water works' },
  { id: 'poles', name: 'Electric poles and towers', color: '#d97706', kind: 'power', note: 'Where the power line can be tapped' },
  { id: 'transformers', name: 'Transformers and substations', color: '#dc2626', kind: 'power', note: 'Needed for a pump motor connection' },
  { id: 'lines', name: 'Farm and power lines', color: '#f97316', kind: 'power', note: 'Overhead lines and minor lines' },
  { id: 'pumps', name: 'Pumps and motors', color: '#9333ea', kind: 'power', note: 'Pumping stations' },
]
export type Feat = { id: string; cat: CatId; label: string; pts: [number, number][]; closed: boolean; dist: number }
export const BUFFERS = [100, 250, 500, 1000]

type Tags = Record<string, string>
function classify(t: Tags, isLine: boolean, isArea: boolean): { cat: CatId; label: string } | null {
  const name = t.name ? ` “${t.name}”` : ''
  if (t.power === 'pole' || t.power === 'tower') return { cat: 'poles', label: `Electric ${t.power}` }
  if (t.power === 'transformer' || t.power === 'substation') return { cat: 'transformers', label: t.power === 'substation' ? 'Substation' : 'Transformer' }
  if (t.power === 'line' || t.power === 'minor_line') return { cat: 'lines', label: t.power === 'line' ? 'Power line' : 'Minor power line' }
  if (t.man_made === 'pumping_station') return { cat: 'pumps', label: `Pumping station${name}` }
  if (t.man_made === 'pipeline') return { cat: 'pipes', label: `${t.substance === 'water' ? 'Water pipeline' : 'Pipeline'}${name}` }
  if (t.man_made === 'water_tower' || t.man_made === 'water_works' || t.man_made === 'storage_tank') return { cat: 'pipes', label: `${t.man_made.replace('_', ' ')}${name}` }
  if (t.man_made === 'water_tap' || t.amenity === 'drinking_water') return { cat: 'handpumps', label: `Water tap${name}` }
  if (t.man_made === 'water_well' || t.man_made === 'borehole') {
    const hand = t.pump === 'manual' || t.pump === 'hand'
    return hand ? { cat: 'handpumps', label: `Hand pump${name}` } : { cat: 'wells', label: `${t.pump === 'powered' ? 'Tube well' : 'Well or borewell'}${name}` }
  }
  if (t.pump === 'manual') return { cat: 'handpumps', label: 'Hand pump' }
  if (t.waterway === 'canal' || t.waterway === 'drain' || t.waterway === 'ditch') return { cat: 'canals', label: `${t.waterway[0].toUpperCase()}${t.waterway.slice(1)}${name}` }
  if (t.waterway === 'stream' || t.waterway === 'river') return { cat: 'streams', label: `${t.waterway[0].toUpperCase()}${t.waterway.slice(1)}${name}` }
  if (t.natural === 'water' || t.landuse === 'reservoir') return { cat: 'ponds', label: `${t.water === 'pond' ? 'Pond' : t.water === 'lake' ? 'Lake' : t.water === 'reservoir' || t.landuse === 'reservoir' ? 'Reservoir' : 'Water body'}${name}` }
  void isLine; void isArea
  return null
}

const lat0 = (r: Ring) => r.reduce((s, p) => s + p[1], 0) / r.length
const proj = (p: [number, number], la: number, lo: number): [number, number] => [(p[0] - lo) * Math.cos((la * Math.PI) / 180) * 111320, (p[1] - la) * 110540]
function inPoly(pt: [number, number], poly: [number, number][]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (((poly[i][1] > pt[1]) !== (poly[j][1] > pt[1])) && pt[0] < ((poly[j][0] - poly[i][0]) * (pt[1] - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c
  return c
}
function segDist(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}
export function distanceToFarm(pts: [number, number][], ring: Ring) {
  const la = lat0(ring), lo = ring.reduce((s, p) => s + p[0], 0) / ring.length
  const poly = ring.map(p => proj(p, la, lo))
  let best = Infinity
  for (const q of pts) {
    const p = proj(q, la, lo)
    if (inPoly(p, poly)) return 0
    for (let i = 0; i < poly.length; i++) best = Math.min(best, segDist(p, poly[i], poly[(i + 1) % poly.length]))
  }
  return best
}

const cache = new Map<string, Promise<Feat[]>>()
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']

export function loadNearby(ring: Ring): Promise<Feat[]> {
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1])
  const padLat = 0.0115, padLon = 0.0115 / Math.cos((lat0(ring) * Math.PI) / 180)
  const bb = [Math.min(...ys) - padLat, Math.min(...xs) - padLon, Math.max(...ys) + padLat, Math.max(...xs) + padLon].map(v => v.toFixed(5)).join(',')
  const hit = cache.get(bb)
  if (hit) return hit
  const head = '[out:json][timeout:25];('
  const qWater = `${head}
nwr["man_made"~"^(water_well|borehole|water_tap|water_tower|water_works|pumping_station|storage_tank)$"](${bb});
node["amenity"="drinking_water"](${bb});
node["pump"](${bb});
way["natural"="water"](${bb});
way["landuse"="reservoir"](${bb});
way["waterway"~"^(stream|river|canal|drain|ditch)$"](${bb});
way["man_made"="pipeline"](${bb});
);out geom 1200;`
  const qPower = `${head}
node["power"~"^(pole|tower|transformer|substation)$"](${bb});
way["power"~"^(line|minor_line|substation)$"](${bb});
);out geom 1200;`
  const fetchOne = async (q: string) => {
    let lastErr: unknown
    for (const url of ENDPOINTS) {
      for (const method of ['POST', 'GET'] as const) {
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 18000)
        try {
          const r = method === 'POST'
            ? await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), signal: ctl.signal })
            : await fetch(`${url}?data=${encodeURIComponent(q)}`, { signal: ctl.signal })
          if (!r.ok) throw new Error(`Map data service answered ${r.status}`)
          const j = await r.json()
          if (!Array.isArray(j.elements)) throw new Error('Map data service sent an unexpected answer')
          return j.elements as Record<string, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
        } catch (err) { lastErr = err } finally { clearTimeout(timer) }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Could not reach the map data service')
  }
  const run = async () => {
    const parts = await Promise.allSettled([fetchOne(qWater), fetchOne(qPower)])
    if (parts.every(p => p.status === 'rejected')) throw new Error('The free OpenStreetMap data service is busy or unreachable right now. Please try again in a minute.')
    const out: Feat[] = []
    for (const part of parts) {
      if (part.status !== 'fulfilled') continue
      for (const e of part.value) {
        const tags: Tags = e.tags ?? {}
        let pts: [number, number][] = []
        if (e.type === 'node') pts = [[e.lon, e.lat]]
        else if (e.geometry) pts = e.geometry.filter(Boolean).map((g: { lon: number; lat: number }) => [g.lon, g.lat])
        else if (e.center) pts = [[e.center.lon, e.center.lat]]
        if (!pts.length) continue
        const closed = pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]
        const c = classify(tags, pts.length > 1, closed)
        if (!c) continue
        out.push({ id: `${e.type}${e.id}`, cat: c.cat, label: c.label, pts, closed, dist: distanceToFarm(pts, ring) })
      }
    }
    return out
  }
  const pr = run()
  cache.set(bb, pr); pr.catch(() => cache.delete(bb))
  return pr
}
