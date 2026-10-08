import LogoLoader from './LogoLoader'
import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import buffer from '@turf/buffer'
import { Droplets, X, Zap } from 'lucide-react'
import { BUFFERS, CATS, loadNearby, type CatId, type Feat } from './lib/nearby'
import { farmRing, type FarmData } from './lib/seva'
import { lengthM, type Borewell, type Pipeline } from './lib/assets'

const KEY = 'seva-nearby'
type Prefs = { on: CatId[]; buffers: boolean }
const def: Prefs = { on: ['wells', 'handpumps', 'ponds', 'streams', 'canals', 'pipes', 'poles', 'transformers'], buffers: true }
const dist = (d: number) => (d === 0 ? 'inside your farm' : d < 1000 ? `${Math.round(d)} m from your farm` : `${(d / 1000).toFixed(2)} km from your farm`)
const toLL = (pts: [number, number][]) => pts.map(([lo, la]) => [la, lo] as L.LatLngTuple)

export default function NearbyLayer({ map, farm, open, onClose, mine }: { map: L.Map | null; farm: FarmData & { id: string }; open: boolean; onClose: () => void; mine: { b: Borewell[]; p: Pipeline[] } }) {
  const [prefs, setPrefs] = useState<Prefs>(() => { try { return { ...def, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return def } })
  const [feats, setFeats] = useState<Feat[] | null>(null)
  const [err, setErr] = useState('')
  const [attempt, setAttempt] = useState(0)
  const ring = useMemo(() => farmRing(farm), [farm.id, farm.lat, farm.lon, farm.area, farm.polygon?.length])
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(prefs)) }, [prefs])
  useEffect(() => {
    let dead = false
    setFeats(null); setErr('')
    loadNearby(ring).then(f => { if (!dead) setFeats(f) }).catch(e => { if (!dead) setErr(e instanceof Error ? e.message : 'Could not load') })
    return () => { dead = true }
  }, [ring, attempt])

  const counts = useMemo(() => {
    const c = {} as Record<CatId, { n: number; nearest: number }>
    CATS.forEach(k => (c[k.id] = { n: 0, nearest: Infinity }))
    feats?.forEach(f => { c[f.cat].n++; c[f.cat].nearest = Math.min(c[f.cat].nearest, f.dist) })
    return c
  }, [feats])

  useEffect(() => {
    if (!map) return
    const g = L.layerGroup().addTo(map)
    if (!map.getPane('nearby')) { map.createPane('nearby').style.zIndex = '450' }
    const col = (id: CatId) => CATS.find(c => c.id === id)!.color
    if (prefs.buffers) {
      const poly = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } } as GeoJSON.Feature<GeoJSON.Polygon>
      ;[...BUFFERS].reverse().forEach((d, i) => {
        try {
          const b = buffer(poly, d, { units: 'meters' })
          if (!b) return
          const outer = (b.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][]
          L.polygon(toLL(outer), { pane: 'nearby', color: '#0f172a', weight: 1.4, dashArray: '6 5', fillColor: '#38bdf8', fillOpacity: 0.035 + i * 0.01, interactive: false }).addTo(g)
          const top = outer.reduce((a, p) => (p[1] > a[1] ? p : a), outer[0])
          L.marker([top[1], top[0]], { pane: 'nearby', interactive: false, icon: L.divIcon({ className: 'nb-ring', html: `<span>${d >= 1000 ? d / 1000 + ' km' : d + ' m'}</span>`, iconSize: [48, 16], iconAnchor: [24, 8] }) }).addTo(g)
        } catch { /* skip */ }
      })
      mine.b.forEach(b => [100, 250].forEach(r => L.circle([b.lat, b.lon], { radius: r, pane: 'nearby', color: '#0369a1', weight: 1.2, dashArray: '4 4', fillOpacity: 0.05, interactive: false }).addTo(g)))
      mine.p.forEach(p => { try { [50, 100].forEach(d => { const b = buffer({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: p.pts } } as GeoJSON.Feature<GeoJSON.LineString>, d, { units: 'meters' }); if (b) L.polygon(toLL((b.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][]), { pane: 'nearby', color: '#6366f1', weight: 1.2, dashArray: '4 4', fillOpacity: 0.05, interactive: false }).addTo(g) }) } catch { /* skip */ } })
    }
    L.polygon(toLL(ring), { pane: 'nearby', color: '#f4ffd0', weight: 2.5, fill: false, interactive: false }).addTo(g)
    feats?.filter(f => prefs.on.includes(f.cat)).forEach(f => {
      const c = col(f.cat), tip = `<b>${f.label}</b><br>${dist(f.dist)}`
      if (f.pts.length === 1) L.circleMarker([f.pts[0][1], f.pts[0][0]], { pane: 'nearby', radius: 6, color: '#fff', weight: 1.6, fillColor: c, fillOpacity: 1 }).bindTooltip(tip).addTo(g)
      else if (f.closed) L.polygon(toLL(f.pts), { pane: 'nearby', color: c, weight: 2, fillColor: c, fillOpacity: 0.45 }).bindTooltip(tip, { sticky: true }).addTo(g)
      else L.polyline(toLL(f.pts), { pane: 'nearby', color: c, weight: f.cat === 'lines' ? 2 : 3, dashArray: f.cat === 'lines' ? '2 5' : f.cat === 'pipes' ? '9 5' : undefined }).bindTooltip(tip, { sticky: true }).addTo(g)
    })
    return () => { g.remove() }
  }, [map, feats, prefs, ring, JSON.stringify(mine)])

  const toggle = (id: CatId) => setPrefs(p => ({ ...p, on: p.on.includes(id) ? p.on.filter(x => x !== id) : [...p.on, id] }))
  const all = (kind: 'water' | 'power', on: boolean) => setPrefs(p => { const ids = CATS.filter(c => c.kind === kind).map(c => c.id); return { ...p, on: on ? [...new Set([...p.on, ...ids])] : p.on.filter(x => !ids.includes(x)) } })
  if (!open) return null
  const total = feats?.length ?? 0
  return <div className="ix-panel nb-panel" role="dialog" aria-label="Nearby water and power">
    <div className="ix-panel-head"><strong>Nearby water and power</strong><button aria-label="Close" onClick={onClose}><X size={16}/></button></div>
    <div className="nb-body">
      <p className="nb-lead">{!feats && !err ? 'Looking for water sources and power lines within 1 km of your farm…' : err ? '' : total ? `${total} places found within about 1 km. Dashed rings show distance from your farm edge.` : 'Nothing is mapped within 1 km on OpenStreetMap. Rural places are often under-mapped, so this does not mean there is none. Mark your own borewells and pipelines under Tools.'}</p>
      {err && <div className="nb-err"><LogoLoader state="error" inline size={30} text={err}/><button onClick={() => setAttempt(a => a + 1)}>Try again</button></div>}
      <label className="nb-row nb-buf"><input type="checkbox" checked={prefs.buffers} onChange={e => setPrefs(p => ({ ...p, buffers: e.target.checked }))}/><span><b>Buffer zones</b><small>Rings at {BUFFERS.map(b => (b >= 1000 ? `${b / 1000} km` : `${b} m`)).join(', ')} from the farm edge. Your own borewells and pipelines get rings too.</small></span></label>
      {(['water', 'power'] as const).map(kind => <div key={kind}>
        <div className="nb-h">{kind === 'water' ? <Droplets size={14}/> : <Zap size={14}/>}{kind === 'water' ? 'Water' : 'Power'}<span><button onClick={() => all(kind, true)}>All</button><button onClick={() => all(kind, false)}>None</button></span></div>
        {CATS.filter(c => c.kind === kind).map(c => <label className="nb-row" key={c.id}>
          <input type="checkbox" checked={prefs.on.includes(c.id)} onChange={() => toggle(c.id)}/>
          <i style={{ background: c.color }}/>
          <span><b>{c.name}</b><small>{counts[c.id].n ? `${counts[c.id].n} found · nearest ${counts[c.id].nearest === 0 ? 'inside your farm' : counts[c.id].nearest < 1000 ? Math.round(counts[c.id].nearest) + ' m away' : (counts[c.id].nearest / 1000).toFixed(2) + ' km away'}` : feats ? 'none mapped nearby' : c.note}</small></span>
        </label>)}
      </div>)}
      {mine.p.length > 0 && <small className="nb-foot">Your pipelines: {mine.p.map(p => `${p.name} ${Math.round(lengthM(p.pts))} m`).join(', ')}</small>}
      <small className="nb-foot">Source: © OpenStreetMap contributors, via the Overpass API. Free, no key.</small>
    </div>
  </div>
}
