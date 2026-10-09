import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Check, ChevronDown, ChevronUp, Eraser, Flag, Footprints, FileUp, MapPinned, Pencil, Plus, Search, ShieldCheck, Sprout, Undo2 } from 'lucide-react'
import { areaHa, orderRing, parseBoundary, type Ring } from './lib/geo'
import CropSelector, { type CropSelection } from './CropSelector'
import { matchCropSpec } from './lib/cropstages'

export type NewFarm = { name: string; crop: string; ring: Ring }
type Tab = 'draw' | 'walk' | 'corners' | 'file'
const walkerIcon = L.divIcon({
  className: 'walker', iconSize: [44, 56], iconAnchor: [22, 52],
  html: `<div class="wk"><i class="wk-ring"></i><svg viewBox="0 0 44 56" width="44" height="56"><ellipse cx="22" cy="52" rx="11" ry="3" fill="#0004"/><g class="wk-body"><circle cx="22" cy="10" r="7.5" fill="#ffd9a8" stroke="#183e30" stroke-width="2"/><path d="M13.5 8.5c1-6 15-7 17 0-5-2-12-2-17 0z" fill="#183e30"/><circle cx="19.5" cy="10.5" r="1" fill="#183e30"/><circle cx="24.5" cy="10.5" r="1" fill="#183e30"/><path d="M19.5 13.5q2.5 2 5 0" stroke="#183e30" stroke-width="1.3" fill="none" stroke-linecap="round"/><rect x="14" y="18" width="16" height="17" rx="6" fill="#b6f36a" stroke="#183e30" stroke-width="2"/><g class="wk-arm l"><path d="M14 21l-5 10" stroke="#183e30" stroke-width="3.5" stroke-linecap="round"/></g><g class="wk-arm r"><path d="M30 21l5 10" stroke="#183e30" stroke-width="3.5" stroke-linecap="round"/></g><g class="wk-leg l"><path d="M18.5 34l-1 14" stroke="#183e30" stroke-width="4" stroke-linecap="round"/></g><g class="wk-leg r"><path d="M25.5 34l1 14" stroke="#183e30" stroke-width="4" stroke-linecap="round"/></g></g></svg></div>`,
})
const emptyCorners = () => Array.from({ length: 4 }, () => ({ lat: '', lon: '' }))

