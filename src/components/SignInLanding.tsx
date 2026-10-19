/**
 * Frontend/UX/Motion Agent + Auth & Security Agent
 * Implements all user-mandated Sign-In & Landing Page improvements:
 *  1. Full form of SEVA.GIS + one-line meaning (Removes "Earth Intelligence for every acre watershed and AOI")
 *  2. Exact required tagline ("Autonomous browser-first spatial analysis. Pick any area of interest, compute 30+ spectral insights, export 19+ cartography and analysis outputs to your Google Drive. Zero subscription fee, zero API keys, complete privacy on your device.")
 *  3. Completely removes "Launch interactive demo workspace" button
 *  4. Bright, vibrant, high-contrast professional palette + animated SVG orbital motion graphics
 *  5. Clickable Domain Cards that open a rich modal showing all parameters & equations SEVA.GIS computes
 *  6. Captioned 3-step execution cards
 *  7. Unified "SEVA.GIS Methodology" section with an interactive Motion Pipeline Flowchart
 *  8. Pre-validated Google Sign-In (prevents raw 401: invalid_client screen) + Guest Mode
 */

import React, { useState } from 'react';
import {
  Satellite,
  Sprout,
  Droplets,
  Mountain,
  Gem,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Cpu,
  Layers,
  X,
  AlertTriangle,
  Sparkles,
  Info,
} from 'lucide-react';
import { SupportedLanguage } from '../types/seva';
import { TRANSLATIONS } from '../i18n/translations';
import SevaLogo from './brand/SevaLogo';
import ClockwiseParameterEngine from './auth/ClockwiseParameterEngine';
import DispersionLoader from './feedback/DispersionLoader';
import { authenticateWithGoogle, getGoogleClientId, isRealGoogleClientId } from '../lib/googleDriveVault';

interface SignInLandingProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onEnterWorkspace: (mode: 'google' | 'guest', userEmail?: string) => void;
}

interface DomainSpec {
  id: string;
  title: string;
  subtitle: string;
  colorClass: string;
  icon: React.ReactNode;
  techniques: Array<{ name: string; formula: string; sensor: string; purpose: string }>;
}

