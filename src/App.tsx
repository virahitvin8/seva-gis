import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { ArrowDownToLine, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, ChevronRight, CloudSun, Droplets, ExternalLink, Globe2, HelpCircle, Layers, Leaf, MapPinned, Menu, Mountain, Plus, RefreshCw, Trash2, Search, Settings2, LogOut, ShieldCheck, Sprout, X } from 'lucide-react'

import CropJournal from './CropJournal'
import WeeklyRecords from './WeeklyRecords'
import { mergeWeekly, weeklyRecords, type WeekRec } from './lib/seva'
import AddFarm, { type NewFarm } from './AddFarm'
import { areaHa, centroid } from './lib/geo'
import IndicatorMap from './IndicatorMap'
import AgroPanel from './AgroPanel'
import WaterPanel from './WaterPanel'
import Intelligence from './Intelligence'
import Contact from './Contact'
import Reveal from './Reveal'
import Credits from './Credits'
import Wordmark from './Wordmark'
import ReportPanel from './ReportPanel'
import { useAccount } from './Auth'
import GeoTools from './GeoTools'
import { NumbersGuide } from './Scale'
import Guide from './Guide'
import DataManager from './DataManager'
import { farmRing } from './lib/seva'
import FieldHealthScore from './FieldHealthScore'
import ScoutHotspots from './ScoutHotspots'
import LandInfoCard from './LandInfoCard'
import CropLibrary from './CropLibrary'
import ProGisExport from './ProGisExport'
import VillageView from './VillageView'

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
const initialFarms: Farm[] = []
import Lang from './Lang'
import { MitraGuide, MitraAvatar } from './Mitra'
import { pickGreeting, todayLabel } from './lib/greet'
import { logoMark as brandLogo } from './assets/brand'
function BrandLogo() { return <img className="brand-logo-image" src={brandLogo} alt="SEVA.GIS official logo" onError={(e) => { e.currentTarget.src = '/logo.png' }} /> }
export default function App() {
  const { who, signOut } = useAccount()
  const [farms, setFarms] = useState<Farm[]>(() => { try { return (JSON.parse(localStorage.getItem('seva-farms') || 'null') || initialFarms).filter((x: Farm) => !x.sample) } catch { return initialFarms } })
  const [selected, setSelected] = useState(farms[0]?.id || '')
  const [modal, setModal] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [nav, setNav] = useState('Overview')
  const [menu, setMenu] = useState(false)
  const farm = (farms.find(item => item.id === selected) || farms[0]) as Farm
  const hi = useMemo(() => pickGreeting(who.name, who.id === 'guest' || who.name === 'Guest'), [who.name])
  useEffect(() => { localStorage.setItem('seva-farms', JSON.stringify(farms)) }, [farms])
  const [zone, setZone] = useState<Zone | null>(null)
  const attempted = useRef(new Set<string>())
  async function loadWeather(target: Farm) {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${target.lat}&longitude=${target.lon}&daily=precipitation_sum&hourly=soil_moisture_0_to_1cm&forecast_days=7&timezone=auto`)
    if (!response.ok) throw new Error('Weather provider unavailable')
    const data = await response.json()
    const precipitation = data.daily.precipitation_sum.filter((value: unknown) => typeof value === 'number')
    const moisture = data.hourly.soil_moisture_0_to_1cm.find((value: unknown) => typeof value === 'number')
    return { rain: precipitation.length ? precipitation.reduce((sum: number, value: number) => sum + value, 0) : undefined, moisture: typeof moisture === 'number' ? Math.round(moisture * 100) : undefined, elevation: data.elevation as number }
  }
  const [opts, setOpts] = useState<SceneOpts>({ mode: 'latest', maxCloud: 30 })
  async function refresh(target = farm, o: SceneOpts = opts) {
    if (!target) return
    attempted.current.add(target.id)
    weeklyTried.current.delete(target.id)
    setLoading(true)
    setMessage('Searching Sentinel-2 scenes that cover your whole farm…')
    const [weather, satellite] = await Promise.allSettled([loadWeather(target), analyze(target, o)])
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
    setMessage(satellite.status === 'fulfilled' ? `Live Sentinel-2 analysis complete (${new Date(satellite.value.scene.datetime).toLocaleDateString()}, ${satellite.value.scene.cloud}% cloud${satellite.value.scene.filled ? `, gaps filled from ${satellite.value.scene.filled} other pass${satellite.value.scene.filled > 1 ? 'es' : ''}` : ''}).${weather.status === 'rejected' ? ' Weather could not be fetched.' : ''}` : `Satellite analysis failed: ${reason}. Existing values are unchanged.`)
    setLoading(false)
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
    if (selected === target.id) setSelected(rest[0].id)
    setMessage(`Removed ${target.name}.`)
  }
  function addBoundary({ name, crop, ring }: NewFarm) {
    const isPolygon = ring.length >= 3
    const { lat, lon } = centroid(ring)
    const next: Farm = { id: crypto.randomUUID(), name, location: `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`, crop, area: isPolygon ? Math.max(Number(areaHa(ring).toFixed(1)), 0.1) : 4, lat, lon, polygon: isPolygon ? ring : undefined, status: 'Awaiting satellite data', sample: false }
    setFarms(current => [...current, next]); setSelected(next.id); setModal(''); refresh(next)
  }
  function go(text: string) {
    setNav(text); setMenu(false)
    if (text === 'Alerts') return setModal('alerts')
    if (text === 'Reports') return setModal('reports')
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
      <nav>{[{ text: 'Overview', icon: Layers }, { text: 'My farms', icon: MapPinned }, { text: 'Crop journal', icon: Sprout },{ text: 'Alerts', icon: Bell }, { text: 'Reports', icon: ArrowDownToLine }].map(({text,icon: Icon}) => <button key={text} className={nav === text ? 'active' : ''} onClick={() => go(text)}><Icon size={19}/>{text}{text === 'Alerts' && farms.some(farmNeedsAttention) && <span className="nav-count">{farms.filter(farmNeedsAttention).length}</span>}</button>)}</nav>
      <div className="nav-label resources-label">RESOURCES</div><nav><button onClick={() => setModal('sources')}><Globe2 size={19}/>Data sources<ArrowUpRight size={14}/></button><button onClick={() => dispatchEvent(new Event('seva-tour'))}><HelpCircle size={19}/>Quick tour with Mitra</button><button onClick={() => setModal('guide')}><BookOpen size={19}/>Field guide</button><button onClick={() => setModal('data')}><ShieldCheck size={19}/>Data manager</button><button className="nav-logout" onClick={signOut}><LogOut size={19}/>Log out</button></nav>
      <div className="sidebar-bottom"><div className="service-card"><BrandLogo/><h4>Built for the ground.<br/>Open to everyone.</h4><p>Earth intelligence, in the spirit of selfless service.</p><span>OPEN DATA. REAL PURPOSE. <ArrowUpRight size={14}/></span></div><button className="help" onClick={() => setModal('guide')}><HelpCircle size={18}/>Help & documentation<ArrowUpRight size={15}/></button><div className="profile"><div className="user-avatar">{(who.name || 'G')[0].toUpperCase()}</div><div className="profile-name">{who.name}<small>{who.email || 'Saved on this device'}</small></div><button aria-label="Settings" onClick={() => setModal('settings')}><Settings2 size={18}/></button><button className="logout" aria-label="Log out" title="Log out" onClick={signOut}><LogOut size={18}/></button></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenu(!menu)}><i className="fa-solid fa-bars-staggered"/></button><span className="top-brand notranslate" translate="no"><img src={brandLogo} alt="" onError={(e) => { e.currentTarget.src = '/logo.png' }}/><Wordmark variant="pro"/><i className="fa-solid fa-satellite top-sat" aria-hidden="true"/></span><span className="crumb-text">Workspace</span><ChevronRight size={14} className="crumb-text"/><strong>{nav}</strong></div><div className="topbar-right"><span className="open-badge"><span/> Powered by open data</span><Lang/><button aria-label="Notifications" className="notification" onClick={() => setModal('alerts')}><Bell size={19}/><i/></button><button className="top-tour notranslate" aria-label="Quick tour with Mitra" title="Quick tour with Mitra" onClick={() => dispatchEvent(new Event('seva-tour'))}><MitraAvatar size={30}/></button><span className="top-avatar" title={who.name}>{(who.name || 'G')[0].toUpperCase()}</span></div></header>
      <main><div className="page-heading"><div><div className="eyebrow">{todayLabel()}</div><h1>{hi.text}{hi.dot && <span>.</span>}</h1><p>{hi.line}</p></div><button className="primary" onClick={() => setModal('add')}><Plus size={18}/>Add a farm</button></div>
      <Guide/>
      {!farm ? <div className="empty-farms"><i className="fa-solid fa-seedling"/><h2>Add your first farm</h2><p>Nothing is here yet. Draw your farm on the map, walk its edge with GPS, or upload a boundary file. SEVA.GIS then reads the newest Sentinel-2 satellite picture for it.</p><button className="primary" onClick={() => setModal('add')}><Plus size={18}/>Add a farm</button></div> : <>
      <div className="summary-grid"><div className="summary-card"><span className="metric-icon"><MapPinned size={21}/></span><div><span>Total farms</span><strong>{farms.length}<small>Across {new Set(farms.map(item => item.location)).size} locations</small></strong></div></div><div className="summary-card"><span className="metric-icon"><Sprout size={21}/></span><div><span>Land under care</span><strong>{farms.reduce((sum,item) => sum + item.area, 0).toFixed(1)} <em>ha</em><small>Declared farm areas</small></strong></div></div><div className="summary-card"><span className="metric-icon healthy"><Leaf size={21}/></span><div><span>Healthy farms</span><strong>{farms.filter(item => item.status === 'Healthy').length}<small><i className="dot green"/>Growing well</small></strong></div></div><div className="summary-card"><span className="metric-icon attention"><Droplets size={21}/></span><div><span>Need attention</span><strong>{farms.filter(farmNeedsAttention).length}<small><i className="dot amber"/>Based on live NDVI stress</small></strong></div><ArrowUpRight size={17}/></div></div>
      <div className="farm-workspace" id="my-farms"><section className="farm-list"><div className="section-top"><h2>My farms <span>{farms.length}</span></h2><button aria-label="Add farm" onClick={() => setModal('add')}><Plus size={18}/></button></div><label className="search"><Search size={16}/><input placeholder="Find a farm..." value={query} onChange={event => setQuery(event.target.value)}/><span>⌘ K</span></label><div className="farm-items">{farms.filter(item => `${item.name} ${item.location}`.toLowerCase().includes(query.toLowerCase())).map((item,index) => <button key={item.id} className={`farm-item ${item.id === selected ? 'selected' : ''}`} onClick={() => setSelected(item.id)}><div className="farm-thumb aoi" title="Satellite view of your farm boundary"><AoiShape farm={item}/></div><div><h3>{item.name}</h3><p>{item.location}</p><span className="farm-meta">{item.area ? `${item.area} ha` : 'Point location'}<b>·</b>{item.crop}</span><span className={`status ${item.status === 'Healthy' ? 'good' : item.analysis ? 'warning' : 'neutral'}`}><i/>{item.status}</span></div><span role="button" tabIndex={0} aria-label={`Remove ${item.name}`} className="farm-remove" onClick={event => { event.stopPropagation(); removeFarm(item) }} onKeyDown={event => { if (event.key === 'Enter') { event.stopPropagation(); removeFarm(item) } }}><Trash2 size={15}/></span></button>)}</div><button className="add-another" onClick={() => setModal('add')}><Plus size={17}/>Add another farm</button><div id="legend-slot"/><div className="list-note"><ShieldCheck size={16}/><span>Your coordinates stay on this device.</span></div></section>
      <section className="map-card"><div className="map-header"><div><h2>{farm.name}<ChevronDown size={16}/></h2><span><MapPinned size={13}/>{farm.location}<b>·</b>{farm.area ? `${farm.area} hectares` : 'Location only'}</span></div><button className="outline compact" onClick={() => removeFarm(farm)}><Trash2 size={14}/>Remove</button><button className="outline compact" onClick={() => refresh()}><RefreshCw size={14} className={loading ? 'spin' : ''}/>{loading ? 'Updating' : 'Refresh'}</button></div><div className="map-wrap"><IndicatorMap farm={farm} loading={loading}/></div><SceneBar opts={opts} onApply={o => { setOpts(o); refresh(farm, o) }} busy={loading} scene={farm.analysis?.scene}/><div className="map-footer"><span><ShieldCheck size={14}/>{farm.analysis ? 'Live Sentinel-2 L2A analysis' : 'Satellite analysis pending'}<b>·</b>10 m Sentinel-2 · 30 m Copernicus DEM · clipped to your farm boundary</span><button onClick={() => setModal('sources')}>About this data<ArrowUpRight size={13}/></button></div></section></div>
      <CropJournal farms={farms as any} selected={farm.id} onSelect={setSelected} onRefresh={() => refresh()} loading={loading}/>
      <FieldHealthScore farm={farm}/>
      <div className="intelligence-heading"><h2>Field intelligence <span>{farm.analysis ? 'Live Sentinel-2 metrics' : 'Awaiting satellite analysis'}</span></h2><button onClick={() => setModal('reports')}><ArrowDownToLine size={15}/>Create report</button></div>
      <div className="intelligence-grid">{[{title:'Vegetation health',icon:Leaf,value:farm.analysis?.ndvi.mean.toFixed(2),unit:'NDVI',label:farm.analysis ? classify(farm.analysis.ndvi.mean).label : 'Awaiting analysis',note:farm.analysis ? `Range ${farm.analysis.ndvi.min.toFixed(2)} to ${farm.analysis.ndvi.max.toFixed(2)} · Sentinel-2` : 'Sentinel-2 · pending',color:'green',bars:true,stat:farm.analysis?.ndvi,lo:-0.2,hi:1},{title:'Soil moisture',icon:Droplets,value:farm.moisture,unit:'%',label:'Check root-zone moisture',note:farm.analysis ? `Model estimate · bars show NDMI spread (mean ${farm.analysis.ndmi.mean.toFixed(2)})` : 'Surface estimate · not a sensor',color:'blue',bars:true,stat:farm.analysis?.ndmi,lo:-0.3,hi:0.5},{title:'Rainfall outlook',icon:CloudSun,value:farm.rain?.toFixed(1),unit:'mm',label:'Next 7 days',note:'Open-Meteo · refresh for live data',color:'blue',bars:false},{title:'Terrain & elevation',icon:Mountain,value:farm.elevation,unit:'m',label:'Above sea level',note:'Not a construction assessment',color:'brown',bars:false}].map(({title,icon:Icon,value,unit,label,note,color,bars,stat,lo,hi}: { title: string; icon: typeof Leaf; value?: string | number; unit: string; label: string; note: string; color: string; bars: boolean; stat?: Analysis['ndvi']; lo?: number; hi?: number }) => <div className={`intelligence-card ${color}`} key={title}><div className="intelligence-title"><span>{title}</span><Icon size={18}/></div><div className="intelligence-value">{value ?? '—'}<small>{unit}</small>{title === 'Vegetation health' && farm.analysis && <span className="trend">{farm.analysis.stressPct.toFixed(0)}% <small>stressed</small></span>}</div><div className="mini-chart">{bars ? (stat && lo !== undefined && hi !== undefined ? barsFromStat(stat, lo, hi) : Array<number>(24).fill(0)).map((height,index) => <span key={index} className={`bar-height-${height}`}/>) : title === 'Rainfall outlook' ? <div className="weather-strip"><span><CloudSun size={18}/><small>7-day total</small></span></div> : <div className="weather-strip"><span><Mountain size={18}/><small>{farm.analysis?.slopePct !== undefined ? `${farm.analysis.slopePct.toFixed(1)}% slope` : 'Slope pending'}</small></span></div>}</div><div className="metric-description">{label}<span>{note}</span></div></div>)}</div>
      <NumbersGuide/>
      <div className="advice-grid">{([['Irrigation advisory', Droplets, irrigationAdvice(farm)], ['Construction suitability', Mountain, constructionSuitability(farm)]] as [string, typeof Droplets, Advice][]).map(([title, Icon, advice]) => <section className={`advice-card ${advice.level}`} key={title}><div className="advice-head"><span className="action-icon"><Icon size={22}/></span><div className="action-label">{title.toUpperCase()}</div><span className={`status ${advice.level === 'good' ? 'good' : advice.level === 'neutral' ? 'neutral' : 'warning'}`}><i/>{advice.chip}</span></div><h3>{advice.title}</h3><ul>{advice.bullets.map(text => <li key={text}>{text}</li>)}</ul>{advice.why && <p className="why"><b>Why?</b> {advice.why}</p>}</section>)}</div>
      <Reveal><AgroPanel farm={farm}/><WaterPanel farm={farm}/></Reveal>
      <Reveal><ScoutHotspots farm={farm}/><LandInfoCard farm={farm}/></Reveal>
      <Reveal><CropLibrary/></Reveal>
      <Reveal><VillageView farms={farms} selectedId={farm.id} onSelect={setSelected} onAddBatch={addBatchFarms}/></Reveal>
      <Reveal><ProGisExport farm={farm} farms={farms} onImportBackup={restored => { setFarms(restored); if (restored[0]) { setSelected(restored[0].id); refresh(restored[0]); } }} /></Reveal>
      <Reveal><Intelligence farm={farm}/></Reveal>
      <Reveal><GeoTools farm={farm} farms={farms}/></Reveal>
      <Reveal><WeeklyRecords farms={farms} farm={farm} onSelect={setSelected}/></Reveal>
      </>}
      <Contact/>
      <MitraGuide name={who.name} guest={who.name === 'Guest'}/>
      <Credits/>
      <footer className="page-footer"><span><BrandLogo/>Spatial Evaluation & Vegetation Analytics</span><span>Built by N. Akshit Vinay. Powered by open data.<span className="footer-dot">●</span>seva.gis</span></footer>
      </main>
    </div>
    {message && <div className="toast" role="status"><ShieldCheck size={19}/>{message}<button aria-label="Dismiss" onClick={() => setMessage('')}><X size={17}/></button></div>}
    {modal && <div className="modal-backdrop" onClick={() => setModal('')}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={event => event.stopPropagation()}><button className="modal-close" aria-label="Close dialog" onClick={() => setModal('')}><X size={20}/></button><span className="modal-icon"><BrandLogo/></span><div className="eyebrow">SEVA · LAND INTELLIGENCE</div><h2 id="modal-title">{modal === 'add' ? 'Bring your land into view.' : modal === 'zone' ? 'Understand this spot.' : modal === 'sources' ? 'Open data. Transparent limits.' : modal === 'alerts' ? 'Your field advisories.' : modal === 'reports' ? 'Take your insights with you.' : modal === 'data' ? 'Your account and data.' : modal === 'settings' ? 'Your personal workspace.' : 'From coordinates to clarity.'}</h2>
      {modal === 'data' ? <DataManager/> : modal === 'add' ? <AddFarm onAdd={addBoundary} onError={setMessage}/> : modal === 'zone' ? (() => {
        const verdict = classify(zone ? zone.ndvi : farm.analysis?.ndvi.mean)
        return <><span className={`status ${verdict.level === 'good' ? 'good' : verdict.level === 'neutral' ? 'neutral' : 'warning'}`}><i/>{verdict.label}</span><p>{zone ? `Pixel at ${zone.lat.toFixed(5)}°, ${zone.lon.toFixed(5)}° from the ${farm.analysis ? new Date(farm.analysis.scene.datetime).toLocaleDateString() : ''} Sentinel-2 scene.` : 'Farm average from the latest Sentinel-2 scene.'}</p><div className="advisory-facts"><span>NDVI<strong>{(zone ? zone.ndvi : farm.analysis?.ndvi.mean)?.toFixed(2) ?? '—'}</strong></span><span>NDMI<strong>{(zone ? zone.ndmi : farm.analysis?.ndmi.mean)?.toFixed(2) ?? '—'}</strong></span><span>Cloud<strong>{farm.analysis ? `${farm.analysis.scene.cloud}%` : '—'}</strong></span></div><h3>What should I do?</h3><p>{verdict.advice}</p><div className="privacy-note"><ShieldCheck size={18}/>Satellite values are not pixel cloud-masked and are not field-validated. Confirm on the ground before acting.</div></>
      })() : modal === 'sources' ? <><p>We show what is measured, modeled, or illustrative. No invented accuracy scores and no guarantee of perfect precision.</p>{[['Satellite imagery','Esri world imagery basemap; capture dates vary.'],['Vegetation indices','Sentinel-2 L2A from Microsoft Planetary Computer (STAC search + TiTiler raster API, no API key). Bands are read at 10 m, offset-corrected to surface reflectance, cloud/shadow-masked with the SCL layer, and clipped to your exact boundary before every index is computed in your browser.'],['Weather & soil moisture','Open-Meteo forecast API. Soil moisture is modeled at coarse resolution, not a farm sensor.'],['Terrain & construction','Copernicus GLO-30 DEM (30 m) for elevation, slope, aspect and hillshade; SoilGrids 250 m for soil properties. Engineering and flood assessments require site surveys.']].map(([title,description]) => <div className="source-item" key={title}><Check size={17}/><div><h3>{title}</h3><p>{description}</p></div></div>)}<a className="external-link" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo documentation<ExternalLink size={15}/></a></> : modal === 'alerts' ? <>{farms.filter(farmNeedsAttention).map(item => <button className="alert-row" key={item.id} onClick={() => { setSelected(item.id); setZone(null); setModal('zone') }}><Droplets size={21}/><div><h3>{item.name}</h3><p>{item.status} · {item.analysis!.stressPct.toFixed(0)}% of pixels stressed</p></div><ChevronRight size={18}/></button>)}{!farms.some(farmNeedsAttention) && <p>No farms currently need attention based on their latest satellite scene.</p>}<p>Alerts reflect the last analysis on this device. Background monitoring and email notifications are not connected.</p></> : modal === 'reports' ? <ReportPanel farm={farm as any}/> : modal === 'settings' ? <><p>Farms are stored in this browser only, and are not synced across devices. Clearing browser storage removes them.</p><p>*This prototype has no payment flow. External providers have terms, quotas and availability limits; free access forever cannot be guaranteed.</p><button className="outline" onClick={signOut}><LogOut size={16}/>Log out of {who.name}</button><button className="outline" onClick={() => { setModal(''); setMessage('Google login and cloud sync require your own configured authentication project. No account connection is active.') }}>About Google sign-in<ArrowUpRight size={16}/></button></> : <><p>1. Add a farm with its latitude and longitude.<br/>2. Select your farm to explore the satellite basemap.<br/>3. Refresh to fetch current weather-model estimates.<br/>4. Click an example colored zone to understand its meaning.<br/>5. Export your report, including its limitations.</p><div className="privacy-note"><ShieldCheck size={20}/>This is a working frontend foundation, not a validated GeoAI decision engine. Satellite pipelines, authenticated sync, and public deployment require further setup.</div></>}
    </section></div>}
  </div>
}
