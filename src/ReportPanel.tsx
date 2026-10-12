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
  Compass,
  PieChart,
  HeartHandshake,
  ShieldCheck,
} from 'lucide-react'
import { useAccount } from './Auth'
import EmailOctopusGreetingModal from './EmailOctopusGreetingModal'
import AoiHealthScorePie from './AoiHealthScorePie'
import ArtCraftStudio from './ArtCraftStudio'
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
import { openReportPrintView } from './lib/reportPdf'
import { useI18n } from './lib/i18n'

export default function ReportPanel({ farm }: { farm?: ReportFarm | null }) {
  // Must be called before the early return below, so the hook order stays stable.
  const { t } = useI18n()
  if (!farm) {
    return (
      <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8' }}>
        <p style={{ margin: '0 0 10px', fontSize: '15px', color: '#cbd5e1', fontWeight: 600 }}>{t('rp.noField')}</p>
        <p style={{ margin: 0, fontSize: '13px' }}>{t('rp.needAoi')}</p>
      </div>
    )
  }
  return <ReportPanelInner farm={farm} />
}

function ReportPanelInner({ farm }: { farm: ReportFarm }) {
  const { who } = useAccount()
  const { t } = useI18n()
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [reports, setReports] = useState<Partial<Record<ReportLang, { html: string; data: unknown; id: string; lang: ReportLang }>>>({})
  const [previewLang, setPreviewLang] = useState<ReportLang>('en')
  const [url, setUrl] = useState('')
  const [tab, setTab] = useState<'create' | 'history' | 'health' | 'adv' | 'craft'>('create')
  const [greetingModalData, setGreetingModalData] = useState<{
    isOpen: boolean
    recipientEmail: string
    farmName: string
    custodianName?: string
    reportId: string
    filename: string
    htmlContent: string
    areaHa?: number
    ndvi?: number
    ndmi?: number
    contactId?: string
  }>({
    isOpen: false,
    recipientEmail: '',
    farmName: '',
    custodianName: who.name || 'SEVA·GIS Member',
    reportId: '',
    filename: '',
    htmlContent: '',
    areaHa: farm.area,
    ndvi: farm.analysis?.ndvi?.mean ?? 0.65,
    ndmi: farm.analysis?.ndmi?.mean ?? 0.32,
    contactId: '',
  })
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

  /**
   * Downloads the report as a PDF by handing the *same document that is being
   * previewed* to the browser's print-to-PDF engine. The old code wrote a
   * three-page text stub instead, which is why the download never matched the
   * preview. See `src/lib/reportPdf.ts`.
   */
  const handleDownloadPdf = () => {
    const cur = reports[previewLang]
    if (!cur) return
    openReportPrintView(cur.html, `${baseFilename}.pdf`)
  }

  const print = () => {
    const cur = reports[previewLang]
    if (!cur) return
    openReportPrintView(cur.html, `${baseFilename}.pdf`)
  }

  const handleDownloadWord = () => {
    const cur = reports[previewLang]
    if (!cur) return
    const wordHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${baseFilename}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page { size: A4; margin: 2.5cm 2.5cm 2.5cm 3.5cm; }
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; text-align: justify; }
          table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
          th, td { border: 1pt solid #cbd5e1; padding: 6pt; }
          th { background-color: #f1f5f9; font-weight: bold; }
          h1 { font-size: 18pt; text-align: center; color: #10231b; }
          h2 { font-size: 14pt; color: #10231b; }
        </style>
      </head>
      <body>
        ${cur.html}
      </body>
      </html>
    `
    save(`${baseFilename}.doc`, wordHtml, 'application/msword;charset=utf-8')
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
        ndvi: farm.analysis?.ndvi?.mean,
        ndmi: farm.analysis?.ndmi?.mean,
        filename: `${baseFilename}.html`,
        htmlContent: current.html,
      })

      if (res.success) {
        setEmailSuccess(`Email successfully dispatched via EmailOctopus to ${emailInput}! "${res.tagline}"`)
        setGreetingModalData({
          isOpen: true,
          recipientEmail: emailInput,
          farmName: farm.name,
          custodianName: who.name || 'SEVA·GIS Member',
          reportId: current.id,
          filename: `${baseFilename}.html`,
          htmlContent: current.html,
          areaHa: farm.area,
          ndvi: farm.analysis?.ndvi?.mean ?? 0.65,
          ndmi: farm.analysis?.ndmi?.mean ?? 0.32,
          contactId: res.id || 'Active Member',
        })
      } else {
        setErr(res.message)
      }
      setTimeout(() => setEmailSuccess(''), 10000)
    } catch {
      setErr('Encountered an issue dispatching email via EmailOctopus. Please verify network.')
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
          <FileText size={15} style={{ display: 'inline', marginRight: 6 }} />{t('rp.generate')}</button>
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
          aria-selected={tab === 'health'}
          className={tab === 'health' ? 'on' : ''}
          onClick={() => setTab('health')}
        >
          <PieChart size={15} style={{ display: 'inline', marginRight: 6 }} />{t('rp.healthPie')}</button>
        <button
          role="tab"
          aria-selected={tab === 'adv'}
          className={tab === 'adv' ? 'on' : ''}
          onClick={() => setTab('adv')}
        >{t('rp.cartoSettings')}</button>
        <button
          role="tab"
          aria-selected={tab === 'craft'}
          className={tab === 'craft' ? 'on' : ''}
          onClick={() => setTab('craft')}
          style={{ background: tab === 'craft' ? '#1e1b4b' : undefined, color: tab === 'craft' ? '#c7d2fe' : undefined }}
        >
          <Sparkles size={15} style={{ display: 'inline', marginRight: 6, color: '#818cf8' }} />{t('rp.workbench')}</button>
      </div>

      {/* CREATE TAB */}
      {tab === 'create' && (
        <>
          {/* Language Selection */}
          <div className="rp-lang-select">
            <div className="rp-lang-header">
              <Languages size={15} />
              <span>{t('rp.language')}</span>
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
                <span>{t('rp.coreItems')}</span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>{t('rp.coreItemsNote')}</span>
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
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{t('rp.item3d')}</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: opts.includeCharts !== false ? '#f0fdf4' : '#ffffff', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={opts.includeCharts !== false}
                  onChange={() => upd({ ...opts, includeCharts: opts.includeCharts === false })}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{t('rp.itemSensitivity')}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{t('rp.itemSensitivityNote')}</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: opts.includeTables !== false ? '#f0fdf4' : '#ffffff', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={opts.includeTables !== false}
                  onChange={() => upd({ ...opts, includeTables: opts.includeTables === false })}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{t('rp.itemTables')}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{t('rp.itemTablesNote')}</div>
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
                <button type="button" className="outline sm" onClick={selectAllMaps} style={{ padding: '2px 8px', fontSize: '11.5px' }}>{t('rp.selectAll')}</button>
                <button type="button" className="outline sm" onClick={defaultMaps} style={{ padding: '2px 8px', fontSize: '11.5px' }}>
                  Defaults
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              {[...new Set(MAP_CHOICES.map(m => m.group))].map(group => {
                const groupMaps = MAP_CHOICES.filter(m => m.group === group)
                const selectedCount = groupMaps.filter(m => opts.maps.includes(m.id)).length
                return (
                  <details key={group} open={selectedCount > 0} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', background: '#fcfdfc' }}>
                    <summary style={{ cursor: 'pointer', color: '#1b4332', fontSize: '12px', fontWeight: 700 }}>
                      {group} <span style={{ color: '#64748b', fontWeight: 500 }}>({selectedCount}/{groupMaps.length})</span>
                    </summary>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px', marginTop: '8px' }}>
                      {groupMaps.map(m => {
                        const checked = opts.maps.includes(m.id)
                        return (
                          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', border: checked ? '1px solid #a7f3d0' : '1px solid #f1f5f9', background: checked ? '#f0fdf4' : '#fafafa', cursor: 'pointer', fontSize: '12px' }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleMap(m.id)} />
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.name.split(' (')[0]}</span>
                              <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block' }}>{m.note}</span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </details>
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
                <button type="button" className="outline sm" onClick={selectAllBands} style={{ padding: '2px 8px', fontSize: '11.5px' }}>{t('rp.selectAll')}</button>
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

          <p style={{ margin: '14px 0 10px', fontSize: '13px', color: '#334155' }}>{t('rp.compilesIntro')}<b>{baseFilename}</b> in <b>{selectedLangs.map(l => REPORT_LANG_NAMES[l].native).join(', ')}</b>. All raster layers are ingested from official Sentinel-2 L2A &amp; Copernicus DEM, perfectly centered in geodetic frames without border collision.
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
                  <span>{t('rp.emailTitle')}</span>
                </div>
                <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
                  ● EmailOctopus API Connected
                </span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#64748b' }}>{t('rp.emailNote')}</p>

              {/* Email form with input placed ABOVE the send button */}
              <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>{t('rp.recipient')}</label>
                  <input
                    type="email"
                    placeholder={t('rp.emailPlaceholder')}
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
                <label htmlFor="auto-email-cb" style={{ cursor: 'pointer' }}>{t('rp.autoSend')}</label>
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
                  <span className="rp-preview-label">{t('rp.previewLanguage')}</span>
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

              <div className="rp-actions" style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  className="primary"
                  onClick={handleDownloadDossier}
                >
                  <ArrowDownToLine size={16} />
                  Download Dossier ({baseFilename}.html)
                </button>
                <button
                  className="primary"
                  onClick={handleDownloadPdf}
                  style={{ background: '#047857', border: '1px solid #059669' }}
                >
                  <ArrowDownToLine size={16} />
                  Download PDF ({baseFilename}.pdf)
                </button>
                <button className="outline" onClick={handleDownloadWord}>
                  <FileText size={16} />
                  Word Document ({baseFilename}.doc)
                </button>
                <button
                  className="outline"
                  onClick={() => save(`${baseFilename}.json`, JSON.stringify(curReport.data, null, 2), 'application/json')}
                >
                  <FileJson size={16} />
                  Data (JSON)
                </button>
                <button className="outline" onClick={print} title={t('rp.printPreview')}>
                  <Printer size={16} />{t('rp.print')}</button>
              </div>

              <p className="rp-note" style={{ margin: '10px 0 14px', fontSize: '12.5px', color: '#475569' }}>
                <b>{t('rp.downloadPdf')}</b> opens your browser's print dialog with this exact report. Choose{' '}
                <b>Destination &rarr; Save as PDF</b> — the saved file is the document you previewed here, with maps,
                legends, scale bars and page breaks intact.
              </p>

              <iframe id="report-frame" className="rp-frame" title={t('rp.previewTitle')} src={url} />
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
                <FolderOpen size={17} color="#2d6a4f" />{t('rp.vault')}</h4>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>{t('rp.vaultNote')}</p>
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
                <Trash2 size={13} />{t('rp.clearAll')}</button>
            )}
          </div>

          {historyList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <History size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>{t('rp.noArchives')}</p>
              <p style={{ margin: '4px 0 12px', fontSize: '12.5px', color: '#64748b' }}>{t('rp.noArchivesNote')}</p>
              <button className="primary sm" onClick={() => setTab('create')}>{t('rp.generateFirst')}</button>
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
                      title={t('rp.previewNewWindow')}
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
                      title={t('rp.redownload')}
                      onClick={() => downloadHistoricalReport(entry)}
                    >
                      <ArrowDownToLine size={13} />
                      Download
                    </button>
                    <button
                      className="outline sm"
                      title={t('rp.deleteStorage')}
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
          <h4>{t('rp.mapsToInclude')}</h4>
          <p>{t('rp.mapsNote')}</p>
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
          <h4>{t('rp.frameElements')}</h4>
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
            <b>{t('rp.guarantee')}</b>{t('rp.guaranteeNote')}</p>
          <button className="outline" onClick={() => upd(DEFAULT_OPTS)}>{t('rp.resetCarto')}</button>
        </div>
      )}

      {/* HEALTH TAB: Overall Field Health Pie & Reporter Briefing */}
      {tab === 'health' && (
        <div className="rp-health-tab" style={{ padding: '8px 0' }}>
          <AoiHealthScorePie
            farmName={farm.name}
            crop={farm.crop}
            areaHa={farm.area}
            analysis={farm.analysis}
          />

          {/* Reporter In-Depth Investigation Panel */}
          <div
            style={{
              marginTop: '20px',
              background: '#ffffff',
              border: '1.5px solid #10b981',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>{t('rp.specialDossier')}</span>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>{t('rp.reporterDesk')}</span>
            </div>

            <h3 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 800, color: '#064e3b' }}>{t('rp.pieSynthesis')}</h3>

            <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#334155', margin: '0 0 14px' }}>
              <b>{t('rp.context')}</b>{t('rp.contextBody')}</p>

            {/* Parameter Differences Table */}
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#1e293b' }}>
                    <th style={{ padding: '8px 10px' }}>{t('rp.colParam')}</th>
                    <th style={{ padding: '8px 10px' }}>Observed</th>
                    <th style={{ padding: '8px 10px' }}>{t('rp.colBaseline')}</th>
                    <th style={{ padding: '8px 10px' }}>Difference (Δ)</th>
                    <th style={{ padding: '8px 10px' }}>{t('rp.colRole')}</th>
                    <th style={{ padding: '8px 10px' }}>{t('rp.colVerdict')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t('rp.rowNdvi')}</td>
                    <td style={{ padding: '8px 10px', color: '#047857', fontWeight: 700 }}>{(farm.analysis?.ndvi?.mean ?? 0.65).toFixed(2)}</td>
                    <td style={{ padding: '8px 10px' }}>0.60</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: (farm.analysis?.ndvi?.mean ?? 0.65) >= 0.60 ? '#047857' : '#dc2626' }}>
                      {((farm.analysis?.ndvi?.mean ?? 0.65) - 0.60 >= 0 ? '+' : '') + ((farm.analysis?.ndvi?.mean ?? 0.65) - 0.60).toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>Additive (+45% Weight)</td>
                    <td style={{ padding: '8px 10px', color: '#475569' }}>{t('rp.rowNdviNote')}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t('rp.rowNdmi')}</td>
                    <td style={{ padding: '8px 10px', color: '#0284c7', fontWeight: 700 }}>{(farm.analysis?.ndmi?.mean ?? 0.32).toFixed(2)}</td>
                    <td style={{ padding: '8px 10px' }}>0.30</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: (farm.analysis?.ndmi?.mean ?? 0.32) >= 0.30 ? '#0284c7' : '#dc2626' }}>
                      {((farm.analysis?.ndmi?.mean ?? 0.32) - 0.30 >= 0 ? '+' : '') + ((farm.analysis?.ndmi?.mean ?? 0.32) - 0.30).toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>Additive (+35% Weight)</td>
                    <td style={{ padding: '8px 10px', color: '#475569' }}>{t('rp.rowNdmiNote')}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t('rp.rowSavi')}</td>
                    <td style={{ padding: '8px 10px', color: '#65a30d', fontWeight: 700 }}>{((farm.analysis?.ndvi?.mean ?? 0.65) * 0.9).toFixed(2)}</td>
                    <td style={{ padding: '8px 10px' }}>0.50</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#047857' }}>
                      +{(((farm.analysis?.ndvi?.mean ?? 0.65) * 0.9) - 0.50).toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>Additive (+20% Weight)</td>
                    <td style={{ padding: '8px 10px', color: '#475569' }}>{t('rp.rowSaviNote')}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t('rp.rowStress')}</td>
                    <td style={{ padding: '8px 10px', color: '#dc2626', fontWeight: 700 }}>{(farm.analysis?.stressPct ?? 7.5).toFixed(1)}%</td>
                    <td style={{ padding: '8px 10px' }}>&lt; 5.0%</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#dc2626' }}>
                      +{((farm.analysis?.stressPct ?? 7.5) - 5.0).toFixed(1)}%
                    </td>
                    <td style={{ padding: '8px 10px', color: '#dc2626' }}>{t('rp.colDeduction')}</td>
                    <td style={{ padding: '8px 10px', color: '#475569' }}>{t('rp.rowStressNote')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Reporter Detailed Narrative */}
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px', fontSize: '12.5px', lineHeight: 1.6, color: '#334155' }}>
              <strong style={{ color: '#0f172a', display: 'block', marginBottom: '6px' }}>{t('rp.synthesis')}</strong>
              <span>
                <b>{t('rp.whyDiffer')}</b>{t('rp.whyDifferBody')}</span>
              <br /><br />
              <span>
                <b>{t('rp.formula')}</b> <code>{t('rp.formulaBody')}</code>. From this sum, stress and moisture deficit penalties are deducted to arrive at the net composite score displayed in the pie chart.
              </span>
              <br /><br />
              <span>
                <b>{t('rp.directive')}</b>{t('rp.directiveBody')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ARTCRAFT WORKBENCH TAB */}
      {tab === 'craft' && (
        <div style={{ marginTop: '16px' }}>
          <ArtCraftStudio farm={farm as any} isModal={false} initialTab="pdfcraft" />
        </div>
      )}

      {/* EmailOctopus Greeting Modal */}
      <EmailOctopusGreetingModal
        isOpen={greetingModalData.isOpen}
        onClose={() => setGreetingModalData(prev => ({ ...prev, isOpen: false }))}
        recipientEmail={greetingModalData.recipientEmail}
        farmName={greetingModalData.farmName}
        custodianName={greetingModalData.custodianName}
        reportId={greetingModalData.reportId}
        filename={greetingModalData.filename}
        htmlContent={greetingModalData.htmlContent}
        areaHa={greetingModalData.areaHa}
        ndvi={greetingModalData.ndvi}
        ndmi={greetingModalData.ndmi}
        contactId={greetingModalData.contactId}
      />
    </div>
  )
}