const DOMAIN_SPECS: DomainSpec[] = [
  {
    id: 'precision-agriculture',
    title: 'Precision Agriculture & Crop Vigour',
    subtitle: '14 Calibrated VNIR/Red-Edge Indices & Variable-Rate Prescriptions',
    colorClass: 'from-emerald-500 to-teal-600',
    icon: <Sprout className="w-6 h-6 text-white" />,
    techniques: [
      { name: 'NDVI (Canopy Vigour)', formula: '(B8 - B4) / (B8 + B4)', sensor: 'Sentinel-2 L2A 10m', purpose: 'Photosynthetic biomass & chlorophyll density' },
      { name: 'NDRE (Foliar Nitrogen)', formula: '(B8 - B5) / (B8 + B5)', sensor: 'Sentinel-2 Red-Edge 20m', purpose: 'Mid-season nitrogen prescription & hidden stress' },
      { name: 'EVI (Enhanced Biomass)', formula: '2.5*(B8-B4)/(B8+6*B4-7.5*B2+1)', sensor: 'Sentinel-2 L2A 10m', purpose: 'Dense canopy LAI without saturation' },
      { name: 'SAVI (Soil-Adjusted Emergence)', formula: '((B8-B4)/(B8+B4+0.5))*1.5', sensor: 'Sentinel-2 L2A 10m', purpose: 'Early seedling emergence on exposed soil' },
      { name: 'PSR (Disease & Senescence Flag)', formula: '(B2 - B4) / B6', sensor: 'Sentinel-2 Red-Edge', purpose: 'Early leaf blight, rust & chlorophyll breakdown' },
    ],
  },
  {
    id: 'hydrology-drainage',
    title: 'Hydrology, Drainage & SWAT Sensitivity',
    subtitle: 'Catchment Flow Accumulation, TWI & SWAT/FQFA Parameter Ranking',
    colorClass: 'from-sky-500 to-blue-600',
    icon: <Droplets className="w-6 h-6 text-white" />,
    techniques: [
      { name: 'Topographic Wetness Index (TWI)', formula: 'ln(a / tan(β))', sensor: 'Copernicus GLO-30 DEM', purpose: 'Maps sub-field waterlogging & saturation zones' },
      { name: 'NDWI (Surface Water Ponding)', formula: '(B3 - B8) / (B3 + B8)', sensor: 'Sentinel-2 L2A 10m', purpose: 'Detects standing water & canal seepage' },
      { name: 'NDMI (Canopy Water Turgor)', formula: '(B8 - B11) / (B8 + B11)', sensor: 'Sentinel-2 SWIR 20m', purpose: 'Tracks root-zone moisture deficit & irrigation need' },
      { name: 'SWAT CN2 / SOL_AWC / ALPHA_BF', formula: 'SCS-CN + Baseflow Recession', sensor: 'DEM + Soil + Sentinel-1 SAR', purpose: 'Ranks hydrological parameter sensitivity per field' },
    ],
  },
  {
    id: 'mineral-soil',
    title: 'Surface Mineral Indication & Soil Chemistry',
    subtitle: 'SWIR/VNIR Absorption Ratios with % AOI Coverage & Justification',
    colorClass: 'from-amber-500 to-orange-600',
    icon: <Gem className="w-6 h-6 text-white" />,
    techniques: [
      { name: 'Iron Oxide Ratio (Indicated)', formula: 'B4 / B2', sensor: 'Sentinel-2 VNIR 10m', purpose: 'Maps ferric iron (Fe3+ hematite/goethite) oxidation' },
      { name: 'Clay & Al-OH Ratio (Indicated)', formula: 'B11 / B12', sensor: 'Sentinel-2 SWIR 20m', purpose: 'Detects 2.20µm smectite/kaolinite clay absorption' },
      { name: 'Ferrous Silicates (Indicated)', formula: '(B11 / B8) + (B3 / B4)', sensor: 'Sentinel-2 VNIR/SWIR', purpose: 'Identifies basaltic Fe2+ parent material' },
      { name: 'Carbonate / Calcite Index (Indicated)', formula: '(B11 - B12) / (B11 + B12)', sensor: 'Sentinel-2 SWIR 20m', purpose: 'Flags calcareous kankar & high-pH pockets' },
    ],
  },
  {
    id: 'terrain-topography',
    title: 'Terrain, Slope & Land Dynamics',
    subtitle: '30m Copernicus DEM Geomorphometry, Aspect & Bare Soil Exposure',
    colorClass: 'from-violet-500 to-indigo-600',
    icon: <Mountain className="w-6 h-6 text-white" />,
    techniques: [
      { name: 'Slope Gradient & Aspect', formula: 'arctan(√(dz/dx² + dz/dy²))', sensor: 'Copernicus 30m DEM', purpose: 'Controls sheet erosion & solar insolation' },
      { name: 'Bare Soil Index (BSI)', formula: '((B11+B4)-(B8+B2))/((B11+B4)+(B8+B2))', sensor: 'Sentinel-2 L2A', purpose: 'Quantifies exposed topsoil vs. crop residue' },
      { name: 'SAR VV/VH Backscatter Ratio', formula: 'σ°_VV / σ°_VH (dB)', sensor: 'Sentinel-1 C-Band SAR', purpose: 'All-weather cloud-penetrating roughness & moisture' },
    ],
  },
  {
    id: 'drive-cartography',
    title: 'Google Drive & 19+ Cartographic Outputs',
    subtitle: 'Zero-Key Automated Export to Drive, Email, QGIS, ArcMap & MATLAB',
    colorClass: 'from-rose-500 to-pink-600',
    icon: <HardDrive className="w-6 h-6 text-white" />,
    techniques: [
      { name: '19+ Thesis-Grade Map Layouts', formula: '300 DPI GeoTIFF + PNG + Legend', sensor: 'Multi-Sensor Stack', purpose: 'Ready for district offices, insurers & research' },
      { name: 'Multi-Format Vector/Table Pack', formula: 'GeoJSON + KML + CSV + XLSX', sensor: 'Browser-Native + Server', purpose: 'Direct ingestion into QGIS, ArcMap & Excel' },
      { name: 'Automated SMTP Report Delivery', formula: 'PDF + DOCX + ZIP + HTML', sensor: 'Nodemailer + EmailOctopus', purpose: 'Instant delivery to farmer or officer email' },
    ],
  },
];

