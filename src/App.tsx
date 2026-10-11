import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import FinancialSummaryTerminal from './FinancialSummaryTerminal'
import PopTheTeamModal from './PopTheTeamModal'
import { AlertTriangle, ArrowDownToLine, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, ChevronRight, CloudSun, Droplets, ExternalLink, Globe2, HelpCircle, Layers, Leaf, MapPinned, Mountain, Navigation, Plus, RefreshCw, Trash2, Search, Settings2, LogOut, ShieldCheck, Sprout, X, FileCheck2, Maximize2, Minimize2, Activity, SlidersHorizontal, ArrowUp, ArrowDown, RotateCcw, Save } from 'lucide-react'

import { mergeWeekly, weeklyRecords, type WeekRec } from './lib/seva'
import AddFarm, { type NewFarm } from './AddFarm'
import { areaHa, centroid } from './lib/geo'
import Contact from './Contact'
import Reveal from './Reveal'
import SectionBoundary from './SectionBoundary'
import Credits from './Credits'
import Wordmark from './Wordmark'
import { useAccount } from './Auth'
import { NumbersGuide } from './Scale'
import { farmRing } from './lib/seva'
import FieldHealthScore from './FieldHealthScore'
import TeamGitDiagram from './TeamGitDiagram'

const AgroPanel = lazy(() => import('./AgroPanel'))
const CropJournal = lazy(() => import('./CropJournal'))
const IndicatorMap = lazy(() => import('./IndicatorMap'))
const WaterPanel = lazy(() => import('./WaterPanel'))
const Intelligence = lazy(() => import('./Intelligence'))
const WeeklyRecords = lazy(() => import('./WeeklyRecords'))
const GeoTools = lazy(() => import('./GeoTools'))
const Guide = lazy(() => import('./Guide'))
const DataManager = lazy(() => import('./DataManager'))
const ReportPanel = lazy(() => import('./ReportPanel'))
const CropLibrary = lazy(() => import('./CropLibrary'))
const ProGisExport = lazy(() => import('./ProGisExport'))
const VillageView = lazy(() => import('./VillageView'))

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
const mappedBoundaryAreaHa = (farm: Pick<Farm, 'polygon'>) => farm.polygon && farm.polygon.length >= 3 ? areaHa(farm.polygon) : 0
const initialFarms: Farm[] = []
import Lang from './Lang'
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
  'crop-library',
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
  'crop-library': 'Crop Library & Agronomy Knowledge',
  cropLib: 'Crop Library & Agronomy Knowledge',
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

function BrandLogo() { return <img className="brand-logo-image" src={brandLogo} alt="SEVA.GIS official logo" onError={(e) => { e.currentTarget.src = '/logo.png' }} /> }

