import LogoLoader from './LogoLoader'
import SourceNote, { type SourceKey } from './SourceNote'
import { useEffect, useMemo, useState } from 'react'
import { Bug, CalendarRange, Film, GitCompareArrows, Layers3, Sparkles, Sprout } from 'lucide-react'
import { fetchSoil, fetchWeather } from './lib/agro'
import { RISK_BANDS, changeAnalysis, hotspots, landCover, loadHistory, managementZones, pestRisks, phenology, riskBand, sceneNdvi, type ClassRow, type MapResult } from './lib/gee'
import { MONTHS, PLAN_CROPS, SUIT_BANDS, fetchClimate, rotationAdvice, suitBand, suitability } from './lib/plan'
import { farmRing, loadScene, type FarmData, type Scene } from './lib/seva'
import { ScaleBox } from './Scale'
import Studio from './Studio'
import Timelapse from './Timelapse'
import { MapFrame } from './LabMap'

type Props = { farm: FarmData & { id: string; name: string; crop?: string } }
type Tab = 'map' | 'plan' | 'change' | 'film' | 'pest' | 'ai'
const TABS: [Tab, string, typeof Layers3][] = [['map', 'Crop & vegetation map', Layers3], ['plan', 'Suitability & planning', CalendarRange], ['change', 'Monitoring & change', GitCompareArrows], ['film', 'Time-lapse', Film], ['pest', 'Pest & disease', Bug], ['ai', 'GeoAI studio', Sparkles]]
const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—')

function useAsync<T>(key: string, fn: () => Promise<T>, enabled = true) {
  const [s, set] = useState<{ key: string; data?: T; error?: string }>({ key: '' })
  useEffect(() => {
    if (!enabled) return
    let dead = false
    fn().then(data => { if (!dead) set({ key, data }) }).catch(e => { if (!dead) set({ key, error: e instanceof Error ? e.message : 'Failed' }) })
    return () => { dead = true }
  }, [key, enabled])
  const cur = s.key === key
  return { data: cur ? s.data : undefined, error: cur ? s.error : undefined, loading: enabled && !(cur && (s.data || s.error)) }
}

function Legend({ title, unit, rows }: { title: string; unit: string; rows: (ClassRow | { id: string; name: string; color: string; note?: string; pct?: number; ha?: number })[] }) {
  return <div className="sc-box compact ge-legend"><div className="sc-title"><b>{title}</b><span>{unit}</span></div>
    <div className="sc-bar">{rows.map(r => <i key={r.id} style={{ background: r.color, flex: r.pct && r.pct > 0 ? r.pct : 1 }} title={r.name}/>)}</div>
    <ul>{rows.map(r => <li key={r.id}><i style={{ background: r.color }}/><span>{r.name}{r.note && <em>{r.note}</em>}</span><code>{r.pct !== undefined ? `${f(r.pct, 0)}% · ${f(r.ha ?? 0, 2)} ha` : ''}</code></li>)}</ul></div>
}

function Img({ res, caption, farm, scene, how }: { res?: MapResult; caption: string; farm: Props['farm']; scene?: Scene; how: string }) {
  if (!res?.url) return <figure className="ge-fig"><div className="ge-wait">Computing…</div><figcaption>{caption}</figcaption></figure>
  return <MapFrame farm={farm} scene={scene} overlay={res.url} title={caption.split(' · ')[0]} note={how} caption={caption} legend={res.rows.map(r => ({ color: r.color, label: r.name }))}/>
}

const Note = ({ children, src = ['s2'] }: { children: React.ReactNode; src?: SourceKey[] }) => <><p className="ge-note">{children}</p><SourceNote of={src}/></>
const Status = ({ error, loading, text }: { error?: string; loading: boolean; text: string }) => error ? <div className="ag-empty"><LogoLoader state="error" text={error}/></div> : loading ? <div className="ag-empty"><LogoLoader text={text}/></div> : null

