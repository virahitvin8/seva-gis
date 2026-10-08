import LogoLoader from './LogoLoader'
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Footprints, Orbit, Plane, RotateCcw, RotateCw, X } from 'lucide-react'
import { compass } from './lib/indicators'
import { farmBBox, farmRing, type FarmData } from './lib/seva'

type Props = { farm: FarmData & { id: string; name?: string }; onClose: () => void }
type Key = 'f' | 'b' | 'l' | 'r' | 'tl' | 'tr' | 'up' | 'dn'

maplibregl.setWorkerUrl(workerUrl)
const M_LAT = 111320
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const PRESETS = [
  { id: 'walk', label: 'Walk', icon: Footprints, h: 2, pitch: 80, hint: 'Eye level, 2 m above ground' },
  { id: 'drone', label: 'Drone', icon: Plane, h: 60, pitch: 62, hint: 'Low flight, 60 m' },
  { id: 'orbit', label: 'Overview', icon: Orbit, h: 0, pitch: 50, hint: 'Whole farm' },
]

export default function Walk3D({ farm, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [w, s, e, n] = useMemo(() => farmBBox(farm), [farm])
  const centre = useMemo(() => ({ lon: (w + e) / 2, lat: (s + n) / 2 }), [w, s, e, n])
  const sizeM = useMemo(() => Math.max((e - w) * M_LAT * Math.cos((centre.lat * Math.PI) / 180), (n - s) * M_LAT), [w, s, e, n, centre.lat])
  const overviewH = Math.max(80, sizeM * 1.1)
  const cam = useRef({ lon: centre.lon, lat: centre.lat, bearing: 20, pitch: 50, h: overviewH, tgtH: overviewH, tgtPitch: 50 })
  const keys = useRef(new Set<Key>())
  const fast = useRef(false)
  const spin = useRef(false)
  const exag = useRef(1)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [preset, setPreset] = useState('orbit')
  const [tour, setTour] = useState(false)
  const [exaggeration, setExaggeration] = useState(1)
  const [hud, setHud] = useState({ elev: NaN, h: overviewH, bearing: 20, away: 0 })

  useEffect(() => { spin.current = tour }, [tour])
  useEffect(() => { exag.current = exaggeration; if (ready) map.current?.setTerrain({ source: 'dem', exaggeration }) }, [exaggeration, ready])

  useEffect(() => {
    if (!box.current) return
    const ring = farmRing(farm)
    const closed = ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ? [...ring, ring[0]] : ring
    const farmFeature: GeoJSON.Feature<GeoJSON.Polygon> = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [closed] } }
    const dimFeature: GeoJSON.Feature<GeoJSON.Polygon> = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], [...closed].reverse()] } }
    const dem = { type: 'raster-dem' as const, tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium' as const, tileSize: 256, maxzoom: 15, attribution: 'Terrain: Mapzen / AWS Open Data (SRTM, NED, ETOPO1)' }
    let instance: maplibregl.Map
    try {
      instance = new maplibregl.Map({
        container: box.current, interactive: false, maxPitch: 85, maxZoom: 24, canvasContextAttributes: { antialias: true },
        center: [cam.current.lon, cam.current.lat], zoom: 15, pitch: 50, bearing: 20,
        style: {
          version: 8,
          sources: {
            sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
            dem, shade: dem,
            farm: { type: 'geojson', data: farmFeature }, dim: { type: 'geojson', data: dimFeature },
          },
          layers: [
            { id: 'sat', type: 'raster', source: 'sat' },
            { id: 'hill', type: 'hillshade', source: 'shade', paint: { 'hillshade-exaggeration': 0.3, 'hillshade-shadow-color': '#1b2a20', 'hillshade-highlight-color': '#ffffff' } },
            { id: 'dim', type: 'fill', source: 'dim', paint: { 'fill-color': '#07110c', 'fill-opacity': 0.45 } },
            { id: 'edge', type: 'line', source: 'farm', paint: { 'line-color': '#f4ffd0', 'line-width': 2.5 } },
          ],
          terrain: { source: 'dem', exaggeration: 1 },
          sky: { 'sky-color': '#8fc3e8', 'horizon-color': '#e6f0f2', 'fog-color': '#e6f0f2', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.15 },
        },
      })
    } catch { setError('3D view needs WebGL, which this browser or device has switched off.'); return }
    map.current = instance
    instance.on('load', () => setReady(true))
    instance.on('error', ev => { const m = ev.error?.message; if (m && /webgl/i.test(m)) setError('3D view needs WebGL, which this browser or device has switched off.') })

    let last = performance.now(), hudAt = 0, raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.1, (now - last) / 1000); last = now
      const c = cam.current, k = keys.current
      const k1 = 1 - Math.exp(-dt * 5)
      c.h = Math.exp(Math.log(c.h) + (Math.log(c.tgtH) - Math.log(c.h)) * k1)
      c.pitch += (c.tgtPitch - c.pitch) * k1
      if (k.has('tl')) c.bearing -= 70 * dt
      if (k.has('tr')) c.bearing += 70 * dt
      if (k.has('up')) c.tgtH = clamp(c.tgtH * Math.exp(dt * 1.4), 1, 4000)
      if (k.has('dn')) c.tgtH = clamp(c.tgtH * Math.exp(-dt * 1.4), 1, 4000)
      if (spin.current) c.bearing += 8 * dt
      const fwd = (k.has('f') ? 1 : 0) - (k.has('b') ? 1 : 0), side = (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0)
      if (fwd || side) {
        const speed = Math.max(4, c.h * 0.6) * (fast.current ? 4 : 1) * dt, b = (c.bearing * Math.PI) / 180
        const east = Math.sin(b) * fwd + Math.cos(b) * side, north = Math.cos(b) * fwd - Math.sin(b) * side
        c.lon += (east * speed) / (M_LAT * Math.cos((c.lat * Math.PI) / 180)); c.lat += (north * speed) / M_LAT
      }
      const canvasH = box.current?.clientHeight ?? 700
      const pitch = clamp(c.pitch, 0, 85)
      const dist = c.h / Math.max(Math.cos((pitch * Math.PI) / 180), 0.05)
      const mpp = dist / (1.5 * canvasH)
      const zoom = clamp(Math.log2((40075016.686 * Math.cos((c.lat * Math.PI) / 180)) / (512 * mpp)), 0, 24)
      instance.jumpTo({ center: [c.lon, c.lat], bearing: ((c.bearing % 360) + 360) % 360, pitch, zoom })
      if (now - hudAt > 250) {
        hudAt = now
        const el = instance.queryTerrainElevation([c.lon, c.lat])
        const dx = (c.lon - centre.lon) * M_LAT * Math.cos((c.lat * Math.PI) / 180), dy = (c.lat - centre.lat) * M_LAT
        setHud({ elev: el === null || el === undefined ? NaN : el / exag.current, h: c.h, bearing: ((c.bearing % 360) + 360) % 360, away: Math.hypot(dx, dy) })
      }
    }
    raf = requestAnimationFrame(frame)

    const map2key: Record<string, Key> = { w: 'f', s: 'b', a: 'l', d: 'r', arrowleft: 'tl', arrowright: 'tr', arrowup: 'f', arrowdown: 'b', q: 'dn', e: 'up', pagedown: 'dn', pageup: 'up' }
    const down = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { onClose(); return }
      if (ev.key === 'Shift') fast.current = true
      const key = map2key[ev.key.toLowerCase()]
      if (key) { keys.current.add(key); ev.preventDefault() }
    }
    const up = (ev: KeyboardEvent) => { if (ev.key === 'Shift') fast.current = false; const key = map2key[ev.key.toLowerCase()]; if (key) keys.current.delete(key) }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); document.body.style.overflow = overflow; instance.remove(); map.current = null }
  }, [])

  function go(id: string) {
    const p = PRESETS.find(x => x.id === id)!, c = cam.current
    setPreset(id)
    c.tgtPitch = p.pitch; c.tgtH = p.h || overviewH
    if (id === 'orbit') { c.lon = centre.lon; c.lat = centre.lat }
  }
  function hold(key: Key, on: boolean) { if (on) keys.current.add(key); else keys.current.delete(key) }
  const drag = useRef<{ x: number; y: number } | null>(null)
  const pad = (key: Key, icon: ReactElement, label: string) => <button aria-label={label} title={label} onPointerDown={ev => { ev.currentTarget.setPointerCapture(ev.pointerId); hold(key, true) }} onPointerUp={() => hold(key, false)} onPointerCancel={() => hold(key, false)} onLostPointerCapture={() => hold(key, false)}>{icon}</button>

  const eyeLabel = hud.h < 10 ? `${hud.h.toFixed(1)} m` : `${Math.round(hud.h)} m`
  const view = hud.h < 6 ? 'Walking' : hud.h < 150 ? 'Low flight' : 'High view'

  return <div className="w3-modal" role="dialog" aria-label={`3D view of ${farm.name}`}>
    <div className="w3-bar"><strong>{farm.name}</strong><span>3D view of your farm</span>
      <div className="w3-seg">{PRESETS.map(p => <button key={p.id} className={preset === p.id ? 'on' : ''} title={p.hint} onClick={() => go(p.id)}><p.icon size={14}/>{p.label}</button>)}</div>
      <button className={`w3-pill ${tour ? 'on' : ''}`} onClick={() => setTour(!tour)}><RotateCw size={14}/>Auto-rotate</button>
      <button className="w3-x" aria-label="Close 3D view" onClick={onClose}><X size={18}/></button></div>
    <div ref={stage} className="w3-stage"
      onPointerDown={ev => { drag.current = { x: ev.clientX, y: ev.clientY }; ev.currentTarget.setPointerCapture(ev.pointerId) }}
      onPointerMove={ev => { const d = drag.current; if (!d) return; const c = cam.current; c.bearing -= (ev.clientX - d.x) * 0.25; c.tgtPitch = c.pitch = clamp(c.pitch + (ev.clientY - d.y) * 0.25, 0, 85); drag.current = { x: ev.clientX, y: ev.clientY } }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
      onWheel={ev => { cam.current.tgtH = clamp(cam.current.tgtH * Math.exp(ev.deltaY * 0.0015), 1, 4000) }}>
      <div ref={box} className="w3-canvas"/>
      {!ready && !error && <div className="w3-load"><LogoLoader size={84} text="Loading terrain and imagery…"/></div>}
      {error && <div className="w3-load err">{error}</div>}
    </div>

    <div className="w3-hud">
      <div><span>Ground height</span><b>{Number.isFinite(hud.elev) ? `${hud.elev.toFixed(0)} m` : '…'}</b><small>above sea level</small></div>
      <div><span>Your height</span><b>{eyeLabel}</b><small>{view}, above the ground</small></div>
      <div><span>Facing</span><b>{Math.round(hud.bearing)}° {compass(hud.bearing)}</b><small>0° is north</small></div>
      <div><span>Distance from farm centre</span><b>{hud.away < 1000 ? `${Math.round(hud.away)} m` : `${(hud.away / 1000).toFixed(2)} km`}</b><small>{hud.away > sizeM * 0.75 ? 'outside your farm' : 'inside your farm'}</small></div>
    </div>

    <div className="w3-side">
      <div className="w3-group"><label className="w3-row">Relief ×<input type="range" min="1" max="4" step="0.5" value={exaggeration} onChange={ev => setExaggeration(+ev.target.value)}/><em>×{exaggeration}</em></label>
        <small>×1 is true scale. Raise it to see gentle slopes on flat farms.</small></div>
      <div className="w3-group w3-help"><b>Controls</b>
        <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows walk</span><span>Drag to look around</span><span>Scroll or <kbd>Q</kbd><kbd>E</kbd> change eye height</span><span><kbd>Shift</kbd> run</span><span><kbd>Esc</kbd> close</span></div>
    </div>

    <div className="w3-pad">
      <div className="w3-dpad">{pad('f', <ArrowUp size={18}/>, 'Walk forward')}{pad('l', <ArrowLeft size={18}/>, 'Step left')}{pad('b', <ArrowDown size={18}/>, 'Walk back')}{pad('r', <ArrowRight size={18}/>, 'Step right')}</div>
      <div className="w3-turn">{pad('tl', <RotateCcw size={16}/>, 'Turn left')}{pad('tr', <RotateCw size={16}/>, 'Turn right')}</div>
    </div>
    <p className="w3-note">Terrain: AWS Terrain Tiles (about 10-30 m detail). Photos: Esri. Like Google Earth, the ground is real satellite photo on real terrain; trees and buildings are flat.</p>
  </div>
}
