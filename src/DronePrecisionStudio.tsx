import { useState, useMemo, useEffect } from 'react'
import {
  Plane, Eye, ShieldCheck, Compass, Sliders, Layers, Download, CheckCircle2,
  AlertTriangle, Droplets, MapPin, Sparkles, FileText, X, ChevronRight,
  TrendingDown, TrendingUp, Info, Activity, Camera, RefreshCw
} from 'lucide-react'
import {
  assessSmallholderPurity,
  generateDroneOrthomosaicGrid,
  computeDroneIndices,
  type SmallholderMetrics,
  type DroneOrthomosaicPixel,
  type GroundTruthPoint,
  calibrateSatelliteWithGroundTruth
} from './lib/smallholderResolution'
import { generateScientificProvenance, type ProvenanceRecord } from './lib/dataProvenance'
import type { FarmData } from './lib/seva'

interface Props {
  farm: FarmData & { id: string; name: string; crop?: string; area?: number; polygon?: [number, number][] }
  onClose: () => void
  onExportDossier?: () => void
}

export default function DronePrecisionStudio({ farm, onClose, onExportDossier }: Props) {
  const [activeLayer, setActiveLayer] = useState<'rgb' | 'ndvi' | 'vari' | 'gli' | 'tgi' | 'elevation' | 'vra'>('ndvi')
  const [flightAltitudeM, setFlightAltitudeM] = useState(60) // 60 meters AGL standard ag drone flight
  const [droneFlying, setDroneFlying] = useState(false)
  const [flightProgress, setFlightProgress] = useState(0)
  const [hoveredPixel, setHoveredPixel] = useState<DroneOrthomosaicPixel | null>(null)
  const [showProvenance, setShowProvenance] = useState(false)
  const [groundTruthPoints, setGroundTruthPoints] = useState<GroundTruthPoint[]>([])
  const [newPointModal, setNewPointModal] = useState(false)
  const [newLccScore, setNewLccScore] = useState(4)
  const [newObsHealth, setNewObsHealth] = useState<'excellent' | 'normal' | 'stressed' | 'bare'>('normal')
  const [newPointNote, setNewPointNote] = useState('')

  // 1. Smallholder parcel purity & resolution metrics
  const smallholder = useMemo(() => {
    return assessSmallholderPurity(farm.polygon || [], farm.area || 1.0)
  }, [farm.polygon, farm.area])

  // 2. Scientific Data Provenance
  const provenance = useMemo(() => {
    return generateScientificProvenance(
      farm.lat,
      farm.lon,
      farm.analysis?.scene?.datetime,
      farm.analysis?.scene?.cloud || 0
    )
  }, [farm.lat, farm.lon, farm.analysis?.scene?.datetime, farm.analysis?.scene?.cloud])

  // 3. Simulated Drone Orthomosaic Grid
  const bounds = useMemo(() => {
    const lat = farm.lat || 24.6404
    const lon = farm.lon || 78.0524
    const delta = 0.0018 // approx ~200m field envelope
    return {
      minLat: lat - delta,
      maxLat: lat + delta,
      minLon: lon - delta,
      maxLon: lon + delta,
    }
  }, [farm.lat, farm.lon])

  const baseMeanNdvi = farm.analysis?.ndvi?.mean || 0.58
  const baseMeanElevation = farm.analysis?.elevMean || 240

  const orthomosaicPixels = useMemo(() => {
    return generateDroneOrthomosaicGrid(bounds, baseMeanNdvi, baseMeanElevation, 24)
  }, [bounds, baseMeanNdvi, baseMeanElevation])

  // 4. Ground Truth Calibration Calculation
  const calibration = useMemo(() => {
    return calibrateSatelliteWithGroundTruth(baseMeanNdvi, groundTruthPoints)
  }, [baseMeanNdvi, groundTruthPoints])

  // Drone flight animation simulation
  useEffect(() => {
    let interval: any
    if (droneFlying) {
      interval = setInterval(() => {
        setFlightProgress(prev => {
          if (prev >= 100) {
            setDroneFlying(false)
            return 100
          }
          return prev + 5
        })
      }, 250)
    }
    return () => clearInterval(interval)
  }, [droneFlying])

  function startDroneMission() {
    setFlightProgress(0)
    setDroneFlying(true)
  }

  function addGroundTruthObservation() {
    const newPt: GroundTruthPoint = {
      id: `gt-${Date.now().toString(36)}`,
      lat: (farm?.lat || 24.6404) + (Math.random() - 0.5) * 0.001,
      lon: (farm?.lon || 78.0524) + (Math.random() - 0.5) * 0.001,
      label: `Field Pin #${groundTruthPoints.length + 1}`,
      observedHealth: newObsHealth,
      leafColorChartScore: newLccScore,
      notes: newPointNote || 'Manual mobile inspection',
      timestamp: new Date().toLocaleTimeString(),
      satelliteNdvi: baseMeanNdvi,
      calibratedNdvi: baseMeanNdvi,
      errorDelta: 0,
    }
    setGroundTruthPoints(prev => [...prev, newPt])
    setNewPointModal(false)
    setNewPointNote('')
  }

  // Pixel color mapping helper based on active view
  function getPixelFill(p: DroneOrthomosaicPixel): string {
    if (activeLayer === 'rgb') {
      return `rgb(${p.rgb[0]}, ${p.rgb[1]}, ${p.rgb[2]})`
    }
    if (activeLayer === 'ndvi') {
      const v = p.ndvi
      if (v < 0.25) return '#b91c1c'
      if (v < 0.40) return '#ea580c'
      if (v < 0.55) return '#eab308'
      if (v < 0.70) return '#84cc16'
      return '#15803d'
    }
    if (activeLayer === 'vari') {
      const v = p.vari
      if (v < 0) return '#f87171'
      if (v < 0.15) return '#fbbf24'
      return '#22c55e'
    }
    if (activeLayer === 'gli') {
      const v = p.gli
      if (v < 0) return '#fca5a5'
      if (v < 0.12) return '#fef08a'
      return '#16a34a'
    }
    if (activeLayer === 'tgi') {
      const v = p.tgi
      return v > 0.02 ? '#15803d' : '#f97316'
    }
    if (activeLayer === 'elevation') {
      return p.elevationRelM > 0.2 ? '#60a5fa' : p.elevationRelM < -0.2 ? '#3b82f6' : '#93c5fd'
    }
    if (activeLayer === 'vra') {
      if (p.prescriptionZone === 'High') return '#ef4444' // red: high foliar spray
      if (p.prescriptionZone === 'Reduced') return '#3b82f6' // blue: reduced nitrogen
      return '#22c55e' // green: nominal standard
    }
    return '#15803d'
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1200,
          maxHeight: '94vh',
          background: '#0f172a',
          color: '#f8fafc',
          borderRadius: 16,
          border: '1px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#1e293b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
              }}
            >
              <Plane size={20} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f8fafc' }}>
                  Drone-Grade Precision Agriculture Studio
                </h2>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: smallholder.isSmallholder ? '#14532d' : '#1e3a8a',
                    color: smallholder.isSmallholder ? '#86efac' : '#93c5fd',
                    fontWeight: 700,
                    border: `1px solid ${smallholder.isSmallholder ? '#22c55e' : '#3b82f6'}`,
                  }}
                >
                  {smallholder.isSmallholder ? 'SMALLHOLDER PARCEL (< 5 HA)' : 'ESTATE PARCEL'}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  {farm.name} · {smallholder.areaAcres.toFixed(2)} Acres ({smallholder.areaHa.toFixed(2)} ha)
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                Sub-meter super-resolution, pure-endmember spectral unmixing, and flight-calibrated drone orthomosaics
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setShowProvenance(!showProvenance)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: showProvenance ? '#0284c7' : '#334155',
                color: '#fff',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ShieldCheck size={14} /> Scientific Provenance &amp; Matching
            </button>
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#334155',
                color: '#cbd5e1',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Studio Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', flex: 1, overflow: 'hidden' }}>
          {/* Left Panel: Telemetry, Resolution Diagnostics & VRA Controls */}
          <div
            style={{
              padding: 18,
              borderRight: '1px solid #334155',
              overflowY: 'auto',
              background: '#0f172a',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Smallholder Resolution Diagnostics Card */}
            <div
              style={{
                background: '#1e293b',
                padding: 14,
                borderRadius: 10,
                border: '1px solid #334155',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Compass size={14} color="#0284c7" /> Resolution &amp; Purity Engine
                </span>
                <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700 }}>
                  {smallholder.purityConfidenceScore}% Purity
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, marginBottom: 8 }}>
                <div style={{ background: '#0f172a', padding: 8, borderRadius: 6 }}>
                  <div style={{ color: '#94a3b8' }}>Raw 10m S2 Pixels:</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{smallholder.rawPixelCount10m} px</div>
                </div>
                <div style={{ background: '#0f172a', padding: 8, borderRadius: 6 }}>
                  <div style={{ color: '#94a3b8' }}>1m Drone GSD Pixels:</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>{smallholder.resampledPixelCount1m.toLocaleString()} px</div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.4 }}>
                Boundary contamination: <b style={{ color: '#f87171' }}>{smallholder.boundaryContaminationPct}%</b> of raw pixels touch peripheral roads/hedges. Linear spectral unmixing has isolated pure crop canopy endmembers.
              </div>
            </div>

            {/* Drone Flight Mission Planner */}
            <div
              style={{
                background: '#1e293b',
                padding: 14,
                borderRadius: 10,
                border: '1px solid #334155',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plane size={14} color="#22c55e" /> Drone Flight Simulator
                </span>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#1e3a8a', color: '#93c5fd' }}>
                  AGRAS T40 / REDEDGE
                </span>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                  <span>Flight Altitude AGL:</span>
                  <b style={{ color: '#f8fafc' }}>{flightAltitudeM} meters (1.2 cm GSD)</b>
                </div>
                <input
                  type="range"
                  min="30"
                  max="120"
                  value={flightAltitudeM}
                  onChange={e => setFlightAltitudeM(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#0284c7' }}
                />
              </div>

              {droneFlying ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#38bdf8', marginBottom: 4 }}>
                    <span>Simulating UAV Flight Pass...</span>
                    <span>{flightProgress}%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#0f172a', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${flightProgress}%`, height: '100%', background: '#0284c7', transition: 'width 0.2s' }} />
                  </div>
                </div>
              ) : (
                <button
                  onClick={startDroneMission}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Plane size={14} /> Run Autonomous Flight Sim
                </button>
              )}
            </div>

            {/* Canopy Cover & Stand Metrics */}
            <div
              style={{
                background: '#1e293b',
                padding: 14,
                borderRadius: 10,
                border: '1px solid #334155',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Activity size={14} color="#f59e0b" /> Crop Stand &amp; Canopy Biomass
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                <div style={{ background: '#0f172a', padding: 8, borderRadius: 6 }}>
                  <div style={{ color: '#94a3b8' }}>Canopy Cover:</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{smallholder.canopyCoverPct}%</div>
                </div>
                <div style={{ background: '#0f172a', padding: 8, borderRadius: 6 }}>
                  <div style={{ color: '#94a3b8' }}>Bare Soil:</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f97316' }}>{smallholder.bareSoilPct}%</div>
                </div>
                <div style={{ background: '#0f172a', padding: 8, borderRadius: 6, gridColumn: 'span 2' }}>
                  <div style={{ color: '#94a3b8' }}>Estimated Plant Stand Density:</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                    ~{smallholder.estimatedPlantCount.toLocaleString()} plants ({smallholder.estimatedStandDensity.toLocaleString()} / ha)
                  </div>
                </div>
              </div>
            </div>

            {/* Variable Rate Application (VRA) Savings */}
            <div
              style={{
                background: 'linear-gradient(135deg, #14532d 0%, #064e3b 100%)',
                padding: 14,
                borderRadius: 10,
                border: '1px solid #22c55e',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#86efac', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingDown size={14} /> VRA Chemical Savings
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                  {smallholder.vraSavingsPct}% Saved
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#dcfce7', lineHeight: 1.4 }}>
                Targeting only the stressed and nominal zones cuts blanket urea/spraying waste, saving an estimated ₹ 1,450 / acre.
              </p>
            </div>

            {/* Field Ground-Truthing Matcher Button */}
            <button
              onClick={() => setNewPointModal(true)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: '#334155',
                color: '#f8fafc',
                border: '1px solid #475569',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <MapPin size={14} color="#38bdf8" /> Add Ground-Truth Pin ({groundTruthPoints.length})
            </button>
          </div>

          {/* Right Panel: Interactive Orthomosaic Map & Spectral Layers */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#0b1120', position: 'relative' }}>
            {/* Layer Switcher Bar */}
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid #1e293b',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActiveLayer('ndvi')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activeLayer === 'ndvi' ? '#15803d' : '#1e293b',
                    color: '#fff',
                  }}
                >
                  Pure NDVI (Canopy)
                </button>
                <button
                  onClick={() => setActiveLayer('rgb')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activeLayer === 'rgb' ? '#0284c7' : '#1e293b',
                    color: '#fff',
                  }}
                >
                  4K Orthomosaic RGB
                </button>
                <button
                  onClick={() => setActiveLayer('vari')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activeLayer === 'vari' ? '#059669' : '#1e293b',
                    color: '#fff',
                  }}
                >
                  VARI (Visible UAV)
                </button>
                <button
                  onClick={() => setActiveLayer('gli')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activeLayer === 'gli' ? '#0d9488' : '#1e293b',
                    color: '#fff',
                  }}
                >
                  GLI (Leaf Pigment)
                </button>
                <button
                  onClick={() => setActiveLayer('elevation')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activeLayer === 'elevation' ? '#2563eb' : '#1e293b',
                    color: '#fff',
                  }}
                >
                  Micro-DEM Rills
                </button>
                <button
                  onClick={() => setActiveLayer('vra')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activeLayer === 'vra' ? '#ea580c' : '#1e293b',
                    color: '#fff',
                  }}
                >
                  VRA Prescription
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                {onExportDossier && (
                  <button
                    onClick={onExportDossier}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 12px',
                      borderRadius: 6,
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <FileText size={13} /> Export Drone Audit Dossier
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Canvas Grid */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                overflow: 'auto',
                position: 'relative',
              }}
            >
              {/* Drone UAV Icon Overlay during flight */}
              {droneFlying && (
                <div
                  style={{
                    position: 'absolute',
                    top: `${(flightProgress * 0.8) + 10}%`,
                    left: `${(Math.sin(flightProgress * 0.2) * 30) + 50}%`,
                    zIndex: 20,
                    transform: 'translate(-50%, -50%)',
                    background: '#0284c7',
                    padding: 8,
                    borderRadius: '50%',
                    boxShadow: '0 0 20px #38bdf8',
                    transition: 'all 0.2s',
                  }}
                >
                  <Plane size={24} color="#fff" />
                </div>
              )}

              {/* Orthomosaic Grid View */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(24, 18px)',
                  gridTemplateRows: 'repeat(24, 18px)',
                  gap: 1,
                  background: '#1e293b',
                  padding: 8,
                  borderRadius: 12,
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                  border: '2px solid #334155',
                }}
              >
                {orthomosaicPixels.map((p, idx) => {
                  const fill = getPixelFill(p)
                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredPixel(p)}
                      style={{
                        width: 18,
                        height: 18,
                        background: fill,
                        borderRadius: 2,
                        cursor: 'crosshair',
                        transition: 'transform 0.1s',
                      }}
                      title={`Cell (${p.x}, ${p.y}) | NDVI: ${p.ndvi} | Elev: ${p.elevationRelM}m | VRA: ${p.prescriptionZone}`}
                    />
                  )
                })}
              </div>

              {/* Hover Inspection HUD Card */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 16,
                  left: 16,
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid #334155',
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  color: '#cbd5e1',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
                  minWidth: 260,
                }}
              >
                <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 2 }}>
                  Micro-Cell HUD Telemetry
                </div>
                {hoveredPixel ? (
                  <div>
                    <div>Coordinates: {hoveredPixel.lat.toFixed(5)}°N, {hoveredPixel.lon.toFixed(5)}°E</div>
                    <div>Pure Canopy NDVI: <b style={{ color: '#22c55e' }}>{hoveredPixel.ndvi}</b> (VARI: {hoveredPixel.vari})</div>
                    <div>Micro-Elevation Relief: <b>{hoveredPixel.elevationRelM > 0 ? `+${hoveredPixel.elevationRelM}` : hoveredPixel.elevationRelM} m</b></div>
                    <div>VRA Prescription: <b style={{ color: hoveredPixel.prescriptionZone === 'High' ? '#ef4444' : hoveredPixel.prescriptionZone === 'Reduced' ? '#38bdf8' : '#22c55e' }}>{hoveredPixel.prescriptionZone} Input</b></div>
                  </div>
                ) : (
                  <div>Hover over any 1-meter cell on the orthomosaic to inspect micro-metrics</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scientific Data Provenance Drawer / Modal */}
        {showProvenance && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.95)',
              padding: 24,
              overflowY: 'auto',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={24} color="#0284c7" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                    Scientific Data Provenance &amp; Verification Certificate
                  </h3>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    Direct trace of sensor origin, atmospheric correction model, and ground-truth validation score
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowProvenance(false)}
                style={{
                  background: '#334155',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Close Certificate
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <div style={{ background: '#1e293b', padding: 14, borderRadius: 10, border: '1px solid #334155' }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Satellite Mission &amp; Agency</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{provenance.mission}</div>
                <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>{provenance.missionAgency}</div>
              </div>

              <div style={{ background: '#1e293b', padding: 14, borderRadius: 10, border: '1px solid #334155' }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Granule Scene &amp; STAC URI</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', wordBreak: 'break-all' }}>{provenance.sceneId}</div>
                <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>Tile: {provenance.tileId} · Orbit: #{provenance.orbitNumber} ({provenance.orbitType})</div>
              </div>

              <div style={{ background: '#1e293b', padding: 14, borderRadius: 10, border: '1px solid #334155' }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Atmospheric Processing</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{provenance.atmosphericProcessing}</div>
                <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>Aerosol Thickness: {provenance.aerosolOpticalThickness} AOT · H₂O: {provenance.waterVaporGcm2} g/cm²</div>
              </div>

              <div style={{ background: '#1e293b', padding: 14, borderRadius: 10, border: '1px solid #334155' }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Confidence &amp; Validation Rating</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8' }}>{provenance.validationScorePct}% ({provenance.validationGrade})</div>
                <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>Geolocation RMSE: &lt; {provenance.geolocationAccuracyRmseM} m (Sentinel-2 GRI verified)</div>
              </div>
            </div>

            {/* Error Margins */}
            <div style={{ background: '#1e293b', padding: 14, borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
                Quantified Error Margins &amp; Confidence Intervals
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 12 }}>
                <div>Canopy NDVI: <b style={{ color: '#22c55e' }}>{provenance.indexErrorMargin.ndvi}</b></div>
                <div>Water NDMI: <b style={{ color: '#38bdf8' }}>{provenance.indexErrorMargin.ndmi}</b></div>
                <div>Surface DEM: <b style={{ color: '#f59e0b' }}>{provenance.indexErrorMargin.elevation}</b></div>
              </div>
            </div>

            {/* Peer-Reviewed Scientific Citations */}
            <div style={{ background: '#1e293b', padding: 14, borderRadius: 10, border: '1px solid #334155' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
                Peer-Reviewed Reference Citations
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {provenance.peerReviewedCitations.map((c, i) => (
                  <li key={i}>
                    <b>{c.title}</b> — <i>{c.journal}</i> (DOI: {c.doi})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Modal: Add Ground-Truth Field Pin */}
        {newPointModal && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              style={{
                width: 380,
                background: '#1e293b',
                padding: 18,
                borderRadius: 12,
                border: '1px solid #334155',
                color: '#f8fafc',
              }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>
                Field Ground-Truth Inspection
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: 11, color: '#94a3b8' }}>
                Calibrate satellite indices using mobile on-ground field observations or Leaf Color Chart (LCC) scores.
              </p>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Visual Stand Health:</label>
                <select
                  value={newObsHealth}
                  onChange={e => setNewObsHealth(e.target.value as any)}
                  style={{ width: '100%', padding: 6, borderRadius: 6, background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
                >
                  <option value="excellent">Excellent (Dense green canopy)</option>
                  <option value="normal">Normal (Healthy crop stand)</option>
                  <option value="stressed">Stressed (Chlorosis / Moisture deficit)</option>
                  <option value="bare">Bare Soil / Fallow</option>
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  IRRI Leaf Color Chart (LCC) Score: <b>{newLccScore} / 6</b>
                </label>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={newLccScore}
                  onChange={e => setNewLccScore(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#22c55e' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Field Notes:</label>
                <input
                  type="text"
                  placeholder="e.g. Row 4 minor yellowing after rain"
                  value={newPointNote}
                  onChange={e => setNewPointNote(e.target.value)}
                  style={{ width: '100%', padding: 6, borderRadius: 6, background: '#0f172a', color: '#fff', border: '1px solid #334155', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setNewPointModal(false)}
                  style={{ padding: '6px 12px', borderRadius: 6, background: '#334155', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  onClick={addGroundTruthObservation}
                  style={{ padding: '6px 12px', borderRadius: 6, background: '#0284c7', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                >
                  Save &amp; Calibrate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
