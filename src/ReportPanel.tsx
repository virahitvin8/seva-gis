import LogoLoader from './LogoLoader'
import { useState } from 'react'
import { ArrowDownToLine, FileJson, Printer, FileText, Languages } from 'lucide-react'
import {
  DEFAULT_OPTS,
  MAP_CHOICES,
  REPORT_LANG_NAMES,
  buildReport,
  type CartOpts,
  type ReportFarm,
  type ReportLang,
  type ReportOpts,
} from './report'

export default function ReportPanel({ farm }: { farm: ReportFarm }) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [reports, setReports] = useState<Partial<Record<ReportLang, { html: string; data: unknown; id: string; lang: ReportLang }>>>({})
  const [previewLang, setPreviewLang] = useState<ReportLang>('en')
  const [url, setUrl] = useState('')
  const [tab, setTab] = useState<'quick' | 'adv'>('quick')
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

  const upd = (o: ReportOpts) => {
    setOpts(o)
    localStorage.setItem('seva-report-opts', JSON.stringify(o))
  }

  const toggleLang = (l: ReportLang) => {
    let next: ReportLang[]
    if (selectedLangs.includes(l)) {
      if (selectedLangs.length === 1) return // Keep at least one
      next = selectedLangs.filter(x => x !== l)
    } else {
      next = [...selectedLangs, l]
    }
    setSelectedLangs(next)
    localStorage.setItem('seva-report-langs', JSON.stringify(next))
  }

  const toggleMap = (id: string) =>
    upd({
      ...opts,
      maps: opts.maps.includes(id) ? opts.maps.filter(m => m !== id) : MAP_CHOICES.map(m => m.id).filter(m => m === id || opts.maps.includes(m)),
    })

  const CART: [keyof CartOpts, string, string][] = [
    ['title', 'Title', 'top middle'],
    ['north', 'North arrow', 'top right'],
    ['scale', 'Scale bar', 'bottom left'],
    ['legend', 'Legend', 'bottom right'],
    ['coords', 'Coordinate frame', 'grid on the outer border only'],
  ]

  async function make() {
    if (!selectedLangs.length) {
      setErr('Please select at least one language.')
      return
    }
    setErr('')
    setReports({})
    setBusy('Starting')
    try {
      const res: Partial<Record<ReportLang, { html: string; data: unknown; id: string; lang: ReportLang }>> = {}
      for (const l of selectedLangs) {
        setBusy(`Building ${REPORT_LANG_NAMES[l].native} report…`)
        const r = await buildReport(farm, setBusy, { ...opts, lang: l })
        res[l] = r
      }
      setReports(res)
      const active = selectedLangs.includes(previewLang) ? previewLang : selectedLangs[0]
      setPreviewLang(active)
      if (url) URL.revokeObjectURL(url)
      setUrl(URL.createObjectURL(new Blob([res[active]!.html], { type: 'text/html' })))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not build the report. Check your internet and try again.')
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

  const curReport = reports[previewLang]
  const hasReports = Object.keys(reports).length > 0

  return (
    <div className="rp">
      {/* Language checkboxes above Advanced Settings */}
      <div className="rp-lang-select">
        <div className="rp-lang-header">
          <Languages size={15} />
          <span>Report Language / भाषा / భాష:</span>
        </div>
        <div className="rp-lang-grid">
          <label className={`rp-lang-chip ${selectedLangs.includes('en') ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={selectedLangs.includes('en')}
              onChange={() => toggleLang('en')}
            />
            <span className="rp-lang-name">English</span>
          </label>
          <label className={`rp-lang-chip ${selectedLangs.includes('hi') ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={selectedLangs.includes('hi')}
              onChange={() => toggleLang('hi')}
            />
            <span className="rp-lang-name">हिन्दी (Hindi)</span>
          </label>
          <label className={`rp-lang-chip ${selectedLangs.includes('te') ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={selectedLangs.includes('te')}
              onChange={() => toggleLang('te')}
            />
            <span className="rp-lang-name">తెలుగు (Telugu)</span>
          </label>
        </div>
      </div>

      <div className="rp-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'quick'}
          className={tab === 'quick' ? 'on' : ''}
          onClick={() => setTab('quick')}
        >
          Report
        </button>
        <button
          role="tab"
          aria-selected={tab === 'adv'}
          className={tab === 'adv' ? 'on' : ''}
          onClick={() => setTab('adv')}
        >
          Advanced settings
        </button>
      </div>

      {tab === 'adv' && (
        <div className="rp-adv">
          <h4>Maps to include</h4>
          <p>Tick the maps you want. Each one is a proper map sheet like QGIS or ArcGIS layouts, and the Copernicus and USGS viewers.</p>
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
          <h4>Map elements on every map</h4>
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
            <b>Tip.</b> After the report is made, double-click any map in the preview, then drag the title, north arrow, scale bar or legend where you want them. Double-click again to finish. Positions are remembered.
          </p>
          <button className="outline" onClick={() => upd(DEFAULT_OPTS)}>Reset to defaults</button>
        </div>
      )}

      <p>
        A full report for <b>{farm.name}</b> in <b>{selectedLangs.map(l => REPORT_LANG_NAMES[l].native).join(', ')}</b>: three pictures (fresh satellite, output, cartographic map), charts, worked maths, data sources, references and a record of when and where it was made.
      </p>

      <button className="primary" onClick={make} disabled={!!busy}>
        {busy ? <LogoLoader inline size={26} text="" /> : <FileText size={17} />}
        {busy ? `${busy}…` : hasReports ? 'Create again' : 'Create report'}
      </button>

      {err && <p className="rp-err">{err}</p>}

      {hasReports && curReport && (
        <>
          {/* Multi-language preview switcher bar */}
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
                    {REPORT_LANG_NAMES[l].native} ({REPORT_LANG_NAMES[l].label})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rp-actions">
            <button
              className="primary"
              onClick={() => save(`${curReport.id}-${previewLang}.html`, curReport.html, 'text/html')}
            >
              <ArrowDownToLine size={16} />
              Download report ({REPORT_LANG_NAMES[previewLang].native} HTML)
            </button>
            <button className="outline" onClick={print}>
              <Printer size={16} />
              Download PDF ({REPORT_LANG_NAMES[previewLang].native})
            </button>
            <button
              className="outline"
              onClick={() => save(`${curReport.id}.json`, JSON.stringify(curReport.data, null, 2), 'application/json')}
            >
              <FileJson size={16} />
              Data (JSON)
            </button>
          </div>

          {/* Quick downloads for other selected languages */}
          {selectedLangs.length > 1 && (
            <div className="rp-lang-downloads">
              <span className="rp-down-title">Download other selected languages:</span>
              <div className="rp-down-row">
                {selectedLangs.map(l => (
                  reports[l] ? (
                    <button
                      key={l}
                      type="button"
                      className="outline sm"
                      onClick={() => save(`${reports[l]!.id}-${l}.html`, reports[l]!.html, 'text/html')}
                    >
                      <ArrowDownToLine size={13} />
                      {REPORT_LANG_NAMES[l].native} (HTML)
                    </button>
                  ) : null
                ))}
                <button
                  type="button"
                  className="secondary sm"
                  onClick={() => {
                    selectedLangs.forEach((l, idx) => {
                      if (reports[l]) {
                        setTimeout(() => {
                          save(`${reports[l]!.id}-${l}.html`, reports[l]!.html, 'text/html')
                        }, idx * 250)
                      }
                    })
                  }}
                >
                  <ArrowDownToLine size={13} />
                  Download all ({selectedLangs.map(l => REPORT_LANG_NAMES[l].label).join(', ')})
                </button>
              </div>
            </div>
          )}

          <iframe id="report-frame" className="rp-frame" title="Report preview" src={url} />
        </>
      )}
    </div>
  )
}
