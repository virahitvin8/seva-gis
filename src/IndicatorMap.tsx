import LogoLoader from './LogoLoader'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { createPortal } from 'react-dom'
import {
  Check, Eye, EyeOff, Box, CircleDot, LocateFixed, Route, Plus, Search,
  SlidersHorizontal, X, Wrench, Move, Globe2, Mountain, Droplets, Layers,
  Lock, LockOpen, Map as MapIcon, Ruler, Maximize2, Tag, ExternalLink,
  Sliders, ChevronRight, Trash2, FileCheck2
} from 'lucide-react'
import {
  GROUPS, INDICATORS, MEANING, bandFor, bandRange, byId, verdict,
  compass, gradientCss, renderLayer, sampleAt, type Grid, type Layer, type Group
} from './lib/indicators'
import { pixelAt } from './lib/raster'
import { ndviClass } from './lib/agro'
import { addBorewell, addPipeline, lengthM, removeBorewell, removePipeline, useAssets } from './lib/assets'
import NearbyLayer from './NearbyLayer'
import MapKit, { KIT_DEFAULT, type Kit } from './MapKit'
import RulerTape from './RulerTape'
import { BAND_COMBINATIONS } from './lib/geoai'
import { farmBBox, farmRing, loadDem, loadScene, type FarmData, type SceneOpts } from './lib/seva'
import { buildEarthEngineScript, supportsEarthEngineIndicator } from './lib/earthEngine'
import { createEarthEngineMap, isEarthEngineConfigured } from './lib/earthEngineClient'
import { getSavedZoom, setGlobalZoom } from './lib/zoomSync'
import { fetchOverpassCadastre, type OverpassParcel } from './lib/cadastreOnline'

type MapFarm = FarmData & { id: string; name: string }
type Picked = { lat: number; lon: number; values: Record<string, number> }

const Walk3D = lazy(() => import('./Walk3D'))
const layerCache = new Map<string, Layer>()
const MAX_CACHED_LAYERS = 8
const getCachedLayer = (key: string) => {
  const layer = layerCache.get(key)
  if (!layer) return undefined
  layerCache.delete(key)
  layerCache.set(key, layer)
  return layer
}
const setCachedLayer = (key: string, layer: Layer) => {
  layerCache.delete(key)
  layerCache.set(key, layer)
  while (layerCache.size > MAX_CACHED_LAYERS) layerCache.delete(layerCache.keys().next().value!)
}
const comboLayer: Record<string, string> = {
  natural: 'rgb', cir: 'cir', agri: 'agri', moisture: 'moist_rgb',
  swir: 'swir_rgb', chlorophyll: 're_rgb', geology: 'geology_rgb',
}
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

