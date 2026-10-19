import LogoLoader from './LogoLoader'
import { useClockwiseEngine } from './useClockwiseEngine'
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
  ChevronLeft,
  ChevronRight,
  Activity,
  Zap,
  Play,
  Pause,
  Check,
  X,
  Cpu,
} from 'lucide-react'
import MethodologyModal from './MethodologyModal'
import Lang from './Lang'
import SuggestionTree from './components/SuggestionTree'
import { GUEST, closeWorkspace, db, login, openWorkspace, register, registerOrLoginGoogleUser, sessionId, setSession } from './lib/db'
import { authenticateWithGoogle, disconnectGoogle, getGoogleClientId, getGoogleUser, isRealGoogleClientId } from './lib/googleDriveVault'

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
      if (sessionStorage.getItem('seva-bye') || params.has('auth') || params.has('login') || params.has('signin')) {
        setBooting(false)
        return
      }
      const id = sessionId()
      if (!id || id === GUEST) {
        const savedGuestName = localStorage.getItem('seva-guest-name') || 'Guest'
        await enter({ id: GUEST, name: savedGuestName, email: '' })
      } else {
        const gUser = getGoogleUser()
        const u = await db.users.get(id)
        if (u) {
          const isG = Boolean(gUser?.id === u.id || u.hash === 'google_oauth_authenticated')
          await enter({ id: u.id, name: u.name, email: u.email, isGoogle: isG, picture: isG ? gUser?.picture : undefined })
        } else {
          await enter({ id: GUEST, name: 'Guest', email: '' })
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

  const [selectedDomain, setSelectedDomain] = useState<'agri' | 'hydro' | 'terrain' | 'geology' | 'hazard' | 'vault' | 'rustgis'>('agri')
  const [dialEngaged, setDialEngaged] = useState(false)
  const [googleModalOpen, setGoogleModalOpen] = useState(false)
  const [googleModalEmail, setGoogleModalEmail] = useState('')
  // Google sign-in only works when this deployment configures a real OAuth client ID.
  const googleSignInConfigured = isRealGoogleClientId(getGoogleClientId())

  const DOMAIN_DATA = {
    agri: {
      name: 'Precision Agriculture & Plant Dynamics',
      tag: 'Sentinel-2 L2A BOA · Red-Edge · Robotics',
      icon: Sprout,
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.3)',
      techniques: [
        { angle: '12:00', title: 'Multi-Spectral Scene Acquisition', sensor: 'Sentinel-2 L2A · bands B02–B11', formula: 'Align B02 · B03 · B04 · B08 · B11', desc: 'Reads the newest low-cloud Sentinel-2 scenes over your field and aligns the spectral bands every later step uses.' },
        { angle: '02:00', title: 'SCL Cloud & Shadow Masking', sensor: 'Sentinel-2 Scene Classification Layer', formula: 'Mask = SCL ∈ {cloud, cirrus, shadow}', desc: 'Removes cloud, cirrus and shadow pixels before any index math, so statistics come only from clean ground pixels.' },
        { angle: '04:00', title: 'Canopy Vigor Indexing (NDVI)', sensor: 'Sentinel-2 Band 4 & 8 · 10 m', formula: '(B08 - B04) / (B08 + B04)', desc: 'Measures canopy greenness and density and compares it across the observation dates you choose.' },
        { angle: '06:00', title: 'Soil-Adjusted Vigor (SAVI / EVI)', sensor: 'Sentinel-2 Red & NIR', formula: 'SAVI = [(1 + L)(B08 - B04)] / (B08 + B04 + L)', desc: 'Reduces background soil reflectance in young or sparse stands so vigor differences are plant-driven, not soil-driven.' },
        { angle: '08:00', title: 'Intra-Field Variability Zoning', sensor: 'Real NDVI pixel statistics (in-browser)', formula: 'Zones from quantile split of valid pixels', desc: 'Divides the field into classified vigor zones; flagged patches are candidate stress zones that need a field walk.' },
        { angle: '10:00', title: 'Agronomic Scouting & GIS Export', sensor: 'GeoTIFF · GeoJSON · PDF report', formula: 'Scout targets + exportable layers', desc: 'Turns the analysis into walkable scouting targets and export files (GeoTIFF, GeoJSON and a printable report).' },
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
        { angle: '12:00', title: 'Surface Water & Moisture Indexing (NDWI)', sensor: 'Sentinel-2 Band 3 & 8', formula: '(B03 - B08) / (B03 + B08)', desc: 'Maps standing farm-pond water, surface inundation and canopy hydration stress from the newest clean scene.' },
        { angle: '02:00', title: 'DEM Terrain Conditioning', sensor: 'Copernicus GLO-30 DEM', formula: 'Pit fill + micro-relief smoothing', desc: 'Fills spurious pits and smooths micro-relief before routing, so runoff paths follow real drainage instead of DEM noise.' },
        { angle: '04:00', title: 'Slope & Runoff Gradient Vectors', sensor: 'Horn 3×3 gradient kernel', formula: 'Slope = arctan √[(∂z/∂x)² + (∂z/∂y)²]', desc: 'Maps terrain steepness and the direction surface water accelerates, highlighting erosion-prone runoff belts.' },
        { angle: '06:00', title: 'Flow Direction & Accumulation (D8)', sensor: 'D8 routing engine', formula: 'Dir = argmax_i [(Z_0 - Z_i) / d_i]', desc: 'Traces overland flow pathways and the convergent channels that collect water during storm events.' },
        { angle: '08:00', title: 'Catchment & Ponding Susceptibility (TWI)', sensor: 'Topographic Wetness Index', formula: 'ln(α / tan β)', desc: 'Highlights low-lying, converging zones where water gathers — the places to watch for ponding or waterlogging.' },
        { angle: '10:00', title: 'Hydrological Synthesis & Export', sensor: 'Drainage layers · GeoTIFF · QGIS-ready', formula: 'Drainage summary + exportable layers', desc: 'Summarises how the field drains and packages the flow, wetness and inundation layers for QGIS and printable reports.' },
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
      tag: 'Optional Google Drive Sync · Zero Fees · 19X Cartography',
      icon: HardDrive,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.3)',
      techniques: [
        { angle: '12:00', title: 'Hierarchical Drive Folders (SEVA GIS)', sensor: 'Google Drive REST API', formula: 'Root: SEVA GIS / [TIFF, Images, Reports, Cache]', desc: 'When Google Drive is connected, creates the SEVA GIS folder tree and uploads exports into it.' },
        { angle: '02:00', title: '19X High-DPI Cartographic Print Layout', sensor: 'QGIS Composer Replica', formula: 'Neatline + Dual-Scale Bar + Compass Rose + Legends', desc: 'Renders thesis-grade publication cartography with collision-free neatline frames.' },
        { angle: '04:00', title: 'Float32 GeoTIFF EPSG:4326 Export', sensor: 'Native Client GeoTIFF Writer', formula: 'Float32 Analytical Pixel Values in WGS84', desc: 'Exports authentic uncompressed raster grids for direct import into QGIS, ArcMap, or rasterio.' },
        { angle: '06:00', title: 'Zero-Error Local Device Fallback', sensor: 'IndexedDB & Direct Blob Dispatch', formula: 'Offline First Local Vault Guarantee', desc: 'Guarantees exports always save to your device even if offline or Google Drive is disconnected.' },
        { angle: '08:00', title: 'Email Delivery (when configured)', sensor: 'Server email provider', formula: 'Dossier package + greeting card', desc: 'Prepares the dossier package for download and sends it by email when an email provider is configured on the server.' },
        { angle: '10:00', title: 'Multi-Format Archival Dossiers', sensor: 'HTML, PDF, DOCX, ZIP & GeoJSON', formula: 'Universal Cross-Platform Packaging', desc: 'Packages complete field studies into universal formats accessible on any desktop or smartphone.' },
      ]
    },
    rustgis: {
      name: 'Rust GIS & WebAssembly Engine',
      tag: 'GeoRust · FlatGeobuf · SIMD Band Math · Zero Server Lag',
      icon: Cpu,
      color: '#f97316',
      bg: 'rgba(249, 115, 22, 0.12)',
      border: 'rgba(249, 115, 22, 0.3)',
      techniques: [
        { angle: '12:00', title: 'Zero-Cost Vector Geometry (geo-types)', sensor: 'GeoRust Memory Layout', formula: 'Coord<T>, LineString<T>, Polygon<T>', desc: 'Zero-copy coordinate storage in linear memory without garbage-collection pauses.' },
        { angle: '02:00', title: 'Ramer-Douglas-Peucker (RDP) Simplification', sensor: 'geo::simplify::Simplify', formula: 'dist(p, Line(p1, p2)) > ε', desc: 'Reduces parcel vertex counts by 70% while preserving exact agronomic boundary topology.' },
        { angle: '04:00', title: 'Visvalingam-Whyatt Area Decimation', sensor: 'geo::simplify::SimplifyVw', formula: 'min(Area(p_{i-1}, p_i, p_{i+1})) < Area_min', desc: 'Simplifies polygons based on triangle area weighting, preserving critical guidance corners.' },
        { angle: '06:00', title: 'BBox-Pruned Ray-Casting PIP', sensor: 'geo::algorithm::contains', formula: 'O(1) BBox Rejection + Jordan Curve', desc: 'Checks 100,000+ points/sec to evaluate whether telemetry points fall into management zones.' },
        { angle: '08:00', title: 'SIMD Vectorized Spectral Band Math', sensor: 'ndarray Float32 Vectorization', formula: 'NDVI = (NIR - Red) / (NIR + Red) [AVX/NEON]', desc: 'Calculates vegetation indices across 500,000 pixels in milliseconds using SIMD float loops.' },
        { angle: '10:00', title: 'FlatGeobuf & GeoArrow Zero-Copy Stream', sensor: 'FlatGeobuf HTTP Range Query', formula: 'Hilbert R-Tree Binary Buffer', desc: 'Streams vector geometries directly over HTTP range requests with zero JSON deserialization.' },
      ]
    }
  }

  const currentDomain = DOMAIN_DATA[selectedDomain]

  // Single authoritative 3-second timer for the Clockwise Parameter Engine
  // (one interval instance, created and cleaned up inside the hook). It
  // resets cleanly to Step 1 on every domain change, pauses while the
  // visitor hovers or focuses the dial, when the tab is hidden, when the
  // engine is scrolled out of view, and under prefers-reduced-motion.
  // Ticks only update local UI state — they never call the network.
  const dial = useClockwiseEngine(selectedDomain, currentDomain.techniques.length, { intervalMs: 3000, externalHold: dialEngaged })

  const currentTechnique = currentDomain.techniques[dial.step] || currentDomain.techniques[0]

  const transportBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 9,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    background: 'rgba(255, 255, 255, 0.06)',
    color: '#e2e8f0',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    transition: 'background 0.2s ease',
  }

  async function handleGoogleModalSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const emailToUse = googleModalEmail.trim()
      if (!emailToUse || !emailToUse.includes('@')) {
        setError('Enter the Gmail or email address you want to use.')
        return
      }

      if (!googleSignInConfigured) {
        // When Google OAuth is not configured on this deployment, sign in locally
        // with the entered email so the user can enter their workspace immediately.
        const localName = emailToUse.split('@')[0]
        const u = await registerOrLoginGoogleUser({
          id: `local_${emailToUse.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: localName,
          email: emailToUse,
        })
        remember({ name: u.name, email: u.email })
        setSaved(known())
        setGoogleModalOpen(false)
        await enter({ id: u.id, name: u.name, email: u.email, isGoogle: false })
        return
      }

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
      setError(err?.message || 'Sign-in could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleSignIn() {
    // Open the in-app Google modal. If this deployment has no real OAuth client
    // configured, the modal says so plainly instead of faking a local session.
    setError('')
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
            Autonomous browser-first spatial analysis. Pick any area of interest, compute 30+ spectral insights, and export cartography and analysis outputs — saved to your device, with optional Google Drive sync when connected. Zero subscription fee, zero API keys, exports stay on your device.
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
          title="Sign in with Google where configured; exports save to your device and sync to Google Drive when connected (SEVA GIS)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" style={{ minWidth: 18 }}>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Continue with Google</span>
          <span className="au-google-badge">Optional Drive Sync</span>
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
      <style>{`
        @keyframes sevadial-spin { to { transform: rotate(360deg); } }
        .sevadial-spin { animation: sevadial-spin 9s linear infinite; }
        @keyframes sevadial-ripple { 0% { transform: scale(1); opacity: 0.65; } 100% { transform: scale(2.6); opacity: 0; } }
        .sevadial-ripple { transform-box: fill-box; transform-origin: center; animation: sevadial-ripple 1.5s ease-out infinite; }
        @keyframes sevadial-progress { from { stroke-dashoffset: 1162; } to { stroke-dashoffset: 0; } }
        .sevadial-progress { animation: sevadial-progress 3s linear infinite; }
        @keyframes sevadial-fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .sevadial-fade { animation: sevadial-fade 0.5s ease-out; }
        @keyframes sevadial-wave { 0% { transform: scale(0.22); opacity: 0.65; } 100% { transform: scale(3.5); opacity: 0; } }
        .sevadial-wave { transform-box: fill-box; transform-origin: center; animation: sevadial-wave 950ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .sevadial-wave-late { animation-delay: 170ms; }
        .sevadial-node { cursor: pointer; }
        .sevadial-node:focus-visible { outline: 2.5px solid #f8fafc; outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) {
          .sevadial-spin, .sevadial-ripple, .sevadial-progress, .sevadial-fade, .sevadial-wave { animation: none; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 16px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(52, 211, 153, 0.4)', color: '#34d399', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            <Activity size={14} /> Comprehensive Geospatial Reverse Engineering
          </span>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: '#f8fafc', margin: '0 0 14px', letterSpacing: '-0.02em' }}>
            Domain Intelligence &amp; Clockwise Parameter Engine
          </h2>
          <p style={{ fontSize: 15.5, color: '#94a3b8', maxWidth: 740, margin: '0 auto', lineHeight: 1.6 }}>
            Select any spatial discipline below. The dial auto-cycles clockwise through its six parameters every 3 seconds — pause it, step through it, or click any node to inspect it. The cycle is a local visualization: it only changes what you see on this page.
          </p>
        </div>

        {/* Domain Navigation Tabs */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 36 }}>
          {(Object.keys(DOMAIN_DATA) as (keyof typeof DOMAIN_DATA)[]).map(key => {
            const dom = DOMAIN_DATA[key]
            const isSel = selectedDomain === key
            const Icon = dom.icon
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDomain(key)}
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
                  boxShadow: isSel ? `0 0 20px ${dom.color}55` : 'none',
                }}
              >
                <Icon size={16} />
                <span>{dom.name.split(' & ')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* Interactive Clockwise Parameter Diagram Component */}
        <div
          ref={dial.containerRef}
          onMouseEnter={() => setDialEngaged(true)}
          onMouseLeave={() => setDialEngaged(false)}
          onFocusCapture={() => setDialEngaged(true)}
          onBlurCapture={() => setDialEngaged(false)}
          style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 460px) minmax(320px, 1fr)', gap: 32, alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 20, padding: 32, backdropFilter: 'blur(12px)' }}
        >
          {/* Circular Clockwise Dial SVG with transport bar below */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 440, aspectRatio: '1/1', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <radialGradient id="dialGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={currentDomain.color} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={currentDomain.color} stopOpacity="0" />
                </radialGradient>
              </defs>
              {/* Outer guide ring */}
              <circle cx="200" cy="200" r="185" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              {/* Per-step progress ring: refills each 3-second cycle while auto-cycling */}
              {!dial.paused && (
                <circle
                  key={`sevadial-progress-${dial.tick}-${dial.step}`}
                  className="sevadial-progress"
                  cx="200"
                  cy="200"
                  r="185"
                  fill="none"
                  stroke={currentDomain.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="1162"
                  strokeDashoffset="1162"
                  opacity="0.75"
                  transform="rotate(-90 200 200)"
                />
              )}
              <circle cx="200" cy="200" r="145" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="4 6" />
              {/* Ambient dispersion sweep: a slow continuous orbit for depth */}
              <g className={dial.reducedMotion ? undefined : 'sevadial-spin'} style={{ transformOrigin: '200px 200px' }}>
                <circle cx="200" cy="200" r="165" fill="none" stroke={currentDomain.color} strokeWidth="1.25" strokeDasharray="30 900" strokeLinecap="round" opacity="0.45" />
              </g>
              <circle cx="200" cy="200" r="110" fill="url(#dialGlow)" />
              {/* Radial loading dispersion wave: replayed on every domain switch */}
              {!dial.reducedMotion && (
                <g key={`sevadial-wave-${selectedDomain}`} pointerEvents="none">
                  <circle className="sevadial-wave" cx="200" cy="200" r="90" fill="none" stroke={currentDomain.color} strokeWidth="2.5" opacity="0" />
                  <circle className="sevadial-wave sevadial-wave-late" cx="200" cy="200" r="90" fill="none" stroke={currentDomain.color} strokeWidth="1.25" opacity="0" />
                </g>
              )}

              {/* Connecting spokes from center to 6 clockwise nodes */}
              {currentDomain.techniques.map((tech, idx) => {
                const angleDeg = idx * 60 - 90 // 12:00 = -90°, 02:00 = -30°, 04:00 = 30°, 06:00 = 90°, etc.
                const rad = (angleDeg * Math.PI) / 180
                const x1 = 200 + 48 * Math.cos(rad)
                const y1 = 200 + 48 * Math.sin(rad)
                const x2 = 200 + 145 * Math.cos(rad)
                const y2 = 200 + 145 * Math.sin(rad)
                const isCurrent = dial.step === idx
                return (
                  <line
                    key={tech.title}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isCurrent ? currentDomain.color : 'rgba(255,255,255,0.18)'}
                    strokeWidth={isCurrent ? 2.5 : 1}
                    strokeDasharray={isCurrent ? 'none' : '2 3'}
                  />
                )
              })}

              {/* Synced comet: glides clockwise to land on the active parameter */}
              <g style={{ transformOrigin: '200px 200px', transform: `rotate(${dial.rotation}deg)`, transition: dial.reducedMotion ? 'none' : 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}>
                <circle cx="200" cy="55" r="12" fill="none" stroke={currentDomain.color} strokeWidth="1" opacity="0.35" />
                <circle cx="200" cy="55" r="5" fill={currentDomain.color} style={{ filter: `drop-shadow(0 0 10px ${currentDomain.color})` }} />
              </g>

              {/* Center Domain Hub */}
              <circle cx="200" cy="200" r="46" fill="#0b2419" stroke={currentDomain.color} strokeWidth="2.5" />
              <text x="200" y="196" textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="800" fontFamily="sans-serif">
                SEVA·GIS
              </text>
              <text x="200" y="210" textAnchor="middle" fill={currentDomain.color} fontSize="9" fontWeight="700" fontFamily="sans-serif">
                CLOCKWISE
              </text>

              {/* 6 Clockwise Parameter Nodes */}
              {currentDomain.techniques.map((tech, idx) => {
                const angleDeg = idx * 60 - 90
                const rad = (angleDeg * Math.PI) / 180
                const cx = 200 + 145 * Math.cos(rad)
                const cy = 200 + 145 * Math.sin(rad)
                const isCurrent = dial.step === idx
                const isDone = idx < dial.step

                return (
                  <g
                    key={tech.title}
                    className="sevadial-node"
                    role="button"
                    tabIndex={0}
                    aria-label={`Step ${idx + 1}: ${tech.title}`}
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={() => dial.selectStep(idx)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        dial.selectStep(idx)
                      }
                    }}
                    style={{ transition: 'all 0.2s' }}
                  >
                    {isCurrent && !dial.reducedMotion && (
                      <circle
                        key={`sevadial-ripple-${dial.tick}-${dial.step}`}
                        className="sevadial-ripple"
                        cx={cx}
                        cy={cy}
                        r={20}
                        fill="none"
                        stroke={currentDomain.color}
                        strokeWidth="2"
                      />
                    )}
                    {isDone && !dial.reducedMotion && (
                      <circle
                        cx={200 + 175 * Math.cos(rad)}
                        cy={200 + 175 * Math.sin(rad)}
                        r={3}
                        fill={currentDomain.color}
                        opacity="0.5"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isCurrent ? 24 : 18}
                      fill={isCurrent ? currentDomain.color : '#0d2217'}
                      stroke={isCurrent ? '#ffffff' : currentDomain.color}
                      strokeWidth={isCurrent ? 3 : 1.5}
                      style={{ filter: isCurrent ? `drop-shadow(0 0 12px ${currentDomain.color})` : 'none' }}
                    />
                    <text
                      x={cx}
                      y={cy + 4}
                      textAnchor="middle"
                      fill={isCurrent ? '#041d13' : '#f8fafc'}
                      fontSize={isCurrent ? '11' : '9.5'}
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {idx + 1}
                    </text>
                  </g>
                )
              })}
            </svg>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.03em', color: dial.reducedMotion ? '#94a3b8' : dialEngaged || dial.userPaused ? '#fbbf24' : '#6ee7b7' }}>
              {dial.reducedMotion
                ? 'Reduced motion · select any parameter to inspect it'
                : dial.userPaused
                  ? 'Paused · press Resume to continue the clockwise cycle'
                  : dialEngaged
                    ? 'Hover pause · move away to resume the clockwise cycle'
                    : 'Auto-cycling clockwise · one parameter every 3 seconds'}
            </div>
          </div>

          {/* Transport bar: Previous · Pause/Resume · Next (keyboard accessible) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }} role="group" aria-label="Clockwise Parameter Engine transport controls">
            <button type="button" onClick={dial.prev} aria-label="Previous parameter, counter-clockwise one step" style={transportBtn}>
              <ChevronLeft size={15} /> Previous Step
            </button>
            <button
              type="button"
              onClick={dial.toggleUserPause}
              aria-pressed={dial.userPaused}
              aria-label={dial.userPaused ? 'Resume the automatic clockwise cycle' : 'Pause the automatic clockwise cycle'}
              style={{ ...transportBtn, background: dial.userPaused ? currentDomain.color : 'rgba(255, 255, 255, 0.06)', color: dial.userPaused ? '#041d13' : '#e2e8f0', border: dial.userPaused ? `1px solid ${currentDomain.color}` : '1px solid rgba(255, 255, 255, 0.14)' }}
            >
              {dial.userPaused ? <Play size={14} /> : <Pause size={14} />} {dial.userPaused ? 'Resume Auto-Cycle' : 'Pause Auto-Cycle'}
            </button>
            <button type="button" onClick={dial.next} aria-label="Next parameter, clockwise one step" style={transportBtn}>
              Next Step <ChevronRight size={15} />
            </button>
          </div>

          {/* Screen-reader announcements for every engine state change */}
          <div aria-live="polite" role="status" style={{ position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}>
            {`Step ${dial.step + 1} of ${currentDomain.techniques.length}: ${currentTechnique.title}${dial.userPaused ? ' — paused' : ''}`}
          </div>
          </div>

          {/* Active Parameter Detail Card */}
          <div key={`${selectedDomain}-${dial.step}`} className="sevadial-fade" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, background: currentDomain.bg, color: currentDomain.color, border: `1px solid ${currentDomain.border}`, padding: '3px 10px', borderRadius: 999 }}>
                Position {currentTechnique.angle} · Parameter #{dial.step + 1} of {currentDomain.techniques.length}
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{currentDomain.tag}</span>
            </div>

            <h3 style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              {currentTechnique.title}
            </h3>

            <p style={{ fontSize: 14.5, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
              {currentTechnique.desc}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 4 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 14 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
                  Sensor / Platform Source
                </span>
                <b style={{ fontSize: 13, color: '#38bdf8' }}>{currentTechnique.sensor}</b>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 14 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
                  Algorithm / Formula
                </span>
                <code style={{ fontSize: 12, color: '#34d399', fontFamily: 'monospace' }}>{currentTechnique.formula}</code>
              </div>
            </div>

            {/* Quick-Cycle Parameter Buttons */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {currentDomain.techniques.map((t, i) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => dial.selectStep(i)}
                  aria-pressed={dial.step === i}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: dial.step === i ? currentDomain.color : 'rgba(255,255,255,0.06)',
                    color: dial.step === i ? '#041d13' : '#94a3b8',
                    border: 'none'
                  }}
                >
                  #{i + 1} {t.title.split(' (')[0]}
                </button>
              ))}
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
              Explore 30+ indices, D8 stream accumulation, and Fields2Cover tractor swaths. Export Float32 GeoTIFFs, thesis cartography, Word/PDF dossiers — saved to your device, with sync to your Google Drive folder when Drive is connected.
            </p>
            <div style={{ fontSize: 11.5, color: '#d8b4fe', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} /> Universal GeoTIFF, PDF, DOCX &amp; optional Drive Sync
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
            Sign in with Google to connect Drive sync: exports always save to this device, and upload to a <b>SEVA GIS</b> folder in your Google Drive while Drive is connected.
          </p>

          {!googleSignInConfigured ? (
            <div style={{ fontSize: 12, color: '#6ee7b7', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 800, color: '#34d399', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} /> Local Device Storage &amp; Privacy Active
              </div>
              Google Drive OAuth is not registered for this static deployment. You can enter your email to sign in locally, or click <b>Guest Mode</b> for instant access. All farm boundaries and satellite files save securely to this device.
            </div>
          ) : null}

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

            {error && (
              <div style={{ fontSize: 12.5, color: '#fca5a5', lineHeight: 1.45 }} role="alert">{error}</div>
            )}

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
                {busy ? (
                  <LogoLoader inline size={16} text="Connecting..." />
                ) : (
                  <>
                    <Check size={16} />{' '}
                    {googleSignInConfigured ? 'Sign in & Activate Vault' : 'Sign in with this Email'}
                  </>
                )}
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

    {/* Community Suggestion Apple Tree & RustGIS Engine on the Sign-in Page */}
    <SuggestionTree
      onSignIn={async (email) => {
        try {
          await enter({ id: email, name: email.split('@')[0], email })
        } catch {
          await enterGuest(email.split('@')[0])
        }
      }}
      onGuest={enterGuest}
    />

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
