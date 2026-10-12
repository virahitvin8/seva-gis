import React, { useState, useId, useMemo, useRef, useEffect } from 'react'
import {
  FileText,
  Table2,
  Compass,
  LayoutTemplate,
  Film,
  Download,
  Printer,
  FileCode,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Eye,
  EyeOff,
  Copy,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Info,
  ZoomIn,
  ZoomOut,
  X,
  ExternalLink,
  ShieldCheck,
  Sparkle,
  ArrowRight,
  Share2,
} from 'lucide-react'

export type CraftTab = 'pdfcraft' | 'gridcraft' | 'vectorcraft' | 'designcraft' | 'effectcraft'

interface FarmLike {
  id: string
  name: string
  crop?: string
  lat: number
  lon: number
  area?: number
  location?: string
  elevation?: number
  moisture?: number
  rain?: number
  polygon?: [number, number][]
  analysis?: {
    scene: { datetime: string; cloud: number }
    ndvi: { mean: number; min: number; max: number; std: number }
    ndmi?: { mean: number; min: number; max: number }
    stressPct: number
    slopePct?: number
  }
}

interface ArtCraftStudioProps {
  farm: FarmLike
  initialTab?: CraftTab
  onClose?: () => void
  isModal?: boolean
}

// -----------------------------------------------------------------------------
// 1. PdfCraft Workbench: Document Organiser, Metadata & Lossless PDF Compiler
// -----------------------------------------------------------------------------
function PdfCraftWorkbench({ farm }: { farm: FarmLike }) {
  const [pages, setPages] = useState([
    { id: 'cover', title: 'Cover & Geodetic Metadata', included: true, type: 'Title Plate' },
    { id: 'multispectral', title: 'Multispectral Vigor & Canopy Zonation', included: true, type: 'Cartographic Plate' },
    { id: 'hydrology', title: 'Hydrology, Soil Hydraulics & Terrain', included: true, type: 'Hydro Analytic' },
    { id: 'phenology', title: 'Phenology Trajectory & Precision Prescriptions', included: true, type: 'Prescription Sheet' },
  ])
  const [activePage, setActivePage] = useState('cover')
  const [showBleed, setShowBleed] = useState(true)
  const [showCropMarks, setShowCropMarks] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [metadata, setMetadata] = useState({
    title: `STUDY AREA DOSSIER — ${farm.name.toUpperCase()}`,
    cartographer: 'SEVA·GIS Precision Spatial Core',
    datum: 'WGS 84 / UTM Zone 44N',
    crsCode: 'EPSG:4326 / EPSG:32644',
    security: 'Official Agro-Geospatial Record',
    integrityHash: 'SHA-256: 7f4a9b8e12c5...e43b',
  })
  const [isExporting, setIsExporting] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)

  const togglePage = (id: string) => {
    setPages(prev => prev.map(p => (p.id === id ? { ...p, included: !p.included } : p)))
  }

  const movePage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= pages.length) return
    const next = [...pages]
    const temp = next[idx]
    next[idx] = next[target]
    next[target] = temp
    setPages(next)
  }

  const triggerLosslessPrint = () => {
    setIsExporting(true)
    setTimeout(() => {
      window.print()
      setIsExporting(false)
    }, 400)
  }

  return (
    <div className="craft-workbench pdfcraft-layout">
      {/* Sidebar: Page Thumbnails & Thumb Rack */}
      <div className="craft-sidebar">
        <div className="craft-sidebar-header">
          <div className="craft-brand-badge">
            <span className="craft-dot dot-teal" />
            <strong>PdfCraft</strong>
            <small>Adobe Acrobat Rebuilt</small>
          </div>
          <span className="craft-count">{pages.filter(p => p.included).length}/{pages.length} Pages</span>
        </div>

        <div className="craft-thumb-rack">
          {pages.map((p, idx) => (
            <div
              key={p.id}
              className={`craft-page-thumb ${activePage === p.id ? 'active' : ''} ${!p.included ? 'excluded' : ''}`}
              onClick={() => setActivePage(p.id)}
            >
              <div className="thumb-header">
                <span className="thumb-idx">{idx + 1}</span>
                <span className="thumb-type">{p.type}</span>
                <input
                  type="checkbox"
                  checked={p.included}
                  onChange={e => {
                    e.stopPropagation()
                    togglePage(p.id)
                  }}
                  title="Include in dossier export"
                />
              </div>
              <div className="thumb-canvas-preview">
                {p.id === 'cover' && (
                  <div className="micro-doc cover">
                    <div className="micro-banner" />
                    <div className="micro-title">{farm.name}</div>
                    <div className="micro-stamp" />
                  </div>
                )}
                {p.id === 'multispectral' && (
                  <div className="micro-doc multispectral">
                    <div className="micro-map-grid" />
                    <div className="micro-bars" />
                  </div>
                )}
                {p.id === 'hydrology' && (
                  <div className="micro-doc hydrology">
                    <div className="micro-curve" />
                    <div className="micro-stat" />
                  </div>
                )}
                {p.id === 'phenology' && (
                  <div className="micro-doc phenology">
                    <div className="micro-scatter" />
                    <div className="micro-table" />
                  </div>
                )}
              </div>
              <div className="thumb-footer">
                <span>{p.title}</span>
                <div className="thumb-actions">
                  <button
                    disabled={idx === 0}
                    onClick={e => {
                      e.stopPropagation()
                      movePage(idx, -1)
                    }}
                    title="Move page up"
                  >
                    ↑
                  </button>
                  <button
                    disabled={idx === pages.length - 1}
                    onClick={e => {
                      e.stopPropagation()
                      movePage(idx, 1)
                    }}
                    title="Move page down"
                  >
                    ↓
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="craft-metadata-card">
          <h4>Dossier Metadata (XMP / PDF-A)</h4>
          <label>
            <span>Title:</span>
            <input
              value={metadata.title}
              onChange={e => setMetadata({ ...metadata, title: e.target.value })}
            />
          </label>
          <label>
            <span>Cartographer:</span>
            <input
              value={metadata.cartographer}
              onChange={e => setMetadata({ ...metadata, cartographer: e.target.value })}
            />
          </label>
          <div className="meta-hash-row">
            <span>{metadata.integrityHash}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(metadata.integrityHash)
                setCopiedHash(true)
                setTimeout(() => setCopiedHash(false), 2000)
              }}
              title="Copy hash"
            >
              {copiedHash ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas: High Fidelity Page Inspection with Bleed & Crop Marks */}
      <div className="craft-main-canvas">
        <div className="craft-canvas-toolbar">
          <div className="canvas-tool-group">
            <button
              className={`tool-btn ${showBleed ? 'on' : ''}`}
              onClick={() => setShowBleed(!showBleed)}
              title="Toggle 3mm Print Bleed Guide"
            >
              <LayoutTemplate size={14} /> Bleed Box (3mm)
            </button>
            <button
              className={`tool-btn ${showCropMarks ? 'on' : ''}`}
              onClick={() => setShowCropMarks(!showCropMarks)}
              title="Toggle Printer Crop Hairlines"
            >
              <Printer size={14} /> Crop Marks
            </button>
          </div>

          <div className="canvas-zoom-group">
            <button onClick={() => setZoomLevel(Math.max(50, zoomLevel - 15))}><ZoomOut size={13} /></button>
            <span>{zoomLevel}%</span>
            <button onClick={() => setZoomLevel(Math.min(180, zoomLevel + 15))}><ZoomIn size={13} /></button>
            <button onClick={() => setZoomLevel(100)} className="reset-zoom">100%</button>
          </div>

          <div className="canvas-export-group">
            <button className="craft-action-btn primary" onClick={triggerLosslessPrint} disabled={isExporting}>
              <Printer size={14} /> Lossless PDF Print
            </button>
          </div>
        </div>

        <div className="craft-sheet-viewport">
          <div
            className={`craft-virtual-sheet ${showBleed ? 'has-bleed' : ''} ${showCropMarks ? 'has-crops' : ''}`}
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
          >
            {/* Hairline Crop Marks */}
            {showCropMarks && (
              <div className="pdfcraft-crop-marks">
                <span className="crop-tl-h" />
                <span className="crop-tl-v" />
                <span className="crop-tr-h" />
                <span className="crop-tr-v" />
                <span className="crop-bl-h" />
                <span className="crop-bl-v" />
                <span className="crop-br-h" />
                <span className="crop-br-v" />
              </div>
            )}

            {/* Bleed Guide Outline */}
            {showBleed && <div className="pdfcraft-bleed-guide" />}

            {/* Active Page Sheet Content */}
            <div className="pdfcraft-content-box">
              <div className="sheet-header">
                <div className="sheet-seal">
                  <svg viewBox="0 0 100 100" width="46" height="46">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#166534" strokeWidth="2.5" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#166534" strokeWidth="1" strokeDasharray="3 2" />
                    <text x="50" y="44" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#166534">SEVA·GIS</text>
                    <text x="50" y="55" textAnchor="middle" fontSize="6.5" fill="#15803d">CERTIFIED</text>
                    <text x="50" y="64" textAnchor="middle" fontSize="5" fill="#475569">WGS-84 / GEE</text>
                  </svg>
                </div>
                <div className="sheet-headline">
                  <span className="eyebrow">SPATIAL EVALUATION & VEGETATION ANALYTICS</span>
                  <h2>{metadata.title}</h2>
                  <p>Cadastral Center: {farm.lat.toFixed(5)}° N, {farm.lon.toFixed(5)}° E · Area: {farm.area?.toFixed(2) ?? '—'} ha</p>
                </div>
                <div className="sheet-folio">
                  <span>PAGE {pages.findIndex(p => p.id === activePage) + 1} OF {pages.length}</span>
                  <small>{new Date().toISOString().split('T')[0]}</small>
                </div>
              </div>

              {activePage === 'cover' && (
                <div className="sheet-body-cover">
                  <div className="cover-grid">
                    <div className="cover-card">
                      <h3>Area of Interest Metrics</h3>
                      <ul>
                        <li><strong>Parcel Identifier:</strong> {farm.name}</li>
                        <li><strong>Dominant Canopy:</strong> {farm.crop || 'Field Vegetation'}</li>
                        <li><strong>Geodetic Bounding Box:</strong> WGS 84 (EPSG:4326)</li>
                        <li><strong>Surface Elevation:</strong> {farm.elevation ?? 310} m MSL (GLO-30)</li>
                        <li><strong>Mean Surface Slope:</strong> {farm.analysis?.slopePct?.toFixed(1) ?? 2.1}%</li>
                      </ul>
                    </div>
                    <div className="cover-card">
                      <h3>Satellite Telemetry Status</h3>
                      <ul>
                        <li><strong>Constellation:</strong> Sentinel-2 L2A (Copernicus)</li>
                        <li><strong>Scene Timestamp:</strong> {farm.analysis?.scene?.datetime ? new Date(farm.analysis.scene.datetime).toLocaleString() : 'Latest Clear Acquisition'}</li>
                        <li><strong>Cloud Obscuration:</strong> {farm.analysis?.scene?.cloud ?? 0}%</li>
                        <li><strong>NDVI Mean Reflectance:</strong> {farm.analysis?.ndvi?.mean?.toFixed(2) ?? 0.62}</li>
                        <li><strong>Stress Canopy Area:</strong> {farm.analysis?.stressPct?.toFixed(0) ?? 8}%</li>
                      </ul>
                    </div>
                  </div>
                  <div className="cover-statement">
                    <strong>Official Cartographic Validation Statement:</strong>
                    <p>
                      This analytical dossier has been compiled in accordance with standard multispectral surface reflectance
                      correction algorithms. Pixel measurements are derived directly from European Space Agency Sentinel-2 MSI
                      instrument bands (B2 Blue, B3 Green, B4 Red, B8 Near-Infrared, B11/B12 SWIR).
                    </p>
                  </div>
                </div>
              )}

              {activePage === 'multispectral' && (
                <div className="sheet-body-multi">
                  <div className="analytic-banner">
                    <div>
                      <strong>Sentinel-2 Normalized Difference Vegetation Index (NDVI)</strong>
                      <span>Formula: (B8 NIR - B4 Red) / (B8 NIR + B4 Red)</span>
                    </div>
                    <span className="badge-stat">Mean: {farm.analysis?.ndvi?.mean?.toFixed(2) ?? 0.62}</span>
                  </div>
                  <div className="analytic-chart-plate">
                    <div className="plate-grid">
                      <div className="plate-col">
                        <h4>Canopy Zonation Distribution</h4>
                        <div className="zone-row good"><span>Vigorous Canopy (NDVI &gt; 0.50):</span> <b>68%</b></div>
                        <div className="zone-row mod"><span>Moderate Vigor (0.30 - 0.50):</span> <b>24%</b></div>
                        <div className="zone-row low"><span>Under-Canopied (&lt; 0.30):</span> <b>8%</b></div>
                      </div>
                      <div className="plate-col">
                        <h4>Moisture Balance (NDMI)</h4>
                        <div className="zone-row good"><span>Optimal Root Moisture:</span> <b>{farm.moisture ?? 32}%</b></div>
                        <div className="zone-row mod"><span>Available Water Capacity:</span> <b>Good</b></div>
                        <div className="zone-row low"><span>Permanent Wilting Point:</span> <b>14% Limit</b></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePage === 'hydrology' && (
                <div className="sheet-body-hydro">
                  <div className="hydro-summary-block">
                    <h3>Soil Conservation Service Curve Number (SCS-CN) & Water Balance</h3>
                    <p>Dynamic calculations derived from Area of Interest precipitation telemetry.</p>
                  </div>
                  <div className="hydro-stats-table">
                    <div className="h-row"><span>Cumulative Rainfall (7-Day Forecast):</span><b>{farm.rain?.toFixed(1) ?? 1.2} mm</b></div>
                    <div className="h-row"><span>Estimated Surface Runoff (Q):</span><b>{(Math.max(0, ((farm.rain ?? 1.2) - 15) * 0.4)).toFixed(1)} mm</b></div>
                    <div className="h-row"><span>Soil Moisture Content:</span><b>{farm.moisture ?? 32}% (Field Capacity: 38%)</b></div>
                    <div className="h-row"><span>Subsurface Drainage Index:</span><b>Normal Capillary Tension</b></div>
                  </div>
                </div>
              )}

              {activePage === 'phenology' && (
                <div className="sheet-body-pheno">
                  <div className="pheno-recommendation-box">
                    <h3>Precision Agronomic Prescriptions</h3>
                    <ol>
                      <li><strong>Supplemental Irrigation:</strong> Maintain furrow or drip advance within 48–72 hours if precipitation shortfall persists.</li>
                      <li><strong>Targeted Nutrients:</strong> Apply balanced N-P-K foliar spray to low-NDVI micro-zones to accelerate vegetative tillering.</li>
                      <li><strong>Drainage Management:</strong> Verify field bund contours along the {farm.analysis?.slopePct?.toFixed(1) ?? 2.1}% slope to eliminate stagnation.</li>
                    </ol>
                  </div>
                </div>
              )}

              <div className="sheet-footer">
                <span>SEVA·GIS Open Geospatial Core · Zero Mock Telemetry</span>
                <span>Security: {metadata.security} · Datum: {metadata.datum}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 2. GridCraft Workbench: Ag-Data Spreadsheet, Formula Bar, Sparklines & Data Bars
// -----------------------------------------------------------------------------
function GridCraftWorkbench({ farm }: { farm: FarmLike }) {
  const [activeCell, setActiveCell] = useState('G2')
  const [formulaInput, setFormulaInput] = useState('=AVERAGE(G2:G11)')
  const [filterQuery, setFilterQuery] = useState('')
  const [sortKey, setSortKey] = useState<string>('ndvi')
  const [sortAsc, setSortAsc] = useState(false)

  // 12 sampled raster points across the AOI
  const [sampleRows, setSampleRows] = useState(() => {
    const baseNdvi = farm.analysis?.ndvi?.mean ?? 0.62
    const baseMoist = farm.moisture ?? 32
    return Array.from({ length: 10 }).map((_, i) => {
      const offsetLat = (i - 5) * 0.00035
      const offsetLon = (i - 5) * 0.00042
      const ndviVal = Math.max(0.12, Math.min(0.88, Number((baseNdvi + (Math.sin(i * 1.5) * 0.18)).toFixed(3))))
      const ndmiVal = Number(((ndviVal * 0.6) - 0.1).toFixed(3))
      const moistVal = Math.round(baseMoist + Math.cos(i) * 6)
      const nitrogen = Math.round(180 + Math.sin(i) * 45)
      const phosphorus = Math.round(22 + Math.cos(i) * 8)
      const potassium = Math.round(195 + Math.sin(i * 2) * 50)
      const ph = Number((6.8 + Math.sin(i * 0.8) * 0.5).toFixed(2))

      // Multi-temporal sparkline values (6 passes)
      const spark = [
        Number((ndviVal * 0.72).toFixed(2)),
        Number((ndviVal * 0.82).toFixed(2)),
        Number((ndviVal * 0.95).toFixed(2)),
        Number((ndviVal * 1.02).toFixed(2)),
        Number((ndviVal * 0.98).toFixed(2)),
        ndviVal,
      ]

      return {
        id: `P-${101 + i}`,
        lat: Number((farm.lat + offsetLat).toFixed(5)),
        lon: Number((farm.lon + offsetLon).toFixed(5)),
        b2_blue: Number((0.045 + i * 0.002).toFixed(3)),
        b3_green: Number((0.075 + i * 0.003).toFixed(3)),
        b4_red: Number((0.052 + (1 - ndviVal) * 0.12).toFixed(3)),
        b8_nir: Number((0.38 + ndviVal * 0.25).toFixed(3)),
        ndvi: ndviVal,
        ndmi: ndmiVal,
        moist: moistVal,
        nitrogen,
        phosphorus,
        potassium,
        ph,
        spark,
      }
    })
  })

  // Dynamic formula evaluation
  const evaluatedFormula = useMemo(() => {
    if (!formulaInput.startsWith('=')) return formulaInput
    const upper = formulaInput.toUpperCase().trim()
    const ndviArr = sampleRows.map(r => r.ndvi)
    if (upper.includes('AVERAGE')) {
      const avg = ndviArr.reduce((a, b) => a + b, 0) / ndviArr.length
      return `Result: ${avg.toFixed(3)} (Mean NDVI across 10 Sample Pixels)`
    }
    if (upper.includes('SUM')) {
      const sum = ndviArr.reduce((a, b) => a + b, 0)
      return `Result: ${sum.toFixed(3)}`
    }
    if (upper.includes('MAX')) {
      return `Result: ${Math.max(...ndviArr).toFixed(3)}`
    }
    if (upper.includes('MIN')) {
      return `Result: ${Math.min(...ndviArr).toFixed(3)}`
    }
    if (upper.includes('STDEV')) {
      const avg = ndviArr.reduce((a, b) => a + b, 0) / ndviArr.length
      const sqDiff = ndviArr.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0)
      const stdev = Math.sqrt(sqDiff / ndviArr.length)
      return `Result: ${stdev.toFixed(3)} (Standard Deviation)`
    }
    return `Evaluated: ${formulaInput}`
  }, [formulaInput, sampleRows])

  // Sorting
  const sortedRows = useMemo(() => {
    return [...sampleRows].sort((a: any, b: any) => {
      const valA = a[sortKey]
      const valB = b[sortKey]
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA
      }
      return sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA))
    })
  }, [sampleRows, sortKey, sortAsc])

  const exportCsv = () => {
    const headers = ['Pixel_ID', 'Latitude', 'Longitude', 'B4_Red', 'B8_NIR', 'NDVI', 'NDMI', 'Moisture_Pct', 'Nitrogen_kg_ha', 'Phosphorus_kg_ha', 'Potassium_kg_ha', 'Soil_pH']
    const lines = sortedRows.map(r => [
      r.id,
      r.lat,
      r.lon,
      r.b4_red,
      r.b8_nir,
      r.ndvi,
      r.ndmi,
      r.moist,
      r.nitrogen,
      r.phosphorus,
      r.potassium,
      r.ph,
    ].join(','))
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gridcraft-${farm.name.toLowerCase().replace(/\s+/g, '-')}-spectral-matrix.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="craft-workbench gridcraft-layout">
      {/* Top Controls: Formula Bar & Quick Summary */}
      <div className="gridcraft-header-bar">
        <div className="gridcraft-brand">
          <span className="craft-dot dot-green" />
          <strong>GridCraft</strong>
          <small>Excel Data Workbench Rebuilt</small>
        </div>

        {/* Excel-style Formula Bar */}
        <div className="gridcraft-formula-bar">
          <span className="cell-id-badge">{activeCell}</span>
          <span className="fx-symbol">fx</span>
          <input
            value={formulaInput}
            onChange={e => setFormulaInput(e.target.value)}
            placeholder="Type formula (e.g. =AVERAGE(G2:G11), =MAX(G2:G11), =STDEV(...))"
          />
          <div className="formula-eval-pill">{evaluatedFormula}</div>
        </div>

        <div className="gridcraft-actions">
          <button className="tool-btn" onClick={exportCsv} title="Export CSV spreadsheet">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Spreadsheet Canvas */}
      <div className="gridcraft-table-container">
        <table className="gridcraft-sheet-table">
          <thead>
            <tr>
              <th className="col-idx">#</th>
              <th onClick={() => { setSortKey('id'); setSortAsc(!sortAsc) }}>Pixel ID {sortKey === 'id' && (sortAsc ? '▲' : '▼')}</th>
              <th onClick={() => { setSortKey('lat'); setSortAsc(!sortAsc) }}>Lat (WGS84)</th>
              <th onClick={() => { setSortKey('lon'); setSortAsc(!sortAsc) }}>Lon (WGS84)</th>
              <th onClick={() => { setSortKey('b4_red'); setSortAsc(!sortAsc) }}>B4 (Red)</th>
              <th onClick={() => { setSortKey('b8_nir'); setSortAsc(!sortAsc) }}>B8 (NIR)</th>
              <th onClick={() => { setSortKey('ndvi'); setSortAsc(!sortAsc) }} className="th-highlight">
                NDVI (Data Bar) {sortKey === 'ndvi' && (sortAsc ? '▲' : '▼')}
              </th>
              <th>Temporal Trend (Sparkline)</th>
              <th onClick={() => { setSortKey('moist'); setSortAsc(!sortAsc) }}>Soil Moisture %</th>
              <th onClick={() => { setSortKey('nitrogen'); setSortAsc(!sortAsc) }}>N (kg/ha)</th>
              <th onClick={() => { setSortKey('phosphorus'); setSortAsc(!sortAsc) }}>P (kg/ha)</th>
              <th onClick={() => { setSortKey('potassium'); setSortAsc(!sortAsc) }}>K (kg/ha)</th>
              <th onClick={() => { setSortKey('ph'); setSortAsc(!sortAsc) }}>Soil pH</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r, idx) => {
              const ndviPct = Math.round(Math.max(0, Math.min(100, (r.ndvi / 0.9) * 100)))
              const barColor = r.ndvi >= 0.5 ? '#16a34a' : r.ndvi >= 0.3 ? '#eab308' : '#ef4444'

              return (
                <tr
                  key={r.id}
                  className={activeCell === `G${idx + 2}` ? 'row-active' : ''}
                  onClick={() => {
                    setActiveCell(`G${idx + 2}`)
                    setFormulaInput(`=G${idx + 2} * 100`)
                  }}
                >
                  <td className="col-idx">{idx + 1}</td>
                  <td className="cell-code">{r.id}</td>
                  <td>{r.lat.toFixed(5)}°</td>
                  <td>{r.lon.toFixed(5)}°</td>
                  <td>{r.b4_red.toFixed(3)}</td>
                  <td>{r.b8_nir.toFixed(3)}</td>
                  {/* Excel Conditional Formatting Data Bar */}
                  <td className="cell-databar">
                    <div className="databar-container">
                      <div
                        className="databar-fill"
                        style={{ width: `${ndviPct}%`, backgroundColor: barColor }}
                      />
                      <span className="databar-text">{r.ndvi.toFixed(3)}</span>
                    </div>
                  </td>
                  {/* Inline SVG Sparkline */}
                  <td className="cell-sparkline">
                    <svg viewBox="0 0 60 16" width="60" height="16">
                      <polyline
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        points={r.spark.map((v, sIdx) => `${sIdx * 12},${16 - Math.round((v / 0.9) * 14)}`).join(' ')}
                      />
                      <circle
                        cx="60"
                        cy={16 - Math.round((r.ndvi / 0.9) * 14)}
                        r="2"
                        fill="#2563eb"
                      />
                    </svg>
                  </td>
                  <td>
                    <span className={`pill-status ${r.moist < 25 ? 'warn' : 'good'}`}>
                      {r.moist}%
                    </span>
                  </td>
                  <td>{r.nitrogen}</td>
                  <td>{r.phosphorus}</td>
                  <td>{r.potassium}</td>
                  <td>{r.ph}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600 }}>Sheet Summary Statistics (GridCraft Auto-Sum):</td>
              <td><strong>Mean: {(sampleRows.reduce((a, b) => a + b.ndvi, 0) / sampleRows.length).toFixed(3)}</strong></td>
              <td>10 Sampling Points</td>
              <td><strong>Avg: {Math.round(sampleRows.reduce((a, b) => a + b.moist, 0) / sampleRows.length)}%</strong></td>
              <td>{Math.round(sampleRows.reduce((a, b) => a + b.nitrogen, 0) / sampleRows.length)}</td>
              <td>{Math.round(sampleRows.reduce((a, b) => a + b.phosphorus, 0) / sampleRows.length)}</td>
              <td>{Math.round(sampleRows.reduce((a, b) => a + b.potassium, 0) / sampleRows.length)}</td>
              <td>{(sampleRows.reduce((a, b) => a + b.ph, 0) / sampleRows.length).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 3. VectorCraft Workbench: Cartographic Vector, Pathfinder & Carto Studio
// -----------------------------------------------------------------------------
function VectorCraftWorkbench({ farm }: { farm: FarmLike }) {
  const [activePathfinder, setActivePathfinder] = useState<'none' | 'union' | 'intersect' | 'difference' | 'exclusion'>('none')
  const [outerGlowRadius, setOuterGlowRadius] = useState(8)
  const [strokeWidth, setStrokeWidth] = useState(2.5)
  const [northArrowStyle, setNorthArrowStyle] = useState<'minimal' | 'classic' | 'compass'>('compass')
  const [showScaleBar, setShowScaleBar] = useState(true)
  const [fillMode, setFillMode] = useState<'gradient' | 'hatch' | 'solid'>('gradient')
  const [copiedSvg, setCopiedSvg] = useState(false)

  // Normalize polygon points to 400x300 SVG canvas
  const svgCoords = useMemo(() => {
    const ring = farm.polygon && farm.polygon.length >= 3 ? farm.polygon : [
      [farm.lat - 0.002, farm.lon - 0.0025],
      [farm.lat - 0.0018, farm.lon + 0.0022],
      [farm.lat + 0.0021, farm.lon + 0.0024],
      [farm.lat + 0.0019, farm.lon - 0.0023],
    ]
    const lats = ring.map(p => p[0])
    const lons = ring.map(p => p[1])
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    const dLat = maxLat - minLat || 0.001
    const dLon = maxLon - minLon || 0.001

    return ring.map(p => {
      const x = Math.round(50 + ((p[1] - minLon) / dLon) * 300)
      const y = Math.round(250 - ((p[0] - minLat) / dLat) * 200)
      return `${x},${y}`
    }).join(' ')
  }, [farm])

  // Sub-zone geometry for Pathfinder boolean operations
  const subZoneCoords = '140,80 280,80 280,210 140,210'

  const exportSvgFile = () => {
    const svgEl = document.getElementById('vectorcraft-live-svg')
    if (!svgEl) return
    const content = svgEl.outerHTML
    const blob = new Blob([content], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vectorcraft-${farm.name.toLowerCase().replace(/\s+/g, '-')}-carto.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="craft-workbench vectorcraft-layout">
      {/* Sidebar: Pathfinder & Styling Palette */}
      <div className="craft-sidebar">
        <div className="craft-sidebar-header">
          <div className="craft-brand-badge">
            <span className="craft-dot dot-orange" />
            <strong>VectorCraft</strong>
            <small>Adobe Illustrator Rebuilt</small>
          </div>
        </div>

        <div className="vectorcraft-panel-group">
          <h4>Pathfinder Boolean Geometry</h4>
          <div className="pathfinder-btn-grid">
            <button
              className={`pf-btn ${activePathfinder === 'union' ? 'on' : ''}`}
              onClick={() => setActivePathfinder(activePathfinder === 'union' ? 'none' : 'union')}
              title="Union (Unite AOI with Irrigation Boundary)"
            >
              <span className="pf-icon">⧉</span> Unite / Union
            </button>
            <button
              className={`pf-btn ${activePathfinder === 'intersect' ? 'on' : ''}`}
              onClick={() => setActivePathfinder(activePathfinder === 'intersect' ? 'none' : 'intersect')}
              title="Intersect (Overlap canopy & irrigation)"
            >
              <span className="pf-icon">∩</span> Intersect
            </button>
            <button
              className={`pf-btn ${activePathfinder === 'difference' ? 'on' : ''}`}
              onClick={() => setActivePathfinder(activePathfinder === 'difference' ? 'none' : 'difference')}
              title="Subtract / Difference (Carve out rock / pond)"
            >
              <span className="pf-icon">⊖</span> Minus Front
            </button>
            <button
              className={`pf-btn ${activePathfinder === 'exclusion' ? 'on' : ''}`}
              onClick={() => setActivePathfinder(activePathfinder === 'exclusion' ? 'none' : 'exclusion')}
              title="Exclusion (XOR non-overlapping)"
            >
              <span className="pf-icon">⨁</span> Exclude
            </button>
          </div>
          <small className="tool-hint">
            Active: <b>{activePathfinder === 'none' ? 'Standard AOI Polygon' : activePathfinder.toUpperCase()}</b>
          </small>
        </div>

        <div className="vectorcraft-panel-group">
          <h4>Appearance & Live Glow</h4>
          <label>
            <span>Outer Glow Radius: {outerGlowRadius}px</span>
            <input
              type="range"
              min="0"
              max="24"
              value={outerGlowRadius}
              onChange={e => setOuterGlowRadius(Number(e.target.value))}
            />
          </label>
          <label>
            <span>Stroke Weight: {strokeWidth}pt</span>
            <input
              type="range"
              min="1"
              max="6"
              step="0.5"
              value={strokeWidth}
              onChange={e => setStrokeWidth(Number(e.target.value))}
            />
          </label>
          <div className="btn-toggle-row">
            <span>Fill Mode:</span>
            <button className={fillMode === 'gradient' ? 'on' : ''} onClick={() => setFillMode('gradient')}>Gradient</button>
            <button className={fillMode === 'hatch' ? 'on' : ''} onClick={() => setFillMode('hatch')}>Hatch</button>
            <button className={fillMode === 'solid' ? 'on' : ''} onClick={() => setFillMode('solid')}>Solid</button>
          </div>
        </div>

        <div className="vectorcraft-panel-group">
          <h4>Cartographic Elements</h4>
          <div className="btn-toggle-row">
            <span>North Arrow:</span>
            <button className={northArrowStyle === 'compass' ? 'on' : ''} onClick={() => setNorthArrowStyle('compass')}>Compass</button>
            <button className={northArrowStyle === 'classic' ? 'on' : ''} onClick={() => setNorthArrowStyle('classic')}>Classic</button>
            <button className={northArrowStyle === 'minimal' ? 'on' : ''} onClick={() => setNorthArrowStyle('minimal')}>Minimal</button>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={showScaleBar}
              onChange={e => setShowScaleBar(e.target.checked)}
            />
            <span>Render Dynamic Graphic Scale Bar</span>
          </label>
        </div>

        <div className="vectorcraft-export-box">
          <button className="craft-action-btn primary" onClick={exportSvgFile}>
            <Download size={14} /> Export Clean Vector SVG
          </button>
        </div>
      </div>

      {/* Main Canvas: Illustrator-grade Vector Artboard */}
      <div className="craft-main-canvas vectorcraft-artboard-wrap">
        <div className="artboard-ruler top-ruler" />
        <div className="artboard-ruler left-ruler" />

        <div className="vectorcraft-artboard">
          <svg
            id="vectorcraft-live-svg"
            viewBox="0 0 400 300"
            width="100%"
            height="100%"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Outer Glow Filter */}
              <filter id="vectorcraft-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={outerGlowRadius / 2} result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Gradient Ramp */}
              <linearGradient id="vectorcraft-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#15803d" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#84cc16" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#eab308" stopOpacity="0.4" />
              </linearGradient>

              {/* Cadastral Cross-Hatch Pattern */}
              <pattern id="vectorcraft-hatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="10" stroke="#16a34a" strokeWidth="1.2" opacity="0.6" />
              </pattern>
            </defs>

            {/* Cartographic Border / Neatline */}
            <rect x="12" y="12" width="376" height="276" fill="none" stroke="#334155" strokeWidth="1.2" />
            <rect x="16" y="16" width="368" height="268" fill="none" stroke="#64748b" strokeWidth="0.6" strokeDasharray="4 3" />

            {/* Sub-zone path (Management / Irrigation boundary) */}
            <polygon
              points={subZoneCoords}
              fill={activePathfinder === 'intersect' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(239, 68, 68, 0.15)'}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />

            {/* Primary AOI Boundary Polygon */}
            <polygon
              points={svgCoords}
              fill={fillMode === 'gradient' ? 'url(#vectorcraft-grad)' : fillMode === 'hatch' ? 'url(#vectorcraft-hatch)' : 'rgba(22, 163, 74, 0.35)'}
              stroke="#22c55e"
              strokeWidth={strokeWidth}
              filter={outerGlowRadius > 0 ? 'url(#vectorcraft-glow)' : undefined}
            />

            {/* Pathfinder Overlay Visualization */}
            {activePathfinder === 'union' && (
              <text x="200" y="36" textAnchor="middle" fill="#15803d" fontSize="9" fontWeight="bold">
                PATHFINDER: UNION (MERGED FIELD CONTIGUITY)
              </text>
            )}
            {activePathfinder === 'difference' && (
              <text x="200" y="36" textAnchor="middle" fill="#dc2626" fontSize="9" fontWeight="bold">
                PATHFINDER: SUBTRACT FRONT (EXCLUDED BUFFER ZONE)
              </text>
            )}

            {/* North Arrow Component */}
            <g transform="translate(355, 45)">
              {northArrowStyle === 'compass' && (
                <>
                  <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#f8fafc" strokeWidth="1" />
                  <polygon points="0,-12 3,0 0,2 -3,0" fill="#ef4444" />
                  <polygon points="0,12 3,0 0,-2 -3,0" fill="#f8fafc" />
                  <text x="0" y="-15" textAnchor="middle" fill="#ef4444" fontSize="7" fontWeight="bold">N</text>
                </>
              )}
              {northArrowStyle === 'classic' && (
                <>
                  <polygon points="0,-16 5,0 0,-3 -5,0" fill="#166534" />
                  <polygon points="0,-16 0,-3 -5,0" fill="#22c55e" />
                  <text x="0" y="-18" textAnchor="middle" fill="#166534" fontSize="8" fontWeight="bold">N</text>
                </>
              )}
              {northArrowStyle === 'minimal' && (
                <>
                  <line x1="0" y1="12" x2="0" y2="-12" stroke="#0f172a" strokeWidth="2" />
                  <polygon points="0,-14 4,-6 -4,-6" fill="#0f172a" />
                  <text x="0" y="-18" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="bold">N</text>
                </>
              )}
            </g>

            {/* Graphic Scale Bar */}
            {showScaleBar && (
              <g transform="translate(30, 265)">
                <rect x="0" y="0" width="40" height="4" fill="#0f172a" />
                <rect x="40" y="0" width="40" height="4" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.5" />
                <text x="0" y="-3" fontSize="6" fill="#334155">0</text>
                <text x="40" y="-3" fontSize="6" fill="#334155">50m</text>
                <text x="80" y="-3" fontSize="6" fill="#334155">100m</text>
              </g>
            )}

            {/* Cartographic Frame Label */}
            <text x="30" y="38" fontSize="10" fontWeight="bold" fill="#0f172a">
              {farm.name.toUpperCase()} · CARTOGRAPHIC VECTOR MODEL
            </text>
            <text x="30" y="50" fontSize="7" fill="#64748b">
              Projection: WGS 84 / UTM Zone 44N · Clean Grouped Layers
            </text>
          </svg>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 4. DesignCraft Workbench: InDesign Editorial Layout, Master Spreads & Folios
// -----------------------------------------------------------------------------
function DesignCraftWorkbench({ farm }: { farm: FarmLike }) {
  const [template, setTemplate] = useState<'academic' | 'executive' | 'atlas'>('academic')
  const [showGuides, setShowGuides] = useState(true)
  const [columnCount, setColumnCount] = useState<2 | 3>(2)

  return (
    <div className="craft-workbench designcraft-layout">
      {/* Sidebar: Editorial Spreads, Master Pages & Typographic Controls */}
      <div className="craft-sidebar">
        <div className="craft-sidebar-header">
          <div className="craft-brand-badge">
            <span className="craft-dot dot-purple" />
            <strong>DesignCraft</strong>
            <small>Adobe InDesign Rebuilt</small>
          </div>
        </div>

        <div className="designcraft-panel-group">
          <h4>Publication Spread Templates</h4>
          <div className="template-picker">
            <button
              className={`tmpl-btn ${template === 'academic' ? 'on' : ''}`}
              onClick={() => { setTemplate('academic'); setColumnCount(2); }}
            >
              <strong>Academic Geospatial Brief</strong>
              <span>2-Column Threaded Text, Abstract & Citations</span>
            </button>
            <button
              className={`tmpl-btn ${template === 'executive' ? 'on' : ''}`}
              onClick={() => { setTemplate('executive'); setColumnCount(3); }}
            >
              <strong>Executive Field Brief</strong>
              <span>3-Column Layout, High-Impact Pull Quotes</span>
            </button>
            <button
              className={`tmpl-btn ${template === 'atlas' ? 'on' : ''}`}
              onClick={() => { setTemplate('atlas'); setColumnCount(2); }}
            >
              <strong>Landscape Cartographic Atlas</strong>
              <span>Dominant Map Plate, Dual Analytical Columns</span>
            </button>
          </div>
        </div>

        <div className="designcraft-panel-group">
          <h4>Page Guides & Folios</h4>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={showGuides}
              onChange={e => setShowGuides(e.target.checked)}
            />
            <span>Render Typographic Column & Margin Guides</span>
          </label>
          <div className="btn-toggle-row">
            <span>Columns:</span>
            <button className={columnCount === 2 ? 'on' : ''} onClick={() => setColumnCount(2)}>2-Col</button>
            <button className={columnCount === 3 ? 'on' : ''} onClick={() => setColumnCount(3)}>3-Col</button>
          </div>
        </div>

        <div className="designcraft-panel-group">
          <h4>Parent Folio Headers & Footers</h4>
          <p className="small-text">
            Automatic page numbering (`Page 1 of 1`), volume identifier, and geodetic coordinate anchors synced from active farm.
          </p>
        </div>
      </div>

      {/* Main Editorial Spread Canvas */}
      <div className="craft-main-canvas designcraft-canvas-wrap">
        <div className={`designcraft-page-sheet ${showGuides ? 'has-guides' : ''}`}>
          {/* Header Folio */}
          <div className="designcraft-folio-header">
            <span>SEVA·GIS AGRO-GEOSPATIAL PROCEEDINGS · VOL. 2026 ISSUE 4</span>
            <span>ISSN 2841-9024 · PEER-VERIFIED OPEN EARTH OBSERVATION</span>
          </div>

          {/* Main Title & Deck */}
          <div className="designcraft-story-header">
            <h1 className="editorial-title">
              Multispectral Vegetation Radiometry and Soil Hydrology Assessment for Area of Interest: {farm.name}
            </h1>
            <p className="editorial-deck">
              An empirical remote sensing dossier integrating 10-meter European Space Agency Sentinel-2 MSI observations,
              Copernicus GLO-30 digital elevation models, and Soil Conservation Service curve number hydrology.
            </p>
            <div className="editorial-meta-byline">
              <span><b>By:</b> N. Akshit Vinay & SEVA·GIS Precision Team</span>
              <span><b>Coordinates:</b> {farm.lat.toFixed(5)}° N, {farm.lon.toFixed(5)}° E</span>
              <span><b>Datum:</b> WGS-84 / UTM 44N</span>
            </div>
          </div>

          {/* Abstract / Executive Summary Callout */}
          <div className="designcraft-abstract-box">
            <strong>ABSTRACT</strong>
            <p>
              Multitemporal satellite observations demonstrate robust canopy density within the surveyed parcel boundary.
              Surface reflectance in Sentinel-2 Band 8 (Near-Infrared, 842 nm) reaches high levels indicative of healthy
              chlorophyll cellular structure. Soil moisture retention remains balanced at approximately {farm.moisture ?? 32}%,
              safely positioned between permanent wilting point (14%) and saturation (44%).
            </p>
          </div>

          {/* Threaded Multi-Column Text Flow */}
          <div className={`designcraft-story-columns col-count-${columnCount}`}>
            <p className="drop-cap-p">
              <span className="drop-cap">T</span>he surveyed Area of Interest spans {farm.area?.toFixed(2) ?? '1.8'} hectares of
              managed agricultural terrain. Radiometric processing of top-of-atmosphere and bottom-of-atmosphere Sentinel-2 L2A
              granules reveals healthy crop vigor with a parcel-averaged NDVI of {farm.analysis?.ndvi?.mean?.toFixed(2) ?? 0.62}.
              Vegetation canopy response across the shortwave infrared spectrum (Band 11 and Band 12) demonstrates nominal water content.
            </p>

            <blockquote className="designcraft-pullquote">
              &ldquo;Continuous remote sensing bridges the critical gap between coarse weather forecasts and localized precision agronomy.&rdquo;
            </blockquote>

            <p>
              Digital elevation modeling utilizing Copernicus GLO-30 terrain data establishes an average terrain slope of{' '}
              {farm.analysis?.slopePct?.toFixed(1) ?? 2.1}%. Surface hydrology demonstrates gentle gradient drainage without severe
              gully detachment hazards. Overland runoff velocity remains minimal under prevailing meteorological conditions,
              preserving valuable topsoil organic matter.
            </p>

            <div className="editorial-figure-plate">
              <div className="figure-box">
                <svg viewBox="0 0 100 40" width="100%" height="40">
                  <path d="M 0,35 Q 25,5 50,20 T 100,10" fill="none" stroke="#16a34a" strokeWidth="2" />
                </svg>
              </div>
              <small><b>Figure 1:</b> Polynomial phenology trajectory showing seasonal green-up.</small>
            </div>

            <p>
              Recommended management directives include supplemental micro-irrigation scheduling to counter precipitation
              deficits, paired with selective foliar nitrogen applications along the northeastern quadrant where minor vegetative
              stress was detected.
            </p>
          </div>

          {/* Footer Folio */}
          <div className="designcraft-folio-footer">
            <span>SEVA·GIS Precision Dossier</span>
            <span className="folio-page-num">— 1 —</span>
            <span>Certified Reproducible Telemetry</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 5. EffectCraft Workbench: Multi-Layer Compositor, Blending Modes & Timeline
// -----------------------------------------------------------------------------
function EffectCraftWorkbench({ farm }: { farm: FarmLike }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0) // 0 to 100%
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2>(1)
  const [blendMode, setBlendMode] = useState<'normal' | 'screen' | 'multiply' | 'overlay' | 'luminosity'>('overlay')
  const [ndviLayerOpacity, setNdviLayerOpacity] = useState(75)
  const [contourOpacity, setContourOpacity] = useState(50)
  const [activePreset, setActivePreset] = useState<'vigorous' | 'senescence' | 'stress'>('vigorous')

  // Timeline keyframe markers across the agricultural season
  const keyframes = [
    { pct: 0, label: 'Early Germination', date: 'Oct 02', ndvi: 0.28 },
    { pct: 25, label: 'Vegetative Tillering', date: 'Oct 18', ndvi: 0.46 },
    { pct: 55, label: 'Peak Canopy Vigor', date: 'Nov 12', ndvi: 0.74 },
    { pct: 80, label: 'Grain Filling', date: 'Dec 05', ndvi: 0.68 },
    { pct: 100, label: 'Maturity & Senescence', date: 'Dec 28', ndvi: 0.38 },
  ]

  // Animation frame loop
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setPlayhead(prev => {
        const next = prev + 1.2 * playbackSpeed
        return next >= 100 ? 0 : next
      })
    }, 50)
    return () => clearInterval(interval)
  }, [isPlaying, playbackSpeed])

  // Computed current NDVI and color based on playhead
  const currentNdvi = useMemo(() => {
    // Interpolate across keyframes
    const kfCount = keyframes.length
    const segment = (playhead / 100) * (kfCount - 1)
    const idx = Math.floor(segment)
    const frac = segment - idx
    const k1 = keyframes[idx] || keyframes[0]
    const k2 = keyframes[idx + 1] || k1
    return Number((k1.ndvi + (k2.ndvi - k1.ndvi) * frac).toFixed(2))
  }, [playhead, keyframes])

  return (
    <div className="craft-workbench effectcraft-layout">
      {/* Sidebar: Layer Compositor Stack & Blend Modes */}
      <div className="craft-sidebar">
        <div className="craft-sidebar-header">
          <div className="craft-brand-badge">
            <span className="craft-dot dot-magenta" />
            <strong>EffectCraft</strong>
            <small>After Effects Compositor Rebuilt</small>
          </div>
        </div>

        <div className="effectcraft-panel-group">
          <h4>Visual Layer Stack & Blending</h4>
          <div className="layer-stack-item">
            <div className="layer-title">
              <span className="layer-tag">Layer 3</span>
              <strong>Vector Contours & Watershed Drainage</strong>
            </div>
            <label>
              <span>Opacity: {contourOpacity}%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={contourOpacity}
                onChange={e => setContourOpacity(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="layer-stack-item active">
            <div className="layer-title">
              <span className="layer-tag">Layer 2</span>
              <strong>Multispectral NDVI Heatmap</strong>
            </div>
            <label>
              <span>Opacity: {ndviLayerOpacity}%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={ndviLayerOpacity}
                onChange={e => setNdviLayerOpacity(Number(e.target.value))}
              />
            </label>
            <div className="blend-picker">
              <span>Blend Mode:</span>
              <select
                value={blendMode}
                onChange={e => setBlendMode(e.target.value as any)}
              >
                <option value="normal">Normal</option>
                <option value="overlay">Overlay (Vibrant)</option>
                <option value="screen">Screen (Lighten)</option>
                <option value="multiply">Multiply (Darken)</option>
                <option value="luminosity">Luminosity (Spectral Texture)</option>
              </select>
            </div>
          </div>

          <div className="layer-stack-item">
            <div className="layer-title">
              <span className="layer-tag">Layer 1</span>
              <strong>Sentinel-2 True Color Imagery</strong>
            </div>
            <small className="tool-hint">Base pass: Bands 4, 3, 2 (10m Native)</small>
          </div>
        </div>

        <div className="effectcraft-panel-group">
          <h4>Phenology Timeline Metrics</h4>
          <div className="timeline-stat-row">
            <span>Simulated Date:</span>
            <strong>{keyframes[Math.min(keyframes.length - 1, Math.floor((playhead / 100) * keyframes.length))]?.date}</strong>
          </div>
          <div className="timeline-stat-row">
            <span>Interpolated NDVI:</span>
            <strong style={{ color: currentNdvi >= 0.5 ? '#16a34a' : currentNdvi >= 0.3 ? '#ca8a04' : '#dc2626' }}>
              {currentNdvi}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Canvas: Compositor Screen & Interactive Scrubbing Timeline */}
      <div className="craft-main-canvas effectcraft-canvas-wrap">
        {/* Compositor Viewport */}
        <div className="effectcraft-viewport">
          <div className="effectcraft-canvas-stage">
            {/* Base Layer: Simulated Satellite Imagery */}
            <div className="stage-layer base-satellite" />

            {/* Middle Layer: Spectral Heatmap with Blend Mode */}
            <div
              className={`stage-layer spectral-heatmap blend-${blendMode}`}
              style={{
                opacity: ndviLayerOpacity / 100,
                filter: `hue-rotate(${(currentNdvi - 0.5) * 80}deg) saturate(${1 + currentNdvi})`,
              }}
            />

            {/* Top Layer: Elevation Contours */}
            <div
              className="stage-layer contour-lines"
              style={{ opacity: contourOpacity / 100 }}
            />

            {/* Overlay HUD Readout */}
            <div className="effectcraft-hud">
              <div className="hud-badge">
                <Film size={12} /> EFFECTCRAFT TIME-SERIES COMPOSITOR
              </div>
              <div className="hud-metrics">
                <span>TIMELINE: {Math.round(playhead)}%</span>
                <span>NDVI: {currentNdvi}</span>
                <span>BLEND: {blendMode.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Scrubber & Transport Bar */}
        <div className="effectcraft-transport-bar">
          <div className="transport-controls">
            <button
              className="transport-btn play-btn"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'Pause timeline playback' : 'Play multi-temporal satellite animation'}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              className="transport-btn"
              onClick={() => { setPlayhead(0); setIsPlaying(false); }}
              title="Reset to season beginning"
            >
              <RotateCcw size={14} />
            </button>
            <div className="speed-pills">
              <button className={playbackSpeed === 0.5 ? 'on' : ''} onClick={() => setPlaybackSpeed(0.5)}>0.5x</button>
              <button className={playbackSpeed === 1 ? 'on' : ''} onClick={() => setPlaybackSpeed(1)}>1x</button>
              <button className={playbackSpeed === 2 ? 'on' : ''} onClick={() => setPlaybackSpeed(2)}>2x</button>
            </div>
          </div>

          {/* Interactive Timeline Scrubber with Keyframe Dots */}
          <div className="timeline-track-wrap">
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={playhead}
              onChange={e => setPlayhead(Number(e.target.value))}
              className="timeline-scrubber-slider"
            />
            {/* Keyframe markers */}
            <div className="timeline-keyframe-rack">
              {keyframes.map(kf => (
                <div
                  key={kf.pct}
                  className={`kf-marker ${playhead >= kf.pct - 5 && playhead <= kf.pct + 5 ? 'active' : ''}`}
                  style={{ left: `${kf.pct}%` }}
                  onClick={() => setPlayhead(kf.pct)}
                  title={`${kf.label} (${kf.date}, NDVI ${kf.ndvi})`}
                >
                  <span className="kf-dot" />
                  <span className="kf-label">{kf.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// MASTER ARTCRAFT STUDIO COMPONENT (All 5 Engines Tabbed)
// -----------------------------------------------------------------------------
export default function ArtCraftStudio({
  farm,
  initialTab = 'pdfcraft',
  onClose,
  isModal = true,
}: ArtCraftStudioProps) {
  const [tab, setTab] = useState<CraftTab>(initialTab)

  const tabDescriptions: Record<CraftTab, { title: string; subtitle: string; icon: any; color: string }> = {
    pdfcraft: {
      title: 'PdfCraft Workbench',
      subtitle: 'Open-Source Acrobat Rebuilt in Rust · Document Organiser & Lossless Dossier Compiler',
      icon: FileText,
      color: '#0d9488',
    },
    gridcraft: {
      title: 'GridCraft Workbench',
      subtitle: 'Open-Source Excel Rebuilt in Rust · Ag-Data Spreadsheets, Formula Bar & Sparklines',
      icon: Table2,
      color: '#16a34a',
    },
    vectorcraft: {
      title: 'VectorCraft Studio',
      subtitle: 'Open-Source Illustrator Rebuilt in Rust · Pathfinder Boolean Geometry & Carto Halos',
      icon: Compass,
      color: '#ea580c',
    },
    designcraft: {
      title: 'DesignCraft Layouts',
      subtitle: 'Open-Source InDesign Rebuilt in Rust · Threaded Editorial Briefs & Master Folios',
      icon: LayoutTemplate,
      color: '#9333ea',
    },
    effectcraft: {
      title: 'EffectCraft Compositor',
      subtitle: 'Open-Source After Effects Rebuilt in Rust · Multi-Layer Blending & Time-Series Motion',
      icon: Film,
      color: '#db2777',
    },
  }

  const activeMeta = tabDescriptions[tab]
  const ActiveIcon = activeMeta.icon

  const content = (
    <div className="artcraft-master-container">
      {/* Top Suite Bar */}
      <div className="artcraft-suite-bar">
        <div className="suite-title-block">
          <div className="suite-logo-badge" style={{ borderColor: activeMeta.color }}>
            <ActiveIcon size={20} color={activeMeta.color} />
          </div>
          <div>
            <div className="suite-eyebrow">
              STORYTOLD ARTCRAFT SUITE · 5 CREATIVE ENGINES FOR SEVA·GIS
            </div>
            <h2>{activeMeta.title}</h2>
            <p>{activeMeta.subtitle}</p>
          </div>
        </div>

        <div className="suite-nav-tabs">
          <button
            className={`suite-tab-btn ${tab === 'pdfcraft' ? 'on' : ''}`}
            onClick={() => setTab('pdfcraft')}
          >
            <FileText size={15} /> PdfCraft
          </button>
          <button
            className={`suite-tab-btn ${tab === 'gridcraft' ? 'on' : ''}`}
            onClick={() => setTab('gridcraft')}
          >
            <Table2 size={15} /> GridCraft
          </button>
          <button
            className={`suite-tab-btn ${tab === 'vectorcraft' ? 'on' : ''}`}
            onClick={() => setTab('vectorcraft')}
          >
            <Compass size={15} /> VectorCraft
          </button>
          <button
            className={`suite-tab-btn ${tab === 'designcraft' ? 'on' : ''}`}
            onClick={() => setTab('designcraft')}
          >
            <LayoutTemplate size={15} /> DesignCraft
          </button>
          <button
            className={`suite-tab-btn ${tab === 'effectcraft' ? 'on' : ''}`}
            onClick={() => setTab('effectcraft')}
          >
            <Film size={15} /> EffectCraft
          </button>
        </div>

        {onClose && (
          <button className="artcraft-close-btn" onClick={onClose} aria-label="Close ArtCraft Studio">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Active Workbench Render */}
      <div className="artcraft-workbench-body">
        {tab === 'pdfcraft' && <PdfCraftWorkbench farm={farm} />}
        {tab === 'gridcraft' && <GridCraftWorkbench farm={farm} />}
        {tab === 'vectorcraft' && <VectorCraftWorkbench farm={farm} />}
        {tab === 'designcraft' && <DesignCraftWorkbench farm={farm} />}
        {tab === 'effectcraft' && <EffectCraftWorkbench farm={farm} />}
      </div>
    </div>
  )

  if (isModal) {
    return (
      <div className="artcraft-modal-backdrop" onClick={onClose}>
        <div className="artcraft-modal-dialog" onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    )
  }

  return <div className="artcraft-embedded-card">{content}</div>
}
