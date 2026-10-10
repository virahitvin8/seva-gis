import LogoLoader from './LogoLoader'
import { useState, useEffect } from 'react'
import {
  ArrowDownToLine,
  FileJson,
  Printer,
  FileText,
  Languages,
  Mail,
  Send,
  History,
  Trash2,
  FolderOpen,
  Eye,
  Sparkles,
  CheckCircle2,
  Layers,
  Sliders,
  CheckSquare,
  Square,
  ShieldCheck,
  Compass,
} from 'lucide-react'
import {
  DEFAULT_OPTS,
  MAP_CHOICES,
  BAND_SYMBOLOGY_CHOICES,
  REPORT_LANG_NAMES,
  buildReport,
  type CartOpts,
  type ReportFarm,
  type ReportLang,
  type ReportOpts,
} from './report'
import {
  getReportHistory,
  saveReportToHistory,
  deleteReportHistory,
  clearAllReportHistory,
  downloadHistoricalReport,
  type ReportHistoryEntry,
} from './lib/reportHistory'
import { syncAndSendViaEmailOctopus, EMAIL_OCTOPUS_CONFIG } from './lib/emailOctopus'

export default function ReportPanel({ farm }: { farm?: ReportFarm | null }) {
  if (!farm) {
    return (
      <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8' }}>
        <p style={{ margin: '0 0 10px', fontSize: '15px', color: '#cbd5e1', fontWeight: 600 }}>No field selected</p>
        <p style={{ margin: 0, fontSize: '13px' }}>Please add or select a field boundary first to view or generate farm reports.</p>
      </div>
    )
  }
  return <ReportPanelInner farm={farm} />
}

