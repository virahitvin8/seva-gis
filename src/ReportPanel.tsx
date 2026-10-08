import LogoLoader from './LogoLoader'
import { useState } from 'react'
import { ArrowDownToLine, FileJson, Printer, FileText } from 'lucide-react'
import { DEFAULT_OPTS, MAP_CHOICES, buildReport, type CartOpts, type ReportFarm, type ReportOpts } from './report'

export default function ReportPanel({ farm }: { farm: ReportFarm }) {
  const [busy, setBusy] = useState(''), [err, setErr] = useState('')
  const [out, setOut] = useState<{ html: string; data: unknown; id: string } | null>(null)
  const [url, setUrl] = useState('')
  const [tab, setTab] = useState<'quick' | 'adv'>('quick')
  const [opts, setOpts] = useState<ReportOpts>(() => { try { return { ...DEFAULT_OPTS, ...JSON.parse(localStorage.getItem('seva-report-opts') || '{}') } } catch { return DEFAULT_OPTS } })
  const upd = (o: ReportOpts) => { setOpts(o); localStorage.setItem('seva-report-opts', JSON.stringify(o)) }
  const toggleMap = (id: string) => upd({ ...opts, maps: opts.maps.includes(id) ? opts.maps.filter(m => m !== id) : MAP_CHOICES.map(m => m.id).filter(m => m === id || opts.maps.includes(m)) })
  const CART: [keyof CartOpts, string, string][] = [['title', 'Title', 'top middle'], ['north', 'North arrow', 'top right'], ['scale', 'Scale bar', 'bottom left'], ['legend', 'Legend', 'bottom right'], ['coords', 'Coordinate frame', 'grid on the outer border only']]

  async function make() {
    setErr(''); setOut(null); setBusy('Starting')
    try {
      const r = await buildReport(farm, setBusy, opts)
      setOut(r)
      if (url) URL.revokeObjectURL(url)
      setUrl(URL.createObjectURL(new Blob([r.html], { type: 'text/html' })))
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not build the report. Check your internet and try again.') }
    setBusy('')
  }
  const save = (name: string, body: string, type: string) => {
    const u = URL.createObjectURL(new Blob([body], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u)
  }
  const print = () => { const fr = document.getElementById('report-frame') as HTMLIFrameElement | null; fr?.contentWindow?.focus(); fr?.contentWindow?.print() }

  return <div className="rp">
    <div className="rp-tabs" role="tablist"><button role="tab" aria-selected={tab === 'quick'} className={tab === 'quick' ? 'on' : ''} onClick={() => setTab('quick')}>Report</button><button role="tab" aria-selected={tab === 'adv'} className={tab === 'adv' ? 'on' : ''} onClick={() => setTab('adv')}>Advanced settings</button></div>
    {tab === 'adv' && <div className="rp-adv">
      <h4>Maps to include</h4><p>Tick the maps you want. Each one is a proper map sheet like QGIS or ArcGIS layouts, and the Copernicus and USGS viewers.</p>
      <div className="rp-checks">{MAP_CHOICES.map(m => <label key={m.id}><input type="checkbox" checked={opts.maps.includes(m.id)} onChange={() => toggleMap(m.id)}/><span><b>{m.name}</b><small>{m.note}</small></span></label>)}</div>
      <h4>Map elements on every map</h4>
      <div className="rp-checks">{CART.map(([k, n, w]) => <label key={k}><input type="checkbox" checked={opts.cart[k]} onChange={() => upd({ ...opts, cart: { ...opts.cart, [k]: !opts.cart[k] } })}/><span><b>{n}</b><small>{w}</small></span></label>)}</div>
      <p className="rp-tip"><b>Tip.</b> After the report is made, double-click any map in the preview, then drag the title, north arrow, scale bar or legend where you want them. Double-click again to finish. Positions are remembered.</p>
      <button className="outline" onClick={() => upd(DEFAULT_OPTS)}>Reset to defaults</button>
    </div>}
    <p>A full report for <b>{farm.name}</b>: three pictures (fresh satellite, output, cartographic map), charts, worked maths, data sources, references and a record of when and where it was made.</p>
    <button className="primary" onClick={make} disabled={!!busy}>{busy ? <LogoLoader inline size={26} text=""/> : <FileText size={17}/>}{busy ? `${busy}…` : out ? 'Create again' : 'Create report'}</button>
    {err && <p className="rp-err">{err}</p>}
    {out && <>
      <div className="rp-actions">
        <button className="primary" onClick={() => save(`${out.id}.html`, out.html, 'text/html')}><ArrowDownToLine size={16}/>Download report (HTML)</button>
        <button className="outline" onClick={print}><Printer size={16}/>Download PDF</button>
        <button className="outline" onClick={() => save(`${out.id}.json`, JSON.stringify(out.data, null, 2), 'application/json')}><FileJson size={16}/>Data (JSON)</button>
      </div>
      <iframe id="report-frame" className="rp-frame" title="Report preview" src={url}/>
    </>}
  </div>
}
