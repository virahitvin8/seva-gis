import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Globe2,
  Sparkles,
  Zap,
  Activity,
  Layers,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  X,
  Move,
  Minus,
  Maximize2,
  Clock,
  BookOpen,
  DollarSign,
  ShieldCheck,
  Send,
  Terminal,
  Cpu
} from 'lucide-react'
import {
  checkEarthEngineBackendHealth,
  getEarthEngineEndpoint,
  getEarthEngineStats,
  type EarthEngineStatsResponse
} from './lib/earthEngineClient'
import { buildEarthEngineScript, buildThesisMapScript } from './lib/earthEngine'
import { runAgentCrewUltrawork, type CrewExecutionResult, type AgentMessage } from './lib/agentsCrew'
import { getFarmMemories, saveFarmMemory, type FarmMemory } from './lib/memoryEngine'
import { type FarmData } from './lib/seva'

export type GeeAgentCenterProps = {
  farm: FarmData & { id: string; name: string }
  isOpen: boolean
  onClose: () => void
  onApplyGeeSettings?: (compositing: string, bandCombo: string, stretchDra: boolean) => void
}

export default function GeeAgentCenter({
  farm,
  isOpen,
  onClose,
  onApplyGeeSettings
}: GeeAgentCenterProps) {
  const [activeTab, setActiveTab] = useState<'gee' | 'crew' | 'memory' | 'script'>('gee')

  // GEE State
  const [health, setHealth] = useState<{ ok: boolean; project?: string; service?: string; detail?: string } | null>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)
  const [compositing, setCompositing] = useState<'median' | 'mosaic' | 'mean' | 'max_ndvi'>('median')
  const [bandCombo, setBandCombo] = useState<string>('natural')
  const [stretchDra, setStretchDra] = useState<boolean>(true)
  const [copiedScript, setCopiedScript] = useState(false)
  const [scriptMode, setScriptMode] = useState<'farm' | 'thesis'>('farm')

  // CrewAI State
  const [crewRunning, setCrewRunning] = useState(false)
  const [crewResult, setCrewResult] = useState<CrewExecutionResult | null>(null)

  // Memory State
  const [memories, setMemories] = useState<FarmMemory[]>([])
  const [newNote, setNewNote] = useState('')

  // Window State (Draggable & Minimizable)
  const [detached, setDetached] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [pos, setPos] = useState({ x: 40, y: 60 })
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Check health on open
  useEffect(() => {
    if (!isOpen) return
    checkHealth()
    setMemories(getFarmMemories(farm.id))
  }, [isOpen, farm.id])

  async function checkHealth() {
    setCheckingHealth(true)
    try {
      const res = await checkEarthEngineBackendHealth()
      setHealth(res)
    } finally {
      setCheckingHealth(false)
    }
  }

  // Pointer drag listeners
  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => {
      setPos({
        x: Math.max(10, Math.min(window.innerWidth - 380, e.clientX - dragOffset.current.x)),
        y: Math.max(10, Math.min(window.innerHeight - 80, e.clientY - dragOffset.current.y)),
      })
    }
    const end = () => setDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
  }, [dragging])

  async function handleRunCrew() {
    setCrewRunning(true)
    try {
      const res = await runAgentCrewUltrawork(farm)
      setCrewResult(res)
      setMemories(getFarmMemories(farm.id))
    } finally {
      setCrewRunning(false)
    }
  }

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!newNote.trim()) return
    const mem = saveFarmMemory({
      farmId: farm.id,
      type: 'farmer_note',
      title: 'Farmer Field Observation',
      content: newNote.trim(),
    })
    setMemories([mem, ...memories])
    setNewNote('')
  }

  const generatedScript = useMemo(() => {
    if (scriptMode === 'thesis') {
      return buildThesisMapScript()
    }
    return buildEarthEngineScript(farm, 'ndvi', bandCombo, {})
  }, [scriptMode, farm, bandCombo])

  function handleCopyScript() {
    navigator.clipboard.writeText(generatedScript)
    setCopiedScript(true)
    setTimeout(() => setCopiedScript(false), 2500)
  }

  if (!isOpen) return null

  return (
    <div
      className={`ix-gee-agent-center ${detached ? 'detached' : 'docked'} ${minimized ? 'minimized' : ''}`}
      style={detached ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 1200 } : undefined}
      role="dialog"
      aria-label="Google Earth Engine & Multi-Agent Intelligence Center"
    >
      {/* Draggable Header */}
      <div
        className={`ix-gac-header ${detached ? 'draggable' : ''}`}
        onPointerDown={e => {
          if (!detached) return
          if ((e.target as HTMLElement).closest('button')) return
          dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
          setDragging(true)
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="ix-gac-logo-badge">
            <Cpu size={16} className="text-emerald-400" />
          </div>
          <div>
            <strong style={{ fontSize: 13, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>GEE & Autonomous Agent Studio</span>
              <span className="ix-gac-tag">v2.4 Live</span>
            </strong>
            <small style={{ fontSize: 10, color: '#94a3b8' }}>
              Google Earth Engine Cloud Run · Multi-Agent Orchestration
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setDetached(!detached)}
            title={detached ? 'Dock to map position' : 'Detach to drag freely anywhere on screen'}
            className="ix-win-btn-dark"
          >
            <Move size={13} />
          </button>
          <button
            onClick={() => setMinimized(!minimized)}
            title={minimized ? 'Expand panel' : 'Minimize panel'}
            className="ix-win-btn-dark"
          >
            {minimized ? <Maximize2 size={13} /> : <Minus size={13} />}
          </button>
          <button onClick={onClose} aria-label="Close" className="ix-win-btn-dark">
            <X size={15} />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="ix-gac-body">
          {/* Navigation Tabs */}
          <div className="ix-gac-tabs">
            <button
              className={`ix-gac-tab ${activeTab === 'gee' ? 'active' : ''}`}
              onClick={() => setActiveTab('gee')}
            >
              <Globe2 size={13} />
              <span>GEE Live Engine</span>
            </button>
            <button
              className={`ix-gac-tab ${activeTab === 'crew' ? 'active' : ''}`}
              onClick={() => setActiveTab('crew')}
            >
              <Zap size={13} />
              <span>Autonomous Crew ({crewResult ? '1' : '0'})</span>
            </button>
            <button
              className={`ix-gac-tab ${activeTab === 'memory' ? 'active' : ''}`}
              onClick={() => setActiveTab('memory')}
            >
              <Clock size={13} />
              <span>Farm Memory ({memories.length})</span>
            </button>
            <button
              className={`ix-gac-tab ${activeTab === 'script' ? 'active' : ''}`}
              onClick={() => setActiveTab('script')}
            >
              <Terminal size={13} />
              <span>Code Editor Script</span>
            </button>
          </div>

          {/* TAB 1: GEE LIVE ENGINE */}
          {activeTab === 'gee' && (
            <div className="ix-gac-content">
              {/* Health Banner */}
              <div className="ix-gac-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={`ix-pulse-indicator ${health?.ok ? 'ok' : 'pending'}`} />
                    <b style={{ fontSize: 12, color: '#f1f5f9' }}>Earth Engine Cloud Run Service</b>
                  </div>
                  <button
                    className="ix-gac-sm-btn"
                    onClick={checkHealth}
                    disabled={checkingHealth}
                  >
                    <RefreshCw size={11} className={checkingHealth ? 'animate-spin' : ''} />
                    <span>{checkingHealth ? 'Pinging…' : 'Ping Backend'}</span>
                  </button>
                </div>
                <div className="ix-gac-info-grid">
                  <div>
                    <span>Backend Endpoint:</span>
                    <code>{getEarthEngineEndpoint()}</code>
                  </div>
                  <div>
                    <span>GCP Project:</span>
                    <code>{health?.project || 'seva-gis-backend'}</code>
                  </div>
                  <div>
                    <span>Satellite Collection:</span>
                    <code>COPERNICUS/S2_SR_HARMONIZED</code>
                  </div>
                  <div>
                    <span>Tile Protocol:</span>
                    <code>earthengine.googleapis.com</code>
                  </div>
                </div>
              </div>

              {/* Live Compositing & Stretching Controls */}
              <div className="ix-gac-card">
                <h4 style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 8, textTransform: 'uppercase' }}>
                  Compositing Algorithm & Spectral Synthesis
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 10 }}>
                  {[
                    { id: 'median', label: 'Median Composite', hint: 'Removes clouds & shadows' },
                    { id: 'mosaic', label: 'Cloud-Free Mosaic', hint: 'Least cloud pixel per swath' },
                    { id: 'mean', label: 'Mean Reflectance', hint: 'Standard spectral average' },
                    { id: 'max_ndvi', label: 'Maximum NDVI', hint: 'Peak photosynthetic signal' }
                  ].map(c => (
                    <button
                      key={c.id}
                      className={`ix-gac-choice-btn ${compositing === c.id ? 'active' : ''}`}
                      onClick={() => {
                        setCompositing(c.id as any)
                        onApplyGeeSettings?.(c.id, bandCombo, stretchDra)
                      }}
                    >
                      <b>{c.label}</b>
                      <small>{c.hint}</small>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #334155' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#e2e8f0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stretchDra}
                      onChange={e => {
                        setStretchDra(e.target.checked)
                        onApplyGeeSettings?.(compositing, bandCombo, e.target.checked)
                      }}
                    />
                    <span>Percentile Dynamic Range Adjustment (2%–98% DRA)</span>
                  </label>
                  <span className="ix-tag-green">Live Active</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AUTONOMOUS CREW (CrewAI / OmO / LangChain) */}
          {activeTab === 'crew' && (
            <div className="ix-gac-content">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <b style={{ fontSize: 12, color: '#f8fafc' }}>Autonomous Agricultural GIS Squad</b>
                  <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>
                    4 collaborative agents orchestrate satellite, agronomic, cadastre, and mandi intelligence.
                  </p>
                </div>
                <button
                  className="ix-gac-ultrawork-btn"
                  onClick={handleRunCrew}
                  disabled={crewRunning}
                >
                  <Zap size={13} className={crewRunning ? 'animate-bounce' : ''} />
                  <span>{crewRunning ? 'Crew Computing…' : '⚡ Run Ultrawork Crew'}</span>
                </button>
              </div>

              {crewResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Synthesis Banner */}
                  <div className="ix-gac-synth-banner">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <strong style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <CheckCircle2 size={14} />
                        <span>Synthesized Crew Dossier</span>
                      </strong>
                      <span className="ix-gac-score-pill">
                        Field Vitality Score: {crewResult.overallHealthScore}/100
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 1.45, margin: 0 }}>
                      {crewResult.synthesizedRecommendation}
                    </p>
                  </div>

                  {/* Individual Agent Cards */}
                  {crewResult.agents.map(ag => (
                    <div key={ag.id} className="ix-gac-agent-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16 }}>{ag.avatar}</span>
                          <b style={{ fontSize: 11, color: '#f1f5f9' }}>{ag.agentName}</b>
                        </div>
                        <span style={{ fontSize: 10, color: '#64748b' }}>{ag.timestamp}</span>
                      </div>
                      <p style={{ fontSize: 11, color: '#38bdf8', margin: '2px 0 6px 0', fontWeight: 600 }}>
                        {ag.summary}
                      </p>
                      <ul className="ix-gac-agent-bullets">
                        {ag.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                      {ag.metrics && (
                        <div className="ix-gac-metric-pills">
                          {Object.entries(ag.metrics).map(([k, v]) => (
                            <span key={k}>
                              <b>{k}:</b> {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ix-gac-empty-crew">
                  <Cpu size={32} className="text-slate-500 mb-2" />
                  <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', maxWidth: 280 }}>
                    Click <b>⚡ Run Ultrawork Crew</b> to deploy the 4 autonomous agents across GEE satellite reflectance, soil/crop health, and cadastral records.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LONG-TERM MEMORY (Claude-Mem) */}
          {activeTab === 'memory' && (
            <div className="ix-gac-content">
              <form onSubmit={handleAddNote} style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Record an observation (e.g., irrigated 40mm today, sprayed urea)..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="ix-gac-input"
                />
                <button type="submit" className="ix-gac-note-btn">
                  <Send size={13} />
                  <span>Save</span>
                </button>
              </form>

              <div className="ix-gac-memory-list">
                {memories.map(mem => (
                  <div key={mem.id} className="ix-gac-memory-item">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <b style={{ fontSize: 11, color: '#34d399' }}>{mem.title}</b>
                      <small style={{ fontSize: 9, color: '#64748b' }}>
                        {new Date(mem.timestamp).toLocaleDateString()}
                      </small>
                    </div>
                    <p style={{ fontSize: 11, color: '#cbd5e1', margin: 0, lineHeight: 1.35 }}>
                      {mem.content}
                    </p>
                    {mem.metrics && Object.keys(mem.metrics).length > 0 && (
                      <div className="ix-gac-metric-pills" style={{ marginTop: 4 }}>
                        {Object.entries(mem.metrics).map(([k, v]) => (
                          <span key={k}>
                            <b>{k}:</b> {v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: CODE EDITOR SCRIPT */}
          {activeTab === 'script' && (
            <div className="ix-gac-content">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className={`ix-gac-sm-btn ${scriptMode === 'farm' ? 'active' : ''}`}
                    onClick={() => setScriptMode('farm')}
                    style={scriptMode === 'farm' ? { background: '#059669', color: '#fff', borderColor: '#10b981' } : undefined}
                  >
                    <span>🌱 Farm Parcel S2 L2A</span>
                  </button>
                  <button
                    className={`ix-gac-sm-btn ${scriptMode === 'thesis' ? 'active' : ''}`}
                    onClick={() => setScriptMode('thesis')}
                    style={scriptMode === 'thesis' ? { background: '#0284c7', color: '#fff', borderColor: '#38bdf8' } : undefined}
                  >
                    <span>🌊 Wainganga Basin (MAPS REF)</span>
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="ix-gac-sm-btn" onClick={handleCopyScript}>
                    {copiedScript ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedScript ? 'Copied!' : 'Copy Script'}</span>
                  </button>
                  <a
                    href="https://code.earthengine.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ix-gac-sm-btn"
                  >
                    <ExternalLink size={11} />
                    <span>Open Code Editor</span>
                  </a>
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>
                {scriptMode === 'farm'
                  ? 'Pure JavaScript for GEE Code Editor: Sentinel-2 Level-2A surface reflectance, cloud masking, band math, and farm boundary geometry.'
                  : 'Publication Thesis Script (MAPS REF): Replicates Fig 3.2 DEM 30m, Fig 3.3 9-Class SWAT LULC, and Fig 3.6 Stream Gauging Reaches in GEE.'}
              </div>
              <pre className="ix-gac-code-box">
                <code>{generatedScript}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
