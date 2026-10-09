import { useState } from 'react'
import {
  X,
  ExternalLink,
  BookOpen,
  Sparkles,
  Layers,
  Cpu,
  Compass,
  CloudSun,
  Tractor,
  ShieldCheck,
  Check,
  Copy,
  ChevronRight,
  Calculator,
  ArrowRight
} from 'lucide-react'

type TabKey = 'flowchart' | 'indices' | 'terrain' | 'agro' | 'robotics' | 'thesis'

export default function MethodologyModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabKey>('flowchart')
  const [copiedCitation, setCopiedCitation] = useState(false)

  const copyCitation = () => {
    const bib = `@thesis{vinay2025sevagis,
  title={SEVA·GIS: Client-Side Geospatial Analytics and Autonomous Agro-Robotics for Smallholder Precision Agriculture},
  author={N. Akshit Vinay},
  year={2025},
  publisher={Open-Source Geospatial Research},
  url={https://github.com/virahitvin8/seva-gis}
}`
    navigator.clipboard?.writeText(bib)
    setCopiedCitation(true)
    setTimeout(() => setCopiedCitation(false), 2200)
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <section
        className="modal modal-methodology"
        style={{
          width: '920px',
          maxWidth: '96vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          background: '#0a1711',
          border: '1px solid rgba(182, 243, 106, 0.3)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
          borderRadius: '18px'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="methodology-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(20,45,32,0.9) 0%, rgba(10,23,17,0.95) 100%)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(182,243,106,0.15)',
                border: '1px solid rgba(182,243,106,0.3)',
                display: 'grid',
                placeItems: 'center',
                color: '#b6f36a'
              }}
            >
              <BookOpen size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2
                  id="methodology-modal-title"
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    color: '#fff',
                    fontFamily: "'Syne', 'Manrope', sans-serif"
                  }}
                >
                  SEVA·GIS Scientific Methodology &amp; Research Thesis
                </h2>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: 'rgba(182,243,106,0.18)',
                    color: '#b6f36a',
                    padding: '2px 7px',
                    borderRadius: 4,
                    border: '1px solid rgba(182,243,106,0.3)'
                  }}
                >
                  Algorithmic Specification
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#9fb5a5' }}>
                Zero-Backend Client-Side Geospatial Architecture by N. Akshit Vinay
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href="/how-it-works.html"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#eaf6df',
                padding: '6px 11px',
                borderRadius: 7,
                fontSize: 11.5,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.15s'
              }}
              title="Open full dedicated documentation page"
            >
              <span>Full Web Guide</span>
              <ExternalLink size={12} />
            </a>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#9fb5a5',
                padding: 6,
                borderRadius: 7,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center'
              }}
              aria-label="Close dialog"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '10px 20px',
            background: 'rgba(0,0,0,0.35)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            overflowX: 'auto',
            flexShrink: 0
          }}
        >
          {[
            { id: 'flowchart', label: '1. Pipeline Flowchart', icon: Sparkles },
            { id: 'indices', label: '2. Spectral Math (14 Indices)', icon: Calculator },
            { id: 'terrain', label: '3. DEM & Hydro (Horn 1981)', icon: Compass },
            { id: 'agro', label: '4. FAO-56 & SoilGrids', icon: CloudSun },
            { id: 'robotics', label: '5. Fields2Cover Swaths & VRA', icon: Tractor },
            { id: 'thesis', label: '6. Architecture & Citation', icon: ShieldCheck }
          ].map((t) => {
            const Icon = t.icon
            const isOn = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as TabKey)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 12px',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: isOn ? 700 : 600,
                  color: isOn ? '#07160e' : '#a7bdae',
                  background: isOn ? '#b6f36a' : 'rgba(255,255,255,0.05)',
                  border: isOn ? '1px solid #b6f36a' : '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={13} style={{ color: isOn ? '#07160e' : '#85dc58' }} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            color: '#dbeade',
            fontSize: 13,
            lineHeight: 1.6
          }}
        >
          {/* TAB 1: FLOWCHART */}
          {activeTab === 'flowchart' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div
                style={{
                  background: 'rgba(182,243,106,0.08)',
                  border: '1px solid rgba(182,243,106,0.22)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  fontSize: 12.5,
                  color: '#c5dda0'
                }}
              >
                <strong>Scientific Thesis Architecture Overview:</strong> SEVA·GIS executes a 7-stage zero-backend geospatial pipeline directly within client browser memory. From WGS84 geodesic boundary ingestion to STAC scene querying, Horn DEM finite differences, radiometric band algebra, FAO-56 Penman-Monteith evapotranspiration, and Fields2Cover agricultural swath robotics.
              </div>

              {/* Rendered Interactive SVG Pipeline Flowchart */}
              <div
                style={{
                  background: '#040b07',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 14,
                  padding: '20px 14px',
                  overflowX: 'auto',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#b6f36a',
                      background: 'rgba(182,243,106,0.15)',
                      padding: '3px 10px',
                      borderRadius: 20
                    }}
                  >
                    Interactive Scientific Pipeline Flow Chart
                  </span>
                </div>

                <svg
                  viewBox="0 0 840 500"
                  style={{ width: '100%', height: 'auto', minWidth: 680, display: 'block' }}
                >
                  <defs>
                    <linearGradient id="flowGrad1" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#134e4a" />
                      <stop offset="100%" stopColor="#042f2e" />
                    </linearGradient>
                    <linearGradient id="flowGrad2" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#1e3a8a" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                    <linearGradient id="flowGrad3" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#166534" />
                      <stop offset="100%" stopColor="#052e16" />
                    </linearGradient>
                    <linearGradient id="flowGrad4" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#854d0e" />
                      <stop offset="100%" stopColor="#451a03" />
                    </linearGradient>
                    <linearGradient id="flowGrad5" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#581c87" />
                      <stop offset="100%" stopColor="#2e1065" />
                    </linearGradient>
                    <filter id="flowGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#b6f36a" floodOpacity="0.25" />
                    </filter>
                    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 8 5 L 0 9 z" fill="#b6f36a" />
                    </marker>
                  </defs>

                  {/* Level 1: Field Ingestion & Boundary Geodesy */}
                  <g transform="translate(40, 30)">
                    <rect width="220" height="85" rx="10" fill="url(#flowGrad1)" stroke="#2dd4bf" strokeWidth="1.5" />
                    <text x="110" y="26" textAnchor="middle" fill="#5eead4" fontSize="12" fontWeight="700">1. Spatial Geodesy</text>
                    <text x="110" y="46" textAnchor="middle" fill="#ccfbf1" fontSize="10.5">WGS84 EPSG:4326 Ring</text>
                    <text x="110" y="64" textAnchor="middle" fill="#99f6e4" fontSize="9.5">Area (ha) · Vincenty Perimeter</text>
                  </g>

                  {/* Level 2: Satellite STAC & Cloud Masking */}
                  <g transform="translate(310, 30)">
                    <rect width="220" height="85" rx="10" fill="url(#flowGrad2)" stroke="#60a5fa" strokeWidth="1.5" />
                    <text x="110" y="26" textAnchor="middle" fill="#93c5fd" fontSize="12" fontWeight="700">2. Sentinel-2 L2A Ingestion</text>
                    <text x="110" y="46" textAnchor="middle" fill="#dbeafe" fontSize="10.5">STAC Search · Cloud &lt;30%</text>
                    <text x="110" y="64" textAnchor="middle" fill="#bfdbfe" fontSize="9.5">SCL Scene Masking · BOA Reflectance</text>
                  </g>

                  {/* Level 3: Copernicus DEM 30m Topography */}
                  <g transform="translate(580, 30)">
                    <rect width="220" height="85" rx="10" fill="url(#flowGrad4)" stroke="#facc15" strokeWidth="1.5" />
                    <text x="110" y="26" textAnchor="middle" fill="#fef08a" fontSize="12" fontWeight="700">3. Copernicus GLO-30 DEM</text>
                    <text x="110" y="46" textAnchor="middle" fill="#fef9c3" fontSize="10.5">Horn 1981 Finite Differences</text>
                    <text x="110" y="64" textAnchor="middle" fill="#fde047" fontSize="9.5">Slope β · Aspect α · TWI Wetness</text>
                  </g>

                  {/* Connecting Arrows Top Row */}
                  <path d="M 260 72 L 310 72" stroke="#b6f36a" strokeWidth="2" markerEnd="url(#arrow)" />
                  <path d="M 530 72 L 580 72" stroke="#b6f36a" strokeWidth="2" markerEnd="url(#arrow)" />

                  {/* Arrow from Top Row to Middle Node */}
                  <path d="M 420 115 L 420 180" stroke="#b6f36a" strokeWidth="2" markerEnd="url(#arrow)" />

                  {/* Level 4: Radiometric Multispectral Index Engine (Center Hub) */}
                  <g transform="translate(160, 180)">
                    <rect width="520" height="110" rx="12" fill="url(#flowGrad3)" stroke="#4ade80" strokeWidth="2" filter="url(#flowGlow)" />
                    <text x="260" y="30" textAnchor="middle" fill="#bbf7d0" fontSize="14" fontWeight="800">4. In-Browser Radiometric Spectral Engine (Float32Array WebGL)</text>
                    <text x="260" y="55" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="600">NDVI · NDMI · NDWI · NDRE · EVI · SAVI · MSAVI · BSI · REIP · LAI · CWSI · LST</text>
                    <text x="260" y="78" textAnchor="middle" fill="#86efac" fontSize="10">Pixel Clipping to Polygon · Statistical Z-Scores · Early Stress Warning Matrix</text>
                    <text x="260" y="96" textAnchor="middle" fill="#4ade80" fontSize="9.5">Zero-Division Safe Formulations · 10 m Resolution Resampling</text>
                  </g>

                  {/* Connecting Arrows from Center to Bottom Row */}
                  <path d="M 280 290 L 190 350" stroke="#b6f36a" strokeWidth="2" markerEnd="url(#arrow)" />
                  <path d="M 420 290 L 420 350" stroke="#b6f36a" strokeWidth="2" markerEnd="url(#arrow)" />
                  <path d="M 560 290 L 650 350" stroke="#b6f36a" strokeWidth="2" markerEnd="url(#arrow)" />

                  {/* Level 5: Agro-Meteorological & Soil Integration */}
                  <g transform="translate(40, 350)">
                    <rect width="230" height="95" rx="10" fill="url(#flowGrad2)" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="115" y="26" textAnchor="middle" fill="#7dd3fc" fontSize="12" fontWeight="700">5. Multi-Source Agro Physics</text>
                    <text x="115" y="48" textAnchor="middle" fill="#e0f2fe" fontSize="10">Open-Meteo FAO-56 Penman-Monteith ET₀</text>
                    <text x="115" y="66" textAnchor="middle" fill="#bae6fd" fontSize="9.5">ISRIC SoilGrids v2.0 (8 Depths)</text>
                    <text x="115" y="82" textAnchor="middle" fill="#7dd3fc" fontSize="9">Growing Degree Days (GDD Base 10°C)</text>
                  </g>

                  {/* Level 6: Agricultural Robotics & VRA Prescriptions */}
                  <g transform="translate(305, 350)">
                    <rect width="230" height="95" rx="10" fill="url(#flowGrad5)" stroke="#c084fc" strokeWidth="1.5" />
                    <text x="115" y="26" textAnchor="middle" fill="#e9d5ff" fontSize="12" fontWeight="700">6. Fields2Cover Swath Robotics</text>
                    <text x="115" y="48" textAnchor="middle" fill="#f3e8ff" fontSize="10">Longest-Edge Swath Alignment θ_opt</text>
                    <text x="115" y="66" textAnchor="middle" fill="#d8b4fe" fontSize="9.5">Dubins Turning Path Integration</text>
                    <text x="115" y="82" textAnchor="middle" fill="#c084fc" fontSize="9">3-Zone Jenks Natural Breaks Urea VRA</text>
                  </g>

                  {/* Level 7: Zero-Backend Local Storage & Desktop GIS Bridge */}
                  <g transform="translate(570, 350)">
                    <rect width="230" height="95" rx="10" fill="url(#flowGrad1)" stroke="#34d399" strokeWidth="1.5" />
                    <text x="115" y="26" textAnchor="middle" fill="#a7f3d0" fontSize="12" fontWeight="700">7. In-Browser Vault &amp; GIS Bridge</text>
                    <text x="115" y="48" textAnchor="middle" fill="#ecfdf5" fontSize="10">Dexie.js IndexedDB Local Storage</text>
                    <text x="115" y="66" textAnchor="middle" fill="#6ee7b7" fontSize="9.5">Zero Telemetry · 100% Privacy</text>
                    <text x="115" y="82" textAnchor="middle" fill="#34d399" fontSize="9">QGIS 3.x &amp; ArcGIS Pro Two-Way Sync</text>
                  </g>
                </svg>
              </div>

              {/* Step Highlights */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 12
                }}
              >
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <b style={{ color: '#b6f36a', fontSize: 12 }}>Zero-Server Privacy Invariant</b>
                  <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#9fb5a5' }}>
                    Farm coordinates and spatial polygons never leave the user's browser. STAC assets and COG rasters stream directly to client memory.
                  </p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <b style={{ color: '#60a5fa', fontSize: 12 }}>Bottom-of-Atmosphere (BOA) Reflectance</b>
                  <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#9fb5a5' }}>
                    Sen2Cor surface reflectance ensures absolute radiometric stability across seasonal cycles and solar angles.
                  </p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <b style={{ color: '#c084fc', fontSize: 12 }}>Robotics Path Planning Invariant</b>
                  <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#9fb5a5' }}>
                    Boustrophedon swaths align with the maximum length boundary vector to minimize non-productive turning distance and headland soil compaction.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SPECTRAL INDICES FORMULATIONS */}
          {activeTab === 'indices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ fontSize: 12.5, color: '#c5dda0' }}>
                Mathematical formulations implemented in <code>src/lib/indicators.ts</code>. All equations utilize Sentinel-2 Multispectral Instrument (MSI) surface reflectance bands normalized between 0.0 and 1.0:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  {
                    name: 'Normalized Difference Vegetation Index (NDVI)',
                    author: 'Rouse et al., 1974',
                    formula: 'NDVI = (B08 - B04) / (B08 + B04)',
                    bands: 'B08 (NIR, 842 nm) & B04 (Red, 665 nm)',
                    desc: 'Primary proxy for canopy chlorophyll absorption and photosynthetic vigour. Values above 0.60 indicate peak green canopy.',
                    color: '#4ade80'
                  },
                  {
                    name: 'Normalized Difference Red Edge (NDRE)',
                    author: 'Gitelson & Merzlyak, 1994',
                    formula: 'NDRE = (B08 - B05) / (B08 + B05)',
                    bands: 'B08 (NIR, 842 nm) & B05 (Red Edge 1, 705 nm)',
                    desc: 'Deep canopy chlorophyll penetration. Avoids NDVI saturation in dense crops (corn, sugarcane, wheat) and provides early nitrogen deficit detection.',
                    color: '#22c55e'
                  },
                  {
                    name: 'Normalized Difference Moisture Index (NDMI)',
                    author: 'Gao, 1996',
                    formula: 'NDMI = (B08 - B11) / (B08 + B11)',
                    bands: 'B08 (NIR, 842 nm) & B11 (SWIR-1, 1610 nm)',
                    desc: 'Liquid water absorption in spongy mesophyll leaf tissue. Sensitive to early drought stress 4 to 7 days before visible NDVI discoloration.',
                    color: '#38bdf8'
                  },
                  {
                    name: 'Enhanced Vegetation Index (EVI)',
                    author: 'Huete et al., 2002',
                    formula: 'EVI = 2.5 × (B08 - B04) / (B08 + 6 × B04 - 7.5 × B02 + 1.0)',
                    bands: 'B08 (NIR), B04 (Red), B02 (Blue, 490 nm)',
                    desc: 'Corrects for residual atmospheric aerosols and background soil reflectance; maintains linear sensitivity in dense biomass.',
                    color: '#a3e635'
                  },
                  {
                    name: 'Soil-Adjusted Vegetation Index (SAVI & MSAVI)',
                    author: 'Huete 1988 / Qi et al. 1994',
                    formula: 'SAVI = (1 + 0.5) × (B08 - B04) / (B08 + B04 + 0.5)',
                    bands: 'B08 (NIR) & B04 (Red) with soil calibration factor L=0.5',
                    desc: 'Minimizes soil brightness influences in early vegetative emergence and arid/semi-arid smallholder plots.',
                    color: '#facc15'
                  },
                  {
                    name: 'Red Edge Inflection Point (REIP)',
                    author: 'Guyot & Baret, 1988',
                    formula: 'REIP = 700 + 40 × (((B04 + B07) / 2 - B05) / (B06 - B05)) [nm]',
                    bands: 'B04 (665 nm), B05 (705 nm), B06 (740 nm), B07 (783 nm)',
                    desc: 'Wavelength of maximum first-derivative slope in the red-edge region. Highly correlated with total leaf nitrogen and senescence onset.',
                    color: '#f43f5e'
                  },
                  {
                    name: 'Crop Water Stress Index (CWSI)',
                    author: 'Idso et al. 1981 / SEVA Proxy',
                    formula: 'CWSI = clamp( (0.35 - NDMI) / 0.55, 0, 1 )',
                    bands: 'Derived from NDMI canopy hydration deficit',
                    desc: 'Normalized metric where 0.0 indicates full transpiration and 1.0 indicates severe stomatal closure and transpiration cessation.',
                    color: '#fb923c'
                  },
                  {
                    name: 'Bare Soil Index (BSI)',
                    author: 'Diek et al., 2017',
                    formula: 'BSI = ((B11 + B04) - (B08 + B02)) / ((B11 + B04) + (B08 + B02))',
                    bands: 'B11 (SWIR1), B04 (Red), B08 (NIR), B02 (Blue)',
                    desc: 'Delineates fallow ground, tilled soil, and land preparation phases from crop stubble and weeds.',
                    color: '#d97706'
                  }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      padding: '12px 16px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: item.color }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Citation: {item.author}</span>
                    </div>
                    <div
                      style={{
                        background: '#040b07',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 6,
                        padding: '6px 10px',
                        margin: '6px 0',
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: 12,
                        color: '#bbf7d0'
                      }}
                    >
                      {item.formula}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#9fb5a5' }}>
                      <strong style={{ color: '#e2e8f0' }}>Bands:</strong> {item.bands} — {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DEM & HYDROLOGY */}
          {activeTab === 'terrain' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12.5, color: '#c5dda0' }}>
                Copernicus GLO-30 Digital Surface Model (30 m spatial resolution) processed via finite-difference kernels in <code>src/lib/indicators.ts</code> &amp; <code>src/lib/hydro.ts</code>:
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <b style={{ color: '#fef08a', fontSize: 13 }}>Horn's 8-Neighbor Finite-Difference Slope &amp; Aspect (Horn, 1981)</b>
                <p style={{ margin: 0, fontSize: 12, color: '#9fb5a5' }}>
                  For each grid elevation point <code>z(x, y)</code> with cell size <code>dx, dy</code>:
                </p>
                <div
                  style={{
                    background: '#040b07',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 11.5,
                    color: '#fde047',
                    lineHeight: 1.5
                  }}
                >
                  ∂z/∂x = [(z(x+1, y-1) + 2·z(x+1, y) + z(x+1, y+1)) - (z(x-1, y-1) + 2·z(x-1, y) + z(x-1, y+1))] / (8 · dx)<br />
                  ∂z/∂y = [(z(x-1, y-1) + 2·z(x, y-1) + z(x+1, y-1)) - (z(x-1, y+1) + 2·z(x, y+1) + z(x+1, y+1))] / (8 · dy)<br /><br />
                  Slope β = arctan( √( (∂z/∂x)² + (∂z/∂y)² ) ) × (180 / π) [°]<br />
                  Aspect α = (arctan2(-∂z/∂x, -∂z/∂y) × (180 / π) + 360) % 360 [°]
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <b style={{ color: '#60a5fa', fontSize: 13 }}>Topographic Wetness Index (TWI - Beven &amp; Kirkby, 1979)</b>
                <p style={{ margin: 0, fontSize: 12, color: '#9fb5a5' }}>
                  Identifies natural drainage convergence, soil saturation zones, and flood risk pockets across the farm terrain:
                </p>
                <div
                  style={{
                    background: '#040b07',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 12,
                    color: '#93c5fd'
                  }}
                >
                  TWI = ln( a / tan(β) )
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: '#9fb5a5' }}>
                  Where <code>a</code> is the specific catchment area (upslope contributing area per unit contour length computed via D8 steepest-descent routing) and <code>β</code> is the local slope angle. Values &gt; 12.0 represent natural water collection sinks.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: FAO-56 & SOILGRIDS */}
          {activeTab === 'agro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12.5, color: '#c5dda0' }}>
                Multi-source micrometeorological assimilation in <code>src/lib/agro.ts</code>:
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <b style={{ color: '#38bdf8', fontSize: 13 }}>FAO-56 Penman-Monteith Evapotranspiration Equation (Allen et al., 1998)</b>
                <div
                  style={{
                    background: '#040b07',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 12,
                    color: '#7dd3fc',
                    lineHeight: 1.5
                  }}
                >
                  ET₀ = [ 0.408 Δ (R_n - G) + γ (900 / (T + 273)) u₂ (e_s - e_a) ] / [ Δ + γ (1 + 0.34 u₂) ]
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: '#9fb5a5', lineHeight: 1.6 }}>
                  <li><code>R_n</code>: Net radiation at crop surface (MJ m⁻² day⁻¹)</li>
                  <li><code>G</code>: Soil heat flux density (MJ m⁻² day⁻¹)</li>
                  <li><code>T</code>: Mean daily air temperature at 2 m height (°C)</li>
                  <li><code>u₂</code>: Wind speed at 2 m height (m s⁻¹)</li>
                  <li><code>(e_s - e_a)</code>: Vapour Pressure Deficit (VPD, kPa)</li>
                  <li><code>Δ</code>: Slope of saturation vapour pressure curve (kPa °C⁻¹)</li>
                  <li><code>γ</code>: Psychrometric constant (kPa °C⁻¹)</li>
                </ul>
                <div style={{ fontSize: 11.5, color: '#bae6fd' }}>
                  <strong>Crop Evapotranspiration:</strong> <code>ET_c = K_c × ET_0</code> where <code>K_c</code> is dynamically resolved based on NDVI-derived crop growth stage.
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <b style={{ color: '#a7f3d0', fontSize: 13 }}>ISRIC SoilGrids v2.0 Global Soil Physics (250 m)</b>
                <p style={{ margin: 0, fontSize: 11.5, color: '#9fb5a5' }}>
                  Directly queries REST endpoint <code>rest.isric.org/soilgrids/v2.0</code> across depth horizons (0-5cm, 5-15cm, 15-30cm, 30-60cm) to evaluate:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: 11 }}>
                  <div style={{ background: '#040b07', padding: '6px 10px', borderRadius: 6 }}>• Clay / Sand / Silt (%)</div>
                  <div style={{ background: '#040b07', padding: '6px 10px', borderRadius: 6 }}>• Soil Organic Carbon (SOC g/kg)</div>
                  <div style={{ background: '#040b07', padding: '6px 10px', borderRadius: 6 }}>• pH in H₂O (acidity)</div>
                  <div style={{ background: '#040b07', padding: '6px 10px', borderRadius: 6 }}>• Cation Exchange Capacity (CEC)</div>
                  <div style={{ background: '#040b07', padding: '6px 10px', borderRadius: 6 }}>• Bulk Density (cg/cm³)</div>
                  <div style={{ background: '#040b07', padding: '6px 10px', borderRadius: 6 }}>• Total Nitrogen (g/kg)</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ROBOTICS & VRA */}
          {activeTab === 'robotics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12.5, color: '#c5dda0' }}>
                Coverage Path Planning &amp; Variable-Rate Prescriptions in <code>src/lib/pathplan.ts</code>:
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <b style={{ color: '#c084fc', fontSize: 13 }}>Optimal Driving Swath Angle (Fields2Cover Principle)</b>
                <p style={{ margin: 0, fontSize: 12, color: '#9fb5a5' }}>
                  To minimize turns and diesel consumption, the driving orientation θ_opt is aligned with the longest geodesic field edge:
                </p>
                <div
                  style={{
                    background: '#040b07',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 12,
                    color: '#d8b4fe'
                  }}
                >
                  θ_opt = argmax_i [ || p_(i+1) - p_i ||² ] mod 180°
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: '#9fb5a5' }}>
                  The polygon is projected into a local metric equidistant Cartesian plane, sliced into parallel swath lines separated by implement width <code>w</code>, and bounded by a headland turning ring.
                </p>
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <b style={{ color: '#4ade80', fontSize: 13 }}>Variable-Rate Application (VRA) 3-Zone Optimization</b>
                <p style={{ margin: 0, fontSize: 12, color: '#9fb5a5' }}>
                  Partitions the farm into 3 distinct agronomic management zones using Jenks Natural Breaks on the NDVI histogram:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 11.5 }}>
                  <div style={{ background: '#040b07', padding: 10, borderRadius: 6, borderLeft: '3px solid #ef4444' }}>
                    <strong style={{ color: '#f87171' }}>Zone 1: Low Vigor</strong><br />
                    Target Rate: +25% N rate. Rescues establishment gaps with micro-dosing.
                  </div>
                  <div style={{ background: '#040b07', padding: 10, borderRadius: 6, borderLeft: '3px solid #eab308' }}>
                    <strong style={{ color: '#fde047' }}>Zone 2: Moderate Vigor</strong><br />
                    Target Rate: Standard baseline rate (100 kg/ha). Sustains tillering.
                  </div>
                  <div style={{ background: '#040b07', padding: 10, borderRadius: 6, borderLeft: '3px solid #22c55e' }}>
                    <strong style={{ color: '#86efac' }}>Zone 3: High Vigor</strong><br />
                    Target Rate: -20% N rate. Prevents lodging and nitrogen runoff waste.
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: '#86efac' }}>
                  <strong>Efficiency Invariant:</strong> Typical smallholder fertilizer savings average 12% to 22% compared to uniform broadcast application.
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: THESIS & CITATION */}
          {activeTab === 'thesis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12.5, color: '#c5dda0' }}>
                Academic documentation and BibTeX citation:
              </div>

              <div
                style={{
                  background: '#040b07',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#fff', fontSize: 12.5 }}>BibTeX Citation:</strong>
                  <button
                    type="button"
                    onClick={copyCitation}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#b6f36a',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedCitation ? <><Check size={12} /> Copied Citation</> : <><Copy size={12} /> Copy BibTeX</>}
                  </button>
                </div>
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: '#a7f3d0',
                    overflowX: 'auto',
                    padding: 8,
                    background: '#000',
                    borderRadius: 6
                  }}
                >
{`@thesis{vinay2025sevagis,
  title={SEVA·GIS: Client-Side Geospatial Analytics and Autonomous Agro-Robotics for Smallholder Precision Agriculture},
  author={N. Akshit Vinay},
  year={2025},
  publisher={Open-Source Geospatial Research},
  url={https://github.com/virahitvin8/seva-gis}
}`}
                </pre>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <b style={{ color: '#eaf6df', fontSize: 12.5 }}>Selected Academic Bibliography:</b>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: '#9fb5a5', lineHeight: 1.6 }}>
                  <li><strong>Rouse, J. W., et al. (1974).</strong> Monitoring vegetation systems in the Great Plains with ERTS. <em>NASA SP-351</em>, 309-317.</li>
                  <li><strong>Huete, A., et al. (2002).</strong> Overview of the radiometric and biophysical performance of the MODIS vegetation indices. <em>Remote Sensing of Environment</em>, 83(1-2), 195-213.</li>
                  <li><strong>Gao, B. C. (1996).</strong> NDWI—A normalized difference water index for remote sensing of vegetation liquid water from space. <em>Remote Sensing of Environment</em>, 58(3), 257-266.</li>
                  <li><strong>Horn, B. K. (1981).</strong> Hill shading and the reflectance map. <em>Proceedings of the IEEE</em>, 69(1), 14-47.</li>
                  <li><strong>Allen, R. G., et al. (1998).</strong> Crop evapotranspiration: Guidelines for computing crop water requirements. <em>FAO Irrigation and Drainage Paper 56</em>.</li>
                  <li><strong>Gitelson, A., &amp; Merzlyak, M. N. (1994).</strong> Spectral reflectance changes associated with autumn senescence of Aesculus hippocastanum L. and Acer platanoides L. leaves. <em>Journal of Plant Physiology</em>, 143(3), 286-292.</li>
                  <li><strong>Oksanen, T., &amp; Visala, A. (2007).</strong> Coverage path planning for agricultural field machines. <em>IFAC Proceedings Volumes</em>, 40(15), 23-28.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(5,12,8,0.95)',
            flexShrink: 0,
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#9fb5a5' }}>
            <ShieldCheck size={14} style={{ color: '#b6f36a' }} />
            <span>Open-source precision agronomy for all who love the land.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a
              href="/how-it-works.html"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#b6f36a',
                color: '#07160e',
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                textDecoration: 'none',
                transition: 'all 0.15s'
              }}
            >
              <span>Open Complete Web Thesis</span>
              <ExternalLink size={13} />
            </a>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#eaf6df',
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