export default function AddFarm({ onAdd, onError }: { onAdd: (farm: NewFarm) => void; onError: (message: string) => void }) {
  const [tab, setTab] = useState<Tab>('draw')
  const [drawn, setDrawn] = useState<Ring>([])
  const [uploaded, setUploaded] = useState<Ring>([])
  const [walked, setWalked] = useState<Ring>([])
  const [gps, setGps] = useState<{ lat: number; lon: number; acc: number } | null>(null)
  const [gpsMsg, setGpsMsg] = useState('')
  const watchId = useRef<number | null>(null)
  const me = useRef<L.Marker | null>(null)
  const [finished, setFinished] = useState(false)
  const [moving, setMoving] = useState(false)
  const moveTimer = useRef(0)
  const last = useRef<[number, number] | null>(null)
  const [corners, setCorners] = useState(emptyCorners)
  const [name, setName] = useState('')
  const [crop, setCrop] = useState('Paddy')
  const [showCropPicker, setShowCropPicker] = useState(false)
  const [place, setPlace] = useState('')
  const [fileNote, setFileNote] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const tabRef = useRef(tab)
  tabRef.current = tab

  const cornerRing = useMemo<Ring>(() => {
    const pts = corners.map(c => [Number(c.lon), Number(c.lat)] as [number, number]).filter((p, i) => corners[i].lat !== '' && corners[i].lon !== '' && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[1]) <= 90 && Math.abs(p[0]) <= 180)
    return pts.length === 4 ? orderRing(pts) : pts
  }, [corners])
  const ring = tab === 'draw' ? drawn : tab === 'walk' ? walked : tab === 'corners' ? cornerRing : uploaded
  const hectares = areaHa(ring)

  useEffect(() => {
    if (!box.current) return
    const instance = L.map(box.current, { zoomControl: true }).setView([20.5, 79], 4)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 18, attribution: 'Imagery © Esri' }).addTo(instance)
    layer.current = L.layerGroup().addTo(instance)
    instance.on('click', (event: L.LeafletMouseEvent) => { if (tabRef.current === 'draw') setDrawn(current => [...current, [event.latlng.lng, event.latlng.lat]]) })
    map.current = instance
    setTimeout(() => instance.invalidateSize(), 120)
    return () => { instance.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const group = layer.current, instance = map.current
    if (!group || !instance) return
    group.clearLayers()
    const latlngs = ring.map(p => [p[1], p[0]] as L.LatLngTuple)
    if (latlngs.length >= 3) L.polygon(latlngs, { color: '#d4efa4', weight: 2, fillColor: '#3ca852', fillOpacity: .3 }).addTo(group)
    else if (latlngs.length === 2) L.polyline(latlngs, { color: '#d4efa4', weight: 2 }).addTo(group)
    latlngs.forEach(p => L.circleMarker(p, { radius: 5, color: '#fff', weight: 2, fillColor: '#244f3e', fillOpacity: 1 }).addTo(group))
  }, [ring])

  useEffect(() => {
    if (ring.length && tab !== 'draw') map.current?.fitBounds(L.latLngBounds(ring.map(p => [p[1], p[0]] as L.LatLngTuple)), { padding: [30, 30], maxZoom: 16 })
  }, [tab, uploaded, cornerRing.length === 4 ? cornerRing.map(p => p.join()).join() : ''])

  useEffect(() => {
    if (tab !== 'walk' || finished) { if (watchId.current !== null) { navigator.geolocation?.clearWatch(watchId.current); watchId.current = null } me.current?.remove(); me.current = null; return }
    if (!navigator.geolocation) { setGpsMsg('This device has no GPS. Use Draw on map instead.'); return }
    setGpsMsg('Finding your location…')
    let centred = false
    watchId.current = navigator.geolocation.watchPosition(pos => {
      const g = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy }
      setGps(g); setGpsMsg('')
      const m = map.current
      if (!m) return
      if (!me.current) me.current = L.marker([g.lat, g.lon], { icon: walkerIcon, zIndexOffset: 1000, interactive: false }).addTo(m)
      else me.current.setLatLng([g.lat, g.lon])
      const prev = last.current; last.current = [g.lat, g.lon]
      if (prev && (Math.abs(prev[0] - g.lat) > 1e-6 || Math.abs(prev[1] - g.lon) > 1e-6)) {
        setMoving(true); clearTimeout(moveTimer.current); moveTimer.current = window.setTimeout(() => setMoving(false), 2500)
        m.panTo([g.lat, g.lon], { animate: true })
      }
      const el = me.current.getElement(); if (el) el.classList.toggle('walking', true)
      if (!centred) { centred = true; m.setView([g.lat, g.lon], 18) }
    }, err => setGpsMsg(err.code === 1 ? 'Location is blocked. Allow location access in your browser, then try again.' : 'Could not get your location. Go outside or near a window and try again.'), { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 })
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); watchId.current = null; me.current?.remove(); me.current = null }
  }, [tab, finished])

  useEffect(() => { me.current?.getElement()?.classList.toggle('walking', moving) }, [moving])

  function addWaypoint() {
    if (!gps) { onError('Waiting for your GPS position. Try again in a moment.'); return }
    setFinished(false); setWalked(c => [...c, [gps.lon, gps.lat]])
  }

  async function findPlace() {
    if (!place.trim()) return
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`)
      const hit = (await response.json()).results?.[0]
      if (!hit) { onError('Place not found. Try a nearby town name.'); return }
      map.current?.setView([hit.latitude, hit.longitude], 14)
    } catch { onError('Place search is unavailable right now.') }
  }

  async function onFile(file?: File) {
    if (!file) return
    try {
      const parsed = await parseBoundary(file)
      setUploaded(parsed)
      setFileNote(`${file.name}: ${parsed.length} point${parsed.length === 1 ? '' : 's'} read.`)
    } catch (error) { setUploaded([]); setFileNote(''); onError(error instanceof Error ? error.message : 'Could not read this file.') }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!ring.length) { onError(tab === 'draw' ? 'Click the map to place at least 3 boundary points.' : tab === 'walk' ? 'Walk to each corner of your farm and press Add waypoint (at least 3).' : tab === 'corners' ? 'Enter all four corner coordinates.' : 'Upload a boundary file first.'); return }
    if (ring.length === 2) { onError('A boundary needs at least 3 points (or 1 point for a location only).'); return }
    onAdd({ name: name.trim(), crop, ring })
  }

  const setCorner = (index: number, key: 'lat' | 'lon', value: string) => setCorners(current => current.map((c, i) => i === index ? { ...c, [key]: value } : c))
  const tabs: [Tab, string, typeof Pencil][] = [['draw', 'Draw on map', Pencil], ['walk', 'Walk the boundary', Footprints], ['corners', '4 corners', MapPinned], ['file', 'Upload file', FileUp]]

  return <form onSubmit={submit} className="add-farm">
    <label>Farm name<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. My village paddy field"/></label>
    <div className="add-tabs" role="tablist">{tabs.map(([key, text, Icon]) => <button type="button" role="tab" aria-selected={tab === key} key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}><Icon size={14}/>{text}</button>)}</div>
    <div className="add-search"><Search size={14}/><input value={place} onChange={event => setPlace(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); findPlace() } }} placeholder="Find a village or town on the map"/><button type="button" onClick={findPlace}>Go</button></div>
    <div ref={box} className="add-map"/>
    {tab === 'draw' && <div className="add-help"><span>Click the map to outline your farm, one point per corner. Zoom in for accuracy.</span><button type="button" onClick={() => setDrawn(c => c.slice(0, -1))}><Undo2 size={13}/>Undo</button><button type="button" onClick={() => setDrawn([])}><Eraser size={13}/>Clear</button></div>}
    {tab === 'walk' && <div className="add-gps">
      <small>Stand at one corner of your farm and press <b>Add waypoint</b>. Walk along the boundary and add a waypoint at every corner. We join them into your farm shape. Stand still for a few seconds first so the GPS settles.</small>
      <div className="fix">{finished ? `Boundary closed with ${walked.length} corners · ${hectares.toFixed(2)} ha. Name your farm below and save it.` : gpsMsg || (gps ? `Your position: ${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} · accuracy ±${Math.round(gps.acc)} m ${gps.acc <= 10 ? '(good)' : gps.acc <= 30 ? '(okay)' : '(weak, wait a little)'}` : '')}</div>
      <div className="row"><button type="button" className="go" disabled={!gps} onClick={addWaypoint}><Plus size={14}/>Add waypoint ({walked.length})</button><button type="button" className="go fin" disabled={walked.length < 3 || finished} onClick={() => setFinished(true)}><Flag size={14}/>Finish boundary</button><button type="button" onClick={() => { setFinished(false); setWalked(c => c.slice(0, -1)) }}><Undo2 size={13}/>Undo</button><button type="button" onClick={() => { setFinished(false); setWalked([]) }}><Eraser size={13}/>Clear</button></div>
    </div>}
    {tab === 'corners' && <div className="corner-grid">{corners.map((c, i) => <div key={i}><span>Corner {i + 1}</span><input type="number" step="any" min="-90" max="90" placeholder="Latitude" value={c.lat} onChange={event => setCorner(i, 'lat', event.target.value)}/><input type="number" step="any" min="-180" max="180" placeholder="Longitude" value={c.lon} onChange={event => setCorner(i, 'lon', event.target.value)}/></div>)}<small>Any order works; corners are joined automatically. Tip: in Google Maps, right-click a point to copy its coordinates.</small></div>}
    {tab === 'file' && <div className="add-help file"><label className="file-pick"><FileUp size={16}/>Choose shapefile (.zip), GeoJSON, KML, GPX, CSV or WKT<input type="file" accept=".geojson,.json,.kml,.gpx,.csv,.txt,.tsv,.wkt,.zip,.shp" onChange={event => { onFile(event.target.files?.[0]); event.target.value = '' }}/></label><small>{fileNote || 'Works with QGIS, ArcGIS, Google Earth and the Copernicus or USGS download tools. For a shapefile, zip the .shp, .dbf, .shx and .prj together. The first polygon is used.'}</small></div>}
    <div className="add-summary"><b>{ring.length >= 3 ? `${hectares.toFixed(1)} ha` : ring.length === 1 ? 'Point only' : '—'}</b><span>{ring.length} point{ring.length === 1 ? '' : 's'} · analysed from live Sentinel-2</span></div>
    <div className="add-crop-section" style={{ display: 'grid', gap: 8, marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#5a6e4d', fontWeight: 600 }}>Crop / Land classification</span>
        <button
          type="button"
          onClick={() => setShowCropPicker(prev => !prev)}
          style={{
            fontSize: 11,
            color: '#15803d',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 600,
          }}
        >
          <Search size={12} /> {showCropPicker ? 'Close Search' : 'Search & Browse (200+)'}
        </button>
      </div>

      {/* Selected Crop status bar */}
      <div
        onClick={() => setShowCropPicker(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: '#fff',
          border: '1px solid #dbe3d2',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sprout size={16} style={{ color: '#16a34a' }} />
          <b style={{ fontSize: 13, color: '#0f172a' }}>{crop}</b>
          <span style={{ fontSize: 10, background: '#f1f5f9', color: '#475569', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>
            {matchCropSpec(crop).name}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
          {showCropPicker ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </div>

      {/* Quick 1-Click Common Presets Bar */}
      {!showCropPicker && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {[
            'Paddy',
            'Wheat',
            'Chickpea / Gram',
            'Pigeon pea (Tur/Arhar)',
            'Soybean',
            'Cotton',
            'Uncultivated land',
            'Bare land',
          ].map(name => {
            const isSel = crop.toLowerCase().startsWith(name.toLowerCase().split(' ')[0]) || crop === name
            return (
              <button
                key={name}
                type="button"
                onClick={() => setCrop(name)}
                style={{
                  fontSize: 11,
                  padding: '3px 9px',
                  borderRadius: 14,
                  border: isSel ? '1px solid #16a34a' : '1px solid #dbe3d2',
                  background: isSel ? '#dcfce7' : '#fff',
                  color: isSel ? '#15803d' : '#475569',
                  fontWeight: isSel ? 700 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {isSel && <Check size={11} style={{ marginRight: 3 }} />}
                {name}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setShowCropPicker(true)}
            style={{
              fontSize: 11,
              padding: '3px 9px',
              borderRadius: 14,
              border: '1px dashed #94a3b8',
              background: '#f8fafc',
              color: '#334155',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Search / Custom
          </button>
        </div>
      )}

      {/* Full Expandable Crop Selector */}
      {showCropPicker && (
        <CropSelector
          selectedCrop={crop}
          onSelect={(selection) => {
            const chosen = typeof selection === 'string' ? selection : ('crop' in selection ? selection.crop.name : selection.custom)
            setCrop(chosen)
            setShowCropPicker(false)
          }}
          onClose={() => setShowCropPicker(false)}
        />
      )}
    </div>
    <div className="privacy-note"><ShieldCheck size={16}/>Saved on this device only. No account or key needed.</div>
    <button className="primary" type="submit"><Plus size={17}/>Add farm & analyse</button>
  </form>
}
