import LogoLoader from './LogoLoader'
import SourceNote from './SourceNote'
import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Leaf, Droplets, CloudRain, Sprout, Satellite } from 'lucide-react'
import { classify, history, type Candle, type WeekRec } from './lib/seva'

type JFarm = { id: string; name: string; crop: string; lat: number; lon: number; area: number; rain?: number; moisture?: number; passes?: WeekRec[]; analysis?: { ndvi: { mean: number }; ndmi: { mean: number }; stressPct: number; scene: { cloud: number } } }

const frames = [['1 month', 30], ['3 months', 90], ['6 months', 180]] as const
const ZONES = [{ from: 0.5, to: 1, c: '#d9f0c8', l: 'Healthy' }, { from: 0.3, to: 0.5, c: '#fdf0c4', l: 'Moderate' }, { from: -0.1, to: 0.3, c: '#f9d9d3', l: 'Stressed' }]
const tone = (v: number) => (v >= 0.5 ? '#2f8f46' : v >= 0.3 ? '#d99a1b' : '#d0453a')
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

function Growth({ rows }: { rows: Candle[] }) {
  const W = 860, H = 300, L = 44, R = 16, T = 14, B = 34, lo = -0.1, hi = 1
  if (rows.length < 2) return <div className="cj-empty">Not enough clear satellite pictures in this period yet. Try a longer period.</div>
  const t0 = +new Date(rows[0].scene.datetime), t1 = +new Date(rows[rows.length - 1].scene.datetime)
  const X = (c: Candle) => L + ((+new Date(c.scene.datetime) - t0) / Math.max(1, t1 - t0)) * (W - L - R)
  const Y = (v: number) => T + (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (H - T - B)
  const mean = rows.map(c => `${X(c).toFixed(1)},${Y(c.ndvi.mean).toFixed(1)}`)
  const band = [...rows.map(c => `${X(c).toFixed(1)},${Y(c.ndvi.p90).toFixed(1)}`), ...[...rows].reverse().map(c => `${X(c).toFixed(1)},${Y(c.ndvi.p10).toFixed(1)}`)].join(' ')
  const last = rows[rows.length - 1]
  return <svg className="cj-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Crop health score over time">
    {ZONES.map(z => <g key={z.l}><rect x={L} y={Y(z.to)} width={W - L - R} height={Y(z.from) - Y(z.to)} fill={z.c} opacity=".7"/><text x={L + 10} y={Y(z.to) + 18} textAnchor="start" fontSize="15" fontWeight="700" fill="#4a5f52" opacity=".8">{z.l}</text></g>)}
    {[0, 0.25, 0.5, 0.75, 1].map(v => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#fff" strokeOpacity=".8"/><text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize="14" fill="#6b7b6c">{v}</text></g>)}
    <polygon points={band} fill="#2f8f46" opacity=".16"/>
    <polyline points={mean.join(' ')} fill="none" stroke="#1f6b3a" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
    {rows.map(c => <circle key={c.scene.id} cx={X(c)} cy={Y(c.ndvi.mean)} r="5" fill="#fff" stroke={tone(c.ndvi.mean)} strokeWidth="3"/>)}
    {rows.map((c, i) => i % Math.ceil(rows.length / 6) === 0 && <text key={'d' + c.scene.id} x={X(c)} y={H - 12} textAnchor="middle" fontSize="14" fill="#6b7b6c">{day(c.scene.datetime)}</text>)}
    <g transform={`translate(${Math.min(X(last), W - 118)} ${Math.max(Y(last.ndvi.mean) - 42, 4)})`}><rect width="112" height="34" rx="17" fill="#183e30"/><text x="56" y="23" textAnchor="middle" fontSize="16" fontWeight="800" fill="#b6f36a">Now {last.ndvi.mean.toFixed(2)}</text></g>
    <text x={L} y={T + 2} fontSize="14" fill="#6b7b6c">Score (0 = bare soil, 1 = very dense leaves)</text>
  </svg>
}

export default function CropJournal({ farms, selected, onSelect, onRefresh, loading }: { farms: JFarm[]; selected: string; onSelect: (id: string) => void; onRefresh: () => void; loading: boolean }) {
  const [days, setDays] = useState<number>(180)
  const [cache, setCache] = useState<Record<string, Candle[] | 'error' | 'loading'>>({})
  const farm = farms.find(f => f.id === selected) || farms[0]
  useEffect(() => {
    for (const f of farms) {
      if (cache[f.id]) continue
      if (f.passes && f.passes.length > 0) {
        const rows: Candle[] = f.passes.map(p => ({
          scene: { id: p.week, datetime: p.date, cloud: p.cloud },
          ndvi: { mean: p.ndvi, min: p.ndvi, max: p.ndvi, p10: p.ndvi, p50: p.ndvi, p90: p.ndvi, n: 1 },
          ndmi: p.ndmi,
          stressPct: p.stressPct
        }))
        setCache(c => ({ ...c, [f.id]: rows }))
        continue
      }
      setCache(c => ({ ...c, [f.id]: 'loading' }))
      history(f).then(rows => setCache(c => ({ ...c, [f.id]: rows }))).catch(() => setCache(c => ({ ...c, [f.id]: 'error' })))
    }
  }, [farms.map(f => f.id).join()])
  const all = (id: string) => { const v = cache[id]; return Array.isArray(v) ? v : [] }
  const rows = useMemo(() => { const cut = Date.now() - days * 86400000; return all(farm.id).filter(c => +new Date(c.scene.datetime) >= cut) }, [cache, farm.id, days])
  const a = farm.analysis, now = rows[rows.length - 1]?.ndvi.mean ?? a?.ndvi.mean, before = rows[rows.length - 2]?.ndvi.mean
  const diff = now !== undefined && before !== undefined ? now - before : undefined
  const state = cache[farm.id], cls = classify(now)
  const story = now === undefined ? 'Press Refresh on the map to get the first satellite reading for this farm.'
    : `${farm.name} scores ${now.toFixed(2)}, which is ${cls.label.toLowerCase()}.${diff === undefined ? '' : diff > 0.02 ? ` It is greener than the picture before (up ${diff.toFixed(2)}), so the crop is gaining.` : diff < -0.02 ? ` It is less green than the picture before (down ${Math.abs(diff).toFixed(2)}). This can be harvest, dry weather or stress, so walk the field.` : ' It is about the same as the picture before.'}`
  const cards = [
    { i: Leaf, t: 'Crop health', v: now?.toFixed(2) ?? '—', s: cls.label, c: now === undefined ? '#6b7b6c' : tone(now), w: now === undefined ? 0 : Math.max(0, Math.min(1, now / 0.9)), why: 'Healthy leaves bounce back lots of near-infrared light. Above 0.5 is healthy.' },
    { i: Sprout, t: 'Stressed area', v: a ? `${a.stressPct.toFixed(0)}%` : '—', s: 'of the farm scores below 0.3', c: a && a.stressPct >= 25 ? '#d0453a' : '#2f8f46', w: a ? a.stressPct / 100 : 0, why: 'Pixels (10 m squares) with a very low score. Under 20% is normal.' },
    { i: Droplets, t: 'Leaf water', v: a ? a.ndmi.mean.toFixed(2) : '—', s: 'higher means wetter leaves', c: '#2b83ba', w: a ? Math.max(0, Math.min(1, (a.ndmi.mean + 0.2) / 0.8)) : 0, why: 'Water soaks up short-wave infrared light. Below 0.1 looks dry.' },
    { i: CloudRain, t: 'Rain, next 7 days', v: farm.rain !== undefined ? `${farm.rain.toFixed(0)} mm` : '—', s: farm.moisture !== undefined ? `soil moisture ${farm.moisture}%` : 'soil moisture n/a', c: '#4b7fb0', w: farm.rain !== undefined ? Math.min(1, farm.rain / 50) : 0, why: '15 mm or more in a week usually means irrigation can wait.' },
  ]
  return <section className="cj" id="crop-journal" aria-label="Crop journal">
    <div className="cj-top"><div><div className="eyebrow">CROP JOURNAL</div><h2>How is each farm growing?</h2><p>One satellite picture every few days, turned into a simple green score. Follow your crop from sowing to harvest.</p></div>
      <div className="cj-tools">{frames.map(([n, d]) => <button key={n} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{n}</button>)}<button onClick={onRefresh} aria-label="Refresh satellite data"><RefreshCw size={14} className={loading ? 'spin' : ''}/></button></div></div>
    <div className="cj-tabs" role="tablist">{farms.map(f => <button role="tab" aria-selected={f.id === farm.id} key={f.id} className={f.id === farm.id ? 'on' : ''} onClick={() => onSelect(f.id)}><b>{f.name}</b><small>{f.crop} · {f.area} ha</small></button>)}</div>
    <div className="cj-grid">
      <div className="cj-card cj-main">
        <h3>Crop health over time <small>{farm.name}</small></h3>
        {state === 'loading' ? <div className="cj-empty"><LogoLoader size={80} text="Loading satellite history…"/></div> : state === 'error' ? <div className="cj-empty"><LogoLoader state="error" size={80} text="Could not load satellite history. Check your internet and press Refresh."/></div> : <Growth rows={rows}/>}
        <SourceNote of={['s2']}/>
        <p className="cj-legend"><i className="ln"/> Farm average <i className="bd"/> Weakest to strongest 10% of the farm <i className="dt"/> One satellite picture</p>
        <div className="cj-story"><b>In plain words</b><p>{story}</p></div>
      </div>
      <div className="cj-side">{cards.map(({ i: Icon, t, v, s, c, w, why }) => <div className="cj-card cj-stat" key={t}><span className="cj-ico" style={{ background: c + '22', color: c }}><Icon size={18}/></span><div><small>{t}</small><strong>{v}</strong><em>{s}</em><div className="cj-meter"><i style={{ width: `${w * 100}%`, background: c }}/></div><p><b>Why?</b> {why}</p></div></div>)}</div>
    </div>
    <div className="cj-card"><h3><Satellite size={15}/> Recent satellite visits <small>newest first; colour = crop health, ☁ = cloud over the picture</small></h3>
      <div className="cj-visits">{rows.length ? [...rows].reverse().slice(0, 10).map(c => <div key={c.scene.id} style={{ borderColor: tone(c.ndvi.mean) }}><span style={{ background: tone(c.ndvi.mean) }}/><b>{c.ndvi.mean.toFixed(2)}</b><small>{day(c.scene.datetime)}</small><small>☁ {c.scene.cloud.toFixed(0)}%</small></div>) : <p className="cj-dim">No visits to show for this period.</p>}</div><SourceNote of={['s2']}/></div>
    <div className="cj-card"><h3>All your farms side by side <small>latest crop health score, 0 to 1</small></h3>
      <div className="cj-cmp">{farms.map(f => { const r = all(f.id), v = r[r.length - 1]?.ndvi.mean ?? f.analysis?.ndvi.mean; return <button key={f.id} className={f.id === farm.id ? 'on' : ''} onClick={() => onSelect(f.id)}><span>{f.name}</span><div><i style={{ width: `${Math.max(0, Math.min(1, (v ?? 0) / 0.9)) * 100}%`, background: v === undefined ? '#cfd8cf' : tone(v) }}/><u style={{ left: `${(0.3 / 0.9) * 100}%` }}/><u style={{ left: `${(0.5 / 0.9) * 100}%` }}/></div><b>{v?.toFixed(2) ?? '—'}</b></button> })}</div>
      <SourceNote of={['s2']}/>
      <p className="cj-dim">Thin lines mark 0.3 (stressed below) and 0.5 (healthy above). Data: Sentinel-2 via Microsoft Planetary Computer, Open-Meteo. A guide for walking your field, not a replacement for it.</p></div>
  </section>
}
