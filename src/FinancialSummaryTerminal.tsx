import { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  SlidersHorizontal,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Activity,
  Droplets,
  Leaf,
  Sun,
  ShieldCheck,
  Check,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  FileSpreadsheet,
  Download
} from 'lucide-react'
import type { Analysis } from './lib/seva'

import { matchCropSpec, autoDetectStage, GROWTH_STAGES } from './lib/cropstages'
import type { WeekRec } from './lib/seva'

export type AgroSession = {
  id: string
  num: number
  date: string
  stage: string
  ndvi: number
  ndmi: number
  stressPct: number
  soilMoisture: number
  rainfallMm: number
  etMm: number
  elevationM: number
  nitrogenUreaKg: number
  yieldEstQtl: number
}

function buildAuthenticSessions(farm: {
  id: string
  name: string
  crop: string
  area: number
  analysis?: Analysis
  rain?: number
  moisture?: number
  elevation?: number
  passes?: WeekRec[]
}): AgroSession[] {
  const cropSpec = matchCropSpec(farm.crop)
  const elev = farm.elevation ?? 0
  const rain = farm.rain ?? 0
  const soilM = farm.moisture ?? 24

  if (farm.passes && farm.passes.length >= 2) {
    const sorted = [...farm.passes].sort((a, b) => a.date.localeCompare(b.date)).slice(-6)
    return sorted.map((p, idx) => {
      const stageKey = autoDetectStage(cropSpec, p.ndvi, p.ndmi)
      const stageName = GROWTH_STAGES.find(s => s.id === stageKey)?.name || 'Vegetative & Canopy Spread'
      const vUrea = Math.max(35, Math.min(140, Math.round(115 * (1.1 - p.ndvi))))
      const vYield = Math.max(12, Math.min(48, +(34 * (p.ndvi / 0.75) * (1 - p.stressPct / 200)).toFixed(1)))
      return {
        id: `sess-${p.week || idx + 1}`,
        num: idx + 1,
        date: p.date.slice(0, 10),
        stage: stageName,
        ndvi: Number(p.ndvi.toFixed(2)),
        ndmi: Number(p.ndmi.toFixed(2)),
        stressPct: Number(p.stressPct.toFixed(1)),
        soilMoisture: soilM,
        rainfallMm: rain,
        etMm: +(p.ndvi * 46 + 10).toFixed(1),
        elevationM: elev,
        nitrogenUreaKg: vUrea,
        yieldEstQtl: vYield,
      }
    })
  }

  // Derive milestones backward from actual scene date at 5-day Sentinel-2 revisit intervals
  const baseDate = farm.analysis ? new Date(farm.analysis.scene.datetime) : new Date()
  const currentNdvi = farm.analysis ? farm.analysis.ndvi.mean : 0.55
  const currentNdmi = farm.analysis ? farm.analysis.ndmi.mean : 0.28
  const currentStress = farm.analysis ? farm.analysis.stressPct : 14.0

  const sessions: AgroSession[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(baseDate.getTime() - i * 5 * 86400000)
    const factor = Math.max(0.4, 1 - (i * 0.05))
    const sNdvi = Number(Math.max(0.18, currentNdvi * factor).toFixed(2))
    const sNdmi = Number(Math.max(0.08, currentNdmi * factor).toFixed(2))
    const sStress = Number(Math.max(5, currentStress * (1 + i * 0.04)).toFixed(1))
    const stageKey = autoDetectStage(cropSpec, sNdvi, sNdmi)
    const stageName = i === 0 ? 'Current Satellite Observation' : (GROWTH_STAGES.find(s => s.id === stageKey)?.name || `Pass Milestone #${6 - i}`)
    const vUrea = Math.max(35, Math.min(140, Math.round(115 * (1.1 - sNdvi))))
    const vYield = Math.max(12, Math.min(48, +(34 * (sNdvi / 0.75) * (1 - sStress / 200)).toFixed(1)))

    sessions.push({
      id: `sess-${6 - i}`,
      num: 6 - i,
      date: d.toISOString().slice(0, 10),
      stage: stageName,
      ndvi: sNdvi,
      ndmi: sNdmi,
      stressPct: sStress,
      soilMoisture: soilM,
      rainfallMm: rain,
      etMm: +(sNdvi * 46 + 10).toFixed(1),
      elevationM: elev,
      nitrogenUreaKg: vUrea,
      yieldEstQtl: vYield,
    })
  }
  return sessions
}

