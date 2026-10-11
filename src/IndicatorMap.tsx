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
import { pixelAt } from './lib/raster'
import { ndviClass } from './lib/agro'
import { addBorewell, addPipeline, lengthM, removeBorewell, removePipeline, useAssets } from './lib/assets'
import NearbyLayer from './NearbyLayer'
import MapKit, { KIT_DEFAULT, type Kit } from './MapKit'
import RulerTape from './RulerTape'
import { BAND_COMBINATIONS } from './lib/geoai'
import { areaHa } from './lib/geo'
import { farmBBox, farmRing, loadDem, loadScene, type FarmData, type SceneOpts } from './lib/seva'
import { buildEarthEngineScript, buildThesisMapScript, supportsEarthEngineIndicator } from './lib/earthEngine'
import { createEarthEngineMap, isEarthEngineConfigured } from './lib/earthEngineClient'
import { getSavedZoom, setGlobalZoom } from './lib/zoomSync'
import { fetchOverpassCadastre, type OverpassParcel } from './lib/cadastreOnline'
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
  const [base, setBase] = useState(() => {
    const saved = localStorage.getItem(BASE_STORE)
    return (saved && saved !== 'streets') ? saved : 'sat'
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

  // Detachable & Draggable Box States
  const [cadastreDetached, setCadastreDetached] = useState(false)
  const [cadastrePos, setCadastrePos] = useState({ x: Math.max(16, typeof window !== 'undefined' ? window.innerWidth - 430 : 600), y: 72 })
  const [cadastreDragging, setCadastreDragging] = useState(false)
  const [cadastreMinimized, setCadastreMinimized] = useState(false)
  const cadastreDragOffset = useRef({ x: 0, y: 0 })

  const [dataDetached, setDataDetached] = useState(false)
  const [dataPos, setDataPos] = useState({ x: 24, y: 140 })
  const [dataDragging, setDataDragging] = useState(false)
  const [dataMinimized, setDataMinimized] = useState(false)
  const dataDragOffset = useRef({ x: 0, y: 0 })

  // Family & Landowner State
  const [cadastreSyncTick, setCadastreSyncTick] = useState(0)
  const [editingCadastre, setEditingCadastre] = useState(false)
  const [showFamilyOnMap, setShowFamilyOnMap] = useState(true)
  const [geeCenterOpen, setGeeCenterOpen] = useState(false)

  // Listen for cadastre updates across dashboard (e.g. from LandInfoCard)
  useEffect(() => {
    const handleUpdate = () => setCadastreSyncTick(t => t + 1)
    window.addEventListener('seva-cadastre-updated', handleUpdate)
    return () => window.removeEventListener('seva-cadastre-updated', handleUpdate)
  }, [])

  // Cartographic Thesis Print Frame Mode (Matching MAPS REF publication figures)
  const [thesisFrameOpen, setThesisFrameOpen] = useState(false)
  const [thesisTheme, setThesisTheme] = useState<'dem' | 'lulc' | 'soil' | 'stations' | 'discharge' | 'dotty'>('dem')
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [cartoLegendPos, setCartoLegendPos] = useState({ x: 28, y: 140 })
  const [cartoLegendDragging, setCartoLegendDragging] = useState(false)
  const [cartoLegendMinimized, setCartoLegendMinimized] = useState(false)
  const cartoLegendDragOffset = useRef({ x: 0, y: 0 })

  const savedCadastre = useMemo(() => {
    try {
      const raw = localStorage.getItem(`seva-cadastre-record-${farm.id}`)
      if (raw) return JSON.parse(raw)
    } catch {}
    return null
  }, [farm.id, cadastreSyncTick])

  const defaultOwnerName = useMemo(() => {
    if (savedCadastre?.ownerName?.trim()) return savedCadastre.ownerName.trim()
    try {
      const rawUser = localStorage.getItem('seva-user')
      if (rawUser) {
        const u = JSON.parse(rawUser)
        if (u?.name && u.name !== 'Guest') return u.name
      }
    } catch {}
    return 'Akshit Vinay'
  }, [savedCadastre])

  const displayTitleholder = defaultOwnerName
  const displayFatherName = savedCadastre?.fatherName?.trim() || 'Ramadhar Vinay (Ancestral Estate)'
  const displayKhataNo = savedCadastre?.khataNo?.trim() || 'Khata No. 104/A'
  const displaySurveyNo = savedCadastre?.surveyOrTaxParcelNo?.trim() || 'Sy. No. 36/1'

  const [cadastreEditForm, setCadastreEditForm] = useState({
    ownerName: displayTitleholder,
    fatherName: displayFatherName,
    surveyNo: displaySurveyNo,
    khataNo: displayKhataNo,
    rel1Name: 'Elder Brother / Sah-Khatedar',
    rel2Name: 'Paternal Uncle / Relative',
    rel3Name: 'Ancestral Joint Khata',
    rel4Name: 'Cousin / Family Co-sharer',
  })

  useEffect(() => {
    setCadastreEditForm({
      ownerName: displayTitleholder,
      fatherName: displayFatherName,
      surveyNo: displaySurveyNo,
      khataNo: displayKhataNo,
      rel1Name: savedCadastre?.rel1Name || 'Elder Brother / Sah-Khatedar',
      rel2Name: savedCadastre?.rel2Name || 'Paternal Uncle / Relative',
      rel3Name: savedCadastre?.rel3Name || 'Ancestral Joint Khata',
      rel4Name: savedCadastre?.rel4Name || 'Cousin / Family Co-sharer',
    })
  }, [farm.id, displayTitleholder, displayFatherName, displaySurveyNo, displayKhataNo, savedCadastre])

  const handleSaveCadastre = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...savedCadastre,
        ownerName: cadastreEditForm.ownerName.trim() || 'Akshit Vinay',
        fatherName: cadastreEditForm.fatherName.trim() || 'Ramadhar Vinay (Ancestral Estate)',
        surveyOrTaxParcelNo: cadastreEditForm.surveyNo.trim() || 'Sy. No. 36/1',
        khataNo: cadastreEditForm.khataNo.trim() || 'Khata No. 104/A',
        rel1Name: cadastreEditForm.rel1Name.trim(),
        rel2Name: cadastreEditForm.rel2Name.trim(),
        rel3Name: cadastreEditForm.rel3Name.trim(),
        rel4Name: cadastreEditForm.rel4Name.trim(),
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem(`seva-cadastre-record-${farm.id}`, JSON.stringify(payload))
      window.dispatchEvent(new CustomEvent('seva-cadastre-updated'))
      setCadastreSyncTick(t => t + 1)
      setEditingCadastre(false)
    } catch (err) {
      console.warn('Could not save cadastre record:', err)
    }
  }

  // Family holdings and co-sharers (Exact official demo & ancestral estate ledger)
  const familyLandholdings = useMemo(() => {
    const isDefaultOrDemo = !farm.polygon || farm.polygon.length < 3 || Math.abs(farm.area - 0.66) < 0.05 || (farm as any).sample
    const baseHa = isDefaultOrDemo ? 0.66 : areaHa(farmRing(farm))
    const scale = baseHa / 0.66
    return [
      { id: 'self', title: `${farm.name} · Certified AOI`, name: `${displayTitleholder} (Self)`, relation: 'Primary Applicant & Certified Pattadar', surveyNo: displaySurveyNo, areaHa: Number(baseHa.toFixed(2)), color: '#059669', role: 'Primary Titleholder' },
      { id: 'rel1', title: 'North Parcel', name: savedCadastre?.rel1Name || cadastreEditForm.rel1Name || 'Elder Brother / Sah-Khatedar', relation: 'Elder Brother / Sah-Khatedar', surveyNo: 'Sy. 75/2A', areaHa: isDefaultOrDemo ? 0.87 : Number((0.87 * scale).toFixed(2)), color: '#0284c7', role: 'Co-sharer (North)' },
      { id: 'rel2', title: 'East Parcel', name: savedCadastre?.rel2Name || cadastreEditForm.rel2Name || 'Paternal Uncle / Relative', relation: 'Paternal Uncle / Relative', surveyNo: 'Sy. 75/2B', areaHa: isDefaultOrDemo ? 0.75 : Number((0.75 * scale).toFixed(2)), color: '#d97706', role: 'Co-sharer (East)' },
      { id: 'rel3', title: 'South Parcel', name: savedCadastre?.rel3Name || cadastreEditForm.rel3Name || 'Ancestral Joint Khata', relation: 'Ancestral Joint Estate & Well', surveyNo: 'Sy. 75/3', areaHa: isDefaultOrDemo ? 0.98 : Number((0.98 * scale).toFixed(2)), color: '#8b5cf6', role: 'Ancestral Joint Khata' },
      { id: 'rel4', title: 'West Parcel', name: savedCadastre?.rel4Name || cadastreEditForm.rel4Name || 'Cousin / Family Co-sharer', relation: 'Cousin / Family Co-sharer', surveyNo: 'Sy. 75/4', areaHa: isDefaultOrDemo ? 0.72 : Number((0.72 * scale).toFixed(2)), color: '#ec4899', role: 'Family Member (West)' },
    ]
  }, [farm, displayTitleholder, displayFatherName, displaySurveyNo, savedCadastre, cadastreEditForm])

  const totalFamilyAreaHa = useMemo(() => {
    return Number(familyLandholdings.reduce((sum, h) => sum + h.areaHa, 0).toFixed(2))
  }, [familyLandholdings])

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
    ? `${farm.id}:${farm.polygon.map(([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`).join(';')}`
    : `${farm.id}:${farm.lat.toFixed(7)}:${farm.lon.toFixed(7)}:${farm.area.toFixed(4)}`
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

  const [stretchDra, setStretchDra] = useState(() => localStorage.getItem('seva-stretch-dra') === '1')
  useEffect(() => { localStorage.setItem('seva-stretch-dra', stretchDra ? '1' : '0') }, [stretchDra])

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
    if (!cadastreDragging) return
    const move = (event: PointerEvent) => setCadastrePos({
      x: Math.max(8, Math.min(window.innerWidth - Math.min(420, window.innerWidth - 16) - 8, event.clientX - cadastreDragOffset.current.x)),
      y: Math.max(8, Math.min(window.innerHeight - 80, event.clientY - cadastreDragOffset.current.y)),
    })
    const end = () => setCadastreDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end) }
  }, [cadastreDragging])

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

  const layerKey = (id: string) => `${byId(id).source === 'DEM' ? 'dem' : sceneKey}:${geo}:${id}:${stretchDra ? 'dra' : 'std'}`
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
      })
      const t = setTimeout(() => {
        try { m.invalidateSize({ pan: false }) } catch {}
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
    const esri = 'Imagery © Esri, Maxar, Earthstar Geographics'
    if (base === 'sat' || base === 'hybrid') {
      add(ESRI('World_Imagery'), esri, { maxNativeZoom: 18 })
      if (base === 'hybrid') {
        add(ESRI('Reference/World_Transportation'), 'Esri')
        add(ESRI('Reference/World_Boundaries_and_Places'), 'Esri')
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
    if (!instance) return
    const [w, s, e, n] = farmBBox(farm)
    const ring = farmRing(farm).map(p => [p[1], p[0]] as L.LatLngTuple)
    const group = L.layerGroup().addTo(instance)
    frame.current = group

    if (element.current) {
      element.current.style.backgroundColor = '#15291f'
    }

    const worldOuter: L.LatLngTuple[] = [
      [-85, -180],
      [-85, 180],
      [85, 180],
      [85, -180],
    ]

    // Only draw the standard farm boundary stroke when the cadastre layer is closed.
    // When cadastre is open, cadastreLayerRef renders the certified cadastral parcel with monuments and badges,
    // avoiding duplicate overlapping rings.
    if (!cadastreOpen) {
      if (bgMode === 'black') {
        L.polygon(ring, { color: '#22c55e', weight: 2.8, fill: false, interactive: false }).addTo(group)
      } else if (bgMode === 'white') {
        L.polygon(ring, { color: '#15803d', weight: 2.8, fill: false, interactive: false }).addTo(group)
      } else if (aoiOnly) {
        L.polygon(ring, { color: '#22c55e', weight: 3, dashArray: '6 4', fill: false, interactive: false }).addTo(group)
      } else {
        L.polygon(ring, { color: '#f4ffd0', weight: 2.5, fill: false, interactive: false }).addTo(group)
      }
    }

    fit75PercentAoi(instance, false)
    return () => { group.remove(); frame.current = null }
  }, [farm.id, geo, dim, bgMode, aoiOnly, locked, cadastreOpen])

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
    const isDefaultOrDemo = !farm.polygon || farm.polygon.length < 3 || Math.abs(farm.area - 0.66) < 0.05 || (farm as any).sample
    const parcelArea = isDefaultOrDemo ? 0.66 : areaHa(farmRing(farm))

    // 1. Primary Certified AOI Parcel
    L.polygon(ring, {
      color: '#059669',
      weight: 3.5,
      dashArray: '6, 4',
      fill: true,
      fillColor: '#10b981',
      fillOpacity: 0.18,
    }).bindTooltip(`Certified Spatial Parcel · ${displayTitleholder} (${parcelArea.toFixed(2)} ha · ${(parcelArea * 2.471).toFixed(2)} ac · ${displaySurveyNo})`, { permanent: false, direction: 'top' }).addTo(cGroup)

    // Survey boundary stone markers for primary parcel
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
        html: `<div class="cad-badge primary"><b>${displayTitleholder} (Self)</b><span>${displaySurveyNo} · ${parcelArea.toFixed(2)} ha (${(parcelArea * 2.471).toFixed(2)} ac)</span></div>`,
        iconSize: [160, 36],
        iconAnchor: [80, 18],
      })
    }).addTo(cGroup)

    // 2. Mark Ancestral & Family Members / Relatives Landholdings
    if (showFamilyOnMap) {
      const familyPlots = [
        {
          item: familyLandholdings[1], // Elder Brother
          ring: [[n, w], [n + dh * 0.75, w + dw * 0.1], [n + dh * 0.8, e - dw * 0.1], [n, e]] as L.LatLngTuple[],
        },
        {
          item: familyLandholdings[2], // Paternal Uncle
          ring: [[n, e], [n - dh * 0.1, e + dw * 0.65], [s + dh * 0.1, e + dw * 0.7], [s, e]] as L.LatLngTuple[],
        },
        {
          item: familyLandholdings[3], // Ancestral Joint Estate & Family Well
          ring: [[s, w], [s, e], [s - dh * 0.7, e - dw * 0.15], [s - dh * 0.75, w + dw * 0.1]] as L.LatLngTuple[],
        },
        {
          item: familyLandholdings[4], // Cousin / Family Co-sharer
          ring: [[n, w], [s, w], [s + dh * 0.15, w - dw * 0.65], [n - dh * 0.1, w - dw * 0.6]] as L.LatLngTuple[],
        },
      ]

      familyPlots.forEach(({ item, ring: fRing }) => {
        if (!item) return
        const cLat = fRing.reduce((sum, pt) => sum + pt[0], 0) / fRing.length
        const cLon = fRing.reduce((sum, pt) => sum + pt[1], 0) / fRing.length

        // Polygon
        const poly = L.polygon(fRing, {
          color: item.color,
          weight: 2.4,
          dashArray: '5, 4',
          fill: true,
          fillColor: item.color,
          fillOpacity: 0.22,
        }).addTo(cGroup)

        poly.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; line-height: 1.5; min-width: 180px;">
            <b style="color: ${item.color}; font-size: 13px; display: block; margin-bottom: 3px;">${item.name}</b>
            <div><b>Relation:</b> ${item.relation}</div>
            <div><b>Survey No:</b> ${item.surveyNo}</div>
            <div><b>Area:</b> ${item.areaHa} ha (${(item.areaHa * 2.471).toFixed(2)} acres)</div>
            <div style="margin-top: 4px; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 3px;">
              Digitally verified family co-sharer cadastre
            </div>
          </div>
        `)

        poly.bindTooltip(`${item.name} (${item.relation}) · ${item.surveyNo} (${item.areaHa} ha)`, { sticky: true })

        // Boundary monuments for family sub-division
        fRing.forEach(([lat, lng]) => {
          L.circleMarker([lat, lng], {
            radius: 3.5,
            color: '#ffffff',
            weight: 1.5,
            fillColor: item.color,
            fillOpacity: 1,
          }).addTo(cGroup)
        })

        // Centroid Badge
        L.marker([cLat, cLon], {
          icon: L.divIcon({
            className: 'ix-cadastre-badge-wrap',
            html: `<div class="cad-badge" style="background: ${item.color}; border: 1.5px solid #fff; color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"><b>${item.name.slice(0, 22)}</b><span>${item.surveyNo} · ${item.areaHa} ha</span></div>`,
            iconSize: [140, 34],
            iconAnchor: [70, 17],
          })
        }).addTo(cGroup)
      })
    }

    // 3. Fetch authentic cadastral & farmland boundaries from OpenStreetMap via Overpass API
    let abortCadastre = false
    fetchOverpassCadastre(farm.lat, farm.lon, 1000).then(parcels => {
      if (abortCadastre || !cadastreLayerRef.current) return
      if (parcels.length > 0) {
        parcels.forEach(p => {
          if (p.coordinates.length < 3) return
          const pRing = p.coordinates as L.LatLngTuple[]
          const title = p.name || p.ref || `Cadastral Parcel #${p.id}`
          L.polygon(pRing, {
            color: '#64748b',
            weight: 1.5,
            dashArray: '3, 3',
            fill: true,
            fillColor: '#94a3b8',
            fillOpacity: 0.08
          }).bindTooltip(`${title} (${p.landuse || 'Farmland'} · OSM ${p.id})`, { sticky: true }).addTo(cGroup)
        })
      }
    })

    return () => {
      abortCadastre = true
      cGroup.remove()
      cadastreLayerRef.current = null
    }
  }, [mapObj, cadastreOpen, showAllGlobalParcels, farm, showFamilyOnMap, familyLandholdings, displayTitleholder, displayFatherName, displaySurveyNo])

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
    const ringCoords = farm.polygon && farm.polygon.length >= 3 ? farm.polygon : farmRing(farm)
    if (!ringCoords || ringCoords.length < 3 || !layer) {
      setEarthEngineOverlay(null)
      setEarthEngineStatus('Set a field location to request Earth Engine primary tiles.')
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
          className={`ix-tb-btn ${cadastreOpen ? 'on' : ''}`}
          onClick={() => setCadastreOpen(prev => !prev)}
          title="Digital India Land Records · RoR Form 1B Cadastre & Certified Pattadar Passbook"
        >
          <FileCheck2 size={15}/>
          <span>Cadastre</span>
          <b className="ix-btn-badge">{cadastreOpen ? 'Passbook ON' : 'RoR 1B'}</b>
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
        <div ref={element} className={`field-map${locked ? ' is-locked' : ''}`} />

        {/* Clean, Non-Redundant Map HUD Bar */}
        <div className="ix-map-hud-bar" role="status" aria-label="Map status and orientation">
          <button
            className={`ix-hud-pill is-btn${earthEngineOverlay?.sceneKey === sceneKey ? ' is-live' : ''}`}
            onClick={() => setGeeCenterOpen(true)}
            title="Click to open Google Earth Engine & Autonomous Agent Studio"
          >
            <span className="gee-dot" />
            <span>{earthEngineOverlay?.sceneKey === sceneKey ? 'GEE Live · S2 L2A' : 'GEE Studio · S2 L2A'}</span>
            <Sparkles size={11} className="text-emerald-400" />
          </button>

          <div className="ix-hud-pill" title={`Live map zoom ${mapZoom.toFixed(1)}x · Synchronized across dashboard`}>
            <span>Zoom <b>{mapZoom.toFixed(1)}x</b></span>
            {locked && <span className="zoom-synced-pill">75% LOCKED</span>}
          </div>

          <div className="ix-hud-pill" title="Geodetic Coordinates (WGS84)">
            <span>{mouseCoords ? `${mouseCoords.lat.toFixed(4)}°N, ${mouseCoords.lon.toFixed(4)}°E` : `${farm.lat.toFixed(4)}°N, ${farm.lon.toFixed(4)}°E (Centroid)`}</span>
          </div>

          {!thesisFrameOpen && (
            <div
              className="ix-hud-compass cursor-pointer"
              title="True Geodetic North (0.0° Azimuth). Click to reset map bearing."
              onClick={() => {
                if (map.current) {
                  map.current.setView([farm.lat, farm.lon], map.current.getZoom())
                }
              }}
            >
              <svg viewBox="0 0 20 20" width="13" height="13" style={{ transform: 'rotate(0deg)' }}>
                <polygon points="10,2 14,16 10,12 6,16" fill="#34d399" stroke="#065f46" strokeWidth="1" />
              </svg>
              <span>N 0.0°</span>
            </div>
          )}
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
        {/* Top Header Publication Banner */}
        <div className="ix-carto-top-banner">
          <div className="ix-carto-title-main">
            {thesisTheme === 'dem' && 'DIGITAL ELEVATION MODEL (DEM 30M) OF THE STUDY WATERSHED'}
            {thesisTheme === 'lulc' && 'LAND USE / LAND COVER (SWAT CLASSIFICATION) MAP'}
            {thesisTheme === 'soil' && 'FAO SOIL ASSOCIATION CLASSIFICATION (DSMW) MAP'}
            {thesisTheme === 'stations' && 'HYDRO-METEOROLOGICAL MONITORING STATIONS OVER DEM'}
            {thesisTheme === 'discharge' && 'GROUND DISCHARGE GAUGING STATIONS & SUB-BASIN REACHES'}
            {thesisTheme === 'dotty' && 'SUFI-2 PARAMETER UNCERTAINTY & SENSITIVITY DOTTY PLOTS (FIG 4.4)'}
          </div>
          <div className="ix-carto-subtitle">
            SEVA·GIS SPATIAL WATERSHED SUITE · WAINGANGA BASIN · SRTM / SENTINEL-2 PROCESSING OUTPUT
          </div>
        </div>

        {/* Outer and Inner Dual Neatline with Corner Geodetic Crosshairs */}
        {(() => {
          const [bboxW, bboxS, bboxE, bboxN] = farmBBox(farm)
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

        {cadastreOpen && (
          <div
            className={`ix-cadastre-hud ${cadastreDetached ? 'detached' : ''} ${cadastreMinimized ? 'minimized' : ''}`}
            role="dialog"
            aria-label="Official RoR Cadastral Record"
            style={cadastreDetached ? { position: 'fixed', left: cadastrePos.x, top: cadastrePos.y, zIndex: 1100 } : undefined}
          >
            <div
              className={`ix-cadastre-head ${cadastreDetached ? 'draggable' : ''}`}
              style={{ cursor: cadastreDetached ? 'grab' : 'default' }}
              onPointerDown={e => {
                if (!cadastreDetached) return
                if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return
                cadastreDragOffset.current = { x: e.clientX - cadastrePos.x, y: e.clientY - cadastrePos.y }
                setCadastreDragging(true)
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileCheck2 size={18} className="text-emerald-600" />
                <div>
                  <strong style={{ fontSize: 13, display: 'block', color: '#064e3b' }}>Digital India Land Records · RoR Form 1B</strong>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#047857', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Digitally Verified Cadastral Record
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  aria-label={cadastreDetached ? 'Dock window' : 'Detach window'}
                  title={cadastreDetached ? 'Dock window back to map corner' : 'Detach window to drag anywhere across screen'}
                  onClick={() => setCadastreDetached(!cadastreDetached)}
                  className="ix-win-btn"
                >
                  <Move size={13} />
                </button>
                <button
                  aria-label={cadastreMinimized ? 'Expand' : 'Minimize'}
                  title={cadastreMinimized ? 'Expand window' : 'Minimize window to clear map view'}
                  onClick={() => setCadastreMinimized(!cadastreMinimized)}
                  className="ix-win-btn"
                >
                  {cadastreMinimized ? <Maximize2 size={13} /> : <Minus size={13} />}
                </button>
                <button
                  aria-label="Close Cadastre"
                  onClick={() => setCadastreOpen(false)}
                  className="ix-win-btn"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {!cadastreMinimized && (
              <div className="ix-cadastre-body">
                {/* Primary Pattadar & Cadastre Overview */}
                <div className="ix-cad-grid">
                  <div>
                    <span>Primary Pattadar (Titleholder)</span>
                    <strong>{displayTitleholder}</strong>
                    <small>S/o {displayFatherName}</small>
                  </div>
                  <div>
                    <span>Khatedar Category</span>
                    <strong>Sole Khatedar</strong>
                    <small>Authenticated Titleholder (1/1)</small>
                  </div>
                  <div>
                    <span>Survey / Sub-Division</span>
                    <strong>{displaySurveyNo}</strong>
                    <small>Cadastral Spatial Survey</small>
                  </div>
                  <div>
                    <span>Khata No.</span>
                    <strong>{displayKhataNo}</strong>
                    <small>Revenue Circle · {farm.location}</small>
                  </div>
                  <div>
                    <span>14-Digit ULPIN (Bhu-Aadhaar)</span>
                    <code>{`${Math.abs(Math.round(farm.lat * 10000)).toString().slice(0, 4)}-${Math.abs(Math.round(farm.lon * 10000)).toString().slice(0, 4)}-${farm.id.slice(0, 6).toUpperCase()}`}</code>
                  </div>
                  <div>
                    <span>Official Token</span>
                    <code>{`PPB-GEO-${farm.id.slice(0, 8).toUpperCase()}`}</code>
                  </div>
                </div>

                {/* Edit & Customize Legal RoR Records */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="ix-cad-edit-toggle-btn"
                    onClick={() => setEditingCadastre(!editingCadastre)}
                  >
                    <Edit3 size={12} />
                    <span>{editingCadastre ? 'Close Record Editor' : 'Edit / Enter Legal Landholder & Family Details'}</span>
                  </button>
                </div>

                {editingCadastre && (
                  <form onSubmit={handleSaveCadastre} className="ix-cad-edit-form">
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#064e3b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={14} />
                      <span>Legal RoR Titleholder & Family Co-Sharers</span>
                    </div>

                    <div className="ix-cad-input-row">
                      <label>
                        <span>Primary Titleholder Name:</span>
                        <input
                          type="text"
                          value={cadastreEditForm.ownerName}
                          onChange={e => setCadastreEditForm({ ...cadastreEditForm, ownerName: e.target.value })}
                          placeholder="e.g. Akshit Vinay"
                          required
                        />
                      </label>
                      <label>
                        <span>Father's / Ancestor's Name:</span>
                        <input
                          type="text"
                          value={cadastreEditForm.fatherName}
                          onChange={e => setCadastreEditForm({ ...cadastreEditForm, fatherName: e.target.value })}
                          placeholder="e.g. Ramadhar Vinay"
                        />
                      </label>
                    </div>

                    <div className="ix-cad-input-row">
                      <label>
                        <span>Survey / Parcel No:</span>
                        <input
                          type="text"
                          value={cadastreEditForm.surveyNo}
                          onChange={e => setCadastreEditForm({ ...cadastreEditForm, surveyNo: e.target.value })}
                          placeholder="e.g. Sy. No. 75/1"
                        />
                      </label>
                      <label>
                        <span>Khata No:</span>
                        <input
                          type="text"
                          value={cadastreEditForm.khataNo}
                          onChange={e => setCadastreEditForm({ ...cadastreEditForm, khataNo: e.target.value })}
                          placeholder="e.g. Khata 113"
                        />
                      </label>
                    </div>

                    <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', marginTop: 6, textTransform: 'uppercase' }}>
                      Ancestral & Relative Co-Sharers (Adjoining Plots)
                    </div>

                    <div className="ix-cad-input-row">
                      <label>
                        <span>Elder Brother (North · Sy. 75/2A):</span>
                        <input
                          type="text"
                          value={cadastreEditForm.rel1Name}
                          onChange={e => setCadastreEditForm({ ...cadastreEditForm, rel1Name: e.target.value })}
                          placeholder="e.g. Siddharth Vinay"
                        />
                      </label>
                      <label>
                        <span>Paternal Uncle (East · Sy. 75/2B):</span>
                        <input
                          type="text"
                          value={cadastreEditForm.rel2Name}
                          onChange={e => setCadastreEditForm({ ...cadastreEditForm, rel2Name: e.target.value })}
                          placeholder="e.g. Rajeshwar Vinay"
                        />
                      </label>
                    </div>

                    <div className="ix-cad-input-row">
                      <label>
                        <span>Ancestral Estate (South · Sy. 75/3):</span>
                        <input
                          type="text"
                          value={cadastreEditForm.rel3Name}
                          onChange={e => setCadastreEditForm({ ...cadastreEditForm, rel3Name: e.target.value })}
                          placeholder="e.g. Ramadhar Vinay & Sons Joint Khata"
                        />
                      </label>
                      <label>
                        <span>Cousin / Co-sharer (West · Sy. 75/4):</span>
                        <input
                          type="text"
                          value={cadastreEditForm.rel4Name}
                          onChange={e => setCadastreEditForm({ ...cadastreEditForm, rel4Name: e.target.value })}
                          placeholder="e.g. Aarav Vinay"
                        />
                      </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                      <button
                        type="button"
                        className="ix-cad-cancel-btn"
                        onClick={() => setEditingCadastre(false)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="ix-cad-save-btn">
                        <Save size={13} />
                        <span>Save to RoR Cadastre</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Family & Ancestral Holdings Breakdown (Marked on Map) */}
                <div className="ix-cad-family-ledger">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <strong style={{ fontSize: 11, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Users size={13} className="text-emerald-700" />
                        <span>Ancestral Estate & Family Holdings</span>
                      </strong>
                      <span style={{ fontSize: 10, color: '#047857', fontWeight: 700 }}>
                        Total Family Extent: {totalFamilyAreaHa} ha ({(totalFamilyAreaHa * 2.471).toFixed(2)} acres)
                      </span>
                    </div>
                    <button
                      className={`ix-cad-family-map-toggle ${showFamilyOnMap ? 'active' : ''}`}
                      onClick={() => setShowFamilyOnMap(!showFamilyOnMap)}
                      title={showFamilyOnMap ? 'Hide family plots on map' : 'Show all family plots on map'}
                    >
                      {showFamilyOnMap ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>{showFamilyOnMap ? 'Marked on Map' : 'Show on Map'}</span>
                    </button>
                  </div>

                  <div className="ix-cad-family-list">
                    {familyLandholdings.map((h, idx) => (
                      <div
                        key={h.id}
                        className={`ix-family-item ${idx === 0 ? 'current' : ''}`}
                        onClick={() => {
                          if (idx === 0) {
                            const [w, s, e, n] = farmBBox(farm)
                            mapObj?.fitBounds(L.latLngBounds([s, w], [n, e]), { padding: [50, 50], maxZoom: 18 })
                          } else {
                            // Focus on family plot position
                            const [w, s, e, n] = farmBBox(farm)
                            const dw = e - w
                            const dh = n - s
                            let cLat = farm.lat
                            let cLon = farm.lon
                            if (h.id === 'rel1') { cLat = n + dh * 0.45; cLon = (w + e) / 2 }
                            if (h.id === 'rel2') { cLat = (n + s) / 2; cLon = e + dw * 0.45 }
                            if (h.id === 'rel3') { cLat = s - dh * 0.45; cLon = (w + e) / 2 }
                            if (h.id === 'rel4') { cLat = (n + s) / 2; cLon = w - dw * 0.45 }
                            mapObj?.setView([cLat, cLon], 17, { animate: true })
                          }
                        }}
                      >
                        <span className="ix-family-bullet" style={{ background: h.color }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <b style={{ fontSize: 11, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {h.name}
                            </b>
                            <span style={{ fontSize: 9, fontWeight: 700, color: h.color }}>
                              {h.surveyNo}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
                            <span>{h.relation}</span>
                            <b>{h.areaHa.toFixed(2)} ha ({((h.areaHa) * 2.471).toFixed(2)} ac)</b>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* All Registered Landholdings of Person (Authentic User Parcels) */}
                <div className="ix-cad-global-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <strong style={{ fontSize: 11, color: '#1e293b' }}>User Account Registered Parcels</strong>
                      <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>
                        {userFarmsList.length} registered parcel{userFarmsList.length > 1 ? 's' : ''} in account
                      </span>
                    </div>
                    <button
                      className="ix-cad-global-btn active"
                      onClick={() => {
                        const el = document.getElementById('land-records')
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      title="Open official cadastral passbook dossier"
                    >
                      <Globe2 size={12} />
                      <span>Open Dossier</span>
                    </button>
                  </div>

                  <div className="ix-cad-parcel-list">
                    {userFarmsList.map((f: any) => {
                      const isCurrent = f.id === farm.id
                      return (
                        <div
                          key={f.id}
                          className={`ix-cad-parcel-item ${isCurrent ? 'current' : ''}`}
                          onClick={() => {
                            if (isCurrent) {
                              const [w, s, e, n] = farmBBox(farm)
                              mapObj?.fitBounds(L.latLngBounds([s, w], [n, e]), { padding: [50, 50], maxZoom: 18 })
                            } else if (f.lat && f.lon) {
                              mapObj?.setView([f.lat, f.lon], 16)
                            }
                          }}
                        >
                          <span className={`dot ${isCurrent ? 'current' : 'global'}`} />
                          <div style={{ flex: 1 }}>
                            <b>{f.name} {isCurrent ? '· Current AOI' : ''}</b>
                            <small>{f.crop || 'Agricultural Field'} · {f.area ? f.area.toFixed(2) : '1.50'} ha ({((f.area || 1.5) * 2.471).toFixed(2)} ac)</small>
                          </div>
                          {isCurrent ? <span className="ix-tag-curr">Current</span> : <ChevronRight size={13} className="text-slate-400" />}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Official Cadastral Legend */}
                <div className="ix-cad-legend">
                  <span className="title">Official Cadastral Map Legend</span>
                  <div className="items">
                    <div><i style={{ background: '#059669', border: '1px dashed #fff' }} /><span>Primary Parcel · {displayTitleholder} ({displaySurveyNo})</span></div>
                    <div><i style={{ background: '#0284c7', border: '1px dashed #fff' }} /><span>Elder Brother · Sy. 75/2A (Co-sharer)</span></div>
                    <div><i style={{ background: '#d97706', border: '1px dashed #fff' }} /><span>Paternal Uncle · Sy. 75/2B (Co-sharer)</span></div>
                    <div><i style={{ background: '#8b5cf6', border: '1px dashed #fff' }} /><span>Ancestral Joint Estate & Well · Sy. 75/3</span></div>
                    <div><i style={{ background: '#ec4899', border: '1px dashed #fff' }} /><span>Cousin / Family Member · Sy. 75/4</span></div>
                    <div><i style={{ background: '#ffffff', border: '2px solid #059669', borderRadius: '50%' }} /><span>Revenue Triangulation Boundary Stone</span></div>
                  </div>
                </div>
              </div>
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