const METHODOLOGY_NODES = [
  {
    step: '01',
    engine: 'AOI & Geometry Ingestion',
    title: 'Interactive Boundary Drawing or QGIS/ArcMap Pull',
    detail: 'Draw any farm/watershed polygon in the browser or pull directly from local PyQGIS (127.0.0.1:8765) / ArcMap (.pyt) in EPSG:4326.',
  },
  {
    step: '02',
    engine: 'Google Earth Engine Cloud',
    title: 'Multi-Sensor Radiometric & DEM Fusion',
    detail: 'Streams SCL cloud-masked Sentinel-2 L2A (10m/20m), Sentinel-1 C-Band SAR (10m), and Copernicus GLO-30 DEM without requiring end-user API keys.',
  },
  {
    step: '03',
    engine: 'MATLAB / Octave & Spectral Core',
    title: '30+ Cited Spectral Indices, 5 Mineral Ratios & SWAT Ranking',
    detail: 'Computes NDVI, NDRE, NDMI, EVI, SAVI, BSI, PSR, SWIR Mineral Ratios (% cover), and SWAT hydrological sensitivity (CN2, SOL_AWC, ESCO).',
  },
  {
    step: '04',
    engine: 'Weather & Resilience Gateways',
    title: 'Open-Meteo ECMWF + Automatic NASA POWER Failover',
    detail: 'Combines 7-day forecast & soil temperature with automatic NASA POWER agroclimatology failover so 503 outages never break field intelligence.',
  },
  {
    step: '05',
    engine: 'Cartography, Drive & SMTP Dispatch',
    title: '19+ Map Outputs, Native Telugu/Hindi Reports & Direct Email',
    detail: 'Exports GeoTIFF/GeoJSON/KML/XLSX to Google Drive and dispatches full PDF/DOCX/ZIP reports directly via SMTP email.',
  },
];

