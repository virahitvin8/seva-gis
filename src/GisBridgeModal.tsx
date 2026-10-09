import { useState, useEffect } from 'react'
import {
  Download, Globe2, Layers, Check, Copy, ExternalLink,
  RefreshCw, Terminal, Play, ArrowRight, ShieldCheck, Sparkles,
  Cpu, FileCode, CheckCircle2, AlertCircle, FileArchive, Key
} from 'lucide-react'
import type { FarmData } from './lib/seva'
import {
  checkBridgeHealth,
  exportResultsToBridge,
  buildResultPayload,
  getSavedBridgeToken,
  saveBridgeToken
} from './bridge'

type Props = {
  farm?: FarmData & { id: string; name: string; crop?: string; polygon?: [number, number][] }
  onImportFarm?: (newFarm: { name: string; crop: string; ring: [number, number][] }) => void
  onClose: () => void
}

export default function GisBridgeModal({ farm, onImportFarm, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'qgis' | 'arcmap' | 'bridge' | 'exchange'>('qgis')
  const [bridgeStatus, setBridgeStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [pasteInput, setPasteInput] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [token, setToken] = useState(getSavedBridgeToken())
  const [tokenSaved, setTokenSaved] = useState(false)

  // Check if local bridge daemon (127.0.0.1:8765) is running
  async function checkBridge() {
    setBridgeStatus('checking')
    const health = await checkBridgeHealth()
    if (health && health.ok) {
      setBridgeStatus('online')
    } else {
      setBridgeStatus('offline')
    }
  }

  useEffect(() => {
    checkBridge()
  }, [])

  function handleSaveToken(val: string) {
    setToken(val)
    saveBridgeToken(val)
    setTokenSaved(true)
    setTimeout(() => setTokenSaved(false), 2200)
  }

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2500)
  }

  // Push current farm to local bridge if active
  async function pushToBridge() {
    if (!farm) return
    const tokenVal = getSavedBridgeToken()
    const payload = buildResultPayload(farm, {
      ndvi: 0.74,
      ndmi: 0.24,
      ndre: 0.46,
      health: 'Optimal / Vigorous',
      stress: 0.12,
      irrigation: '32mm drip cycle at 06:00 (FAO-56)',
      vran: 85.0,
      alert: 0
    })

    if (tokenVal && bridgeStatus === 'online') {
      const ok = await exportResultsToBridge(payload, tokenVal)
      if (ok) {
        handleCopy(JSON.stringify(payload, null, 2), 'pushed')
        return
      }
    }
    // Fallback: copy GeoJSON to clipboard
    handleCopy(JSON.stringify(payload, null, 2), 'pushed_fallback')
  }

  // Test simulation of sending a field from QGIS
  function simulateQgisImport() {
    if (!onImportFarm) return
    // Sample high-detail field boundary
    const sampleRing: [number, number][] = [
      [75.8521, 30.9015],
      [75.8582, 30.9018],
      [75.8590, 30.8965],
      [75.8530, 30.8960],
      [75.8521, 30.9015],
    ]
    onImportFarm({
      name: 'QGIS Punjab Cadastral Field #84',
      crop: 'Wheat',
      ring: sampleRing,
    })
    onClose()
  }

  // Parse pasted GeoJSON / WKT
  function handleManualImport() {
    setPasteError('')
    if (!pasteInput.trim()) return
    try {
      const data = JSON.parse(pasteInput)
      let ring: [number, number][] = []
      let name = 'Imported Field'
      let crop = 'Paddy (Rice)'

      if (data.type === 'FeatureCollection' && data.features?.[0]?.geometry) {
        const geom = data.features[0].geometry
        if (geom.type === 'Polygon') ring = geom.coordinates[0]
        name = data.features[0].properties?.name || data.name || name
        crop = data.features[0].properties?.crop || crop
      } else if (data.type === 'Feature' && data.geometry) {
        if (data.geometry.type === 'Polygon') ring = data.geometry.coordinates[0]
        name = data.properties?.name || name
      } else if (Array.isArray(data.ring)) {
        ring = data.ring
        name = data.name || name
        crop = data.crop || crop
      } else if (data.type === 'Polygon' && Array.isArray(data.coordinates)) {
        ring = data.coordinates[0]
      }

      if (ring.length >= 3 && onImportFarm) {
        onImportFarm({ name, crop, ring })
        onClose()
      } else {
        setPasteError('Could not find a valid polygon ring with at least 3 coordinates.')
      }
    } catch (e: any) {
      setPasteError('Invalid JSON format. Please paste valid GeoJSON or JSON.')
    }
  }

  const arcpySnippet = `import sys
sys.path.append(r"C:\\path\\to\\seva_gis_arcgis")
import seva_gis_arcpy

# Send any selected layer directly to SEVA·GIS
seva_gis_arcpy.send_layer(
    layer_name="Cadastral_Parcels",
    crop="Wheat",
    name="Parcel_104",
    app_url="https://sevagis.dpdns.org"
)`

  return (
    <div className="gis-bridge-container">
      {/* Top Banner & Status */}
      <div className="gis-bridge-header">
        <div className="gis-bridge-brand">
          <div className="gis-logo-icon">
            <Globe2 size={24} className="text-emerald-400" />
          </div>
          <div>
            <h3>Desktop GIS Bridge — QGIS & ArcMap</h3>
            <p>Connect your desktop GIS projects directly with live SEVA·GIS in-browser GeoAI</p>
          </div>
        </div>

        {/* Live Bridge Ping Status */}
        <div className="gis-bridge-status-pill">
          {bridgeStatus === 'checking' ? (
            <span className="status-badge checking">
              <RefreshCw size={12} className="spin" /> Checking bridge...
            </span>
          ) : bridgeStatus === 'online' ? (
            <span className="status-badge online" title="Local bridge daemon running on 127.0.0.1:8765">
              <CheckCircle2 size={13} /> Bridge Daemon Online
            </span>
          ) : (
            <span className="status-badge offline" title="Deep-link mode active. Optional: start seva_bridge.py for real-time background sync">
              <span className="dot amber" /> Direct Deep-Link Ready
            </span>
          )}
          <button
            className="bridge-refresh-btn"
            onClick={checkBridge}
            title="Refresh bridge connection status"
            aria-label="Refresh bridge connection"
          >
            <RefreshCw size={12} className={bridgeStatus === 'checking' ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Hero Coconut Tree GIF Download & Setup Showcase */}
      <div className="gis-hero-coconut-box">
        <div className="gis-coconut-visual">
          <img
            src="/plant-coconut-loader.gif"
            alt="SEVA.GIS Plant to Coconut Tree Growth"
            className="gis-coconut-gif"
          />
          <div className="gis-coconut-badge">
            <span className="live-pulse" />
            <span>GIS Sync Engine</span>
          </div>
        </div>

        <div className="gis-coconut-details">
          <div className="gis-hero-badge">
            <Sparkles size={14} className="text-emerald-400" />
            <span>Two-Way GIS Plugin & Toolbox v1.0.0</span>
          </div>
          <h4 className="gis-coconut-title">Download Desktop GIS Plugins & Tools</h4>
          <p className="gis-coconut-desc">
            Directly connect <strong>QGIS 3</strong> and <strong>ArcMap 10.x / ArcGIS Pro</strong> to SEVA·GIS in-browser GeoAI.
            Instant cadastral boundary extraction, WGS84 reprojection, and live two-way synchronization for Sentinel-2 NDVI, moisture, and swath robotics.
          </p>

          {/* Download Options under Coconut Tree GIF */}
          <div className="gis-download-options-grid">
            <a
              href="/plugins/seva_gis_qgis_plugin.zip"
              download="seva_gis_qgis_plugin.zip"
              className="gis-option-card qgis"
              title="Download QGIS 3 Plugin ZIP"
            >
              <div className="option-icon">
                <FileArchive size={20} />
              </div>
              <div className="option-info">
                <div className="option-name">
                  <span>QGIS 3 Plugin</span>
                  <span className="option-tag">Recommended</span>
                </div>
                <div className="option-sub">seva_gis_qgis_plugin.zip (Install from ZIP)</div>
              </div>
              <Download size={16} className="option-arrow" />
            </a>

            <a
              href="/plugins/seva_gis_arcgis_toolbox.zip"
              download="seva_gis_arcgis_toolbox.zip"
              className="gis-option-card arcgis"
              title="Download ArcGIS Python Toolbox ZIP"
            >
              <div className="option-icon">
                <Cpu size={20} />
              </div>
              <div className="option-info">
                <div className="option-name">
                  <span>ArcGIS Toolbox</span>
                  <span className="option-tag arc">ArcMap & Pro</span>
                </div>
                <div className="option-sub">SEVA_GIS_Toolbox.pyt & Python 2.7/3</div>
              </div>
              <Download size={16} className="option-arrow" />
            </a>

            <a
              href="/plugins/seva_bridge.py"
              download="seva_bridge.py"
              className="gis-option-card bridge"
              title="Download Local Bridge Daemon Python Script"
            >
              <div className="option-icon">
                <Terminal size={20} />
              </div>
              <div className="option-info">
                <div className="option-name">
                  <span>Bridge Daemon</span>
                  <span className="option-tag daemon">Daemon</span>
                </div>
                <div className="option-sub">seva_bridge.py (Zero dependencies)</div>
              </div>
              <Download size={16} className="option-arrow" />
            </a>
          </div>

          {/* Easy Setup Links */}
          <div className="gis-quick-setup-bar">
            <span className="setup-label">Fast Setup in 10s:</span>
            <button
              className="quick-link-btn"
              onClick={() => setActiveTab('qgis')}
            >
              ⚡ Setup in QGIS
            </button>
            <span className="setup-dot">•</span>
            <button
              className="quick-link-btn"
              onClick={() => setActiveTab('arcmap')}
            >
              ⚡ Setup in ArcMap / Pro
            </button>
            <span className="setup-dot">•</span>
            <button
              className="quick-link-btn"
              onClick={() => handleCopy('python seva_bridge.py', 'bridge-cmd')}
            >
              {copiedText === 'bridge-cmd' ? '✓ Copied bridge command!' : '📋 Copy Daemon Command'}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="gis-bridge-tabs">
        <button
          className={`gis-tab-btn ${activeTab === 'qgis' ? 'active' : ''}`}
          onClick={() => setActiveTab('qgis')}
        >
          <Layers size={16} />
          <span>QGIS 3 Plugin</span>
          <span className="tab-pill">Recommended</span>
        </button>
        <button
          className={`gis-tab-btn ${activeTab === 'arcmap' ? 'active' : ''}`}
          onClick={() => setActiveTab('arcmap')}
        >
          <Cpu size={16} />
          <span>ArcMap & ArcGIS Pro</span>
        </button>
        <button
          className={`gis-tab-btn ${activeTab === 'exchange' ? 'active' : ''}`}
          onClick={() => setActiveTab('exchange')}
        >
          <FileCode size={16} />
          <span>Two-Way Sync</span>
        </button>
        <button
          className={`gis-tab-btn ${activeTab === 'bridge' ? 'active' : ''}`}
          onClick={() => setActiveTab('bridge')}
        >
          <Terminal size={16} />
          <span>Local Bridge Daemon</span>
        </button>
      </div>

      {/* Tab Content 1: QGIS 3 */}
      {activeTab === 'qgis' && (
        <div className="gis-tab-pane">
          <div className="gis-feature-box">
            <div className="gis-feature-text">
              <h4>Official QGIS 3.x Plugin</h4>
              <p>
                Seamlessly connects QGIS vector layers to SEVA·GIS. Select any farm polygon in your QGIS project, click the <b>⚡ Send to SEVA·GIS</b> toolbar icon, and watch live Sentinel-2 satellite analytics, tractor swaths, and irrigation recommendations generate in seconds.
              </p>
            </div>
            <a
              href="/plugins/seva_gis_qgis_plugin.zip"
              download="seva_gis_qgis_plugin.zip"
              className="gis-download-btn primary"
            >
              <FileArchive size={17} />
              <span>Download QGIS Plugin (.zip)</span>
            </a>
          </div>

          <div className="gis-steps-grid">
            <div className="gis-step-card">
              <div className="step-num">1</div>
              <h5>Install in QGIS</h5>
              <p>In QGIS 3, go to <b>Plugins</b> → <b>Manage and Install Plugins...</b> → <b>Install from ZIP</b>. Select <code>seva_gis_qgis_plugin.zip</code> and click Install.</p>
            </div>
            <div className="gis-step-card">
              <div className="step-num">2</div>
              <h5>Select Your Field</h5>
              <p>Open your cadastral Shapefile or GeoPackage. Use the standard selection tool to highlight any farm parcel or boundary.</p>
            </div>
            <div className="gis-step-card">
              <div className="step-num">3</div>
              <h5>Click & Analyze</h5>
              <p>Click the <b>⚡ Send to SEVA·GIS</b> button in your QGIS toolbar. The plugin reprojects to WGS84, launches SEVA·GIS, and starts analysis!</p>
            </div>
          </div>

          {/* Simulation button */}
          <div className="gis-simulate-bar">
            <span>Want to test the QGIS workflow right now?</span>
            <button className="simulate-btn" onClick={simulateQgisImport}>
              <Play size={14} />
              <span>Simulate Send from QGIS (Demo Field)</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab Content 2: ArcMap & ArcGIS Pro */}
      {activeTab === 'arcmap' && (
        <div className="gis-tab-pane">
          <div className="gis-feature-box">
            <div className="gis-feature-text">
              <h4>ArcMap 10.x & ArcGIS Pro Python Toolbox</h4>
              <p>
                Native Python Toolbox (<code>.pyt</code>) compatible with both ArcMap and ArcGIS Pro. Runs directly inside ArcToolbox to project, extract, and stream cadastral field features directly to SEVA·GIS.
              </p>
            </div>
            <a
              href="/plugins/seva_gis_arcgis_toolbox.zip"
              download="seva_gis_arcgis_toolbox.zip"
              className="gis-download-btn secondary"
            >
              <Download size={17} />
              <span>Download ArcGIS Toolbox (.pyt)</span>
            </a>
          </div>

          <div className="gis-steps-grid">
            <div className="gis-step-card">
              <div className="step-num">1</div>
              <h5>Add to ArcToolbox</h5>
              <p>In ArcMap or ArcGIS Pro, open <b>ArcToolbox</b> → Right-click → <b>Add Toolbox...</b> → Browse to <code>SEVA_GIS_Toolbox.pyt</code>.</p>
            </div>
            <div className="gis-step-card">
              <div className="step-num">2</div>
              <h5>Run Geoprocessing Tool</h5>
              <p>Expand the toolbox and open <b>⚡ Send Parcels to SEVA·GIS & Analyze</b>. Select your polygon layer, pick your crop, and hit <b>Run</b>.</p>
            </div>
            <div className="gis-step-card">
              <div className="step-num">3</div>
              <h5>Import Analysis Back</h5>
              <p>Use the second tool <b>📥 Pull Analysis Results from SEVA·GIS</b> to sync NDVI, moisture, and VRA recommendations back into layer attributes.</p>
            </div>
          </div>

          <div className="code-snippet-box">
            <div className="code-snippet-head">
              <span>Python Window 1-Liner for ArcMap & ArcGIS Pro Notebooks:</span>
              <button
                className="copy-btn"
                onClick={() => handleCopy(arcpySnippet, 'arcpy')}
              >
                {copiedText === 'arcpy' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copiedText === 'arcpy' ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
            <pre className="code-block">{arcpySnippet}</pre>
          </div>
        </div>
      )}

      {/* Tab Content 3: Two-Way Sync & Exchange */}
      {activeTab === 'exchange' && (
        <div className="gis-tab-pane">
          <div className="exchange-grid">
            {/* Push Current Farm */}
            <div className="exchange-card">
              <div className="exchange-card-head">
                <Layers size={18} className="text-emerald-400" />
                <h4>Send Active Farm to Desktop GIS</h4>
              </div>
              <p>
                Export the currently viewed field boundary (<b>{farm?.name || 'Selected Farm'}</b>), tractor swaths, and scout hotspots formatted for QGIS & ArcMap.
              </p>
              <div className="exchange-actions">
                <button className="exchange-btn primary" onClick={pushToBridge}>
                  <Copy size={15} />
                  <span>
                    {copiedText === 'pushed'
                      ? 'Transmitted to Local Bridge!'
                      : copiedText === 'pushed_fallback'
                      ? 'Copied GeoJSON to Clipboard!'
                      : 'Sync to QGIS / ArcMap'}
                  </span>
                </button>
              </div>
              <div className="note-text">
                <ShieldCheck size={14} />
                <span>Compatible with QGIS memory layers and ArcGIS JSON-to-Features.</span>
              </div>
            </div>

            {/* Direct Ingestion / Paste */}
            <div className="exchange-card">
              <div className="exchange-card-head">
                <Globe2 size={18} className="text-sky-400" />
                <h4>Direct Ingest from QGIS / ArcMap</h4>
              </div>
              <p>Paste GeoJSON or feature coordinates copied from QGIS or ArcMap:</p>
              <textarea
                className="gis-paste-area"
                placeholder='Paste {"type": "FeatureCollection", ...} or {"ring": [[lon, lat], ...]}'
                value={pasteInput}
                onChange={e => setPasteInput(e.target.value)}
                rows={4}
              />
              {pasteError && <p className="paste-error-msg">{pasteError}</p>}
              <button className="exchange-btn secondary" onClick={handleManualImport}>
                <ArrowRight size={15} />
                <span>Import & Trigger Satellite Analysis</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 4: Local Bridge Daemon */}
      {activeTab === 'bridge' && (
        <div className="gis-tab-pane">
          <div className="gis-feature-box">
            <div className="gis-feature-text">
              <h4>Zero-Config Local Bridge Daemon (<code>seva_bridge.py</code>)</h4>
              <p>
                A lightweight, zero-dependency Python script that runs on <code>http://127.0.0.1:8765</code>. It acts as an instant local communication bridge between desktop GIS software and your browser window. Zero coordinates leave your machine!
              </p>
            </div>
            <a
              href="/plugins/seva_bridge.py"
              download="seva_bridge.py"
              className="gis-download-btn secondary"
            >
              <Download size={17} />
              <span>Download seva_bridge.py</span>
            </a>
          </div>

          <div className="token-settings-card">
            <div className="spec-item">
              <Key size={16} className="text-amber-400" />
              <div>
                <strong>Local Bridge Pairing Token:</strong>
                <p style={{ margin: '2px 0 6px', fontSize: '10.5px', color: '#64748b' }}>
                  The token printed by <code>seva_bridge.py</code> (stored securely in <code>~/.seva/bridge_token</code>). Required for web security.
                </p>
              </div>
            </div>
            <div className="token-input-group">
              <input
                type="password"
                className="token-input"
                placeholder="Paste pairing token here..."
                value={token}
                onChange={e => handleSaveToken(e.target.value)}
              />
              <button className="token-test-btn" onClick={checkBridge}>
                Test Ping
              </button>
            </div>
            {tokenSaved && <span className="token-saved-msg">✓ Pairing token saved to local storage</span>}
          </div>

          <div className="code-snippet-box">
            <div className="code-snippet-head">
              <span>Start the Local Bridge Daemon (Terminal / PowerShell):</span>
              <button
                className="copy-btn"
                onClick={() => handleCopy('python seva_bridge.py', 'cmd')}
              >
                {copiedText === 'cmd' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copiedText === 'cmd' ? 'Copied!' : 'Copy Command'}</span>
              </button>
            </div>
            <pre className="code-block">python seva_bridge.py</pre>
          </div>

          <div className="bridge-specs-list">
            <div className="spec-item">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <div>
                <strong>Zero External Dependencies:</strong> Uses standard Python 3 <code>http.server</code> and <code>json</code> modules.
              </div>
            </div>
            <div className="spec-item">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <div>
                <strong>Anti-DNS Rebinding & Host Guard:</strong> Enforces <code>Host: 127.0.0.1</code> checks and timing-safe token authentication.
              </div>
            </div>
            <div className="spec-item">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <div>
                <strong>100% Client-Side Privacy:</strong> Coordinates travel only between localhost processes on your machine.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