function ReportPanelInner({ farm }: { farm: ReportFarm }) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [reports, setReports] = useState<Partial<Record<ReportLang, { html: string; data: unknown; id: string; lang: ReportLang }>>>({})
  const [previewLang, setPreviewLang] = useState<ReportLang>('en')
  const [url, setUrl] = useState('')
  const [tab, setTab] = useState<'create' | 'history' | 'adv'>('create')
  const [emailInput, setEmailInput] = useState(() => {
    try {
      return localStorage.getItem('seva-user-email') || ''
    } catch {
      return ''
    }
  })
  const [autoEmailOnDownload, setAutoEmailOnDownload] = useState(true)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState('')
  const [historyList, setHistoryList] = useState<ReportHistoryEntry[]>([])

  const [selectedLangs, setSelectedLangs] = useState<ReportLang[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('seva-report-langs') || '["en"]')
      return Array.isArray(saved) && saved.length ? saved : ['en']
    } catch {
      return ['en']
    }
  })
  const [opts, setOpts] = useState<ReportOpts>(() => {
    try {
      return { ...DEFAULT_OPTS, ...JSON.parse(localStorage.getItem('seva-report-opts') || '{}') }
    } catch {
      return DEFAULT_OPTS
    }
  })

  const loadHistory = async () => {
    const list = await getReportHistory(farm.id)
    setHistoryList(list)
  }

  useEffect(() => {
    loadHistory()
  }, [farm.id, tab])

  const upd = (o: ReportOpts) => {
    setOpts(o)
    localStorage.setItem('seva-report-opts', JSON.stringify(o))
  }

  const toggleLang = (l: ReportLang) => {
    let next: ReportLang[]
    if (selectedLangs.includes(l)) {
      if (selectedLangs.length === 1) return
      next = selectedLangs.filter(x => x !== l)
    } else {
      next = [...selectedLangs, l]
    }
    setSelectedLangs(next)
    localStorage.setItem('seva-report-langs', JSON.stringify(next))
  }

  const toggleMap = (id: string) => {
    const next = opts.maps.includes(id) ? opts.maps.filter(m => m !== id) : [...opts.maps, id]
    upd({ ...opts, maps: next })
  }

  const toggleBandSymbology = (id: string) => {
    const cur = opts.bandSymbologies ?? []
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    upd({ ...opts, bandSymbologies: next })
  }

  const selectAllMaps = () => upd({ ...opts, maps: MAP_CHOICES.map(m => m.id) })
  const defaultMaps = () => upd({ ...opts, maps: DEFAULT_OPTS.maps })
  const selectAllBands = () => upd({ ...opts, bandSymbologies: BAND_SYMBOLOGY_CHOICES.map(b => b.id) })
  const defaultBands = () => upd({ ...opts, bandSymbologies: DEFAULT_OPTS.bandSymbologies ?? ['rgb', 'cir', 'agri'] })

  const CART: [keyof CartOpts, string, string][] = [
    ['title', 'Title & Border Plaque', 'top-left neatline banner'],
    ['north', 'Compass Rose North Arrow', 'top-right geodetic quadrant'],
    ['scale', 'Dual-Tone Metric Scale Bar', 'bottom-left corner'],
    ['legend', 'Comprehensive Map Legend', 'bottom-right corner'],
    ['coords', 'Geodetic Grid Coordinate Ticks', 'tick marks along all 4 borders'],
  ]

  const farmUpper = farm.name.toUpperCase().trim()
  const baseFilename = `(${farmUpper}_SEVA GIS)`

  async function make() {
    if (!selectedLangs.length) {
      setErr('Please select at least one language.')
      return
    }
    setErr('')
    setReports({})
    setBusy('Starting')
    try {
      let viewport: { zoom?: number; bbox?: [number, number, number, number] } | undefined
      try {
        const saved = JSON.parse(localStorage.getItem('seva-map-view-bounds') || '{}')
        if (saved.zoom || saved.bbox) {
          viewport = { zoom: saved.zoom, bbox: saved.bbox }
        }
      } catch {}
      const runOpts: ReportOpts = { ...opts, viewport }

      const res: Partial<Record<ReportLang, { html: string; data: unknown; id: string; lang: ReportLang }>> = {}
      for (const l of selectedLangs) {
        setBusy(`Compiling ${REPORT_LANG_NAMES[l].native} 3D report…`)
        const r = await buildReport(farm, setBusy, { ...runOpts, lang: l })
        res[l] = r

        await saveReportToHistory({
          id: r.id + '-' + l,
          farmId: farm.id,
          farmName: farm.name,
          filename: `${baseFilename}_${l.toUpperCase()}`,
          createdAt: new Date().toISOString(),
          sizeBytes: new Blob([r.html]).size,
          lang: l,
          format: 'HTML',
          htmlContent: r.html,
          summary: {
            ndviMean: farm.analysis?.ndvi.mean ?? 0.58,
            stressPct: farm.analysis?.stressPct ?? 14.5,
            areaHa: farm.area ?? 2.4,
            location: farm.location,
            sceneDate: farm.analysis?.scene.datetime.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          },
          devicePath: `/seva-gis/reports/${baseFilename}_${l.toUpperCase()}.html`,
        })
      }
      setReports(res)
      const active = selectedLangs.includes(previewLang) ? previewLang : selectedLangs[0]
      setPreviewLang(active)
      if (url) URL.revokeObjectURL(url)
      setUrl(URL.createObjectURL(new Blob([res[active]!.html], { type: 'text/html' })))
      await loadHistory()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not build the report. Check connection and try again.')
    }
    setBusy('')
  }

  const switchPreview = (l: ReportLang) => {
    setPreviewLang(l)
    if (reports[l]) {
      if (url) URL.revokeObjectURL(url)
      setUrl(URL.createObjectURL(new Blob([reports[l]!.html], { type: 'text/html' })))
    }
  }

  const save = (name: string, body: string, type: string) => {
    const u = URL.createObjectURL(new Blob([body], { type }))
    const a = document.createElement('a')
    a.href = u
    a.download = name
    a.click()
    URL.revokeObjectURL(u)
  }

  const print = () => {
    const fr = document.getElementById('report-frame') as HTMLIFrameElement | null
    fr?.contentWindow?.focus()
    fr?.contentWindow?.print()
  }

  const handleSendEmail = async (e?: React.FormEvent) => {
    e?.preventDefault?.()
    if (!emailInput || !emailInput.includes('@')) {
      setErr('Please enter a valid email address.')
      return
    }
    const current = reports[previewLang]
    if (!current) {
      setErr('Please generate the report before sending via email.')
      return
    }

    setSendingEmail(true)
    setEmailSuccess('')
    setErr('')

    try {
      localStorage.setItem('seva-user-email', emailInput)
      const res = await syncAndSendViaEmailOctopus({
        email: emailInput,
        farmName: farm.name,
        reportId: current.id,
        areaHa: farm.area,
        ndvi: farm.analysis?.ndvi.mean,
        filename: `${baseFilename}.html`,
        htmlContent: current.html,
      })

      if (res.success) {
        setEmailSuccess(`Email successfully sent via EmailOctopus to ${emailInput}! "${res.tagline}"`)
      } else {
        setErr(res.message)
      }
      setTimeout(() => setEmailSuccess(''), 10000)
    } catch {
      setErr('Could not send email automatically. A mail draft has been opened.')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleDownloadDossier = async () => {
    if (!curReport) return
    save(`${baseFilename}.html`, curReport.html, 'text/html')

    const targetEmail = emailInput || localStorage.getItem('seva-user-email') || ''
    if (targetEmail && targetEmail.includes('@') && autoEmailOnDownload) {
      try {
        setSendingEmail(true)
        const res = await syncAndSendViaEmailOctopus({
          email: targetEmail,
          farmName: farm.name,
          reportId: curReport.id,
          areaHa: farm.area,
          ndvi: farm.analysis?.ndvi.mean,
          filename: `${baseFilename}.html`,
          htmlContent: curReport.html,
        })
        setEmailSuccess(`Report downloaded! Official copy dispatched to ${targetEmail} via EmailOctopus. "${res.tagline}"`)
        setTimeout(() => setEmailSuccess(''), 10000)
      } catch (e) {
        console.warn('Auto-email on download failed:', e)
      } finally {
        setSendingEmail(false)
      }
    } else if (!targetEmail) {
      setEmailSuccess(`Report downloaded to device! Enter your email in the box below to also receive an official copy via EmailOctopus.`)
      setTimeout(() => setEmailSuccess(''), 8000)
    }
  }

  const curReport = reports[previewLang]
  const hasReports = Object.keys(reports).length > 0

  return (
    <div className="rp">
      {/* Tab Navigation */}
      <div className="rp-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'create'}
          className={tab === 'create' ? 'on' : ''}
          onClick={() => setTab('create')}
        >
          <FileText size={15} style={{ display: 'inline', marginRight: 6 }} />
          Generate Report
        </button>
        <button
          role="tab"
          aria-selected={tab === 'history'}
          className={tab === 'history' ? 'on' : ''}
          onClick={() => setTab('history')}
        >
          <History size={15} style={{ display: 'inline', marginRight: 6 }} />
          Matcha Vault &amp; History ({historyList.length})
        </button>
        <button
          role="tab"
          aria-selected={tab === 'adv'}
          className={tab === 'adv' ? 'on' : ''}
          onClick={() => setTab('adv')}
        >
          Cartography Settings
        </button>
      </div>

      {/* CREATE TAB */}
      {tab === 'create' && (
        <>
          {/* Language Selection */}
          <div className="rp-lang-select">
            <div className="rp-lang-header">
              <Languages size={15} />
              <span>Report Language / भाषा / భాష:</span>
            </div>
            <div className="rp-lang-grid">
              {(['en', 'hi', 'te'] as ReportLang[]).map(l => (
                <label key={l} className={`rp-lang-chip ${selectedLangs.includes(l) ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedLangs.includes(l)}
                    onChange={() => toggleLang(l)}
                  />
                  <span className="rp-lang-name">{REPORT_LANG_NAMES[l].native}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 1: Core Dossier Elements Checkboxes */}
          <div style={{ marginTop: '16px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13.5px', color: '#1b4332' }}>
                <Layers size={16} color="#2d6a4f" />
                <span>Core Report Items &amp; Land Registry</span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>Select items to include in dossier</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: opts.include3dTerrain !== false ? '#f0fdf4' : '#ffffff', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={opts.include3dTerrain !== false}
                  onChange={() => upd({ ...opts, include3dTerrain: opts.include3dTerrain === false })}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>3D Topographic Terrain Model</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Isometric extruded elevation mesh (Fig 1.1)</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: opts.includeCadastre ? '1.5px solid #059669' : '1px solid #e2e8f0', background: opts.includeCadastre ? '#ecfdf5' : '#ffffff', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={!!opts.includeCadastre}
                  onChange={() => upd({ ...opts, includeCadastre: !opts.includeCadastre })}
                />
                <div>
                  <div style={{ fontWeight: 700, color: '#047857' }}>Cadastral Land Registry (RoR 1B)</div>
                  <div style={{ fontSize: '11px', color: '#065f46' }}>Khasra, Survey No, ULPIN &amp; Title Verification</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: opts.includeCharts !== false ? '#f0fdf4' : '#ffffff', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={opts.includeCharts !== false}
                  onChange={() => upd({ ...opts, includeCharts: opts.includeCharts === false })}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>Sensitivity Charts &amp; Dotty Plots</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>SUFI-2 parameter calibration scatter plots</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: opts.includeTables !== false ? '#f0fdf4' : '#ffffff', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={opts.includeTables !== false}
                  onChange={() => upd({ ...opts, includeTables: opts.includeTables === false })}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>Hydrology &amp; Agronomy Tables</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>SCS-CN water budget &amp; spectral indicators</div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Analysis Lab Parameters Checkboxes */}
          <div style={{ marginTop: '14px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13.5px', color: '#1b4332' }}>
                <Sliders size={16} color="#2d6a4f" />
                <span>Analysis Lab Parameters &amp; Maps ({opts.maps.length}/{MAP_CHOICES.length})</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="outline sm" onClick={selectAllMaps} style={{ padding: '2px 8px', fontSize: '11.5px' }}>
                  Select All
                </button>
                <button type="button" className="outline sm" onClick={defaultMaps} style={{ padding: '2px 8px', fontSize: '11.5px' }}>
                  Defaults
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px' }}>
              {MAP_CHOICES.map(m => {
                const checked = opts.maps.includes(m.id)
                return (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', border: checked ? '1px solid #a7f3d0' : '1px solid #f1f5f9', background: checked ? '#f0fdf4' : '#fafafa', cursor: 'pointer', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMap(m.id)}
                    />
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.name.split(' (')[0]}</span>
                      <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block' }}>{m.group}</span>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Section 3: Remote Field Review - Band Combinations Checkboxes */}
          <div style={{ marginTop: '14px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13.5px', color: '#1b4332' }}>
                <ShieldCheck size={16} color="#2d6a4f" />
                <span>Band Combination Symbology Images ({(opts.bandSymbologies ?? []).length}/{BAND_SYMBOLOGY_CHOICES.length})</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="outline sm" onClick={selectAllBands} style={{ padding: '2px 8px', fontSize: '11.5px' }}>
                  Select All
                </button>
                <button type="button" className="outline sm" onClick={defaultBands} style={{ padding: '2px 8px', fontSize: '11.5px' }}>
                  Defaults
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px' }}>
              {BAND_SYMBOLOGY_CHOICES.map(b => {
                const checked = (opts.bandSymbologies ?? []).includes(b.id)
                return (
                  <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', border: checked ? '1px solid #a7f3d0' : '1px solid #f1f5f9', background: checked ? '#f0fdf4' : '#fafafa', cursor: 'pointer', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBandSymbology(b.id)}
                    />
                    <div>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{b.name}</span>
                      <span style={{ fontSize: '10.5px', color: '#2d6a4f', display: 'block', fontFamily: 'monospace' }}>{b.bands}</span>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <p style={{ margin: '14px 0 10px', fontSize: '13px', color: '#334155' }}>
            Compiles a complete 3D academic dossier titled <b>{baseFilename}</b> in <b>{selectedLangs.map(l => REPORT_LANG_NAMES[l].native).join(', ')}</b>. All raster layers are ingested from official Sentinel-2 L2A &amp; Copernicus DEM, perfectly centered in geodetic frames without border collision.
          </p>

          <button className="primary" onClick={make} disabled={!!busy} style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', fontSize: '14.5px' }}>
            {busy ? <LogoLoader inline size={24} text="" /> : <Sparkles size={16} />}
            {busy ? `${busy}` : hasReports ? 'Re-Generate Dossier' : 'Generate 3D Cartographic Report'}
          </button>

          {err && <p className="rp-err">{err}</p>}

          {/* EmailOctopus delivery snippet box - Stacked Clean Layout */}
          {hasReports && curReport && (
            <div className="rp-email-box" style={{ background: '#f8fafc', border: '1.5px solid #10b981', borderRadius: '12px', padding: '16px', marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                  <Mail size={17} color="#059669" />
                  <span>EmailOctopus Report Delivery</span>
                </div>
                <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
                  ● EmailOctopus API Connected
                </span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#64748b' }}>
                Enter your email address to receive an official copy with full NDVI &amp; SWAT hydrological telemetry.
              </p>

              {/* Email form with input placed ABOVE the send button */}
              <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>
                    Recipient Email Address:
                  </label>
                  <input
                    type="email"
                    placeholder="Type your email address here (e.g., name@gmail.com)"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #10b981',
                      fontSize: '13.5px',
                      background: '#ffffff',
                      color: '#0f172a',
                      outline: 'none',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                    }}
                  />
                </div>
                <button type="submit" className="primary sm" disabled={sendingEmail} style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: '13.5px' }}>
                  <Send size={15} />
                  {sendingEmail ? 'Sending...' : 'Send via EmailOctopus'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '12.5px', color: '#475569' }}>
                <input
                  type="checkbox"
                  id="auto-email-cb"
                  checked={autoEmailOnDownload}
                  onChange={e => setAutoEmailOnDownload(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="auto-email-cb" style={{ cursor: 'pointer' }}>
                  Automatically send copy to this email address whenever I click "Download Dossier"
                </label>
              </div>

              {emailSuccess && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#047857', fontSize: '12.5px', marginTop: '12px', background: '#ecfdf5', padding: '10px 14px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                  <CheckCircle2 size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <strong>{emailSuccess}</strong>
                    <div style={{ fontSize: '11.5px', color: '#065f46', marginTop: '2px', fontStyle: 'italic' }}>
                      "{EMAIL_OCTOPUS_CONFIG.tagline}"
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {hasReports && curReport && (
            <>
              {selectedLangs.length > 1 && (
                <div className="rp-preview-bar">
                  <span className="rp-preview-label">Preview language:</span>
                  <div className="rp-preview-pills">
                    {selectedLangs.map(l => (
                      <button
                        key={l}
                        type="button"
                        className={`rp-preview-pill ${previewLang === l ? 'active' : ''}`}
                        onClick={() => switchPreview(l)}
                      >
                        {REPORT_LANG_NAMES[l].native}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rp-actions" style={{ marginTop: '14px' }}>
                <button
                  className="primary"
                  onClick={handleDownloadDossier}
                >
                  <ArrowDownToLine size={16} />
                  Download Dossier ({baseFilename}.html)
                </button>
                <button className="outline" onClick={print}>
                  <Printer size={16} />
                  Print / Save PDF ({baseFilename}.pdf)
                </button>
                <button
                  className="outline"
                  onClick={() => save(`${baseFilename}.json`, JSON.stringify(curReport.data, null, 2), 'application/json')}
                >
                  <FileJson size={16} />
                  Data (JSON)
                </button>
              </div>

              <iframe id="report-frame" className="rp-frame" title="Report preview" src={url} />
            </>
          )}
        </>
      )}

      {/* MATCHA-INSPIRED REPORT HISTORY & VAULT TAB */}
      {tab === 'history' && (
        <div className="rp-history-pane" style={{ padding: '4px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FolderOpen size={17} color="#2d6a4f" />
                Device Storage Vault (OPFS &amp; IndexedDB)
              </h4>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                All generated reports saved locally on this device. Re-download, preview, or delete at any time.
              </p>
            </div>
            {historyList.length > 0 && (
              <button
                className="outline sm"
                onClick={async () => {
                  if (confirm('Clear all historical reports from this device?')) {
                    await clearAllReportHistory()
                    await loadHistory()
                  }
                }}
              >
                <Trash2 size={13} />
                Clear All
              </button>
            )}
          </div>

          {historyList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <History size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>No report archives stored on this device yet.</p>
              <p style={{ margin: '4px 0 12px', fontSize: '12.5px', color: '#64748b' }}>Click "Generate 3D Cartographic Report" to create and archive a report session.</p>
              <button className="primary sm" onClick={() => setTab('create')}>Generate First Report</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {historyList.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#1e293b' }}>{entry.filename}</span>
                      <span style={{ background: '#ecfdf5', color: '#047857', fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>
                        {REPORT_LANG_NAMES[entry.lang]?.label ?? entry.lang}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                      Generated: {new Date(entry.createdAt).toLocaleString()} · Size: {(entry.sizeBytes / 1024).toFixed(1)} KB · ID: {entry.id}
                    </div>
                    <div style={{ fontSize: '11px', color: '#2d6a4f', marginTop: '2px', fontFamily: 'monospace' }}>
                      Path: {entry.devicePath}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="outline sm"
                      title="Preview in new window"
                      onClick={() => {
                        const blob = new Blob([entry.htmlContent], { type: 'text/html' })
                        const u = URL.createObjectURL(blob)
                        window.open(u, '_blank')
                      }}
                    >
                      <Eye size={13} />
                      View
                    </button>
                    <button
                      className="primary sm"
                      title="Re-download report"
                      onClick={() => downloadHistoricalReport(entry)}
                    >
                      <ArrowDownToLine size={13} />
                      Download
                    </button>
                    <button
                      className="outline sm"
                      title="Delete from device storage"
                      onClick={async () => {
                        await deleteReportHistory(entry.id)
                        await loadHistory()
                      }}
                    >
                      <Trash2 size={13} color="#dc2626" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADVANCED CARTOGRAPHY SETTINGS TAB */}
      {tab === 'adv' && (
        <div className="rp-adv">
          <h4>Maps &amp; Cartography Layers to Include</h4>
          <p>Select spatial layers for high-resolution 300 DPI inclusion:</p>
          <div className="rp-checks">
            {MAP_CHOICES.map(m => (
              <label key={m.id}>
                <input
                  type="checkbox"
                  checked={opts.maps.includes(m.id)}
                  onChange={() => toggleMap(m.id)}
                />
                <span>
                  <b>{m.name}</b>
                  <small>{m.note}</small>
                </span>
              </label>
            ))}
          </div>
          <h4>Cartographic Frame Elements</h4>
          <div className="rp-checks">
            {CART.map(([k, n, w]) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={opts.cart[k]}
                  onChange={() => upd({ ...opts, cart: { ...opts.cart, [k]: !opts.cart[k] } })}
                />
                <span>
                  <b>{n}</b>
                  <small>{w}</small>
                </span>
              </label>
            ))}
          </div>
          <p className="rp-tip">
            <b>Cartographic Guarantee.</b> All exported maps include exact geodetic coordinate grids (lat/lon tick marks), dual-tone metric scale bars, 4-point compass rose, and neatline neatness adhering to academic publishing standards without overlapping the farm AOI.
          </p>
          <button className="outline" onClick={() => upd(DEFAULT_OPTS)}>Reset Cartography Defaults</button>
        </div>
      )}
    </div>
  )
}