function MapTab({ farm, scene }: { farm: Props['farm']; scene?: Scene }) {
  const key = `${farm.id}:${scene?.id}:${farm.polygon?.length}:${farm.area}`
  const grid = useAsync(key, () => loadScene(scene!, farm), !!scene)
  const lc = useMemo(() => grid.data && landCover(grid.data, farmRing(farm)), [grid.data])
  const zones = useMemo(() => grid.data && managementZones(grid.data, farmRing(farm)), [grid.data])
  if (!scene) return <div className="ag-empty">Run the satellite analysis first (Refresh), then the maps appear here.</div>
  return <>
    <Status error={grid.error} loading={grid.loading} text="Loading Sentinel-2 bands…"/>
    {lc && zones && <div className="ge-cols">
      <div><Img farm={farm} scene={scene} res={lc} caption={`Land cover · Sentinel-2 ${scene.datetime.slice(0, 10)}`} how="Each colour is one kind of ground, worked out from the light the satellite measured: water, thick crop, thin crop, bare soil or buildings. Dark green means dense healthy plants; brown means bare soil."/><Legend title="Land-cover class" unit="share of clear pixels · area in ha" rows={lc.rows}/></div>
      <div><Img farm={farm} scene={scene} res={zones} caption="Management zones · k-means on NDVI, NDMI, NDRE" how="The computer splits your farm into zones that behave alike. Weaker zones may need more water, food for the soil, or a closer look. Treat each zone separately."/><Legend title="Vigour zone" unit="share of field · area in ha" rows={zones.rows}/>
        <div className="ge-zmean">{zones.means.map((m, i) => <span key={i}>Z{i + 1}: NDVI {f(m.ndvi, 2)}, NDMI {f(m.ndmi, 2)}</span>)}</div></div>
    </div>}
    <div className="sc-grid"><ScaleBox id="ndvi" compact/><ScaleBox id="ndre" compact/></div>
    <Note>Land cover uses transparent index thresholds (NDVI, MNDWI, NDBI) on one clear scene, the same rule-based approach used in Earth Engine code-editor scripts. Zones are unsupervised clusters: use them to sample soil or scout, then apply variable-rate inputs per zone. For crop-type names, label the zones on the ground once.</Note>
  </>
}

function PlanTab({ farm }: { farm: Props['farm'] }) {
  const key = `${farm.id}:${farm.lat}:${farm.lon}`
  const climate = useAsync(`c:${key}`, () => fetchClimate(farm.lat, farm.lon))
  const soil = useAsync(`s:${key}`, () => fetchSoil(farm.lat, farm.lon))
  const [irrigated, setIrrigated] = useState(true)
  const sp = useMemo(() => {
    if (!soil.data) return {}
    const avg = (k: string) => { const v = (soil.data![k]?.depths ?? []).slice(0, 3).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined }
    return { ph: avg('phh2o'), clay: avg('clay') }
  }, [soil.data])
  const ranked = useMemo(() => climate.data ? PLAN_CROPS.map(c => suitability(climate.data!, c, sp, farm.analysis?.slopePct, irrigated)).sort((a, b) => b.score - a.score) : [], [climate.data, sp, irrigated, farm.analysis?.slopePct])
  const top = ranked[0], current = farm.crop ? ranked.find(r => farm.crop!.toLowerCase().split(/[\s/()]+/).some(w => w.length > 3 && (r.crop.name.toLowerCase().includes(w) || r.crop.id === w))) : undefined
  const ha = farm.area || 0
  return <>
    <Status error={climate.error} loading={climate.loading} text="Fetching 3-year climate normals (Open-Meteo archive)…"/>
    {climate.data && top && <>
      <div className="ge-bar"><label><input type="checkbox" checked={irrigated} onChange={e => setIrrigated(e.target.checked)}/> Irrigation available</label>
        <small>Soil pH {f(sp.ph ?? NaN)} · clay {f(sp.clay ?? NaN, 0)}% · slope {farm.analysis?.slopePct !== undefined ? `${f(farm.analysis.slopePct)}%` : 'unknown'} · {climate.data.years}-year mean rainfall {f(climate.data.annualRain, 0)} mm/yr</small></div>
      <div className="ge-plan">
        <div className={`wt-verdict ${top.score >= 60 ? 'good' : 'warn'}`}><Sprout size={18}/><div><b>Best fit here: {top.crop.name}, {top.score}/100 ({suitBand(top.score).label})</b><br/>Sow in {MONTHS[top.bestMonth]}, harvest around {MONTHS[top.harvest]}. Seasonal crop water need ≈ {f(top.waterNeed, 0)} mm, rain covers ≈ {f(top.rainSeason, 0)} mm, so plan about {f(top.irrigation, 0)} mm of irrigation{ha ? ` (${f(top.irrigation * ha * 10, 0)} m³ for ${f(ha)} ha)` : ''}. {rotationAdvice(top.crop)}</div></div>
        {current && <div className="wt-verdict"><Sprout size={18}/><div><b>Your current crop ({current.crop.name}): {current.score}/100, {suitBand(current.score).label}</b><br/>Limiting factor: {current.limiting}. Best sowing month for it here is {MONTHS[current.bestMonth]}.</div></div>}
      </div>
      <div className="ge-cal"><div className="ge-cal-head"><span>Crop</span>{MONTHS.map(m => <span key={m}>{m[0]}</span>)}<span>Best</span></div>
        {ranked.map(r => <div key={r.crop.id} className="ge-cal-row"><span title={`Limited by ${r.limiting}`}>{r.crop.name}</span>
          {r.monthScores.map((s, m) => <i key={m} className={m === r.bestMonth ? 'best' : ''} style={{ background: suitBand(s).color, opacity: 0.35 + s / 160 }} title={`Sow ${MONTHS[m]}: ${s}/100`}/>)}
          <b style={{ color: suitBand(r.score).color === '#fdae61' ? '#a55a00' : undefined }}>{r.score}</b></div>)}</div>
      <div className="ge-cols">
        <Legend title="Suitability score" unit="0 to 100, weakest of temperature, water, soil, terrain" rows={SUIT_BANDS.map((b, i) => ({ id: b.label, name: b.label, color: b.color, note: ['below 40', '40 to 60', '60 to 80', '80 and above'][i] }))}/>
        <ClimateChart c={climate.data}/>
      </div>
      <Note src={['weather', 'soil', 'dem', 'model']}>Method: FAO EcoCrop style limiting-factor scoring. Each cell is the score if you sow that month; the outlined cell is the best month. Temperature uses monthly means across the crop cycle, soil uses SoilGrids pH and clay, terrain uses the DEM slope. Variety, salinity and market are not modelled.</Note>
    </>}
  </>
}

