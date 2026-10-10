import { useState } from 'react'
import { ArrowDownToLine, CalendarClock, TrendingDown, TrendingUp } from 'lucide-react'
import { ScaleBox } from './Scale'
import { weekKey, type WeekRec } from './lib/seva'

type WFarm = { id: string; name: string; passes?: WeekRec[]; analysis?: { ndvi: { mean: number }; ndmi: { mean: number }; stressPct: number; scene: { datetime: string } } }
type Period = 'day' | 'week' | 'month'

const GOOD = '#3ca852', BAD = '#d64030', AMBER = '#f5ac28'
const tone = (v: number) => (v >= 0.5 ? GOOD : v >= 0.3 ? AMBER : BAD)
const PERIODS: { id: Period; short: string; long: string; prev: string; back: string; backN: number; unit: string }[] = [
  { id: 'day', short: 'Daily', long: 'Per satellite pass', prev: 'Previous pass', back: '5 passes ago', backN: 5, unit: 'previous pass' },
  { id: 'week', short: 'Weekly', long: 'Weekly average', prev: 'Last week', back: '4 weeks ago', backN: 4, unit: 'last week' },
  { id: 'month', short: 'Monthly', long: 'Monthly average', prev: 'Last month', back: '3 months ago', backN: 3, unit: 'last month' },
]

const keyOf = (iso: string, p: Period) => (p === 'day' ? iso.slice(0, 10) : p === 'week' ? weekKey(iso) : `${iso.slice(0, 7)}-01`)
const label = (key: string, p: Period) => new Date(key).toLocaleDateString(undefined, p === 'month' ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })

function aggregate(records: WeekRec[] | undefined, p: Period): WeekRec[] {
  const groups = new Map<string, WeekRec[]>()
  for (const r of records ?? []) { const k = keyOf(r.date, p); groups.set(k, [...(groups.get(k) ?? []), r]) }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return [...groups.entries()].map(([week, rs]) => ({ week, date: rs[rs.length - 1].date, ndvi: mean(rs.map(r => r.ndvi)), ndmi: mean(rs.map(r => r.ndmi)), stressPct: mean(rs.map(r => r.stressPct)), cloud: Math.min(...rs.map(r => r.cloud)) })).sort((a, b) => a.week.localeCompare(b.week))
}

function compare(farm: WFarm, p: Period) {
  const now = farm.analysis?.ndvi.mean
  const cfg = PERIODS.find(x => x.id === p)!
  const current = farm.analysis ? keyOf(farm.analysis.scene.datetime, p) : keyOf(new Date().toISOString(), p)
  const rows = aggregate(farm.passes, p)
  const past = rows.filter(r => r.week < current)
  const last = past[past.length - 1], back = past[past.length - cfg.backN], peak = past.length ? Math.max(...past.map(r => r.ndvi)) : undefined
  return { now, last, back, peak, rows: rows.filter(r => r.week < current) }
}

function verdict(now: number | undefined, last: WeekRec | undefined, unit: string) {
  if (now === undefined || !last) return { text: 'Not enough saved readings yet to compare.', up: true }
  const d = now - last.ndvi
  if (d <= -0.08) return { text: `The green-cover reading fell ${Math.abs(d).toFixed(2)} since the ${unit}. Walk the field; harvest, crop stage, cloud, or a crop problem can all change this score.`, up: false }
  if (d >= 0.05) return { text: `The green-cover reading rose ${d.toFixed(2)} since the ${unit}. Compare with the crop stage and what you see in the rows.`, up: true }
  return { text: `The green-cover reading is close to the ${unit}.`, up: true }
}

function Delta({ now, then, name }: { now?: number; then?: number; name: string }) {
  const d = now !== undefined && then !== undefined ? now - then : undefined
  return <div className="wk-delta"><span>{name}</span><strong>{then !== undefined ? then.toFixed(2) : '—'}</strong>{d !== undefined && <em className={d >= 0 ? 'up' : 'down'}>{d >= 0 ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}{d >= 0 ? '+' : ''}{d.toFixed(2)} now</em>}</div>
}

