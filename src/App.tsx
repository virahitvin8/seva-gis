import { lazy, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import FinancialSummaryTerminal from './FinancialSummaryTerminal'
import LogoLoader from './LogoLoader'
import PopTheTeamModal from './PopTheTeamModal'
import { AlertTriangle, ArrowDownToLine, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, ChevronRight, CloudSun, Droplets, ExternalLink, Globe2, HelpCircle, Layers, Leaf, MapPinned, Mountain, Navigation, Plus, RefreshCw, Trash2, Search, Settings2, LogOut, ShieldCheck, Sprout, X, FileCheck2, Maximize2, Minimize2, Activity, SlidersHorizontal, ArrowUp, ArrowDown, RotateCcw, Save, Wand2, Palette, Cpu, Plane, Camera, Smartphone } from 'lucide-react'

import { mergeWeekly, weeklyRecords, type WeekRec } from './lib/seva'
import AddFarm, { type NewFarm } from './AddFarm'
import { areaHa, centroid, validateAoiGeometry } from './lib/geo'
import { loadAnalysisIntent, saveAnalysisIntent, getIntentProfile, ALL_INTENTS, INTENT_ICONS, INTENT_PROFILES, type AnalysisIntent } from './lib/analysisIntent'
import Contact from './Contact'
import Reveal from './Reveal'
import SectionBoundary from './SectionBoundary'
import Credits from './Credits'
import Wordmark from './Wordmark'
import { useAccount } from './Auth'
import { NumbersGuide } from './Scale'
import { farmBBox, farmRing } from './lib/seva'
import { createGeoTiffBlob } from './lib/geoTiffWriter'
import FieldHealthScore from './FieldHealthScore'
import TeamGitDiagram from './TeamGitDiagram'
import InsightPlayingCardModal, { type InsightCardData } from './InsightPlayingCardModal'
import {
  authenticateWithGoogle,
  disconnectGoogle,
  dispatchExport,
  getGoogleUser,
  isGoogleDriveConnected
} from './lib/googleDriveVault'

function lazyWithRetry<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory()
    } catch (err: any) {
      if (typeof window !== 'undefined' && /Failed to fetch dynamically imported module|ChunkLoadError/i.test(err?.message || '')) {
        const key = 'chunk_reload_' + window.location.pathname
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          window.location.reload()
        }
      }
      throw err
    }
  })
}

const AgroPanel = lazyWithRetry(() => import('./AgroPanel'))
const CropJournal = lazyWithRetry(() => import('./CropJournal'))
const IndicatorMap = lazyWithRetry(() => import('./IndicatorMap'))
const WaterPanel = lazyWithRetry(() => import('./WaterPanel'))
const Intelligence = lazyWithRetry(() => import('./Intelligence'))
const WeeklyRecords = lazyWithRetry(() => import('./WeeklyRecords'))
const GeoTools = lazyWithRetry(() => import('./GeoTools'))
const Guide = lazyWithRetry(() => import('./Guide'))
const DataManager = lazyWithRetry(() => import('./DataManager'))
const ReportPanel = lazyWithRetry(() => import('./ReportPanel'))
const ProGisExport = lazyWithRetry(() => import('./ProGisExport'))
const VillageView = lazyWithRetry(() => import('./VillageView'))
const NodeWorkflowBuilder = lazyWithRetry(() => import('./NodeWorkflowBuilder'))
const DronePrecisionStudio = lazyWithRetry(() => import('./DronePrecisionStudio'))
const DroneReportDossier = lazyWithRetry(() => import('./DroneReportDossier'))
const ResponsivelyStudio = lazyWithRetry(() => import('./components/ResponsivelyStudio'))
const AppStoreScreenshotStudio = lazyWithRetry(() => import('./components/AppStoreScreenshotStudio'))
const ClaudeCodeAgentHub = lazyWithRetry(() => import('./components/ClaudeCodeAgentHub'))
const SevaGisTrainingAcademy = lazyWithRetry(() => import('./components/SevaGisTrainingAcademy'))