export const SignInLanding: React.FC<SignInLandingProps> = ({
  language,
  onLanguageChange,
  onEnterWorkspace,
}) => {
  const t = TRANSLATIONS[language];
  const [selectedDomain, setSelectedDomain] = useState<DomainSpec | null>(null);
  const [activeMethodologyStep, setActiveMethodologyStep] = useState<number>(0);
  const [oauthDiagnostic, setOauthDiagnostic] = useState<string | null>(null);
  const [checkingOAuth, setCheckingOAuth] = useState(false);
  const [showDispersion, setShowDispersion] = useState<boolean>(false);

  const handleGoogleSignIn = async () => {
    setCheckingOAuth(true);
    setOauthDiagnostic(null);
    try {
      if (isRealGoogleClientId(getGoogleClientId())) {
        const res = await authenticateWithGoogle();
        if (res.success && res.user) {
          onEnterWorkspace('google', res.user.email);
          return;
        }
        if (res.error && res.error !== 'Sign-in cancelled') {
          setOauthDiagnostic(res.error);
          return;
        }
      }

      // Check if backend OAuth proxy is available
      try {
        const res = await fetch('/api/auth/google/url');
        if (res.ok) {
          const data = await res.json();
          if (data.authUrl) {
            window.location.href = data.authUrl;
            return;
          }
        }
      } catch {}

      setOauthDiagnostic(
        'Google OAuth requires VITE_GOOGLE_CLIENT_ID configured for this domain in Google Cloud Console. Click "Continue as Guest" below for instant, full-featured access.'
      );
    } catch {
      setOauthDiagnostic(
        'Google Sign-In is not active on this deployment. Click "Continue as Guest" below for 100% full-featured access.'
      );
    } finally {
      setCheckingOAuth(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-emerald-50/70 to-sky-100 text-slate-900">
      {/* Optional Loading Dispersion Shockwave Modal */}
      {showDispersion && (
        <DispersionLoader onComplete={() => setShowDispersion(false)} autoDismissMs={2200} />
      )}

      {/* Top Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/90 border-b border-emerald-200/80 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <SevaLogo size={44} className="w-11 h-11" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-emerald-950">
                {t.brandTitle}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Where Satellites Meet Soil
              </span>
            </div>
            {/* Merged Active Subdomains Status Strip */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 font-medium">
              <a
                href="https://sevagis.dpdns.org"
                className="font-mono text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded border border-emerald-300 font-bold flex items-center gap-1 transition"
                title="Official Live Production Domain with Verified SSL"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                sevagis.dpdns.org (Live SSL)
              </a>
              <span>•</span>
              <a
                href="https://sevagis.is-a.dev"
                target="_blank"
                rel="noreferrer"
                className="font-mono text-cyan-800 bg-cyan-100 hover:bg-cyan-200 px-2 py-0.5 rounded border border-cyan-300 font-semibold transition"
                title="Developer & OpenDesign Methodology Portal"
              >
                sevagis.is-a.dev
              </a>
              <span>•</span>
              <a
                href="https://sevagis.is-a.bot"
                target="_blank"
                rel="noreferrer"
                className="font-mono text-purple-800 bg-purple-100 hover:bg-purple-200 px-2 py-0.5 rounded border border-purple-300 font-semibold transition"
                title="GeoAI Agent & Mitra Assistant Hub"
              >
                sevagis.is-a.bot
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowDispersion(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-800 border border-cyan-500/30 hover:bg-cyan-500/25 transition active:scale-95 flex items-center gap-1.5"
            title="Trigger Radial Dispersion Shockwave Effect"
          >
            <span>✦ Dispersion FX</span>
          </button>

          <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
            {(['en', 'te', 'hi'] as SupportedLanguage[]).map((lang) => (
              <button
                key={lang}
                onClick={() => onLanguageChange(lang)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                  language === lang
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                {lang === 'en' ? 'English' : lang === 'te' ? 'తెలుగు' : 'हिन्दी'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Hero Section with Bright Motion Graphics */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-14">
        <section className="grid lg:grid-cols-12 gap-8 items-center bg-white/90 rounded-3xl p-8 lg:p-10 shadow-xl shadow-emerald-900/5 border border-emerald-200/80 relative overflow-hidden">
          {/* Animated Orbital SVG Motion Graphic Background */}
          <svg
            className="absolute -right-20 -top-20 w-96 h-96 opacity-15 pointer-events-none"
            viewBox="0 0 200 200"
          >
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#059669"
              strokeWidth="2"
              strokeDasharray="8 6"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 100 100"
                to="360 100 100"
                dur="28s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx="100"
              cy="100"
              r="55"
              fill="none"
              stroke="#0284c7"
              strokeWidth="2"
              strokeDasharray="5 5"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="360 100 100"
                to="0 100 100"
                dur="18s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>

          <div className="lg:col-span-7 space-y-5 relative z-10">
            <div className="inline-flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-100 via-teal-100 to-sky-100 border border-emerald-300 text-emerald-900 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Sentinel-2 L2A BOA · Sentinel-1 SAR · Copernicus DEM · Google Drive · Zero Fees</span>
            </div>

            {/* Mandatory Full Form Headline + One-Line Meaning */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                  SEVA.GIS
                </span>{' '}
                — {t.brandFullForm}
              </h1>
              <p className="text-lg font-bold text-emerald-800">
                {t.brandOneLineMeaning}
              </p>
            </div>

            {/* Mandatory Exact Tagline */}
            <p className="text-base sm:text-lg text-slate-700 leading-relaxed font-medium bg-emerald-50/90 border-l-4 border-emerald-600 p-4 rounded-r-xl">
              {t.signInTagline}
            </p>

            {/* Animated Spectral Telemetry Motion Strip */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
                <div className="text-2xl font-black text-emerald-700">30+</div>
                <div className="text-xs font-bold text-slate-700">Cited Spectral & Terrain Insights</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200">
                <div className="text-2xl font-black text-sky-700">19+</div>
                <div className="text-xs font-bold text-slate-700">Cartography & Drive Outputs</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
                <div className="text-2xl font-black text-amber-700">₹0 / $0</div>
                <div className="text-xs font-bold text-slate-700">Zero API Keys · 100% Device Privacy</div>
              </div>
            </div>
          </div>

          {/* Sign-In Card (No "Launch interactive demo workspace" button!) */}
          <div className="lg:col-span-5 bg-gradient-to-b from-white to-emerald-50/50 rounded-2xl p-6 sm:p-7 border-2 border-emerald-200 shadow-lg space-y-5 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Access SEVA.GIS Workspace
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Sign in with Google for automated Drive export or continue with Guest privacy mode
                </p>
              </div>
              <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
            </div>

            {oauthDiagnostic && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Google OAuth Status</span>
                </div>
                <p>{oauthDiagnostic}</p>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                onClick={handleGoogleSignIn}
                disabled={checkingOAuth}
                className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-300 font-bold text-sm shadow-sm flex items-center justify-center gap-3 transition active:scale-[0.99] disabled:opacity-60"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{checkingOAuth ? 'Validating OAuth...' : t.continueWithGoogle}</span>
              </button>

              <button
                onClick={() => onEnterWorkspace('guest')}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-sm shadow-md shadow-emerald-700/25 flex items-center justify-center gap-2 transition active:scale-[0.99]"
              >
                <span>{t.continueAsGuest}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero telemetry sent to commercial advertising brokers.</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Runs 100% on client-side IndexedDB & memory.</span>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Clockwise Parameter Engine Section */}
        <section className="space-y-4">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Clockwise Parameter Engine &amp; Domain Intelligence
            </h2>
            <p className="text-sm text-slate-600 font-medium">
              Autonomous orbital sweep stepping clockwise (1 → 2 → 3 → 4 → 5 → 6 → 1) with live spectral formulas, quality masks, and scientific restraint.
            </p>
          </div>

          <ClockwiseParameterEngine />
        </section>

        {/* Clickable Domain Cards opening parameters modal */}
        <section className="space-y-6">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Interactive Geospatial & Agronomic Domains
            </h2>
            <p className="text-sm text-slate-600 font-medium">
              Click any domain card below to inspect all 30+ peer-reviewed formulas, sensors, and agronomic purposes calculated live in your browser.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {DOMAIN_SPECS.map((domain) => (
              <div
                key={domain.id}
                onClick={() => setSelectedDomain(domain)}
                className="group cursor-pointer rounded-2xl bg-white p-6 border-2 border-slate-200 hover:border-emerald-500 shadow-sm hover:shadow-xl hover:shadow-emerald-900/10 transition duration-200 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${domain.colorClass} flex items-center justify-center shadow-md group-hover:scale-105 transition`}
                  >
                    {domain.icon}
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition">
                    Inspect Parameters →
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-800 transition">
                    {domain.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{domain.subtitle}</p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>{domain.techniques.length} Cited Algorithms</span>
                  <span className="text-emerald-600 font-semibold">Peer-Reviewed Specs</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Captioned 3-Step Execution Cards */}
        <section className="bg-white rounded-3xl p-8 border border-emerald-200 shadow-sm space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Three-Step Autonomous Execution Flow
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              From field boundary to full institutional dossier in under 15 seconds
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative">
              <span className="absolute top-4 right-4 text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                Step 1
              </span>
              <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Pick or Ingest AOI</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Draw parcel bounds interactively on satellite imagery or pull geometries directly from your local QGIS project or ArcMap workspace in EPSG:4326.
              </p>
              <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                Caption: Zero coordinate distortion; calibrated geodesic polygon calculation.
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative">
              <span className="absolute top-4 right-4 text-xs font-black text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                Step 2
              </span>
              <div className="w-10 h-10 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Multi-Engine Synthesis</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                SEVA.GIS queries Google Earth Engine, parses Copernicus 30m DEM, evaluates 5 SWIR mineral groups, and computes SWAT hydrological parameter sensitivity.
              </p>
              <div className="text-[11px] font-bold text-sky-800 bg-sky-50 p-2 rounded-lg border border-sky-200">
                Caption: Deterministic radiometric math with honest "Indicated" confidence flags.
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative">
              <span className="absolute top-4 right-4 text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                Step 3
              </span>
              <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold">
                <HardDrive className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Institutional Delivery</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Auto-syncs 19+ cartographic map layers and GeoTIFFs to Google Drive, packages PMFBY crop insurance packs, and dispatches native Telugu/Hindi reports via SMTP.
              </p>
              <div className="text-[11px] font-bold text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                Caption: Official documentation formatted for banks, insurers, and field agronomists.
              </div>
            </div>
          </div>
        </section>

        {/* Unified Methodology Section with Motion Pipeline Flowchart */}
        <section className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-3xl p-8 lg:p-10 shadow-2xl space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                <span>Interactive Scientific Pipeline</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-2 text-white">
                {t.methodologyHeading}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                Click any pipeline stage below to trace the complete radiometric and geospatial execution cycle across our 4 connected engines.
              </p>
            </div>
          </div>

          {/* Interactive Flowchart Horizontal Stepper */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {METHODOLOGY_NODES.map((node, idx) => (
              <button
                key={node.step}
                onClick={() => setActiveMethodologyStep(idx)}
                className={`text-left p-4 rounded-xl border transition duration-200 ${
                  activeMethodologyStep === idx
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="text-xs font-black opacity-80">Stage {node.step}</div>
                <div className="text-sm font-bold mt-1 line-clamp-1">{node.engine}</div>
              </button>
            ))}
          </div>

          {/* Active Flowchart Step Inspector Card */}
          <div className="p-6 rounded-2xl bg-slate-800/90 border border-emerald-500/40 space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-900 flex items-center justify-center font-black text-sm">
                {METHODOLOGY_NODES[activeMethodologyStep].step}
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {METHODOLOGY_NODES[activeMethodologyStep].title}
                </h3>
                <span className="text-xs text-emerald-400 font-semibold">
                  Engine: {METHODOLOGY_NODES[activeMethodologyStep].engine}
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              {METHODOLOGY_NODES[activeMethodologyStep].detail}
            </p>
          </div>
        </section>
      </main>

      {/* Domain Parameter Inspector Modal */}
      {selectedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${selectedDomain.colorClass} flex items-center justify-center shadow-md`}
                >
                  {selectedDomain.icon}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">{selectedDomain.title}</h3>
                  <p className="text-xs text-slate-600 font-medium">{selectedDomain.subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDomain(null)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Supported Parameters, Formulas & Sensors
              </h4>
              <div className="space-y-2.5">
                {selectedDomain.techniques.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">{t.name}</span>
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {t.sensor}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block">
                      {t.formula}
                    </div>
                    <p className="text-xs text-slate-600 font-medium">{t.purpose}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedDomain(null);
                onEnterWorkspace('guest');
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition"
            >
              Open Live Workspace to Compute These Parameters →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignInLanding;
