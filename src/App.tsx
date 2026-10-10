import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import FinancialSummaryTerminal from './FinancialSummaryTerminal'
import { ArrowDownToLine, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, ChevronRight, CloudSun, Droplets, ExternalLink, Globe2, HelpCircle, Layers, Leaf, MapPinned, Mountain, Navigation, Plus, RefreshCw, Trash2, Search, Settings2, LogOut, ShieldCheck, Sprout, X, FileCheck2, Maximize2, Minimize2, Activity, SlidersHorizontal, ArrowUp, ArrowDown, RotateCcw, Save } from 'lucide-react'

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
import LandInfoCard from './LandInfoCard'

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
  'land-passbook',
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
  'land-passbook': 'Cadastral Land Registry (RoR 1B)',
  land: 'Cadastral Land Registry (RoR 1B)',
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

  useEffect(() => {
    const handleOpenModal = (e: any) => { if (e.detail) setModal(e.detail) }
    window.addEventListener('seva-open-modal', handleOpenModal)
    return () => {
      window.removeEventListener('seva-open-modal', handleOpenModal)
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
    if (text === 'Land registry') {
      requestAnimationFrame(() => document.getElementById('land-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      return
    }
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
      <nav>{[{ text: 'Overview', icon: Layers }, { text: 'My farms', icon: MapPinned }, { text: 'Terminal', icon: Activity }, { text: 'Land registry', icon: FileCheck2 }, { text: 'Crop journal', icon: Sprout },{ text: 'Alerts', icon: Bell }, { text: 'Reports', icon: ArrowDownToLine }].map(({text,icon: Icon}) => <button key={text} className={nav === text ? 'active' : ''} onClick={() => go(text)}><Icon size={19}/>{text}{text === 'Alerts' && farms.some(farmNeedsAttention) && <span className="nav-count">{farms.filter(farmNeedsAttention).length}</span>}</button>)}</nav>
      <div className="nav-label resources-label">RESOURCES</div><nav><button onClick={() => setModal('sources')}><Globe2 size={19}/>Data sources<ArrowUpRight size={14}/></button><button onClick={() => dispatchEvent(new Event('seva-tour'))}><HelpCircle size={19}/>Quick tour with Mitra</button><button onClick={() => setModal('guide')}><BookOpen size={19}/>Field guide</button><button onClick={() => setModal('data')}><ShieldCheck size={19}/>Data manager</button><button className="nav-logout" onClick={signOut}><LogOut size={19}/>Log out</button></nav>
      <div className="sidebar-bottom"><div className="service-card"><BrandLogo/><h4>Built for the ground.<br/>Open to everyone.</h4><p>Earth intelligence, in the spirit of selfless service.</p><span>OPEN DATA. REAL PURPOSE. <ArrowUpRight size={14}/></span></div><button className="help" onClick={() => setModal('guide')}><HelpCircle size={18}/>Help & documentation<ArrowUpRight size={15}/></button><div className="profile"><div className="user-avatar">{(who.name || 'G')[0].toUpperCase()}</div><div className="profile-name">{who.name}<small>{who.email || 'Saved on this device'}</small></div><button aria-label="Settings" onClick={() => setModal('settings')}><Settings2 size={18}/></button><button className="logout" aria-label="Log out" title="Log out" onClick={signOut}><LogOut size={18}/></button></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenu(!menu)}><i className="fa-solid fa-bars-staggered"/></button><span className="top-brand notranslate" translate="no"><img src={brandLogo} alt="" onError={(e) => { e.currentTarget.src = '/logo.png' }}/><Wordmark variant="pro"/><i className="fa-solid fa-satellite top-sat" aria-hidden="true"/></span><span className="crumb-text">Workspace</span><ChevronRight size={14} className="crumb-text"/><strong>{nav}</strong></div><div className="topbar-right"><button className="top-terminal-btn notranslate" title="Financial Analytics & 6-Session Summary Terminal (TradingView Style)" onClick={() => setShowTerminal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#13281b', border: '1px solid #2d6a4f', color: '#86efac', padding: '5px 11px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}><Activity size={14} color="#4ade80" /><span>Analytics Terminal</span></button><button className="top-layout-btn" title="Rearrange dashboard layout" onClick={() => setEditLayout(!editLayout)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: editLayout ? '#2d6a4f' : 'transparent', border: '1px solid #cbd5e1', color: editLayout ? '#fff' : '#475569', padding: '5px 9px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}><SlidersHorizontal size={13} /><span>{editLayout ? 'Done' : 'Layout'}</span></button><span className="open-badge"><span/> Powered by open data</span><Lang/><button aria-label="Notifications" className="notification" onClick={() => setModal('alerts')}><Bell size={19}/><i/></button><button className="top-tour notranslate" aria-label="Quick tour with Mitra" title="Quick tour with Mitra" onClick={() => dispatchEvent(new Event('seva-tour'))}><MitraAvatar size={30}/></button><span className="top-avatar" title={who.name}>{(who.name || 'G')[0].toUpperCase()}</span></div></header>
      <main><div className="page-heading"><div><div className="eyebrow">{todayLabel()}</div><h1>{hi.text}{hi.dot && <span>.</span>}</h1><p>{hi.line}</p></div><button className="primary" onClick={() => setModal('add')}><Plus size={18}/>Add a farm</button></div>
      <Guide/>
      {!farm ? <div className="empty-farms"><i className="fa-solid fa-seedling"/><h2>Add your first farm</h2><p>Add an outline for any field you want to review from home. SEVA·GIS will show the latest available clear Sentinel-2 pass so you can compare dates, layers, and visible changes remotely.</p><button className="primary" onClick={() => setModal('add')}><Plus size={18}/>Add a farm</button></div> : <>
      <div className="summary-grid"><div className="summary-card"><span className="metric-icon"><MapPinned size={21}/></span><div><span>Total farms</span><strong>{farms.length}<small>Across {new Set(farms.map(item => item.location)).size} locations</small></strong></div></div><div className="summary-card"><span className="metric-icon"><Sprout size={21}/></span><div><span>Mapped boundary area</span><strong>{farms.reduce((sum,item) => sum + mappedBoundaryAreaHa(item), 0).toFixed(1)} <em>ha</em><small>{(farms.reduce((sum,item) => sum + mappedBoundaryAreaHa(item), 0) * 2.47105381).toFixed(1)} acres · outlines only</small></strong></div></div><div className="summary-card"><span className="metric-icon healthy"><Leaf size={21}/></span><div><span>Farms with strong green cover</span><strong>{farms.filter(item => item.status === 'Healthy').length}<small><i className="dot green"/>Strong green-cover signal</small></strong></div></div><div className="summary-card"><span className="metric-icon attention"><Droplets size={21}/></span><div><span>Fields to review</span><strong>{farms.filter(farmNeedsAttention).length}<small><i className="dot amber"/>Review flagged areas in the latest pass</small></strong></div><ArrowUpRight size={17}/></div></div>
      <div className={`farm-workspace ${mapFocus ? 'map-focus' : ''}`} id="my-farms"><section className="farm-list"><div className="section-top"><h2>My farms <span>{farms.length}</span></h2><button aria-label="Add farm" onClick={() => setModal('add')}><Plus size={18}/></button></div><label className="search"><Search size={16}/><input placeholder="Find a farm..." value={query} onChange={event => setQuery(event.target.value)}/><span>⌘ K</span></label><div className="farm-items">{farms.filter(item => `${item.name} ${item.location}`.toLowerCase().includes(query.toLowerCase())).map((item,index) => <button key={item.id} className={`farm-item ${item.id === selected ? 'selected' : ''}`} onClick={() => setSelected(item.id)}><div className="farm-thumb aoi" title="Satellite view of your farm boundary"><AoiShape farm={item}/></div><div><h3>{item.name}</h3><p>{item.location}</p><span className="farm-meta">{item.polygon && item.polygon.length >= 3 ? `${mappedBoundaryAreaHa(item).toFixed(2)} ha · ${(mappedBoundaryAreaHa(item) * 2.47105381).toFixed(2)} ac` : 'Location pin · area unknown'}<b>·</b>{item.crop}</span><div className="farm-badges-row"><span className={`status ${item.status === 'Healthy' ? 'good' : item.analysis ? 'warning' : 'neutral'}`}><i/>{item.status}</span><span role="button" tabIndex={0} className="farm-maps-btn" title={`View this field location in Google Maps: ${item.name} (${item.lat.toFixed(4)}°, ${item.lon.toFixed(4)}°)`} onClick={event => { event.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`, '_blank', 'noopener,noreferrer') }} onKeyDown={event => { if (event.key === 'Enter') { event.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`, '_blank', 'noopener,noreferrer') } }}><Navigation size={11} className="maps-symbol-icon"/><span>View location</span></span></div></div><span role="button" tabIndex={0} aria-label={`Remove ${item.name}`} className="farm-remove" onClick={event => { event.stopPropagation(); removeFarm(item) }} onKeyDown={event => { if (event.key === 'Enter') { event.stopPropagation(); removeFarm(item) } }}><Trash2 size={15}/></span></button>)}</div><button className="add-another" onClick={() => setModal('add')}><Plus size={17}/>Add another farm</button><div ref={setLayersPanelTarget} className="ix-panel-dock" aria-label="Layers and symbology controls"/><div className="list-note"><ShieldCheck size={16}/><span>Your coordinates stay on this device.</span></div></section>
       <section className="map-card"><div className="map-header"><div><h2>{farm.name}<ChevronDown size={16}/></h2><span><MapPinned size={13}/>{farm.location}<b>·</b>{farm.polygon && farm.polygon.length >= 3 ? `${mappedBoundaryAreaHa(farm).toFixed(2)} ha · ${(mappedBoundaryAreaHa(farm) * 2.47105381).toFixed(2)} acres` : 'Location pin · area not measured'}</span></div><button className="outline compact" title="Open Land Registry & Pattadar Passbook" onClick={() => document.getElementById('land-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><FileCheck2 size={13} color="#16a34a"/><span>Land passbook</span></button><button className="outline compact farm-header-maps-btn" title={`View this field location in Google Maps: ${farm.name} (${farm.lat.toFixed(4)}°, ${farm.lon.toFixed(4)}°)`} onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${farm.lat},${farm.lon}`, '_blank', 'noopener,noreferrer')}><Navigation size={13} color="#2563eb"/><span>View location</span></button><button className="outline compact" title={mapFocus ? 'Exit focused map view (Esc)' : 'Expand the map and controls'} aria-label={mapFocus ? 'Exit map focus' : 'Focus map'} onClick={() => setMapFocus(value => !value)}>{mapFocus ? <Minimize2 size={13}/> : <Maximize2 size={13}/>}<span>{mapFocus ? 'Exit focus' : 'Focus map'}</span></button><button className="outline compact" onClick={() => removeFarm(farm)}><Trash2 size={14}/>Remove</button><button className="outline compact" disabled={loading} onClick={() => refresh()}><RefreshCw size={14} className={loading ? 'spin' : ''}/>{loading ? 'Updating' : 'Refresh'}</button></div><div className="map-wrap"><SectionBoundary name="Farm map"><Suspense fallback={<div className="reveal-loading map-loading" role="status">Loading the field map…</div>}><IndicatorMap farm={farm} loading={loading} panelTarget={layersPanelTarget} sceneOpts={opts}/></Suspense></SectionBoundary></div><SceneBar opts={opts} onApply={o => { setOpts(o); refresh(farm, o) }} busy={loading} scene={farm.analysis?.scene}/><div className="map-footer"><span><ShieldCheck size={14}/>{farm.analysis ? 'Sentinel-2 analysis ready' : 'Satellite analysis pending'}<b>·</b>{farm.polygon && farm.polygon.length >= 3 ? 'Preview from Microsoft Planetary Computer · Copernicus DEM GLO-30 terrain · clipped to your outline' : 'Sentinel-2 preview around this location pin · parcel area not measured'}</span><button onClick={() => setModal('sources')}>About this data<ArrowUpRight size={13}/></button></div></section></div>
      {editLayout && (
        <div style={{ background: '#064e3b', color: '#a7f3d0', border: '1px solid #10b981', borderRadius: '12px', padding: '12px 18px', margin: '15px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <strong style={{ display: 'block', fontSize: '14px', color: '#fff' }}>Dashboard Layout Customizer Active</strong>
            <span style={{ fontSize: '12px' }}>Move modules up or down to personalize your workflow. Your layout is auto-saved locally on this device.</span>
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
                  {[{title:'Vegetation health',icon:Leaf,value:farm.analysis?.ndvi.mean.toFixed(2),unit:'NDVI',label:farm.analysis ? classify(farm.analysis.ndvi.mean).label : 'Awaiting analysis',note:farm.analysis ? `Range ${farm.analysis.ndvi.min.toFixed(2)} to ${farm.analysis.ndvi.max.toFixed(2)} · Sentinel-2` : 'Sentinel-2 · pending',color:'green',bars:true,stat:farm.analysis?.ndvi,lo:-0.2,hi:1},{title:'Surface soil moisture model',icon:Droplets,value:farm.moisture,unit:'%',label:'Estimate at 0–1 cm, not root zone',note:farm.analysis ? `Broad-area estimate · not a root-zone reading` : 'Broad-area estimate · not a soil sensor',color:'blue',bars:true,stat:farm.analysis?.ndmi,lo:-0.3,hi:0.5},{title:'Rainfall outlook',icon:CloudSun,value:farm.rain?.toFixed(1),unit:'mm',label:'Next 7 days',note:'Open-Meteo · refresh for live data',color:'blue',bars:false},{title:'Terrain & elevation',icon:Mountain,value:farm.elevation,unit:'m',label:'Above sea level',note:'Not a construction assessment',color:'brown',bars:false}].map(({title,icon:Icon,value,unit,label,note,color,bars,stat,lo,hi}: { title: string; icon: typeof Leaf; value?: string | number; unit: string; label: string; note: string; color: string; bars: boolean; stat?: Analysis['ndvi']; lo?: number; hi?: number }) => (
                    <div className={`intelligence-card ${color}`} key={title}>
                      <div className="intelligence-title">
                        <span>{title}</span>
                        <div style={{display:'inline-flex',alignItems:'center',gap:'5px'}}>
                          <button className={`card-refresh-btn ${spinningCard === title ? 'spinning' : ''}`} title={`Refresh ${title}`} aria-label={`Refresh ${title}`} onClick={e => { e.stopPropagation(); refreshCard(title); }}><RefreshCw size={12}/></button>
                          <Icon size={18}/>
                        </div>
                      </div>
                      <div className="intelligence-value">
                        {value ?? '—'}<small>{unit}</small>
                        {title === 'Vegetation health' && farm.analysis && <span className="trend">{farm.analysis.stressPct.toFixed(0)}% <small>stressed</small></span>}
                      </div>
                      <div className="mini-chart">
                        {bars ? (stat && lo !== undefined && hi !== undefined ? barsFromStat(stat, lo, hi) : Array<number>(24).fill(0)).map((height,index) => <span key={index} className={`bar-height-${height}`}/>) : title === 'Rainfall outlook' ? <div className="weather-strip"><span><CloudSun size={18}/><small>7-day total</small></span></div> : <div className="weather-strip"><span><Mountain size={18}/><small>{farm.analysis?.slopePct !== undefined ? `${farm.analysis.slopePct.toFixed(1)}% slope` : 'Slope pending'}</small></span></div>}
                      </div>
                      <div className="metric-description">{label}<span>{note}</span></div>
                    </div>
                  ))}
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
          case 'land-passbook':
          case 'land':
            content = <Reveal><LandInfoCard farm={farm} onUpdateFarm={updateFarm}/></Reveal>
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
  </div>
}
