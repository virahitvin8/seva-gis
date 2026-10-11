import LogoLoader from './LogoLoader'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { createPortal } from 'react-dom'
import {
  Check, Eye, EyeOff, Box, CircleDot, LocateFixed, Route, Plus, Search,
  SlidersHorizontal, X, Wrench, Move, Globe2, Mountain, Droplets, Layers,
  Lock, LockOpen, Map as MapIcon, Ruler, Maximize2, Tag, ExternalLink,
  Sliders, ChevronRight, Trash2, FileCheck2, Scissors, RotateCcw,
  Minus, Edit3, Save, Users, CheckCircle2, Cpu, Sparkles, Compass, FileText
} from 'lucide-react'
import GeeAgentCenter from './GeeAgentCenter'
import {
  GROUPS, INDICATORS, MEANING, bandFor, bandRange, byId, verdict,
  compass, gradientCss, renderLayer, sampleAt, type Grid, type Layer, type Group
} from './lib/indicators'
import { pixelAt, type ResamplingMethod } from './lib/raster'
import { ndviClass } from './lib/agro'
import { addBorewell, addPipeline, lengthM, removeBorewell, removePipeline, useAssets } from './lib/assets'
import NearbyLayer from './NearbyLayer'
import MapKit, { KIT_DEFAULT, type Kit } from './MapKit'
import RulerTape from './RulerTape'
import { BAND_COMBINATIONS } from './lib/geoai'
import { areaHa } from './lib/geo'
import { farmBBox, farmRing, loadDem, loadScene, type FarmData, type SceneOpts } from './lib/seva'
import { buildEarthEngineScript, buildThesisMapScript, supportsEarthEngineIndicator } from './lib/earthEngine'
import { createEarthEngineMap, isEarthEngineConfigured, renderFarmSentinel2 } from './lib/earthEngineClient'
import { getSavedZoom, setGlobalZoom } from './lib/zoomSync'
import { getGroundTalk } from './lib/plainTalk'

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
const layerToBandCombo: Record<string, string> = {
  rgb: 'natural',
  cir: 'cir',
  agri: 'agri',
  moist_rgb: 'moisture',
  swir_rgb: 'swir',
  re_rgb: 'chlorophyll',
  geology_rgb: 'geology',
  qgis_ortho: 'natural',
}
const STORE = 'seva-indicators'
const ESRI = (n: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/${n}/MapServer/tile/{z}/{y}/{x}`
const BASES: { id: string; name: string; note: string; sw: string }[] = [
  { id: 'hybrid', name: 'Google Hybrid', note: 'Ultra-clear 0.3m optical imagery + roads (No voids)', sw: 'linear-gradient(135deg,#2e4d25,#e8e8e8)' },
  { id: 'sat', name: 'Google Satellite', note: 'Pure sub-meter optical satellite imagery', sw: 'linear-gradient(135deg,#2e4d25,#5a7a3b)' },
  { id: 'esri', name: 'Esri World Imagery', note: 'Esri World Imagery (Maxar)', sw: 'linear-gradient(135deg,#3b5a2c,#8a7a52)' },
  { id: 'streets', name: 'OpenStreetMap', note: 'Roads, towns and landmarks', sw: 'linear-gradient(135deg,#f2efe9,#aad3df)' },
  { id: 'terrain', name: 'Terrain', note: 'Height and landforms (Esri Topo)', sw: 'linear-gradient(135deg,#d9e8c4,#c9b48a)' },
  { id: 'light', name: 'Light Canvas', note: 'Quiet pale map', sw: 'linear-gradient(135deg,#f4f4f4,#d4d9dc)' },
  { id: 'dark', name: 'Dark Canvas', note: 'Dark map, colours stand out', sw: 'linear-gradient(135deg,#222,#444)' },
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
  const [earthEngineOverlay, setEarthEngineOverlay] = useState<{
    tileUrl?: string
    imageUrl?: string
    bounds?: [[number, number], [number, number]]
    layerId: string
    sceneKey: string
    sceneCount: string
  } | null>(null)
  const [earthEngineStatus, setEarthEngineStatus] = useState('')
  const earthEngineTiles = useRef<L.TileLayer | null>(null)
  const earthEngineImageOverlay = useRef<L.ImageOverlay | null>(null)
  const [panel, setPanel] = useState(false)
  const [baseOpen, setBaseOpen] = useState(false)
  const [nearOpen, setNearOpen] = useState(false)
  const [rulerOpen, setRulerOpen] = useState(false)
  const [rulerActive, setRulerActive] = useState(false)
  const rulerOpenRef = useRef(false)
  rulerOpenRef.current = rulerOpen
  const [base, setBase] = useState(() => {
    const saved = localStorage.getItem(BASE_STORE)
    return (saved && saved !== 'streets' && saved !== 'original') ? saved : 'hybrid'
  })
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
  const scene = farm.analysis?.scene

  // Detachable Data Box States
  const [dataDetached, setDataDetached] = useState(false)
  const [dataPos, setDataPos] = useState({ x: 24, y: 140 })
  const [dataDragging, setDataDragging] = useState(false)
  const [dataMinimized, setDataMinimized] = useState(false)
  const dataDragOffset = useRef({ x: 0, y: 0 })

  const [geeCenterOpen, setGeeCenterOpen] = useState(false)

  // Cartographic Thesis Print Frame Mode
  const [thesisFrameOpen, setThesisFrameOpen] = useState(false)
  const [thesisTheme, setThesisTheme] = useState<'dem' | 'lulc' | 'soil' | 'stations' | 'discharge' | 'dotty'>('dem')
  const [customCartoTitle, setCustomCartoTitle] = useState<string | null>(null)
  const [editingCartoTitle, setEditingCartoTitle] = useState(false)
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [cartoLegendPos, setCartoLegendPos] = useState({ x: 28, y: 140 })
  const [cartoLegendDragging, setCartoLegendDragging] = useState(false)
  const [cartoLegendMinimized, setCartoLegendMinimized] = useState(false)
  const cartoLegendDragOffset = useRef({ x: 0, y: 0 })

  // Geodesic Custom Buffer Zone Tool State
  const [bufferDist, setBufferDist] = useState<number>(20)
  const [bufferUnit, setBufferUnit] = useState<'m' | 'km'>('m')
  const [bufferActive, setBufferActive] = useState<boolean>(false)

  const handleDownloadMap = (format: 'png' | 'geotiff' | 'geojson' | 'kml') => {
    const farmRingCoords = farmRing(farm)
    if (format === 'geojson') {
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: farm.name, areaHa: farm.area, crs: 'EPSG:4326', provider: 'SEVA·GIS' },
            geometry: { type: 'Polygon', coordinates: [farmRingCoords] }
          }
        ]
      }
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${farm.name.replace(/\W+/g, '_')}_AOI.geojson`
      a.click()
      return
    }
    if (format === 'kml') {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${farm.name} AOI</name>
    <Placemark>
      <name>${farm.name}</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${farmRingCoords.map(([lon, lat]) => `${lon},${lat},0`).join(' ')}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`
      const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${farm.name.replace(/\W+/g, '_')}_AOI.kml`
      a.click()
      return
    }
    if (format === 'geotiff') {
      const [w, s, e, n] = farmBBox(farm)
      const tfw = `${((e - w) / 512).toFixed(10)}\n0.0000000000\n0.0000000000\n${(-((n - s) / 512)).toFixed(10)}\n${w.toFixed(10)}\n${n.toFixed(10)}`
      const blob = new Blob([tfw], { type: 'text/plain' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${farm.name.replace(/\W+/g, '_')}_WorldFile.tfw`
      a.click()
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = bgMode === 'black' ? '#000000' : bgMode === 'white' ? '#ffffff' : '#0b131a'
      ctx.fillRect(0, 0, 1200, 800)
      ctx.font = 'bold 22px Inter, sans-serif'
      ctx.fillStyle = bgMode === 'white' ? '#0f172a' : '#ffffff'
      ctx.fillText(`${customCartoTitle || 'SEVA·GIS Precision Cartographic Map'} · ${farm.name}`, 40, 50)
      ctx.font = '14px Inter, sans-serif'
      ctx.fillStyle = '#64748b'
      ctx.fillText(`Area: ${farm.area?.toFixed(2) || '1.50'} ha · Coordinates: ${farm.lat.toFixed(5)}°N, ${farm.lon.toFixed(5)}°E · WGS84`, 40, 80)
      
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 3
      ctx.beginPath()
      const [w, s, e, n] = farmBBox(farm)
      farmRingCoords.forEach(([lon, lat], i) => {
        const cx = 100 + ((lon - w) / (e - w || 0.001)) * 1000
        const cy = 120 + ((n - lat) / (n - s || 0.001)) * 600
        if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy)
      })
      ctx.closePath()
      ctx.stroke()
      ctx.fillStyle = 'rgba(34, 197, 94, 0.15)'
      ctx.fill()

      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `${farm.name.replace(/\W+/g, '_')}_CartoMap.png`
      a.click()
    }
  }

  const userFarmsList = useMemo(() => {
    try {
      const raw = localStorage.getItem('seva-farms')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed.filter((f: any) => !f.sample)
      }
    } catch {}
    return [farm]
  }, [farm])
  const geo = farm.polygon && farm.polygon.length >= 3
    ? `${farm.id}:${farm.polygon.map(([lon, lat]) => `${(lon ?? 0).toFixed(7)},${(lat ?? 0).toFixed(7)}`).join(';')}`
    : `${farm.id}:${(farm.lat ?? 20.5937).toFixed(7)}:${(farm.lon ?? 78.9629).toFixed(7)}:${(farm.area ?? 1.5).toFixed(4)}`
  const sceneKey = scene ? `${scene.id}:${(scene.ids ?? []).join('+')}:${(scene.fill ?? []).join('+')}` : 'no-scene'

  // GIS Engine Controls: Background mode, Dynamic Range Adjustment (DRA), High-DPI Clarity
  // Default to 'default' (Natural satellite basemap with clear boundary overlay).
  // Cleanly resets any stale 'black' or 'white' background in localStorage that caused repeating black-screen traps.
  const [bgMode, setBgMode] = useState<'default' | 'black' | 'white'>(() => {
    try {
      const saved = localStorage.getItem('seva-map-bg')
      if (saved === 'black' || saved === 'white') {
        localStorage.removeItem('seva-map-bg')
      }
    } catch {}
    return 'default'
  })
  useEffect(() => { localStorage.setItem('seva-map-bg', bgMode) }, [bgMode])

  const [stretchDra, setStretchDra] = useState(() => localStorage.getItem('seva-stretch-dra-v2') !== '0')
  useEffect(() => { localStorage.setItem('seva-stretch-dra-v2', stretchDra ? '1' : '0') }, [stretchDra])

  // GIS Raster Resampling Method: Cubic Spline (default for small parcels), Bilinear, or Nearest Neighbour
  const [resamplingMethod, setResamplingMethod] = useState<ResamplingMethod>(() => {
    try {
      const saved = localStorage.getItem('seva-resampling-method')
      if (saved === 'nearest' || saved === 'bilinear' || saved === 'cubic') return saved
    } catch {}
    return 'cubic'
  })
  useEffect(() => {
    localStorage.setItem('seva-resampling-method', resamplingMethod)
  }, [resamplingMethod])

  // Dedicated Layers Box (Table of Contents / Symbology manager)
  const [layersBoxOpen, setLayersBoxOpen] = useState(false)
  useEffect(() => { localStorage.setItem('seva-lb-open-v2', layersBoxOpen ? '1' : '0') }, [layersBoxOpen])
  const [panelDetached, setPanelDetached] = useState(false)
  const [panelPosition, setPanelPosition] = useState({ x: 24, y: 96 })
  const [panelDragging, setPanelDragging] = useState(false)
  const [panelMinimized, setPanelMinimized] = useState(false)
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
    if (!dataDragging) return
    const move = (event: PointerEvent) => setDataPos({
      x: Math.max(8, Math.min(window.innerWidth - 300, event.clientX - dataDragOffset.current.x)),
      y: Math.max(8, Math.min(window.innerHeight - 60, event.clientY - dataDragOffset.current.y)),
    })
    const end = () => setDataDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }
  }, [dataDragging])

  useEffect(() => {
    if (!cartoLegendDragging) return
    const move = (event: PointerEvent) => setCartoLegendPos({
      x: Math.max(8, Math.min(window.innerWidth - 320, event.clientX - cartoLegendDragOffset.current.x)),
      y: Math.max(8, Math.min(window.innerHeight - 80, event.clientY - cartoLegendDragOffset.current.y)),
    })
    const end = () => setCartoLegendDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }
  }, [cartoLegendDragging])

  useEffect(() => {
    if (!map.current) return
    const timer = window.setTimeout(() => map.current?.invalidateSize({ pan: false }), 120)
    return () => window.clearTimeout(timer)
  }, [layersBoxOpen, panelDetached])

  const layerKey = (id: string) => `${byId(id).source === 'DEM' ? 'dem' : sceneKey}:${geo}:${id}:${stretchDra ? 'dra' : 'std'}:${resamplingMethod}`
  const pickedRef = useRef(setPicked)
  pickedRef.current = setPicked

  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(active)) }, [active])

  // Strict 75% Box Ratio Auto Zoom & MinZoom Boundary
  // Automatically resizes and fits the AOI so it fills 75% of the viewport container (12.5% padding on each margin).
  // Constrains zoom within safe bounds (13 to 18) so imagery never exceeds native resolution,
  // overcoming black-screen tile void glitches while maintaining cartographic scale.
  const fit75PercentAoi = (instance: L.Map, animate = false, enforceMinZoom = false) => {
    if (!instance || !(instance as any)._loaded) return
    try {
      const [w, s, e, n] = farmBBox(farm)
      const bounds = L.latLngBounds([s, w], [n, e])
      if (!bounds.isValid()) return

      const sz = instance.getSize()
      if (!sz || sz.x <= 0 || sz.y <= 0) {
        instance.invalidateSize({ pan: false })
        instance.setView([farm.lat, farm.lon], 16)
        return 16
      }

      const padX = Math.max(30, Math.round(sz.x * 0.125))
      const padY = Math.max(30, Math.round(sz.y * 0.125))
      const computedZoom = instance.getBoundsZoom(bounds, false, L.point(padX * 2, padY * 2))
      const safeAoiZoom = Math.min(18, Math.max(13, computedZoom))

      instance.fitBounds(bounds, {
        paddingTopLeft: [padX, padY],
        paddingBottomRight: [padX, padY],
        maxZoom: 18,
        animate,
      })

      if (enforceMinZoom) {
        setTimeout(() => {
          try {
            if (instance && (instance as any)._loaded) {
              instance.setMinZoom(safeAoiZoom)
              instance.setMaxZoom(19)
            }
          } catch {}
        }, 50)
      }
      return safeAoiZoom
    } catch (err) {
      console.warn('fit75PercentAoi safe catch:', err)
    }
  }

  useEffect(() => {
    localStorage.setItem('seva-map-lock', locked ? '1' : '0')
    const m = mapObj
    if (!m || !(m as any)._loaded) return

    try {
      // Safely stop any running pan or zoom animation before toggling handlers
      if (typeof (m as any).stop === 'function') {
        (m as any).stop()
      }

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

      if (locked) {
        // When locking, fit AOI cleanly and enforce constant zoom scale
        fit75PercentAoi(m, false, true)
      } else {
        // When unlocking, allow zooming out freely without resetting view or bounds
        m.setMinZoom(3)
        m.setMaxZoom(19)
      }

      requestAnimationFrame(() => {
        try { m.invalidateSize({ pan: false }) } catch {}
        baseLayers.current.forEach(l => { try { l.redraw() } catch {} })
      })
      const t = setTimeout(() => {
        try { m.invalidateSize({ pan: false }) } catch {}
        baseLayers.current.forEach(l => { try { l.redraw() } catch {} })
      }, 80)
      return () => clearTimeout(t)
    } catch (err) {
      console.warn('Map lock state toggle safe catch:', err)
    }
  }, [locked, mapObj, farm])

  // Automatic wake/unlock recovery and container resize observer
  useEffect(() => {
    const el = element.current
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

    let ro: ResizeObserver | null = null
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        m.invalidateSize({ pan: false })
      })
      ro.observe(el)
    }

    return () => {
      document.removeEventListener('visibilitychange', handleWakeAndVisibility)
      window.removeEventListener('focus', handleWakeAndVisibility)
      window.removeEventListener('pageshow', handleWakeAndVisibility)
      window.removeEventListener('resize', handleWakeAndVisibility)
      if (ro) ro.disconnect()
    }
  }, [mapObj])


  useEffect(() => {
    if (!element.current) return
    if ((element.current as any)._leaflet_id) {
      delete (element.current as any)._leaflet_id
    }
    const safeLat = Number.isFinite(farm?.lat) ? farm.lat : 20.5937
    const safeLon = Number.isFinite(farm?.lon) ? farm.lon : 78.9629
    const initialZoom = getSavedZoom(15)
    let instance: L.Map
    try {
      instance = L.map(element.current, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true, // Always instantiate handler so it can be safely toggled by lock/unlock
        wheelPxPerZoomLevel: 100,
        wheelDebounceTime: 40,
      }).setView([safeLat, safeLon], initialZoom)
    } catch (err) {
      console.warn('Map initialization retry after clearing container state:', err)
      if ((element.current as any)._leaflet_id) {
        delete (element.current as any)._leaflet_id
      }
      instance = L.map(element.current, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
        wheelPxPerZoomLevel: 100,
        wheelDebounceTime: 40,
      }).setView([safeLat, safeLon], initialZoom)
    }
    map.current = instance
    setMapObj(instance)
    L.control.zoom({ position: 'bottomright' }).addTo(instance)

    // Staggered size invalidation to guarantee tile loading across all browser render passes
    const timers = [40, 150, 350, 750, 1500].map(delay =>
      setTimeout(() => {
        if (instance && instance.getContainer()) {
          fit75PercentAoi(instance, false)
          instance.invalidateSize({ pan: false })
        }
      }, delay)
    )

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
      if (t.tool === 'borewell') { addBorewell({ farmId: t.farmId, name: `Borewell ${t.n + 1}`, lat, lon: lng, depth: 90, level: 25, yieldM3h: 5, hours: 6 }); setTool('none'); return }
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

    const syncView = () => {
      const z = instance.getZoom()
      const c = instance.getCenter()
      setGlobalZoom(z, { lat: c.lat, lon: c.lng })
      try {
        const b = instance.getBounds()
        localStorage.setItem('seva-map-view-bounds', JSON.stringify({
          bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
          zoom: z,
          center: [c.lat, c.lng]
        }))
      } catch {}
    }
    const onMouseMove = (e: L.LeafletMouseEvent) => {
      setMouseCoords({ lat: e.latlng.lat, lon: e.latlng.lng })
    }
    const onMouseOut = () => {
      setMouseCoords(null)
    }
    instance.on('mousemove', onMouseMove)
    instance.on('mouseout', onMouseOut)

    instance.on('zoomend', syncView)
    instance.on('moveend', syncView)

    return () => {
      timers.forEach(t => clearTimeout(t))
      instance.off('zoomend', syncView)
      instance.off('moveend', syncView)
      instance.off('mousemove', onMouseMove)
      instance.off('mouseout', onMouseOut)
      el.removeEventListener('wheel', onWheel)
      instance.remove()
      map.current = null
    }
  }, [])

  // Base map tile handling (always renders robust basemap tiles underneath)
  useEffect(() => {
    const instance = mapObj
    if (!instance) return
    localStorage.setItem(BASE_STORE, base)
    baseLayers.current.forEach(l => l.remove()); baseLayers.current = []

    if (bgMode === 'black' || bgMode === 'white') {
      if (element.current) {
        element.current.style.backgroundColor = bgMode === 'black' ? '#000000' : '#ffffff'
      }
      instance.invalidateSize({ pan: false })
      return () => { baseLayers.current.forEach(l => l.remove()); baseLayers.current = [] }
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
    const google = 'Imagery © Google'
    if (base === 'sat' || base === 'hybrid' || base === 'esri') {
      // blurry underlay so a tile that is still loading or missing is never a black hole
      add(ESRI('World_Imagery'), esri, { maxNativeZoom: 13, zIndex: 8 })
      add(ESRI('World_Imagery'), esri, { maxNativeZoom: 17 })
      if (base === 'hybrid') {
        add('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', google, { maxNativeZoom: 20, maxZoom: 22 })
      } else if (base === 'sat') {
        add('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', google, { maxNativeZoom: 20, maxZoom: 22 })
      }
    } else if (base === 'streets') {
      add('https://tile.openstreetmap.org/{z}/{x}/{y}.png', '© OpenStreetMap contributors', { maxNativeZoom: 19 })
    } else if (base === 'terrain') {
      add(ESRI('World_Topo_Map'), 'Tiles © Esri, USGS, NOAA', { maxNativeZoom: 16 })
    } else if (base === 'light') {
      add(ESRI('Canvas/World_Light_Gray_Base'), 'Tiles © Esri, HERE, Garmin', { maxNativeZoom: 16 })
    } else if (base === 'dark') {
      add(ESRI('Canvas/World_Dark_Gray_Base'), 'Tiles © Esri, HERE, Garmin', { maxNativeZoom: 16 })
    } else if (base === 'original') {
      const validIds = scene ? [scene.id, ...(scene.ids ?? [])].filter(id => id && id.startsWith('S2') && !id.startsWith('gee-') && id !== 'S2_SYNTHETIC') : []
      if (validIds.length > 0) {
        validIds.forEach(id => add(`https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@2x?collection=sentinel-2-l2a&item=${id}&assets=B04&assets=B03&assets=B02&nodata=0&rescale=1000%2C3800&color_formula=gamma%20RGB%201.9%2C%20saturation%201.2%2C%20sigmoidal%20RGB%204%200.45&format=png`, 'Contains modified Copernicus Sentinel data · Microsoft Planetary Computer', { maxNativeZoom: 15, maxZoom: 20 }))
      } else {
        add('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/g/{z}/{y}/{x}.jpg', 'Sentinel-2 cloudless © EOX (Copernicus Sentinel data 2021)', { maxNativeZoom: 13, maxZoom: 20 })
      }
    }
    instance.invalidateSize({ pan: false })
    return () => { baseLayers.current.forEach(l => l.remove()); baseLayers.current = [] }
  }, [mapObj, base, scene?.id, scene?.ids?.join(), bgMode, aoiOnly])

  // Boundary frame and exterior canvas mask with evenodd hole rendering
  useEffect(() => {
    const instance = map.current
    if (!instance || !farm) return
    let group: L.LayerGroup | null = null
    try {
      const [rawW, rawS, rawE, rawN] = farmBBox(farm)
      const w = Number.isFinite(rawW) ? rawW : 78.96
      const s = Number.isFinite(rawS) ? rawS : 20.59
      const e = Number.isFinite(rawE) ? rawE : 78.97
      const n = Number.isFinite(rawN) ? rawN : 20.60
      const rawRing = farmRing(farm)
      let ring: L.LatLngTuple[] = rawRing
        .filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map(p => [p[1], p[0]] as L.LatLngTuple)
      if (ring.length < 3) {
        ring = [[s, w], [s, e], [n, e], [n, w]]
      }

      group = L.layerGroup().addTo(instance)
      frame.current = group

      const bgMapColor = bgMode === 'black' ? '#000000' : bgMode === 'white' ? '#ffffff' : '#0b131a'
      if (element.current) {
        element.current.style.backgroundColor = bgMapColor
      }

      const worldOuter: L.LatLngTuple[] = [
        [-85, -180],
        [-85, 180],
        [85, 180],
        [85, -180],
      ]

      // Area of Interest Clipping Mask: exclusively reveals the AOI while masking surroundings
      if (aoiOnly) {
        L.polygon([worldOuter, ring], {
          fillColor: bgMapColor,
          fillOpacity: 0.94,
          stroke: false,
          interactive: false
        }).addTo(group)
      }

      const strokeColor = bgMode === 'black' ? '#22c55e' : bgMode === 'white' ? '#15803d' : aoiOnly ? '#22c55e' : '#facc15'
      L.polygon(ring, { color: strokeColor, weight: 2.8, fill: false, interactive: false }).addTo(group)

      // Geodesic Buffer Zone Polygon
      if (bufferActive) {
        const distMeters = bufferDist * (bufferUnit === 'km' ? 1000 : 1)
        const latRad = ((s + n) / 2) * (Math.PI / 180)
        const cosLat = Math.cos(latRad)
        const dLat = distMeters / 111320
        const dLon = distMeters / (111320 * Math.max(0.1, cosLat))
        const cLon = (w + e) / 2
        const cLat = (s + n) / 2
        const bufferRing: L.LatLngTuple[] = ring.map(([la, lo]) => {
          const vLat = la - cLat
          const vLon = lo - cLon
          const len = Math.hypot(vLat, vLon) || 0.0001
          return [la + (vLat / len) * dLat, lo + (vLon / len) * dLon] as L.LatLngTuple
        })
        L.polygon(bufferRing, {
          color: '#f59e0b',
          weight: 2.4,
          dashArray: '6 4',
          fillColor: '#f59e0b',
          fillOpacity: 0.14,
          interactive: false
        }).addTo(group)
      }

      // Animated traveling pulse / train signal along the AOI boundary during map processing or scene loading
      if (busy.length > 0 || loading) {
        L.polyline(ring, {
          color: '#38bdf8',
          weight: 4,
          className: 'seva-train-pulse',
          interactive: false
        }).addTo(group)
      }

      fit75PercentAoi(instance, false)
    } catch (err) {
      console.warn('Boundary frame rendering safe catch:', err)
    }

    return () => {
      try {
        group?.remove()
      } catch {}
      frame.current = null
    }
  }, [mapObj, farm.id, geo, dim, bgMode, aoiOnly, locked, busy.length, loading, bufferActive, bufferDist, bufferUnit])

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
            renderLayer(ind, g, ring, { dra: stretchDra, resampling: resamplingMethod })
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
  }, [active.join(), geo, sceneKey, stretchDra, resamplingMethod])

  useEffect(() => {
    const primaryId = [...active].reverse().find(id => !hidden.includes(id) && byId(id).source === 'S2')
    const layer = primaryId ? byId(primaryId) : null
    if (!isEarthEngineConfigured) {
      setEarthEngineOverlay(null)
      setEarthEngineStatus('Planetary Computer · Sentinel-2 (Auto Fallback)')
      return
    }
    const ringCoords = farm.polygon && farm.polygon.length >= 3 ? farm.polygon : farmRing(farm)
    if (!ringCoords || ringCoords.length < 3 || !layer) {
      setEarthEngineOverlay(null)
      setEarthEngineStatus('Set a field location to request Earth Engine primary tiles.')
      return
    }

    const controller = new AbortController()
    setEarthEngineOverlay(null)
    setEarthEngineStatus('Requesting primary Sentinel-2 layer from Google Earth Engine…')

    const effectiveCombo = layer.rgb ? (layerToBandCombo[layer.id] || activeBandCombo || 'natural') : undefined
    createEarthEngineMap({
      farm,
      sceneOpts: sceneOpts ?? {},
      layer,
      bandCombination: effectiveCombo,
      percentileStretch: stretchDra,
    }, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setEarthEngineOverlay({ tileUrl: result.tileUrl, layerId: primaryId!, sceneKey: geo, sceneCount: String(result.sceneCount) })
      setEarthEngineStatus(`Google Earth Engine · Sentinel-2 L2A (Primary Live Stream · ${result.sceneCount} scene${result.sceneCount === '1' ? '' : 's'})`)
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
    earthEngineImageOverlay.current?.remove()
    earthEngineImageOverlay.current = null
    if (!instance || !earthEngineOverlay || hidden.includes(earthEngineOverlay.layerId)) return

    if (earthEngineOverlay.imageUrl && earthEngineOverlay.bounds) {
      const overlay = L.imageOverlay(earthEngineOverlay.imageUrl, earthEngineOverlay.bounds, {
        attribution: 'Sentinel-2 L2A · Google Earth Engine (QGIS Ortho)',
        zIndex: 650,
        opacity: opacity[earthEngineOverlay.layerId] ?? 0.95,
        interactive: false,
        className: 'seva-raster-pixels',
      }).addTo(instance)
      const el = overlay.getElement()
      if (el) {
        el.style.imageRendering = 'pixelated'
      }
      earthEngineImageOverlay.current = overlay
    } else if (earthEngineOverlay.tileUrl) {
      const eeLayer = L.tileLayer(earthEngineOverlay.tileUrl, {
        attribution: 'Sentinel-2 L2A · Google Earth Engine',
        maxZoom: 22,
        maxNativeZoom: 19,
        zIndex: 700,
        opacity: opacity[earthEngineOverlay.layerId] ?? 1,
        crossOrigin: true,
        className: 'seva-raster-pixels',
      })
      eeLayer.addTo(instance)
      earthEngineTiles.current = eeLayer
    }
    return () => {
      earthEngineTiles.current?.remove()
      earthEngineTiles.current = null
      earthEngineImageOverlay.current?.remove()
      earthEngineImageOverlay.current = null
    }
  }, [mapObj, earthEngineOverlay, hidden.join(), JSON.stringify(opacity), sceneKey])

  // Extra Earth Engine tile layers: every visible Sentinel-2 layer except the top one
  const eeExtra = useRef(new Map<string, { key: string; tileUrl: string; layer: L.TileLayer | null }>())
  const [eeExtraTick, setEeExtraTick] = useState(0)
  const extraKey = (id: string) =>
    `${geo}|${sceneKey}|${id}|${byId(id).rgb ? activeBandCombo : '-'}|${stretchDra}|${JSON.stringify(sceneOpts ?? {})}`
  const topS2 = () => [...active].reverse().find(id => !hidden.includes(id) && byId(id).source === 'S2')

  useEffect(() => {
    if (!isEarthEngineConfigured) return
    const topId = topS2()
    const ids = active.filter(id => id !== topId && !hidden.includes(id) && byId(id).source === 'S2')
    const controller = new AbortController()
    ids.forEach(id => {
      const ind = byId(id)
      const key = extraKey(id)
      if (eeExtra.current.get(id)?.key === key) return
      createEarthEngineMap({
        farm,
        sceneOpts: sceneOpts ?? {},
        layer: ind,
        bandCombination: ind.rgb ? activeBandCombo : undefined,
        percentileStretch: stretchDra,
      }, controller.signal).then(result => {
        if (controller.signal.aborted) return
        eeExtra.current.get(id)?.layer?.remove()
        eeExtra.current.set(id, { key, tileUrl: result.tileUrl, layer: null })
        setEeExtraTick(t => t + 1)
      }).catch(error => {
        if (!controller.signal.aborted) console.info('Earth Engine layer failed:', id, error)
      })
    })
    return () => controller.abort()
  }, [active.join(), hidden.join(), geo, sceneKey, stretchDra, activeBandCombo, JSON.stringify(sceneOpts)])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const topId = topS2()
    const wanted = new Set<string>()
    active.forEach((id, index) => {
      const hit = eeExtra.current.get(id)
      if (!hit || id === topId || hidden.includes(id) || hit.key !== extraKey(id)) return
      wanted.add(id)
      if (!hit.layer) {
        hit.layer = L.tileLayer(hit.tileUrl, {
          attribution: 'Sentinel-2 L2A · Google Earth Engine',
          maxZoom: 21,
          maxNativeZoom: 19,
          crossOrigin: true,
          className: 'seva-raster-pixels',
        }).addTo(instance)
      }
      hit.layer.setOpacity(opacity[id] ?? 1)
      hit.layer.setZIndex(600 + index)
    })
    eeExtra.current.forEach((hit, id) => {
      if (!wanted.has(id) && hit.layer) { hit.layer.remove(); hit.layer = null }
    })
  }, [mapObj, active.join(), hidden.join(), JSON.stringify(opacity), eeExtraTick, geo, sceneKey, activeBandCombo, stretchDra])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const wanted = new Set<string>()
    active.forEach((id, index) => {
      // If this layer is directly rendered by Earth Engine (primary or extra), yield and do not draw duplicate client fallback!
      const isRenderedByGEE = (earthEngineOverlay && earthEngineOverlay.layerId === id && (earthEngineTiles.current != null || earthEngineImageOverlay.current != null)) ||
                              (eeExtra.current.get(id)?.layer != null)
      if (isRenderedByGEE) {
        overlays.current.get(id)?.remove()
        overlays.current.delete(id)
        return
      }

      const layer = getCachedLayer(layerKey(id))
      if (!layer || hidden.includes(id)) return
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
    fit75PercentAoi(instance, true)
  }


  return (
    <div className="ix-outer">
      {/* 1-Size Full-Window Control Toolbar Above Map */}
      <div className="ix-main-toolbar" role="toolbar" aria-label="Map Tools and Layers">
        <button
          className={`ix-tb-btn ${layersBoxOpen && layersBoxTab === 'active' ? 'on' : ''}`}
          onClick={() => {
            if (layersBoxOpen && layersBoxTab === 'active') {
              setLayersBoxOpen(false)
            } else {
              setLayersBoxOpen(true)
              setLayersBoxTab('active')
              setPanel(false)
              setTools(false)
              setBaseOpen(false)
              setNearOpen(false)
              setRulerOpen(false)
            }
          }}
          title="Open GIS Section Layer: Active parameters, opacity & blending"
        >
          <Layers size={15}/>
          <span>Layers</span>
          <b className="ix-btn-badge">{active.length}</b>
        </button>

        <button
          className={`ix-tb-btn ${layersBoxOpen && layersBoxTab === 'symbology' ? 'on' : ''}`}
          onClick={() => {
            if (layersBoxOpen && layersBoxTab === 'symbology') {
              setLayersBoxOpen(false)
            } else {
              setLayersBoxOpen(true)
              setLayersBoxTab('symbology')
              setPanel(false)
              setTools(false)
              setBaseOpen(false)
              setNearOpen(false)
              setRulerOpen(false)
            }
          }}
          title="Multispectral Band Symbology: True colour, False colour NIR, Agriculture & Moisture"
        >
          <Tag size={15}/>
          <span>Symbology</span>
          <b className="ix-btn-badge">Bands</b>
        </button>

        <button
          className={`ix-tb-btn ${layersBoxOpen && layersBoxTab === 'display' ? 'on' : ''}`}
          onClick={() => {
            if (layersBoxOpen && layersBoxTab === 'display') {
              setLayersBoxOpen(false)
            } else {
              setLayersBoxOpen(true)
              setLayersBoxTab('display')
              setPanel(false)
              setTools(false)
              setNearOpen(false)
              setRulerOpen(false)
            }
          }}
          title="Select Basemap Imagery in Section Layer"
        >
          <MapIcon size={15}/>
          <span>Base map</span>
          <b className="ix-btn-badge">{BASES.find(b => b.id === base)?.name.split(' ')[0]}</b>
        </button>

        <button
          className={`ix-tb-btn ${bgMode !== 'default' ? 'on' : ''}`}
          onClick={() => { setBgMode(c => c === 'default' ? 'black' : c === 'black' ? 'white' : 'default') }}
          title="Canvas Mode (Natural, Solid Black GEE, Solid White QGIS)"
        >
          <Globe2 size={15}/>
          <span>Canvas</span>
          <b className="ix-btn-badge">{bgMode === 'default' ? 'Natural' : bgMode === 'black' ? 'Black' : 'White'}</b>
        </button>

        <button
          className={`ix-tb-btn ${aoiOnly ? 'on' : ''}`}
          onClick={() => setAoiOnly(!aoiOnly)}
          title={aoiOnly ? "Disable AOI clipping: Show full surroundings" : "Clip AOI from boundary: Shapefile mask exclusively displaying all parameters upon farm boundary"}
        >
          <Scissors size={15}/>
          <span>Clip AOI</span>
          <b className="ix-btn-badge">{aoiOnly ? 'Mask ON' : 'Off'}</b>
        </button>

        <button
          className={`ix-tb-btn ${layersBoxOpen && layersBoxTab === 'tools' ? 'on' : ''}`}
          onClick={() => {
            if (layersBoxOpen && layersBoxTab === 'tools') {
              setLayersBoxOpen(false)
            } else {
              setLayersBoxOpen(true)
              setLayersBoxTab('tools')
              setPanel(false)
              setRulerOpen(false)
            }
          }}
          title="Field Tools & Adjustments (Ruler, Hotspots, Borewells, Contours, Swath Robotics)"
        >
          <Wrench size={15}/>
          <span>Tools</span>
          <b className="ix-btn-badge">Adjust</b>
        </button>

        <button
          className="ix-tb-btn"
          onClick={() => handleDownloadMap('png')}
          title="Download precision map output as high-resolution PNG, GeoTIFF, GeoJSON, or KML"
        >
          <Save size={15}/>
          <span>Export Map</span>
          <b className="ix-btn-badge">PNG / GIS</b>
        </button>

        <button
          className={`ix-tb-btn ${thesisFrameOpen ? 'on' : ''}`}
          onClick={() => setThesisFrameOpen(prev => !prev)}
          title="Toggle Authentic Cartographic Thesis Print Layout Mode (SRTM DEM, LULC 9-Class, Soil 5-Class, Reaches)"
        >
          <Compass size={15}/>
          <span>Carto Frame</span>
          <b className="ix-btn-badge">{thesisFrameOpen ? 'Thesis ON' : 'Off'}</b>
        </button>

        <button
          className={`ix-tb-btn ${geeCenterOpen ? 'on' : ''}`}
          onClick={() => setGeeCenterOpen(prev => !prev)}
          title="Google Earth Engine Live Cloud Stream & Autonomous Agent Crew Studio"
        >
          <Cpu size={15}/>
          <span>GEE Studio</span>
          <b className="ix-btn-badge">{earthEngineOverlay?.sceneKey === sceneKey ? 'Live Stream' : 'AI Crew'}</b>
        </button>

        <button
          className={`ix-tb-btn ${locked ? 'on is-locked-btn' : ''}`}
          onClick={() => setLocked(!locked)}
          title={locked ? 'Map is locked at 75% scale. Click to unlock pan & zoom.' : 'Map is live. Click to lock at 75% scale.'}
        >
          {locked ? <Lock size={15}/> : <LockOpen size={15}/>}
          <span>{locked ? 'Locked' : 'Unlocked'}</span>
          <b className="ix-btn-badge">{locked ? '75% Locked' : 'Live'}</b>
        </button>

        <button
          className="ix-tb-btn"
          onClick={() => {
            setBgMode('default')
            setAoiOnly(false)
            if (map.current) {
              fit75PercentAoi(map.current, true)
              map.current.invalidateSize({ pan: false })
            }
          }}
          title="Reset map: Restore natural satellite imagery, center AOI at 75%, and clear black screen"
        >
          <RotateCcw size={15}/>
          <span>Reset</span>
          <b className="ix-btn-badge">75% Fit</b>
        </button>
      </div>

      <div className="ix-wrap">
        <div ref={element} className={`field-map${locked ? ' is-locked' : ''} bg-${bgMode}`} style={{ backgroundColor: bgMode === 'black' ? '#000000' : bgMode === 'white' ? '#ffffff' : undefined }} />

        {/* Single Unified Non-Redundant Map HUD Bar */}
        <div className="ix-map-hud-bar" role="status" aria-label="Map status and orientation">
          <div
            className="ix-unified-hud"
            title="Click to open Google Earth Engine AI Crew Studio"
            onClick={() => setGeeCenterOpen(true)}
          >
            <span className="gee-dot" />
            <span className="hud-title">{earthEngineOverlay ? 'GEE Live · S2 L2A' : 'Sentinel-2 L2A'}</span>
            <span className="hud-sep">·</span>
            <span>Zoom <b>{mapZoom.toFixed(1)}x</b></span>
            {locked && <span className="zoom-synced-pill">75%</span>}
            <span className="hud-sep">·</span>
            <span className="hud-coords">{mouseCoords ? `${mouseCoords.lat.toFixed(4)}°N, ${mouseCoords.lon.toFixed(4)}°E` : `${(farm?.lat ?? 20.5937).toFixed(4)}°N, ${(farm?.lon ?? 78.9629).toFixed(4)}°E`}</span>
            <span className="hud-sep">·</span>
            <span
              className="hud-north"
              title="True Geodetic North. Click to re-center."
              onClick={(e) => {
                e.stopPropagation()
                if (map.current) map.current.setView([farm?.lat ?? 20.5937, farm?.lon ?? 78.9629], map.current.getZoom())
              }}
            >
              ▲ N 0°
            </span>
          </div>
        </div>

        {/* The Layers & Symbology Box: cleanly docked over map when open, or portaled to body when detached */}
        {layersBoxOpen && (() => {
          const boxContent = (
            <div
              className={`ix-layers-box ${panelDetached ? 'detached' : 'docked-map'}`}
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
                <button
                  className="ix-lb-tool-btn"
                  title={panelMinimized ? 'Expand Layers Box' : 'Minimize Layers Box to clear map view'}
                  aria-label={panelMinimized ? 'Expand Layers Box' : 'Minimize Layers Box'}
                  onClick={() => setPanelMinimized(v => !v)}
                >
                  {panelMinimized ? <Maximize2 size={13} /> : <Minus size={13} />}
                </button>
                <button className="ix-lb-close" onClick={() => setLayersBoxOpen(false)} aria-label="Close Layers Box">
                  <X size={15} />
                </button>
              </div>
            </div>

            {!panelMinimized && (
              <>
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
                <span>Symbology &amp; Resampling</span>
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
                          {layer && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, flexWrap: 'wrap', gap: 4 }}>
                              <small className="ix-lb-resolution-note" style={{ margin: 0 }}>
                                ~{Math.max(1, Math.round(layer.cellSizeM))}m cells · {resamplingMethod === 'cubic' ? 'Cubic Spline (anti-pixelated)' : resamplingMethod === 'bilinear' ? 'Bilinear' : 'Nearest Neighbour'}
                                {ind.source === 'S2' ? ' · S2 (10m)' : ' · DEM (30m)'}
                              </small>
                              <button
                                type="button"
                                onClick={() => setLayersBoxTab('symbology')}
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 600,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: 'rgba(255,255,255,0.06)',
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  color: '#a7f3d0',
                                  cursor: 'pointer'
                                }}
                                title="Change raster resampling method under Layer Properties → Symbology → Resampling"
                              >
                                Symbology &rarr; Resampling
                              </button>
                            </div>
                          )}
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
                  {/* Layer Properties → Symbology → Resampling */}
                  <div
                    className="ix-resampling-control-box"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 95, 70, 0.2))',
                      border: '1px solid rgba(52, 211, 153, 0.45)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      marginBottom: 16,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <SlidersHorizontal size={15} style={{ color: '#34d399' }} />
                        <strong style={{ fontSize: 13, color: '#f8fafc', letterSpacing: '0.01em' }}>
                          Layer Properties &rarr; Symbology &rarr; Resampling
                        </strong>
                      </div>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: 999,
                          background: resamplingMethod === 'cubic' ? '#047857' : resamplingMethod === 'bilinear' ? '#0284c7' : '#475569',
                          color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}
                      >
                        {resamplingMethod === 'cubic' ? 'Cubic Spline (Active)' : resamplingMethod === 'bilinear' ? 'Bilinear (Active)' : 'Nearest (Active)'}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 10px', fontSize: 11, color: '#cbd5e1', lineHeight: 1.45 }}>
                      Removes pixel blockiness on small fields and zoomed parcels. In QGIS / GEE, small areas are smoothed using <b>Cubic</b> (Bicubic Spline Convolution) or <b>Bilinear</b> interpolation instead of raw 10m pixel squares.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
                      <button
                        type="button"
                        className={`ix-sett-btn ${resamplingMethod === 'cubic' ? 'on' : ''}`}
                        style={{
                          padding: '8px 10px',
                          fontSize: 11,
                          borderRadius: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 3,
                          background: resamplingMethod === 'cubic' ? 'rgba(16, 185, 129, 0.28)' : 'rgba(255, 255, 255, 0.05)',
                          border: resamplingMethod === 'cubic' ? '1.5px solid #10b981' : '1px solid rgba(255, 255, 255, 0.12)',
                          color: resamplingMethod === 'cubic' ? '#6ee7b7' : '#e2e8f0',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onClick={() => setResamplingMethod('cubic')}
                        title="Bicubic Spline Convolution (Keys a = -0.5 kernel). Recommended for small areas and high-DPI zoomed parcels."
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontWeight: 700 }}>✨ Cubic (Default)</span>
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#059669', color: '#fff', fontWeight: 700 }}>Smooth</span>
                        </div>
                        <small style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.25 }}>Bicubic spline convolution, zero pixelation</small>
                      </button>

                      <button
                        type="button"
                        className={`ix-sett-btn ${resamplingMethod === 'bilinear' ? 'on' : ''}`}
                        style={{
                          padding: '8px 10px',
                          fontSize: 11,
                          borderRadius: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 3,
                          background: resamplingMethod === 'bilinear' ? 'rgba(2, 132, 199, 0.28)' : 'rgba(255, 255, 255, 0.05)',
                          border: resamplingMethod === 'bilinear' ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
                          color: resamplingMethod === 'bilinear' ? '#38bdf8' : '#e2e8f0',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onClick={() => setResamplingMethod('bilinear')}
                        title="Bilinear interpolation. Continuous linear gradients between cells."
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontWeight: 700 }}>📐 Bilinear</span>
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#0284c7', color: '#fff', fontWeight: 700 }}>Linear</span>
                        </div>
                        <small style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.25 }}>Continuous linear surface interpolation</small>
                      </button>

                      <button
                        type="button"
                        className={`ix-sett-btn ${resamplingMethod === 'nearest' ? 'on' : ''}`}
                        style={{
                          padding: '8px 10px',
                          fontSize: 11,
                          borderRadius: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 3,
                          background: resamplingMethod === 'nearest' ? 'rgba(148, 163, 184, 0.28)' : 'rgba(255, 255, 255, 0.05)',
                          border: resamplingMethod === 'nearest' ? '1.5px solid #94a3b8' : '1px solid rgba(255, 255, 255, 0.12)',
                          color: resamplingMethod === 'nearest' ? '#cbd5e1' : '#94a3b8',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onClick={() => setResamplingMethod('nearest')}
                        title="Nearest Neighbour. Native discrete 10m satellite cells for pixel-by-pixel inspection."
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontWeight: 700 }}>🔲 Nearest Neighbour</span>
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#475569', color: '#fff', fontWeight: 700 }}>10m</span>
                        </div>
                        <small style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.25 }}>Raw discrete 10m grid cell blocks</small>
                      </button>
                    </div>
                  </div>

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

                      {/* Farmer Ground Talk (Plain Friendly Explanation) */}
                      {(() => {
                        const gt = getGroundTalk(topLayer.ind.id)
                        const interp = gt.interpret(topLayer.stat?.mean)
                        return (
                          <div className="ix-ground-talk-card" style={{ marginTop: 14, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 14 }}>🤝</span>
                                <strong style={{ fontSize: 11.5, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Farmer Ground Talk · {gt.plainTitle}
                                </strong>
                              </div>
                              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: interp.rating === 'Great' || interp.rating === 'Good' ? '#065f46' : interp.rating === 'Needs Attention' ? '#854d0e' : '#991b1b', color: '#f0fdf4' }}>
                                {interp.rating}
                              </span>
                            </div>
                            <p style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 1.45, margin: '0 0 8px' }}>
                              {gt.friendConcept}
                            </p>
                            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '8px 10px', borderLeft: '3px solid #10b981' }}>
                              <strong style={{ fontSize: 10.5, color: '#a7f3d0', display: 'block', marginBottom: 2 }}>
                                Practical Field Action:
                              </strong>
                              <span style={{ fontSize: 10.5, color: '#f8fafc', lineHeight: 1.4 }}>
                                {interp.groundAction}
                              </span>
                            </div>
                          </div>
                        )
                      })()}
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
                      onClick={() => {
                        setTool('none')
                        setDraft([])
                        setRulerOpen(!rulerOpen)
                      }}
                    >
                      <Ruler size={13} />
                      <span>{rulerOpen ? 'Turn OFF Tape Ruler' : 'Turn ON Tape Ruler on Map'}</span>
                    </button>
                  </div>
                </div>

                {/* 2. Water Assets & Borewells */}
                <div className="ix-lb-tool-card">
                  <div className="ix-lb-tool-head">
                    <Droplets size={16} className="text-blue-400" />
                    <strong>Water Points &amp; Borewells ({mine.b.length + mine.p.length})</strong>
                  </div>
                  <p className="ix-tool-desc">
                    Pin active borewells, irrigation pumps, drip lines, and recharge points directly onto your parcel.
                  </p>
                  <div className="ix-tool-actions">
                    <button
                      className={`ix-sett-btn ${tool === 'borewell' ? 'on' : ''}`}
                      onClick={() => {
                        setRulerOpen(false)
                        setTool(tool === 'borewell' ? 'none' : 'borewell')
                      }}
                    >
                      <Plus size={13} />
                      <span>{tool === 'borewell' ? 'Click Map to Place Borewell' : 'Add Borewell Point'}</span>
                    </button>
                    <button
                      className={`ix-sett-btn ${tool === 'pipeline' ? 'on' : ''}`}
                      onClick={() => {
                        setRulerOpen(false)
                        setDraft([])
                        setTool(tool === 'pipeline' ? 'none' : 'pipeline')
                      }}
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
                    {!mine.b.length && !mine.p.length && <small className="ix-assets-empty">No borewells or pipelines added for this parcel.</small>}
                  </div>
                </div>

                {/* 3. Custom Geodesic Buffer Zone Tool */}
                <div className="ix-lb-tool-card">
                  <div className="ix-lb-tool-head">
                    <Box size={16} className="text-amber-400" />
                    <strong>Geodesic Buffer Zone Creator</strong>
                    <span className={`ix-tool-badge ${bufferActive ? 'on' : ''}`}>
                      {bufferActive ? `${bufferDist} ${bufferUnit} Active` : 'Off'}
                    </span>
                  </div>
                  <p className="ix-tool-desc">
                    Specify custom perimeter buffer distance in meters or kilometers to analyze surrounding buffer zones, spray setbacks, and canal easements.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '8px 0', background: 'rgba(255,255,255,0.06)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <label style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>Distance:</label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={bufferDist}
                      onChange={e => setBufferDist(Math.max(1, parseFloat(e.target.value) || 1))}
                      style={{ width: '80px', background: '#0f172a', border: '1px solid #475569', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
                    />
                    <select
                      value={bufferUnit}
                      onChange={e => setBufferUnit(e.target.value as 'm' | 'km')}
                      style={{ background: '#0f172a', border: '1px solid #475569', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
                    >
                      <option value="m">Meters (m)</option>
                      <option value="km">Kilometers (km)</option>
                    </select>
                  </div>
                  <div className="ix-tool-actions">
                    <button
                      className={`ix-sett-btn ${bufferActive ? 'on' : ''}`}
                      onClick={() => setBufferActive(!bufferActive)}
                    >
                      <Box size={13} />
                      <span>{bufferActive ? 'Remove Buffer Zone' : `Create ${bufferDist} ${bufferUnit} Buffer on Map`}</span>
                    </button>
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
                  <h4>Background Canvas</h4>
                  <p className="ix-settings-desc">Choose solid Black or White background for maximum clarity and high-contrast Area of Interest boundary inspection.</p>
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
                  <h4>Raster Resampling (Anti-Pixelation)</h4>
                  <p className="ix-settings-desc">Controls interpolation for small parcels. Cubic Spline or Bilinear eliminates blocky pixel squares (Layer Properties &rarr; Symbology &rarr; Resampling).</p>
                  <div className="ix-settings-btns">
                    <button
                      className={`ix-sett-btn ${resamplingMethod === 'cubic' ? 'on' : ''}`}
                      onClick={() => setResamplingMethod('cubic')}
                      title="Bicubic Spline Convolution (Keys a = -0.5 kernel)"
                    >
                      <Sparkles size={13} />
                      <span>Cubic (Spline)</span>
                    </button>
                    <button
                      className={`ix-sett-btn ${resamplingMethod === 'bilinear' ? 'on' : ''}`}
                      onClick={() => setResamplingMethod('bilinear')}
                      title="Bilinear linear interpolation"
                    >
                      <Sliders size={13} />
                      <span>Bilinear</span>
                    </button>
                    <button
                      className={`ix-sett-btn ${resamplingMethod === 'nearest' ? 'on' : ''}`}
                      onClick={() => setResamplingMethod('nearest')}
                      title="Nearest Neighbour (Raw 10m Cells)"
                    >
                      <Box size={13} />
                      <span>Nearest (10m)</span>
                    </button>
                  </div>
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
          </>
        )}
      </div>
    )
    return panelDetached ? createPortal(boxContent, document.body) : boxContent
  })()}

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

    {view3d && <Suspense fallback={null}><Walk3D farm={farm} onClose={() => setView3d(false)}/></Suspense>}

    {/* Authentic Cartographic Thesis Print Layout Frame Overlay (Exact reproduction of MAPS REF thesis figures) */}
    {thesisFrameOpen && (
      <div className="ix-carto-neatline-overlay" aria-label="Thesis Cartographic Frame">
        {/* Top Header Publication Banner (Editable on Double Click) */}
        <div className="ix-carto-top-banner" onDoubleClick={() => setEditingCartoTitle(true)}>
          {editingCartoTitle ? (
            <input
              type="text"
              autoFocus
              defaultValue={customCartoTitle || (
                thesisTheme === 'dem' ? 'DIGITAL ELEVATION MODEL (DEM 30M) OF THE STUDY AREA' :
                thesisTheme === 'lulc' ? 'LAND USE / LAND COVER (SWAT CLASSIFICATION) MAP' :
                thesisTheme === 'soil' ? 'FAO SOIL ASSOCIATION CLASSIFICATION (DSMW) MAP' :
                thesisTheme === 'stations' ? 'HYDRO-METEOROLOGICAL MONITORING STATIONS OVER DEM' :
                thesisTheme === 'discharge' ? 'GROUND DISCHARGE GAUGING STATIONS & SUB-BASIN REACHES' :
                'SUFI-2 PARAMETER UNCERTAINTY & SENSITIVITY DOTTY PLOTS'
              )}
              onBlur={e => {
                setCustomCartoTitle(e.target.value.trim() || null)
                setEditingCartoTitle(false)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setCustomCartoTitle((e.target as HTMLInputElement).value.trim() || null)
                  setEditingCartoTitle(false)
                }
              }}
              style={{ background: '#0f172a', color: '#ffffff', border: '1px solid #38bdf8', padding: '4px 8px', borderRadius: '4px', fontSize: '13px', width: '85%', textAlign: 'center', fontWeight: 800 }}
            />
          ) : (
            <div className="ix-carto-title-main" title="Double-click to edit map title">
              {customCartoTitle || (
                thesisTheme === 'dem' ? 'DIGITAL ELEVATION MODEL (DEM 30M) OF THE STUDY AREA' :
                thesisTheme === 'lulc' ? 'LAND USE / LAND COVER (SWAT CLASSIFICATION) MAP' :
                thesisTheme === 'soil' ? 'FAO SOIL ASSOCIATION CLASSIFICATION (DSMW) MAP' :
                thesisTheme === 'stations' ? 'HYDRO-METEOROLOGICAL MONITORING STATIONS OVER DEM' :
                thesisTheme === 'discharge' ? 'GROUND DISCHARGE GAUGING STATIONS & SUB-BASIN REACHES' :
                'SUFI-2 PARAMETER UNCERTAINTY & SENSITIVITY DOTTY PLOTS'
              )}
            </div>
          )}
          <div className="ix-carto-subtitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>SEVA·GIS SPATIAL WATERSHED SUITE · AREA OF INTEREST (AOI) · SRTM / SENTINEL-2 PROCESSING OUTPUT</span>
            <span style={{ display: 'inline-flex', gap: '4px', marginLeft: 8 }}>
              <button
                onClick={e => { e.stopPropagation(); handleDownloadMap('png') }}
                style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 6px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}
                title="Download Map as PNG"
              >
                PNG
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDownloadMap('geotiff') }}
                style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 6px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}
                title="Download GeoTIFF WorldFile Package"
              >
                GeoTIFF
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDownloadMap('geojson') }}
                style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 6px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}
                title="Download GeoJSON Boundary"
              >
                GeoJSON
              </button>
            </span>
          </div>
        </div>

        {/* Outer and Inner Dual Neatline with Corner Geodetic Crosshairs */}
        {(() => {
          let bboxW = 78.96, bboxS = 20.59, bboxE = 78.97, bboxN = 20.60
          try {
            const [w, s, e, n] = farmBBox(farm)
            if ([w, s, e, n].every(Number.isFinite)) {
              bboxW = w; bboxS = s; bboxE = e; bboxN = n
            }
          } catch {}
          return (
            <div className="ix-carto-border-frame">
              <div className="ix-carto-tick tick-top-left">{bboxN.toFixed(4)}°N, {bboxW.toFixed(4)}°E</div>
              <div className="ix-carto-tick tick-top-right">{bboxN.toFixed(4)}°N, {bboxE.toFixed(4)}°E</div>
              <div className="ix-carto-tick tick-bottom-left">{bboxS.toFixed(4)}°N, {bboxW.toFixed(4)}°E</div>
              <div className="ix-carto-tick tick-bottom-right">{bboxS.toFixed(4)}°N, {bboxE.toFixed(4)}°E</div>
            </div>
          )
        })()}

        {/* Authentic Topographic North Arrow Compass Rose */}
        <div className="ix-carto-north-compass" title="True Geodetic North">
          <svg viewBox="0 0 40 40" width="38" height="38">
            <circle cx="20" cy="20" r="18" fill="rgba(255,255,255,0.85)" stroke="#0f172a" strokeWidth="1.5" />
            <polygon points="20,4 24,18 20,16 16,18" fill="#0f172a" />
            <polygon points="20,36 24,22 20,24 16,22" fill="#94a3b8" />
            <polygon points="36,20 22,24 24,20 22,16" fill="#64748b" />
            <polygon points="4,20 18,24 16,20 18,16" fill="#cbd5e1" />
            <text x="20" y="11" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#ffffff">N</text>
          </svg>
        </div>

        {/* Alternating Metric Publication Scale Bar */}
        <div className="ix-carto-scalebar">
          <div className="ix-carto-scale-labels">
            <span>0</span>
            <span>2.5</span>
            <span>5.0</span>
            <span>10 km</span>
          </div>
          <div className="ix-carto-scale-blocks">
            <span className="block black" />
            <span className="block white" />
            <span className="block black" />
            <span className="block white" />
          </div>
        </div>

        {/* Detachable & Draggable Cartographic Publication Legend */}
        <div
          className={`ix-carto-legend-box ${cartoLegendMinimized ? 'minimized' : ''}`}
          style={{ position: 'fixed', left: cartoLegendPos.x, top: cartoLegendPos.y, zIndex: 1100 }}
          role="dialog"
          aria-label="Publication Legend"
        >
          <div
            className="ix-carto-legend-head"
            style={{ cursor: 'grab' }}
            onPointerDown={e => {
              if ((e.target as HTMLElement).closest('button')) return
              cartoLegendDragOffset.current = { x: e.clientX - cartoLegendPos.x, y: e.clientY - cartoLegendPos.y }
              setCartoLegendDragging(true)
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Compass size={14} className="text-emerald-700" />
              <strong style={{ fontSize: 11, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Cartographic Legend
              </strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button
                className="ix-win-btn"
                title={cartoLegendMinimized ? 'Expand Legend' : 'Minimize Legend'}
                onClick={() => setCartoLegendMinimized(!cartoLegendMinimized)}
              >
                {cartoLegendMinimized ? <Maximize2 size={12} /> : <Minus size={12} />}
              </button>
              <button
                className="ix-win-btn"
                title="Close Cartographic Frame"
                onClick={() => setThesisFrameOpen(false)}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {!cartoLegendMinimized && (
            <div className="ix-carto-legend-body">
              {/* Theme Switcher Tabs */}
              <div className="ix-carto-theme-nav">
                <button className={thesisTheme === 'dem' ? 'active' : ''} onClick={() => setThesisTheme('dem')}>DEM</button>
                <button className={thesisTheme === 'lulc' ? 'active' : ''} onClick={() => setThesisTheme('lulc')}>LULC</button>
                <button className={thesisTheme === 'soil' ? 'active' : ''} onClick={() => setThesisTheme('soil')}>Soil</button>
                <button className={thesisTheme === 'stations' ? 'active' : ''} onClick={() => setThesisTheme('stations')}>Stations</button>
                <button className={thesisTheme === 'discharge' ? 'active' : ''} onClick={() => setThesisTheme('discharge')}>Reaches</button>
                <button className={thesisTheme === 'dotty' ? 'active' : ''} onClick={() => setThesisTheme('dotty')}>Dotty Plots</button>
              </div>

              {/* Exact Swatches Matching MAPS REF */}
              {thesisTheme === 'dem' && (
                <div className="ix-carto-legend-list">
                  <div className="ix-legend-title">Elevation Gradient (SRTM 30m)</div>
                  <div className="ix-dem-ramp-bar">
                    <span style={{ background: 'linear-gradient(to right, #1a9850, #ffffbf, #fc8d59, #8c510a, #ffffff)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', fontWeight: 600 }}>
                    <span>Low: 135 m</span>
                    <span>High: 1012 m</span>
                  </div>
                </div>
              )}

              {thesisTheme === 'lulc' && (
                <div className="ix-carto-legend-list">
                  <div className="ix-legend-title">SWAT Land Use / Land Cover (9 Classes)</div>
                  {[
                    { code: 'WATR', label: 'Water', color: '#2b83ba' },
                    { code: 'URMD', label: 'Residential-Medium Density', color: '#d7191c' },
                    { code: 'SWRN', label: 'Range-Grasses', color: '#fdae61' },
                    { code: 'RNGE', label: 'Range-Brush', color: '#ffffbf' },
                    { code: 'RNGB', label: 'Range-Buffer', color: '#abd9e9' },
                    { code: 'FRST', label: 'Forest-Mixed', color: '#1a9641' },
                    { code: 'FRSD', label: 'Forest-Deciduous', color: '#a6d96a' },
                    { code: 'AGRR', label: 'Agricultural Land-Row Crops', color: '#dfc27d' },
                    { code: 'AGRL', label: 'Agricultural Land-Generic', color: '#bf812d' },
                  ].map(c => (
                    <div key={c.code} className="ix-legend-item">
                      <span className="swatch" style={{ background: c.color }} />
                      <b>{c.code}</b>
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {thesisTheme === 'soil' && (
                <div className="ix-carto-legend-list">
                  <div className="ix-legend-title">FAO Soil Association (5 Classes)</div>
                  {[
                    { code: 'Bv12-3b-3696', label: 'Vertic Cambisols', color: '#d73027' },
                    { code: 'I-Bc-Lc-3714', label: 'Lithosols & Chromic Luvisols', color: '#fc8d59' },
                    { code: 'Lf62-1a-3791', label: 'Ferric Luvisols', color: '#fee08b' },
                    { code: 'Vc43-3ab-3861', label: 'Chromic Vertisols', color: '#91bfdb' },
                    { code: 'Vp20-3a-3866', label: 'Pellic Vertisols', color: '#4575b4' },
                  ].map(s => (
                    <div key={s.code} className="ix-legend-item">
                      <span className="swatch" style={{ background: s.color }} />
                      <b>{s.code}</b>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {thesisTheme === 'stations' && (
                <div className="ix-carto-legend-list">
                  <div className="ix-legend-title">Monitoring Network (Fig 3.5)</div>
                  <div className="ix-legend-item">
                    <span className="swatch" style={{ background: '#e11d48', transform: 'rotate(45deg)', width: 10, height: 10 }} />
                    <b>Rain Gauge</b>
                    <span>Precipitation (PREC)</span>
                  </div>
                  <div className="ix-legend-item">
                    <span className="swatch" style={{ background: '#0f172a', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
                    <b>Temperature</b>
                    <span>Max/Min Temp Sensors</span>
                  </div>
                </div>
              )}

              {thesisTheme === 'discharge' && (
                <div className="ix-carto-legend-list">
                  <div className="ix-legend-title">Hydrological Stations (Fig 3.6)</div>
                  <div className="ix-legend-item">
                    <span className="swatch" style={{ background: '#0284c7', height: 4, borderRadius: 2 }} />
                    <b>Stream Network</b>
                    <span>SWAT Reach Order 1-4</span>
                  </div>
                  <div className="ix-legend-item">
                    <span className="swatch" style={{ background: '#10b981', borderRadius: '50%' }} />
                    <b>Deoghat Station</b>
                    <span>Calibrated Discharge Gauge</span>
                  </div>
                  <div className="ix-legend-item">
                    <span className="swatch" style={{ background: '#f59e0b', borderRadius: '50%' }} />
                    <b>Bandol & Ugli</b>
                    <span>Tributary Outlets</span>
                  </div>
                </div>
              )}

              {thesisTheme === 'dotty' && (
                <div className="ix-carto-legend-list">
                  <div className="ix-legend-title">SUFI-2 Calibration Dotty Plots (Fig 4.4)</div>
                  <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 6px', lineHeight: 1.35 }}>
                    Nash-Sutcliffe Efficiency (NSE) response across 2,000 parameter iteration runs. Top clusters define calibrated optima.
                  </p>
                  {[
                    { param: '1:R__CN2.mgt', name: 'Curve Number Relative Delta', opt: '-0.12', nse: '0.68', range: '-0.40 to +0.40' },
                    { param: '2:A__GWQMN.gw', name: 'Shallow Aquifer Threshold (mm)', opt: '245 mm', nse: '0.67', range: '210 to 300 mm' },
                    { param: '3:A__GW_REVAP.gw', name: 'Groundwater Revap Coeff', opt: '0.08', nse: '0.66', range: '-0.40 to +0.40' },
                    { param: '4:R__SOL_AWC.sol', name: 'Soil Available Water Capacity', opt: '+0.15', nse: '0.68', range: '0.40 to 0.60' },
                    { param: '5:V__ESCO.hru', name: 'Soil Evaporation Compensation', opt: '0.04', nse: '0.65', range: '0.00 to 0.20' },
                    { param: '6:A__REVAPMN.gw', name: 'Revap Shallow Threshold (mm)', opt: '0.34 mm', nse: '0.67', range: '0.27 to 0.39 mm' },
                  ].map(dp => (
                    <div key={dp.param} className="ix-legend-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '4px 6px', background: '#f8fafc', borderRadius: 4, border: '1px solid #e2e8f0', marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 10.5 }}>
                        <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{dp.param}</strong>
                        <span style={{ color: '#16a34a', fontWeight: 700 }}>NSE: {dp.nse}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 9.5, color: '#64748b' }}>
                        <span>{dp.name}</span>
                        <span>Opt: <b>{dp.opt}</b> ({dp.range})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )}

        {picked && (
          <div
            className={`ix-data ${dataDetached ? 'detached' : ''} ${dataMinimized ? 'minimized' : ''}`}
            role="dialog"
            aria-label="Data window"
            style={dataDetached ? { position: 'fixed', left: dataPos.x, top: dataPos.y, zIndex: 1100 } : undefined}
          >
            <div
              className={`ix-data-head ${dataDetached ? 'draggable' : ''}`}
              style={{ cursor: dataDetached ? 'grab' : 'default' }}
              onPointerDown={e => {
                if (!dataDetached) return
                if ((e.target as HTMLElement).closest('button')) return
                dataDragOffset.current = { x: e.clientX - dataPos.x, y: e.clientY - dataPos.y }
                setDataDragging(true)
              }}
            >
              <div><strong>Data window</strong><small>{picked.lat.toFixed(5)}°, {picked.lon.toFixed(5)}° · {date}</small></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button
                  aria-label={dataDetached ? 'Dock window' : 'Detach window'}
                  title={dataDetached ? 'Dock window back to map corner' : 'Detach window to drag anywhere across screen'}
                  onClick={() => setDataDetached(!dataDetached)}
                  className="ix-win-btn"
                >
                  <Move size={13} />
                </button>
                <button
                  aria-label={dataMinimized ? 'Expand' : 'Minimize'}
                  title={dataMinimized ? 'Expand window' : 'Minimize window to clear map view'}
                  onClick={() => setDataMinimized(!dataMinimized)}
                  className="ix-win-btn"
                >
                  {dataMinimized ? <Maximize2 size={13} /> : <Minus size={13} />}
                </button>
                <button aria-label="Close" onClick={() => { setPicked(null); marker.current?.remove() }} className="ix-win-btn"><X size={14}/></button>
              </div>
            </div>
            {!dataMinimized && (
              <>
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

                {/* Face-to-Face Farmer Ground Talk for clicked spot */}
                {(() => {
                  const primaryId = active[0] || 'ndvi'
                  const pVal = picked.values[primaryId]
                  if (pVal !== undefined) {
                    const gt = getGroundTalk(primaryId)
                    const interp = gt.interpret(pVal)
                    return (
                      <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 11 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#166534', fontWeight: 700, marginBottom: 3 }}>
                          <span>🤝 Ground Talk ({gt.plainTitle}):</span>
                          <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 999, background: interp.rating === 'Great' || interp.rating === 'Good' ? '#dcfce7' : '#fef3c7', color: interp.rating === 'Great' || interp.rating === 'Good' ? '#15803d' : '#854d0e', fontWeight: 700 }}>
                            {interp.rating}
                          </span>
                        </div>
                        <div style={{ color: '#14532d', lineHeight: 1.4 }}>{interp.groundAction}</div>
                      </div>
                    )
                  }
                  return null
                })()}

                {Object.keys(picked.values).length === 0 && <p>No clear pixel here (cloud, shadow, or no data).</p>}
              </>
            )}
          </div>
        )}

                <GeeAgentCenter
          farm={farm}
          isOpen={geeCenterOpen}
          onClose={() => setGeeCenterOpen(false)}
          onApplyGeeSettings={(comp, combo, stretch) => {
            setActiveBandCombo(combo)
            setStretchDra(stretch)
          }}
        />
      </div>

      {/* 25% box ratio seedling-to-coconut palm tree loader during map processing */}
      {busy.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 800,
            pointerEvents: 'none',
            background: 'rgba(10, 25, 18, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1.5px solid rgba(34, 197, 94, 0.45)',
            borderRadius: '16px',
            padding: '14px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 20px 30px rgba(0, 0, 0, 0.6)',
            maxWidth: '25%',
            minWidth: '180px',
            textAlign: 'center',
          }}
        >
          <LogoLoader size={44} text="" inline />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#ecfdf5', letterSpacing: '0.2px' }}>
            Processing {busy.map(id => byId(id).name.split(' (')[0]).join(', ')}…
          </span>
        </div>
      )}

    </div>
  )
}