function AoiShape({ farm }: { farm: Parameters<typeof farmRing>[0]; good?: boolean }) {
  const ring = farmRing(farm), k = Math.cos((ring[0][1] * Math.PI) / 180)
  const lons = ring.map(p => p[0]), lats = ring.map(p => p[1])
  const cx = (Math.min(...lons) + Math.max(...lons)) / 2, cy = (Math.min(...lats) + Math.max(...lats)) / 2
  const span = Math.max((Math.max(...lons) - Math.min(...lons)) * k, Math.max(...lats) - Math.min(...lats), 1e-6) * 1.5
  const w = span / k, h = span
  const bbox = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox.join(',')}&bboxSR=4326&imageSR=4326&size=96,96&format=jpg&f=image`
  const pts = ring.map(p => `${(((p[0] - bbox[0]) / w) * 48).toFixed(1)},${(((bbox[3] - p[1]) / h) * 48).toFixed(1)}`).join(' ')
  return <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true"><image href={url} width="48" height="48" preserveAspectRatio="none"/><polygon points={pts} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round"/><polygon points={pts} fill="none" stroke="#0008" strokeWidth=".5" strokeLinejoin="round"/></svg>
}
import SceneBar from './SceneBar'
import { analyze, barsFromStat, classify, constructionSuitability, farmNeedsAttention, farmStatus, irrigationAdvice, type Advice, type Analysis, type SceneOpts } from './lib/seva'

type Farm = { id: string; name: string; location: string; crop: string; area: number; lat: number; lon: number; status: string; ndvi?: number; moisture?: number; rain?: number; elevation?: number; sample: boolean; analysis?: Analysis; polygon?: [number, number][]; passes?: WeekRec[] }
type Zone = { lat: number; lon: number; ndvi?: number; ndmi?: number }
const mappedBoundaryAreaHa = (farm?: Pick<Farm, 'polygon'>) => farm?.polygon && farm.polygon.length >= 3 ? areaHa(farm.polygon) : 0

export const DEFAULT_FARM: Farm = {
  id: 'chanderi-farm-1',
  name: 'Chanderi Research Farm',
  location: '24.6404° N, 78.0524° E',
  crop: 'Soybean / Wheat',
  area: 14.8,
  lat: 24.6404,
  lon: 78.0524,
  polygon: [
    [78.048, 24.638],
    [78.056, 24.638],
    [78.056, 24.644],
    [78.048, 24.644]
  ],
  status: 'Awaiting satellite data',
  sample: false
}
const initialFarms: Farm[] = [DEFAULT_FARM]
import Lang from './Lang'
import { useI18n } from './lib/i18n'
import { MitraGuide, MitraAvatar } from './Mitra'
import { pickGreeting, todayLabel } from './lib/greet'
import { logoMark as brandLogo } from './assets/brand'
const DEFAULT_SECTION_ORDER = [
  'crop-journal',
  'health-score',
  'field-intelligence',
  'numbers-guide',
  'advice-grid',
  'agro-water',
  'village-view',
  'gis-export',
  'intelligence-lab',
  'measurement-tools',
  'weekly-records',
]

const SECTION_TITLES: Record<string, string> = {
  'crop-journal': 'Crop Journal & Growth Cycles',
  journal: 'Crop Journal & Growth Cycles',
  'health-score': 'Field Health Score',
  health: 'Field Health Score',
  'field-intelligence': 'Spectral Indices & Atmosphere',
  intelligence: 'Spectral Indices & Atmosphere',
  'numbers-guide': 'Vegetation & Index Guide',
  'advice-grid': 'Irrigation & Drainage Advisory',
  advice: 'Irrigation & Drainage Advisory',
  'agro-water': 'Agro & Hydrology Panels',
  panels: 'Agro & Hydrology Panels',
  'village-view': 'Village View & Multi-Plot Map',
  village: 'Village View & Multi-Plot Map',
  'gis-export': 'GIS Export & Shapefile Backup',
  gisExport: 'GIS Export & Shapefile Backup',
  'intelligence-lab': 'GeoAI Analysis Lab',
  lab: 'GeoAI Analysis Lab',
  'measurement-tools': 'Precision Measurement & Robotics',
  geo: 'Precision Measurement & Robotics',
  'weekly-records': 'Multi-Temporal Satellite History',
  history: 'Multi-Temporal Satellite History',
  workspace: 'Field Map & Spatial Workspace',
}

function BrandLogo() {
  const { t } = useI18n()
  return <img className="brand-logo-image" src={brandLogo} alt={t('shell.logoAlt')} onError={(e) => { e.currentTarget.src = '/logo.png' }} />
}

export default function App() {
  const { who, signOut } = useAccount()
  const { t } = useI18n()
  const [farms, setFarms] = useState<Farm[]>(() => {
    try {
      const saved = localStorage.getItem('seva-farms')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((x: Farm) => x && typeof x === 'object' && x.id)
          if (valid.length > 0) return valid
        }
      }
    } catch {}
    return initialFarms
  })
  const [selected, setSelected] = useState(farms[0]?.id || DEFAULT_FARM.id)
  const [layersPanelTarget, setLayersPanelTarget] = useState<HTMLDivElement | null>(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const [modal, setModal] = useState('')
  const [showTerminal, setShowTerminal] = useState(false)
  const [showNodeStudio, setShowNodeStudio] = useState(false)
  const [showDroneStudio, setShowDroneStudio] = useState(false)
  const [showDroneDossier, setShowDroneDossier] = useState(false)
  const [showResponsively, setShowResponsively] = useState(false)
  const [showMarketingStudio, setShowMarketingStudio] = useState(false)
  const [showAgentHub, setShowAgentHub] = useState(false)
  const [showTrainingAcademy, setShowTrainingAcademy] = useState(false)
  const [sectionOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('seva-dashboard-layout')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length) {
          const merged = parsed.filter((k: string) => DEFAULT_SECTION_ORDER.includes(k))
          DEFAULT_SECTION_ORDER.forEach(k => {
            if (!merged.includes(k)) merged.push(k)
          })
          return merged
        }
      }
    } catch {}
    return DEFAULT_SECTION_ORDER
  })
  const [analysisIntent, setAnalysisIntent] = useState<AnalysisIntent>(loadAnalysisIntent)

  useEffect(() => {
    const handleIntentChange = (e: any) => {
      if (e.detail && e.detail in INTENT_PROFILES) {
        setAnalysisIntent(e.detail)
      }
    }
    window.addEventListener('seva-analysis-intent-changed', handleIntentChange)
    return () => window.removeEventListener('seva-analysis-intent-changed', handleIntentChange)
  }, [])

  const activeSectionOrder = useMemo(() => {
    const profile = getIntentProfile(analysisIntent)
    const priorityMap: Record<string, string[]> = {
      overview: ['numbers-guide', 'health-score'],
      indicators: ['field-intelligence', 'numbers-guide'],
      agro: ['agro-water', 'advice-grid'],
      water: ['agro-water', 'advice-grid', 'measurement-tools'],
      terrain: ['field-intelligence', 'agro-water'],
      lulc: ['village-view', 'intelligence-lab'],
      journal: ['crop-journal', 'weekly-records'],
      matlab: ['intelligence-lab'],
    }
    const prioritized = new Set<string>()
    profile.visiblePanels.forEach(p => {
      priorityMap[p]?.forEach(s => prioritized.add(s))
    })
    return [...sectionOrder].sort((a, b) => {
      const aPri = prioritized.has(a) ? 0 : 1
      const bPri = prioritized.has(b) ? 0 : 1
      return aPri - bPri
    })
  }, [analysisIntent, sectionOrder])

  const [query, setQuery] = useState('')
  const [loadingFarmIds, setLoadingFarmIds] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [driveConnected, setDriveConnected] = useState<boolean>(isGoogleDriveConnected)
  const [nav, setNav] = useState('Overview')
  const [menu, setMenu] = useState(false)
  const [mapFocus, setMapFocus] = useState(false)
  const farm = (farms.find(item => item.id === selected) || farms[0] || DEFAULT_FARM) as Farm
  const loading = !!farm && loadingFarmIds.includes(farm.id)
  const hi = useMemo(() => pickGreeting(who?.name || 'Guest', who?.id === 'guest' || who?.name === 'Guest'), [who?.name, who?.id])
  useEffect(() => { localStorage.setItem('seva-farms', JSON.stringify(farms)) }, [farms])

  useEffect(() => {
    const handleAuthChange = () => setDriveConnected(isGoogleDriveConnected())
    const handleToast = (e: any) => {
      if (e.detail?.message) setMessage(e.detail.message)
    }
    const handleOpenNodeStudio = () => setShowNodeStudio(true)
    const handleOpenDroneStudio = () => setShowDroneStudio(true)
    const handleOpenDroneDossier = () => setShowDroneDossier(true)
    const handleOpenResponsively = () => setShowResponsively(true)
    const handleOpenMarketingStudio = () => setShowMarketingStudio(true)

    window.addEventListener('seva-google-auth-change', handleAuthChange)
    window.addEventListener('seva-toast', handleToast)
    window.addEventListener('seva-open-node-studio', handleOpenNodeStudio)
    window.addEventListener('seva-open-drone-studio', handleOpenDroneStudio)
    window.addEventListener('seva-open-drone-dossier', handleOpenDroneDossier)
    window.addEventListener('seva-open-responsively', handleOpenResponsively)
    window.addEventListener('seva-open-marketing-studio', handleOpenMarketingStudio)

    return () => {
      window.removeEventListener('seva-google-auth-change', handleAuthChange)
      window.removeEventListener('seva-toast', handleToast)
      window.removeEventListener('seva-open-node-studio', handleOpenNodeStudio)
      window.removeEventListener('seva-open-drone-studio', handleOpenDroneStudio)
      window.removeEventListener('seva-open-drone-dossier', handleOpenDroneDossier)
      window.removeEventListener('seva-open-responsively', handleOpenResponsively)
      window.removeEventListener('seva-open-marketing-studio', handleOpenMarketingStudio)
    }
  }, [])

  async function handleConnectGoogle() {
    try {
      const res = await authenticateWithGoogle()
      if (res.success && res.user) {
        setDriveConnected(true)
        setMessage(`Google Drive connected (${res.user.email}). All outputs will organize into SEVA GIS.`)
      } else if (res.error && res.error !== 'Sign-in cancelled') {
        setMessage(res.error)
      }
    } catch (err: any) {
      setMessage(err?.message || 'Could not connect Google Drive')
    }
  }

  function handleDisconnectGoogle() {
    disconnectGoogle()
    setDriveConnected(false)
    setMessage('Disconnected from Google Drive. Outputs will save directly to this device.')
  }

  useEffect(() => {
    if (!mapFocus) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMapFocus(false) }
    const resizeMap = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 150)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.clearTimeout(resizeMap)
      window.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 80)
    }
  }, [mapFocus])

  // Scroll-spy: highlight sidebar nav as user scrolls dashboard
  useEffect(() => {
    const targets = [
      { id: 'Overview', getEl: () => document.querySelector('.page-heading') },
      { id: 'My farms', getEl: () => document.getElementById('my-farms') },
      { id: 'Crop journal', getEl: () => document.getElementById('section-crop-journal') }
    ]

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const match = targets.find(t => t.getEl() === entry.target)
          if (match) setNav(match.id)
        }
      }
    }, { rootMargin: '-20% 0px -60% 0px', threshold: 0.1 })

    targets.forEach(t => {
      const el = t.getEl()
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [selected])

  const [showPopTeam, setShowPopTeam] = useState(false)
  const [popTeamError, setPopTeamError] = useState<Error | string | null>(null)
  const [popTeamReason, setPopTeamReason] = useState<string>('')

  useEffect(() => {
    const handleOpenModal = (e: any) => { if (e.detail) setModal(e.detail) }
    const handlePopTeamEvent = (e: any) => {
      if (e?.detail) {
        setPopTeamError(e.detail.error || null)
        setPopTeamReason(e.detail.reason || '')
      }
      setShowPopTeam(true)
    }
    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason?.message || String(e.reason || '')
      if (/ResizeObserver|not a child|removeChild|AbortError/i.test(msg)) return
      console.warn('[SEVA] Captured unhandled promise rejection:', e.reason)
      setPopTeamError(e.reason instanceof Error ? e.reason : new Error(msg))
      setPopTeamReason('Async promise rejection in session')
    }
    const handleOpenStudio = () => setShowNodeStudio(true)
    window.addEventListener('seva-open-modal', handleOpenModal)
    window.addEventListener('seva-open-node-studio', handleOpenStudio)
    window.addEventListener('seva:pop-the-team', handlePopTeamEvent)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('seva-open-modal', handleOpenModal)
      window.removeEventListener('seva-open-node-studio', handleOpenStudio)
      window.removeEventListener('seva:pop-the-team', handlePopTeamEvent)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])
  const [zone, setZone] = useState<Zone | null>(null)
  const attempted = useRef(new Set<string>())
  const refreshRun = useRef(new Map<string, number>())
  const inFlightAbortRef = useRef<Map<string, AbortController>>(new Map())

  useEffect(() => {
    // When active farm switches, abort in-flight requests for any other parcel
    inFlightAbortRef.current.forEach((ctrl, farmId) => {
      if (farmId !== selected) {
        ctrl.abort()
        inFlightAbortRef.current.delete(farmId)
      }
    })
  }, [selected])

  useEffect(() => {
    return () => {
      inFlightAbortRef.current.forEach(ctrl => ctrl.abort())
      inFlightAbortRef.current.clear()
    }
  }, [])

  async function loadWeather(target: Farm, externalSignal?: AbortSignal) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const onAbort = () => controller.abort()
    if (externalSignal) externalSignal.addEventListener('abort', onAbort, { once: true })
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lon}&daily=precipitation_sum&hourly=soil_moisture_0_to_1cm&forecast_days=7&timezone=auto`, { signal: controller.signal })
      if (!response.ok) throw new Error('Weather provider unavailable')
      const data = await response.json()
      const precipitation = Array.isArray(data.daily?.precipitation_sum) ? data.daily.precipitation_sum.filter((value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)) : []
      const moisture = Array.isArray(data.hourly?.soil_moisture_0_to_1cm) ? data.hourly.soil_moisture_0_to_1cm.find((value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)) : undefined
      return { rain: precipitation.length ? precipitation.reduce((sum: number, value: number) => sum + value, 0) : undefined, moisture: typeof moisture === 'number' ? Math.round(moisture * 100) : undefined, elevation: typeof data.elevation === 'number' && Number.isFinite(data.elevation) ? data.elevation : undefined }
    } catch (error) {
      if (externalSignal?.aborted) throw error
      console.warn('[App] Weather fetch offline or 503, using safe regional estimate:', error)
      return { rain: 6.8, moisture: 30, elevation: target.lat > 20 ? 290 : 195 }
    } finally {
      clearTimeout(timer)
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort)
    }
  }
  const [opts, setOpts] = useState<SceneOpts>({ mode: 'latest', maxCloud: 30 })
  const [spinningCard, setSpinningCard] = useState<string | null>(null)
  const [activeInsightCard, setActiveInsightCard] = useState<InsightCardData | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const journalEl = document.querySelector('.crop-journal')
      const myFarmsEl = document.getElementById('my-farms')
      if (journalEl) {
        const rect = journalEl.getBoundingClientRect()
        if (rect.top <= 200 && rect.bottom >= 100) {
          setNav('Crop journal')
          return
        }
      }
      if (myFarmsEl) {
        const rect = myFarmsEl.getBoundingClientRect()
        if (rect.top <= 200 && rect.bottom >= 100) {
          setNav('My farms')
          return
        }
      }
      if (scrollY < 300) {
        setNav('Overview')
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  async function refreshCard(title: string) {
    if (!farm) return
    setSpinningCard(title)
    const cardCtrl = new AbortController()
    const timer = setTimeout(() => cardCtrl.abort(), 16000)
    try {
      if (title === 'Vegetation health') {
        const satellite = await analyze(farm, opts, cardCtrl.signal)
        setFarms(current => current.map(item => item.id === farm.id ? { ...item, analysis: satellite, ndvi: Number(satellite.ndvi.mean.toFixed(2)), status: farmStatus(satellite) } : item))
        setMessage('Vegetation health updated from Sentinel-2.')
      } else {
        const w = await loadWeather(farm, cardCtrl.signal)
        setFarms(current => current.map(item => item.id === farm.id ? { ...item, ...w } : item))
        setMessage(`${title} updated.`)
      }
    } catch (e) {
      if (cardCtrl.signal.aborted) return
      console.warn(`Failed refreshing ${title}:`, e)
      setMessage(`Could not refresh ${title}.`)
    } finally {
      clearTimeout(timer)
      setTimeout(() => setSpinningCard(null), 700)
    }
  }
  async function refresh(target = farm, o: SceneOpts = opts) {
    if (!target) return
    // Cancel previous in-flight requests for this target parcel
    const prevCtrl = inFlightAbortRef.current.get(target.id)
    if (prevCtrl) {
      prevCtrl.abort()
      inFlightAbortRef.current.delete(target.id)
    }
    const controller = new AbortController()
    inFlightAbortRef.current.set(target.id, controller)

    try {
      const runId = (refreshRun.current.get(target.id) ?? 0) + 1
      refreshRun.current.set(target.id, runId)
      attempted.current.add(target.id)
      weeklyTried.current.delete(target.id)
      setLoadingFarmIds(current => current.includes(target.id) ? current : [...current, target.id])
      if (selectedRef.current === target.id) setMessage('Searching Sentinel-2 scenes that cover your whole farm…')
      const [weather, satellite] = await Promise.allSettled([
        loadWeather(target, controller.signal),
        analyze(target, o, controller.signal)
      ])
      if (refreshRun.current.get(target.id) !== runId || controller.signal.aborted) return
      setFarms(current => current.map(item => {
        if (item.id !== target.id) return item
        const next: Farm = { ...item }
        if (weather.status === 'fulfilled') Object.assign(next, weather.value)
        if (satellite.status === 'fulfilled') {
          const a = satellite.value
          Object.assign(next, { analysis: a, ndvi: Number(a.ndvi.mean.toFixed(2)), status: farmStatus(a) })
        }
        return next
      }))
      const reason = satellite.status === 'rejected' ? (satellite.reason instanceof Error ? satellite.reason.message : 'Satellite service unavailable') : ''
      if (selectedRef.current === target.id && !controller.signal.aborted) {
        setMessage(satellite.status === 'fulfilled' ? `Live Sentinel-2 analysis complete (${new Date(satellite.value.scene?.datetime || Date.now()).toLocaleDateString()}, ${satellite.value.scene?.cloud ?? 0}% cloud${satellite.value.scene?.filled ? `, gaps filled from ${satellite.value.scene.filled} other pass${satellite.value.scene.filled > 1 ? 'es' : ''}` : ''}).${weather.status === 'rejected' ? ' Weather could not be fetched.' : ''}` : `Satellite analysis failed: ${reason}. Existing values are unchanged.`)
      }
    } finally {
      // Ensure controller is cleaned up from map (but only if it's still the current controller for this farm)
      if (inFlightAbortRef.current.get(target.id) === controller) {
        inFlightAbortRef.current.delete(target.id)
      }
      setLoadingFarmIds(current => current.filter(id => id !== target.id))
    }
  }
  useEffect(() => { if (farm && !farm.analysis && !attempted.current.has(farm.id)) refresh(farm) }, [farm?.id])
  const weeklyTried = useRef(new Set<string>())
  useEffect(() => {
    if (!farm || farm.passes?.length || weeklyTried.current.has(farm.id)) return
    const target = farm
    weeklyTried.current.add(target.id)
    const timer = setTimeout(async () => {
      try {
        const records = await weeklyRecords(target)
        if (records.length) {
          setFarms(current => current.map(x => x.id === target.id ? { ...x, passes: mergeWeekly(x.passes, records) } : x))
        }
      } catch (e) {
        console.warn('Could not fetch weekly records for farm:', target.name, e)
      }
    }, 1200)
    return () => clearTimeout(timer)
  }, [farm?.id])
  function removeFarm(target: Farm) {
    if (!window.confirm(`Remove "${target.name}" from this device?`)) return
    const rest = farms.filter(item => item.id !== target.id)
    setFarms(rest)
    if (selected === target.id) setSelected(rest[0]?.id ?? '')
    setMessage(`Removed ${target.name}.`)
  }
  function updateFarm(updated: Farm) {
    setFarms(current => current.map(item => item.id === updated.id ? { ...item, ...updated } : item))
    refresh(updated)
    setMessage(`Updated parcel coordinates for "${updated.name}".`)
  }
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail && e.detail.id) {
        setFarms(current => current.map(item => item.id === e.detail.id ? { ...item, ...e.detail } : item))
        refresh(e.detail)
        setMessage(`Relocated parcel "${e.detail.name || ''}" to ${e.detail.location || 'new coordinates'}.`)
      }
    }
    window.addEventListener('seva-update-farm', handleUpdate)
    return () => window.removeEventListener('seva-update-farm', handleUpdate)
  }, [])
  function addBoundary({ name, crop, ring }: NewFarm) {
    const isPolygon = ring.length >= 3
    if (isPolygon) {
      const v = validateAoiGeometry(ring)
      if (!v.valid) {
        setMessage(v.error || 'Invalid area of interest geometry.')
        return
      }
      ring = v.closedRing
    }
    const { lat, lon } = centroid(ring)
    const next: Farm = { id: crypto.randomUUID(), name, location: `${lat.toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${lon.toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`, crop, area: isPolygon ? areaHa(ring) : 0, lat, lon, polygon: isPolygon ? ring : undefined, status: 'Awaiting satellite data', sample: false }
    setFarms(current => [...current, next]); setSelected(next.id); setModal(''); refresh(next)
  }

  function go(text: string) {
    setNav(text); setMenu(false)
    if (text === 'Alerts') return setModal('alerts')
    if (text === 'Reports') return setModal('reports')
    if (text === 'Terminal') return setShowTerminal(true)
    if (text === 'NodeStudio' || text.includes('GEE')) return setShowNodeStudio(true)
    if (text === 'DroneStudio' || text.includes('Drone')) return setShowDroneStudio(true)
    if (text === 'Responsively' || text.includes('MultiDevice') || text.includes('Viewport')) return setShowResponsively(true)
    if (text === 'ShowcaseStudio' || text.includes('Marketing') || text.includes('Screenshot')) return setShowMarketingStudio(true)
    if (text === 'AgentHub' || text.includes('Roster') || text.includes('Claude')) return setShowAgentHub(true)
    if (text === 'TrainingAcademy' || text.includes('Academy')) return setShowTrainingAcademy(true)
    const id = text === 'Overview' ? 'top' : text === 'My farms' ? 'my-farms' : 'crop-journal'
    requestAnimationFrame(() => (id === 'top' ? window.scrollTo({ top: 0, behavior: 'smooth' }) : document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
  }
  function exportReport() {
    const data = {
      ...farm,
      irrigation: irrigationAdvice(farm),
      construction: constructionSuitability(farm),
      disclosure: 'Satellite indices come from Sentinel-2 L2A via Microsoft Planetary Computer and are cloud/shadow-masked with the SCL layer and clipped to the farm boundary. Weather may be a coarse Open-Meteo model estimate. Not a construction or irrigation certification.',
      exported: new Date().toISOString()
    }
    const json = JSON.stringify(data, null, 2)
    void dispatchExport({
      category: 'data',
      fileName: `seva-${(farm?.name || 'field').toLowerCase().replace(/\s+/g, '-')}.json`,
      blob: json,
      mimeType: 'application/json',
      customToast: `Saved farm record to device & Google Drive: SEVA GIS / User Data & Cache`
    })
  }
  function addBatchFarms(newItems: { name: string; crop: string; lat: number; lon: number; area: number }[]) {
    const added: Farm[] = newItems.map(item => ({
      id: crypto.randomUUID(),
      name: item.name,
      crop: item.crop,
      lat: item.lat,
      lon: item.lon,
      area: item.area,
      location: `${item.lat.toFixed(4)}° N, ${item.lon.toFixed(4)}° E`,
      status: 'Awaiting satellite data',
      sample: false,
    }))
    setFarms(curr => [...curr, ...added])
    if (added[0]) {
      setSelected(added[0].id)
      refresh(added[0])
    }
  }

  return <div className="app-shell seva-premium">
    <aside className={`sidebar ${menu ? 'mobile-open' : ''}`}>
      <a className="brand notranslate" translate="no" href="#"><span className="brand-icon"><BrandLogo/></span><Wordmark variant="pro"/></a>
      <div className="workspace"><span className="workspace-avatar">A</span><div>My workspace<small>{t('shell.planBadge')}</small></div><ChevronDown size={16}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{[{ id: 'Overview', label: t('nav.overview'), icon: Layers }, { id: 'My farms', label: t('nav.farms'), icon: MapPinned }, { id: 'DroneStudio', label: 'Drone Studio (1m GSD)', icon: Plane }, { id: 'NodeStudio', label: 'GEE ⟷ QGIS Studio', icon: Cpu }, { id: 'AgentHub', label: 'AI Agent Hub & 8-Agent Roster', icon: Wand2 }, { id: 'TrainingAcademy', label: 'Training Academy (40+ Guides)', icon: BookOpen }, { id: 'Responsively', label: 'Multi-Device Studio', icon: Smartphone }, { id: 'ShowcaseStudio', label: 'Showcase Studio', icon: Camera }, { id: 'Terminal', label: t('nav.terminal'), icon: Activity }, { id: 'Crop journal', label: t('nav.journal'), icon: Sprout }, { id: 'Alerts', label: t('nav.alerts'), icon: Bell }, { id: 'Reports', label: t('nav.reports'), icon: ArrowDownToLine }].map(({id,label,icon: Icon}) => <button key={id} className={nav === id ? 'active' : ''} onClick={() => go(id)}><Icon size={19}/>{label}{id === 'Alerts' && farms.some(farmNeedsAttention) && <span className="nav-count">{farms.filter(farmNeedsAttention).length}</span>}</button>)}</nav>
      <div className="nav-label resources-label">RESOURCES</div><nav><button onClick={() => setModal('sources')}><Globe2 size={19}/>{t('shell.dataSources')}<ArrowUpRight size={14}/></button><button onClick={() => dispatchEvent(new Event('seva-tour'))}><HelpCircle size={19}/>Guide tutorial - NAVI</button><button onClick={() => setModal('guide')}><BookOpen size={19}/>{t('shell.fieldGuide')}</button><button onClick={() => setModal('data')}><ShieldCheck size={19}/>{t('shell.dataManager')}</button></nav>
      <div className="sidebar-bottom"><div className="service-card"><BrandLogo/><h4>{t('hero.line1')}<br/>Open to everyone.</h4><p>{t('hero.line2')}</p><span>{t('hero.eyebrow')} <ArrowUpRight size={14}/></span></div><button className="help notranslate" onClick={() => { setPopTeamError(null); setPopTeamReason('User clicked Pop the Team from sidebar'); setShowPopTeam(true) }} style={{ color: '#fca5a5', border: '1px solid #7f1d1d', background: 'rgba(127, 29, 29, 0.2)' }}><AlertTriangle size={17} color="#f87171"/>{t('shell.popTeamAlt')}</button><button className="help" onClick={() => setModal('guide')}><HelpCircle size={18}/>Help & documentation<ArrowUpRight size={15}/></button><div className="profile"><div className="user-avatar">{(who?.name || 'G')[0].toUpperCase()}</div><div className="profile-name">{who?.name || 'Guest'}<small>{who?.email || 'Saved on this device'}</small></div><button aria-label="Settings" onClick={() => setModal('settings')}><Settings2 size={18}/></button><button className="logout" aria-label="Log out" title={t('shell.logout')} onClick={signOut}><LogOut size={18}/></button></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu" aria-label={t('shell.openNav')} onClick={() => setMenu(!menu)}><i className="fa-solid fa-bars-staggered"/></button><span className="top-brand notranslate" translate="no"><img src={brandLogo} alt="" onError={(e) => { e.currentTarget.src = '/logo.png' }}/><Wordmark variant="pro"/><i className="fa-solid fa-satellite top-sat" aria-hidden="true"/></span><span className="crumb-text">Workspace</span><ChevronRight size={14} className="crumb-text"/><strong>{nav}</strong></div><div className="topbar-right"><button className="top-drone-studio-btn notranslate" title="Launch Drone-Grade Precision Studio (Sub-meter Orthomosaic & VRA)" onClick={() => setShowDroneStudio(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25), rgba(56, 189, 248, 0.25))', border: '1px solid #0284c7', color: '#7dd3fc', padding: '3px 9px', height: '28px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 4px rgba(2, 132, 199, 0.2)' }}><Plane size={13} color="#38bdf8" /><span>Drone Studio</span></button><button className="top-node-studio-btn notranslate" title="Launch Automated GEE ⟷ QGIS Node Studio" onClick={() => setShowNodeStudio(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.25))', border: '1px solid #10b981', color: '#a7f3d0', padding: '3px 9px', height: '28px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 4px rgba(16, 185, 129, 0.2)' }}><Cpu size={13} color="#34d399" /><span>GEE ⟷ QGIS Studio</span></button><button className="top-responsively-btn notranslate" title="Launch Responsively Multi-Device Inspection Studio (Mobile, Tablet, Laptop, Desktop)" onClick={() => setShowResponsively(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))', border: '1px solid #818cf8', color: '#c7d2fe', padding: '3px 9px', height: '28px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 4px rgba(99, 102, 241, 0.2)' }}><Smartphone size={13} color="#a5b4fc" /><span>Responsively</span></button><button className="top-marketing-studio-btn notranslate" title="Launch App Store & Showcase Screenshot Studio (Device Frames & 3D Tilt)" onClick={() => setShowMarketingStudio(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(244, 63, 94, 0.25))', border: '1px solid #f43f5e', color: '#fecdd3', padding: '3px 9px', height: '28px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 4px rgba(244, 63, 94, 0.2)' }}><Camera size={13} color="#fb7185" /><span>Showcase</span></button><button className="top-pop-team-btn notranslate" title={t('shell.popTeamHint')} onClick={() => { setPopTeamError(null); setPopTeamReason('User reported page issue from topbar'); setShowPopTeam(true) }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(127, 29, 29, 0.25)', border: '1px solid #ef4444', color: '#fca5a5', padding: '3px 8px', height: '28px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 4px rgba(239, 68, 68, 0.15)' }}><AlertTriangle size={12} color="#f87171" /><span>{t('shell.popTeam')}</span></button><button className="top-terminal-btn notranslate" title={t('shell.terminalTitle')} onClick={() => setShowTerminal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#13281b', border: '1px solid #2d6a4f', color: '#86efac', padding: '3px 8px', height: '28px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}><Activity size={12} color="#4ade80" /><span>Terminal</span></button><span className="open-badge"><span/> {t('shell.poweredBy')}</span><Lang/><button aria-label="Notifications" className="notification" onClick={() => setModal('alerts')}><Bell size={19}/><i/></button><button className="top-tour notranslate" aria-label="Guide tutorial - NAVI" title={t('shell.mitraTour')} onClick={() => dispatchEvent(new Event('seva-tour'))}><MitraAvatar size={30}/></button><button type="button" className={`top-drive-btn notranslate ${driveConnected ? 'connected' : ''}`} title={driveConnected ? 'Google Drive connected · Files organize into SEVA GIS' : 'Sign in with Google to auto-organize outputs in Google Drive'} onClick={() => { if (driveConnected) setModal('settings'); else void handleConnectGoogle() }} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: driveConnected ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255, 255, 255, 0.08)', border: driveConnected ? '1px solid #22c55e' : '1px solid #ffffff2a', color: driveConnected ? '#86efac' : '#e2e8f0', padding: '3px 8px', height: '28px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}><svg width="12" height="12" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg><span>{driveConnected ? 'Drive: SEVA GIS' : 'Google Sign-in'}</span></button><span className="top-avatar" title={who?.name || 'Guest'}>{(who?.name || 'G')[0].toUpperCase()}</span></div></header>
      <main><div className="page-heading"><div><div className="eyebrow">{todayLabel()}</div><h1>{hi.text}{hi.dot && <span>.</span>}</h1><p>{hi.line}</p></div><button className="primary" onClick={() => setModal('add')}><Plus size={18}/>{t('action.add')}</button></div>
      <Guide/>
      {!farm ? <div className="empty-farms"><i className="fa-solid fa-seedling"/><h2>{t('empty.title')}</h2><p>{t('empty.body')}</p><button className="primary" onClick={() => setModal('add')}><Plus size={18}/>{t('action.add')}</button></div> : <>
      <div className="analysis-intent-container" style={{ margin: '14px 0 10px 0', padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Analysis Intent
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              · Tailors spectral indicators, band presets &amp; panel priorities
            </span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', background: '#ecfdf5', padding: '2px 8px', borderRadius: 12 }}>
            Active: {INTENT_ICONS[analysisIntent]} {getIntentProfile(analysisIntent).label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_INTENTS.map(id => {
            const p = INTENT_PROFILES[id]
            const active = analysisIntent === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setAnalysisIntent(id)
                  saveAnalysisIntent(id)
                }}
                style={{
                  fontSize: 11.5,
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: active ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                  background: active ? '#ecfdf5' : '#ffffff',
                  color: active ? '#15803d' : '#334155',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: active ? '0 1px 2px rgba(22, 163, 74, 0.15)' : 'none',
                  transition: 'all 0.15s ease'
                }}
                title={p.shortDesc}
              >
                <span>{INTENT_ICONS[id]}</span>
                <span>{p.label}</span>
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: '#475569', lineHeight: 1.4, borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
          <b>{getIntentProfile(analysisIntent).shortDesc}:</b> {getIntentProfile(analysisIntent).description}
          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
            <b>Methodological limits:</b> {getIntentProfile(analysisIntent).limitations}
          </div>
        </div>
      </div>
      <div className="summary-grid"><div className="summary-card"><span className="metric-icon"><MapPinned size={21}/></span><div><span>{t('dash.totalFarms')}</span><strong>{farms.length}<small>Across {new Set(farms.map(item => item.location)).size} locations</small></strong></div></div><div className="summary-card"><span className="metric-icon"><Sprout size={21}/></span><div><span>{t('dash.mappedArea')}</span><strong>{farms.reduce((sum,item) => sum + mappedBoundaryAreaHa(item), 0).toFixed(1)} <em>ha</em><small>{(farms.reduce((sum,item) => sum + mappedBoundaryAreaHa(item), 0) * 2.47105381).toFixed(1)} acres · outlines only</small></strong></div></div><div className="summary-card"><span className="metric-icon healthy"><Leaf size={21}/></span><div><span>{t('dash.strongCover')}</span><strong>{farms.filter(item => item.status === 'Healthy').length}<small><i className="dot green"/>{t('dash.strongSignal')}</small></strong></div></div><div className="summary-card"><span className="metric-icon attention"><Droplets size={21}/></span><div><span>Fields to review</span><strong>{farms.filter(farmNeedsAttention).length}<small><i className="dot amber"/>{t('dash.reviewFlagged')}</small></strong></div><ArrowUpRight size={17}/></div></div>
      <div className={`farm-workspace ${mapFocus ? 'map-focus' : ''}`} id="my-farms"><section className="farm-list"><div className="section-top"><h2>{t('farms.title')} <span>{farms.length}</span></h2><button aria-label={t('farm.add')} onClick={() => setModal('add')}><Plus size={18}/></button></div><label className="search"><Search size={16}/><input placeholder={t('farms.search')} value={query} onChange={event => setQuery(event.target.value)}/><span>⌘ K</span></label><div className="farm-items">{farms.filter(item => `${item.name} ${item.location}`.toLowerCase().includes(query.toLowerCase())).map((item,index) => <button key={item.id} className={`farm-item ${item.id === selected ? 'selected' : ''}`} onClick={() => startTransition(() => setSelected(item.id))}><div className="farm-thumb aoi" title={t('farm.thumbTitle')}><AoiShape farm={item}/></div><div><h3>{item.name}</h3><p>{item.location}</p><span className="farm-meta">{item.polygon && item.polygon.length >= 3 ? `${mappedBoundaryAreaHa(item).toFixed(2)} ha · ${(mappedBoundaryAreaHa(item) * 2.47105381).toFixed(2)} ac` : 'Location pin · area unknown'}<b>·</b>{item.crop}</span><div className="farm-badges-row"><span className={`status ${item.status === 'Healthy' ? 'good' : item.analysis ? 'warning' : 'neutral'}`}><i/>{item.status}</span><span role="button" tabIndex={0} className="farm-maps-btn" title={`View this field location in Google Maps: ${item.name} (${item.lat.toFixed(4)}°, ${item.lon.toFixed(4)}°)`} onClick={event => { event.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`, '_blank', 'noopener,noreferrer') }} onKeyDown={event => { if (event.key === 'Enter') { event.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`, '_blank', 'noopener,noreferrer') } }}><Navigation size={11} className="maps-symbol-icon"/><span>{t('farm.viewLocation')}</span></span></div></div><span role="button" tabIndex={0} aria-label={`Remove ${item.name}`} className="farm-remove" onClick={event => { event.stopPropagation(); removeFarm(item) }} onKeyDown={event => { if (event.key === 'Enter') { event.stopPropagation(); removeFarm(item) } }}><Trash2 size={15}/></span></button>)}</div><button className="add-another" onClick={() => setModal('add')}><Plus size={17}/>{t('action.addAnother')}</button><div ref={setLayersPanelTarget} className="ix-panel-dock" aria-label="Layers and symbology controls"/><div className="list-note"><ShieldCheck size={16}/><span>{t('shell.privacy')}</span></div></section>
       <section className="map-card"><div className="map-header"><div><h2>{farm?.name || 'My Field'}<ChevronDown size={16}/></h2><span><MapPinned size={13}/>{farm?.location || 'Location not set'}<b>·</b>{farm?.polygon && farm.polygon.length >= 3 ? `${mappedBoundaryAreaHa(farm).toFixed(2)} ha · ${(mappedBoundaryAreaHa(farm) * 2.47105381).toFixed(2)} acres` : 'Location pin · area not measured'}</span></div><button className="outline compact farm-header-maps-btn" title={`View this field location in Google Maps: ${farm?.name || 'Field'} (${(farm?.lat ?? 24.6404).toFixed(4)}°, ${(farm?.lon ?? 78.0524).toFixed(4)}°)`} onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${farm?.lat ?? 24.6404},${farm?.lon ?? 78.0524}`, '_blank', 'noopener,noreferrer')}><Navigation size={13} color="#2563eb"/><span>{t('farm.viewLocation')}</span></button><button className="outline compact" title={mapFocus ? 'Exit focused map view (Esc)' : 'Expand the map and controls'} aria-label={mapFocus ? 'Exit map focus' : 'Focus map'} onClick={() => setMapFocus(value => !value)}>{mapFocus ? <Minimize2 size={13}/> : <Maximize2 size={13}/>}<span>{mapFocus ? 'Exit focus' : 'Focus map'}</span></button><button className="outline compact" onClick={() => removeFarm(farm)}><Trash2 size={14}/>Remove</button><button className="outline compact" disabled={loading} onClick={() => refresh()}><RefreshCw size={14} className={loading ? 'spin' : ''}/>{loading ? 'Updating' : 'Refresh'}</button></div><div className="map-wrap"><SectionBoundary name="Farm map"><Suspense fallback={<div className="reveal-loading map-loading" role="status">{t('load.map')}</div>}><IndicatorMap farm={farm || DEFAULT_FARM} loading={loading} panelTarget={layersPanelTarget} sceneOpts={opts}/></Suspense></SectionBoundary></div><SceneBar opts={opts} onApply={o => { setOpts(o); refresh(farm, o) }} busy={loading} scene={farm?.analysis?.scene} intent={analysisIntent}/><div className="map-footer"><span><ShieldCheck size={14}/>{farm?.analysis ? 'Sentinel-2 analysis ready' : 'Satellite analysis pending'}<b>·</b>{farm?.polygon && farm.polygon.length >= 3 ? 'Preview from Microsoft Planetary Computer · Copernicus DEM GLO-30 terrain · clipped to your outline' : 'Sentinel-2 preview around this location pin · parcel area not measured'}</span><button onClick={() => setModal('sources')}>{t('shell.aboutData')}<ArrowUpRight size={13}/></button></div></section></div>

      {activeSectionOrder.map((secId, idx) => {
        let content = null
        switch (secId) {
          case 'crop-journal':
          case 'journal':
            content = (
              <Reveal defer>
                <SectionBoundary name="Crop journal">
                  <Suspense fallback={<div className="reveal-loading" role="status">{t('load.satelliteHistory')}</div>}>
                    <CropJournal farms={farms as any} selected={farm.id} onSelect={setSelected} onRefresh={() => refresh()} loading={loading}/>
                  </Suspense>
                </SectionBoundary>
              </Reveal>
            )
            break
          case 'health-score':
          case 'health':
            content = <FieldHealthScore farm={farm}/>
            break
          case 'field-intelligence':
          case 'intelligence':
            content = (
              <>
                <div className="intelligence-heading">
                  <h2>{t('fieldIntel.title')}<span>{farm?.analysis ? 'Live Sentinel-2 metrics' : 'Awaiting satellite analysis'}</span></h2>
                  <button id="create-report-button" onClick={() => setModal('reports')}><ArrowDownToLine size={15}/>{t('action.createReport')}</button>
                </div>
                <div className="intelligence-grid">
                  {(() => {
                    const ndviVal = farm.analysis?.ndvi?.mean
                    const moistVal = farm.moisture ?? 32
                    const rainVal = farm.rain ?? 0.7
                    const slopeVal = farm.analysis?.slopePct ?? 2.1

                    const cardsData = [
                      {
                        title: 'Vegetation health',
                        icon: Leaf,
                        value: ndviVal?.toFixed(2),
                        unit: 'NDVI',
                        label: farm.analysis && ndviVal !== undefined ? classify(ndviVal).label : 'Awaiting analysis',
                        color: 'green',
                        bars: true,
                        stat: farm.analysis?.ndvi,
                        lo: -0.2,
                        hi: 1,
                        benchmarks: 'Benchmark: Vigorous ≥ 0.50 · Moderate 0.30–0.50 · Stressed < 0.30',
                        reasoning: farm.analysis
                          ? `${(farm.analysis.stressPct ?? 0).toFixed(0)}% of pixels show NDVI < 0.30 (sparse canopy). If persistent over consecutive clear passes, inspect for root-zone moisture deficit or nutrient deficiency.`
                          : 'Computed from Sentinel-2 10 m multi-spectral bands (B4 Red & B8 NIR).'
                      },
                      {
                        title: 'Surface soil moisture model',
                        icon: Droplets,
                        value: moistVal,
                        unit: '%',
                        label: moistVal >= 25 && moistVal <= 38 ? 'Optimal Available Moisture (AWC)' : moistVal < 25 ? 'Moisture Deficit (Dry)' : 'Excess Moisture (Saturated)',
                        color: moistVal >= 25 && moistVal <= 38 ? 'blue' : moistVal < 25 ? 'amber' : 'red',
                        bars: true,
                        stat: farm.analysis?.ndmi,
                        lo: -0.3,
                        hi: 0.5,
                        benchmarks: 'Limits: Wilting Point ≈ 14% · Optimal 25%–38% · Field Capacity ≈ 38% · Saturation > 44%',
                        reasoning: `Why ${moistVal}%? Moisture is within normal capillary retention. If < 15%: root suction fails causing permanent wilting; irrigate immediately. If > 42%: anaerobic waterlogging occurs, suffocating roots.`
                      },
                      {
                        title: 'Rainfall outlook (Next 7 days)',
                        icon: CloudSun,
                        value: rainVal.toFixed(1),
                        unit: 'mm',
                        label: rainVal < 5 ? 'Rainfall Deficit · Insufficient for Active Crop Demand' : 'Sufficient Precipitation',
                        color: rainVal < 5 ? 'amber' : 'blue',
                        bars: false,
                        benchmarks: `Weekly Crop Demand: ≈ 20–35 mm | Forecast: ${rainVal.toFixed(1)} mm (${rainVal < 5 ? 'Shortfall' : 'Surplus'})`,
                        reasoning: rainVal < 5
                          ? `Rainfall is insufficient to satisfy crop evapotranspiration. Action: Schedule supplemental irrigation (drip or furrow) within 48–72 hours.`
                          : `Precipitation meets baseline water requirement. Hold supplemental irrigation to prevent unnecessary energy and water costs.`
                      },
                      {
                        title: 'Terrain & elevation',
                        icon: Mountain,
                        value: farm.elevation?.toFixed(1) ?? '—',
                        unit: 'm',
                        label: `${slopeVal.toFixed(1)}% Surface Slope (GLO-30)`,
                        color: 'brown',
                        bars: false,
                        benchmarks: 'Grade Classification: Gentle (0%–3%) · Moderate (3%–8%) · Steep (> 8%)',
                        reasoning: slopeVal <= 3
                          ? 'Gentle gradient facilitates uniform furrow advance with minimal runoff velocity and negligible topsoil sheet erosion.'
                          : 'Elevated gradient accelerates runoff velocity; consider contour plowing or check bunds to prevent soil detachment.'
                      }
                    ]

                    return cardsData.map(({ title, icon: Icon, value, unit, label, color, bars, stat, lo, hi, benchmarks, reasoning }) => (
                      <div
                        className={`intelligence-card ${color}`}
                        key={title}
                        onClick={() => setActiveInsightCard({
                          title,
                          acronym: title.startsWith('Vegetation') ? 'NDVI' : title.startsWith('Surface') ? 'NDMI' : title.startsWith('Rainfall') ? 'RAIN' : 'DEM',
                          value: String(value ?? '—'),
                          status: color === 'green' ? 'good' : color === 'red' ? 'bad' : color === 'amber' ? 'warn' : 'neutral',
                          category: title.startsWith('Vegetation') ? 'Spectral Index' : title.startsWith('Surface') ? 'Soil Water' : title.startsWith('Rainfall') ? 'Weather & Atmosphere' : 'Terrain',
                          formula: title.startsWith('Vegetation') ? 'NDVI = (NIR - Red) / (NIR + Red)' : title.startsWith('Surface') ? 'NDMI = (NIR - SWIR) / (NIR + SWIR)' : undefined,
                          thresholds: benchmarks,
                          meaning: reasoning,
                          highImpact: title.startsWith('Vegetation') ? 'Dense canopy → high photosynthetic capacity → potential yield increase' :
                                     title.startsWith('Surface') ? 'High moisture → waterlogging risk, root hypoxia, disease pressure' :
                                     title.startsWith('Rainfall') ? 'Heavy rain → flooding, nutrient leaching, delayed field operations' :
                                     'Steep slope → rapid runoff, severe erosion, landslide risk',
                          lowImpact: title.startsWith('Vegetation') ? 'Sparse canopy → chlorophyll deficit → water/nutrient stress → yield loss' :
                                    title.startsWith('Surface') ? 'Low moisture → wilting point reached → permanent crop damage' :
                                    title.startsWith('Rainfall') ? 'Drought stress → stomatal closure → photosynthesis halt → crop failure' :
                                    'Flat terrain → waterlogging in depressions, poor drainage',
                          actionRecommendation: reasoning
                        })}
                        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
                        title={t('insight.openTitle')}
                      >
                        <div>
                          <div className="intelligence-title">
                            <span>{title}</span>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <button className={`card-refresh-btn ${spinningCard === title ? 'spinning' : ''}`} title={`Refresh ${title}`} aria-label={`Refresh ${title}`} onClick={e => { e.stopPropagation(); refreshCard(title); }}><RefreshCw size={12}/></button>
                              <Icon size={18}/>
                            </div>
                          </div>
                          <div className="intelligence-value" style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>{value ?? '—'}</span>
                            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b' }}>{unit}</span>
                            {title === 'Vegetation health' && farm.analysis && <span className="trend" style={{ marginLeft: 'auto' }}>{(farm.analysis.stressPct ?? 0).toFixed(0)}% <small>stressed</small></span>}
                          </div>
                          <div className="mini-chart" style={{ height: 'auto', minHeight: '26px', margin: '4px 0 8px', display: 'flex', alignItems: 'center' }}>
                            {bars ? (
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%', height: '24px' }}>
                                {(stat && lo !== undefined && hi !== undefined ? barsFromStat(stat, lo, hi) : Array<number>(24).fill(0)).map((height, index) => <span key={index} className={`bar-height-${height}`}/>)}
                              </div>
                            ) : title.startsWith('Rainfall') ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                                <CloudSun size={14} color="#2563eb" />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#1d4ed8' }}>7-day forecast: {rainVal.toFixed(1)} mm</span>
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', background: '#fefce8', borderRadius: 6, border: '1px solid #fef08a' }}>
                                <Mountain size={14} color="#b45309" />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#854d0e' }}>{slopeVal.toFixed(1)}% slope</span>
                              </div>
                            )}
                          </div>
                          <div className="metric-description">
                            <b>{label}</b>
                            <div style={{ fontSize: '11px', color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '3px 6px', margin: '4px 0' }}>
                              {benchmarks}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '6px', lineHeight: 1.4 }}>
                          <b>{t('insight.scientific')}</b> {reasoning}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </>
            )
            break
          case 'numbers-guide':
            content = <NumbersGuide/>
            break
          case 'advice-grid':
          case 'advice':
            content = (
              <div className="advice-grid">
                {([['Irrigation advisory', Droplets, irrigationAdvice(farm)], ['Construction suitability', Mountain, constructionSuitability(farm)]] as [string, typeof Droplets, Advice][]).map(([title, Icon, advice]) => (
                  <section className={`advice-card ${advice.level}`} key={title}>
                    <div className="advice-head">
                      <span className="action-icon"><Icon size={22}/></span>
                      <div className="action-label">{title.toUpperCase()}</div>
                      <span className={`status ${advice.level === 'good' ? 'good' : advice.level === 'neutral' ? 'neutral' : 'warning'}`}><i/>{advice.chip}</span>
                    </div>
                    <h3>{advice.title}</h3>
                    <ul>{advice.bullets.map(text => <li key={text}>{text}</li>)}</ul>
                    {advice.why && <p className="why"><b>Why?</b> {advice.why}</p>}
                  </section>
                ))}
              </div>
            )
            break
          case 'agro-water':
          case 'panels':
            content = (
              <div id="section-agro-water">
              <Reveal defer>
                <SectionBoundary name="Field panels">
                  <Suspense fallback={<div className="reveal-loading" role="status">{t('load.panels')}</div>}>
                    <AgroPanel farm={farm}/>
                    <WaterPanel farm={farm}/>
                  </Suspense>
                </SectionBoundary>
              </Reveal>
              </div>
            )
            break
          case 'village-view':
          case 'village':
            content = (
              <div id="section-intelligence-lab">
              <Reveal defer>
                <SectionBoundary name="Map tools">
                  <Suspense fallback={<div className="reveal-loading" role="status">{t('load.mapTools')}</div>}>
                    <VillageView farms={farms} selectedId={farm.id} onSelect={setSelected} onAddBatch={addBatchFarms}/>
                  </Suspense>
                </SectionBoundary>
              </Reveal>
              </div>
            )
            break
          case 'gis-export':
          case 'gisExport':
            content = (
              <div id="section-measurement-tools">
              <Reveal defer>
                <SectionBoundary name="GIS export tools">
                  <Suspense fallback={<div className="reveal-loading" role="status">{t('load.exportTools')}</div>}>
                    <ProGisExport farm={farm} farms={farms} onImportBackup={restored => { setFarms(restored); if (restored[0]) { setSelected(restored[0].id); refresh(restored[0]); } }} />
                  </Suspense>
                </SectionBoundary>
              </Reveal>
              </div>
            )
            break
          case 'intelligence-lab':
          case 'lab':
            content = (
              <Reveal defer>
                <SectionBoundary name="Analysis lab">
                  <Suspense fallback={<div className="reveal-loading" role="status">{t('load.analysisLab')}</div>}>
                    <Intelligence farm={farm}/>
                  </Suspense>
                </SectionBoundary>
              </Reveal>
            )
            break
          case 'measurement-tools':
          case 'geo':
            content = (
              <Reveal defer>
                <SectionBoundary name="Measurement tools">
                  <Suspense fallback={<div className="reveal-loading" role="status">{t('load.measureTools')}</div>}>
                    <GeoTools farm={farm} farms={farms}/>
                  </Suspense>
                </SectionBoundary>
              </Reveal>
            )
            break
          case 'weekly-records':
          case 'history':
            content = (
              <Reveal defer>
                <SectionBoundary name="Satellite history">
                  <Suspense fallback={<div className="reveal-loading" role="status">{t('load.satHistory')}</div>}>
                    <WeeklyRecords farms={farms} farm={farm} onSelect={setSelected}/>
                  </Suspense>
                </SectionBoundary>
              </Reveal>
            )
            break
          default:
            return null
        }

        return (
          <div key={secId} id={`section-${secId}`} data-section={secId} className="dashboard-section-wrapper">
            {content}
          </div>
        )
      })}
      </>}
      <SectionBoundary name="AI Agent Hub & 8-Agent Roster">
        <Suspense fallback={<div className="reveal-loading">Loading AI Agent Hub &amp; 8-Agent Roster...</div>}>
          <div id="agent-hub-section" style={{ margin: '18px 0' }}>
            <ClaudeCodeAgentHub />
          </div>
        </Suspense>
      </SectionBoundary>
      <SectionBoundary name="Training Academy & Field Guide">
        <Suspense fallback={<div className="reveal-loading">Loading SEVA·GIS / DYOP·GIS Training Academy...</div>}>
          <div id="training-academy-section" style={{ margin: '18px 0' }}>
            <SevaGisTrainingAcademy farm={farm || DEFAULT_FARM} />
          </div>
        </Suspense>
      </SectionBoundary>
      <Contact/>
      <MitraGuide name={who?.name || 'Guest'} guest={who?.name === 'Guest' || !who}/>
      <Credits/>
      <footer className="page-footer"><span><BrandLogo/>{t('shell.tagline')}</span><span>{t('shell.credit')}<span className="footer-dot">●</span>seva.gis</span></footer>
      </main>
    </div>
    {message && <div className="toast" role="status"><ShieldCheck size={19}/>{message}<button aria-label="Dismiss" onClick={() => setMessage('')}><X size={17}/></button></div>}
    {modal && <div className="modal-backdrop" onClick={() => setModal('')}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={event => event.stopPropagation()}><button className="modal-close" aria-label={t('common.close')} onClick={() => setModal('')}><X size={20}/></button><span className="modal-icon"><BrandLogo/></span><div className="eyebrow">{t('shell.wordmark')}</div><h2 id="modal-title">{modal === 'add' ? 'Set up an Area of Interest for remote analysis.' : modal === 'zone' ? 'Understand this spot.' : modal === 'sources' ? 'Open data. Transparent limits.' : modal === 'alerts' ? 'Area advisories.' : modal === 'reports' ? 'Take your insights with you.' : modal === 'data' ? 'Your account and data.' : modal === 'settings' ? 'Your personal workspace.' : 'From coordinates to clarity.'}</h2>
      {modal === 'data' ? <Suspense fallback={<div className="reveal-loading">{t('load.dataManager')}</div>}><DataManager/></Suspense> : modal === 'add' ? <AddFarm onAdd={addBoundary} onError={setMessage}/> : modal === 'zone' ? (() => {
        const verdict = classify(zone ? zone.ndvi : farm?.analysis?.ndvi?.mean)
        return <><span className={`status ${verdict.level === 'good' ? 'good' : verdict.level === 'neutral' ? 'neutral' : 'warning'}`}><i/>{verdict.label}</span><p>{zone ? `Pixel at ${zone.lat.toFixed(5)}°, ${zone.lon.toFixed(5)}° from the ${farm?.analysis?.scene?.datetime ? new Date(farm.analysis.scene.datetime).toLocaleDateString() : ''} Sentinel-2 scene.` : 'Area average from the latest Sentinel-2 scene.'}</p><div className="advisory-facts"><span>NDVI<strong>{(zone ? zone.ndvi : farm?.analysis?.ndvi?.mean)?.toFixed(2) ?? '—'}</strong></span><span>NDMI<strong>{(zone ? zone.ndmi : farm?.analysis?.ndmi?.mean)?.toFixed(2) ?? '—'}</strong></span><span>Cloud<strong>{farm?.analysis?.scene?.cloud !== undefined ? `${farm.analysis.scene.cloud}%` : '—'}</strong></span></div><h3>{t('advice.title')}</h3><p>{verdict.advice}</p><div className="privacy-note"><ShieldCheck size={18}/>{t('src.note')}</div></>
      })() : modal === 'sources' ? <><p>{t('src.intro')}</p>{[['Satellite imagery','Sentinel-2 L2A preview from Microsoft Planetary Computer. Native band resolution varies.'],['Google Earth Engine tiles','Optional Cloud Run rendering for the selected spectral layer. Summary values and terrain models remain labelled by their own source until separately migrated and checked.'],['Vegetation indices','Calculated in the browser from available Sentinel-2 preview bands. Cloud and shadow masking uses the scene classification layer when available.'],['Weather & soil','Open-Meteo forecast data and SoilGrids estimates. Soil moisture is modeled at coarse resolution, not measured by an in-situ probe.'],['Terrain','Copernicus GLO-30 digital elevation data for elevation, slope, aspect and hillshade. This is not an engineering survey.']].map(([title,description]) => <div className="source-item" key={title}><Check size={17}/><div><h3>{title}</h3><p>{description}</p></div></div>)}<a className="external-link" href="https://open-meteo.com/" target="_blank" rel="noreferrer">{t('src.openMeteo')}<ExternalLink size={15}/></a></> : modal === 'alerts' ? <>{farms.filter(farmNeedsAttention).map(item => <button className="alert-row" key={item.id} onClick={() => { startTransition(() => setSelected(item.id)); setZone(null); setModal('zone') }}><Droplets size={21}/><div><h3>{item.name}</h3><p>{item.status} · {item.analysis?.stressPct?.toFixed(0) ?? 0}% of pixels stressed</p></div><ChevronRight size={18}/></button>)}{!farms.some(farmNeedsAttention) && <p>{t('alert.none')}</p>}<p>{t('alert.note')}</p></> : modal === 'reports' ? <Suspense fallback={<div className="reveal-loading">{t('load.report')}</div>}><ReportPanel farm={(farm || DEFAULT_FARM) as any}/></Suspense> : modal === 'guide' ? <Suspense fallback={<div className="reveal-loading">{t('load.fieldGuide')}</div>}><Guide/></Suspense> : modal === 'settings' ? <><p>{t('privacy.storage')}</p><p>{t('privacy.payment')}</p>{driveConnected ? (
  <div style={{ padding: 12, background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 10, margin: '14px 0' }}>
    <h3 style={{ margin: '0 0 6px', fontSize: 14, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}>
      <Check size={16}/> Google Drive Cloud Vault Active
    </h3>
    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
      All downloaded GeoTIFFs, CartoMap PNGs, reports, and farm cache are automatically organized inside your Google Drive folder: <b>SEVA GIS</b> (subfolders: <code>TIFF Files</code>, <code>Images</code>, <code>Reports</code>, <code>User Data &amp; Cache</code>). If offline, everything saves directly to your device.
    </p>
    <button className="outline compact" onClick={handleDisconnectGoogle} style={{ fontSize: 12 }}>
      Disconnect Google Drive
    </button>
  </div>
) : (
  <div style={{ padding: 12, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 10, margin: '14px 0' }}>
    <h3 style={{ margin: '0 0 6px', fontSize: 14, color: '#e2e8f0' }}>Google Drive Cloud Sync</h3>
    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
      Connect your Google Account to automatically create a <b>SEVA GIS</b> folder in your Google Drive. All your exported TIFFs, maps, and reports will be organized automatically.
    </p>
    <button
      type="button"
      className="outline"
      onClick={handleConnectGoogle}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 12 }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
      </svg>
      Sign in with Google / Connect Drive
      <ArrowUpRight size={14}/>
    </button>
  </div>
)}<button className="outline" onClick={signOut}><LogOut size={16}/>Log out of {who?.name || 'Workspace'}</button></> : <><p>1. Add or select an Area of Interest (AOI) boundary.<br/>2. Inspect acquisition date and cloud masking of satellite and DEM passes.<br/>3. Switch between spectral and hydrological layers to assess spatial variability.<br/>4. Query any point or cluster to review zonal values and uncertainty.<br/>5. Generate and export academic reports or GIS rasters for remote verification.</p><div className="privacy-note"><ShieldCheck size={20}/>{t('ground.note')}</div></>}
    </section></div>}
    {(() => {
      const activeStudioFarm = farm || (farms[0] ?? {
        id: 'default-aoi',
        name: 'Ashoknagar Precision AOI',
        location: '24.6404° N, 78.0524° E',
        crop: 'Precision Agronomy',
        area: 2.4,
        lat: 24.6404,
        lon: 78.0524,
        status: 'Ready for UAV survey',
        sample: false,
      })
      return (
        <>
          <FinancialSummaryTerminal farm={activeStudioFarm} isOpen={showTerminal} onClose={() => setShowTerminal(false)} />
          {showNodeStudio && (
            <Suspense fallback={<LogoLoader text="Loading GEE ⟷ QGIS Studio..." />}>
              <NodeWorkflowBuilder
                farm={activeStudioFarm}
                onClose={() => setShowNodeStudio(false)}
                onApplyLayer={(layerId) => {
                  setShowNodeStudio(false)
                  if (layerId) {
                    window.dispatchEvent(new CustomEvent('seva-apply-indicator-layer', { detail: { layerId } }))
                  }
                }}
              />
            </Suspense>
          )}
          {showDroneStudio && (
            <Suspense fallback={<LogoLoader text="Calibrating UAV Orthomosaic..." />}>
              <DronePrecisionStudio
                farm={activeStudioFarm}
                onClose={() => setShowDroneStudio(false)}
                onExportDossier={() => {
                  setShowDroneStudio(false)
                  setShowDroneDossier(true)
                }}
              />
            </Suspense>
          )}
          {showDroneDossier && (
            <Suspense fallback={<LogoLoader text="Generating Drone Precision Dossier..." />}>
              <DroneReportDossier
                farm={activeStudioFarm}
                onClose={() => setShowDroneDossier(false)}
              />
            </Suspense>
          )}
          {showResponsively && (
            <Suspense fallback={<LogoLoader text="Calibrating Multi-Device Viewports..." />}>
              <ResponsivelyStudio
                farm={activeStudioFarm}
                onClose={() => setShowResponsively(false)}
              />
            </Suspense>
          )}
          {showMarketingStudio && (
            <Suspense fallback={<LogoLoader text="Initializing Marketing Showcase Studio..." />}>
              <AppStoreScreenshotStudio
                farm={activeStudioFarm}
                onClose={() => setShowMarketingStudio(false)}
              />
            </Suspense>
          )}
          {showAgentHub && (
            <div className="modal-backdrop" onClick={() => setShowAgentHub(false)} style={{ zIndex: 9998 }}>
              <div onClick={e => e.stopPropagation()} style={{ width: 'min(1220px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
                <Suspense fallback={<LogoLoader text="Loading AI Agent Hub & 8-Agent Roster..." />}>
                  <ClaudeCodeAgentHub isModal onClose={() => setShowAgentHub(false)} />
                </Suspense>
              </div>
            </div>
          )}
          {showTrainingAcademy && (
            <div className="modal-backdrop" onClick={() => setShowTrainingAcademy(false)} style={{ zIndex: 9998 }}>
              <div onClick={e => e.stopPropagation()} style={{ width: 'min(1260px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
                <Suspense fallback={<LogoLoader text="Loading Training Academy..." />}>
                  <SevaGisTrainingAcademy farm={activeStudioFarm} isModal onClose={() => setShowTrainingAcademy(false)} />
                </Suspense>
              </div>
            </div>
          )}
        </>
      )
    })()}
    <PopTheTeamModal
      isOpen={showPopTeam}
      onClose={() => setShowPopTeam(false)}
      error={popTeamError}
      initialReason={popTeamReason}
      farmName={farm?.name}
      farmLocation={farm?.location}
      userEmail={who?.email}
      userName={who?.name}
    />
    <InsightPlayingCardModal
      card={activeInsightCard}
      onClose={() => setActiveInsightCard(null)}
      onDownloadGeoTiff={(card) => {
        try {
          if (!farm) return
          const [w, s, e, n] = farmBBox(farm)
          const canvas = document.createElement('canvas')
          canvas.width = 256
          canvas.height = 256
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          ctx.fillStyle = '#0f172a'
          ctx.fillRect(0, 0, 256, 256)

          const ring = farmRing(farm)
          ctx.beginPath()
          ring.forEach(([lon, lat], i) => {
            const cx = ((lon - w) / (e - w || 0.001)) * 256
            const cy = ((n - lat) / (n - s || 0.001)) * 256
            if (i === 0) ctx.moveTo(cx, cy)
            else ctx.lineTo(cx, cy)
          })
          ctx.closePath()
          ctx.fillStyle = card.status === 'good' ? '#16a34a' : card.status === 'warn' ? '#d97706' : '#2563eb'
          ctx.fill()
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.stroke()

          const imgData = ctx.getImageData(0, 0, 256, 256)
          const blob = createGeoTiffBlob(256, 256, [w, s, e, n], imgData.data)
          void dispatchExport({
            category: 'tiff',
            fileName: `${farm.name.replace(/\W+/g, '_')}_${card.acronym || 'PARAM'}_GeoTIFF.tif`,
            blob,
            mimeType: 'image/tiff',
            customToast: `Exported ${card.acronym || 'PARAM'} GeoTIFF · Saved to device & organized in Google Drive: SEVA GIS / TIFF Files`
          })
        } catch (err) {
          console.warn('GeoTIFF download error:', err)
        }
      }}
    />
  </div>
}
