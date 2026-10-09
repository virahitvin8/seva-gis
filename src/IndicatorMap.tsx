import LogoLoader from './LogoLoader'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { createPortal } from 'react-dom'
import {
  Check, Eye, EyeOff, Box, CircleDot, LocateFixed, Route, Plus, Search,
  SlidersHorizontal, X, Wrench, Move, Globe2, Mountain, Droplets, Layers,
  Lock, LockOpen, MapPin, Map as MapIcon, Ruler, Maximize2, Sparkles, Tag,
  Sliders, ChevronRight
} from 'lucide-react'
import {
  GROUPS, INDICATORS, MEANING, bandFor, bandRange, byId, verdict,
  compass, gradientCss, renderLayer, sampleAt, type Grid, type Layer, type Group
} from './lib/indicators'
import { pixelAt } from './lib/raster'
import { ndviClass } from './lib/agro'
import { addBorewell, addPipeline, lengthM, useAssets } from './lib/assets'
import { generateScoutHotspots, useScoutState, toggleHotspotsOnMap } from './lib/scoutStore'
import NearbyLayer from './NearbyLayer'
import MapKit, { KIT_DEFAULT, type Kit } from './MapKit'
import RulerTape from './RulerTape'
import FloatingLegend, { type LegendClassItem } from './FloatingLegend'
import { farmBBox, farmRing, loadDem, loadScene, type FarmData } from './lib/seva'

type MapFarm = FarmData & { id: string }
type Picked = { lat: number; lon: number; values: Record<string, number> }

