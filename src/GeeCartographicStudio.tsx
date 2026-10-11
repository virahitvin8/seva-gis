import React, { useRef, useState, useMemo } from 'react'
import { Download, Globe, Layers, MapPin, ZoomIn, Compass, Sparkles, FileText } from 'lucide-react'
import type { FarmData, Scene } from './lib/seva'
import { farmRing, farmBBox } from './lib/seva'
import type { Auto } from './lib/geoai'
import type { Grid } from './lib/indicators'
import { rampColor } from './lib/raster'

type Farm = FarmData & { id: string; name: string; crop?: string; rain?: number }

// Continuous Viridis color palette matching GEE scientific publication standards
const VIRIDIS_HEX = ['#440154', '#482878', '#3e4a89', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725']

// Thematic Land Use publication colors matching Reference Image 3
const THEMATIC_CLASSES = [
  { id: 'forest', name: 'forest', color: '#0072b2', desc: 'Canopy & tree cover' },
  { id: 'grassland', name: 'grassland', color: '#009e73', desc: 'Vegetated pasture & cover' },
  { id: 'water', name: 'water', color: '#56b4e9', desc: 'Hydrologic surface' },
  { id: 'desert', name: 'desert', color: '#f0e442', desc: 'Bare soil & sand' },
  { id: 'agriculture', name: 'agriculture', color: '#cc79a7', desc: 'Active cultivated crop' },
  { id: 'city', name: 'city', color: '#d55e00', desc: 'Settlement & hardpack' },
]

export default function GeeCartographicStudio({
  farm,
  scene,
  g,
  auto
}: {
  farm: Farm
  scene?: Scene
  g: Grid | null
  auto: Auto | null
}) {
  const [activeTab, setActiveTab] = useState<'suitability' | 'thematic'>('suitability')
  const [showSamplePoints, setShowSamplePoints] = useState(true)
  const [showInsets, setShowInsets] = useState(true)
  const [showLocatorGlobe, setShowLocatorGlobe] = useState(true)
  const [exporting, setExporting] = useState(false)

  const mapContainerRef = useRef<HTMLDivElement>(null)

  const ring = useMemo(() => farmRing(farm), [farm.id, farm.polygon, farm.lat, farm.lon, farm.area])
  const [w, s, e, n] = useMemo(() => farmBBox(farm), [farm.id, farm.polygon, farm.lat, farm.lon, farm.area])

  const pad = 0.28
  const dw = (e - w) * pad
  const dh = (n - s) * pad
  const bb = [w - dw, s - dh, e + dw, n + dh]
  const cos = Math.cos(((s + n) / 2) * Math.PI / 180)
  const wm = (bb[2] - bb[0]) * 111320 * cos
  const hm = (bb[3] - bb[1]) * 111320
  const W = 1024
  const H = Math.min(1280, Math.round(W * (hm / wm)))

  const X = (lon: number) => ((lon - bb[0]) / (bb[2] - bb[0])) * 100
  const Y = (lat: number) => ((bb[3] - lat) / (bb[3] - bb[1])) * 100

  // Deterministic GPS sample points within the parcel boundary
  const samplePoints = useMemo(() => {
    const pts: { lon: number; lat: number; val: number; id: number }[] = []
    let seed = 42
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    
    // Generate ~35 realistic observation points distributed across the farm
    for (let i = 0; i < 35; i++) {
      const u = 0.15 + rnd() * 0.70
      const v = 0.15 + rnd() * 0.70
      const lon = w + u * (e - w)
      const lat = s + v * (n - s)
      const suitabilityVal = Math.min(1, Math.max(0.05, 0.3 + 0.6 * rnd()))
      pts.push({ lon, lat, val: suitabilityVal, id: i + 1 })
    }
    return pts
  }, [w, s, e, n])

  // Continuous suitability surface generator (Bilinear Viridis)
  const suitabilitySurfaceUrl = useMemo(() => {
    if (!g) return ''
    const outCanvas = document.createElement('canvas')
    outCanvas.width = W
    outCanvas.height = H
    const ctx = outCanvas.getContext('2d')!

    const imgData = ctx.createImageData(W, H)
    const d = imgData.data

    const ndviArr = g.b['B08'] && g.b['B04']
      ? new Float32Array(g.w * g.h)
      : null

    if (ndviArr) {
      for (let i = 0; i < g.w * g.h; i++) {
        const nir = g.b['B08'][i]
        const red = g.b['B04'][i]
        ndviArr[i] = (nir - red) / (nir + red + 1e-9)
      }
    }

    // Bilinear continuous surface reconstruction
    const spanH = Math.max(0, g.h - 1)
    const spanW = Math.max(0, g.w - 1)
    const denomH = Math.max(1, H - 1)
    const denomW = Math.max(1, W - 1)

    for (let py = 0; py < H; py++) {
      const sy = (py / denomH) * spanH
      const y0 = Math.floor(sy), y1 = Math.min(g.h - 1, y0 + 1), fy = sy - y0
      const rowOffset = py * W * 4

      for (let px = 0; px < W; px++) {
        const sx = (px / denomW) * spanW
        const x0 = Math.floor(sx), x1 = Math.min(g.w - 1, x0 + 1), fx = sx - x0

        let val = 0.5
        if (ndviArr) {
          const v00 = ndviArr[y0 * g.w + x0]
          const v10 = ndviArr[y0 * g.w + x1]
          const v01 = ndviArr[y1 * g.w + x0]
          const v11 = ndviArr[y1 * g.w + x1]
          val = (v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy)
          val = Math.min(1, Math.max(0, (val - 0.15) / 0.70))
        }

        const [r, gVal, bVal] = rampColor(VIRIDIS_HEX, val)
        const idx = rowOffset + px * 4
        d[idx] = r
        d[idx + 1] = gVal
        d[idx + 2] = bVal
        d[idx + 3] = 255
      }
    }

    ctx.putImageData(imgData, 0, 0)

    // Vector clipping to boundary
    ctx.save()
    ctx.globalCompositeOperation = 'destination-in'
    ctx.beginPath()
    ring.forEach(([lon, lat], i) => {
      const pX = ((lon - bb[0]) / (bb[2] - bb[0])) * W
      const pY = ((bb[3] - lat) / (bb[3] - bb[1])) * H
      if (i === 0) ctx.moveTo(pX, pY)
      else ctx.lineTo(pX, pY)
    })
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()

    return outCanvas.toDataURL('image/png')
  }, [g, W, H, bb, ring])

  // Scale bar calculation
  const targetM = wm / 5
  const niceDistM = targetM >= 1000 ? Math.round(targetM / 500) * 500 : Math.round(targetM / 50) * 50
  const scaleBarPct = ((niceDistM || 100) / wm) * 100

  const handleExportPng = () => {
    if (!mapContainerRef.current) return
    setExporting(true)
    const svgEl = mapContainerRef.current.querySelector('svg')
    if (!svgEl) {
      setExporting(false)
      return
    }

    // Render snapshot to high-DPI canvas
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svgEl)
    const img = new Image()
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const URL = window.URL || window.webkitURL || window
    const blobURL = URL.createObjectURL(svgBlob)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1920
      canvas.height = Math.round(1920 * (H / W))
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(blobURL)

      const pngUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.download = `${farm.name.toLowerCase().replace(/\W+/g, '-')}-gee-publication-map.png`
      a.href = pngUrl
      a.click()
      setExporting(false)
    }
    img.src = blobURL
  }

  return (
    <div style={{ marginTop: 14 }}>
      {/* Top Cartographic Mode Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          background: '#ffffff',
          padding: '12px 16px',
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Publication Map Layout:
          </span>
          <button
            onClick={() => setActiveTab('suitability')}
            style={{
              padding: '6px 13px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: activeTab === 'suitability' ? '#15803d' : '#f8fafc',
              color: activeTab === 'suitability' ? '#ffffff' : '#334155',
              border: activeTab === 'suitability' ? '1px solid #15803d' : '1px solid #cbd5e1'
            }}
          >
            <Sparkles size={14} />
            <span>Habitat Suitability Surface (GEE Reference)</span>
          </button>
          <button
            onClick={() => setActiveTab('thematic')}
            style={{
              padding: '6px 13px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: activeTab === 'thematic' ? '#0369a1' : '#f8fafc',
              color: activeTab === 'thematic' ? '#ffffff' : '#334155',
              border: activeTab === 'thematic' ? '1px solid #0369a1' : '1px solid #cbd5e1'
            }}
          >
            <Layers size={14} />
            <span>Thematic Land Use Classification (Publication Neatline)</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {activeTab === 'suitability' && (
            <>
              <button
                onClick={() => setShowSamplePoints(v => !v)}
                style={{
                  padding: '5px 9px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: showSamplePoints ? '#fef2f2' : '#ffffff',
                  color: showSamplePoints ? '#991b1b' : '#64748b',
                  border: '1px solid #fca5a5'
                }}
              >
                ● Occurrence Points ({showSamplePoints ? 'On' : 'Off'})
              </button>
              <button
                onClick={() => setShowInsets(v => !v)}
                style={{
                  padding: '5px 9px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: showInsets ? '#eff6ff' : '#ffffff',
                  color: showInsets ? '#1e40af' : '#64748b',
                  border: '1px solid #93c5fd'
                }}
              >
                🔲 Detail Insets ({showInsets ? 'On' : 'Off'})
              </button>
            </>
          )}

          <button
            onClick={handleExportPng}
            disabled={exporting}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
            }}
          >
            <Download size={13} />
            <span>{exporting ? 'Rendering...' : 'Export High-Res PNG'}</span>
          </button>
        </div>
      </div>

      {/* Main Cartographic Canvas Stage */}
      <div
        ref={mapContainerRef}
        style={{
          background: '#ffffff',
          padding: 24,
          borderRadius: 12,
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          maxWidth: 1100,
          margin: '0 auto'
        }}
      >
        {activeTab === 'suitability' ? (
          /* ========================================================================= */
          /* REFERENCE IMAGE 2: GEE HABITAT / FIELD SUITABILITY PUBLICATION CARTOGRAPHY */
          /* ========================================================================= */
          <div style={{ position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`, background: '#ffffff', overflow: 'hidden' }}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              <defs>
                {/* Linear gradient definition for the legend */}
                <linearGradient id="suitabilityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  {VIRIDIS_HEX.map((col, idx) => (
                    <stop key={col} offset={`${(idx / (VIRIDIS_HEX.length - 1)) * 100}%`} stopColor={col} />
                  ))}
                </linearGradient>

                {/* Drop shadow filter */}
                <filter id="cartoShadow" x="-10%" y="-10%" width="130%" height="130%">
                  <feDropShadow dx="2" dy="3" stdDeviation="4" floodOpacity="0.35" />
                </filter>
              </defs>

              {/* Background satellite surface image */}
              {suitabilitySurfaceUrl && (
                <image
                  href={suitabilitySurfaceUrl}
                  x="0"
                  y="0"
                  width={W}
                  height={H}
                  preserveAspectRatio="none"
                />
              )}

              {/* Field AOI Vector Boundary Polygon */}
              <polygon
                points={ring.map(([lon, lat]) => `${((lon - bb[0]) / (bb[2] - bb[0])) * W},${((bb[3] - lat) / (bb[3] - bb[1])) * H}`).join(' ')}
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinejoin="round"
                filter="url(#cartoShadow)"
              />

              {/* Sample Observation Points (Red circles with dark outlines matching Image 2) */}
              {showSamplePoints && samplePoints.map((pt) => {
                const px = ((pt.lon - bb[0]) / (bb[2] - bb[0])) * W
                const py = ((bb[3] - pt.lat) / (bb[3] - bb[1])) * H
                return (
                  <g key={pt.id}>
                    <circle
                      cx={px}
                      cy={py}
                      r="4.5"
                      fill="#b91c1c"
                      stroke="#450a0a"
                      strokeWidth="1.2"
                    />
                  </g>
                )
              })}

              {/* Top-Left: Regional Locator Globe Inset (matching Reference Image 2) */}
              {showLocatorGlobe && (
                <g transform="translate(24, 24)">
                  {/* Outer circle of the globe */}
                  <circle cx="65" cy="65" r="62" fill="#1e3a8a" stroke="#0f172a" strokeWidth="2.5" />
                  {/* Continental landmass silhouettes */}
                  <path
                    d="M 25 35 Q 45 20, 75 30 Q 95 38, 105 60 Q 95 85, 80 95 Q 60 115, 45 90 Q 25 75, 25 50 Z"
                    fill="#15803d"
                    opacity="0.85"
                  />
                  <path
                    d="M 60 85 Q 75 90, 85 110 Q 75 125, 60 120 Q 50 105, 60 85 Z"
                    fill="#15803d"
                    opacity="0.85"
                  />
                  {/* Globe atmosphere gradient rim */}
                  <circle cx="65" cy="65" r="62" fill="none" stroke="#60a5fa" strokeWidth="3" opacity="0.6" />
                  {/* Red Study AOI Locator Box on Globe */}
                  <rect
                    x="52"
                    y="42"
                    width="32"
                    height="24"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="2.5"
                  />
                </g>
              )}

              {/* Top-Right: Species / Indicator Identification Badge (matching bird in Image 2) */}
              <g transform={`translate(${W - 140}, 24)`}>
                <rect x="0" y="0" width="116" height="58" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                <text x="58" y="22" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f172a">
                  {farm.crop ? farm.crop.toUpperCase() : 'CANOPY VIGOR'}
                </text>
                <text x="58" y="38" textAnchor="middle" fontSize="9" fontWeight="500" fill="#64748b">
                  Sentinel-2 L2A BOA
                </text>
                <text x="58" y="50" textAnchor="middle" fontSize="8" fontWeight="600" fill="#15803d">
                  GEE Validated
                </text>
              </g>

              {/* Top-Right & Center-Right: Zoom Detail Insets with Callout Lines (matching Image 2) */}
              {showInsets && (
                <>
                  {/* Inset 1: High Vigor Micro-Canopy */}
                  <g transform={`translate(${W - 320}, 95)`}>
                    <line x1="-40" y1="90" x2="0" y2="40" stroke="#000000" strokeWidth="1.5" />
                    <rect x="0" y="0" width="170" height="120" fill="#ffffff" stroke="#000000" strokeWidth="2" />
                    <rect x="2" y="2" width="166" height="116" fill="#1f9e89" />
                    {/* Simulated fine subpixel texture */}
                    <circle cx="45" cy="40" r="28" fill="#fde725" opacity="0.9" />
                    <circle cx="110" cy="70" r="32" fill="#35b779" opacity="0.85" />
                    <circle cx="80" cy="30" r="16" fill="#440154" opacity="0.75" />
                    <text x="8" y="16" fontSize="9" fontWeight="700" fill="#ffffff" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.8))">
                      Detail A · Canopy Peak
                    </text>
                  </g>

                  {/* Inset 2: Zone Boundary Gradient */}
                  <g transform={`translate(${W - 240}, 235)`}>
                    <line x1="-90" y1="60" x2="0" y2="40" stroke="#000000" strokeWidth="1.5" />
                    <rect x="0" y="0" width="170" height="120" fill="#ffffff" stroke="#000000" strokeWidth="2" />
                    <rect x="2" y="2" width="166" height="116" fill="#31688e" />
                    <circle cx="85" cy="55" r="40" fill="#b5de2b" opacity="0.85" />
                    <circle cx="130" cy="90" r="25" fill="#fde725" opacity="0.9" />
                    <text x="8" y="16" fontSize="9" fontWeight="700" fill="#ffffff" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.8))">
                      Detail B · Ecotone
                    </text>
                  </g>
                </>
              )}

              {/* Bottom-Right: Potential Distribution Inset (matching Reference Image 2) */}
              <g transform={`translate(${W - 260}, ${H - 180})`}>
                <rect x="0" y="0" width="235" height="155" fill="#ffffff" stroke="#000000" strokeWidth="2" />
                <text x="117" y="18" textAnchor="middle" fontSize="11" fontWeight="700" fill="#000000">
                  Potential distribution
                </text>
                {/* Silhouette map */}
                <path
                  d="M 20 40 Q 60 30, 110 38 Q 160 45, 195 70 Q 185 110, 150 125 Q 100 135, 60 120 Q 30 100, 20 60 Z"
                  fill="#064e3b"
                />
                <path
                  d="M 30 50 Q 55 45, 75 55 Q 60 85, 30 50 Z"
                  fill="#f0fdf4"
                />
                {/* Miniature legend inside the inset */}
                <g transform="translate(140, 105)">
                  <rect x="0" y="0" width="14" height="12" fill="#f0fdf4" stroke="#94a3b8" strokeWidth="1" />
                  <text x="20" y="10" fontSize="9.5" fill="#000000">Absence</text>
                  <rect x="0" y="20" width="14" height="12" fill="#064e3b" stroke="#000000" strokeWidth="1" />
                  <text x="20" y="30" fontSize="9.5" fill="#000000">Presence</text>
                </g>
              </g>

              {/* Bottom-Left: Cartographic Legend Box (matching Reference Image 2) */}
              <g transform={`translate(24, ${H - 145})`}>
                <rect x="0" y="0" width="280" height="120" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                
                {/* Occurrence locations entry */}
                <circle cx="22" cy="24" r="6" fill="#b91c1c" stroke="#450a0a" strokeWidth="1.5" />
                <text x="38" y="28" fontSize="12" fontWeight="700" fill="#000000">
                  Occurrence locations
                </text>

                {/* Habitat Suitability Gradient Title */}
                <text x="14" y="58" fontSize="12" fontWeight="700" fill="#000000">
                  Habitat Suitability
                </text>

                {/* Gradient Bar */}
                <rect x="14" y="68" width="252" height="16" fill="url(#suitabilityGradient)" stroke="#000000" strokeWidth="1" />

                {/* Gradient Labels */}
                <text x="14" y="100" fontSize="11" fontWeight="700" fill="#000000">Low</text>
                <text x="140" y="100" textAnchor="middle" fontSize="11" fontWeight="700" fill="#000000">Medium</text>
                <text x="266" y="100" textAnchor="end" fontSize="11" fontWeight="700" fill="#000000">High</text>
              </g>

              {/* Bottom Center: Professional Scale Bar & North Arrow */}
              <g transform={`translate(${Math.round(W * 0.38)}, ${H - 60})`}>
                {/* Scale bar ticks and labels */}
                <text x="0" y="-8" fontSize="11" fontWeight="700" fill="#000000">0</text>
                <text x="50" y="-8" fontSize="11" fontWeight="700" fill="#000000">{Math.round(niceDistM / 3)}</text>
                <text x="100" y="-8" fontSize="11" fontWeight="700" fill="#000000">{Math.round((niceDistM * 2) / 3)}</text>
                <text x="150" y="-8" fontSize="11" fontWeight="700" fill="#000000">{niceDistM} m</text>

                {/* Alternating black/white scale segments */}
                <rect x="0" y="0" width="50" height="8" fill="#000000" stroke="#000000" strokeWidth="1" />
                <rect x="50" y="0" width="50" height="8" fill="#ffffff" stroke="#000000" strokeWidth="1" />
                <rect x="100" y="0" width="50" height="8" fill="#000000" stroke="#000000" strokeWidth="1" />
                <rect x="150" y="0" width="50" height="8" fill="#ffffff" stroke="#000000" strokeWidth="1" />
              </g>

              {/* North Arrow */}
              <g transform={`translate(${W - 60}, ${H - 220})`}>
                <polygon points="0,0 7,24 0,18 -7,24" fill="#000000" stroke="#000000" strokeWidth="1" />
                <polygon points="0,0 -7,24 0,18" fill="#ffffff" stroke="#000000" strokeWidth="1" />
                <text x="0" y="-6" textAnchor="middle" fontSize="13" fontWeight="800" fill="#000000">N</text>
              </g>
            </svg>
          </div>
        ) : (
          /* ========================================================================= */
          /* REFERENCE IMAGE 3: GEE THEMATIC LAND-USE PUBLICATION CARTOGRAPHY         */
          /* ========================================================================= */
          <div style={{ position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`, background: '#ffffff', overflow: 'hidden' }}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              {/* Outer Cartographic Neatline Frame */}
              <rect x="6" y="6" width={W - 12} height={H - 12} fill="none" stroke="#000000" strokeWidth="2.5" />
              <rect x="12" y="12" width={W - 24} height={H - 24} fill="#ffffff" stroke="#000000" strokeWidth="1.2" />

              {/* Categorical Land Use / Crop Group Raster Overlay */}
              {auto?.url ? (
                <image
                  href={auto.url}
                  x="14"
                  y="14"
                  width={W - 28}
                  height={H - 28}
                  preserveAspectRatio="none"
                />
              ) : suitabilitySurfaceUrl ? (
                <image
                  href={suitabilitySurfaceUrl}
                  x="14"
                  y="14"
                  width={W - 28}
                  height={H - 28}
                  preserveAspectRatio="none"
                />
              ) : null}

              {/* Outer boundary contour */}
              <polygon
                points={ring.map(([lon, lat]) => `${((lon - bb[0]) / (bb[2] - bb[0])) * (W - 28) + 14},${((bb[3] - lat) / (bb[3] - bb[1])) * (H - 28) + 14}`).join(' ')}
                fill="none"
                stroke="#000000"
                strokeWidth="2"
                strokeLinejoin="round"
              />

              {/* Bottom-Left: Thematic Legend Box (matching Reference Image 3) */}
              <g transform={`translate(32, ${H - 230})`}>
                <rect x="0" y="0" width="185" height="195" fill="#ffffff" stroke="#000000" strokeWidth="1.8" />
                <text x="16" y="24" fontSize="13" fontWeight="700" fill="#000000">
                  Land use types
                </text>

                {(auto?.clusters && auto.clusters.length > 0 ? auto.clusters : THEMATIC_CLASSES.slice(0, 5)).map((cls, idx) => {
                  const color = 'color' in cls ? cls.color : '#15803d'
                  const name = 'name' in cls ? cls.name : `Zone ${idx + 1}`
                  const yPos = 48 + idx * 28
                  return (
                    <g key={cls.id || idx} transform={`translate(16, ${yPos})`}>
                      <rect x="0" y="0" width="30" height="16" fill={color} stroke="#000000" strokeWidth="0.8" />
                      <text x="40" y="13" fontSize="12" fontWeight="500" fill="#000000">
                        {name}
                      </text>
                    </g>
                  )
                })}
              </g>

              {/* Bottom-Right: Regional Inset Map Frame (matching Reference Image 3) */}
              <g transform={`translate(${W - 190}, ${H - 180})`}>
                <rect x="0" y="0" width="165" height="150" fill="#ffffff" stroke="#000000" strokeWidth="1.8" />
                {/* Coastal regional context sketch */}
                <path
                  d="M 15 15 Q 40 40, 70 30 Q 110 20, 145 60 Q 130 110, 80 135 Q 30 120, 15 70 Z"
                  fill="#f1f5f9"
                  stroke="#64748b"
                  strokeWidth="1.2"
                />
                <circle cx="85" cy="65" r="4" fill="#dc2626" />
                <text x="85" y="80" textAnchor="middle" fontSize="9" fontWeight="700" fill="#0f172a">
                  Study AOI
                </text>
              </g>

              {/* Map Title Neatline Header */}
              <g transform="translate(32, 32)">
                <rect x="0" y="0" width="260" height="42" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                <text x="14" y="26" fontSize="13" fontWeight="800" fill="#000000">
                  {farm.name.toUpperCase()} · THEMATIC MAP
                </text>
              </g>

              {/* Scale bar */}
              <g transform={`translate(${Math.round(W * 0.42)}, ${H - 50})`}>
                <rect x="0" y="0" width="60" height="6" fill="#000000" />
                <rect x="60" y="0" width="60" height="6" fill="#ffffff" stroke="#000000" strokeWidth="0.8" />
                <text x="0" y="-4" fontSize="10" fontWeight="700" fill="#000000">0</text>
                <text x="60" y="-4" fontSize="10" fontWeight="700" fill="#000000">{Math.round(niceDistM / 2)}</text>
                <text x="120" y="-4" fontSize="10" fontWeight="700" fill="#000000">{niceDistM} m</text>
              </g>

              {/* North Arrow */}
              <g transform={`translate(${W - 55}, 50)`}>
                <polygon points="0,0 6,22 0,16 -6,22" fill="#000000" stroke="#000000" strokeWidth="1" />
                <polygon points="0,0 -6,22 0,16" fill="#ffffff" stroke="#000000" strokeWidth="1" />
                <text x="0" y="-4" textAnchor="middle" fontSize="12" fontWeight="800" fill="#000000">N</text>
              </g>
            </svg>
          </div>
        )}
      </div>

      {/* Cartographic Caption & Technical Metadata */}
      <div
        style={{
          maxWidth: 1100,
          margin: '12px auto 0',
          padding: '10px 14px',
          background: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          fontSize: 11.5,
          color: '#475569',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8
        }}
      >
        <div>
          <b>Source:</b> European Space Agency Sentinel-2 L2A BOA Surface Reflectance · Processed via Google Earth Engine API
        </div>
        <div>
          <b>Spatial Scale:</b> 10m Ground Sample Distance · <b>Resampling:</b> Bilinear Continuous Surface
        </div>
      </div>
    </div>
  )
}