function ClimateChart({ c }: { c: { tmean: number[]; rain: number[]; et0: number[] } }) {
  const W = 330, H = 130, maxR = Math.max(...c.rain, ...c.et0, 50), maxT = Math.max(...c.tmean, 10) + 3, bw = (W - 30) / 12
  const line = c.tmean.map((t, i) => `${i ? 'L' : 'M'}${28 + i * bw + bw / 2},${H - 16 - (t / maxT) * (H - 30)}`).join(' ')
  const et = c.et0.map((t, i) => `${i ? 'L' : 'M'}${28 + i * bw + bw / 2},${H - 16 - (t / maxR) * (H - 30)}`).join(' ')
  return <div className="sc-box compact"><div className="sc-title"><b>Climate normals</b><span>blue bars rain mm/month · green dashed ET₀ mm · red line mean °C</span></div>
    <svg viewBox={`0 0 ${W} ${H}`} className="ge-chart" role="img" aria-label="Monthly climate">
      {c.rain.map((r, i) => <rect key={i} x={28 + i * bw + 3} width={bw - 6} y={H - 16 - (r / maxR) * (H - 30)} height={(r / maxR) * (H - 30)} fill="#6baed6"/>)}
      <path d={et} fill="none" stroke="#31a354" strokeDasharray="4 3" strokeWidth="1.5"/><path d={line} fill="none" stroke="#d73027" strokeWidth="2"/>
      {MONTHS.map((m, i) => <text key={m} x={28 + i * bw + bw / 2} y={H - 4} fontSize="8" textAnchor="middle" fill="#4d5f56">{m[0]}</text>)}
      <text x="2" y="14" fontSize="8" fill="#4d5f56">{maxR.toFixed(0)} mm</text><text x="2" y={H - 18} fontSize="8" fill="#4d5f56">0</text></svg></div>
}