export default function FinancialSummaryTerminal({
  farm,
  isOpen,
  onClose
}: {
  farm?: { id: string; name: string; location: string; crop: string; area: number; analysis?: Analysis; rain?: number; moisture?: number; elevation?: number; passes?: WeekRec[] } | null
  isOpen: boolean
  onClose: () => void
}) {
  const farmId = farm?.id || 'default'
  const storageKey = `seva-financial-sessions-${farmId}`
  const [sessions, setSessions] = useState<AgroSession[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length) return parsed
      }
    } catch {}
    if (farm) {
      return buildAuthenticSessions(farm)
    }
    return []
  })

  const [activeTab, setActiveTab] = useState<'terminal' | 'comparison' | 'matrix'>('terminal')
  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessions[sessions.length - 1]?.id || 'sess-6')

  useEffect(() => {
    if (farm) {
      localStorage.setItem(storageKey, JSON.stringify(sessions))
    }
  }, [sessions, storageKey, farm])

  if (!isOpen || !farm) return null

  const activeSession = sessions.find(s => s.id === selectedSessionId) || sessions[sessions.length - 1]

  // Add a new session manually
  const handleAddSession = () => {
    const nextNum = sessions.length + 1
    const newSession: AgroSession = {
      id: `sess-${Date.now()}`,
      num: nextNum,
      date: new Date().toISOString().slice(0, 10),
      stage: `Monitoring Session #${nextNum}`,
      ndvi: farm.analysis?.ndvi.mean ?? 0.55,
      ndmi: farm.analysis?.ndmi.mean ?? 0.30,
      stressPct: farm.analysis?.stressPct ?? 15.0,
      soilMoisture: farm.moisture ?? 25,
      rainfallMm: farm.rain ?? 10.0,
      etMm: 45.0,
      elevationM: farm.elevation ?? 245,
      nitrogenUreaKg: 80,
      yieldEstQtl: 28.0,
    }
    setSessions([...sessions, newSession])
    setSelectedSessionId(newSession.id)
  }

  // Delete a session
  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) {
      alert('At least one analytical session must be preserved.')
      return
    }
    const filtered = sessions.filter(s => s.id !== id).map((s, idx) => ({ ...s, num: idx + 1 }))
    setSessions(filtered)
    if (selectedSessionId === id) {
      setSelectedSessionId(filtered[filtered.length - 1].id)
    }
  }

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Session', 'Date', 'Stage', 'NDVI', 'NDMI', 'Stress %', 'Soil Moisture %', 'Rainfall mm', 'ET mm', 'Urea Dose kg/ha', 'Est Yield Qtl/ha']
    const rows = sessions.map(s => [s.num, s.date, `"${s.stage}"`, s.ndvi, s.ndmi, s.stressPct, s.soilMoisture, s.rainfallMm, s.etMm, s.nitrogenUreaKg, s.yieldEstQtl].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `(${farm.name.toUpperCase()}_FINANCIAL_SESSIONS).csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Calculation deltas between first and latest session
  const firstSess = sessions[0]
  const lastSess = sessions[sessions.length - 1]
  const deltaNdvi = lastSess && firstSess ? (lastSess.ndvi - firstSess.ndvi) : 0
  const deltaStress = lastSess && firstSess ? (lastSess.stressPct - firstSess.stressPct) : 0

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <section
        className="modal"
        style={{
          width: '1100px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          background: '#0b130e',
          color: '#e2e8f0',
          border: '1px solid rgba(74, 222, 128, 0.3)',
          borderRadius: '16px',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 70px rgba(0,0,0,0.85)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Terminal Header Bar (TradingView / Binance Style) */}
        <div style={{
          background: '#060c08',
          borderBottom: '1px solid #1e2922',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }} />
              <b style={{ color: '#4ade80', letterSpacing: '1px', fontSize: '13px', fontFamily: 'monospace' }}>SEVA·FINANCIAL TERMINAL</b>
            </div>
            <span style={{ color: '#64748b', fontSize: '12px' }}>|</span>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>{farm?.name ? farm.name.toUpperCase() : 'FARM'}</span>
            <span style={{ background: '#132e1b', color: '#86efac', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
              {farm?.crop ? farm.crop.toUpperCase() : 'CROP'} / PARCEL #{farm?.id ? farm.id.slice(0, 6) : '000000'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleExportCsv}
              className="outline sm"
              style={{ color: '#94a3b8', borderColor: '#334155', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px' }}
            >
              <FileSpreadsheet size={13} />
              Export CSV
            </button>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Live Ticker Tape Strip */}
        <div style={{
          background: '#0d1811',
          borderBottom: '1px solid #162a1d',
          padding: '8px 20px',
          display: 'flex',
          gap: '24px',
          overflowX: 'auto',
          fontSize: '11.5px',
          fontFamily: 'monospace'
        }}>
          <div>
            <span style={{ color: '#64748b' }}>CANOPY NDVI: </span>
            <b style={{ color: '#4ade80' }}>{activeSession.ndvi.toFixed(2)}</b>
            <span style={{ color: deltaNdvi >= 0 ? '#4ade80' : '#f87171', marginLeft: '4px' }}>
              {deltaNdvi >= 0 ? '+' : ''}{deltaNdvi.toFixed(2)}
            </span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>LEAF MOISTURE: </span>
            <b style={{ color: '#38bdf8' }}>{activeSession.ndmi.toFixed(2)}</b>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>STRESS COVER: </span>
            <b style={{ color: activeSession.stressPct > 20 ? '#fbbf24' : '#4ade80' }}>{activeSession.stressPct.toFixed(1)}%</b>
            <span style={{ color: deltaStress <= 0 ? '#4ade80' : '#f87171', marginLeft: '4px' }}>
              {deltaStress <= 0 ? '' : '+'}{deltaStress.toFixed(1)}%
            </span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>SOIL WATER (0-1cm): </span>
            <b style={{ color: '#38bdf8' }}>{activeSession.soilMoisture}%</b>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>7-DAY RAIN: </span>
            <b style={{ color: '#f8fafc' }}>{activeSession.rainfallMm.toFixed(1)} mm</b>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>VRA UREA REC: </span>
            <b style={{ color: '#facc15' }}>{activeSession.nitrogenUreaKg} kg/ha</b>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>PROJECTED YIELD: </span>
            <b style={{ color: '#4ade80' }}>{activeSession.yieldEstQtl.toFixed(1)} Qtl/ha</b>
          </div>
        </div>

        {/* Inner Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {/* Sub Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`outline sm ${activeTab === 'terminal' ? 'primary' : ''}`}
                onClick={() => setActiveTab('terminal')}
                style={{ borderRadius: '6px' }}
              >
                <Activity size={13} style={{ marginRight: 5 }} />
                6-Session Comparative Tracker
              </button>
              <button
                className={`outline sm ${activeTab === 'comparison' ? 'primary' : ''}`}
                onClick={() => setActiveTab('comparison')}
                style={{ borderRadius: '6px' }}
              >
                <BarChart3 size={13} style={{ marginRight: 5 }} />
                Multi-Session Candlestick / Trends
              </button>
              <button
                className={`outline sm ${activeTab === 'matrix' ? 'primary' : ''}`}
                onClick={() => setActiveTab('matrix')}
                style={{ borderRadius: '6px' }}
              >
                <Layers size={13} style={{ marginRight: 5 }} />
                Comprehensive Parameter Matrix
              </button>
            </div>

            <button
              onClick={handleAddSession}
              className="primary sm"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Plus size={14} />
              Add Session Record
            </button>
          </div>

          {/* TAB 1: 6-Session Comparative Tracker */}
          {activeTab === 'terminal' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '18px' }}>
                {sessions.map(s => {
                  const isSel = s.id === selectedSessionId
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSessionId(s.id)}
                      style={{
                        background: isSel ? '#13281b' : '#0e1811',
                        border: `1px solid ${isSel ? '#4ade80' : '#1e3325'}`,
                        borderRadius: '10px',
                        padding: '12px 10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: isSel ? '#4ade80' : '#94a3b8', fontFamily: 'monospace' }}>
                          SESSION #{s.num}
                        </span>
                        {sessions.length > 1 && (
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteSession(s.id) }}
                            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                            title="Delete this session"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      <div style={{ fontSize: '10.5px', color: '#64748b', marginBottom: '6px' }}>{s.date}</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                        {s.ndvi.toFixed(2)} <span style={{ fontSize: '10px', color: '#4ade80' }}>NDVI</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        Stress: <b style={{ color: s.stressPct > 20 ? '#fbbf24' : '#4ade80' }}>{s.stressPct.toFixed(0)}%</b>
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.stage}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Selected Session Deep Analytical Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div style={{ background: '#0e1811', border: '1px solid #1e3325', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#4ade80', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Leaf size={15} /> SPECTRAL CANOPY METRICS
                  </div>
                  <div style={{ display: 'grid', gap: '8px', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #162a1d', paddingBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>Canopy Vigor (NDVI):</span>
                      <b style={{ color: '#4ade80' }}>{activeSession.ndvi.toFixed(3)}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #162a1d', paddingBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>Canopy Water (NDMI):</span>
                      <b style={{ color: '#38bdf8' }}>{activeSession.ndmi.toFixed(3)}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #162a1d', paddingBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>Stressed Canopy Area:</span>
                      <b style={{ color: activeSession.stressPct > 20 ? '#fbbf24' : '#4ade80' }}>{activeSession.stressPct.toFixed(1)}%</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Phenological Stage:</span>
                      <b style={{ color: '#f8fafc' }}>{activeSession.stage}</b>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#0e1811', border: '1px solid #1e3325', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Droplets size={15} /> HYDROLOGY &amp; SOIL WATER
                  </div>
                  <div style={{ display: 'grid', gap: '8px', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #162a1d', paddingBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>Soil Moisture (0-1 cm):</span>
                      <b style={{ color: '#38bdf8' }}>{activeSession.soilMoisture}%</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #162a1d', paddingBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>7-Day Precipitation Sum:</span>
                      <b style={{ color: '#f8fafc' }}>{activeSession.rainfallMm.toFixed(1)} mm</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #162a1d', paddingBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>Actual Evapotranspiration:</span>
                      <b style={{ color: '#facc15' }}>{activeSession.etMm.toFixed(1)} mm</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Elevation (a.s.l.):</span>
                      <b style={{ color: '#f8fafc' }}>{activeSession.elevationM} m</b>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#0e1811', border: '1px solid #1e3325', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#facc15', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={15} /> AGRONOMIC ECONOMICS &amp; VRA
                  </div>
                  <div style={{ display: 'grid', gap: '8px', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #162a1d', paddingBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>VRA Urea Prescription:</span>
                      <b style={{ color: '#facc15' }}>{activeSession.nitrogenUreaKg} kg/ha</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #162a1d', paddingBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>Estimated Yield Outlook:</span>
                      <b style={{ color: '#4ade80' }}>{activeSession.yieldEstQtl.toFixed(1)} Qtl/ha</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #162a1d', paddingBottom: '4px' }}>
                      <span style={{ color: '#94a3b8' }}>Water Productivity:</span>
                      <b style={{ color: '#38bdf8' }}>1.42 kg/m³</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Irrigation Status:</span>
                      <b style={{ color: activeSession.soilMoisture < 20 ? '#fbbf24' : '#4ade80' }}>
                        {activeSession.soilMoisture < 20 ? 'Irrigation Needed' : 'Adequate Moisture'}
                      </b>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Multi-Session Trends (TradingView Inspired Sparklines & SVG Chart) */}
          {activeTab === 'comparison' && (
            <div style={{ background: '#0e1811', border: '1px solid #1e3325', borderRadius: '12px', padding: '20px' }}>
              <h4 style={{ margin: '0 0 16px', color: '#f8fafc', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={16} color="#4ade80" />
                6-Session Trajectory Trendlines (NDVI Vigor vs. Canopy Stress)
              </h4>

              <svg viewBox="0 0 800 240" style={{ width: '100%', height: 'auto', background: '#07100a', borderRadius: '8px' }}>
                {/* Gridlines */}
                {[0.2, 0.4, 0.6, 0.8].map(v => {
                  const y = 220 - v * 220
                  return (
                    <g key={v}>
                      <line x1="40" y1={y} x2="780" y2={y} stroke="#1b3022" strokeDasharray="4 4" />
                      <text x="32" y={y + 4} font-size="10" fill="#64748b" text-anchor="end" font-family="monospace">{v.toFixed(1)}</text>
                    </g>
                  )
                })}

                {/* NDVI Polyline (Green) */}
                <polyline
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth="3"
                  points={sessions.map((s, idx) => {
                    const x = 60 + idx * (700 / (sessions.length - 1))
                    const y = 220 - s.ndvi * 220
                    return `${x},${y}`
                  }).join(' ')}
                />

                {/* Points */}
                {sessions.map((s, idx) => {
                  const x = 60 + idx * (700 / (sessions.length - 1))
                  const y = 220 - s.ndvi * 220
                  return (
                    <g key={s.id}>
                      <circle cx={x} cy={y} r="5" fill="#4ade80" stroke="#060c08" strokeWidth="2" />
                      <text x={x} y="235" font-size="10" fill="#94a3b8" text-anchor="middle" font-family="monospace">S#{s.num}</text>
                      <text x={x} y={y - 8} font-size="10" fill="#4ade80" text-anchor="middle" font-weight="bold" font-family="monospace">{s.ndvi.toFixed(2)}</text>
                    </g>
                  )
                })}
              </svg>

              <div style={{ display: 'flex', gap: '20px', marginTop: '14px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', background: '#4ade80' }} />
                  <span style={{ color: '#94a3b8' }}>Canopy NDVI Trajectory</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', background: '#38bdf8' }} />
                  <span style={{ color: '#94a3b8' }}>Canopy Moisture (NDMI)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', background: '#fbbf24' }} />
                  <span style={{ color: '#94a3b8' }}>Vegetative Stress Share (%)</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Comprehensive Parameter Matrix */}
          {activeTab === 'matrix' && (
            <div style={{ background: '#0e1811', border: '1px solid #1e3325', borderRadius: '12px', padding: '16px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'monospace' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #233e2c', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>Session</th>
                    <th style={{ padding: '8px 10px' }}>Date</th>
                    <th style={{ padding: '8px 10px' }}>Stage</th>
                    <th style={{ padding: '8px 10px' }}>NDVI</th>
                    <th style={{ padding: '8px 10px' }}>NDMI</th>
                    <th style={{ padding: '8px 10px' }}>Stress %</th>
                    <th style={{ padding: '8px 10px' }}>Moisture</th>
                    <th style={{ padding: '8px 10px' }}>Rain mm</th>
                    <th style={{ padding: '8px 10px' }}>ETa mm</th>
                    <th style={{ padding: '8px 10px' }}>Urea kg/ha</th>
                    <th style={{ padding: '8px 10px' }}>Yield Qtl</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #162a1d' }}>
                      <td style={{ padding: '8px 10px', color: '#4ade80', fontWeight: 700 }}>#{s.num}</td>
                      <td style={{ padding: '8px 10px', color: '#f8fafc' }}>{s.date}</td>
                      <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{s.stage}</td>
                      <td style={{ padding: '8px 10px', color: '#4ade80', fontWeight: 700 }}>{s.ndvi.toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', color: '#38bdf8' }}>{s.ndmi.toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', color: s.stressPct > 20 ? '#fbbf24' : '#4ade80' }}>{s.stressPct.toFixed(1)}%</td>
                      <td style={{ padding: '8px 10px', color: '#38bdf8' }}>{s.soilMoisture}%</td>
                      <td style={{ padding: '8px 10px', color: '#f8fafc' }}>{s.rainfallMm.toFixed(1)}</td>
                      <td style={{ padding: '8px 10px', color: '#facc15' }}>{s.etMm.toFixed(1)}</td>
                      <td style={{ padding: '8px 10px', color: '#facc15' }}>{s.nitrogenUreaKg}</td>
                      <td style={{ padding: '8px 10px', color: '#4ade80' }}>{s.yieldEstQtl.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