function Bars({ records, now, period }: { records: WeekRec[]; now?: number; period: Period }) {
  const rows = [...records.slice(-12).map(r => ({ key: r.week, v: r.ndvi, current: false })), ...(now !== undefined ? [{ key: 'now', v: now, current: true }] : [])]
  if (!rows.length) return <div className="wk-empty">Recording readings from Sentinel-2…</div>
  const W = 640, H = 170, bw = Math.min(40, (W - 20) / rows.length - 8)
  const y = (v: number) => 10 + (1 - Math.max(Math.min(v, 1), 0)) * (H - 40)
  return <svg viewBox={`0 0 ${W} ${H}`} className="wk-chart" role="img" aria-label="NDVI history">
    <line x1="0" x2={W} y1={y(0.3)} y2={y(0.3)} stroke={BAD} strokeDasharray="4 4" opacity=".5"/>
    <text x="2" y={y(0.3) - 3} fontSize="9" fill={BAD}>stress 0.30</text>
    {rows.map((r, i) => { const x = 14 + i * ((W - 20) / rows.length); return <g key={r.key}>
      <rect x={x} y={y(r.v)} width={bw} height={H - 30 - y(r.v)} rx="3" fill={tone(r.v)} opacity={r.current ? 1 : .55} stroke={r.current ? '#244f3e' : 'none'} strokeWidth="2"/>
      <text x={x + bw / 2} y={y(r.v) - 4} fontSize="9" textAnchor="middle" fill="#4d5f56">{r.v.toFixed(2)}</text>
      <text x={x + bw / 2} y={H - 14} fontSize="9" textAnchor="middle" fill="#7b867f">{r.current ? 'Now' : label(r.key, period)}</text></g> })}
  </svg>
}

export default function WeeklyRecords({ farms, farm, onSelect }: { farms: WFarm[]; farm: WFarm; onSelect: (id: string) => void }) {
  const [period, setPeriod] = useState<Period>('week')
  const cfg = PERIODS.find(p => p.id === period)!
  const c = compare(farm, period), v = verdict(c.now, c.last, cfg.unit)
  const board = farms.map(f => { const x = compare(f, period); return { f, d: x.now !== undefined && x.last ? x.now - x.last.ndvi : undefined, now: x.now } }).sort((a, b) => (a.d ?? 9) - (b.d ?? 9))
  function exportCsv() {
    const rows = [`farm,${period}_start,latest_scene_date,ndvi,ndmi,stress_pct,min_cloud_pct`, ...farms.flatMap(f => aggregate(f.passes, period).map(r => [`"${f.name.replace(/"/g, '""')}"`, r.week, r.date.slice(0, 10), r.ndvi.toFixed(3), r.ndmi.toFixed(3), r.stressPct.toFixed(1), r.cloud].join(',')))]
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `seva-crop-health-${period}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  return <section className="weekly">
    <div className="intelligence-heading"><h2>Crop cover history <span>Sentinel-2 passes saved on this device · up to 12 months</span></h2>
      <div className="wk-seg" role="tablist" aria-label="Timeframe">{PERIODS.map(p => <button key={p.id} role="tab" aria-selected={period === p.id} className={period === p.id ? 'on' : ''} onClick={() => setPeriod(p.id)}>{p.short}</button>)}</div>
      <button onClick={exportCsv}><ArrowDownToLine size={15}/>Export CSV</button></div>
    <div className="wk-grid">
      <div className="wk-card"><div className="wk-title"><CalendarClock size={16}/>{farm.name}<small>{cfg.long} NDVI vs present condition</small></div>
        <Bars records={c.rows} now={c.now} period={period}/>
        <ScaleBox id="ndvi" compact/>
        <div className={`wk-verdict ${v.up ? 'ok' : 'bad'}`}>{v.up ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}{v.text}</div>
        <div className="wk-deltas"><Delta name={cfg.prev} now={c.now} then={c.last?.ndvi}/><Delta name={cfg.back} now={c.now} then={c.back?.ndvi}/><Delta name="Season peak" now={c.now} then={c.peak}/></div></div>
      <div className="wk-card"><div className="wk-title">Field leaderboard<small>Change vs {cfg.unit}, worst first</small></div>
        <div className="wk-board">{board.map(({ f, d, now }, i) => <button key={f.id} className={f.id === farm.id ? 'on' : ''} onClick={() => onSelect(f.id)}><span className="rank">{i + 1}</span><span className="nm">{f.name}</span><b>{now !== undefined ? now.toFixed(2) : '—'}</b><em className={d === undefined ? '' : d >= 0 ? 'up' : 'down'}>{d === undefined ? 'no data' : `${d >= 0 ? '+' : ''}${d.toFixed(2)}`}</em></button>)}</div>
        <small className="wk-note">Real live Sentinel-2 satellite data, not demo. The satellite passes every ~5 days, so the daily view shows one bar per clear pass (under 30% cloud); weekly and monthly views average the passes in each period. These are satellite estimates, not yet checked against measurements taken on your farm (soil samples or plant counts).</small></div>
    </div>
  </section>
}