function SeriesChart({ p }: { p: NonNullable<ReturnType<typeof phenology>> }) {
  const W = 700, H = 190, L = 34, tmax = Math.max(p.points[p.points.length - 1].t, 1)
  const x = (t: number) => L + (t / tmax) * (W - L - 8), y = (v: number) => H - 22 - ((v + 0.2) / 1.2) * (H - 34)
  const path = (k: 'ndvi' | 'ndmi') => p.points.map((q, i) => `${i ? 'L' : 'M'}${x(q.t)},${y(q[k])}`).join(' ')
  return <svg viewBox={`0 0 ${W} ${H}`} className="ge-chart wide" role="img" aria-label="NDVI time series">
    {[0, 0.25, 0.5, 0.75, 1].map(v => <g key={v}><line x1={L} x2={W - 8} y1={y(v)} y2={y(v)} stroke="#e1e8dd"/><text x="2" y={y(v) + 3} fontSize="9" fill="#4d5f56">{v}</text></g>)}
    <rect x={L} width={W - L - 8} y={y(Math.min(1, p.mean + p.sd))} height={Math.max(0, y(p.mean - p.sd) - y(Math.min(1, p.mean + p.sd)))} fill="#1a98501a"/>
    <line x1={L} x2={W - 8} y1={y(p.mean)} y2={y(p.mean)} stroke="#1a9850" strokeDasharray="3 3"/>
    <path d={path('ndmi')} fill="none" stroke="#2171b5" strokeWidth="1.6"/><path d={path('ndvi')} fill="none" stroke="#1a9850" strokeWidth="2.4"/>
    {p.points.map(q => <circle key={q.date} cx={x(q.t)} cy={y(q.ndvi)} r={q.z < -1.5 ? 4.5 : 2.5} fill={q.z < -1.5 ? '#d73027' : '#1a9850'}><title>{`${q.date}: NDVI ${q.ndvi.toFixed(2)}, z ${q.z.toFixed(1)}`}</title></circle>)}
    <text x={L} y={H - 4} fontSize="9" fill="#4d5f56">{p.points[0].date}</text><text x={W - 8} y={H - 4} fontSize="9" textAnchor="end" fill="#4d5f56">{p.points[p.points.length - 1].date}</text></svg>
}

