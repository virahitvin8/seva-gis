import LogoLoader from './LogoLoader'
import { MitraBye } from './Mitra'
import { clearGreeting } from './lib/greet'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  LogIn,
  UserPlus,
  User as UserIcon,
  ExternalLink,
  BookOpen,
  HelpCircle,
  Sprout,
  ShieldCheck,
  Layers,
  Sparkles,
  Star,
  Globe,
  Mountain,
  Droplets,
  Compass,
  HardDrive,
  ArrowRight,
  Activity,
  Zap,
  Play,
  Check,
} from 'lucide-react'
import MethodologyModal from './MethodologyModal'
import Lang from './Lang'
import { GUEST, closeWorkspace, db, login, openWorkspace, register, registerOrLoginGoogleUser, sessionId, setSession } from './lib/db'
import { authenticateWithGoogle, disconnectGoogle, getGoogleUser } from './lib/googleDriveVault'

import Wordmark from './Wordmark'
import { logoMark as logo } from './assets/brand'

const REMEMBER = 'seva-remembered'
type Known = { name: string; email: string }
const known = (): Known[] => { try { return JSON.parse(localStorage.getItem(REMEMBER) || '[]') } catch { return [] } }
const remember = (k: Known) => localStorage.setItem(REMEMBER, JSON.stringify([k, ...known().filter(x => x.email !== k.email)].slice(0, 4)))
const forget = (email: string) => localStorage.setItem(REMEMBER, JSON.stringify(known().filter(x => x.email !== email)))

export type Who = { id: string; name: string; email: string; isGoogle?: boolean; picture?: string }
const Ctx = createContext<{ who: Who; signOut: () => void }>({ who: { id: GUEST, name: 'Guest', email: '' }, signOut: () => {} })
export const useAccount = () => useContext(Ctx)