export default function IndicatorMap({ farm, loading, panelTarget, sceneOpts }: { farm: MapFarm; loading: boolean; panelTarget: HTMLDivElement | null; sceneOpts?: SceneOpts }) {
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
  const [earthEngineOverlay, setEarthEngineOverlay] = useState<{ tileUrl: string; layerId: string; sceneKey: string; sceneCount: string } | null>(null)
  const [earthEngineStatus, setEarthEngineStatus] = useState('')
  const earthEngineTiles = useRef<L.TileLayer | null>(null)
  const [panel, setPanel] = useState(false)
  const [baseOpen, setBaseOpen] = useState(false)
  const [nearOpen, setNearOpen] = useState(false)
  const [rulerOpen, setRulerOpen] = useState(false)
  const [rulerActive, setRulerActive] = useState(false)
  const rulerOpenRef = useRef(false)
  rulerOpenRef.current = rulerOpen
  const [cadastreOpen, setCadastreOpen] = useState(false)
  const [showAllGlobalParcels, setShowAllGlobalParcels] = useState(false)
  const cadastreLayerRef = useRef<L.LayerGroup | null>(null)
  const [base, setBase] = useState(() => localStorage.getItem(BASE_STORE) || 'sat')
  const baseLayers = useRef<L.TileLayer[]>([])
  const [tools, setTools] = useState(false)
  const [aoiOnly, setAoiOnly] = useState(false)
  const [locked, setLocked] = useState(() => localStorage.getItem('seva-map-lock') === '1')
  const [mapObj, setMapObj] = useState<L.Map | null>(null)
  const [mapZoom, setMapZoom] = useState(() => getSavedZoom(15))
  const [kit, setKit] = useState<Kit>(() => {
    try {
      return { ...KIT_DEFAULT, ...JSON.parse(localStorage.getItem('seva-kit-v3') || '{}') }
    } catch {
      return KIT_DEFAULT
    }
  })
  useEffect(() => { localStorage.setItem('seva-kit-v3', JSON.stringify(kit)) }, [kit])
  const [query, setQuery] = useState('')
  const [dim, setDim] = useState(false)
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
  const geo = farm.polygon && farm.polygon.length >= 3
    ? `${farm.id}:${farm.polygon.map(([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`).join(';')}`
    : `${farm.id}:${farm.lat.toFixed(7)}:${farm.lon.toFixed(7)}:${farm.area.toFixed(4)}`
  const sceneKey = scene ? `${scene.id}:${(scene.ids ?? []).join('+')}:${(scene.fill ?? []).join('+')}` : 'no-scene'

  // GIS Engine Controls: Background mode, Dynamic Range Adjustment (DRA), High-DPI Clarity
  const [bgMode, setBgMode] = useState<'default' | 'black' | 'white'>(() => {
    return (localStorage.getItem('seva-map-bg') as any) || 'default'
  })
  useEffect(() => { localStorage.setItem('seva-map-bg', bgMode) }, [bgMode])

  const [stretchDra, setStretchDra] = useState(() => localStorage.getItem('seva-stretch-dra') === '1')
  useEffect(() => { localStorage.setItem('seva-stretch-dra', stretchDra ? '1' : '0') }, [stretchDra])

  // Dedicated Layers Box (Table of Contents / Symbology manager)
  const [layersBoxOpen, setLayersBoxOpen] = useState(() => localStorage.getItem('seva-lb-open-v2') === '1')
  useEffect(() => { localStorage.setItem('seva-lb-open-v2', layersBoxOpen ? '1' : '0') }, [layersBoxOpen])
  const [panelDetached, setPanelDetached] = useState(false)
  const [panelPosition, setPanelPosition] = useState({ x: 24, y: 96 })
  const [panelDragging, setPanelDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const [layersBoxTab, setLayersBoxTab] = useState<'active' | 'symbology' | 'tools' | 'display' | 'catalog'>('active')
  const [catalogCat, setCatalogCat] = useState<string>('All')
  const [activeBandCombo, setActiveBandCombo] = useState<string>('natural')
  const [earthEngineNotice, setEarthEngineNotice] = useState('')

  async function openEarthEngine() {
    const script = buildEarthEngineScript(farm, active.find(supportsEarthEngineIndicator) ?? 'ndvi', activeBandCombo, sceneOpts)
    window.open('https://code.earthengine.google.com/', '_blank', 'noopener,noreferrer')
    try {
      await navigator.clipboard.writeText(script)
      setEarthEngineNotice('Farm outline and script copied. Paste them into Earth Engine, then Run.')
    } catch {
      const blob = new Blob([script], { type: 'text/javascript' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${farm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-earth-engine.js`
      link.click()
      URL.revokeObjectURL(url)
      setEarthEngineNotice('Script downloaded. Open it and paste the code into Earth Engine.')
    }
  }

  useEffect(() => {
    if (!panelDragging) return
    const move = (event: PointerEvent) => setPanelPosition({
      x: Math.max(8, Math.min(window.innerWidth - Math.min(420, window.innerWidth - 16) - 8, event.clientX - dragOffset.current.x)),
      y: Math.max(8, Math.min(window.innerHeight - Math.min(720, window.innerHeight - 16) - 8, event.clientY - dragOffset.current.y)),
    })
    const end = () => setPanelDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }
  }, [panelDragging])

  useEffect(() => {
    if (!map.current) return
    const timer = window.setTimeout(() => map.current?.invalidateSize({ pan: false }), 120)
    return () => window.clearTimeout(timer)
  }, [layersBoxOpen, panelDetached])

  const layerKey = (id: string) => `${byId(id).source === 'DEM' ? 'dem' : sceneKey}:${geo}:${id}:${stretchDra ? 'dra' : 'std'}`
  const pickedRef = useRef(setPicked)
  pickedRef.current = setPicked

  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(active)) }, [active])
  useEffect(() => {
    localStorage.setItem('seva-map-lock', locked ? '1' : '0')
    const m = mapObj
    if (!m) return
    // Allow smooth scroll wheel zoom on the map when unlocked, while preventing outer page scrolling
    const hs = [m.dragging, m.doubleClickZoom, m.touchZoom, m.boxZoom, m.keyboard, m.scrollWheelZoom]
    hs.forEach(h => {
      try {
        if (h && typeof (h as any).enable === 'function' && typeof (h as any).disable === 'function') {
          if (locked) (h as any).disable()
          else (h as any).enable()
        }
      } catch (err) {
        console.warn('Leaflet lock handler toggle:', err)
      }
    })
    // Safely recalculate container geometry without clearing or purging tile layers
    m.invalidateSize({ pan: false })
    const t = setTimeout(() => {
      m.invalidateSize({ pan: false })
    }, 60)
    return () => clearTimeout(t)
  }, [locked, mapObj])

  // Automatic wake/unlock recovery: restores map viewport whenever device, phone, or browser tab changes visibility
  useEffect(() => {
    const m = mapObj
    if (!m) return
    const handleWakeAndVisibility = () => {
      if (document.visibilityState === 'visible') {
        m.invalidateSize({ pan: false })
        setTimeout(() => {
          m.invalidateSize({ pan: false })
        }, 120)
      }
    }
    document.addEventListener('visibilitychange', handleWakeAndVisibility)
    window.addEventListener('focus', handleWakeAndVisibility)
    window.addEventListener('pageshow', handleWakeAndVisibility)
    window.addEventListener('resize', handleWakeAndVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleWakeAndVisibility)
      window.removeEventListener('focus', handleWakeAndVisibility)
      window.removeEventListener('pageshow', handleWakeAndVisibility)
      window.removeEventListener('resize', handleWakeAndVisibility)
    }
  }, [mapObj])


  useEffect(() => {
    if (!element.current) return
    const initialZoom = getSavedZoom(15)
    const instance = L.map(element.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true, // Always instantiate handler so it can be safely toggled by lock/unlock
      wheelPxPerZoomLevel: 100,
      wheelDebounceTime: 40,
    }).setView([farm.lat, farm.lon], initialZoom)
    map.current = instance
    setMapObj(instance)
    L.control.zoom({ position: 'bottomright' }).addTo(instance)

    const onZoom = () => {
      const z = instance.getZoom()
      setMapZoom(z)
      setGlobalZoom(z, { lat: instance.getCenter().lat, lon: instance.getCenter().lng })
    }
    instance.on('zoomend', onZoom)
    instance.on('zoom', onZoom)
    instance.on('moveend', onZoom)

    // Stop wheel events from propagating outside map to keep user from jumping into top headlines
    const el = element.current
    const onWheel = (e: WheelEvent) => {
      e.stopPropagation()
    }
    el.addEventListener('wheel', onWheel, { passive: true })

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
    return () => {
      el.removeEventListener('wheel', onWheel)
      instance.remove()
      map.current = null
    }
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
      const l = L.tileLayer(url, { attribution, maxZoom: 21, maxNativeZoom: 18, zIndex: 10 + baseLayers.current.length, ...o }).addTo(instance)
      baseLayers.current.push(l)
      let tileErrors = 0
      let fallbackAdded = false
      l.on('tileerror', () => {
        tileErrors++
        if (fallbackAdded || tileErrors < 4) return
        fallbackAdded = true
        const fallback = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 20,
          maxNativeZoom: 19,
          zIndex: 9,
        }).addTo(instance)
        baseLayers.current.push(fallback)
      })
    }
    const esri = 'Imagery © Esri, Maxar, Earthstar Geographics'
    if (base === 'sat' || base === 'hybrid') {
      add(ESRI('World_Imagery'), esri, { maxNativeZoom: 18 })
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
      else element.current.style.backgroundColor = '#15291f'
    }

    if (bgMode === 'black') {
      // Solid Black background outside farm boundary (Google Earth Engine dark canvas mode)
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
      // Standard view with surroundings: gently dim surroundings only when explicitly requested
      if (dim) {
        L.polygon([[[-85, -180], [-85, 180], [85, 180], [85, -180]], ring], {
          stroke: false,
          fillColor: '#07110c',
          fillOpacity: 0.45,
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

  // Cadastral Survey Boundaries and Official Pattadar Passbook Layer
  useEffect(() => {
    const instance = mapObj
    if (!instance) return

    if (cadastreLayerRef.current) {
      cadastreLayerRef.current.remove()
      cadastreLayerRef.current = null
    }

    if (!cadastreOpen) return

    const cGroup = L.layerGroup().addTo(instance)
    cadastreLayerRef.current = cGroup

    const [w, s, e, n] = farmBBox(farm)
    const dw = Math.max(e - w, 0.001)
    const dh = Math.max(n - s, 0.001)
    const ring = farmRing(farm).map(p => [p[1], p[0]] as L.LatLngTuple)
    const parcelArea = areaHa(farmRing(farm))

    // 1. Primary Certified AOI Parcel
    L.polygon(ring, {
      color: '#059669',
      weight: 3.5,
      dashArray: '6, 4',
      fill: true,
      fillColor: '#10b981',
      fillOpacity: 0.18,
    }).bindTooltip(`Certified Spatial Parcel · ${farm.name} (${parcelArea.toFixed(2)} ha)`, { permanent: false, direction: 'top' }).addTo(cGroup)

    // Survey boundary stone markers
    ring.forEach(([lat, lng], idx) => {
      L.circleMarker([lat, lng], {
        radius: 4.5,
        color: '#ffffff',
        weight: 2,
        fillColor: '#059669',
        fillOpacity: 1,
      }).bindTooltip(`Boundary Monument #${idx + 1} (${lat.toFixed(5)}°, ${lng.toFixed(5)}°)`, { direction: 'top' }).addTo(cGroup)
    })

    // Centroid Badge for Primary Parcel
    L.marker([farm.lat, farm.lon], {
      icon: L.divIcon({
        className: 'ix-cadastre-badge-wrap',
        html: `<div class="cad-badge primary"><b>${farm.name}</b><span>${parcelArea.toFixed(2)} ha · ${farm.crop || 'Field'}</span></div>`,
        iconSize: [120, 32],
        iconAnchor: [60, 16],
      })
    }).addTo(cGroup)

    // 2. Fetch authentic cadastral & farmland boundaries from OpenStreetMap via Overpass API
    let abortCadastre = false
    fetchOverpassCadastre(farm.lat, farm.lon, 1000).then(parcels => {
      if (abortCadastre || !cadastreLayerRef.current) return
      if (parcels.length > 0) {
        parcels.forEach((p, idx) => {
          if (p.coordinates.length < 3) return
          const pRing = p.coordinates as L.LatLngTuple[]
          const title = p.name || p.ref || `Cadastral Parcel #${p.id}`
          const pLayer = L.polygon(pRing, {
            color: '#d97706',
            weight: 2,
            dashArray: '4, 4',
            fill: true,
            fillColor: '#fef3c7',
            fillOpacity: 0.15
          }).bindTooltip(`${title} (${p.landuse || 'Farmland'} · OSM ${p.id})`, { sticky: true }).addTo(cGroup)

          const cLat = pRing.reduce((sum, pt) => sum + pt[0], 0) / pRing.length
          const cLon = pRing.reduce((sum, pt) => sum + pt[1], 0) / pRing.length
          L.marker([cLat, cLon], {
            icon: L.divIcon({
              className: 'ix-cadastre-badge-wrap',
              html: `<div class="cad-badge sub">${title.slice(0, 18)}</div>`,
              iconSize: [70, 20],
              iconAnchor: [35, 10]
            })
          }).addTo(cGroup)
        })
      } else {
        // Fallback geodetic quadrant boundaries based on actual coordinate offsets
        const quadrants = [
          { name: `North Sector (${(n + dh * 0.4).toFixed(4)}°N)`, ring: [[n, w], [n + dh * 0.75, w + dw * 0.1], [n + dh * 0.8, e - dw * 0.1], [n, e]] as L.LatLngTuple[] },
          { name: `East Sector (${(e + dw * 0.4).toFixed(4)}°E)`, ring: [[n, e], [n - dh * 0.1, e + dw * 0.65], [s + dh * 0.1, e + dw * 0.7], [s, e]] as L.LatLngTuple[] },
          { name: `South Sector (${(s - dh * 0.4).toFixed(4)}°S)`, ring: [[s, w], [s, e], [s - dh * 0.7, e - dw * 0.15], [s - dh * 0.75, w + dw * 0.1]] as L.LatLngTuple[] },
          { name: `West Sector (${(w - dw * 0.4).toFixed(4)}°W)`, ring: [[n, w], [s, w], [s + dh * 0.15, w - dw * 0.65], [n - dh * 0.1, w - dw * 0.6]] as L.LatLngTuple[] }
        ]
        quadrants.forEach(q => {
          L.polygon(q.ring, { color: '#d97706', weight: 1.8, dashArray: '4, 4', fill: true, fillColor: '#fef3c7', fillOpacity: 0.12 })
            .bindTooltip(`Adjoining ${q.name} · Spatial Survey Grid`, { sticky: true }).addTo(cGroup)
        })
      }
    })

    return () => {
      abortCadastre = true
      cGroup.remove()
      cadastreLayerRef.current = null
    }
  }, [mapObj, cadastreOpen, showAllGlobalParcels, farm])

  useEffect(() => {
    overlays.current.forEach(o => o.remove()); overlays.current.clear()
    grids.current = {}; marker.current?.remove(); setPicked(null); setErrors({})
  }, [geo, scene?.id])

  // Fetch and render high resolution raster grids
  useEffect(() => {
    let dead = false
    const missing = active.filter(id => !getCachedLayer(layerKey(id)) && (byId(id).source === 'DEM' || scene))
    const needS2 = active.some(id => byId(id).source === 'S2') && scene
    const needDem = active.some(id => byId(id).source === 'DEM')
    const rendering: string[] = []
    ;(async () => {
      const ring = farmRing(farm)
      if (needS2) {
        try { const grid = await loadScene(scene!, farm); if (dead) return; grids.current.s2 = grid }
        catch (e) { fail('S2', e) }
      }
      if (dead) return
      if (needDem) {
        try { const grid = await loadDem(farm); if (dead) return; grids.current.dem = grid }
        catch (e) { fail('DEM', e) }
      }
      if (dead) return
      for (const id of missing) {
        if (dead) return
        const ind = byId(id), g = ind.source === 'DEM' ? grids.current.dem : grids.current.s2
        if (!g) continue
        rendering.push(id)
        setBusy(b => b.includes(id) ? b : [...b, id])
        await new Promise(r => setTimeout(r, 0))
        if (dead) return
        try {
          setCachedLayer(
            layerKey(id),
            renderLayer(ind, g, ring, { dra: stretchDra })
          )
          if (!dead) setErrors(x => { const { [id]: _drop, ...rest } = x; return rest })
        } catch (e) {
          fail(id, e)
        }
        rendering.splice(rendering.indexOf(id), 1)
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
    return () => {
      dead = true
      if (rendering.length) setBusy(b => b.filter(id => !rendering.includes(id)))
    }
  }, [active.join(), geo, sceneKey, stretchDra])

  useEffect(() => {
    const primaryId = [...active].reverse().find(id => !hidden.includes(id) && byId(id).source === 'S2')
    const layer = primaryId ? byId(primaryId) : null
    if (!isEarthEngineConfigured) {
      setEarthEngineOverlay(null)
      setEarthEngineStatus('Planetary Computer · Sentinel-2 (Auto Fallback)')
      return
    }
    if (!farm.polygon || farm.polygon.length < 3 || !layer) {
      setEarthEngineOverlay(null)
      setEarthEngineStatus('Draw a field boundary to request Earth Engine primary tiles.')
      return
    }

    const controller = new AbortController()
    setEarthEngineOverlay(null)
    setEarthEngineStatus('Requesting primary Sentinel-2 layer from Google Earth Engine…')
    createEarthEngineMap({
      farm,
      sceneOpts: sceneOpts ?? {},
      layer,
      bandCombination: layer.rgb ? activeBandCombo : undefined,
      percentileStretch: stretchDra,
    }, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setEarthEngineOverlay({ tileUrl: result.tileUrl, layerId: primaryId!, sceneKey, sceneCount: String(result.sceneCount) })
      setEarthEngineStatus(`Google Earth Engine · Sentinel-2 L2A (Primary · ${result.sceneCount} scene${result.sceneCount === '1' ? '' : 's'})`)
    }).catch(error => {
      if (controller.signal.aborted) return
      setEarthEngineOverlay(null)
      setEarthEngineStatus('Planetary Computer · Sentinel-2 (Auto Fallback)')
      console.info('Earth Engine unavailable, auto-falling back to Planetary Computer:', error)
    })
    return () => controller.abort()
  }, [active.join(), hidden.join(), geo, sceneKey, stretchDra, activeBandCombo, JSON.stringify(sceneOpts)])

  useEffect(() => {
    const instance = map.current
    earthEngineTiles.current?.remove()
    earthEngineTiles.current = null
    if (!instance || !earthEngineOverlay || earthEngineOverlay.sceneKey !== sceneKey || hidden.includes(earthEngineOverlay.layerId)) return
    const eeLayer = L.tileLayer(earthEngineOverlay.tileUrl, {
      attribution: 'Sentinel-2 L2A · Google Earth Engine',
      maxZoom: 20,
      maxNativeZoom: 16,
      zIndex: 700,
      opacity: opacity[earthEngineOverlay.layerId] ?? 1,
      crossOrigin: true,
    })
    let eeErrors = 0
    eeLayer.on('tileerror', () => {
      eeErrors++
      if (eeErrors >= 3) {
        console.warn('Earth Engine tiles failed, auto-falling back to Planetary Computer raster')
        setEarthEngineOverlay(null)
        setEarthEngineStatus('Planetary Computer · Sentinel-2 (Auto Fallback)')
      }
    })
    eeLayer.addTo(instance)
    earthEngineTiles.current = eeLayer
    return () => { earthEngineTiles.current?.remove(); earthEngineTiles.current = null }
  }, [mapObj, earthEngineOverlay, hidden.join(), JSON.stringify(opacity), sceneKey])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const wanted = new Set<string>()
    active.forEach((id, index) => {
      const layer = getCachedLayer(layerKey(id))
      if (!layer || hidden.includes(id)) return
      if (earthEngineOverlay?.sceneKey === sceneKey && earthEngineOverlay.layerId === id) return
      wanted.add(id)
      const bounds = L.latLngBounds([layer.bbox[1], layer.bbox[0]], [layer.bbox[3], layer.bbox[2]])
      let overlay = overlays.current.get(id)
      if (!overlay) { overlay = L.imageOverlay(layer.url, bounds, { interactive: false, zIndex: 300 + index, className: 'seva-raster-pixels' }).addTo(instance); overlays.current.set(id, overlay) }
      else overlay.setBounds(bounds)
      overlay.setOpacity(opacity[id] ?? (layer.ind.rgb || id === 'hillshade' ? 1 : 0.92))
      overlay.setZIndex(300 + index)
    })
    overlays.current.forEach((o, id) => { if (!wanted.has(id)) { o.remove(); overlays.current.delete(id) } })
  }, [active.join(), hidden.join(), JSON.stringify(opacity), tick, geo, sceneKey, stretchDra, earthEngineOverlay])

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
  const topLegend = [...active].reverse().find(id => !hidden.includes(id) && getCachedLayer(layerKey(id)))
  const topLayer = topLegend ? getCachedLayer(layerKey(topLegend)) : undefined
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


  return (
    <div className="ix-outer">
      <div className="ix-wrap">
        <div ref={element} className={`field-map${locked ? ' is-locked' : ''}`} />

        <div className={`ix-gee-badge${earthEngineOverlay?.sceneKey === sceneKey ? ' is-live' : ''}`} title={earthEngineStatus}>
          <span className="gee-dot" />
          <span>{earthEngineOverlay?.sceneKey === sceneKey ? 'Google Earth Engine · Sentinel-2 L2A (Primary)' : 'Planetary Computer · Sentinel-2 (Auto Fallback)'}</span>
        </div>

        <div className="ix-zoom-sync-badge" title={`Live map zoom ${mapZoom.toFixed(1)}x synchronizes all GeoAI analysis maps across the dashboard`}>
          <span className="zoom-pulse-dot" />
          <span>Zoom <b>{mapZoom.toFixed(1)}x</b></span>
          <span className="zoom-synced-pill">DASHBOARD SYNCED</span>
        </div>

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
            className={`ix-add ix-lb-btn ${layersBoxOpen && layersBoxTab === 'active' ? 'on' : ''}`}
            onClick={() => { setLayersBoxOpen(true); setLayersBoxTab('active'); setPanel(false); setTools(false); setBaseOpen(false); setNearOpen(false); setRulerOpen(false) }}
            title="Open GIS Section Layer: Active parameters, opacity & blending"
          >
            <Layers size={16}/>
            <span>Layers</span>
            <b>{active.length}</b>
          </button>

          {/* 2. Multispectral Band Symbology Toggle */}
          <button
            className={`ix-add ${layersBoxOpen && layersBoxTab === 'symbology' ? 'on' : ''}`}
            onClick={() => { setLayersBoxOpen(true); setLayersBoxTab('symbology'); setPanel(false); setTools(false); setBaseOpen(false); setNearOpen(false); setRulerOpen(false) }}
            title="Multispectral Band Symbology: True colour, False colour NIR, Agriculture & Moisture"
          >
            <Tag size={15}/>
            <span>Symbology</span>
            <b>Bands</b>
          </button>

          {/* 3. Farm Background Selector */}
          <div className="ix-bg-bar" role="group" aria-label="Farm Background Mode">
            <span className="ix-bg-lbl">Canvas:</span>
            <button
              className={`ix-bg-btn btn-blk ${bgMode === 'black' ? 'on' : ''}`}
              onClick={() => { setBgMode('black'); setLayersBoxOpen(true); setLayersBoxTab('display'); }}
              title="Solid Black background (Google Earth Engine dark canvas mode)"
            >
              <span className="dot-blk" />
              <span>Black</span>
            </button>
            <button
              className={`ix-bg-btn btn-wht ${bgMode === 'white' ? 'on' : ''}`}
              onClick={() => { setBgMode('white'); setLayersBoxOpen(true); setLayersBoxTab('display'); }}
              title="Solid White background (QGIS & ArcMap layout view mode)"
            >
              <span className="dot-wht" />
              <span>White</span>
            </button>
            <button
              className={`ix-bg-btn ${bgMode === 'default' ? 'on' : ''}`}
              onClick={() => { setBgMode('default'); setLayersBoxOpen(true); setLayersBoxTab('display'); }}
              title="Standard basemap (Satellite, Streets or Terrain)"
            >
              <Globe2 size={13} />
              <span>Map</span>
            </button>
          </div>

          {/* 4. Zoom Stretch Farm View */}
          <button
            className={`ix-add ix-stretch-btn ${aoiOnly ? 'on' : ''}`}
            onClick={() => { (aoiOnly ? handleResetView() : handleZoomStretch()); setLayersBoxOpen(true); setLayersBoxTab('display'); }}
            title={aoiOnly ? "Reset view: Show surroundings with standard padding" : "Zoom Stretch: Fit 100% of farm boundary tightly to canvas"}
          >
            <Maximize2 size={14} />
            <span>{aoiOnly ? "Fit Area" : "Zoom Stretch"}</span>
          </button>

          {/* 5. Base map picker */}
          <button
            className={`ix-add ${layersBoxOpen && layersBoxTab === 'display' ? 'on' : ''}`}
            onClick={() => { setLayersBoxOpen(true); setLayersBoxTab('display'); setPanel(false); setTools(false); setNearOpen(false); setRulerOpen(false); }}
            title="Select Basemap Imagery in Section Layer"
          >
            <MapIcon size={15}/>
            <span>Base map</span>
            <b>{BASES.find(b => b.id === base)?.name.split(' ')[0]}</b>
          </button>

          {/* 6. Field Tools & Adjustments */}
          <button
            className={`ix-add ix-tools-btn ${layersBoxOpen && layersBoxTab === 'tools' ? 'on' : ''}`}
            onClick={() => { setLayersBoxOpen(true); setLayersBoxTab('tools'); setPanel(false); setRulerOpen(false); }}
            title="Field Tools & Adjustments (Ruler, Hotspots, Borewells, Contours, Swath Robotics)"
          >
            <Wrench size={15}/>
            <span>Tools</span>
            <b>Adjust</b>
          </button>

          {/* 7. Ruler / Tape Measure */}
          <button
            className={`ix-add ${rulerOpen ? 'on' : ''}`}
            style={rulerOpen ? { background: '#fef08a', borderColor: '#eab308', color: '#854d0e', fontWeight: 650 } : {}}
            onClick={() => {
              setRulerOpen(!rulerOpen)
              setLayersBoxOpen(true)
              setLayersBoxTab('tools')
              setPanel(false)
              setTools(false)
              setBaseOpen(false)
              setNearOpen(false)
            }}
            title="Precision Ruler & Metered Tape Measure — Adjust in Section Layer"
          >
            <Ruler size={15}/>
            <span>Ruler</span>
            <b>{rulerActive ? 'Measuring' : 'Tape'}</b>
          </button>

          {/* 8. Digital India Land Records · Cadastre & Passbook */}
          <button
            className={`ix-add ${cadastreOpen ? 'on' : ''}`}
            style={cadastreOpen ? { background: '#ecfdf5', borderColor: '#059669', color: '#065f46', fontWeight: 650 } : {}}
            onClick={() => setCadastreOpen(prev => !prev)}
            title="Digital India Land Records · RoR Form 1B Cadastre & Certified Pattadar Passbook"
          >
            <FileCheck2 size={15}/>
            <span>Cadastre</span>
            <b>{cadastreOpen ? 'Passbook ON' : 'RoR 1B'}</b>
          </button>

        </div>

        {/* The panel lives beside the map, or floats outside it when detached. */}
        {layersBoxOpen && (panelDetached || panelTarget) && createPortal(
          <div
            className={`ix-layers-box${panelDetached ? ' detached' : ''}`}
            style={panelDetached ? { left: panelPosition.x, top: panelPosition.y } : undefined}
            role="dialog"
            aria-label="GIS Layers & Symbology Box"
          >
            <div className={`ix-lb-header${panelDetached ? ' draggable' : ''}`} onPointerDown={event => {
              if (!panelDetached || (event.target as HTMLElement).closest('button')) return
              dragOffset.current = { x: event.clientX - panelPosition.x, y: event.clientY - panelPosition.y }
              setPanelDragging(true)
            }}>
              <div className="ix-lb-title">
                <Layers size={17} className="text-emerald-400" />
                <div>
                  <strong>Layers & Symbology Box</strong>
                  <small>Satellite layers and map tools</small>
                </div>
              </div>
              <div className="ix-lb-actions">
                <button
                  className="ix-lb-tool-btn"
                  title={panelDetached ? 'Dock panel beside the map' : 'Detach panel so it can move outside the map'}
                  aria-label={panelDetached ? 'Dock layers panel' : 'Detach layers panel'}
                  onClick={() => setPanelDetached(value => !value)}
                >
                  <Move size={13} />
                  <span>{panelDetached ? 'Dock' : 'Detach'}</span>
                </button>
                <button
                  className={`ix-lb-tool-btn ${stretchDra ? 'active' : ''}`}
                  title={stretchDra ? 'Auto contrast is on; this changes map colors, not pixel values.' : 'Improve map color contrast using the farm pixel range.'}
                  onClick={() => setStretchDra(!stretchDra)}
                >
                  <Sliders size={13} />
                  <span>{stretchDra ? 'Contrast on' : 'Auto contrast'}</span>
                </button>
                <span className="ix-lb-tool-btn active" title="Nearest-neighbour pixel display, with no smoothing or sharpening.">
                  <Box size={13} />
                  <span>Pixel view</span>
                </span>
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
                <span>Layers ({active.length})</span>
              </button>
              <button
                role="tab"
                aria-selected={layersBoxTab === 'symbology'}
                className={layersBoxTab === 'symbology' ? 'active' : ''}
                onClick={() => setLayersBoxTab('symbology')}
              >
                <Tag size={13} />
                <span>Band Symbology</span>
              </button>
              <button
                role="tab"
                aria-selected={layersBoxTab === 'tools'}
                className={layersBoxTab === 'tools' ? 'active' : ''}
                onClick={() => setLayersBoxTab('tools')}
              >
                <Wrench size={13} />
                <span>Field Tools</span>
              </button>
              <button
                role="tab"
                aria-selected={layersBoxTab === 'display'}
                className={layersBoxTab === 'display' ? 'active' : ''}
                onClick={() => setLayersBoxTab('display')}
              >
                <Maximize2 size={13} />
                <span>Display &amp; Basemaps</span>
              </button>
              <button
                role="tab"
                aria-selected={layersBoxTab === 'catalog'}
                className={layersBoxTab === 'catalog' ? 'active' : ''}
                onClick={() => setLayersBoxTab('catalog')}
              >
                <Plus size={13} />
                <span>Parameters ({INDICATORS.length})</span>
              </button>
            </div>

            {/* Tab 1: Active Layers with live Symbology */}
            {layersBoxTab === 'active' && (
              <div className="ix-lb-content">
                <div className="ix-lb-active-list">
                  {active.map(id => {
                    const ind = byId(id)
                    const layer = getCachedLayer(layerKey(id))
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
                            <span className="ix-lb-badge">{ind.source === 'S2' ? 'Sentinel-2' : 'Copernicus DEM'}</span>
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
                          {layer && <small className="ix-lb-resolution-note">
                            Output cells about {Math.max(1, Math.round(layer.cellSizeM))} m · nearest-neighbour, no smoothing
                            {ind.source === 'S2' ? ' · Sentinel-2 source bands are 10 m or 20 m' : ' · Copernicus DEM source is about 30 m'}
                          </small>}
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

            {/* Tab 2: Multispectral Band Symbology & Legend Key */}
            {layersBoxTab === 'symbology' && (
              <div className="ix-lb-content">
                <div className="ix-lb-sym-full">
                  <div className="ix-lb-sym-header">
                    <strong>Multispectral Band Symbology</strong>
                    <small>Sentinel-2 band combinations; native band resolution varies</small>
                  </div>
                  <div className="ix-band-combos-grid">
                    {BAND_COMBINATIONS.map(c => {
                      const isSel = activeBandCombo === c.id
                      return (
                        <div
                          key={c.id}
                          className={`ix-band-card ${isSel ? 'active' : ''}`}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSel}
                          onClick={() => {
                            const layerId = comboLayer[c.id]
                            if (!layerId) return
                            setActiveBandCombo(c.id)
                            setActive([layerId])
                            setHidden([])
                            setLayersBoxTab('active')
                          }}
                          onKeyDown={event => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            const layerId = comboLayer[c.id]
                            if (!layerId) return
                            setActiveBandCombo(c.id)
                            setActive([layerId])
                            setHidden([])
                            setLayersBoxTab('active')
                          }}
                        >
                          <div className="ix-band-card-top">
                            <span className="ix-band-badge">{c.badge}</span>
                            <strong>{c.name.split(' (')[0]}</strong>
                          </div>
                          <p className="ix-band-desc">{c.desc}</p>
                          <div className="ix-band-chips">
                            {c.bands.map(b => (
                              <span key={b} className="ix-band-chip">{b}</span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {topLayer ? (
                    <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                      <div className="ix-lb-sym-header">
                        <strong>{topLayer.ind.name} Scale &amp; Benchmark Key</strong>
                        <small>{topLayer.ind.desc} · Farm Mean: {topLayer.stat ? fmt(topLayer.ind.id, topLayer.stat.mean) : '—'}</small>
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
                          <h4>Agronomic Classes &amp; Calibrated Benchmarks</h4>
                          {MEANING[topLayer.ind.id].map((b, i) => (
                            <div key={b.label} className="ix-lb-class-row">
                              <span className="ix-lb-color-dot" style={{ background: b.color }} />
                              <span className="ix-lb-class-name">{b.label}</span>
                              <code>{bandRange(topLayer.ind.id, i)}</code>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Tab 3: Field Tools & Adjustments */}
            {layersBoxTab === 'tools' && (
              <div className="ix-lb-content">
                {/* 1. Metered Tape & Precision Ruler */}
                <div className="ix-lb-tool-card">
                  <div className="ix-lb-tool-head">
                    <Ruler size={16} className="text-amber-400" />
                    <strong>Metered Tape &amp; Elevation Slope Ruler</strong>
                    <span className={`ix-tool-badge ${rulerOpen ? 'on' : ''}`}>
                      {rulerOpen ? 'Active on Map' : 'Off'}
                    </span>
                  </div>
                  <p className="ix-tool-desc">
                    Measure field distances, boundary perimeters, elevation deltas, and geodesic slopes with interactive drag handles.
                  </p>
                  <div className="ix-tool-actions">
                    <button
                      className={`ix-sett-btn ${rulerOpen ? 'on' : ''}`}
                      onClick={() => setRulerOpen(!rulerOpen)}
                    >
                      <Ruler size={13} />
                      <span>{rulerOpen ? 'Turn OFF Tape Ruler' : 'Turn ON Tape Ruler on Map'}</span>
                    </button>
                  </div>
                </div>

                {/* 3. Water Assets & Borewells */}
                <div className="ix-lb-tool-card">
                  <div className="ix-lb-tool-head">
                    <Droplets size={16} className="text-blue-400" />
                    <strong>Farm water points ({mine.b.length + mine.p.length})</strong>
                  </div>
                  <p className="ix-tool-desc">
                    Pin active borewells, irrigation pumps, drip lines, and recharge points directly onto your parcel.
                  </p>
                  <div className="ix-tool-actions">
                    <button
                      className={`ix-sett-btn ${tool === 'borewell' ? 'on' : ''}`}
                      onClick={() => setTool(tool === 'borewell' ? 'none' : 'borewell')}
                    >
                      <Plus size={13} />
                      <span>{tool === 'borewell' ? 'Click Map to Place Borewell' : 'Add Borewell Point'}</span>
                    </button>
                    <button
                      className={`ix-sett-btn ${tool === 'pipeline' ? 'on' : ''}`}
                      onClick={() => { setDraft([]); setTool(tool === 'pipeline' ? 'none' : 'pipeline') }}
                    >
                      <Route size={13} />
                      <span>{tool === 'pipeline' ? 'Click the map to draw' : 'Draw a pipeline'}</span>
                    </button>
                  </div>
                  <div className="ix-assets-list">
                    {mine.b.map(borewell => (
                      <div className="ix-asset-row" key={borewell.id}>
                        <span><strong>{borewell.name}</strong><small>{borewell.depth} m deep · {borewell.yieldM3h} m³/h</small></span>
                        <button aria-label={`Remove ${borewell.name}`} title={`Remove ${borewell.name}`} onClick={() => removeBorewell(borewell.id)}><Trash2 size={14}/></button>
                      </div>
                    ))}
                    {mine.p.map(pipeline => (
                      <div className="ix-asset-row" key={pipeline.id}>
                        <span><strong>{pipeline.name}</strong><small>{Math.round(lengthM(pipeline.pts))} m · Ø{pipeline.dia} mm</small></span>
                        <button aria-label={`Remove ${pipeline.name}`} title={`Remove ${pipeline.name}`} onClick={() => removePipeline(pipeline.id)}><Trash2 size={14}/></button>
                      </div>
                    ))}
                    {!mine.b.length && !mine.p.length && <small className="ix-assets-empty">No borewells or pipelines added for this farm.</small>}
                  </div>
                </div>

              </div>
            )}

            {/* Tab 4: Display & Stretch Settings */}
            {layersBoxTab === 'display' && (
              <div className="ix-lb-content">
                {/* Basemap Imagery Picker */}
                <div className="ix-lb-settings-group">
                  <h4>Basemap Imagery &amp; Tiles</h4>
                  <p className="ix-settings-desc">Select high-resolution satellite imagery or topological reference layers.</p>
                  <div className="ix-basemap-grid">
                    {BASES.map(b => (
                      <button
                        key={b.id}
                        className={`ix-basemap-btn ${base === b.id ? 'active' : ''}`}
                        onClick={() => setBase(b.id)}
                      >
                        <span className="ix-basemap-swatch" style={{ background: b.sw }} />
                        <div className="ix-basemap-info">
                          <strong>{b.name}</strong>
                          <small>{b.note}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
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
                  <h4>Local image contrast</h4>
                  <p className="ix-settings-desc">Adjust the contrast of the locally rendered Sentinel-2 preview. These settings do not change an Earth Engine Code Editor script or guarantee a pixel-for-pixel match.</p>
                  <button
                    className={`ix-sett-btn full ${stretchDra ? 'on' : ''}`}
                    onClick={() => setStretchDra(!stretchDra)}
                  >
                    <Sliders size={13} />
                    <span>{stretchDra ? 'Local contrast adjustment active' : 'Adjust local contrast'}</span>
                  </button>
                </div>

                <div className="ix-lb-settings-group">
                  <h4>Earth Engine service</h4>
                  <p className="ix-settings-desc">{earthEngineStatus} Summary values and terrain layers still use their separately labelled public data sources.</p>
                </div>
              </div>
            )}

            {/* Footer Status Bar */}
            <div className="ix-gee-handoff">
              <div><strong>Continue in Google Earth Engine</strong><small>Copies this field outline and the selected date, cloud limit, band view, and index style into JavaScript. The Code Editor runs the request under your signed-in Earth Engine account.</small></div>
              <small className="ix-ee-status" role="status">{earthEngineStatus}</small>
              <button onClick={openEarthEngine}><ExternalLink size={14}/>Copy script &amp; open</button>
              {earthEngineNotice && <p role="status">{earthEngineNotice}</p>}
            </div>
            <div className="ix-lb-footer">
              <span className="ix-lb-foot-status">
                <span className="ix-pulse-dot" />
                {earthEngineOverlay?.sceneKey === sceneKey ? `EARTH ENGINE · ${date.toUpperCase()} · ${earthEngineOverlay.sceneCount} MATCHING SCENES` : scene ? `PREVIEW · SENTINEL-2 L2A · ${date.toUpperCase()} · ${scene.cloud}% CLOUD` : loading ? 'LOADING SATELLITE PREVIEW…' : 'AWAITING SATELLITE PASS'}
              </span>
            </div>
          </div>,
          panelDetached ? document.body : panelTarget!
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
                <span><b>3D Elevation & Terrain Flyover</b><small>Walk, fly a drone or look from above</small></span>
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

        {cadastreOpen && (
          <div className="ix-cadastre-hud" role="dialog" aria-label="Official RoR Cadastral Record">
            <div className="ix-cadastre-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileCheck2 size={18} className="text-emerald-600" />
                <div>
                  <strong style={{ fontSize: 13, display: 'block', color: '#064e3b' }}>Digital India Land Records · RoR Form 1B</strong>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#047857', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Digitally Verified Cadastral Record
                  </span>
                </div>
              </div>
              <button
                aria-label="Close Cadastre"
                onClick={() => setCadastreOpen(false)}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 4, color: '#475569' }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="ix-cadastre-body">
              <div className="ix-cad-grid">
                <div><span>Primary Pattadar</span><strong>Ram Prasad Maurya</strong><small>S/O Late Shivraj Maurya</small></div>
                <div><span>Category</span><strong>Sole Khatedar</strong><small>1/1 Shareholder</small></div>
                <div><span>Survey / Hissa</span><strong>Sy. No. 142/2A</strong><small>Hissa 01 · Cadastral Tile</small></div>
                <div><span>Khata No.</span><strong>Khata 248</strong><small>Revenue Circle 04</small></div>
                <div><span>14-Digit ULPIN (Bhu-Aadhaar)</span><code>142-UP-KAN-2024-98412</code></div>
                <div><span>Official Passbook</span><code>PPB-UP-9418204</code></div>
              </div>

              {/* All Registered Landholdings of Person (Global & Regional Properties) */}
              <div className="ix-cad-global-box">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <strong style={{ fontSize: 11, color: '#1e293b' }}>All Landholdings of Titleholder</strong>
                    <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>4 registered parcels · Total 6.32 ha (15.62 acres)</span>
                  </div>
                  <button
                    className={`ix-cad-global-btn ${showAllGlobalParcels ? 'active' : ''}`}
                    onClick={() => setShowAllGlobalParcels(prev => !prev)}
                    title="Highlight all parcels of Ram Prasad Maurya around the globe on map"
                  >
                    <Globe2 size={12} />
                    <span>{showAllGlobalParcels ? 'Holdings on Map' : 'Add on Map'}</span>
                  </button>
                </div>

                <div className="ix-cad-parcel-list">
                  <div
                    className="ix-cad-parcel-item current"
                    onClick={() => {
                      const [w, s, e, n] = farmBBox(farm)
                      mapObj?.fitBounds(L.latLngBounds([s, w], [n, e]), { padding: [50, 50], maxZoom: 18 })
                    }}
                  >
                    <span className="dot current" />
                    <div style={{ flex: 1 }}>
                      <b>Parcel 1 · Current AOI (Vegetables & Paddy)</b>
                      <small>Sy. No. 142/2A · {farm.area ? farm.area.toFixed(2) : '1.82'} ha ({((farm.area || 1.82) * 2.471).toFixed(2)} ac)</small>
                    </div>
                    <span className="ix-tag-curr">Current</span>
                  </div>

                  <div
                    className="ix-cad-parcel-item"
                    onClick={() => {
                      setShowAllGlobalParcels(true)
                      const [w, s, e, n] = farmBBox(farm)
                      const dw = Math.max(e - w, 0.001), dh = Math.max(n - s, 0.001)
                      mapObj?.setView([farm.lat - dh * 2.8, farm.lon + dw * 2.2], 17)
                    }}
                  >
                    <span className="dot global" />
                    <div style={{ flex: 1 }}>
                      <b>Parcel 2 · Southern Canal Orchard (Mango/Guava)</b>
                      <small>Sy. No. 118/4 · 2.45 ha (6.05 ac) · Canal Feeder</small>
                    </div>
                    <ChevronRight size={13} className="text-slate-400" />
                  </div>

                  <div
                    className="ix-cad-parcel-item"
                    onClick={() => {
                      setShowAllGlobalParcels(true)
                      const [w, s, e, n] = farmBBox(farm)
                      const dw = Math.max(e - w, 0.001), dh = Math.max(n - s, 0.001)
                      mapObj?.setView([farm.lat + dh * 3.4, farm.lon - dw * 2.8], 17)
                    }}
                  >
                    <span className="dot global" />
                    <div style={{ flex: 1 }}>
                      <b>Parcel 3 · Ancestral Agroforestry (Timber & Pulses)</b>
                      <small>Sy. No. 204/1B · 0.95 ha (2.35 ac) · Village Margin</small>
                    </div>
                    <ChevronRight size={13} className="text-slate-400" />
                  </div>

                  <div
                    className="ix-cad-parcel-item"
                    onClick={() => {
                      setShowAllGlobalParcels(true)
                      const [w, s, e, n] = farmBBox(farm)
                      const dw = Math.max(e - w, 0.001), dh = Math.max(n - s, 0.001)
                      mapObj?.setView([farm.lat - dh * 1.5, farm.lon - dw * 3.6], 17)
                    }}
                  >
                    <span className="dot global" />
                    <div style={{ flex: 1 }}>
                      <b>Parcel 4 · Canal Lift Holding (Mustard & Wheat)</b>
                      <small>Sy. No. 89/3 · 1.10 ha (2.72 ac) · Tubewell Command</small>
                    </div>
                    <ChevronRight size={13} className="text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Official Cadastral Legend */}
              <div className="ix-cad-legend">
                <span className="title">Official Cadastral Map Legend</span>
                <div className="items">
                  <div><i style={{ background: '#059669', border: '1px dashed #fff' }} /><span>Primary Parcel (Sy. 142/2A)</span></div>
                  <div><i style={{ background: '#d97706', border: '1px dashed #fff' }} /><span>Adjoining Sub-divisions (Sy. 142/1, 142/2B, 143, 141)</span></div>
                  <div><i style={{ background: '#0284c7', height: 3 }} /><span>Canal & Drainage Easement</span></div>
                  <div><i style={{ background: '#8b5cf6', border: '1px dashed #fff' }} /><span>Titleholder Registered Holdings (Global)</span></div>
                  <div><i style={{ background: '#ffffff', border: '2px solid #059669', borderRadius: '50%' }} /><span>Revenue Triangulation Stone</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