function ChangeTab({ farm }: { farm: Props['farm'] }) {
  const key = `${farm.id}:${farm.polygon?.length}:${farm.area}`
  const hist = useAsync(`h:${key}`, () => loadHistory(farm))
  const rows = hist.data ?? [], ph = useMemo(() => phenology(rows), [hist.data])
  const [ai, setAi] = useState<number | null>(null), [bi, setBi] = useState<number | null>(null), [ti, setTi] = useState<number | null>(null)
  const B = bi ?? rows.length - 1, A = ai ?? Math.max(0, rows.findIndex(r => new Date(r.scene.datetime).getTime() >= new Date(rows[B]?.scene.datetime ?? 0).getTime() - 35 * 86400000)), T = ti ?? rows.length - 1
  const change = useAsync(`c:${key}:${rows[A]?.scene.id}:${rows[B]?.scene.id}`, () => changeAnalysis(farm, rows[A].scene, rows[B].scene), rows.length > 1 && A !== B)
  const frame = useAsync(`t:${key}:${rows[T]?.scene.id}`, () => sceneNdvi(farm, rows[T].scene), rows.length > 0)
  return <>
    <Status error={hist.error} loading={hist.loading} text="Reading every clear Sentinel-2 pass of the last 12 months…"/>
    {ph && <>
      <div className="ge-stats">
        <div><span>Mean NDVI, 12 months</span><b>{f(ph.mean, 2)}</b><small>±{f(ph.sd, 2)} spread</small></div>
        <div><span>Trend</span><b className={ph.slope30 < -0.02 ? 'bad' : ph.slope30 > 0.02 ? 'good' : ''}>{ph.slope30 >= 0 ? '+' : ''}{f(ph.slope30, 3)}</b><small>NDVI per 30 days</small></div>
        <div><span>Peak greenness</span><b>{f(ph.peak!.ndvi, 2)}</b><small>{ph.peak!.date}</small></div>
        <div><span>Green-up → senescence</span><b>{ph.start?.slice(5) ?? '—'} → {ph.end?.slice(5) ?? '—'}</b><small>half-maximum crossings</small></div>
        <div><span>Anomalous passes</span><b className={ph.anomalies ? 'bad' : 'good'}>{ph.anomalies}</b><small>NDVI z-score below −1.5</small></div>
      </div>
      <SeriesChart p={ph}/>
      <div className="ge-key"><span><i style={{ background: '#1a9850' }}/>NDVI</span><span><i style={{ background: '#2171b5' }}/>NDMI</span><span><i style={{ background: '#d73027' }}/>Anomaly (more than 1.5 σ below the year's mean)</span><span><i style={{ background: '#1a98501a', border: '1px solid #1a9850' }}/>Mean ± 1 σ</span></div>
      <div className="ge-pick"><label>Before<select value={A} onChange={e => setAi(+e.target.value)}>{rows.map((r, i) => <option key={r.scene.id} value={i}>{r.scene.datetime.slice(0, 10)}</option>)}</select></label>
        <label>After<select value={B} onChange={e => setBi(+e.target.value)}>{rows.map((r, i) => <option key={r.scene.id} value={i}>{r.scene.datetime.slice(0, 10)}</option>)}</select></label></div>
      <div className="ge-cols">
        <div>{A === B ? <div className="ag-empty">Pick two different dates.</div> : <><Status error={change.error} loading={change.loading} text="Differencing the two scenes pixel by pixel…"/>
          {change.data && <><Img farm={farm} scene={rows[B].scene} how="Red means the crop got weaker between the two dates, green means it got stronger. A drop right after harvest is normal." res={change.data} caption={`ΔNDVI ${change.data.a.datetime.slice(0, 10)} → ${change.data.b.datetime.slice(0, 10)}`}/>
            <div className="ge-delta">Mean ΔNDVI <b className={change.data.mean < -0.05 ? 'bad' : change.data.mean > 0.05 ? 'good' : ''}>{change.data.mean >= 0 ? '+' : ''}{f(change.data.mean, 3)}</b> · mean ΔNDMI <b>{change.data.meanMoisture >= 0 ? '+' : ''}{f(change.data.meanMoisture, 3)}</b></div>
            <Legend title="Change class" unit="share of pixels clear on both dates" rows={change.data.rows}/></>}</>}</div>
        <div>{frame.data ? <MapFrame farm={farm} scene={rows[T].scene} overlay={frame.data.url} title={`Greenness on ${rows[T].scene.datetime.slice(0, 10)}`} note="Slide through the dates to watch your crop grow. Dark green is thick healthy crop, yellow is thin, red is bare or stressed." legend={[{ color: '#a50026', label: 'Bare / stressed' }, { color: '#fdae61', label: 'Thin' }, { color: '#a6d96a', label: 'Growing' }, { color: '#006837', label: 'Dense and healthy' }]} caption={`Time slider · NDVI on ${rows[T].scene.datetime.slice(0, 10)}`}/> : <div className="ge-wait">{frame.error ?? 'Loading…'}</div>}
          <input type="range" min={0} max={rows.length - 1} value={T} onChange={e => setTi(+e.target.value)} className="ge-slider" aria-label="Date"/>
          <div className="ge-slider-ends"><span>{rows[0].scene.datetime.slice(0, 10)}</span><span>{rows[rows.length - 1].scene.datetime.slice(0, 10)}</span></div>
          {frame.data && <div className="sc-box compact"><div className="sc-title"><b>NDVI colour</b><span>{f(frame.data.range?.[0] ?? -0.2, 1)} to {f(frame.data.range?.[1] ?? 1, 1)}</span></div><div className="sc-bar" style={{ height: 10, background: 'linear-gradient(90deg,#a50026,#fdae61,#fee08b,#a6d96a,#006837)' }}/><div className="ge-slider-ends"><span>bare / stressed</span><span>dense, healthy</span></div></div>}</div>
      </div>
      <Note>Change detection follows the standard Earth Engine recipe: difference two cloud-masked composites, then threshold the delta. A decline right after harvest is normal. Anomaly flags compare each pass with this farm's own 12-month mean, so they pick up sudden dips (flood, drought, pest outbreaks, lodging).</Note>
    </>}
    {!hist.loading && !hist.error && !ph && <div className="ag-empty">Fewer than four clear Sentinel-2 passes in the last year. Cloud cover is too high to build a time series here.</div>}
  </>
}

function PestTab({ farm, scene }: { farm: Props['farm']; scene?: Scene }) {
  const key = `${farm.id}:${scene?.id}:${farm.polygon?.length}:${farm.area}`
  const grid = useAsync(`g:${key}`, () => loadScene(scene!, farm), !!scene)
  const weather = useAsync(`w:${farm.id}:${farm.lat}:${farm.lon}`, () => fetchWeather(farm.lat, farm.lon))
  const hs = useMemo(() => grid.data ? hotspots(grid.data, farmRing(farm), farm) : null, [grid.data])
  const risks = useMemo(() => weather.data ? pestRisks(weather.data) : [], [weather.data])
  const maxRisk = risks.reduce((a, r) => (r.score > a.score ? r : a), { score: -1 } as (typeof risks)[number])
  return <>
    <div className="ge-cols">
      <div><h4 className="ge-h">Weather-driven risk, next 7 days</h4>
        <Status error={weather.error} loading={weather.loading} text="Loading live weather…"/>
        {risks.map(r => { const b = riskBand(r.score); return <div key={r.id} className="ge-risk"><div><b>{r.name}</b><small>{r.targets}</small></div><div className="ge-risk-bar"><i style={{ width: `${r.score}%`, background: b.color }}/></div><span style={{ color: b.color === '#fee08b' ? '#8a6d00' : b.color }}>{r.score} · {b.label}</span><small className="ge-why">{r.why}</small></div> })}
        <Legend title="Risk score" unit="0 to 100, rule-of-thumb weather suitability" rows={RISK_BANDS.map((b, i) => ({ id: b.label, name: b.label, color: b.color, note: ['below 25', '25 to 50', '50 to 75', '75 and above'][i] }))}/>
        {maxRisk.score >= 50 && <div className="wt-verdict warn"><Bug size={18}/><div><b>Scout for {maxRisk.name.toLowerCase()} this week.</b> {maxRisk.why}. Check the underside of leaves in the satellite hotspots on the right first.</div></div>}</div>
      <div><h4 className="ge-h">Satellite stress hotspots</h4>
        {!scene && <div className="ag-empty">Run the satellite analysis first.</div>}
        <Status error={grid.error} loading={grid.loading} text="Loading Sentinel-2 bands…"/>
        {grid.data && !hs && <div className="ag-empty">Too few clear vegetated pixels to detect hotspots on this date.</div>}
        {hs && <><Img farm={farm} scene={scene} how="Darker orange or red patches are weaker than the rest of your field. Satellites cannot name a pest, they show where to look." res={hs} caption={`Weak spots vs field average · ${scene!.datetime.slice(0, 10)}`}/>
          <Legend title="Hotspot level" unit="share of vegetated pixels · area in ha" rows={hs.rows}/>
          <div className="ge-delta">{f(hs.healthyPct, 0)}% of the field is at or above average. Weak spots are {hs.clustered ? <b className="bad">clustered in patches: typical of pests or disease spreading from foci</b> : <b>scattered: more typical of soil, water or seed variability</b>}.</div></>}</div>
    </div>
    {hs && hs.patches.length > 0 && <div className="ge-patches"><h4 className="ge-h">Scouting targets</h4><table><thead><tr><th>#</th><th>Where</th><th>Size</th><th>Mean z</th><th>Weakest signal</th><th>From farm centre</th></tr></thead>
      <tbody>{hs.patches.map((p, i) => <tr key={i}><td>{i + 1}</td><td>{p.lat.toFixed(5)}°, {p.lon.toFixed(5)}°</td><td>{f(p.ha, 2)} ha</td><td>{f(p.z, 1)}</td><td>{p.signature}</td><td>{f(p.distM, 0)} m {p.bearing}</td></tr>)}</tbody></table>
      <div className="ge-stats">{hs.signatures.map(s => <div key={s.name}><span>Weakest signal</span><b>{f(s.pct, 0)}%</b><small>{s.name}</small></div>)}</div></div>}
    <div className="sc-grid"><ScaleBox id="ndre" compact/><ScaleBox id="ndmi" compact/></div>
    <Note src={['s2', 'weather']}>Satellites cannot name a pest or disease. They show where the canopy is weaker than the rest of this field in density (NDVI), chlorophyll (NDRE) or water (NDMI); z is the number of standard deviations below the field average. Chlorophyll loss with normal water points to disease or nutrient problems, low water to irrigation faults, low density to feeding damage or poor stand. Visit the listed spots and confirm. Weather risk scores are suitability rules, not calibrated forecasts.</Note>
  </>
}

export default function Intelligence({ farm }: Props) {
  const [tab, setTab] = useState<Tab>('map')
  const scene = farm.analysis?.scene

  useEffect(() => {
    const onTab = (e: Event) => {
      const custom = e as CustomEvent<Tab>
      if (custom.detail) setTab(custom.detail)
    }
    window.addEventListener('seva-set-lab-tab', onTab)
    return () => window.removeEventListener('seva-set-lab-tab', onTab)
  }, [])

  return <section className="ag-wrap ge-wrap">
    <div className="intelligence-heading"><h2>Analysis lab <span>Earth Engine-style workflows · Sentinel-2 · Open-Meteo · SoilGrids</span></h2></div>
    <div className="ge-tabs" role="tablist">{TABS.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><Icon size={15}/>{label}</button>)}</div>
    <div className="ge-body" key={`${tab}:${farm.id}`}>
      {tab === 'map' && <MapTab farm={farm} scene={scene}/>}
      {tab === 'plan' && <PlanTab farm={farm}/>}
      {tab === 'change' && <ChangeTab farm={farm}/>}
      {tab === 'film' && <Timelapse farm={farm}/>}
      {tab === 'pest' && <PestTab farm={farm} scene={scene}/>}
      {tab === 'ai' && <Studio farm={farm} scene={scene}/>}
    </div>
  </section>
}
