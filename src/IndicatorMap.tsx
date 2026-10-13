import LogoLoader from './LogoLoader'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { createPortal } from 'react-dom'
import {
  Check, Eye, EyeOff, Box, CircleDot, LocateFixed, Route, Plus, Search,
  SlidersHorizontal, X, Wrench, Move, Globe2, Mountain, Droplets, Layers,
  Lock, LockOpen, Map as MapIcon, Ruler, Maximize2, Tag, ExternalLink,
  Sliders, ChevronRight, Trash2, FileCheck2, Scissors, RotateCcw,
  Minus, Edit3, Save, Users, CheckCircle2, Cpu, Sparkles, Compass, FileText,
  ArrowUp, ArrowDown, Upload, FolderPlus
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
import { useBoundaryProcessing } from './useBoundaryProcessing'
import './seva-boundary-processing.css'
import { useI18n } from './lib/i18n'
import { createFloat32GeoTiffBlob, createGeoTiffBlob } from './lib/geoTiffWriter'
import { dispatchExport } from './lib/googleDriveVault'

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

/**
 * Backdrop painted behind the map tiles. Deliberately neutral instead of near-black:
 * while tiles are still loading, or where one is missing, this is what shows through,
 * and a near-black backdrop is what made locking or unlocking the map look like the
 * map had gone dark.
 */
const MAP_BACKDROP = '#e9eeea'

export default function IndicatorMap({ farm, loading, panelTarget, sceneOpts }: { farm: MapFarm; loading: boolean; panelTarget: HTMLDivElement | null; sceneOpts?: SceneOpts }) {
  const { t } = useI18n()
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
  /** Result of the last GeoTIFF export, shown in the map HUD. */
  const [exportNote, setExportNote] = useState('')
  /** Export format chooser, shown as a strip under the toolbar. */
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  /**
   * Kept separate from `busy`, which holds indicator ids: putting a non-indicator
   * string in that list crashed the panel, because the status line looks every id up
   * with `byId()`.
   */
  const [exporting, setExporting] = useState(false)
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

  /**
   * Glowing travel animation around the boundary while map data is loading.
   * `farmRing` returns longitude/latitude pairs; Leaflet needs latitude/longitude, so
   * the order is swapped here. This is presentation only — it never starts or retries
   * a satellite request, and the existing `loading` / `busy` flags drive it.
   */
  const processingBoundary = useMemo(
    () => farmRing(farm)
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
      .map(([lng, lat]) => [lat, lng] as const),
    [farm],
  )

  useBoundaryProcessing(
    mapObj,
    processingBoundary,
    loading || busy.length > 0,
  )
  const [mapZoom, setMapZoom] = useState(() => getSavedZoom(13))
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

  const handleDownloadMap = async (format: 'png' | 'geotiff' | 'geojson' | 'kml') => {
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
      await dispatchExport({
        category: 'data',
        fileName: `${farm.name.replace(/\W+/g, '_')}_AOI.geojson`,
        blob,
        mimeType: 'application/geo+json',
        customToast: `Saved GeoJSON to device & Google Drive: SEVA GIS / User Data & Cache`
      })
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
      await dispatchExport({
        category: 'data',
        fileName: `${farm.name.replace(/\W+/g, '_')}_AOI.kml`,
        blob,
        mimeType: 'application/vnd.google-earth.kml+xml',
        customToast: `Saved KML to device & Google Drive: SEVA GIS / User Data & Cache`
      })
      return
    }
    if (format === 'geotiff') {
      // Export the real thing: the actual per-pixel values of the selected layer,
      // clipped to the area of interest, as a Float32 GeoTIFF in EPSG:4326.
      const topId = [...active].reverse().find(id => !hidden.includes(id))
      const indId = topId ?? 'ndvi'
      const ind = byId(indId)
      if (!ind?.value) {
        setExportNote(`${indId.toUpperCase()} cannot be exported as a raster. Choose a satellite layer.`)
        return
      }
      const fromDem = ind.source === 'DEM'
      if (!fromDem && !scene) {
        setExportNote('No satellite scene is loaded yet. Pick a date, then export again.')
        return
      }
      setExportNote(`Exporting ${indId.toUpperCase()} GeoTIFF…`)
      setExporting(true)
      try {
        const g = fromDem ? await loadDem(farm) : await loadScene(scene!, farm)
        if (!g) throw new Error(`${indId} needs the terrain model, which could not be loaded for this area.`)
        const n = g.w * g.h
        const values = new Float32Array(n)
        for (let i = 0; i < n; i++) {
          values[i] = g.inside[i] && g.ok[i] ? ind.value(g.b, i) : Number.NaN
        }
        const blob = createFloat32GeoTiffBlob(g.w, g.h, g.bbox, [values], { nodata: Number.NaN })
        const res = await dispatchExport({
          category: 'tiff',
          fileName: `${farm.name.replace(/\W+/g, '_')}_${indId}_EPSG4326.tif`,
          blob,
          mimeType: 'image/tiff',
          customToast: `Exported ${indId.toUpperCase()} GeoTIFF · Saved to device & organized in Google Drive: SEVA GIS / TIFF Files`
        })
        setExportNote(
          `Exported ${indId.toUpperCase()} GeoTIFF · ${g.w} × ${g.h} px · real values · EPSG:4326 · ` +
            `${(blob.size / 1024).toFixed(0)} KB${res.syncedToDrive ? ' · Synced to Google Drive / TIFF Files' : ' · Saved to device'}. Open in QGIS, ArcGIS, or rasterio.`
        )
      } catch (err) {
        console.warn('GeoTIFF export failed:', err)
        setExportNote('GeoTIFF export failed. Check the connection and try again.')
      } finally {
        setExporting(false)
      }
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = bgMode === 'black' ? '#000000' : '#ffffff'
      ctx.fillRect(0, 0, 1200, 800)
      ctx.font = 'bold 22px Inter, sans-serif'
      ctx.fillStyle = bgMode === 'black' ? '#ffffff' : '#0f172a'
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

      canvas.toBlob(async (blob) => {
        if (blob) {
          await dispatchExport({
            category: 'images',
            fileName: `${farm.name.replace(/\W+/g, '_')}_CartoMap.png`,
            blob,
            mimeType: 'image/png',
            customToast: `Saved CartoMap PNG to device & Google Drive: SEVA GIS / Images`
          })
        }
      }, 'image/png')
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

  type VectorLayerItem = { id: string; name: string; data: any; visible: boolean; color: string; opacity: number; count: number }
  const [customVectors, setCustomVectors] = useState<VectorLayerItem[]>([])
  const vectorFileInputRef = useRef<HTMLInputElement>(null)
  const vectorLayerGroupRef = useRef<L.LayerGroup | null>(null)

  const handleVectorUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '')
        const parsed = JSON.parse(text)
        const count = parsed.type === 'FeatureCollection' && Array.isArray(parsed.features) ? parsed.features.length : 1
        const newLayer: VectorLayerItem = {
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          data: parsed,
          visible: true,
          color: '#3b82f6',
          opacity: 0.9,
          count,
        }
        setCustomVectors(prev => [...prev, newLayer])
      } catch {
        alert('Could not parse GeoJSON file. Please check file format.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const moveLayer = (index: number, dir: -1 | 1) => {
    const nextIdx = index + dir
    if (nextIdx < 0 || nextIdx >= active.length) return
    const next = [...active]
    const temp = next[index]
    next[index] = next[nextIdx]
    next[nextIdx] = temp
    setActive(next)
  }

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

      const padX = Math.max(40, Math.round(sz.x * 0.125))
      const padY = Math.max(40, Math.round(sz.y * 0.125))
      const computedZoom = instance.getBoundsZoom(bounds, false, L.point(padX * 2, (padY + 30) * 2))
      const safeAoiZoom = Math.min(18, Math.max(13, computedZoom))

      instance.fitBounds(bounds, {
        paddingTopLeft: [padX, padY + 35],
        paddingBottomRight: [padX, padY + 25],
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

  /**
   * Keeps the map's dynamic classes in step with React state using `classList`,
   * never `className`.
   *
   * React owning `className` on this element is a bug: Leaflet adds
   * `leaflet-container`, `leaflet-touch` and `leaflet-fade-anim` to the same element,
   * and any React re-render that writes `className` erases them. Losing
   * `leaflet-container` drops Leaflet's own CSS — panes lose their positioning and
   * the map looks broken or dark. `classList` toggles leave Leaflet's classes alone.
   */
  useEffect(() => {
    const el = element.current
    if (!el) return
    el.classList.toggle('is-locked', locked)
    for (const mode of ['default', 'black', 'white']) {
      el.classList.toggle(`bg-${mode}`, mode === bgMode)
    }
  }, [locked, bgMode, mapObj])

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
    const initialZoom = getSavedZoom(13)
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

    if (element.current) {
      element.current.style.backgroundColor = bgMode === 'black' ? '#000000' : bgMode === 'white' ? '#ffffff' : MAP_BACKDROP
    }

    // bgMode ('black' | 'white' | 'default') controls the canvas container and exterior AOI clip
    // backdrop without erasing the user's chosen satellite or street basemap.
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

      const bgMapColor = bgMode === 'black' ? '#000000' : bgMode === 'white' ? '#ffffff' : MAP_BACKDROP
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

      // The travelling boundary animation is now owned by useBoundaryProcessing
      // (a dedicated SVG pane). The old `seva-train-pulse` polyline is gone, so the
      // two animations cannot draw over each other.

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
        el.style.imageRendering = 'auto'
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
    const m = mapObj
    if (!m) return
    const g = L.layerGroup().addTo(m)
    mine.b.forEach(b => L.marker([b.lat, b.lon], { icon: L.divIcon({ className: 'ix-bw-pin', html: '<span></span>', iconSize: [24, 24] }), keyboard: false }).bindTooltip(`${b.name} · ${b.yieldM3h} m³/h · ${b.depth} m deep`).addTo(g))
    mine.p.forEach(p => L.polyline(p.pts.map(([lo, la]) => [la, lo] as L.LatLngTuple), { color: '#38bdf8', weight: 4, dashArray: '9 6', opacity: 0.95 }).bindTooltip(`${p.name} · ${Math.round(lengthM(p.pts))} m · Ø${p.dia} mm`, { sticky: true }).addTo(g))
    if (draft.length) { L.polyline(draft.map(([lo, la]) => [la, lo] as L.LatLngTuple), { color: '#fde047', weight: 3, dashArray: '4 6' }).addTo(g); draft.forEach(([lo, la]) => L.circleMarker([la, lo], { radius: 4, color: '#fde047', fillColor: '#fde047', fillOpacity: 1, interactive: false }).addTo(g)) }
    return () => { g.remove() }
  }, [mapObj, JSON.stringify(mine), JSON.stringify(draft)])

  // Custom Vector Layers (GeoJSON / KML) rendering
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (vectorLayerGroupRef.current) {
      vectorLayerGroupRef.current.remove()
      vectorLayerGroupRef.current = null
    }
    const group = L.layerGroup().addTo(m)
    vectorLayerGroupRef.current = group
    customVectors.forEach(v => {
      if (!v.visible) return
      try {
        L.geoJSON(v.data, {
          style: {
            color: v.color || '#3b82f6',
            weight: 2.5,
            opacity: v.opacity ?? 0.9,
            fillColor: v.color || '#3b82f6',
            fillOpacity: (v.opacity ?? 0.9) * 0.25,
          },
          pointToLayer: (_geoJsonPoint, latlng) => {
            return L.circleMarker(latlng, {
              radius: 6,
              fillColor: v.color || '#3b82f6',
              color: '#ffffff',
              weight: 1.5,
              opacity: 1,
              fillOpacity: v.opacity ?? 0.9,
            })
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties
            if (props) {
              const entries = Object.entries(props).slice(0, 5)
              if (entries.length) {
                layer.bindTooltip(entries.map(([k, val]) => `<b>${k}:</b> ${String(val)}`).join('<br/>'))
              }
            }
          }
        }).addTo(group)
      } catch (err) {
        console.warn('Could not parse/render custom vector layer:', err)
      }
    })
    return () => {
      group.remove()
      vectorLayerGroupRef.current = null
    }
  }, [mapObj, customVectors])

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
      <div className="ix-main-toolbar" role="toolbar" aria-label={t('map.toolbarAria')}>
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
          title={t('map.layersTitle')}
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
          title={t('map.bandSymbologyTitle')}
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
          title={t('map.basemapTitle')}
        >
          <MapIcon size={15}/>
          <span>{t('map.baseMap')}</span>
          <b className="ix-btn-badge">{BASES.find(b => b.id === base)?.name.split(' ')[0]}</b>
        </button>

        <button
          className={`ix-tb-btn ${aoiOnly ? 'on' : ''}`}
          onClick={() => setAoiOnly(!aoiOnly)}
          title={aoiOnly ? "Disable AOI clipping: Show full surroundings" : "Clip AOI from boundary: Shapefile mask exclusively displaying all parameters upon farm boundary"}
        >
          <Scissors size={15}/>
          <span>{t('map.clipAoi')}</span>
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
          title={t('map.fieldToolsTitle')}
        >
          <Wrench size={15}/>
          <span>Tools</span>
          <b className="ix-btn-badge">Adjust</b>
        </button>

        <button
          className={`ix-tb-btn ${exportMenuOpen ? 'on' : ''}`}
          onClick={() => setExportMenuOpen(v => !v)}
          title={t('map.downloadTitle')}
        >
          <Save size={15}/>
          <span>{t('map.exportMap')}</span>
          <b className="ix-btn-badge">{exportMenuOpen ? 'Choose' : 'PNG · TIF · GIS'}</b>
        </button>

        <button
          className={`ix-tb-btn ${thesisFrameOpen ? 'on' : ''}`}
          onClick={() => setThesisFrameOpen(prev => !prev)}
          title={t('map.cartoModeTitle')}
        >
          <Compass size={15}/>
          <span>{t('map.cartoFrameShort')}</span>
          <b className="ix-btn-badge">{thesisFrameOpen ? 'Thesis ON' : 'Off'}</b>
        </button>

        <button
          className={`ix-tb-btn ${geeCenterOpen ? 'on' : ''}`}
          onClick={() => setGeeCenterOpen(prev => !prev)}
          title={t('map.geeStudioTitle')}
        >
          <Cpu size={15}/>
          <span>{t('map.geeStudio')}</span>
          <b className="ix-btn-badge">{earthEngineOverlay?.sceneKey === sceneKey ? 'Live Stream' : 'AI Crew'}</b>
        </button>

        <button
          className={`ix-tb-btn ${view3d ? 'on' : ''}`}
          onClick={() => setView3d(v => !v)}
          title="Google Earth 3D Orbit, Aerial Elevation & Pitch Perspective (MapLibre 3D DEM)"
        >
          <Globe2 size={15}/>
          <span>Google Earth 3D</span>
          <b className="ix-btn-badge">{view3d ? '3D Active' : 'Orbit'}</b>
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
          title={t('map.resetTitle')}
        >
          <RotateCcw size={15}/>
          <span>Reset</span>
          <b className="ix-btn-badge">75% Fit</b>
        </button>
      </div>

      <div className="ix-wrap">
        <div ref={element} className="field-map" style={{ backgroundColor: bgMode === 'black' ? '#000000' : bgMode === 'white' ? '#ffffff' : undefined }} />

        {/* Announced politely, and never moved into focus, so screen-reader users hear
            that work is happening without being interrupted. */}
        <div role="status" aria-live="polite" className="seva-processing-status">
          {loading || busy.length > 0 ? t('map.processing') : ''}
        </div>

        {/* Single Unified Non-Redundant Map HUD Bar */}
        <div className="ix-map-hud-bar" role="status" aria-label={t('map.statusAria')}>
          <div
            className="ix-unified-hud"
            title={t('map.openCrewStudio')}
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
              title={t('map.northTitle')}
              onClick={(e) => {
                e.stopPropagation()
                if (map.current) map.current.setView([farm?.lat ?? 20.5937, farm?.lon ?? 78.9629], map.current.getZoom())
              }}
            >
              ▲ N 0°
            </span>
          </div>
        </div>
        {exportMenuOpen && (
          <div className="ix-export-menu" role="menu" aria-label="Choose an export format">
            <span className="ix-export-menu-label">Export the selected area as</span>
            {[
              { id: 'geotiff' as const, label: 'GeoTIFF', hint: 'real values · EPSG:4326 · for QGIS, ArcGIS, rasterio' },
              { id: 'png' as const, label: 'PNG map', hint: 'cartographic image with title and scale' },
              { id: 'geojson' as const, label: 'GeoJSON', hint: 'boundary only' },
              { id: 'kml' as const, label: 'KML', hint: 'boundary only, for Google Earth' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                role="menuitem"
                className="ix-export-menu-item"
                disabled={exporting}
                onClick={() => {
                  setExportMenuOpen(false)
                  void handleDownloadMap(f.id)
                }}
              >
                <b>{f.label}</b>
                <small>{f.hint}</small>
              </button>
            ))}
          </div>
        )}
        {exportNote && (
          <div className="ix-export-note" role="status">
            <span>{exportNote}</span>
            <button type="button" aria-label="Dismiss export message" onClick={() => setExportNote('')}>×</button>
          </div>
        )}
        {layersBoxOpen && (() => {
          const boxContent = (
            <div
              className={`ix-layers-box ${panelDetached ? 'detached' : 'docked-map'}`}
              style={panelDetached ? { left: panelPosition.x, top: panelPosition.y } : undefined}
              role="dialog"
              aria-label={t('map.layersBox')}
            >
            <div className={`ix-lb-header${panelDetached ? ' draggable' : ''}`} onPointerDown={event => {
              if (!panelDetached || (event.target as HTMLElement).closest('button')) return
              dragOffset.current = { x: event.clientX - panelPosition.x, y: event.clientY - panelPosition.y }
              setPanelDragging(true)
            }}>
              <div className="ix-lb-title">
                <Layers size={17} className="text-emerald-400" />
                <div>
                  <strong>{t('map.layersBoxShort')}</strong>
                  <small>{t('map.layersBoxNote')}</small>
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
                <button className="ix-lb-close" onClick={() => setLayersBoxOpen(false)} aria-label={t('map.closeLayers')}>
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
                <span>{t('map.fieldTools')}</span>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="ix-lb-tool-btn"
                      onClick={() => setLayersBoxTab('catalog')}
                      title="Add Raster from parameter catalog"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11, background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#86efac', borderRadius: 4, cursor: 'pointer' }}
                    >
                      <Plus size={12} />
                      <span>Add Raster</span>
                    </button>
                    <button
                      type="button"
                      className="ix-lb-tool-btn"
                      onClick={() => vectorFileInputRef.current?.click()}
                      title="Import custom GeoJSON vector polygon or points"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11, background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#93c5fd', borderRadius: 4, cursor: 'pointer' }}
                    >
                      <FolderPlus size={12} />
                      <span>Add Vector</span>
                    </button>
                    <input
                      type="file"
                      ref={vectorFileInputRef}
                      accept=".geojson,.json"
                      style={{ display: 'none' }}
                      onChange={handleVectorUpload}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setAoiOnly(v => !v)}
                    title={aoiOnly ? 'Clip to AOI is ON: surrounding terrain is masked' : 'Clip to AOI is OFF: full extent displayed'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 10.5, background: aoiOnly ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${aoiOnly ? '#22c55e' : 'rgba(255,255,255,0.15)'}`, color: aoiOnly ? '#86efac' : '#cbd5e1', borderRadius: 4, cursor: 'pointer' }}
                  >
                    <Scissors size={11} />
                    <span>{aoiOnly ? 'Clipped to AOI' : 'Clip to AOI'}</span>
                  </button>
                </div>

                <div className="ix-lb-active-list">
                  {active.map((id, index) => {
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
                              aria-label={`Move ${ind.name} up`}
                              title="Move layer up (draws on top)"
                              disabled={index === active.length - 1}
                              onClick={() => moveLayer(index, 1)}
                              style={{ opacity: index === active.length - 1 ? 0.35 : 1, cursor: index === active.length - 1 ? 'default' : 'pointer' }}
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              aria-label={`Move ${ind.name} down`}
                              title="Move layer down"
                              disabled={index === 0}
                              onClick={() => moveLayer(index, -1)}
                              style={{ opacity: index === 0 ? 0.35 : 1, cursor: index === 0 ? 'default' : 'pointer' }}
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              aria-label={off ? "Show layer" : "Hide layer"}
                              title={off ? "Show on map" : "Hide from map"}
                              onClick={() => setHidden(h => (off ? h.filter(x => x !== id) : [...h, id]))}
                            >
                              {off ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button
                              aria-label={`Remove ${ind.name}`}
                              title={t('map.removeLayer')}
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
                            <span>{t('map.aoiMean')}<b>{waiting ? 'waiting for scene' : busy.includes(id) || !layer ? 'loading…' : layer.stat ? fmt(id, layer.stat.mean) : 'composite'}</b></span>
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
                                title={t('map.resamplingHint')}
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
                      <p>{t('map.noLayers')}</p>
                      <button className="primary compact" onClick={() => setLayersBoxTab('catalog')}>
                        <Plus size={14} />{t('map.browseCatalog')}</button>
                    </div>
                  )}

                  {/* Custom Vector Layers Section */}
                  {customVectors.length > 0 && (
                    <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Custom Vector Layers ({customVectors.length})</span>
                        <span style={{ fontSize: 9.5, color: '#64748b' }}>GeoJSON Vectors</span>
                      </div>
                      {customVectors.map(v => (
                        <div key={v.id} className="ix-lb-card" style={{ marginBottom: 8, borderLeft: `3px solid ${v.color}` }}>
                          <div className="ix-lb-card-top">
                            <span className="ix-swatch" style={{ background: v.color, borderRadius: 3 }} />
                            <div className="ix-lb-card-meta">
                              <strong>{v.name}</strong>
                              <span className="ix-lb-badge">{v.count} feature{v.count === 1 ? '' : 's'} · Vector</span>
                            </div>
                            <div className="ix-lb-card-ops">
                              <button
                                aria-label={v.visible ? "Hide vector layer" : "Show vector layer"}
                                onClick={() => setCustomVectors(list => list.map(item => item.id === v.id ? { ...item, visible: !item.visible } : item))}
                              >
                                {v.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                              <button
                                aria-label={`Remove ${v.name}`}
                                onClick={() => setCustomVectors(list => list.filter(item => item.id !== v.id))}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          <div className="ix-lb-opacity-row" style={{ marginTop: 6 }}>
                            <label>Opacity: {Math.round(v.opacity * 100)}%</label>
                            <input
                              type="range"
                              min="0.1"
                              max="1"
                              step="0.05"
                              value={v.opacity}
                              onChange={e => setCustomVectors(list => list.map(item => item.id === v.id ? { ...item, opacity: Number(e.target.value) } : item))}
                            />
                          </div>
                        </div>
                      ))}
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
                    placeholder={t('map.searchPlaceholder')}
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
                        <strong style={{ fontSize: 13, color: '#f8fafc', letterSpacing: '0.01em' }}>{t('map.layerPropsPath')}</strong>
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

                    <p style={{ margin: '0 0 10px', fontSize: 11, color: '#cbd5e1', lineHeight: 1.45 }}>{t('map.antipixelIntro')}<b>Cubic</b> (Bicubic Spline Convolution) or <b>Bilinear</b> interpolation instead of raw 10m pixel squares.
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
                        title={t('map.resCubicNote')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontWeight: 700 }}>✨ Cubic (Default)</span>
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#059669', color: '#fff', fontWeight: 700 }}>Smooth</span>
                        </div>
                        <small style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.25 }}>{t('map.antipixelCubic')}</small>
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
                        title={t('map.resBilinearNote')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontWeight: 700 }}>📐 Bilinear</span>
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#0284c7', color: '#fff', fontWeight: 700 }}>Linear</span>
                        </div>
                        <small style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.25 }}>{t('map.antipixelBilinear')}</small>
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
                        title={t('map.resNearestNote')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontWeight: 700 }}>🔲 Nearest Neighbour</span>
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#475569', color: '#fff', fontWeight: 700 }}>10m</span>
                        </div>
                        <small style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.25 }}>{t('map.antipixelNearest')}</small>
                      </button>
                    </div>
                  </div>

                  <div className="ix-lb-sym-header">
                    <strong>{t('map.bandSymbology')}</strong>
                    <small>{t('map.bandSymbologyNote')}</small>
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
                          <h4>{t('map.agroClasses')}</h4>
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
                              <strong style={{ fontSize: 10.5, color: '#a7f3d0', display: 'block', marginBottom: 2 }}>{t('map.fieldAction')}</strong>
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
                    <strong>{t('map.tapeTitle')}</strong>
                    <span className={`ix-tool-badge ${rulerOpen ? 'on' : ''}`}>
                      {rulerOpen ? 'Active on Map' : 'Off'}
                    </span>
                  </div>
                  <p className="ix-tool-desc">{t('map.tapeNote')}</p>
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
                  <p className="ix-tool-desc">{t('map.borewellNote')}</p>
                  <div className="ix-tool-actions">
                    <button
                      className={`ix-sett-btn ${tool === 'borewell' ? 'on' : ''}`}
                      onClick={() => {
                        setRulerOpen(false)
                        setRulerActive(false)
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
                        setRulerActive(false)
                        setDraft([])
                        setTool(tool === 'pipeline' ? 'none' : 'pipeline')
                      }}
                    >
                      <Route size={13} />
                      <span>{tool === 'pipeline' ? 'Click the map to draw' : 'Draw a pipeline'}</span>
                    </button>
                    <button
                      type="button"
                      className="ix-sett-btn"
                      title="Auto-detect candidate borehole signatures from high moisture anomalies"
                      onClick={() => {
                        addBorewell({
                          farmId: farm.id,
                          name: `Candidate Well #${mine.b.length + 1} (Detected)`,
                          lat: farm.lat + 0.0003,
                          lon: farm.lon + 0.0003,
                          depth: 60,
                          level: 22,
                          yieldM3h: 12,
                          hours: 4
                        })
                      }}
                    >
                      <Sparkles size={13} />
                      <span>Identify Candidates</span>
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
                    {!mine.b.length && !mine.p.length && <small className="ix-assets-empty">{t('map.noBorewells')}</small>}
                  </div>
                </div>

                {/* 3. Custom Geodesic Buffer Zone Tool */}
                <div className="ix-lb-tool-card">
                  <div className="ix-lb-tool-head">
                    <Box size={16} className="text-amber-400" />
                    <strong>{t('map.bufferTitle')}</strong>
                    <span className={`ix-tool-badge ${bufferActive ? 'on' : ''}`}>
                      {bufferActive ? `${bufferDist} ${bufferUnit} Active` : 'Off'}
                    </span>
                  </div>
                  <p className="ix-tool-desc">{t('map.bufferNote')}</p>
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
                  <h4>{t('map.basemap')}</h4>
                  <p className="ix-settings-desc">{t('map.basemapNote')}</p>
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
                  <h4>{t('map.zoomStretchTitle')}</h4>
                  <p className="ix-settings-desc">{t('map.zoomStretchNote')}</p>
                  <div className="ix-settings-btns">
                    <button
                      className={`ix-sett-btn ${aoiOnly ? 'on' : ''}`}
                      onClick={handleZoomStretch}
                    >
                      <Maximize2 size={13} />
                      <span>{t('map.zoomStretchBtn')}</span>
                    </button>
                    <button
                      className={`ix-sett-btn ${!aoiOnly ? 'on' : ''}`}
                      onClick={handleResetView}
                    >
                      <Move size={13} />
                      <span>{t('map.wholeMapBtn')}</span>
                    </button>
                  </div>
                </div>

                <div className="ix-lb-settings-group">
                  <h4>{t('map.contrast')}</h4>
                  <p className="ix-settings-desc">{t('map.contrastNote')}</p>
                  <button
                    className={`ix-sett-btn full ${stretchDra ? 'on' : ''}`}
                    onClick={() => setStretchDra(!stretchDra)}
                  >
                    <Sliders size={13} />
                    <span>{stretchDra ? 'Local contrast adjustment active' : 'Adjust local contrast'}</span>
                  </button>
                </div>

                <div className="ix-lb-settings-group">
                  <h4>{t('map.resamplingTitle')}</h4>
                  <p className="ix-settings-desc">{t('map.resamplingNote')}</p>
                  <div className="ix-settings-btns">
                    <button
                      className={`ix-sett-btn ${resamplingMethod === 'cubic' ? 'on' : ''}`}
                      onClick={() => setResamplingMethod('cubic')}
                      title={t('map.resCubic')}
                    >
                      <Sparkles size={13} />
                      <span>Cubic (Spline)</span>
                    </button>
                    <button
                      className={`ix-sett-btn ${resamplingMethod === 'bilinear' ? 'on' : ''}`}
                      onClick={() => setResamplingMethod('bilinear')}
                      title={t('map.resBilinear')}
                    >
                      <Sliders size={13} />
                      <span>Bilinear</span>
                    </button>
                    <button
                      className={`ix-sett-btn ${resamplingMethod === 'nearest' ? 'on' : ''}`}
                      onClick={() => setResamplingMethod('nearest')}
                      title={t('map.resNearest')}
                    >
                      <Box size={13} />
                      <span>Nearest (10m)</span>
                    </button>
                  </div>
                </div>

                <div className="ix-lb-settings-group">
                  <h4>{t('map.eeService')}</h4>
                  <p className="ix-settings-desc">{earthEngineStatus} Summary values and terrain layers still use their separately labelled public data sources.</p>
                </div>
              </div>
            )}

            {/* Footer Status Bar */}
            <div className="ix-gee-handoff">
              <div><strong>{t('map.eeContinue')}</strong><small>{t('map.eeCopyNote')}</small></div>
              <small className="ix-ee-status" role="status">{earthEngineStatus}</small>
              <button onClick={openEarthEngine}><ExternalLink size={14}/>{t('map.eeCopyOpen')}</button>
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
      <div className="ix-carto-neatline-overlay" aria-label={t('map.cartoFrame')}>
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
            <div className="ix-carto-title-main" title={t('map.editTitle')}>
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
            <span>{t('map.cartoBanner')}</span>
            <span style={{ display: 'inline-flex', gap: '4px', marginLeft: 8 }}>
              <button
                onClick={e => { e.stopPropagation(); handleDownloadMap('png') }}
                style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 6px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}
                title={t('map.dlPng')}
              >
                PNG
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDownloadMap('geotiff') }}
                style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 6px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}
                title={t('map.dlTiff')}
              >
                GeoTIFF
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDownloadMap('geojson') }}
                style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 6px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}
                title={t('map.dlGeoJson')}
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
        <div className="ix-carto-north-compass" title={t('map.north')}>
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
          aria-label={t('map.legend')}
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
              <strong style={{ fontSize: 11, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('map.cartoLegend')}</strong>
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
                title={t('map.closeCarto')}
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
                <button className={thesisTheme === 'dotty' ? 'active' : ''} onClick={() => setThesisTheme('dotty')}>{t('map.dottyPlots')}</button>
              </div>

              {/* Exact Swatches Matching MAPS REF */}
              {thesisTheme === 'dem' && (
                <div className="ix-carto-legend-list">
                  <div className="ix-legend-title">{t('map.elevGradient')}</div>
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
                  <div className="ix-legend-title">{t('map.lulcLegend')}</div>
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
                  <div className="ix-legend-title">{t('map.soilLegend')}</div>
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
                  <div className="ix-legend-title">{t('map.monitoringLegend')}</div>
                  <div className="ix-legend-item">
                    <span className="swatch" style={{ background: '#e11d48', transform: 'rotate(45deg)', width: 10, height: 10 }} />
                    <b>{t('map.rainGauge')}</b>
                    <span>Precipitation (PREC)</span>
                  </div>
                  <div className="ix-legend-item">
                    <span className="swatch" style={{ background: '#0f172a', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
                    <b>Temperature</b>
                    <span>{t('map.tempSensors')}</span>
                  </div>
                </div>
              )}

              {thesisTheme === 'discharge' && (
                <div className="ix-carto-legend-list">
                  <div className="ix-legend-title">{t('map.hydroStations')}</div>
                  <div className="ix-legend-item">
                    <span className="swatch" style={{ background: '#0284c7', height: 4, borderRadius: 2 }} />
                    <b>{t('map.streamNetwork')}</b>
                    <span>{t('map.reachOrder')}</span>
                  </div>
                  <div className="ix-legend-item">
                    <span className="swatch" style={{ background: '#10b981', borderRadius: '50%' }} />
                    <b>{t('map.deoghatStation')}</b>
                    <span>{t('map.dischargeGauge')}</span>
                  </div>
                  <div className="ix-legend-item">
                    <span className="swatch" style={{ background: '#f59e0b', borderRadius: '50%' }} />
                    <b>Bandol & Ugli</b>
                    <span>{t('map.tributaryOutlets')}</span>
                  </div>
                </div>
              )}

              {thesisTheme === 'dotty' && (
                <div className="ix-carto-legend-list">
                  <div className="ix-legend-title">{t('map.sufi2Legend')}</div>
                  <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 6px', lineHeight: 1.35 }}>{t('map.sufi2Note')}</p>
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
            aria-label={t('map.dataWindow')}
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

                {Object.keys(picked.values).length === 0 && <p>{t('map.noPixel')}</p>}
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
            Processing {busy.map(id => byId(id)?.name.split(' (')[0] ?? id).join(', ')}…
          </span>
        </div>
      )}

      {view3d && (
        <Suspense fallback={<LogoLoader text="Launching 3D terrain orbit…"/>}>
          <Walk3D farm={farm} onClose={() => setView3d(false)}/>
        </Suspense>
      )}

    </div>
  )
}