export default function App() {
  const { who, signOut } = useAccount()
  const [farms, setFarms] = useState<Farm[]>(() => { try { return (JSON.parse(localStorage.getItem('seva-farms') || 'null') || initialFarms).filter((x: Farm) => !x.sample) } catch { return initialFarms } })
  const [selected, setSelected] = useState(farms[0]?.id || '')
  const [layersPanelTarget, setLayersPanelTarget] = useState<HTMLDivElement | null>(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const [modal, setModal] = useState('')
  const [showTerminal, setShowTerminal] = useState(false)
  const [editLayout, setEditLayout] = useState(false)
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
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

  const moveSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= sectionOrder.length) return
    const next = [...sectionOrder]
    const temp = next[idx]
    next[idx] = next[target]
    next[target] = temp
    setSectionOrder(next)
    localStorage.setItem('seva-dashboard-layout', JSON.stringify(next))
  }

  const resetLayout = () => {
    setSectionOrder(DEFAULT_SECTION_ORDER)
    localStorage.removeItem('seva-dashboard-layout')
    setMessage('Dashboard layout reset to factory default.')
  }

  const saveLayout = () => {
    localStorage.setItem('seva-dashboard-layout', JSON.stringify(sectionOrder))
    setEditLayout(false)
    setMessage('Dashboard layout saved successfully.')
  }

  const [query, setQuery] = useState('')
  const [loadingFarmIds, setLoadingFarmIds] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [nav, setNav] = useState('Overview')
  const [menu, setMenu] = useState(false)
  const [mapFocus, setMapFocus] = useState(false)
  const farm = (farms.find(item => item.id === selected) || farms[0]) as Farm
  const loading = !!farm && loadingFarmIds.includes(farm.id)
  const hi = useMemo(() => pickGreeting(who.name, who.id === 'guest' || who.name === 'Guest'), [who.name])
  useEffect(() => { localStorage.setItem('seva-farms', JSON.stringify(farms)) }, [farms])

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
    window.addEventListener('seva-open-modal', handleOpenModal)
    window.addEventListener('seva:pop-the-team', handlePopTeamEvent)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('seva-open-modal', handleOpenModal)
      window.removeEventListener('seva:pop-the-team', handlePopTeamEvent)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])
  const [zone, setZone] = useState<Zone | null>(null)
  const attempted = useRef(new Set<string>())
  const refreshRun = useRef(new Map<string, number>())
  async function loadWeather(target: Farm) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lon}&daily=precipitation_sum&hourly=soil_moisture_0_to_1cm&forecast_days=7&timezone=auto`, { signal: controller.signal })
      if (!response.ok) throw new Error('Weather provider unavailable')
      const data = await response.json()
      const precipitation = Array.isArray(data.daily?.precipitation_sum) ? data.daily.precipitation_sum.filter((value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)) : []
      const moisture = Array.isArray(data.hourly?.soil_moisture_0_to_1cm) ? data.hourly.soil_moisture_0_to_1cm.find((value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)) : undefined
      return { rain: precipitation.length ? precipitation.reduce((sum: number, value: number) => sum + value, 0) : undefined, moisture: typeof moisture === 'number' ? Math.round(moisture * 100) : undefined, elevation: typeof data.elevation === 'number' && Number.isFinite(data.elevation) ? data.elevation : undefined }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('Weather request timed out. Try again when your connection is available.')
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
  const [opts, setOpts] = useState<SceneOpts>({ mode: 'latest', maxCloud: 30 })
  const [spinningCard, setSpinningCard] = useState<string | null>(null)
  async function refreshCard(title: string) {
    if (!farm) return
    setSpinningCard(title)
    try {
      if (title === 'Vegetation health') {
        const satellite = await analyze(farm, opts)
        setFarms(current => current.map(item => item.id === farm.id ? { ...item, analysis: satellite, ndvi: Number(satellite.ndvi.mean.toFixed(2)), status: farmStatus(satellite) } : item))
        setMessage('Vegetation health updated from Sentinel-2.')
      } else {
        const w = await loadWeather(farm)
        setFarms(current => current.map(item => item.id === farm.id ? { ...item, ...w } : item))
        setMessage(`${title} updated.`)
      }
    } catch (e) {
      console.warn(`Failed refreshing ${title}:`, e)
      setMessage(`Could not refresh ${title}.`)
    } finally {
      setTimeout(() => setSpinningCard(null), 700)
    }
  }
  async function refresh(target = farm, o: SceneOpts = opts) {
    if (!target) return
    const runId = (refreshRun.current.get(target.id) ?? 0) + 1
    refreshRun.current.set(target.id, runId)
    attempted.current.add(target.id)
    weeklyTried.current.delete(target.id)
    setLoadingFarmIds(current => current.includes(target.id) ? current : [...current, target.id])
    if (selectedRef.current === target.id) setMessage('Searching Sentinel-2 scenes that cover your whole farm…')
    const [weather, satellite] = await Promise.allSettled([loadWeather(target), analyze(target, o)])
    if (refreshRun.current.get(target.id) !== runId) return
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
    if (selectedRef.current === target.id) {
      setMessage(satellite.status === 'fulfilled' ? `Live Sentinel-2 analysis complete (${new Date(satellite.value.scene.datetime).toLocaleDateString()}, ${satellite.value.scene.cloud}% cloud${satellite.value.scene.filled ? `, gaps filled from ${satellite.value.scene.filled} other pass${satellite.value.scene.filled > 1 ? 'es' : ''}` : ''}).${weather.status === 'rejected' ? ' Weather could not be fetched.' : ''}` : `Satellite analysis failed: ${reason}. Existing values are unchanged.`)
    }
    setLoadingFarmIds(current => current.filter(id => id !== target.id))
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
    const { lat, lon } = centroid(ring)
    const next: Farm = { id: crypto.randomUUID(), name, location: `${lat.toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${lon.toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`, crop, area: isPolygon ? areaHa(ring) : 0, lat, lon, polygon: isPolygon ? ring : undefined, status: 'Awaiting satellite data', sample: false }
    setFarms(current => [...current, next]); setSelected(next.id); setModal(''); refresh(next)
  }

  function go(text: string) {
    setNav(text); setMenu(false)
    if (text === 'Alerts') return setModal('alerts')
    if (text === 'Reports') return setModal('reports')
    if (text === 'Terminal') return setShowTerminal(true)
    const id = text === 'Overview' ? 'top' : text === 'My farms' ? 'my-farms' : 'crop-journal'
    requestAnimationFrame(() => (id === 'top' ? window.scrollTo({ top: 0, behavior: 'smooth' }) : document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
  }
  function exportReport() {
    const blob = new Blob([JSON.stringify({ ...farm, irrigation: irrigationAdvice(farm), construction: constructionSuitability(farm), disclosure: 'Satellite indices come from Sentinel-2 L2A via Microsoft Planetary Computer and are cloud/shadow-masked with the SCL layer and clipped to the farm boundary. Weather may be a coarse Open-Meteo model estimate. Not a construction or irrigation certification.', exported: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `seva-${farm.name.toLowerCase().replace(/ /g, '-')}.json`; anchor.click(); URL.revokeObjectURL(url)
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

  return <div className="app-shell">
    <aside className={`sidebar ${menu ? 'mobile-open' : ''}`}>
      <a className="brand notranslate" translate="no" href="#"><span className="brand-icon"><BrandLogo/></span><Wordmark variant="pro"/></a>
      <div className="workspace"><span className="workspace-avatar">A</span><div>My workspace<small>Personal · Free forever*</small></div><ChevronDown size={16}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{[{ text: 'Overview', icon: Layers }, { text: 'My farms', icon: MapPinned }, { text: 'Terminal', icon: Activity }, { text: 'Crop journal', icon: Sprout },{ text: 'Alerts', icon: Bell }, { text: 'Reports', icon: ArrowDownToLine }].map(({text,icon: Icon}) => <button key={text} className={nav === text ? 'active' : ''} onClick={() => go(text)}><Icon size={19}/>{text}{text === 'Alerts' && farms.some(farmNeedsAttention) && <span className="nav-count">{farms.filter(farmNeedsAttention).length}</span>}</button>)}</nav>
      <div className="nav-label resources-label">RESOURCES</div><nav><button onClick={() => setModal('sources')}><Globe2 size={19}/>Data sources<ArrowUpRight size={14}/></button><button onClick={() => dispatchEvent(new Event('seva-tour'))}><HelpCircle size={19}/>Quick tour with Mitra</button><button onClick={() => setModal('guide')}><BookOpen size={19}/>Field guide</button><button onClick={() => setModal('data')}><ShieldCheck size={19}/>Data manager</button><button className="nav-logout" onClick={signOut}><LogOut size={19}/>Log out</button></nav>
      <div className="sidebar-bottom"><div className="service-card"><BrandLogo/><h4>Built for the ground.<br/>Open to everyone.</h4><p>Earth intelligence, in the spirit of selfless service.</p><span>OPEN DATA. REAL PURPOSE. <ArrowUpRight size={14}/></span></div><button className="help notranslate" onClick={() => { setPopTeamError(null); setPopTeamReason('User clicked Pop the Team from sidebar'); setShowPopTeam(true) }} style={{ color: '#fca5a5', border: '1px solid #7f1d1d', background: 'rgba(127, 29, 29, 0.2)' }}><AlertTriangle size={17} color="#f87171"/>Page not working? Pop the team</button><button className="help" onClick={() => setModal('guide')}><HelpCircle size={18}/>Help & documentation<ArrowUpRight size={15}/></button><div className="profile"><div className="user-avatar">{(who.name || 'G')[0].toUpperCase()}</div><div className="profile-name">{who.name}<small>{who.email || 'Saved on this device'}</small></div><button aria-label="Settings" onClick={() => setModal('settings')}><Settings2 size={18}/></button><button className="logout" aria-label="Log out" title="Log out" onClick={signOut}><LogOut size={18}/></button></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenu(!menu)}><i className="fa-solid fa-bars-staggered"/></button><span className="top-brand notranslate" translate="no"><img src={brandLogo} alt="" onError={(e) => { e.currentTarget.src = '/logo.png' }}/><Wordmark variant="pro"/><i className="fa-solid fa-satellite top-sat" aria-hidden="true"/></span><span className="crumb-text">Workspace</span><ChevronRight size={14} className="crumb-text"/><strong>{nav}</strong></div><div className="topbar-right"><button className="top-pop-team-btn notranslate" title="Page or satellite data not working? Let SEVA Team Know: Pop the Team" onClick={() => { setPopTeamError(null); setPopTeamReason('User reported page issue from topbar'); setShowPopTeam(true) }} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(127, 29, 29, 0.25)', border: '1px solid #ef4444', color: '#fca5a5', padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)' }}><AlertTriangle size={13} color="#f87171" /><span>Pop the Team</span></button><button className="top-terminal-btn notranslate" title="Financial Analytics & 6-Session Summary Terminal (TradingView Style)" onClick={() => setShowTerminal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#13281b', border: '1px solid #2d6a4f', color: '#86efac', padding: '5px 11px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}><Activity size={14} color="#4ade80" /><span>Analytics Terminal</span></button><button className="top-layout-btn" title="Rearrange dashboard layout" onClick={() => setEditLayout(!editLayout)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: editLayout ? '#2d6a4f' : 'transparent', border: '1px solid #cbd5e1', color: editLayout ? '#fff' : '#475569', padding: '5px 9px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}><SlidersHorizontal size={13} /><span>{editLayout ? 'Done' : 'Layout'}</span></button><span className="open-badge"><span/> Powered by open data</span><Lang/><button aria-label="Notifications" className="notification" onClick={() => setModal('alerts')}><Bell size={19}/><i/></button><button className="top-tour notranslate" aria-label="Quick tour with Mitra" title="Quick tour with Mitra" onClick={() => dispatchEvent(new Event('seva-tour'))}><MitraAvatar size={30}/></button><span className="top-avatar" title={who.name}>{(who.name || 'G')[0].toUpperCase()}</span></div></header>
      <main><div className="page-heading"><div><div className="eyebrow">{todayLabel()}</div><h1>{hi.text}{hi.dot && <span>.</span>}</h1><p>{hi.line}</p></div><button className="primary" onClick={() => setModal('add')}><Plus size={18}/>Add a farm</button></div>
      <Guide/>
      {!farm ? <div className="empty-farms"><i className="fa-solid fa-seedling"/><h2>Add your first farm</h2><p>Add an outline for any field you want to review from home. SEVA·GIS will show the latest available clear Sentinel-2 pass so you can compare dates, layers, and visible changes remotely.</p><button className="primary" onClick={() => setModal('add')}><Plus size={18}/>Add a farm</button></div> : <>
      <div className="summary-grid"><div className="summary-card"><span className="metric-icon"><MapPinned size={21}/></span><div><span>Total farms</span><strong>{farms.length}<small>Across {new Set(farms.map(item => item.location)).size} locations</small></strong></div></div><div className="summary-card"><span className="metric-icon"><Sprout size={21}/></span><div><span>Mapped boundary area</span><strong>{farms.reduce((sum,item) => sum + mappedBoundaryAreaHa(item), 0).toFixed(1)} <em>ha</em><small>{(farms.reduce((sum,item) => sum + mappedBoundaryAreaHa(item), 0) * 2.47105381).toFixed(1)} acres · outlines only</small></strong></div></div><div className="summary-card"><span className="metric-icon healthy"><Leaf size={21}/></span><div><span>Farms with strong green cover</span><strong>{farms.filter(item => item.status === 'Healthy').length}<small><i className="dot green"/>Strong green-cover signal</small></strong></div></div><div className="summary-card"><span className="metric-icon attention"><Droplets size={21}/></span><div><span>Fields to review</span><strong>{farms.filter(farmNeedsAttention).length}<small><i className="dot amber"/>Review flagged areas in the latest pass</small></strong></div><ArrowUpRight size={17}/></div></div>
      <div className={`farm-workspace ${mapFocus ? 'map-focus' : ''}`} id="my-farms"><section className="farm-list"><div className="section-top"><h2>My farms <span>{farms.length}</span></h2><button aria-label="Add farm" onClick={() => setModal('add')}><Plus size={18}/></button></div><label className="search"><Search size={16}/><input placeholder="Find a farm..." value={query} onChange={event => setQuery(event.target.value)}/><span>⌘ K</span></label><div className="farm-items">{farms.filter(item => `${item.name} ${item.location}`.toLowerCase().includes(query.toLowerCase())).map((item,index) => <button key={item.id} className={`farm-item ${item.id === selected ? 'selected' : ''}`} onClick={() => setSelected(item.id)}><div className="farm-thumb aoi" title="Satellite view of your farm boundary"><AoiShape farm={item}/></div><div><h3>{item.name}</h3><p>{item.location}</p><span className="farm-meta">{item.polygon && item.polygon.length >= 3 ? `${mappedBoundaryAreaHa(item).toFixed(2)} ha · ${(mappedBoundaryAreaHa(item) * 2.47105381).toFixed(2)} ac` : 'Location pin · area unknown'}<b>·</b>{item.crop}</span><div className="farm-badges-row"><span className={`status ${item.status === 'Healthy' ? 'good' : item.analysis ? 'warning' : 'neutral'}`}><i/>{item.status}</span><span role="button" tabIndex={0} className="farm-maps-btn" title={`View this field location in Google Maps: ${item.name} (${item.lat.toFixed(4)}°, ${item.lon.toFixed(4)}°)`} onClick={event => { event.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`, '_blank', 'noopener,noreferrer') }} onKeyDown={event => { if (event.key === 'Enter') { event.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`, '_blank', 'noopener,noreferrer') } }}><Navigation size={11} className="maps-symbol-icon"/><span>View location</span></span></div></div><span role="button" tabIndex={0} aria-label={`Remove ${item.name}`} className="farm-remove" onClick={event => { event.stopPropagation(); removeFarm(item) }} onKeyDown={event => { if (event.key === 'Enter') { event.stopPropagation(); removeFarm(item) } }}><Trash2 size={15}/></span></button>)}</div><button className="add-another" onClick={() => setModal('add')}><Plus size={17}/>Add another farm</button><div ref={setLayersPanelTarget} className="ix-panel-dock" aria-label="Layers and symbology controls"/><div className="list-note"><ShieldCheck size={16}/><span>Your coordinates stay on this device.</span></div></section>
       <section className="map-card"><div className="map-header"><div><h2>{farm.name}<ChevronDown size={16}/></h2><span><MapPinned size={13}/>{farm.location}<b>·</b>{farm.polygon && farm.polygon.length >= 3 ? `${mappedBoundaryAreaHa(farm).toFixed(2)} ha · ${(mappedBoundaryAreaHa(farm) * 2.47105381).toFixed(2)} acres` : 'Location pin · area not measured'}</span></div><button className="outline compact farm-header-maps-btn" title={`View this field location in Google Maps: ${farm.name} (${farm.lat.toFixed(4)}°, ${farm.lon.toFixed(4)}°)`} onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${farm.lat},${farm.lon}`, '_blank', 'noopener,noreferrer')}><Navigation size={13} color="#2563eb"/><span>View location</span></button><button className="outline compact" title={mapFocus ? 'Exit focused map view (Esc)' : 'Expand the map and controls'} aria-label={mapFocus ? 'Exit map focus' : 'Focus map'} onClick={() => setMapFocus(value => !value)}>{mapFocus ? <Minimize2 size={13}/> : <Maximize2 size={13}/>}<span>{mapFocus ? 'Exit focus' : 'Focus map'}</span></button><button className="outline compact" onClick={() => removeFarm(farm)}><Trash2 size={14}/>Remove</button><button className="outline compact" disabled={loading} onClick={() => refresh()}><RefreshCw size={14} className={loading ? 'spin' : ''}/>{loading ? 'Updating' : 'Refresh'}</button></div><div className="map-wrap"><SectionBoundary name="Farm map"><Suspense fallback={<div className="reveal-loading map-loading" role="status">Loading the field map…</div>}><IndicatorMap key={farm.id} farm={farm} loading={loading} panelTarget={layersPanelTarget} sceneOpts={opts}/></Suspense></SectionBoundary></div><SceneBar opts={opts} onApply={o => { setOpts(o); refresh(farm, o) }} busy={loading} scene={farm.analysis?.scene}/><div className="map-footer"><span><ShieldCheck size={14}/>{farm.analysis ? 'Sentinel-2 analysis ready' : 'Satellite analysis pending'}<b>·</b>{farm.polygon && farm.polygon.length >= 3 ? 'Preview from Microsoft Planetary Computer · Copernicus DEM GLO-30 terrain · clipped to your outline' : 'Sentinel-2 preview around this location pin · parcel area not measured'}</span><button onClick={() => setModal('sources')}>About this data<ArrowUpRight size={13}/></button></div></section></div>
      {editLayout && (
        <div style={{ background: '#064e3b', color: '#a7f3d0', border: '1px solid #10b981', borderRadius: '12px', padding: '14px 18px', margin: '15px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '14px', color: '#fff' }}>Dashboard Layout Customizer Active</strong>
              <span style={{ fontSize: '12px' }}>Move modules up or down to personalize your workflow, or select a preset layout below.</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={resetLayout} style={{ background: '#1e293b', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <RotateCcw size={13}/> Reset Default
              </button>
              <button onClick={saveLayout} style={{ background: '#10b981', border: 'none', color: '#022c22', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Save size={13}/> Save Layout
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid rgba(16, 185, 129, 0.3)', paddingTop: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>Quick Presets:</span>
            <button onClick={() => { setSectionOrder(DEFAULT_SECTION_ORDER); localStorage.setItem('seva-dashboard-layout', JSON.stringify(DEFAULT_SECTION_ORDER)); setMessage('Applied Standard Overview layout preset.'); }} style={{ background: '#065f46', border: '1px solid #34d399', color: '#fff', borderRadius: '5px', padding: '4px 10px', fontSize: '11.5px', cursor: 'pointer' }}>
              Standard Overview
            </button>
            <button onClick={() => { const p = ['gis-export', 'intelligence-lab', 'village-view', 'weekly-records', 'field-intelligence', 'health-score', 'crop-journal', 'numbers-guide', 'advice-grid', 'agro-water', 'crop-library', 'measurement-tools']; setSectionOrder(p); localStorage.setItem('seva-dashboard-layout', JSON.stringify(p)); setMessage('Applied GIS & Satellite First layout preset.'); }} style={{ background: '#065f46', border: '1px solid #34d399', color: '#fff', borderRadius: '5px', padding: '4px 10px', fontSize: '11.5px', cursor: 'pointer' }}>
              GIS &amp; Satellite First
            </button>
            <button onClick={() => { const p = ['agro-water', 'field-intelligence', 'advice-grid', 'health-score', 'crop-journal', 'intelligence-lab', 'numbers-guide', 'gis-export', 'village-view', 'weekly-records', 'crop-library', 'measurement-tools']; setSectionOrder(p); localStorage.setItem('seva-dashboard-layout', JSON.stringify(p)); setMessage('Applied Hydrology Focus layout preset.'); }} style={{ background: '#065f46', border: '1px solid #34d399', color: '#fff', borderRadius: '5px', padding: '4px 10px', fontSize: '11.5px', cursor: 'pointer' }}>
              Hydrology Focus
            </button>
          </div>
        </div>
      )}

      {sectionOrder.map((secId, idx) => {
        let content = null
        switch (secId) {
          case 'crop-journal':
          case 'journal':
            content = (
              <Reveal defer>
                <SectionBoundary name="Crop journal">
                  <Suspense fallback={<div className="reveal-loading" role="status">Loading the satellite history…</div>}>
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
                  <h2>Field intelligence <span>{farm.analysis ? 'Live Sentinel-2 metrics' : 'Awaiting satellite analysis'}</span></h2>
                  <button onClick={() => setModal('reports')}><ArrowDownToLine size={15}/>Create report</button>
                </div>
                <div className="intelligence-grid">
                  {(() => {
                    const ndviVal = farm.analysis?.ndvi.mean
                    const moistVal = farm.moisture ?? 32
                    const rainVal = farm.rain ?? 0.7
                    const slopeVal = farm.analysis?.slopePct ?? 2.1
                    
                    const cardsData = [
                      {
                        title: 'Vegetation health',
                        icon: Leaf,
                        value: ndviVal?.toFixed(2),
                        unit: 'NDVI',
                        label: farm.analysis ? classify(ndviVal!).label : 'Awaiting analysis',
                        color: 'green',
                        bars: true,
                        stat: farm.analysis?.ndvi,
                        lo: -0.2,
                        hi: 1,
                        benchmarks: 'Benchmark: Vigorous ≥ 0.50 · Moderate 0.30–0.50 · Stressed < 0.30',
                        reasoning: farm.analysis 
                          ? `${farm.analysis.stressPct.toFixed(0)}% of pixels show NDVI < 0.30 (sparse canopy). If persistent over consecutive clear passes, inspect for root-zone moisture deficit or nutrient deficiency.`
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
                        value: farm.elevation,
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
                      <div className={`intelligence-card ${color}`} key={title} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div className="intelligence-title">
                            <span>{title}</span>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <button className={`card-refresh-btn ${spinningCard === title ? 'spinning' : ''}`} title={`Refresh ${title}`} aria-label={`Refresh ${title}`} onClick={e => { e.stopPropagation(); refreshCard(title); }}><RefreshCw size={12}/></button>
                              <Icon size={18}/>
                            </div>
                          </div>
                          <div className="intelligence-value">
                            {value ?? '—'}<small>{unit}</small>
                            {title === 'Vegetation health' && farm.analysis && <span className="trend">{farm.analysis.stressPct.toFixed(0)}% <small>stressed</small></span>}
                          </div>
                          <div className="mini-chart">
                            {bars ? (stat && lo !== undefined && hi !== undefined ? barsFromStat(stat, lo, hi) : Array<number>(24).fill(0)).map((height, index) => <span key={index} className={`bar-height-${height}`}/>) : title.startsWith('Rainfall') ? <div className="weather-strip"><span><CloudSun size={18}/><small>7-day total: {rainVal.toFixed(1)} mm</small></span></div> : <div className="weather-strip"><span><Mountain size={18}/><small>{slopeVal.toFixed(1)}% slope</small></span></div>}
                          </div>
                          <div className="metric-description">
                            <b>{label}</b>
                            <div style={{ fontSize: '11px', color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '3px 6px', margin: '4px 0' }}>
                              {benchmarks}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '6px', lineHeight: 1.4 }}>
                          <b>Scientific Insight:</b> {reasoning}
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
              <Reveal defer>
                <SectionBoundary name="Field panels">
                  <Suspense fallback={<div className="reveal-loading" role="status">Loading field panels…</div>}>
                    <AgroPanel farm={farm}/>
                    <WaterPanel farm={farm}/>
                  </Suspense>
                </SectionBoundary>
              </Reveal>
            )
            break
          case 'crop-library':
          case 'cropLib':
            content = (
              <Reveal defer>
                <SectionBoundary name="Crop library">
                  <Suspense fallback={<div className="reveal-loading" role="status">Loading crop library…</div>}>
                    <CropLibrary/>
                  </Suspense>
                </SectionBoundary>
              </Reveal>
            )
            break
          case 'village-view':
          case 'village':
            content = (
              <Reveal defer>
                <SectionBoundary name="Map tools">
                  <Suspense fallback={<div className="reveal-loading" role="status">Loading map tools…</div>}>
                    <VillageView farms={farms} selectedId={farm.id} onSelect={setSelected} onAddBatch={addBatchFarms}/>
                  </Suspense>
                </SectionBoundary>
              </Reveal>
            )
            break
          case 'gis-export':
          case 'gisExport':
            content = (
              <Reveal defer>
                <SectionBoundary name="GIS export tools">
                  <Suspense fallback={<div className="reveal-loading" role="status">Loading GIS export tools…</div>}>
                    <ProGisExport farm={farm} farms={farms} onImportBackup={restored => { setFarms(restored); if (restored[0]) { setSelected(restored[0].id); refresh(restored[0]); } }} />
                  </Suspense>
                </SectionBoundary>
              </Reveal>
            )
            break
          case 'intelligence-lab':
          case 'lab':
            content = (
              <Reveal defer>
                <SectionBoundary name="Analysis lab">
                  <Suspense fallback={<div className="reveal-loading" role="status">Loading analysis lab…</div>}>
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
                  <Suspense fallback={<div className="reveal-loading" role="status">Loading measurement tools…</div>}>
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
                  <Suspense fallback={<div className="reveal-loading" role="status">Loading satellite history…</div>}>
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
          <div key={secId} className={`dashboard-section-wrapper ${editLayout ? 'layout-edit-mode' : ''}`} style={editLayout ? { border: '2px dashed #16a34a', borderRadius: '14px', padding: '12px', margin: '14px 0', background: 'rgba(22, 163, 74, 0.03)', position: 'relative' } : {}}>
            {editLayout && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', color: '#f8fafc', padding: '8px 14px', borderRadius: '8px', marginBottom: '10px', fontSize: '13px', fontWeight: 600 }}>
                <span>{SECTION_TITLES[secId] || secId}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button disabled={idx === 0} onClick={() => moveSection(idx, -1)} style={{ background: idx === 0 ? '#334155' : '#1e293b', border: '1px solid #475569', color: '#fff', borderRadius: '4px', padding: '3px 8px', cursor: idx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ArrowUp size={13}/> Move Up
                  </button>
                  <button disabled={idx === sectionOrder.length - 1} onClick={() => moveSection(idx, 1)} style={{ background: idx === sectionOrder.length - 1 ? '#334155' : '#1e293b', border: '1px solid #475569', color: '#fff', borderRadius: '4px', padding: '3px 8px', cursor: idx === sectionOrder.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ArrowDown size={13}/> Move Down
                  </button>
                </div>
              </div>
            )}
            {content}
          </div>
        )
      })}
      </>}
      <Contact/>
      <MitraGuide name={who.name} guest={who.name === 'Guest'}/>
      <Credits/>
      <footer className="page-footer"><span><BrandLogo/>Spatial Evaluation & Vegetation Analytics</span><span>Built by N. Akshit Vinay. Powered by open data.<span className="footer-dot">●</span>seva.gis</span></footer>
      </main>
    </div>
    {message && <div className="toast" role="status"><ShieldCheck size={19}/>{message}<button aria-label="Dismiss" onClick={() => setMessage('')}><X size={17}/></button></div>}
    {modal && <div className="modal-backdrop" onClick={() => setModal('')}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={event => event.stopPropagation()}><button className="modal-close" aria-label="Close dialog" onClick={() => setModal('')}><X size={20}/></button><span className="modal-icon"><BrandLogo/></span><div className="eyebrow">SEVA · LAND INTELLIGENCE</div><h2 id="modal-title">{modal === 'add' ? 'Set up a field for remote review.' : modal === 'zone' ? 'Understand this spot.' : modal === 'sources' ? 'Open data. Transparent limits.' : modal === 'alerts' ? 'Your field advisories.' : modal === 'reports' ? 'Take your insights with you.' : modal === 'data' ? 'Your account and data.' : modal === 'settings' ? 'Your personal workspace.' : 'From coordinates to clarity.'}</h2>
      {modal === 'data' ? <Suspense fallback={<div className="reveal-loading">Loading data manager…</div>}><DataManager/></Suspense> : modal === 'add' ? <AddFarm onAdd={addBoundary} onError={setMessage}/> : modal === 'zone' ? (() => {
        const verdict = classify(zone ? zone.ndvi : farm?.analysis?.ndvi.mean)
        return <><span className={`status ${verdict.level === 'good' ? 'good' : verdict.level === 'neutral' ? 'neutral' : 'warning'}`}><i/>{verdict.label}</span><p>{zone ? `Pixel at ${zone.lat.toFixed(5)}°, ${zone.lon.toFixed(5)}° from the ${farm?.analysis ? new Date(farm.analysis.scene.datetime).toLocaleDateString() : ''} Sentinel-2 scene.` : 'Farm average from the latest Sentinel-2 scene.'}</p><div className="advisory-facts"><span>NDVI<strong>{(zone ? zone.ndvi : farm?.analysis?.ndvi.mean)?.toFixed(2) ?? '—'}</strong></span><span>NDMI<strong>{(zone ? zone.ndmi : farm?.analysis?.ndmi.mean)?.toFixed(2) ?? '—'}</strong></span><span>Cloud<strong>{farm?.analysis ? `${farm.analysis.scene.cloud}%` : '—'}</strong></span></div><h3>What should I do?</h3><p>{verdict.advice}</p><div className="privacy-note"><ShieldCheck size={18}/>Satellite values are not pixel cloud-masked and are not field-validated. Confirm on the ground before acting.</div></>
      })() : modal === 'sources' ? <><p>Each value is labelled as observed, modeled, or estimated where it appears. Satellite results can vary with scene coverage and cloud conditions.</p>{[['Satellite imagery','Sentinel-2 L2A preview from Microsoft Planetary Computer. Native band resolution varies.'],['Google Earth Engine tiles','Optional Cloud Run rendering for the selected spectral layer. Summary values and terrain models remain labelled by their own source until separately migrated and checked.'],['Vegetation indices','Calculated in the browser from available Sentinel-2 preview bands. Cloud and shadow masking uses the scene classification layer when available.'],['Weather & soil','Open-Meteo forecast data and SoilGrids estimates. Soil moisture is modeled at coarse resolution, not measured by a farm sensor.'],['Terrain','Copernicus GLO-30 digital elevation data for elevation, slope, aspect and hillshade. This is not an engineering survey.']].map(([title,description]) => <div className="source-item" key={title}><Check size={17}/><div><h3>{title}</h3><p>{description}</p></div></div>)}<a className="external-link" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo documentation<ExternalLink size={15}/></a></> : modal === 'alerts' ? <>{farms.filter(farmNeedsAttention).map(item => <button className="alert-row" key={item.id} onClick={() => { setSelected(item.id); setZone(null); setModal('zone') }}><Droplets size={21}/><div><h3>{item.name}</h3><p>{item.status} · {item.analysis!.stressPct.toFixed(0)}% of pixels stressed</p></div><ChevronRight size={18}/></button>)}{!farms.some(farmNeedsAttention) && <p>No farms currently need attention based on their latest satellite scene.</p>}<p>Alerts reflect the last analysis on this device. Background monitoring and email notifications are not connected.</p></> : modal === 'reports' ? <Suspense fallback={<div className="reveal-loading">Preparing report…</div>}><ReportPanel farm={farm as any}/></Suspense> : modal === 'guide' ? <Suspense fallback={<div className="reveal-loading">Loading field guide…</div>}><Guide/></Suspense> : modal === 'settings' ? <><p>Farms are stored in this browser only, and are not synced across devices. Clearing browser storage removes them.</p><p>This build has no payment flow. External providers have their own terms and availability.</p><button className="outline" onClick={signOut}><LogOut size={16}/>Log out of {who.name}</button><button className="outline" onClick={() => { setModal(''); setMessage('Google login and cloud sync require a configured authentication project. No account connection is active.') }}>About Google sign-in<ArrowUpRight size={16}/></button></> : <><p>1. Add or select a field boundary.<br/>2. Check the date and cloud conditions of the latest clear satellite pass.<br/>3. Compare earlier passes and switch map layers to spot changes.<br/>4. Select a point or zone to review its available values.<br/>5. Save or share a report for someone else to review remotely.</p><div className="privacy-note"><ShieldCheck size={20}/>Satellite and model estimates should be checked on the ground before making decisions.</div></>}
    </section></div>}
    {farm && <FinancialSummaryTerminal farm={farm} isOpen={showTerminal} onClose={() => setShowTerminal(false)} />}
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
  </div>
}