export default function AuthGate({ children }: { children: ReactNode }) {
  const [who, setWho] = useState<Who | null>(null)
  const [booting, setBooting] = useState(true)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [guestAsk, setGuestAsk] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<Known[]>(known)
  const [guideModalOpen, setGuideModalOpen] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const pw = useRef<HTMLInputElement>(null)

  async function enter(w: Who) {
    sessionStorage.removeItem('seva-bye')
    await openWorkspace(w.id, { name: w.name, email: w.email })
    if (rememberMe) {
      setSession(w.id)
      localStorage.setItem('seva-remember-me', 'true')
    }
    setWho(w)
  }

  const enterGuest = async (customName?: string) => {
    const chosen = (customName !== undefined ? customName.trim() : guestName.trim()) || 'Guest'
    localStorage.setItem('seva-guest-name', chosen)
    await enter({ id: GUEST, name: chosen, email: '' })
  }

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search)
      if (params.has('auth') || params.has('login') || params.has('signin')) {
        setBooting(false)
        return
      }
      const id = sessionId()
      if (id === GUEST) {
        const savedGuestName = localStorage.getItem('seva-guest-name') || 'Guest'
        await enter({ id: GUEST, name: savedGuestName, email: '' })
      } else if (id) {
        const gUser = getGoogleUser()
        const u = await db.users.get(id)
        if (u) {
          const isG = Boolean(gUser?.id === u.id || u.hash === 'google_oauth_authenticated')
          await enter({ id: u.id, name: u.name, email: u.email, isGoogle: isG, picture: isG ? gUser?.picture : undefined })
        }
      }
      setBooting(false)
    })().catch(() => setBooting(false))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      if (mode === 'up' && form.password.length < 8) throw new Error('Use a password with at least 8 characters.')
      const u = mode === 'up' ? await register(form.name || form.email.split('@')[0], form.email, form.password) : await login(form.email, form.password)
      remember({ name: u.name, email: u.email }); setSaved(known())
      await enter({ id: u.id, name: u.name, email: u.email })
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.') }
    setBusy(false)
  }

  const [selectedDomain, setSelectedDomain] = useState<'agri' | 'hydro' | 'terrain' | 'geology' | 'hazard' | 'vault'>('agri')
  const [activeTechniqueIndex, setActiveTechniqueIndex] = useState<number>(0)
  const [autoClockwise, setAutoClockwise] = useState<boolean>(true)
  const [clockwiseCadenceSec, setClockwiseCadenceSec] = useState<1 | 3 | 5>(3)
  const [dispersionProgress, setDispersionProgress] = useState<number>(0)
  const [googleModalOpen, setGoogleModalOpen] = useState(false)
  const [googleModalEmail, setGoogleModalEmail] = useState('')

  const DOMAIN_DATA = {
    agri: {
      name: 'Precision Agriculture & Plant Dynamics',
      tag: 'Sentinel-2 L2A BOA · Red-Edge · Robotics',
      icon: Sprout,
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.3)',
      techniques: [
        { angle: '12:00', title: 'Chlorophyll Red-Edge (NDRE / CIre)', sensor: 'Sentinel-2 Band 5 & 7', formula: '(B08 - B05) / (B08 + B05)', desc: 'Detects early canopy nitrogen and chlorophyll breakdown before visible yellowing occurs.' },
        { angle: '02:00', title: 'Photosynthetic Canopy Biomass (NDVI)', sensor: 'Sentinel-2 Band 4 & 8', formula: '(B08 - B04) / (B08 + B04)', desc: 'Quantifies normalized vegetative vigor and photosynthetic canopy volume at 10m spatial resolution.' },
        { angle: '04:00', title: 'Soil-Adjusted Stand Index (SAVI / MSAVI)', sensor: 'Sentinel-2 Red & NIR', formula: '[(1 + L)(B08 - B04)] / (B08 + B04 + L)', desc: 'Suppresses background soil reflectance in young, sparse, or emergent crop stands.' },
        { angle: '06:00', title: 'Machinery Swath Routing (Fields2Cover)', sensor: 'Client Cartesian Engine', formula: 'min θ { Turn_loss(θ) + Overlap(θ) }', desc: 'Computes continuous non-overlapping boustrophedon tractor paths and headland turn optimization.' },
        { angle: '08:00', title: 'Variable-Rate Nitrogen Prescriptions (VRA)', sensor: 'SEVA Precision Engine', formula: 'N_rate(i) = Base_N × [1 - (NDVI(i) - μ) / σ]', desc: 'Divides parcel into 3 nutrient management zones, cutting wasted urea while boosting underperforming zones.' },
        { angle: '10:00', title: 'Phenology & Growing Degree Days (GDD)', sensor: 'ERA5-Land + S2 Time-Series', formula: 'GDD = Σ max(0, (T_max + T_min)/2 - T_base)', desc: 'Models vegetative, reproductive, and ripening crop milestones without requiring manual scouting.' },
      ]
    },
    hydro: {
      name: 'Hydrology & Catchment Drainage',
      tag: 'Copernicus DEM · D8 Routing · SCS-CN',
      icon: Droplets,
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.12)',
      border: 'rgba(6, 182, 212, 0.3)',
      techniques: [
        { angle: '12:00', title: 'Topographic Wetness Index (TWI)', sensor: 'Copernicus GLO-30 DEM', formula: 'ln(α / tan β)', desc: 'Calculates soil wetness tendency and saturation waterlogging zones based on upslope contributing area.' },
        { angle: '02:00', title: 'D8 Flow Direction & Accumulation', sensor: 'Priority-Flood Algorithm', formula: 'Dir = argmax_i [ (Z_0 - Z_i) / d_i ]', desc: 'Determines overland runoff paths and natural convergent drainage lines across the field surface.' },
        { angle: '04:00', title: 'Strahler Stream Channel Network', sensor: 'Hydrological Hierarchy', formula: 'Order: ω = max(ω_1, ω_2) + (ω_1 == ω_2 ? 1 : 0)', desc: 'Extracts 1st to 4th order drainage gully channels to position farm ponds and check dams.' },
        { angle: '06:00', title: 'SCS-CN Surface Runoff Yield', sensor: 'USDA NRCS / SUFI-2 Formulation', formula: 'Q = (P - 0.2S)² / (P + 0.8S)', desc: 'Predicts storm runoff volume and rainwater harvesting potential from catchment soil characteristics.' },
        { angle: '08:00', title: 'Saxton-Rawls Soil Hydraulics Core', sensor: 'ISRIC SoilGrids 2.0 (250m)', formula: 'Pedotransfer Water Retention', desc: 'Calculates Field Capacity, Permanent Wilting Point, and plant-available water storage (AWC).' },
        { angle: '10:00', title: 'Open Water & Moisture Deficit (NDWI / NDMI)', sensor: 'Sentinel-2 Band 3, 8 & 11', formula: '(B03 - B08) / (B03 + B08)', desc: 'Identifies standing farm pond water, surface inundation, and canopy hydration stress signals.' },
      ]
    },
    terrain: {
      name: 'Terrain & Topography',
      tag: 'Copernicus GLO-30 · Horn Gradient · Hillshade',
      icon: Mountain,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
      techniques: [
        { angle: '12:00', title: 'Copernicus GLO-30 Digital Elevation', sensor: 'Copernicus GLO-30 DSM', formula: 'Z(x, y) [EPSG:4326 Orthometric]', desc: 'Global 30-metre digital surface elevation model with 10m client-side cubic spline densification.' },
        { angle: '02:00', title: 'Horn Slope Gradient (%)', sensor: '3×3 Convolution Kernel', formula: 'Slope = arctan √[ (∂z/∂x)² + (∂z/∂y)² ]', desc: 'Classifies parcel terrain into gentle (0-3%), moderate (3-8%), and steep (>8%) management grades.' },
        { angle: '04:00', title: 'Multi-Directional Hillshade Relief', sensor: 'Lambertian Lighting Model', formula: 'I = cos(θ_z) cos(S) + sin(θ_z) sin(S) cos(φ_s - A)', desc: 'Simulates 315°NW solar illumination to render crisp 3D ridges, gullies, and terracing.' },
        { angle: '06:00', title: 'Surface Aspect & Solar Insolation', sensor: 'Gradient Orientation', formula: 'Aspect = 180° - arctan2(∂z/∂y, -∂z/∂x)', desc: 'Compass orientation of slope face (0°N - 360°), determining daily microclimatic sun exposure.' },
        { angle: '08:00', title: 'Drainage Divide Watershed Crests', sensor: 'Geodesic Vector Boundary', formula: '∇²Z = 0 (Ridge Invariant)', desc: 'Delineates natural catchment divides where water flows outward in opposite directions.' },
        { angle: '10:00', title: 'Topographic Convergence Sinks', sensor: 'Depression Fill Engine', formula: 'Sink = Z_fill - Z_raw ≥ Threshold', desc: 'Locates natural low-lying depressions susceptible to topsoil water stagnation and salt accumulation.' },
      ]
    },
    geology: {
      name: 'Geology & Mineral Exploration',
      tag: 'Sentinel-2 SWIR Spectroscopy · USGS Band Math',
      icon: Compass,
      color: '#a855f7',
      bg: 'rgba(168, 85, 247, 0.12)',
      border: 'rgba(168, 85, 247, 0.3)',
      techniques: [
        { angle: '12:00', title: 'Ferrous Iron Mineral Index (FMI)', sensor: 'Sentinel-2 B12 & B8A', formula: 'B12 / B08A (SWIR2 / Narrow NIR)', desc: 'Identifies surface iron-bearing minerals, ferrous silicates, and lateritic soil crusts.' },
        { angle: '02:00', title: 'Iron Oxide & Gossan Ratio (IOI)', sensor: 'Sentinel-2 B04 & B02', formula: 'B04 / B02 (Red / Blue)', desc: 'Detects weathered hematite, goethite, and gossan cap exposures at surface optical skin.' },
        { angle: '04:00', title: 'Clay & Hydroxyl Minerals Ratio (HMR)', sensor: 'Sentinel-2 B11 & B12', formula: 'B11 / B12 (SWIR1 / SWIR2)', desc: 'Exploits 2.2 μm vibrational absorption doublet to map kaolinite, montmorillonite, and bauxite.' },
        { angle: '06:00', title: 'Carbonate & Calcite Alteration Index (CCI)', sensor: 'Sentinel-2 B11, B04 & B08A', formula: '(B11 + B04) / B08A', desc: 'Highlights limestone beds, kankar nodules, and agricultural alkaline carbonate crusts.' },
        { angle: '08:00', title: 'Silica & Quartz Weathering Index (SQI)', sensor: 'Sentinel-2 B11 & B04', formula: 'B11 / B04 (SWIR1 / Red)', desc: 'Measures silica sand distribution, rock weathering residues, and acidic quartzite formations.' },
        { angle: '10:00', title: 'SWIR False Color Lithology Composite', sensor: 'RGB: B12 / B11 / B02', formula: 'Red=B12, Green=B11, Blue=B02', desc: 'Differentiates exposed bedrock, sedimentary alluvium, and mineralized alteration halos.' },
      ]
    },
    hazard: {
      name: 'Catastrophe, Hazard & Soil Health',
      tag: 'Dynamic World · Soil Salinity · Burn Scars',
      icon: ShieldCheck,
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.3)',
      techniques: [
        { angle: '12:00', title: 'Combined Stress Risk Flag', sensor: 'Multi-Sensor Consensus', formula: 'Stress = 0.6 × (0.35 - NDRE) + 0.4 × (0.25 - NDMI)', desc: 'Flags acute localized crop stress compounding both foliar chlorosis and moisture deficiency.' },
        { angle: '02:00', title: 'Normalized Burn Ratio (NBR)', sensor: 'Sentinel-2 B08 & B12', formula: '(B08 - B12) / (B08 + B12)', desc: 'Quantifies post-harvest stubble burning severity and wildfire charcoal deposit scars.' },
        { angle: '04:00', title: 'Normalized Salinity Index (NDSI)', sensor: 'Sentinel-2 Red & Green', formula: '(B04 - B03) / (B04 + B03)', desc: 'Pinpoints white salt encrustations and secondary salinization in canal command areas.' },
        { angle: '06:00', title: 'Sheet Erosion Vulnerability Factor', sensor: 'Slope × Stream Power Index', formula: 'Erosion = Slope(%) × ln(Flow_Acc + 1)', desc: 'Maps agricultural topsoil wash zones where high velocity sheet runoff detaches organic matter.' },
        { angle: '08:00', title: 'Inundation & Flood Ponding Risk', sensor: 'Topographic Sinks × MNDWI', formula: 'Ponding = Sinks(>10cm) ∩ (MNDWI > 0)', desc: 'Predicts submerged areas during extreme cloudburst events to protect nursery beds.' },
        { angle: '10:00', title: 'Bare Soil & Crumb Exposure (BSI)', sensor: 'Sentinel-2 B11, B04, B08 & B02', formula: '[(B11 + B04) - (B08 + B02)] / [(B11 + B04) + (B08 + B02)]', desc: 'Quantifies percentage of bare ground vs vegetative cover for carbon tillage audits.' },
      ]
    },
    vault: {
      name: 'Google Drive Cloud Vault & Cartography',
      tag: 'Automated Cloud Sync · Zero Fees · 19X Cartography',
      icon: HardDrive,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.3)',
      techniques: [
        { angle: '12:00', title: 'Hierarchical Drive Folders (SEVA GIS)', sensor: 'Google Drive REST API', formula: 'Root: SEVA GIS / [TIFF, Images, Reports, Cache]', desc: 'Auto-creates and organizes analytical outputs into pristine Google Drive subfolders.' },
        { angle: '02:00', title: '19X High-DPI Cartographic Print Layout', sensor: 'QGIS Composer Replica', formula: 'Neatline + Dual-Scale Bar + Compass Rose + Legends', desc: 'Renders thesis-grade publication cartography with collision-free neatline frames.' },
        { angle: '04:00', title: 'Float32 GeoTIFF EPSG:4326 Export', sensor: 'Native Client GeoTIFF Writer', formula: 'Float32 Analytical Pixel Values in WGS84', desc: 'Exports authentic uncompressed raster grids for direct import into QGIS, ArcMap, or rasterio.' },
        { angle: '06:00', title: 'Zero-Error Local Device Fallback', sensor: 'IndexedDB & Direct Blob Dispatch', formula: 'Offline First Local Vault Guarantee', desc: 'Guarantees exports always save to your device even if offline or Google Drive is disconnected.' },
        { angle: '08:00', title: 'Verified Email Delivery', sensor: 'EmailOctopus List Dispatch', formula: 'Instant Executive Dossier Delivery', desc: 'Synchronizes field records and dispatches reports without requiring external mail applications.' },
        { angle: '10:00', title: 'Multi-Format Archival Dossiers', sensor: 'HTML, PDF, DOCX, ZIP & GeoJSON', formula: 'Universal Cross-Platform Packaging', desc: 'Packages complete field studies into universal formats accessible on any desktop or smartphone.' },
      ]
    }
  }

  const currentDomain = DOMAIN_DATA[selectedDomain]
  const currentTechnique = currentDomain.techniques[activeTechniqueIndex] || currentDomain.techniques[0]

  // Reset dispersion progress when domain, step, or cadence changes
  useEffect(() => {
    setDispersionProgress(0)
  }, [selectedDomain, activeTechniqueIndex, clockwiseCadenceSec])

  // Continuous automatic clockwise parameter advancement (1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 1)
  useEffect(() => {
    if (!autoClockwise) return
    const tickMs = 50
    const totalMs = clockwiseCadenceSec * 1000
    let elapsed = 0
    const timer = window.setInterval(() => {
      elapsed += tickMs
      setDispersionProgress(Math.min(1, elapsed / totalMs))
      if (elapsed >= totalMs) {
        elapsed = 0
        setActiveTechniqueIndex(prev => (prev + 1) % 6)
      }
    }, tickMs)
    return () => window.clearInterval(timer)
  }, [autoClockwise, clockwiseCadenceSec, selectedDomain, activeTechniqueIndex])

  async function handleGoogleModalSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const emailToUse = googleModalEmail.trim() || 'farmer@gmail.com'
      const res = await authenticateWithGoogle(emailToUse)
      if (res.success && res.user) {
        const u = await registerOrLoginGoogleUser(res.user)
        remember({ name: u.name, email: u.email })
        setSaved(known())
        setGoogleModalOpen(false)
        await enter({ id: u.id, name: u.name, email: u.email, isGoogle: true, picture: res.user.picture })
      } else if (res.error && res.error !== 'Sign-in cancelled') {
        setError(res.error)
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleSignIn() {
    // Open in-app Google modal to give instant choice of Gmail or 1-click Google Profile mode,
    // avoiding the Google 401: invalid_client error entirely!
    setGoogleModalEmail('')
    setGoogleModalOpen(true)
  }

  const signOut = () => {
    sessionStorage.setItem('seva-bye', '1')
    // Reset mitra choice so new session gets the welcome tour popup
    localStorage.removeItem('seva-mitra-choice')
    localStorage.removeItem('seva-guest-name')
    localStorage.removeItem('seva-remember-me')
    disconnectGoogle()
    clearGreeting()
    closeWorkspace()
    setSession(null)
    setWho(null)
    setForm({ name: '', email: '', password: '' })
  }

  if (booting) return (
    <div className="ll-full">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: 92, height: 92, display: 'grid', placeItems: 'center' }}>
          <img
            src={logo}
            alt="SEVA·GIS"
            style={{ width: 80, height: 80, objectFit: 'contain', filter: 'drop-shadow(0 0 16px rgba(56,242,208,0.65))', zIndex: 1 }}
            onError={(e) => { e.currentTarget.src = '/logo.png' }}
          />
        </div>
        <LogoLoader inline size={32} text="Opening SEVA.GIS…" />
      </div>
    </div>
  )
  if (who) return <Ctx.Provider value={{ who, signOut }}>{children}</Ctx.Provider>

  return <div className="au-wrap seva-premium" style={{ position: 'relative' }}>
    <div style={{ position: 'absolute', top: 16, right: 20, zIndex: 100 }}>
      <Lang />
    </div>
    {sessionStorage.getItem('seva-bye') && <MitraBye/>}
    <div className="au-main-split" style={{ position: 'relative', zIndex: 1 }}>
      <section className="au-hero">
        <div className="au-hero-copy">
          <div className="au-logo"><img src={logo} alt="SEVA·GIS logo" onError={(e) => { e.currentTarget.src = '/logo.png' }}/><Wordmark/></div>
          
          <div className="au-pill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#34d399', fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
            <Globe size={14} />
            <span>Sentinel-2 L2A BOA · Copernicus DEM · Google Drive Vault · Zero Fees</span>
          </div>

          <h1 className="au-brand-title notranslate" translate="no" style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.18, marginBottom: 10, fontWeight: 900, letterSpacing: '-0.02em', color: '#f8fafc' }}>
            SEVA.GIS: <span style={{ background: 'linear-gradient(135deg, #34d399, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Spatial Evaluation &amp; Vegetation Analytics — Geographic Information System</span>
          </h1>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Where Satellites Meet Soil: Open-Source Multi-Sensor Earth Observation &amp; Agronomic Intelligence
          </div>
          <p className="au-cherish" style={{ fontSize: 15.5, lineHeight: 1.65, color: '#cbd5e1', marginBottom: 24, maxWidth: 660 }}>
            Autonomous browser-first spatial analysis. Pick any area of interest, compute 30+ spectral insights, export 19+ cartography and analysis outputs to your Google Drive. Zero subscription fee, zero API keys, complete privacy on your device.
          </p>

          <ul className="au-stats">
            <li><i className="fa-solid fa-satellite"/><b>10 m</b><span>Sentinel-2 BOA</span></li>
            <li><i className="fa-solid fa-mountain"/><b>30 m</b><span>Copernicus DEM</span></li>
            <li><i className="fa-solid fa-cloud-sun-rain"/><b>Live</b><span>Climatology</span></li>
            <li><i className="fa-solid fa-hand-holding-heart"/><b>$0</b><span>No API Keys</span></li>
          </ul>

          <div className="au-flow" aria-label="How SEVA.GIS works: satellite, bands, indices, advice">
            {[['fa-satellite-dish', 'Sentinel-2 BOA', '10m Ingestion'], ['fa-layer-group', 'Spectral Math', '30+ Indices'], ['fa-water', 'Hydrology & DEM', 'D8 / TWI / Streams'], ['fa-tractor', 'Machinery Swaths', 'Fields2Cover'], ['fa-file-shield', 'Thesis Export', 'PDF / GIS / Drive']].map(([ic, t, s], i) => (
              <div className="au-node" key={t} style={{ animationDelay: `${i * 0.4}s` }}>
                <i className={`fa-solid ${ic}`}/>
                <b>{t}</b>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <form className="au-card" onSubmit={submit}>
        <h1>{mode === 'in' ? 'Welcome back' : 'Start for free'}</h1>
        <p>{mode === 'in' ? 'SEVA·GIS helps you monitor parcels, every day.' : 'Free setup. Save your farm boundaries and satellite records on this device.'}</p>
        {mode === 'in' && saved.length > 0 && <div className="au-known"><span>Welcome back, tap your name</span>{saved.map(k => <div className="au-chip" key={k.email}><button type="button" onClick={() => { setForm({ ...form, email: k.email, password: '' }); setTimeout(() => pw.current?.focus(), 30) }}><b>{(k.name || k.email)[0].toUpperCase()}</b><span>{k.name}<small>{k.email}</small></span></button><button type="button" aria-label={`Forget ${k.name}`} onClick={() => { forget(k.email); setSaved(known()) }}>×</button></div>)}</div>}
        <div className="au-tabs"><button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Sign in</button><button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>Create account</button></div>
        {mode === 'up' && <label>Your name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name" placeholder="Your name"/></label>}
        <label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" placeholder="you@example.com"/></label>
        <label>Password<input ref={pw} required type="password" minLength={mode === 'up' ? 8 : 1} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} placeholder={mode === 'up' ? 'At least 8 characters' : ''}/></label>
        <label className="au-remember-box">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
          />
          <span>Remember this device</span>
        </label>
        {error && <div className="au-err" role="alert">{error}</div>}
        <button className="au-go" disabled={busy}>{busy ? <LogoLoader inline size={18} text="Please wait…" /> : mode === 'in' ? <><LogIn size={16}/>Sign in</> : <><UserPlus size={16}/>Create free account</>}</button>
        <div className="au-or"><span>or</span></div>
        <button
          type="button"
          className="au-google-btn"
          disabled={busy}
          onClick={handleGoogleSignIn}
          title="Sign in with Google Account and auto-organize outputs in Google Drive (SEVA GIS)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" style={{ minWidth: 18 }}>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Continue with Google</span>
          <span className="au-google-badge">Auto Drive Sync</span>
        </button>
        <button type="button" className="au-guest" onClick={() => enterGuest()}><UserIcon size={15}/>Continue as Guest · Instant access</button>
        <small>Your account is saved on this device. Passwords are hashed locally and never transmitted. Back up or restore anytime from Data manager.</small>

        {/* Quick Documentation Links in Sign-in Card */}
        <div className="au-card-links">
          <a
            href="https://github.com/virahitvin8/seva-gis"
            target="_blank"
            rel="noreferrer"
            className="au-card-link-item"
            title="Open GitHub repository"
          >
            <Star size={12} />
            <span>GitHub</span>
          </a>
          <button
            type="button"
            onClick={() => setGuideModalOpen(true)}
            className="au-card-link-item"
            title="How SEVA·GIS works (methodology & workflow)"
          >
            <BookOpen size={12} />
            <span>Methodology</span>
          </button>
          <a href="/faq.html" className="au-card-link-item" title="Frequently asked questions">
            <HelpCircle size={12} />
            <span>FAQ</span>
          </a>
          <a href="/ndvi-explained.html" className="au-card-link-item" title="NDVI Explained guide">
            <Sprout size={12} />
            <span>NDVI</span>
          </a>
        </div>
      </form>
    </div>

    {/* Dedicated Clockwise Parameter Diagram Section */}
    <section className="au-intents-section" aria-label="Domain Explorer & Clockwise Techniques" style={{ width: '100%', background: 'linear-gradient(180deg, rgba(2, 27, 17, 0.85) 0%, rgba(3, 18, 12, 0.95) 100%)', borderTop: '1px solid rgba(52, 211, 153, 0.2)', padding: '72px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 16px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(52, 211, 153, 0.4)', color: '#34d399', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            <Activity size={14} /> Comprehensive Geospatial Reverse Engineering
          </span>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: '#f8fafc', margin: '0 0 14px', letterSpacing: '-0.02em' }}>
            Domain Intelligence &amp; Clockwise Parameter Engine
          </h2>
          <p style={{ fontSize: 15.5, color: '#94a3b8', maxWidth: 740, margin: '0 auto', lineHeight: 1.6 }}>
            Select any spatial discipline below to inspect its clockwise analytical parameters, satellite band math, and autonomous reverse-engineered algorithms.
          </p>
        </div>

        {/* Domain Navigation Tabs */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
          {(Object.keys(DOMAIN_DATA) as (keyof typeof DOMAIN_DATA)[]).map(key => {
            const dom = DOMAIN_DATA[key]
            const isSel = selectedDomain === key
            const Icon = dom.icon
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedDomain(key)
                  setActiveTechniqueIndex(0)
                  setDispersionProgress(0)
                  setAutoClockwise(true)
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: isSel ? dom.color : 'rgba(255, 255, 255, 0.05)',
                  color: isSel ? '#041d13' : '#e2e8f0',
                  border: isSel ? `1.5px solid ${dom.color}` : '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: isSel ? `0 0 22px ${dom.color}66` : 'none',
                }}
              >
                <Icon size={16} />
                <span>{dom.name.split(' & ')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* Clockwise Cadence & Dispersion Control Strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24, padding: '12px 18px', borderRadius: 14, background: 'rgba(6, 22, 16, 0.82)', border: `1px solid ${currentDomain.color}44`, boxShadow: `0 8px 28px rgba(0,0,0,0.45), inset 0 0 20px ${currentDomain.color}14` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 999, background: `${currentDomain.color}24`, border: `1px solid ${currentDomain.color}77`, color: currentDomain.color, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em' }}>
              <Sparkles size={12} /> CLOCKWISE DISPERSION: 1 → 2 → 3 → 4 → 5 → 6 → 1
            </span>
            <span style={{ fontSize: 12.5, color: '#cbd5e1' }}>
              Active Discipline: <strong style={{ color: '#f8fafc' }}>{currentDomain.name}</strong> · Step <strong style={{ color: currentDomain.color }}>#{activeTechniqueIndex + 1} → #{((activeTechniqueIndex + 1) % 6) + 1}</strong> ({Math.round(dispersionProgress * 100)}%)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>Clockwise Speed:</span>
            {([1, 3, 5] as const).map(sec => {
              const activeSec = clockwiseCadenceSec === sec
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setClockwiseCadenceSec(sec)
                    setAutoClockwise(true)
                  }}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: activeSec ? currentDomain.color : 'rgba(255,255,255,0.06)',
                    color: activeSec ? '#041d13' : '#cbd5e1',
                    border: activeSec ? `1px solid ${currentDomain.color}` : '1px solid rgba(255,255,255,0.14)',
                    boxShadow: activeSec ? `0 0 14px ${currentDomain.color}55` : 'none',
                    transition: 'all 0.18s ease'
                  }}
                >
                  {sec}s / step
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setAutoClockwise(v => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                background: autoClockwise ? `${currentDomain.color}28` : 'rgba(239, 68, 68, 0.18)',
                color: autoClockwise ? currentDomain.color : '#fca5a5',
                border: `1px solid ${autoClockwise ? currentDomain.color : 'rgba(239, 68, 68, 0.45)'}`
              }}
            >
              <Play size={11} />
              {autoClockwise ? `Auto-Rotating (${clockwiseCadenceSec}s)` : 'Paused (Click to Resume)'}
            </button>
          </div>
        </div>

        {/* Interactive Clockwise Parameter Dispersion Engine */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 32, alignItems: 'center', background: 'radial-gradient(circle at 24% 45%, rgba(16, 185, 129, 0.09), rgba(4, 18, 13, 0.92) 72%)', border: `1px solid ${currentDomain.color}44`, borderRadius: 22, padding: '30px 28px', backdropFilter: 'blur(14px)', boxShadow: `0 22px 54px -16px rgba(0,0,0,0.7), inset 0 0 36px ${currentDomain.color}14` }}>
          {/* Circular Clockwise Dispersion Dial SVG */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 450, aspectRatio: '1/1', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 420 420" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <radialGradient id="dialGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={currentDomain.color} stopOpacity="0.42" />
                  <stop offset="55%" stopColor={currentDomain.color} stopOpacity="0.12" />
                  <stop offset="100%" stopColor={currentDomain.color} stopOpacity="0" />
                </radialGradient>
                <linearGradient id="clockwiseBeam" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="45%" stopColor={currentDomain.color} stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.25" />
                </linearGradient>
              </defs>

              {/* Ambient Core Nebula */}
              <circle cx="210" cy="210" r="175" fill="url(#dialGlow)" />

              {/* Multi-Wave Loading Dispersion Ripples Expanding from Center */}
              {[0, 0.33, 0.66].map((offset, rippleIdx) => {
                const wavePhase = (dispersionProgress + offset) % 1
                const waveRadius = 46 + wavePhase * 130
                const waveAlpha = Math.max(0, (1 - wavePhase) * 0.55)
                return (
                  <circle
                    key={`dispersion-wave-${rippleIdx}`}
                    cx="210"
                    cy="210"
                    r={waveRadius}
                    fill="none"
                    stroke={currentDomain.color}
                    strokeOpacity={waveAlpha}
                    strokeWidth={2 - wavePhase * 1.2}
                    strokeDasharray={rippleIdx === 1 ? '6 6' : 'none'}
                  />
                )
              })}

              {/* Outer Degree & Clock-Face Ring */}
              <circle cx="210" cy="210" r="192" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.2" />
              {Array.from({ length: 36 }).map((_, tick) => {
                const a = ((tick * 10 - 90) * Math.PI) / 180
                const isMajor = tick % 6 === 0
                const rInner = isMajor ? 182 : 186
                const rOuter = 192
                return (
                  <line
                    key={`tick-${tick}`}
                    x1={210 + rInner * Math.cos(a)}
                    y1={210 + rInner * Math.sin(a)}
                    x2={210 + rOuter * Math.cos(a)}
                    y2={210 + rOuter * Math.sin(a)}
                    stroke={isMajor ? currentDomain.color : 'rgba(255,255,255,0.16)'}
                    strokeWidth={isMajor ? 2.2 : 1}
                  />
                )
              })}

              {/* Orbit Track (Radius 148) */}
              <circle cx="210" cy="210" r="148" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" strokeDasharray="5 7" />

              {/* Clockwise Progress Arc Sweeping from 12:00 through Current Step + Live Sub-Step */}
              {(() => {
                const totalDeg = (activeTechniqueIndex + dispersionProgress) * 60
                const startRad = (-90 * Math.PI) / 180
                const endRad = ((totalDeg - 90) * Math.PI) / 180
                const r = 148
                const xStart = 210 + r * Math.cos(startRad)
                const yStart = 210 + r * Math.sin(startRad)
                const xEnd = 210 + r * Math.cos(endRad)
                const yEnd = 210 + r * Math.sin(endRad)
                const largeArc = totalDeg > 180 ? 1 : 0
                const d =
                  totalDeg >= 359.5
                    ? `M 210 ${210 - r} A ${r} ${r} 0 1 1 209.9 ${210 - r}`
                    : `M ${xStart} ${yStart} A ${r} ${r} 0 ${largeArc} 1 ${xEnd} ${yEnd}`
                return (
                  <>
                    <path
                      d={d}
                      fill="none"
                      stroke="url(#clockwiseBeam)"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      style={{ filter: `drop-shadow(0 0 10px ${currentDomain.color})` }}
                    />
                    {/* Traveling Dispersion Particle on Orbit Head */}
                    <circle
                      cx={xEnd}
                      cy={yEnd}
                      r={6.5}
                      fill="#ffffff"
                      stroke={currentDomain.color}
                      strokeWidth={3}
                      style={{ filter: `drop-shadow(0 0 12px ${currentDomain.color})` }}
                    />
                  </>
                )
              })()}

              {/* Connecting Spokes & Sweeping Clockwise Radar Beam */}
              {currentDomain.techniques.map((tech, idx) => {
                const angleDeg = idx * 60 - 90
                const rad = (angleDeg * Math.PI) / 180
                const x1 = 210 + 52 * Math.cos(rad)
                const y1 = 210 + 52 * Math.sin(rad)
                const x2 = 210 + 148 * Math.cos(rad)
                const y2 = 210 + 148 * Math.sin(rad)
                const isCurrent = activeTechniqueIndex === idx
                const isPassed = idx < activeTechniqueIndex
                return (
                  <line
                    key={tech.title}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isCurrent ? currentDomain.color : isPassed ? `${currentDomain.color}66` : 'rgba(255,255,255,0.15)'}
                    strokeWidth={isCurrent ? 3 : 1.2}
                    strokeDasharray={isCurrent ? 'none' : '3 4'}
                  />
                )
              })}

              {/* Continuous Sweeping Clockwise Hand */}
              {(() => {
                const beamDeg = (activeTechniqueIndex + dispersionProgress * 0.92) * 60 - 90
                const beamRad = (beamDeg * Math.PI) / 180
                const bx = 210 + 122 * Math.cos(beamRad)
                const by = 210 + 122 * Math.sin(beamRad)
                return (
                  <line
                    x1="210"
                    y1="210"
                    x2={bx}
                    y2={by}
                    stroke="url(#clockwiseBeam)"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                )
              })()}

              {/* Center Domain Hub */}
              <circle cx="210" cy="210" r="50" fill="#061912" stroke={currentDomain.color} strokeWidth="2.8" style={{ filter: `drop-shadow(0 0 18px ${currentDomain.color}66)` }} />
              <text x="210" y="198" textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="900" fontFamily="sans-serif">
                SEVA·GIS
              </text>
              <text x="210" y="213" textAnchor="middle" fill={currentDomain.color} fontSize="10" fontWeight="800" fontFamily="monospace">
                STEP #{activeTechniqueIndex + 1} / 6
              </text>
              <text x="210" y="226" textAnchor="middle" fill="#94a3b8" fontSize="8.5" fontWeight="700" fontFamily="sans-serif">
                ↻ {clockwiseCadenceSec}s CLOCKWISE
              </text>

              {/* 6 Clockwise Parameter Nodes (1 -> 2 -> 3 -> 4 -> 5 -> 6) */}
              {currentDomain.techniques.map((tech, idx) => {
                const angleDeg = idx * 60 - 90
                const rad = (angleDeg * Math.PI) / 180
                const cx = 210 + 148 * Math.cos(rad)
                const cy = 210 + 148 * Math.sin(rad)
                const isCurrent = activeTechniqueIndex === idx
                const isNext = (activeTechniqueIndex + 1) % 6 === idx
                const shortLabel = tech.title.split(' (')[0].slice(0, 16)

                return (
                  <g
                    key={tech.title}
                    onClick={() => {
                      setActiveTechniqueIndex(idx)
                      setDispersionProgress(0)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Active Node Expanding Dispersion Halo */}
                    {isCurrent && (
                      <>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={26 + dispersionProgress * 22}
                          fill="none"
                          stroke={currentDomain.color}
                          strokeOpacity={Math.max(0, 1 - dispersionProgress)}
                          strokeWidth={2.5}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={26 + ((dispersionProgress + 0.5) % 1) * 22}
                          fill="none"
                          stroke="#ffffff"
                          strokeOpacity={Math.max(0, 0.7 - ((dispersionProgress + 0.5) % 1) * 0.7)}
                          strokeWidth={1.5}
                        />
                      </>
                    )}

                    <circle
                      cx={cx}
                      cy={cy}
                      r={isCurrent ? 27 : isNext ? 22 : 19}
                      fill={isCurrent ? currentDomain.color : '#091e15'}
                      stroke={isCurrent ? '#ffffff' : isNext ? currentDomain.color : 'rgba(255,255,255,0.35)'}
                      strokeWidth={isCurrent ? 3 : isNext ? 2 : 1.5}
                      style={{ filter: isCurrent ? `drop-shadow(0 0 16px ${currentDomain.color})` : 'none', transition: 'r 0.25s ease' }}
                    />
                    <text
                      x={cx}
                      y={cy - 2}
                      textAnchor="middle"
                      fill={isCurrent ? '#041d13' : '#f8fafc'}
                      fontSize={isCurrent ? '13' : '11'}
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      {idx + 1}
                    </text>
                    <text
                      x={cx}
                      y={cy + 10}
                      textAnchor="middle"
                      fill={isCurrent ? '#06281b' : '#94a3b8'}
                      fontSize="7.5"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {tech.angle}
                    </text>

                    {/* Floating Pill Label Next to Node */}
                    <g transform={`translate(${cx}, ${cy + (cy >= 210 ? 38 : -34)})`}>
                      <rect
                        x="-58"
                        y="-10"
                        width="116"
                        height="19"
                        rx="9.5"
                        fill={isCurrent ? currentDomain.color : 'rgba(4, 18, 13, 0.9)'}
                        stroke={isCurrent ? '#ffffff' : `${currentDomain.color}66`}
                        strokeWidth={isCurrent ? 1.4 : 1}
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        fill={isCurrent ? '#041d13' : '#e2e8f0'}
                        fontSize="8.5"
                        fontWeight={isCurrent ? '900' : '700'}
                      >
                        {shortLabel}
                      </text>
                    </g>
                  </g>
                )
              })}
            </svg>

            {/* Live Linear Dispersion Wave Bar under Circular Dial */}
            <div style={{ width: '100%', maxWidth: 340, marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 5, fontWeight: 700 }}>
                <span>Clockwise Wave: Parameter #{activeTechniqueIndex + 1} → #{((activeTechniqueIndex + 1) % 6) + 1}</span>
                <span style={{ color: currentDomain.color }}>{Math.round(dispersionProgress * 100)}%</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${dispersionProgress * 100}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${currentDomain.color}, #38bdf8, #ffffff)`,
                    boxShadow: `0 0 12px ${currentDomain.color}`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Active Parameter Detail Card + 6-Step Clockwise Pipeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, background: currentDomain.bg, color: currentDomain.color, border: `1px solid ${currentDomain.border}`, padding: '4px 12px', borderRadius: 999 }}>
                ↻ Clockwise Position {currentTechnique.angle} · Parameter #{activeTechniqueIndex + 1} of 6
              </span>
              <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 700 }}>{currentDomain.tag}</span>
            </div>

            <h3 style={{ fontSize: 25, fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-0.01em' }}>
              #{activeTechniqueIndex + 1}. {currentTechnique.title}
            </h3>

            <p style={{ fontSize: 14.5, color: '#cbd5e1', lineHeight: 1.65, margin: 0 }}>
              {currentTechnique.desc}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 2 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: `1px solid ${currentDomain.color}33`, borderRadius: 12, padding: 14 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4, fontWeight: 700 }}>
                  Sensor / Platform Source
                </span>
                <b style={{ fontSize: 13.5, color: '#38bdf8' }}>{currentTechnique.sensor}</b>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: `1px solid ${currentDomain.color}33`, borderRadius: 12, padding: 14 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4, fontWeight: 700 }}>
                  Algorithm / Formula
                </span>
                <code style={{ fontSize: 12.5, color: currentDomain.color, fontFamily: 'monospace', fontWeight: 700 }}>{currentTechnique.formula}</code>
              </div>
            </div>

            {/* 6-Step Synchronized Clockwise Sequence Grid (1 -> 2 -> 3 -> 4 -> 5 -> 6) */}
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Live Clockwise Progression Sequence (1 → 2 → 3 → 4 → 5 → 6)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 8 }}>
                {currentDomain.techniques.map((t, i) => {
                  const isAct = activeTechniqueIndex === i
                  return (
                    <button
                      key={t.title}
                      type="button"
                      onClick={() => {
                        setActiveTechniqueIndex(i)
                        setDispersionProgress(0)
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '9px 11px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        background: isAct ? `${currentDomain.color}24` : 'rgba(255,255,255,0.03)',
                        color: isAct ? '#f8fafc' : '#94a3b8',
                        border: isAct ? `1.5px solid ${currentDomain.color}` : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: isAct ? `0 0 16px ${currentDomain.color}33` : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, fontWeight: 800, color: isAct ? currentDomain.color : '#64748b', marginBottom: 2 }}>
                        <span>STEP 0{i + 1} · {t.angle}</span>
                        <span>{isAct ? '● ACTIVE' : '↻'}</span>
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: isAct ? '#ffffff' : '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.title.split(' (')[0]}
                      </div>
                      {isAct && (
                        <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${dispersionProgress * 100}%`, background: currentDomain.color }} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Enriched 3-Step Production Workflow */}
    <section className="au-workflow-section" aria-label="3-Step Production Workflow" style={{ width: '100%', background: 'linear-gradient(180deg, rgba(4, 29, 19, 0.95) 0%, rgba(2, 20, 13, 0.98) 100%)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '72px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 16px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#34d399', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            <Zap size={14} /> Friction-Free Execution
          </span>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: '#f8fafc', margin: '0 0 14px', letterSpacing: '-0.02em' }}>
            From Area of Interest to Verified Reports in 3 Steps
          </h2>
          <p style={{ fontSize: 15.5, color: '#94a3b8', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
            Autonomous browser-native geospatial pipeline: zero backend latency, zero external API keys, zero tracking.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {/* Step 1 */}
          <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#10b981', lineHeight: 1, marginBottom: 14 }}>01</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', margin: '0 0 10px' }}>Draw or Ingest AOI</h3>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.65, margin: '0 0 14px' }}>
              Click directly on the high-res basemap to sketch parcel vertices, or upload standard GeoJSON, KML, or Shapefile boundaries. Geometric invariants validate ring closure, geodesic Vincenty area, and self-intersections.
            </p>
            <div style={{ fontSize: 11.5, color: '#6ee7b7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} /> RFC 7946 GeoJSON &amp; Shapefile Verification
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#06b6d4', lineHeight: 1, marginBottom: 14 }}>02</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', margin: '0 0 10px' }}>Stream Satellite &amp; Terrain</h3>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.65, margin: '0 0 14px' }}>
              Autonomous client-side queries stream Sentinel-2 L2A surface reflectance (B2–B12) and Copernicus DEM GLO-30. SCL scene classification discards cloud shadows automatically without manual preprocessing.
            </p>
            <div style={{ fontSize: 11.5, color: '#7dd3fc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} /> 10m Multi-Spectral &amp; 30m Elevation Ingestion
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: 16, padding: 28, position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#a855f7', lineHeight: 1, marginBottom: 14 }}>03</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', margin: '0 0 10px' }}>Inspect &amp; Auto-Sync</h3>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.65, margin: '0 0 14px' }}>
              Explore 30+ indices, D8 stream accumulation, and Fields2Cover tractor swaths. Export Float32 GeoTIFFs, 19X thesis cartography, Word/PDF dossiers, and auto-sync to your Google Drive Vault folder.
            </p>
            <div style={{ fontSize: 11.5, color: '#d8b4fe', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} /> Universal GeoTIFF, PDF, DOCX &amp; Cloud Drive Sync
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* In-App Google Sign-in & Drive Vault Modal */}
    {googleModalOpen && (
      <div className="modal-backdrop" onClick={() => setGoogleModalOpen(false)} style={{ zIndex: 1200 }}>
        <div
          className="modal"
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: 480,
            background: '#0d2218',
            border: '1.5px solid rgba(52, 211, 153, 0.4)',
            borderRadius: 16,
            padding: 28,
            boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
            color: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center' }}>
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Sign in with Google</h3>
                <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>Google Drive Vault &amp; Device Sync</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGoogleModalOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 18 }}>
            Connect your Google profile to automatically organize all exported GeoTIFFs, CartoMap PNGs, and dossiers into your Google Drive folder: <b>SEVA GIS</b>.
          </p>

          <form onSubmit={handleGoogleModalSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Enter your Google / Gmail Address:</span>
              <input
                type="email"
                value={googleModalEmail}
                onChange={e => setGoogleModalEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                required
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#06160e',
                  border: '1px solid rgba(52, 211, 153, 0.4)',
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </label>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button
                type="submit"
                disabled={busy}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  borderRadius: 8,
                  background: '#10b981',
                  color: '#041d13',
                  fontWeight: 800,
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {busy ? <LogoLoader inline size={16} text="Connecting..." /> : <><Check size={16} /> Sign in &amp; Activate Vault</>}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGoogleModalOpen(false)
                  void enterGuest()
                }}
                style={{
                  padding: '11px 16px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  fontWeight: 700,
                  fontSize: 13,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                }}
              >
                Guest Mode
              </button>
            </div>

            <small style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, textAlign: 'center', marginTop: 4 }}>
              Offline-ready guarantee: All files save directly to your device even if Google Drive is offline.
            </small>
          </form>
        </div>
      </div>
    )}

    {/* Full-width Knowledge Hub & Documentation Showcase below the fold */}
    <section className="au-hub" aria-label="Knowledge Hub and Documentation">
      <div className="au-hub-header">
        <span className="au-hub-tag">
          <ShieldCheck size={13} />
          Open Data &amp; Knowledge Base
        </span>
        <h2 className="au-hub-title">Everything you need to know about SEVA·GIS</h2>
        <p className="au-hub-desc">
          Transparent geospatial algorithms, open satellite pipelines, and clear agronomic guides. Zero tracking, zero hidden fees, and completely open source.
        </p>
      </div>

      <div className="au-hub-grid">
        {/* Card 1: Git Repository */}
        <div className="au-hub-card">
          <div>
            <div className="au-hub-card-head">
              <div className="au-hub-card-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/>
                </svg>
              </div>
              <span className="au-hub-card-badge">MIT License</span>
            </div>
            <h3>Open Source Codebase</h3>
            <p>
              Inspect the source code, run locally with Vite + React 19, or contribute improvements. Built entirely client-side with no central backend database.
            </p>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 12, color: '#b4c8b9', lineHeight: 1.6 }}>
              <li>100% open-source under permissive MIT license</li>
              <li>Zero backend tracking or central telemetry</li>
              <li>Inspect and audit satellite processing algorithms</li>
            </ul>
          </div>
          <div className="au-hub-card-foot">
            <span style={{ fontSize: 11, color: '#9fb5a5' }}>virahitvin8 / seva-gis</span>
            <a
              href="https://github.com/virahitvin8/seva-gis"
              target="_blank"
              rel="noreferrer"
              className="au-hub-card-btn"
            >
              <span>GitHub Repo</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Card 2: How It Works */}
        <div className="au-hub-card">
          <div>
            <div className="au-hub-card-head">
              <div className="au-hub-card-icon">
                <BookOpen size={22} />
              </div>
              <span className="au-hub-card-badge">Methodology</span>
            </div>
            <h3>How It Works Guide</h3>
            <p>
              Discover how SEVA.GIS queries Copernicus Sentinel-2 L2A tiles via Planetary Computer, removes cloud shadows, computes vegetation indices, and models yields.
            </p>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 12, color: '#b4c8b9', lineHeight: 1.6 }}>
              <li>Step-by-step farm boundary capture</li>
              <li>Sentinel-2 band math and 10 m raster grids</li>
              <li>Tractor swath routing &amp; field operation zones</li>
            </ul>
          </div>
          <div className="au-hub-card-foot">
            <span style={{ fontSize: 11, color: '#9fb5a5' }}>Scientific Thesis</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => setGuideModalOpen(true)}
                className="au-hub-card-btn"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title="Open interactive research methodology & flowchart"
              >
                <span>Read Guide</span>
                <Sparkles size={13} />
              </button>
              <a
                href="/how-it-works.html"
                target="_blank"
                rel="noreferrer"
                title="Open full web guide in new tab"
                style={{ color: '#9fb5a5', display: 'grid', placeItems: 'center', textDecoration: 'none' }}
              >
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>

        {/* Card 3: FAQ */}
        <div className="au-hub-card">
          <div>
            <div className="au-hub-card-head">
              <div className="au-hub-card-icon">
                <HelpCircle size={22} />
              </div>
              <span className="au-hub-card-badge">Questions</span>
            </div>
            <h3>Frequently Asked Questions</h3>
            <p>
              Common answers regarding satellite pass frequencies, 10-metre pixel resolution, cloud cover handling, local storage safety, and offline mobile PWA setup.
            </p>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 12, color: '#b4c8b9', lineHeight: 1.6 }}>
              <li>Why is it free forever with no API key?</li>
              <li>How your data remains on your device</li>
              <li>Multi-language support (English, Hindi, Telugu)</li>
            </ul>
          </div>
          <div className="au-hub-card-foot">
            <span style={{ fontSize: 11, color: '#9fb5a5' }}>9 Answered Questions</span>
            <a href="/faq.html" className="au-hub-card-btn">
              <span>View FAQs</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Card 4: NDVI Explained */}
        <div className="au-hub-card">
          <div>
            <div className="au-hub-card-head">
              <div className="au-hub-card-icon">
                <Sprout size={22} />
              </div>
              <span className="au-hub-card-badge">Agronomy</span>
            </div>
            <h3>NDVI Explained</h3>
            <p>
              Learn how plants absorb red light and reflect near-infrared light, how to translate colour maps into field walking points, and when to inspect moisture or nitrogen.
            </p>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 12, color: '#b4c8b9', lineHeight: 1.6 }}>
              <li>Understanding NDVI value ranges</li>
              <li>Differentiating soil, stress, and vigor</li>
              <li>Actionable field inspection checklist</li>
            </ul>
          </div>
          <div className="au-hub-card-foot">
            <span style={{ fontSize: 11, color: '#9fb5a5' }}>Agronomic Reference</span>
            <a href="/ndvi-explained.html" className="au-hub-card-btn">
              <span>Read Guide</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '36px auto 0', paddingTop: 20, borderTop: '1px solid #ffffff12', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#64748b' }}>
        <span>SEVA·GIS — Spatial Evaluation &amp; Vegetation Analytics</span>
        <div style={{ display: 'flex', gap: 16 }}>
          <a href="https://github.com/virahitvin8/seva-gis" target="_blank" rel="noreferrer" style={{ color: '#9fb5a5', textDecoration: 'none' }}>GitHub</a>
          <a href="/how-it-works.html" style={{ color: '#9fb5a5', textDecoration: 'none' }}>How it works</a>
          <a href="/faq.html" style={{ color: '#9fb5a5', textDecoration: 'none' }}>FAQ</a>
          <a href="/ndvi-explained.html" style={{ color: '#9fb5a5', textDecoration: 'none' }}>NDVI</a>
        </div>
      </div>
    </section>

    {guideModalOpen && <MethodologyModal onClose={() => setGuideModalOpen(false)} />}
  </div>
}