const Walk3D = lazy(() => import('./Walk3D'))
const layerCache = new Map<string, Layer>()
const STORE = 'seva-indicators'
const ESRI = (n: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/${n}/MapServer/tile/{z}/{y}/{x}`
const BASES: { id: string; name: string; note: string; sw: string }[] = [
  { id: 'sat', name: 'Satellite', note: 'Photo of the ground (Esri)', sw: 'linear-gradient(135deg,#3b5a2c,#8a7a52)' },
  { id: 'hybrid', name: 'Satellite + names', note: 'Photo with roads and place names', sw: 'linear-gradient(135deg,#3b5a2c,#e8e8e8)' },
  { id: 'original', name: 'Original image', note: 'Latest Sentinel-2 true colour, untouched', sw: 'linear-gradient(135deg,#6f7c4a,#b9a77a)' },
  { id: 'streets', name: 'Streets', note: 'OpenStreetMap roads and places', sw: 'linear-gradient(135deg,#f2efe9,#aad3df)' },
  { id: 'terrain', name: 'Terrain', note: 'Height and landforms (Esri Topo)', sw: 'linear-gradient(135deg,#d9e8c4,#c9b48a)' },
  { id: 'light', name: 'Light', note: 'Quiet pale map', sw: 'linear-gradient(135deg,#f4f4f4,#d4d9dc)' },
  { id: 'dark', name: 'Dark', note: 'Dark map, colours stand out', sw: 'linear-gradient(135deg,#222,#444)' },
]
const BASE_STORE = 'seva-basemap'
const dp = (id: string, d: number) => ({ dem: 0, bw: 0, slope: 1, twi: 1, flow: 1, sink: 1 } as Record<string, number>)[id] ?? d
const fmt = (id: string, v: number) => { const ind = byId(id); return `${v.toFixed(dp(id, 3))}${ind.unit ? ` ${ind.unit}` : ''}` }

export default function IndicatorMap({ farm, loading }: { farm: MapFarm; loading: boolean }) {
  const element = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const frame = useRef<L.LayerGroup | null>(null)
  const marker = useRef<L.CircleMarker | null>(null)
  const overlays = useRef(new Map<string, L.ImageOverlay>())
  const grids = useRef<{ s2?: Grid; dem?: Grid }>({})
  const [active, setActive] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(STORE) || 'null')
      return Array.isArray(v) && v.every(id => INDICATORS.some(i => i.id === id)) ? v : ['ndvi']
    } catch {
      return ['ndvi']
    }
  })
  const [hidden, setHidden] = useState<string[]>([])
  const [opacity, setOpacity] = useState<Record<string, number>>({})
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [panel, setPanel] = useState(false)
  const [baseOpen, setBaseOpen] = useState(false)
  const [nearOpen, setNearOpen] = useState(false)
  const [rulerOpen, setRulerOpen] = useState(false)
  const [rulerActive, setRulerActive] = useState(false)
  const rulerOpenRef = useRef(false)
  rulerOpenRef.current = rulerOpen
  const [base, setBase] = useState(() => localStorage.getItem(BASE_STORE) || 'sat')
  const baseLayers = useRef<L.TileLayer[]>([])
  const [tools, setTools] = useState(false)
  const [aoiOnly, setAoiOnly] = useState(false)
  const [locked, setLocked] = useState(() => localStorage.getItem('seva-map-lock') !== '0')
  const [mapObj, setMapObj] = useState<L.Map | null>(null)
  const [kit, setKit] = useState<Kit>(() => {
    try {
      return { ...KIT_DEFAULT, ...JSON.parse(localStorage.getItem('seva-kit-v2') || '{}') }
    } catch {
      return KIT_DEFAULT
    }
  })
  useEffect(() => { localStorage.setItem('seva-kit-v2', JSON.stringify(kit)) }, [kit])
  const [query, setQuery] = useState('')
  const [dim, setDim] = useState(true)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [view3d, setView3d] = useState(false)
  const [tool, setTool] = useState<'none' | 'borewell' | 'pipeline'>('none')
  const [draft, setDraft] = useState<[number, number][]>([])
  const assets = useAssets()
  const mine = { b: assets.borewells.filter(b => b.farmId === farm.id), p: assets.pipelines.filter(p => p.farmId === farm.id) }
  const toolRef = useRef({ tool, farmId: farm.id, n: mine.b.length })
  toolRef.current = { tool, farmId: farm.id, n: mine.b.length }
  const draftRef = useRef(setDraft)
  const toolSet = useRef(setTool)
  const scene = farm.analysis?.scene
  const geo = `${farm.id}:${farm.lat}:${farm.lon}:${farm.area}:${farm.polygon?.length ?? 0}`

  // GIS Engine Controls: Background mode, Dynamic Range Adjustment (DRA), High-DPI Clarity
  const [bgMode, setBgMode] = useState<'default' | 'black' | 'white'>(() => {
    return (localStorage.getItem('seva-map-bg') as any) || 'default'
  })
  useEffect(() => { localStorage.setItem('seva-map-bg', bgMode) }, [bgMode])

  const [stretchDra, setStretchDra] = useState(() => localStorage.getItem('seva-stretch-dra') === '1')
  useEffect(() => { localStorage.setItem('seva-stretch-dra', stretchDra ? '1' : '0') }, [stretchDra])

  const [renderMode, setRenderMode] = useState<'smooth' | 'crisp'>(() => {
    return (localStorage.getItem('seva-render-mode') as any) || 'smooth'
  })
  useEffect(() => { localStorage.setItem('seva-render-mode', renderMode) }, [renderMode])

  // Dedicated Layers Box (Table of Contents / Symbology manager)
  const [layersBoxOpen, setLayersBoxOpen] = useState(() => localStorage.getItem('seva-lb-open') !== '0')
  useEffect(() => { localStorage.setItem('seva-lb-open', layersBoxOpen ? '1' : '0') }, [layersBoxOpen])

  const [layersBoxTab, setLayersBoxTab] = useState<'active' | 'catalog' | 'symbology' | 'display'>('active')
  const [catalogCat, setCatalogCat] = useState<string>('All')
  const [floatingLegendOpen, setFloatingLegendOpen] = useState(false)

  const layerKey = (id: string) => `${byId(id).source === 'DEM' ? 'dem' : scene?.id}:${geo}:${id}:${renderMode}:${stretchDra ? 'dra' : 'std'}`
  const pickedRef = useRef(setPicked)
  pickedRef.current = setPicked

  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(active)) }, [active])
  useEffect(() => {
    localStorage.setItem('seva-map-lock', locked ? '1' : '0')
    const m = mapObj
    if (!m) return
    const hs = [m.dragging, m.scrollWheelZoom, m.doubleClickZoom, m.touchZoom, m.boxZoom, m.keyboard] as { enable: () => void; disable: () => void }[]
    hs.forEach(h => (locked ? h.disable() : h.enable()))
  }, [locked, mapObj])

  useEffect(() => {
    if (!element.current) return
    const instance = L.map(element.current, { zoomControl: false, attributionControl: true }).setView([farm.lat, farm.lon], 15)
    map.current = instance
    setMapObj(instance)
    L.control.zoom({ position: 'bottomright' }).addTo(instance)
    instance.on('click', (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng
      const t = toolRef.current
      if (t.tool === 'borewell') { addBorewell({ farmId: t.farmId, name: `Borewell ${t.n + 1}`, lat, lon: lng, depth: 90, level: 25, yieldM3h: 5, hours: 6 }); toolSet.current('none'); return }
      if (t.tool === 'pipeline') { draftRef.current(d => [...d, [lng, lat]]); return }
      if (rulerOpenRef.current) return
      const values: Record<string, number> = {}
      let inside = false
      for (const g of [grids.current.s2, grids.current.dem]) {
        if (!g) continue
        const i = pixelAt(g.w, g.h, g.bbox, lng, lat)
        if (i < 0 || !g.inside[i]) continue
        inside = true
        Object.assign(values, sampleAt(g, lng, lat) ?? {})
      }
      marker.current?.remove()
      if (!inside) { pickedRef.current(null); return }
      marker.current = L.circleMarker([lat, lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#183e30', fillOpacity: 1, interactive: false }).addTo(instance)
      pickedRef.current({ lat, lon: lng, values })
    })
    return () => { instance.remove(); map.current = null }
  }, [])

  // Base map tile handling (suppressed when pure solid black or white canvas mode is active)
  useEffect(() => {
    const instance = mapObj
    if (!instance) return
    localStorage.setItem(BASE_STORE, base)
    baseLayers.current.forEach(l => l.remove()); baseLayers.current = []

    // If solid black or white background is active in farm-only mode, keep pure canvas background
    if ((bgMode === 'black' || bgMode === 'white') && aoiOnly) {
      return
    }

    const add = (url: string, attribution: string, o: L.TileLayerOptions = {}) => {
      const l = L.tileLayer(url, { attribution, maxZoom: 20, maxNativeZoom: 16, zIndex: baseLayers.current.length + 1, ...o }).addTo(instance)
      baseLayers.current.push(l)
    }
    const esri = 'Imagery © Esri, Maxar, Earthstar Geographics'
    if (base === 'sat' || base === 'hybrid') {
      add(ESRI('World_Imagery'), esri, { maxNativeZoom: 17, errorTileUrl: '' })
      if (base === 'hybrid') {
        add(ESRI('Reference/World_Transportation'), 'Esri')
        add(ESRI('Reference/World_Boundaries_and_Places'), 'Esri')
      }
    } else if (base === 'streets') {
      add(ESRI('World_Street_Map'), 'Tiles © Esri, HERE, Garmin, OpenStreetMap contributors', { maxNativeZoom: 19 })
    } else if (base === 'terrain') {
      add(ESRI('World_Topo_Map'), 'Tiles © Esri, USGS, NOAA', { maxNativeZoom: 17 })
    } else if (base === 'light') {
      add(ESRI('Canvas/World_Light_Gray_Base'), 'Tiles © Esri, HERE, Garmin', { maxNativeZoom: 16 })
    } else if (base === 'dark') {
      add(ESRI('Canvas/World_Dark_Gray_Base'), 'Tiles © Esri, HERE, Garmin', { maxNativeZoom: 16 })
    } else if (base === 'original') {
      if (scene) {
        [scene.id, ...(scene.ids ?? [])].forEach(id => add(`https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@2x?collection=sentinel-2-l2a&item=${id}&assets=B04&assets=B03&assets=B02&nodata=0&rescale=1000%2C3800&color_formula=gamma%20RGB%201.9%2C%20saturation%201.2%2C%20sigmoidal%20RGB%204%200.45&format=png`, 'Contains modified Copernicus Sentinel data · Microsoft Planetary Computer', { maxNativeZoom: 15, maxZoom: 20 }))
      } else {
        add('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/g/{z}/{y}/{x}.jpg', 'Sentinel-2 cloudless © EOX (Copernicus Sentinel data 2021)', { maxNativeZoom: 13, maxZoom: 20 })
      }
    }
    return () => { baseLayers.current.forEach(l => l.remove()); baseLayers.current = [] }
  }, [mapObj, base, scene?.id, scene?.ids?.join(), bgMode, aoiOnly])

  // Boundary frame and Solid Black / Solid White exterior canvas
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const [w, s, e, n] = farmBBox(farm)
    const ring = farmRing(farm).map(p => [p[1], p[0]] as L.LatLngTuple)
    const group = L.layerGroup().addTo(instance)
    frame.current = group

    if (element.current) {
      if (bgMode === 'black') element.current.style.backgroundColor = '#000000'
      else if (bgMode === 'white') element.current.style.backgroundColor = '#ffffff'
      else element.current.style.backgroundColor = '#0b1a13'
    }

    if (bgMode === 'black') {
      // Solid Black background outside farm boundary (Google Earth Engine style)
      L.polygon([[[-85, -180], [-85, 180], [85, 180], [85, -180]], ring], {
        stroke: false,
        fillColor: '#000000',
        fillOpacity: 1.0,
        interactive: false
      }).addTo(group)
      L.polygon(ring, { color: '#22c55e', weight: 2.8, fill: false, interactive: false }).addTo(group)
    } else if (bgMode === 'white') {
      // Solid White background outside farm boundary (QGIS / ArcMap Print Layout style)
      L.polygon([[[-85, -180], [-85, 180], [85, 180], [85, -180]], ring], {
        stroke: false,
        fillColor: '#ffffff',
        fillOpacity: 1.0,
        interactive: false
      }).addTo(group)
      L.polygon(ring, { color: '#15803d', weight: 2.8, fill: false, interactive: false }).addTo(group)
    } else {
      // Standard view with surroundings
      if (dim || aoiOnly) {
        L.polygon([[[-85, -180], [-85, 180], [85, 180], [85, -180]], ring], {
          stroke: false,
          fillColor: '#07110c',
          fillOpacity: aoiOnly ? 0.95 : 0.62,
          interactive: false
        }).addTo(group)
      }
      L.polygon(ring, { color: '#f4ffd0', weight: 2.5, fill: false, interactive: false }).addTo(group)
    }

    if (aoiOnly) {
      instance.fitBounds(L.latLngBounds([s, w], [n, e]), { padding: [10, 10], maxZoom: 19 })
    } else {
      instance.fitBounds(L.latLngBounds([s, w], [n, e]), { padding: [70, 70], maxZoom: 17 })
    }
    return () => { group.remove(); frame.current = null }
  }, [geo, dim, bgMode, aoiOnly])

  useEffect(() => {
    overlays.current.forEach(o => o.remove()); overlays.current.clear()
    grids.current = {}; marker.current?.remove(); setPicked(null); setErrors({})
  }, [geo, scene?.id])

  // Fetch and render high resolution raster grids
  useEffect(() => {
    let dead = false
    const missing = active.filter(id => !layerCache.has(layerKey(id)) && (byId(id).source === 'DEM' || scene))
    const needS2 = active.some(id => byId(id).source === 'S2') && scene
    const needDem = active.some(id => byId(id).source === 'DEM')
    ;(async () => {
      const ring = farmRing(farm)
      if (needS2) { try { grids.current.s2 = await loadScene(scene!, farm) } catch (e) { fail('S2', e) } }
      if (needDem) { try { grids.current.dem = await loadDem(farm) } catch (e) { fail('DEM', e) } }
      for (const id of missing) {
        const ind = byId(id), g = ind.source === 'DEM' ? grids.current.dem : grids.current.s2
        if (!g) continue
        setBusy(b => [...b, id])
        await new Promise(r => setTimeout(r, 0))
        try {
          layerCache.set(
            layerKey(id),
            renderLayer(ind, g, ring, {
              smooth: renderMode === 'smooth',
              dra: stretchDra,
              sharpen: renderMode === 'smooth' ? 0.35 : 0
            })
          )
          if (!dead) setErrors(x => { const { [id]: _drop, ...rest } = x; return rest })
        } catch (e) {
          fail(id, e)
        }
        if (!dead) setBusy(b => b.filter(x => x !== id))
      }
      if (!dead) setTick(t => t + 1)
    })()
    function fail(id: string, e: unknown) {
      if (dead) return
      const message = e instanceof Error ? e.message : 'Could not load data'
      const targets = id === 'S2' ? active.filter(x => byId(x).source === 'S2') : id === 'DEM' ? active.filter(x => byId(x).source === 'DEM') : [id]
      setErrors(x => Object.fromEntries([...Object.entries(x), ...targets.map(t => [t, message])]))
    }
    return () => { dead = true }
  }, [active.join(), geo, scene?.id, renderMode, stretchDra])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const [w, s, e, n] = farmBBox(farm)
    const bounds = L.latLngBounds([s, w], [n, e])
    const wanted = new Set<string>()
    active.forEach((id, index) => {
      const layer = layerCache.get(layerKey(id))
      if (!layer || hidden.includes(id)) return
      wanted.add(id)
      let overlay = overlays.current.get(id)
      if (!overlay) { overlay = L.imageOverlay(layer.url, bounds, { interactive: false, zIndex: 300 + index }).addTo(instance); overlays.current.set(id, overlay) }
      overlay.setOpacity(opacity[id] ?? (layer.ind.rgb || id === 'hillshade' ? 1 : 0.92))
      overlay.setZIndex(300 + index)
    })
    overlays.current.forEach((o, id) => { if (!wanted.has(id)) { o.remove(); overlays.current.delete(id) } })
  }, [active.join(), hidden.join(), JSON.stringify(opacity), tick, geo, scene?.id, renderMode, stretchDra])

  useEffect(() => { if (element.current) element.current.style.cursor = tool === 'none' ? '' : 'crosshair' }, [tool])
  useEffect(() => {
    if (tool === 'none') return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setTool('none'); setDraft([]) } }
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc)
  }, [tool])
  useEffect(() => { setTool('none'); setDraft([]) }, [farm.id])
  useEffect(() => {
    const m = map.current
    if (!m) return
    const g = L.layerGroup().addTo(m)
    mine.b.forEach(b => L.marker([b.lat, b.lon], { icon: L.divIcon({ className: 'ix-bw-pin', html: '<span></span>', iconSize: [24, 24] }), keyboard: false }).bindTooltip(`${b.name} · ${b.yieldM3h} m³/h · ${b.depth} m deep`).addTo(g))
    mine.p.forEach(p => L.polyline(p.pts.map(([lo, la]) => [la, lo] as L.LatLngTuple), { color: '#38bdf8', weight: 4, dashArray: '9 6', opacity: 0.95 }).bindTooltip(`${p.name} · ${Math.round(lengthM(p.pts))} m · Ø${p.dia} mm`, { sticky: true }).addTo(g))
    if (draft.length) { L.polyline(draft.map(([lo, la]) => [la, lo] as L.LatLngTuple), { color: '#fde047', weight: 3, dashArray: '4 6' }).addTo(g); draft.forEach(([lo, la]) => L.circleMarker([la, lo], { radius: 4, color: '#fde047', fillColor: '#fde047', fillOpacity: 1, interactive: false }).addTo(g)) }
    return () => { g.remove() }
  }, [JSON.stringify(mine), JSON.stringify(draft)])

  function finishPipe() {
    if (draft.length >= 2) addPipeline({ farmId: farm.id, name: `Pipeline ${mine.p.length + 1}`, pts: draft, dia: 63, flow: 10 })
    setDraft([]); setTool('none')
  }

  const toggle = (id: string) => setActive(a => (a.includes(id) ? a.filter(x => x !== id) : [...a, id]))
  const topLegend = [...active].reverse().find(id => !hidden.includes(id) && layerCache.get(layerKey(id)))
  const topLayer = topLegend ? layerCache.get(layerKey(topLegend)) : undefined
  const results = useMemo(() => INDICATORS.filter(i => `${i.name} ${i.desc} ${i.group}`.toLowerCase().includes(query.toLowerCase())), [query])
  const date = scene ? new Date(scene.datetime).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const cls = picked?.values.ndvi !== undefined ? ndviClass(picked.values.ndvi) : null

  // Zoom stretch handler
  const handleZoomStretch = () => {
    setAoiOnly(true)
    const instance = map.current
    if (!instance) return
    const [w, s, e, n] = farmBBox(farm)
    instance.fitBounds(L.latLngBounds([s, w], [n, e]), { padding: [10, 10], maxZoom: 19, animate: true })
  }

  const handleResetView = () => {
    setAoiOnly(false)
    const instance = map.current
    if (!instance) return
    const [w, s, e, n] = farmBBox(farm)
    instance.fitBounds(L.latLngBounds([s, w], [n, e]), { padding: [70, 70], maxZoom: 17, animate: true })
  }

  // Floating movable legend data items
  const floatingItems: LegendClassItem[] = useMemo(() => {
    if (!topLegend || !MEANING[topLegend]) return []
    return MEANING[topLegend].map((b, i) => ({
      id: i,
      name: b.label,
      color: b.color,
      note: bandRange(topLegend, i)
    }))
  }, [topLegend])

  const scoutState = useScoutState()
  const scoutSpots = useMemo(() => generateScoutHotspots(farm), [farm.lat, farm.lon])

  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!scoutState.showOnMap) return
    const g = L.layerGroup().addTo(m)
    scoutSpots.forEach((s) => {
      const isFocused = scoutState.focusedSpotId === s.id
      const icon = L.divIcon({
        className: 'scout-map-pin-container',
        html: `<div class="scout-map-pin ${s.priority.toLowerCase()} ${isFocused ? 'focused' : ''}"><span>#${s.id}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      const marker = L.marker([s.lat, s.lon], { icon, zIndexOffset: isFocused ? 1000 : 500 }).addTo(g)
      const popupHtml = `
        <div class="scout-popup">
          <div class="scout-popup-header">
            <span class="scout-popup-badge ${s.priority.toLowerCase()}">Spot #${s.id} · ${s.priority} Priority</span>
            <span class="scout-popup-ndvi">NDVI ${s.ndvi}</span>
          </div>
          <b class="scout-popup-title">${s.signature}</b>
          <p class="scout-popup-action"><b>Scout Action:</b> ${s.inspection}</p>
          <div class="scout-popup-meta">
            <span>🧭 ${s.distM} m ${s.bearing} (${s.degree}°)</span>
            <a href="https://www.google.com/maps?q=${s.lat},${s.lon}" target="_blank" rel="noreferrer" class="scout-walk-link">Walk with GPS ↗</a>
          </div>
        </div>
      `
      marker.bindPopup(popupHtml, { minWidth: 240, maxWidth: 300, className: 'scout-custom-popup' })
      if (isFocused) {
        marker.openPopup()
        m.panTo([s.lat, s.lon], { animate: true, duration: 0.5 })
      }
    })
    return () => { g.remove() }
  }, [mapObj, scoutState.showOnMap, scoutState.focusedSpotId, scoutSpots])

  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => { setSlot(document.getElementById('legend-slot')) }, [])

  return (
    <div className="ix-outer">
      <div className="ix-wrap">
        <div ref={element} className={`field-map${locked ? ' is-locked' : ''}`} />

        <button
          className={`ix-lock${locked ? ' on' : ''}`}
          aria-pressed={locked}
          aria-label={locked ? 'Map locked. Click to unlock' : 'Map unlocked. Click to lock'}
          title={locked ? 'Map is locked so it cannot move. Click to unlock and adjust.' : 'Map is unlocked. Move and zoom, then click to lock it again.'}
          onClick={() => setLocked(!locked)}
        >
          {locked ? <Lock size={17}/> : <LockOpen size={17}/>}
          <span>{locked ? 'Locked' : 'Unlocked'}</span>
        </button>

        {/* Top Control Toolbar */}
        <div className="ix-top">
          {/* 1. Dedicated GIS Layers Box Toggle */}
          <button
            className={`ix-add ix-lb-btn ${layersBoxOpen ? 'on' : ''}`}
            onClick={() => { setLayersBoxOpen(!layersBoxOpen); setPanel(false); setTools(false); setBaseOpen(false); setNearOpen(false); setRulerOpen(false) }}
            title="Open GIS Layers Box: All parameters, maps & symbology"
          >
            <Layers size={16}/>
            <span>Layers Box</span>
            <b>{active.length}</b>
          </button>

          {/* 2. Farm Background Selector (Enabled after selecting farm) */}
          <div className="ix-bg-bar" role="group" aria-label="Farm Background Mode">
            <span className="ix-bg-lbl">Background:</span>
            <button
              className={`ix-bg-btn btn-blk ${bgMode === 'black' ? 'on' : ''}`}
              onClick={() => setBgMode('black')}
              title="Solid Black background (Google Earth Engine dark canvas mode)"
            >
              <span className="dot-blk" />
              <span>Black</span>
            </button>
            <button
              className={`ix-bg-btn btn-wht ${bgMode === 'white' ? 'on' : ''}`}
              onClick={() => setBgMode('white')}
              title="Solid White background (QGIS & ArcMap layout view mode)"
            >
              <span className="dot-wht" />
              <span>White</span>
            </button>
            <button
              className={`ix-bg-btn ${bgMode === 'default' ? 'on' : ''}`}
              onClick={() => setBgMode('default')}
              title="Standard basemap (Satellite, Streets or Terrain)"
            >
              <Globe2 size={13} />
              <span>Map</span>
            </button>
          </div>

          {/* 3. Zoom Stretch Farm View */}
          <button
            className={`ix-add ix-stretch-btn ${aoiOnly ? 'on' : ''}`}
            onClick={aoiOnly ? handleResetView : handleZoomStretch}
            title={aoiOnly ? "Reset view: Show surroundings with standard padding" : "Zoom Stretch: Fit 100% of farm boundary tightly to canvas"}
          >
            <Maximize2 size={14} />
            <span>{aoiOnly ? "Fit Area" : "Zoom Stretch"}</span>
          </button>

          {/* Base map picker */}
          <button className="ix-add" onClick={() => { setBaseOpen(!baseOpen); setLayersBoxOpen(false); setPanel(false); setTools(false); setNearOpen(false); setRulerOpen(false) }}>
            <MapIcon size={15}/>
            <span>Base map</span>
            <b>{BASES.find(b => b.id === base)?.name.split(' ')[0]}</b>
          </button>

          {/* Tools */}
          <button className="ix-add ix-tools-btn" onClick={() => { setTools(!tools); setLayersBoxOpen(false); setPanel(false); setRulerOpen(false) }}>
            <Wrench size={15}/>
            <span>Tools</span>
            <b>{mine.b.length + mine.p.length}</b>
          </button>

          {/* Ruler / Tape */}
          <button
            className={`ix-add ${rulerOpen ? 'on' : ''}`}
            style={rulerOpen ? { background: '#fef08a', borderColor: '#eab308', color: '#854d0e', fontWeight: 650 } : {}}
            onClick={() => {
              setRulerOpen(!rulerOpen)
              setLayersBoxOpen(false)
              setPanel(false)
              setTools(false)
              setBaseOpen(false)
              setNearOpen(false)
            }}
            title="Google Earth Pro style Ruler & Metered Tape Measure"
          >
            <Ruler size={15}/>
            <span>Ruler</span>
            <b>{rulerActive ? 'Measuring' : 'Tape'}</b>
          </button>

          {/* Scout Hotspots */}
          <button
            className={`ix-add ${scoutState.showOnMap ? 'on' : ''}`}
            style={scoutState.showOnMap ? { background: '#fee2e2', borderColor: '#ef4444', color: '#b91c1c' } : {}}
            onClick={() => { toggleHotspotsOnMap(); setRulerOpen(false); }}
            title="Mark and show Scout Hotspot target pins on the map"
          >
            <MapPin size={15}/>
            <span>Hotspots</span>
            <b>{scoutSpots.length}</b>
          </button>
        </div>

        {/* Floating Movable Legend Shortcut */}
        {floatingLegendOpen && topLayer && (
          <FloatingLegend
            title={`${topLayer.ind.name} Symbology`}
            subtitle={`${topLayer.ind.desc} · Farm mean: ${topLayer.stat ? fmt(topLayer.ind.id, topLayer.stat.mean) : '—'}`}
            items={floatingItems}
            unit={topLayer.ind.unit}
            onClose={() => setFloatingLegendOpen(false)}
          />
        )}

        {/* THE INTEGRATED GIS LAYERS BOX */}
        {layersBoxOpen && (
          <div className="ix-layers-box" role="dialog" aria-label="GIS Layers & Symbology Box">
            <div className="ix-lb-header">
              <div className="ix-lb-title">
                <Layers size={17} className="text-emerald-400" />
                <div>
                  <strong>Layers & Symbology Box</strong>
                  <small>Sentinel-2 10m · QGIS & Earth Engine Precision</small>
                </div>
              </div>
              <div className="ix-lb-actions">
                <button
                  className={`ix-lb-tool-btn ${stretchDra ? 'active' : ''}`}
                  title={stretchDra ? "Dynamic Range Stretch (DRA) is ON (p10-p90 intra-field stretch)" : "Turn ON Dynamic Range Adjustment (DRA) for high intra-field contrast"}
                  onClick={() => setStretchDra(!stretchDra)}
                >
                  <Sliders size={13} />
                  <span>{stretchDra ? "DRA On" : "DRA Off"}</span>
                </button>
                <button
                  className={`ix-lb-tool-btn ${renderMode === 'smooth' ? 'active' : ''}`}
                  title={renderMode === 'smooth' ? "Bicubic High-DPI Smooth Rendering" : "Crisp Native 10m Pixel Grid"}
                  onClick={() => setRenderMode(renderMode === 'smooth' ? 'crisp' : 'smooth')}
                >
                  <Sparkles size={13} />
                  <span>{renderMode === 'smooth' ? "Smooth" : "10m Grid"}</span>
                </button>
                <button className="ix-lb-close" onClick={() => setLayersBoxOpen(false)} aria-label="Close Layers Box">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="ix-lb-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={layersBoxTab === 'active'}
                className={layersBoxTab === 'active' ? 'active' : ''}
                onClick={() => setLayersBoxTab('active')}
              >
                <Layers size={13} />
                <span>Active Layers ({active.length})</span>
              </button>
              <button
                role="tab"
                aria-selected={layersBoxTab === 'catalog'}
                className={layersBoxTab === 'catalog' ? 'active' : ''}
                onClick={() => setLayersBoxTab('catalog')}
              >
                <Plus size={13} />
                <span>All Parameters ({INDICATORS.length})</span>
              </button>
              <button
                role="tab"
                aria-selected={layersBoxTab === 'symbology'}
                className={layersBoxTab === 'symbology' ? 'active' : ''}
                onClick={() => setLayersBoxTab('symbology')}
              >
                <Tag size={13} />
                <span>Symbology Key</span>
              </button>
              <button
                role="tab"
                aria-selected={layersBoxTab === 'display'}
                className={layersBoxTab === 'display' ? 'active' : ''}
                onClick={() => setLayersBoxTab('display')}
              >
                <Maximize2 size={13} />
                <span>Display & Stretch</span>
              </button>
            </div>

            {/* Tab 1: Active Layers with live Symbology */}
            {layersBoxTab === 'active' && (
              <div className="ix-lb-content">
                <div className="ix-lb-active-list">
                  {active.map(id => {
                    const ind = byId(id)
                    const layer = layerCache.get(layerKey(id))
                    const off = hidden.includes(id)
                    const waiting = ind.source === 'S2' && !scene
                    const vd = layer?.stat ? verdict(id, layer.stat.mean) : null
                    return (
                      <div key={id} className={`ix-lb-card ${off ? 'off' : ''}`}>
                        <div className="ix-lb-card-top">
                          <span
                            className="ix-swatch"
                            style={{ background: ind.ramp ? gradientCss(ind.ramp) : 'linear-gradient(90deg,#3c6a4a,#c8a15a,#e4e4e4)' }}
                          />
                          <div className="ix-lb-card-meta">
                            <strong>{ind.name}</strong>
                            <span className="ix-lb-badge">{ind.source === 'S2' ? 'Sentinel-2 10m' : 'Copernicus 30m'}</span>
                          </div>
                          {vd && <span className={`ix-vd-chip ${vd.tone}`}>{vd.word}</span>}
                          <div className="ix-lb-card-ops">
                            <button
                              aria-label={off ? "Show layer" : "Hide layer"}
                              title={off ? "Show on map" : "Hide from map"}
                              onClick={() => setHidden(h => (off ? h.filter(x => x !== id) : [...h, id]))}
                            >
                              {off ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button
                              aria-label={`Remove ${ind.name}`}
                              title="Remove layer"
                              onClick={() => toggle(id)}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Symbology Scale and Values */}
                        <div className="ix-lb-symbology">
                          {ind.ramp && layer?.range ? (
                            <div className="ix-lb-scale-wrap">
                              <div className="ix-lb-bar" style={{ background: gradientCss(ind.ramp) }} />
                              <div className="ix-lb-scale-labels">
                                <span>{layer.range[0].toFixed(dp(id, 1))}</span>
                                <span>{((layer.range[0] + layer.range[1]) / 2).toFixed(dp(id, 2))}</span>
                                <span>{layer.range[1].toFixed(dp(id, 1))}{ind.unit ?? ''}</span>
                              </div>
                            </div>
                          ) : (
                            <small className="ix-lb-rgb-note">{ind.rgb ? 'True RGB Surface Reflectance' : 'Relief Hillshade'}</small>
                          )}
                          <div className="ix-lb-stat-row">
                            <span>Farm mean: <b>{waiting ? 'waiting for scene' : busy.includes(id) || !layer ? 'loading…' : layer.stat ? fmt(id, layer.stat.mean) : 'composite'}</b></span>
                            {layer?.stat && (
                              <small>min {fmt(id, layer.stat.min)} · max {fmt(id, layer.stat.max)}</small>
                            )}
                          </div>
                        </div>

                        {/* Opacity Control */}
                        <div className="ix-lb-opacity-row">
                          <label>Opacity: {Math.round((opacity[id] ?? 0.92) * 100)}%</label>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.05"
                            value={opacity[id] ?? 0.92}
                            onChange={e => setOpacity(o => ({ ...o, [id]: Number(e.target.value) }))}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {active.length === 0 && (
                    <div className="ix-lb-empty">
                      <Layers size={28} className="opacity-40" />
                      <p>No active layers on the map.</p>
                      <button className="primary compact" onClick={() => setLayersBoxTab('catalog')}>
                        <Plus size={14} /> Browse Parameters Catalog
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: All Parameters Library */}
            {layersBoxTab === 'catalog' && (
              <div className="ix-lb-content">
                <div className="ix-lb-search-bar">
                  <Search size={14} />
                  <input
                    placeholder="Search NDVI, moisture, DEM, True Colour..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                  {query && <button onClick={() => setQuery('')}><X size={12} /></button>}
                </div>

                <div className="ix-lb-cat-pills">
                  {['All', ...GROUPS].map(cat => (
                    <button
                      key={cat}
                      className={catalogCat === cat ? 'active' : ''}
                      onClick={() => setCatalogCat(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="ix-lb-catalog-list">
                  {INDICATORS.filter(ind => {
                    const matchCat = catalogCat === 'All' || ind.group === catalogCat
                    const matchQ = `${ind.name} ${ind.desc} ${ind.group}`.toLowerCase().includes(query.toLowerCase())
                    return matchCat && matchQ
                  }).map(ind => {
                    const isOn = active.includes(ind.id)
                    return (
                      <div key={ind.id} className={`ix-lb-cat-item ${isOn ? 'on' : ''}`}>
                        <span
                          className="ix-swatch"
                          style={{ background: ind.ramp ? gradientCss(ind.ramp) : 'linear-gradient(90deg,#3c6a4a,#c8a15a,#e4e4e4)' }}
                        />
                        <div className="ix-lb-cat-info">
                          <div className="ix-lb-cat-name">
                            <b>{ind.name}</b>
                            <span className="ix-cat-pill">{ind.group}</span>
                          </div>
                          <small>{ind.desc}</small>
                        </div>
                        <button
                          className={`ix-lb-toggle-btn ${isOn ? 'remove' : 'add'}`}
                          onClick={() => toggle(ind.id)}
                          title={isOn ? "Remove from map" : "Add to map"}
                        >
                          {isOn ? <Check size={14} /> : <Plus size={14} />}
                          <span>{isOn ? 'Active' : 'Add'}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tab 3: Symbology Key & Meaning */}
            {layersBoxTab === 'symbology' && (
              <div className="ix-lb-content">
                {topLayer ? (
                  <div className="ix-lb-sym-full">
                    <div className="ix-lb-sym-header">
                      <strong>{topLayer.ind.name} Symbology Key</strong>
                      <small>{topLayer.ind.desc}</small>
                    </div>

                    {topLayer.ind.ramp && topLayer.range && (
                      <div className="ix-lb-sym-gradient-box">
                        <div className="ix-lb-bar" style={{ background: gradientCss(topLayer.ind.ramp) }} />
                        <div className="ix-lb-scale-labels">
                          <span>{topLayer.range[0].toFixed(dp(topLayer.ind.id, 1))}</span>
                          <span>{((topLayer.range[0] + topLayer.range[1]) / 2).toFixed(dp(topLayer.ind.id, 2))}</span>
                          <span>{topLayer.range[1].toFixed(dp(topLayer.ind.id, 1))}{topLayer.ind.unit ?? ''}</span>
                        </div>
                      </div>
                    )}

                    {MEANING[topLayer.ind.id] && (
                      <div className="ix-lb-classes-list">
                        <h4>Agronomic Classes & Thresholds</h4>
                        {MEANING[topLayer.ind.id].map((b, i) => (
                          <div key={b.label} className="ix-lb-class-row">
                            <span className="ix-lb-color-dot" style={{ background: b.color }} />
                            <span className="ix-lb-class-name">{b.label}</span>
                            <code>{bandRange(topLayer.ind.id, i)}</code>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="ix-lb-sym-actions">
                      <button
                        className="ix-lb-action-btn"
                        onClick={() => setFloatingLegendOpen(!floatingLegendOpen)}
                      >
                        <Tag size={14} />
                        <span>{floatingLegendOpen ? 'Hide Movable Legend' : 'Open Movable Legend on Map'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ix-lb-empty">
                    <Tag size={28} className="opacity-40" />
                    <p>No active layer selected for symbology inspection.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Display & Stretch Settings */}
            {layersBoxTab === 'display' && (
              <div className="ix-lb-content">
                <div className="ix-lb-settings-group">
                  <h4>Farm Background Canvas</h4>
                  <p className="ix-settings-desc">Choose solid Black or White background for maximum clarity and high-contrast farm boundary inspection.</p>
                  <div className="ix-settings-btns">
                    <button
                      className={`ix-sett-btn ${bgMode === 'black' ? 'on' : ''}`}
                      onClick={() => setBgMode('black')}
                    >
                      <span className="dot-blk" />
                      <span>Solid Black (GEE)</span>
                    </button>
                    <button
                      className={`ix-sett-btn ${bgMode === 'white' ? 'on' : ''}`}
                      onClick={() => setBgMode('white')}
                    >
                      <span className="dot-wht" />
                      <span>Solid White (QGIS Print)</span>
                    </button>
                    <button
                      className={`ix-sett-btn ${bgMode === 'default' ? 'on' : ''}`}
                      onClick={() => setBgMode('default')}
                    >
                      <Globe2 size={13} />
                      <span>Map / Satellite</span>
                    </button>
                  </div>
                </div>

                <div className="ix-lb-settings-group">
                  <h4>Zoom & Bounds Stretch</h4>
                  <p className="ix-settings-desc">Stretch the farm to occupy 100% of the canvas view without wasted exterior borders.</p>
                  <div className="ix-settings-btns">
                    <button
                      className={`ix-sett-btn ${aoiOnly ? 'on' : ''}`}
                      onClick={handleZoomStretch}
                    >
                      <Maximize2 size={13} />
                      <span>Zoom Stretch Farm Only</span>
                    </button>
                    <button
                      className={`ix-sett-btn ${!aoiOnly ? 'on' : ''}`}
                      onClick={handleResetView}
                    >
                      <Move size={13} />
                      <span>Standard Whole Map</span>
                    </button>
                  </div>
                </div>

                <div className="ix-lb-settings-group">
                  <h4>Radiometric Dynamic Range (DRA)</h4>
                  <p className="ix-settings-desc">Stretch the color scale dynamically to the {"farm's"} exact pixel min and max (p10 to p90), maximizing intra-field contrast.</p>
                  <button
                    className={`ix-sett-btn full ${stretchDra ? 'on' : ''}`}
                    onClick={() => setStretchDra(!stretchDra)}
                  >
                    <Sliders size={13} />
                    <span>Dynamic Range Adjustment: {stretchDra ? 'Enabled (p10-p90 Stretch)' : 'Standard Full Scale'}</span>
                  </button>
                </div>

                <div className="ix-lb-settings-group">
                  <h4>Rendering Clarity & Resampling</h4>
                  <p className="ix-settings-desc">Toggle between high-DPI bicubic smoothed view and crisp native 10m square pixel grid inspection.</p>
                  <div className="ix-settings-btns">
                    <button
                      className={`ix-sett-btn ${renderMode === 'smooth' ? 'on' : ''}`}
                      onClick={() => setRenderMode('smooth')}
                    >
                      <Sparkles size={13} />
                      <span>High-DPI Bicubic Smooth</span>
                    </button>
                    <button
                      className={`ix-sett-btn ${renderMode === 'crisp' ? 'on' : ''}`}
                      onClick={() => setRenderMode('crisp')}
                    >
                      <Box size={13} />
                      <span>Crisp 10m Pixel Grid</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Status Bar */}
            <div className="ix-lb-footer">
              <span className="ix-lb-foot-status">
                <span className="ix-pulse-dot" />
                {scene ? `SENTINEL-2 L2A · ${date.toUpperCase()} · ${scene.cloud}% CLOUD · SCL MASKED` : loading ? 'FETCHING SENTINEL-2 SCENE…' : 'AWAITING SATELLITE PASS'}
              </span>
            </div>
          </div>
        )}

        <NearbyLayer map={mapObj} farm={farm} open={nearOpen} onClose={() => setNearOpen(false)} mine={{ b: mine.b, p: mine.p }}/>
        <MapKit map={mapObj} farm={farm} kit={kit} farmOnly={aoiOnly}/>
        <RulerTape map={mapObj} farm={farm} open={rulerOpen} onClose={() => setRulerOpen(false)} onActiveChange={setRulerActive}/>

        {tool !== 'none' && (
          <div className="ix-hint">
            {tool === 'borewell' ? 'Click the map where the borewell is' : `Click along the pipeline route · ${draft.length} point${draft.length === 1 ? '' : 's'}${draft.length > 1 ? ` · ${Math.round(lengthM(draft))} m` : ''}`}
            {tool === 'pipeline' && <button disabled={draft.length < 2} onClick={finishPipe}>Finish</button>}
            <button onClick={() => { setTool('none'); setDraft([]) }}>Cancel</button>
          </div>
        )}

        <button
          className="map-location"
          aria-label="Centre on farm"
          onClick={() => {
            const [w, s, e, n] = farmBBox(farm)
            map.current?.fitBounds(L.latLngBounds([s, w], [n, e]), { padding: [70, 70], maxZoom: 17 })
          }}
        >
          <LocateFixed size={19}/>
        </button>

        {view3d && <Suspense fallback={null}><Walk3D farm={farm} onClose={() => setView3d(false)}/></Suspense>}

        {baseOpen && (
          <div className="ix-panel ix-bases" role="dialog" aria-label="Base map">
            <div className="ix-panel-head"><strong>Base map</strong><button aria-label="Close" onClick={() => setBaseOpen(false)}><X size={16}/></button></div>
            <div className="ix-list">
              {BASES.map(b => (
                <button key={b.id} className={base === b.id ? 'on' : ''} disabled={b.id === 'original' && !scene} onClick={() => setBase(b.id)}>
                  <span className="ix-ico" style={{ background: b.sw }}/>
                  <span><b>{b.name}</b><small>{b.id === 'original' && !scene ? 'Press Refresh first to find a satellite scene' : b.note}</small></span>
                  {base === b.id ? <Check size={15}/> : null}
                </button>
              ))}
            </div>
          </div>
        )}

        {tools && (
          <div className="ix-panel ix-tools" role="dialog" aria-label="Tools">
            <div className="ix-panel-head"><strong>Tools & Overlays</strong><button aria-label="Close" onClick={() => setTools(false)}><X size={16}/></button></div>
            <div className="ix-list">
              <h4>See it in 3D</h4>
              <button onClick={() => { setView3d(true); setTools(false) }}>
                <span className="ix-ico g3"><Box size={18}/></span>
                <span><b>3D walkthrough</b><small>Walk, fly a drone or look from above</small></span>
                <Plus size={15}/>
              </button>

              <h4>Google Earth Pro Measuring</h4>
              <button className={rulerOpen ? 'on' : ''} onClick={() => { setRulerOpen(true); setTools(false); setPanel(false) }}>
                <span className="ix-ico" style={{ background: '#fef08a', color: '#854d0e' }}><Ruler size={18}/></span>
                <span><b>Metered Tape / Ruler</b><small>Measure East side height, width, boundaries</small></span>
                {rulerOpen ? <Check size={15}/> : <Plus size={15}/>}
              </button>

              <h4>Water on your farm</h4>
              <button className={tool === 'borewell' ? 'on' : ''} onClick={() => { setDraft([]); setAoiOnly(false); setTool(tool === 'borewell' ? 'none' : 'borewell'); setTools(false) }}>
                <span className="ix-ico bw"><CircleDot size={18}/></span>
                <span><b>Mark a borewell</b><small>Tap the map where it is{mine.b.length ? ` · ${mine.b.length} saved` : ''}</small></span>
                {tool === 'borewell' ? <Check size={15}/> : <Plus size={15}/>}
              </button>
              <button className={tool === 'pipeline' ? 'on' : ''} onClick={() => { setDraft([]); setAoiOnly(false); setTool(tool === 'pipeline' ? 'none' : 'pipeline'); setTools(false) }}>
                <span className="ix-ico pp"><Route size={18}/></span>
                <span><b>Draw a pipeline</b><small>Tap points along the route{mine.p.length ? ` · ${mine.p.length} saved` : ''}</small></span>
                {tool === 'pipeline' ? <Check size={15}/> : <Plus size={15}/>}
              </button>

              <h4>Map layers (always available)</h4>
              {([['hill', 'Hillshade', 'Shaded relief, like sunlight on the ground', 'hs'], ['contour', 'Contour lines', 'Lines joining points of the same height', 'ct'], ['aspect', 'Slope direction', 'Which way each part of the farm faces', 'as'], ['dem', 'Elevation colours', 'Low to high ground in colour', 'dm'], ['grid', 'Grid lines', 'Latitude and longitude lines with numbers', 'gr'], ['legend', 'Show legend', 'A key for the layers above', 'lg']] as [keyof Kit, string, string, string][]).map(([k, name, hint, c]) => (
                <button key={k} className={kit[k] ? 'on' : ''} onClick={() => setKit({ ...kit, [k]: !kit[k] })}>
                  <span className={`ix-ico k-${c}`}><Layers size={18}/></span>
                  <span><b>{name}</b><small>{hint}</small></span>
                  {kit[k] ? <Check size={15}/> : <Plus size={15}/>}
                </button>
              ))}

              <h4>Map view</h4>
              <button className={dim ? 'on' : ''} onClick={() => setDim(!dim)}>
                <span className="ix-ico dm"><Mountain size={18}/></span>
                <span><b>{dim ? 'Surroundings dimmed' : 'Surroundings bright'}</b><small>Dim everything outside your farm</small></span>
                {dim ? <Check size={15}/> : <Plus size={15}/>}
              </button>
              <button onClick={() => { const [w, s2, e, n] = farmBBox(farm); map.current?.fitBounds(L.latLngBounds([s2, w], [n, e]), { padding: [70, 70], maxZoom: 17 }); setTools(false) }}>
                <span className="ix-ico lc"><LocateFixed size={18}/></span>
                <span><b>Centre on my farm</b><small>Zoom back to the boundary</small></span>
                <Plus size={15}/>
              </button>
            </div>
          </div>
        )}

        {panel && (
          <div className="ix-panel" role="dialog" aria-label="Parameters">
            <div className="ix-panel-head"><strong>Parameters</strong><button aria-label="Close" onClick={() => setPanel(false)}><X size={16}/></button></div>
            <label className="ix-search"><Search size={14}/><input autoFocus placeholder="Search NDVI, drainage, soil moisture…" value={query} onChange={e => setQuery(e.target.value)}/></label>
            <div className="ix-list">
              {GROUPS.map(group => {
                const list = results.filter(i => i.group === group)
                return list.length ? (
                  <div key={group}>
                    <h4>{group}</h4>
                    {list.map(ind => (
                      <button key={ind.id} className={active.includes(ind.id) ? 'on' : ''} onClick={() => toggle(ind.id)}>
                        <span className="ix-swatch" style={{ background: ind.ramp ? gradientCss(ind.ramp) : 'linear-gradient(90deg,#3c6a4a,#c8a15a,#e4e4e4)' }}/>
                        <span><b>{ind.name}</b><small>{ind.desc}</small></span>
                        {active.includes(ind.id) ? <Check size={15}/> : <Plus size={15}/>}
                      </button>
                    ))}
                  </div>
                ) : null
              })}
            </div>
          </div>
        )}

        {picked && (
          <div className="ix-data" role="dialog" aria-label="Data window">
            <div className="ix-data-head">
              <div><strong>Data window</strong><small>{picked.lat.toFixed(5)}°, {picked.lon.toFixed(5)}° · {date}</small></div>
              <button aria-label="Close" onClick={() => { setPicked(null); marker.current?.remove() }}><X size={15}/></button>
            </div>
            {cls && <span className={`ix-class ${cls.tone}`}>{cls.label} crop vigour</span>}
            <div className="ix-data-grid">
              {INDICATORS.filter(i => picked.values[i.id] !== undefined && i.id !== 'hillshade').sort((a, b) => Number(active.includes(b.id)) - Number(active.includes(a.id))).map(ind => (
                <div key={ind.id} className={active.includes(ind.id) ? 'on' : ''}>
                  <span>{ind.name}</span>
                  <b>{fmt(ind.id, picked.values[ind.id])}</b>
                  {bandFor(ind.id, picked.values[ind.id]) && (
                    <em><i style={{ background: bandFor(ind.id, picked.values[ind.id])!.color }}/>{bandFor(ind.id, picked.values[ind.id])!.label}</em>
                  )}
                </div>
              ))}
              {picked.values.aspect !== undefined && (
                <div><span>Aspect</span><b>{compass(picked.values.aspect)} ({picked.values.aspect.toFixed(0)}°)</b></div>
              )}
            </div>
            {Object.keys(picked.values).length === 0 && <p>No clear pixel here (cloud, shadow, or no data).</p>}
          </div>
        )}
      </div>

      {/* Synchronized Legend Slot Portal */}
      {createPortal(
        <div className="ix-below">
          <div className="ix-stack">
            <span className="ix-lg-title">Layers on the map</span>
            {active.map(id => {
              const ind = byId(id), layer = layerCache.get(layerKey(id)), off = hidden.includes(id), waiting = ind.source === 'S2' && !scene
              return (
                <div key={id} className={`ix-row ${off ? 'off' : ''}`}>
                  <span className="ix-swatch" style={{ background: ind.ramp ? gradientCss(ind.ramp) : 'linear-gradient(90deg,#3c6a4a,#c8a15a,#e4e4e4)' }}/>
                  <div className="ix-nm">
                    <strong>
                      {ind.name}
                      {(() => { const vd = layer?.stat ? verdict(id, layer.stat.mean) : null; return vd ? <b className={`ix-vd ${vd.tone}`}>{vd.word}</b> : null })()}
                    </strong>
                    {(() => { const vd = layer?.stat ? verdict(id, layer.stat.mean) : null; return vd ? <small className="ix-why">{vd.why}</small> : null })()}
                  </div>
                  <em>{errors[id] ? 'error' : waiting ? 'waiting for scene' : busy.includes(id) || !layer ? 'loading…' : layer.stat ? fmt(id, layer.stat.mean) : ind.rgb ? 'composite' : '—'}</em>
                  <input aria-label={`${ind.name} opacity`} type="range" min="0.2" max="1" step="0.05" value={opacity[id] ?? 0.92} onChange={e => setOpacity(o => ({ ...o, [id]: Number(e.target.value) }))}/>
                  <button aria-label={off ? 'Show' : 'Hide'} onClick={() => setHidden(h => (off ? h.filter(x => x !== id) : [...h, id]))}>{off ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                  <button aria-label={`Remove ${ind.name}`} onClick={() => toggle(id)}><X size={14}/></button>
                </div>
              )
            })}
            {active.length === 0 && <div className="ix-empty">No parameters on the map. Add one to analyse this farm.</div>}
            {Object.values(errors)[0] && <div className="ix-error">{Object.values(errors)[0]}</div>}
          </div>

          <div className="ix-bottom">
            {topLayer && (
              <div className="ix-legend">
                <span className="ix-lg-title">What the colours mean</span>
                <div>
                  <strong>
                    {topLayer.ind.name}
                    {(() => { const vd = topLayer.stat ? verdict(topLayer.ind.id, topLayer.stat.mean) : null; return vd ? <b className={`ix-vd ${vd.tone}`}>{vd.word}</b> : null })()}
                  </strong>
                  <small>{topLayer.ind.desc}</small>
                  {(() => { const vd = topLayer.stat ? verdict(topLayer.ind.id, topLayer.stat.mean) : null; return vd ? <small className="ix-why">{vd.why}</small> : null })()}
                </div>
                {topLayer.ind.ramp && topLayer.range ? (
                  <>
                    <i style={{ background: gradientCss(topLayer.ind.ramp) }}/>
                    <div className="ix-scale">
                      <span>{topLayer.range[0].toFixed(dp(topLayer.ind.id, 1))}</span>
                      <span>{(topLayer.ind.log ? Math.sqrt(topLayer.range[0] * topLayer.range[1]) : (topLayer.range[0] + topLayer.range[1]) / 2).toFixed(dp(topLayer.ind.id, 2))}</span>
                      <span>{topLayer.range[1].toFixed(dp(topLayer.ind.id, 1))}{topLayer.ind.unit ?? ''}</span>
                    </div>
                  </>
                ) : (
                  <small>{topLayer.ind.rgb ? 'Sentinel-2 composite, clear pixels only' : 'Grey scale: dark = shaded'}</small>
                )}
                {MEANING[topLayer.ind.id] && (
                  <ul className="ix-meaning">
                    {MEANING[topLayer.ind.id].map((b, i) => (
                      <li key={b.label}><i style={{ background: b.color }}/><span>{b.label}</span><code>{bandRange(topLayer.ind.id, i)}</code></li>
                    ))}
                  </ul>
                )}
                {topLayer.ind.id === 'dem' && <small>Metres above sea level. Greens low, browns and white high.</small>}
                {topLayer.stat && <small className="ix-stat">Farm: min {fmt(topLayer.ind.id, topLayer.stat.min)} · mean {fmt(topLayer.ind.id, topLayer.stat.mean)} · max {fmt(topLayer.ind.id, topLayer.stat.max)}</small>}
              </div>
            )}
            {loading && <span className="ix-ll"><LogoLoader size={46} text="Fetching Sentinel-2 scene…"/></span>}
            <span className="ix-source">
              <span/>
              {scene ? `SENTINEL-2 L2A · ${date.toUpperCase()} · ${scene.cloud}% CLOUD · SCL CLOUD-MASKED` : loading ? 'FETCHING SENTINEL-2 SCENE…' : 'NO SATELLITE SCENE YET'}
            </span>
          </div>
        </div>,
        slot || document.body
      )}
    </div>
  )
}
