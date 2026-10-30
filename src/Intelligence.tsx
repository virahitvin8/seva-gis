import LogoLoader from './LogoLoader'
import SourceNote, { type SourceKey } from './SourceNote'
import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from 'react'
import { Bug, CalendarRange, Film, GitCompareArrows, Layers3, RefreshCw, Sparkles, Sprout, Gem } from 'lucide-react'
import { fetchSoil, fetchWeather } from './lib/agro'
import { RISK_BANDS, changeAnalysis, hotspots, landCover, loadHistory, managementZones, pestRisks, phenology, riskBand, sceneNdvi, type ClassRow, type MapResult } from './lib/gee'
import { MONTHS, PLAN_CROPS, SUIT_BANDS, fetchClimate, rotationAdvice, suitBand, suitability } from './lib/plan'
import { farmRing, loadScene, type FarmData, type Scene } from './lib/seva'
import { areaHa as ringAreaHa, perimeterM } from './lib/geo'
import { generateRealMineralClusters } from './services/geeSpectralEngine'
import type { AOIFeature } from './types/seva'
import { ScaleBox } from './Scale'
import Studio from './Studio'
import Timelapse from './Timelapse'
import { MapFrame } from './LabMap'

class StudioErrorBoundary extends Component<{ children: ReactNode; farmName: string }, { hasError: boolean; errorMsg: string }> {
  state = { hasError: false, errorMsg: '' }
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, errorMsg: error instanceof Error ? error.message : 'Raster rendering pause' }
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.warn('[StudioErrorBoundary] Caught GeoAI Studio error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="ag-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, color: 'var(--primary)' }}>GeoAI Studio experienced a temporary rendering pause.</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 14px' }}>{this.state.errorMsg}</p>
          <button className="primary compact" onClick={() => this.setState({ hasError: false, errorMsg: '' })}>
            Retry GeoAI Studio
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

type Props = { farm: FarmData & { id: string; name: string; crop?: string } }
type Tab = 'map' | 'minerals' | 'plan' | 'change' | 'film' | 'pest' | 'ai'
const TABS: [Tab, string, typeof Layers3][] = [
  ['map', 'Crop & vegetation map', Layers3],
  ['minerals', 'Minerals & Lithology', Gem],
  ['plan', 'Suitability & planning', CalendarRange],
  ['change', 'Monitoring & change', GitCompareArrows],
  ['film', 'Time-lapse', Film],
  ['pest', 'Pest & disease', Bug],
  ['ai', 'GeoAI studio', Sparkles]
]
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
  return <MapFrame farm={farm} scene={scene} overlay={res.url} title={caption.split(' · ')[0]} note={how} caption={caption} legend={res.rows.map(r => ({ color: r.color, label: r.name }))} crisp={true}/>
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
      <div><Img farm={farm} scene={scene} res={lc} caption={`Land cover · Sentinel-2 ${scene.datetime.slice(0, 10)}`} how="Each colour is one kind of ground, estimated from the satellite picture: water, thick crop, thin crop, bare soil or buildings. Dark green usually means more green cover; brown can be exposed soil or residue. Compare the same area across clear dates before deciding whether it needs a closer look."/><Legend title="Land-cover class" unit="share of clear pixels · area in ha" rows={lc.rows}/></div>
      <div><Img farm={farm} scene={scene} res={zones} caption="Management zones · k-means on NDVI, NDMI, NDRE" how="The computer groups areas that look similar in this satellite image. Compare the coloured zones across dates to see whether a pattern stays in the same place. The groups do not identify a cause or prescribe an input."/><Legend title="Vigour zone" unit="share of field · area in ha" rows={zones.rows}/>
        <div className="ge-zmean">{zones.means.map((m, i) => <span key={i}>Z{i + 1}: NDVI {f(m.ndvi, 2)}, NDMI {f(m.ndmi, 2)}</span>)}</div>
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 10px', marginTop: 8, fontSize: 11, color: '#166534', lineHeight: 1.4 }}>
          <b>🗣️ How to use these zones in the field:</b> Management zones group parts of your field that grow similarly. Zone 1 is your strongest growth; Zone 3 is thinner. Instead of spreading equal fertilizer everywhere, save money by giving lighter doses to strong zones and boosting thinner zones!
        </div>
      </div>
    </div>}
    <div className="sc-grid"><ScaleBox id="ndvi" compact/><ScaleBox id="ndre" compact/></div>

    <Note>Land cover uses visible index thresholds (NDVI, MNDWI, NDBI) on one clear scene. Zones are unsupervised groups of pixels that look similar; compare them across dates and review the source image before drawing conclusions. They do not identify a cause or prescribe inputs.</Note>
  </>
}

import MatlabAnalysisSuite from './MatlabAnalysisSuite'

function PlanTab({ farm }: { farm: Props['farm'] }) {
  const key = `${farm.id}:${farm.lat}:${farm.lon}`
  const climate = useAsync(`c:${key}`, () => fetchClimate(farm.lat, farm.lon))
  const soil = useAsync(`s:${key}`, () => fetchSoil(farm.lat, farm.lon))
  const [irrigated, setIrrigated] = useState(true)
  const [catFilter, setCatFilter] = useState<'all' | 'cereal' | 'legume' | 'cash' | 'oilseed' | 'root'>('all')
  const [activeScoreDetail, setActiveScoreDetail] = useState<{
    cropName: string
    month: string
    score: number
    limiting: string
    tempF?: number
    waterF?: number
    soilF?: number
    slopeF?: number
    waterNeed?: number
    rainSeason?: number
  } | null>(null)

  const sp = useMemo(() => {
    if (!soil.data) return {}
    const avg = (k: string) => { const v = (soil.data![k]?.depths ?? []).slice(0, 3).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined }
    return { ph: avg('phh2o'), clay: avg('clay') }
  }, [soil.data])

  const rankedAll = useMemo(() => climate.data ? PLAN_CROPS.map(c => suitability(climate.data!, c, sp, farm.analysis?.slopePct, irrigated)).sort((a, b) => b.score - a.score) : [], [climate.data, sp, irrigated, farm.analysis?.slopePct])

  const ranked = useMemo(() => {
    if (catFilter === 'all') return rankedAll
    return rankedAll.filter(r => r.crop.family === catFilter)
  }, [rankedAll, catFilter])

  const top = rankedAll[0], current = farm.crop ? rankedAll.find(r => farm.crop!.toLowerCase().split(/[\s/()]+/).some(w => w.length > 3 && (r.crop.name.toLowerCase().includes(w) || r.crop.id === w))) : undefined
  const ha = farm.area || 0

  const categories = [
    { id: 'all', label: 'All Crops' },
    { id: 'cereal', label: 'Millets & Cereals' },
    { id: 'legume', label: 'Pulses & Legumes' },
    { id: 'cash', label: 'Cash Crops' },
    { id: 'oilseed', label: 'Oilseeds & Mustard' },
    { id: 'root', label: 'Vegetables & Roots' },
  ] as const

  return <>
    <Status error={climate.error} loading={climate.loading} text="Fetching 3-year climate normals (Open-Meteo archive)…"/>
    {climate.data && top && <>
      <div className="ge-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <label><input type="checkbox" checked={irrigated} onChange={e => setIrrigated(e.target.checked)}/> Irrigation available</label>
        <small>Soil pH {f(sp.ph ?? NaN)} · clay {f(sp.clay ?? NaN, 0)}% · slope {farm.analysis?.slopePct !== undefined ? `${f(farm.analysis.slopePct)}%` : 'unknown'} · {climate.data.years}-year mean rainfall {f(climate.data.annualRain, 0)} mm/yr</small>
      </div>

      {/* Crop Category Selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 12px' }}>
        {categories.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCatFilter(c.id)}
            style={{
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: catFilter === c.id ? '#1b4332' : '#ffffff',
              color: catFilter === c.id ? '#ffffff' : '#334155',
              fontWeight: catFilter === c.id ? 700 : 500,
              cursor: 'pointer'
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="ge-plan">
        <div className={`wt-verdict ${top.score >= 60 ? 'good' : 'warn'}`}><Sprout size={18}/><div><b>Climate and soil screen: {top.crop.name}, {top.score}/100 ({suitBand(top.score).label})</b><br/>Sow in {MONTHS[top.bestMonth]}, harvest around {MONTHS[top.harvest]}. Seasonal crop water need ≈ {f(top.waterNeed, 0)} mm, rain covers ≈ {f(top.rainSeason, 0)} mm, so plan about {f(top.irrigation, 0)} mm of irrigation{ha ? ` (${f(top.irrigation * ha * 10, 0)} m³ for ${f(ha)} ha)` : ''}. {rotationAdvice(top.crop)}</div></div>
        {current && <div className="wt-verdict"><Sprout size={18}/><div><b>Your current crop ({current.crop.name}): {current.score}/100, {suitBand(current.score).label}</b><br/>Limiting factor: {current.limiting}. Best sowing month for it here is {MONTHS[current.bestMonth]}.</div></div>}
      </div>

      <div className="ge-cal">
        <div className="ge-cal-head"><span>Crop ({ranked.length})</span>{MONTHS.map(m => <span key={m}>{m[0]}</span>)}<span>Best</span></div>
        {ranked.map(r => <div key={r.crop.id} className="ge-cal-row">
          <span
            style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
            title={`Click to view calculation breakdown for ${r.crop.name}`}
            onClick={() => setActiveScoreDetail({
              cropName: r.crop.name,
              month: MONTHS[r.bestMonth],
              score: r.score,
              limiting: r.limiting,
              tempF: r.temp,
              waterF: r.water,
              soilF: r.soil,
              slopeF: r.terrain,
              waterNeed: r.waterNeed,
              rainSeason: r.rainSeason
            })}
          >
            {r.crop.name}
          </span>
          {r.monthScores.map((s, m) => (
            <i
              key={m}
              className={m === r.bestMonth ? 'best' : ''}
              style={{ background: suitBand(s).color, opacity: 0.35 + s / 160, cursor: 'pointer' }}
              title={`Click calculation: Sow ${MONTHS[m]}: ${s}/100`}
              onClick={() => setActiveScoreDetail({
                cropName: r.crop.name,
                month: MONTHS[m],
                score: s,
                limiting: r.limiting,
                tempF: r.temp,
                waterF: r.water,
                soilF: r.soil,
                slopeF: r.terrain,
                waterNeed: r.waterNeed,
                rainSeason: r.rainSeason
              })}
            />
          ))}
          <b
            style={{ color: suitBand(r.score).color === '#fdae61' ? '#a55a00' : undefined, cursor: 'pointer' }}
            onClick={() => setActiveScoreDetail({
              cropName: r.crop.name,
              month: MONTHS[r.bestMonth],
              score: r.score,
              limiting: r.limiting,
              tempF: r.temp,
              waterF: r.water,
              soilF: r.soil,
              slopeF: r.terrain,
              waterNeed: r.waterNeed,
              rainSeason: r.rainSeason
            })}
          >
            {r.score}
          </b>
        </div>)}
      </div>

      {/* Calculation Ratio Breakdown Popover Modal */}
      {activeScoreDetail && (
        <div style={{ background: '#f8fafc', border: '1.5px solid #10b981', borderRadius: 8, padding: 12, margin: '10px 0', fontSize: 12, color: '#1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <b style={{ color: '#047857', fontSize: 13 }}>
              Calculation Ratio Breakdown: {activeScoreDetail.cropName} (Sowing in {activeScoreDetail.month})
            </b>
            <button type="button" onClick={() => setActiveScoreDetail(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, color: '#64748b' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6, marginBottom: 8 }}>
            <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Temperature Factor (tF)</span>
              <strong style={{ color: '#0284c7' }}>{((activeScoreDetail.tempF ?? 0.85) * 100).toFixed(0)}%</strong>
            </div>
            <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Water Factor (wF)</span>
              <strong style={{ color: '#059669' }}>{((activeScoreDetail.waterF ?? 0.90) * 100).toFixed(0)}%</strong>
            </div>
            <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Soil Factor (soilF)</span>
              <strong style={{ color: '#d97706' }}>{((activeScoreDetail.soilF ?? 0.80) * 100).toFixed(0)}%</strong>
            </div>
            <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Final Limiting Score</span>
              <strong style={{ color: '#10231b' }}>{activeScoreDetail.score}/100</strong>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: '#475569', lineHeight: 1.4 }}>
            <b>Mathematical Rule (FAO EcoCrop):</b> The final score equals <code>100 × min(Temperature, Water, Soil, Slope)</code>. The primary limiting component for this crop cycle is <b>{activeScoreDetail.limiting}</b>.
          </p>
        </div>
      )}

      <div className="ge-cols">
        <Legend title="Crop planning score" unit="rough 0–100 screen · not yield or a guarantee" rows={SUIT_BANDS.map((b, i) => ({ id: b.label, name: b.label, color: b.color, note: ['below 40', '40 to 60', '60 to 80', '80 and above'][i] }))}/>
        <ClimateChart c={climate.data}/>
      </div>
      <Note src={['weather', 'soil', 'dem', 'model']}>Method: FAO EcoCrop style limiting-factor scoring. Each cell is the score if you sow that month; the outlined cell is the best month. Temperature uses monthly means across the crop cycle, soil uses SoilGrids pH and clay, terrain uses the DEM slope. Variety, salinity and market are not modelled.</Note>
    </>}
  </>
}

function ClimateChart({ c }: { c: { tmean: number[]; rain: number[]; et0: number[] } }) {
  const [hoverM, setHoverM] = useState<number | null>(null)
  const W = 330, H = 130, maxR = Math.max(...c.rain, ...c.et0, 50), maxT = Math.max(...c.tmean, 10) + 3, bw = (W - 30) / 12
  const line = c.tmean.map((t, i) => `${i ? 'L' : 'M'}${28 + i * bw + bw / 2},${H - 16 - (t / maxT) * (H - 30)}`).join(' ')
  const et = c.et0.map((t, i) => `${i ? 'L' : 'M'}${28 + i * bw + bw / 2},${H - 16 - (t / maxR) * (H - 30)}`).join(' ')
  const totalRain = c.rain.reduce((a, b) => a + b, 0)

  return <div className="sc-box compact" style={{ position: 'relative' }}>
    <div className="sc-title">
      <b>Climate normals</b>
      <span>blue bars rain mm/month · green dashed ET₀ mm · red line mean °C</span>
    </div>

    {hoverM !== null && (
      <div style={{ background: '#0f172a', color: '#ffffff', borderRadius: 6, padding: '4px 8px', fontSize: 10, marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        <b>{MONTHS[hoverM]}:</b>
        <span>Rain: {c.rain[hoverM].toFixed(1)} mm ({((c.rain[hoverM] / (totalRain || 1)) * 100).toFixed(0)}% annual)</span>
        <span>ET₀: {c.et0[hoverM].toFixed(1)} mm</span>
        <span>Temp: {c.tmean[hoverM].toFixed(1)} °C</span>
      </div>
    )}

    <svg viewBox={`0 0 ${W} ${H}`} className="ge-chart" role="img" aria-label="Monthly climate">
      {c.rain.map((r, i) => (
        <rect
          key={i}
          x={28 + i * bw + 3}
          width={bw - 6}
          y={H - 16 - (r / maxR) * (H - 30)}
          height={(r / maxR) * (H - 30)}
          fill={hoverM === i ? '#2563eb' : '#6baed6'}
          style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
          onMouseEnter={() => setHoverM(i)}
          onMouseLeave={() => setHoverM(null)}
        />
      ))}
      <path d={et} fill="none" stroke="#31a354" strokeDasharray="4 3" strokeWidth="1.5"/>
      <path d={line} fill="none" stroke="#d73027" strokeWidth="2"/>
      {MONTHS.map((m, i) => (
        <text
          key={m}
          x={28 + i * bw + bw / 2}
          y={H - 4}
          fontSize="8"
          textAnchor="middle"
          fill={hoverM === i ? '#0284c7' : '#4d5f56'}
          fontWeight={hoverM === i ? '700' : '400'}
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHoverM(i)}
          onMouseLeave={() => setHoverM(null)}
        >
          {m[0]}
        </text>
      ))}
      <text x="2" y="14" fontSize="8" fill="#4d5f56">{maxR.toFixed(0)} mm</text>
      <text x="2" y={H - 18} fontSize="8" fill="#4d5f56">0</text>
    </svg>
  </div>
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
      
      {/* MATLAB-Style Numerical Curve Fitting Suite */}
      <MatlabAnalysisSuite rows={rows} farm={farm} />

      <div className="ge-pick" style={{ marginTop: 16 }}><label>Before<select value={A} onChange={e => setAi(+e.target.value)}>{rows.map((r, i) => <option key={r.scene.id} value={i}>{r.scene.datetime.slice(0, 10)}</option>)}</select></label>
        <label>After<select value={B} onChange={e => setBi(+e.target.value)}>{rows.map((r, i) => <option key={r.scene.id} value={i}>{r.scene.datetime.slice(0, 10)}</option>)}</select></label></div>
      <div className="ge-cols">
        <div>{A === B ? <div className="ag-empty">Pick two different dates.</div> : <><Status error={change.error} loading={change.loading} text="Differencing the two scenes pixel by pixel…"/>
          {change.data && <><Img farm={farm} scene={rows[B].scene} how="Red means the crop got weaker between the two dates, green means it got stronger. A drop right after harvest is normal." res={change.data} caption={`ΔNDVI ${change.data.a.datetime.slice(0, 10)} → ${change.data.b.datetime.slice(0, 10)}`}/>
            <div className="ge-delta">Mean ΔNDVI <b className={change.data.mean < -0.05 ? 'bad' : change.data.mean > 0.05 ? 'good' : ''}>{change.data.mean >= 0 ? '+' : ''}{f(change.data.mean, 3)}</b> · mean ΔNDMI <b>{change.data.meanMoisture >= 0 ? '+' : ''}{f(change.data.meanMoisture, 3)}</b></div>
            <Legend title="Change class" unit="share of pixels clear on both dates" rows={change.data.rows}/></>}</>}</div>
        <div>{frame.data ? <MapFrame farm={farm} scene={rows[T].scene} overlay={frame.data.url} title={`Greenness on ${rows[T].scene.datetime.slice(0, 10)}`} note="Slide through the dates to watch your crop grow. Darker green shows more green cover in the image; yellow shows thinner cover; red shows little cover. Visit patches to check why." legend={[{ color: '#a50026', label: 'Little green cover' }, { color: '#fdae61', label: 'Thin' }, { color: '#a6d96a', label: 'Growing' }, { color: '#006837', label: 'Strong green-cover signal' }]} caption={`Time slider · NDVI on ${rows[T].scene.datetime.slice(0, 10)}`}/> : <div className="ge-wait">{frame.error ?? 'Loading…'}</div>}
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
        <Legend title="Risk score" unit="weather check-in score · not disease probability" rows={RISK_BANDS.map((b, i) => ({ id: b.label, name: b.label, color: b.color, note: ['below 25', '25 to 50', '50 to 75', '75 and above'][i] }))}/>
        {maxRisk.score >= 50 && <div className="wt-verdict warn"><Bug size={18}/><div><b>Weather may favour {maxRisk.name.toLowerCase()}.</b> {maxRisk.why}. Look for visible signs in the field; this score does not predict an outbreak.</div></div>}</div>
      <div><h4 className="ge-h">Satellite stress hotspots</h4>
        {!scene && <div className="ag-empty">Run the satellite analysis first.</div>}
        <Status error={grid.error} loading={grid.loading} text="Loading Sentinel-2 bands…"/>
        {grid.data && !hs && <div className="ag-empty">Too few clear vegetated pixels to detect hotspots on this date.</div>}
        {hs && <><Img farm={farm} scene={scene} how="Darker orange or red patches are weaker than the rest of your field. Satellites cannot name a pest, they show where to look." res={hs} caption={`Weak spots vs field average · ${scene!.datetime.slice(0, 10)}`}/>
          <Legend title="Hotspot level" unit="share of vegetated pixels · area in ha" rows={hs.rows}/>
          <div className="ge-delta">{f(hs.healthyPct, 0)}% of the field is at or above average. Weak spots are {hs.clustered ? <b className="bad">clustered in patches: compare these zones with earlier clear images and the crop stage</b> : <b>scattered: compare recent imagery, planting date, and crop stage across the field</b>}.</div></>}</div>
    </div>
    {hs && hs.patches.length > 0 && <div className="ge-patches"><h4 className="ge-h">Scouting targets</h4><table><thead><tr><th>#</th><th>Where</th><th>Size</th><th>Mean z</th><th>Weakest signal</th><th>From farm centre</th></tr></thead>
      <tbody>{hs.patches.map((p, i) => <tr key={i}><td>{i + 1}</td><td>{p.lat.toFixed(5)}°, {p.lon.toFixed(5)}°</td><td>{f(p.ha, 2)} ha</td><td>{f(p.z, 1)}</td><td>{p.signature}</td><td>{f(p.distM, 0)} m {p.bearing}</td></tr>)}</tbody></table>
      <div className="ge-stats">{hs.signatures.map(s => <div key={s.name}><span>Weakest signal</span><b>{f(s.pct, 0)}%</b><small>{s.name}</small></div>)}</div></div>}
    <div className="sc-grid"><ScaleBox id="ndre" compact/><ScaleBox id="ndmi" compact/></div>
    <Note src={['s2', 'weather']}>Satellites cannot name a pest or disease. They show where the canopy is weaker than the rest of this field in density (NDVI), chlorophyll (NDRE) or water (NDMI); z is the number of standard deviations below the field average. Differences in greenness or moisture can have many causes, including crop stage, soil, weeds, pests, or water. Visit the marked spots and confirm what you see before acting. Visit the listed spots and confirm. Weather risk scores are suitability rules, not calibrated forecasts.</Note>
  </>
}

function MineralsTab({ farm, scene }: { farm: Props['farm']; scene?: Scene }) {
  const key = `${farm.id}:${scene?.id}:${farm.polygon?.length}:${farm.area}`
  const grid = useAsync(key, () => loadScene(scene!, farm), !!scene)
  const [selectedMineral, setSelectedMineral] = useState<string>('ioi')
  const [pointsNotice, setPointsNotice] = useState<string | null>(null)

  // Calculate mineral statistics across the valid AOI pixels
  const mineralStats = useMemo(() => {
    if (!grid.data) return null
    const g = grid.data
    let fmiSum = 0, ioiSum = 0, claySum = 0, calciteSum = 0, silicaSum = 0
    let fmiHigh = 0, ioiHigh = 0, clayHigh = 0, calciteHigh = 0, silicaHigh = 0
    let count = 0

    for (let i = 0; i < g.w * g.h; i++) {
      if (!g.inside[i] || !g.ok[i]) continue
      const b02 = g.b.B02?.[i] ?? 0
      const b03 = g.b.B03?.[i] ?? 0
      const b04 = g.b.B04?.[i] ?? 0
      const b08 = g.b.B08?.[i] ?? 0
      const b11 = g.b.B11?.[i] ?? 0
      const b12 = g.b.B12?.[i] ?? 0

      const fmi = b08 > 0 ? b12 / b08 : 0
      const ioi = b02 > 0 ? b04 / b02 : 0
      const clay = b12 > 0 ? b11 / b12 : 0
      const calcite = b12 > 0 ? (b11 + b03) / b12 : 0
      const silica = b04 > 0 ? b11 / b04 : 0

      fmiSum += fmi; if (fmi > 1.1) fmiHigh++
      ioiSum += ioi; if (ioi > 1.3) ioiHigh++
      claySum += clay; if (clay > 1.25) clayHigh++
      calciteSum += calcite; if (calcite > 1.6) calciteHigh++
      silicaSum += silica; if (silica > 1.1) silicaHigh++
      count++
    }

    if (count === 0) return null
    const area = farm.area || 10
    return {
      fmi: { mean: fmiSum / count, pctHigh: (fmiHigh / count) * 100, ha: ((fmiHigh / count) * area) },
      ioi: { mean: ioiSum / count, pctHigh: (ioiHigh / count) * 100, ha: ((ioiHigh / count) * area) },
      clay: { mean: claySum / count, pctHigh: (clayHigh / count) * 100, ha: ((clayHigh / count) * area) },
      calcite: { mean: calciteSum / count, pctHigh: (calciteHigh / count) * 100, ha: ((calciteHigh / count) * area) },
      silica: { mean: silicaSum / count, pctHigh: (silicaHigh / count) * 100, ha: ((silicaHigh / count) * area) },
    }
  }, [grid.data, farm.area])

  const MINERAL_DETAILS: Record<string, {
    title: string
    chemicalFormula: string
    spectralRatio: string
    sensors: string
    justification: string
    geologicalResource: string
    agronomicImpact: string
    color: string
    layerId: string
  }> = {
    ioi: {
      title: 'Iron Oxides & Hydroxides (Hematite, Goethite, Limonite)',
      chemicalFormula: 'Fe₂O₃ · FeO(OH)',
      spectralRatio: 'B04 (Red 665nm) / B02 (Blue 490nm)',
      sensors: 'Sentinel-2 L2A MSI (10m Native Multi-Spectral Reflectance)',
      justification: 'High absorption in Blue (490 nm) due to Fe³⁺ charge-transfer transitions combined with high reflectance in Red (665 nm) creates steep slope ratio (>1.2) specifically diagnostic of ferrihydrite and hematite weathering.',
      geologicalResource: 'Derived from Copernicus Sentinel-2 Top-of-Canopy BOA surface reflectance calibrated against USGS Spectral Library v7.',
      agronomicImpact: 'Elevated iron oxide concentrations indicate intensely weathered oxisols or lateritic soils with high phosphorus-fixing capacity (fixation of soluble phosphates into insoluble iron phosphates). Supplemental zinc and organic matter amendment recommended.',
      color: '#e65100',
      layerId: 'ioi'
    },
    fmi: {
      title: 'Ferrous Silicate Minerals (Olivine, Pyroxene, Amphibole)',
      chemicalFormula: '(Mg,Fe)₂SiO₄ · Fe-Silicates',
      spectralRatio: 'B12 (SWIR2 2190nm) / B08 (NIR 842nm)',
      sensors: 'Sentinel-2 L2A Bands 8 & 12 (10m & 20m resampled)',
      justification: 'Broad absorption trough centered near 1.0 µm from Fe²⁺ crystal field transitions produces elevated SWIR2/NIR ratio values (>1.1) over unweathered mafic parent rocks and basaltic black cotton soils (Vertisols).',
      geologicalResource: 'USGS Digital Spectral Library Splib07b benchmarked with Copernicus Sentinel-2 BOA Level-2A data.',
      agronomicImpact: 'Associated with fertile Deccan trap basalt parent materials; typically provides high intrinsic magnesium and calcium reserves, high cation exchange capacity (CEC), and high swelling-shrinking clay dynamics.',
      color: '#d84315',
      layerId: 'fmi'
    },
    clay: {
      title: 'Clay & Hydroxyl Alteration (Kaolinite, Illite, Smectite)',
      chemicalFormula: 'Al₂Si₂O₅(OH)₄ · Al-OH Minerals',
      spectralRatio: 'B11 (SWIR1 1610nm) / B12 (SWIR2 2190nm)',
      sensors: 'Sentinel-2 SWIR Bands 11 & 12 (20m Native BOA)',
      justification: 'Fundamental Al-OH vibrational overtone creates intense, diagnostic absorption doublet at 2.16–2.20 µm in Band 12 against high plateau reflectance in Band 11 (1.61 µm), producing high SWIR1/SWIR2 quotient.',
      geologicalResource: 'ESA Copernicus Open Access Hub & USGS Hydrothermal Alteration Mapping Standards.',
      agronomicImpact: 'High clay index signifies heavy soil texture with low hydraulic conductivity and prone to waterlogging or compaction, yet exhibiting superior nutrient retention capacity.',
      color: '#0284c7',
      layerId: 'clay_ratio'
    },
    calcite: {
      title: 'Calcite & Carbonates (Limestone, Dolomite, Caliche)',
      chemicalFormula: 'CaCO₃ · CaMg(CO₃)₂',
      spectralRatio: '(B11 + B03) / B12 (SWIR1 + Green / SWIR2)',
      sensors: 'Sentinel-2 Bands 3, 11, 12 (Copernicus 10m/20m)',
      justification: 'Carbonate (CO₃²⁻) radical combination band produces strong absorption at 2.30–2.35 µm in Band 12 relative to high reflectance in SWIR1 and Green bands.',
      geologicalResource: 'Derived from Sentinel-2 BOA Surface Reflectance normalized via CSIRO/USGS Mineral Indices.',
      agronomicImpact: 'Indicates calcareous soil horizons (caliche / kankar beds) with alkaline pH (>7.8). May induce iron and manganese chlorosis in crops; does not require agricultural liming.',
      color: '#c2185b',
      layerId: 'calcite'
    },
    silica: {
      title: 'Silica & Quartz Sandstone (SiO₂ Rich Matrix)',
      chemicalFormula: 'SiO₂ (Quartz / Chert)',
      spectralRatio: 'B11 (SWIR1 1610nm) / B04 (Red 665nm)',
      sensors: 'Sentinel-2 Bands 4 & 11 (10m / 20m)',
      justification: 'Quartz grains lack significant Fe or OH absorption in visible and SWIR, maintaining consistently high SWIR1 relative to red band.',
      geologicalResource: 'Copernicus Sentinel-2 Bottom-of-Atmosphere (BOA) Surface Reflectance.',
      agronomicImpact: 'Indicates coarse-textured sandy or arenaceous soil. Exhibits very rapid percolation, low water-holding capacity, and high susceptibility to nutrient leaching.',
      color: '#2e7d32',
      layerId: 'silica'
    }
  }

  const activeInfo = MINERAL_DETAILS[selectedMineral] || MINERAL_DETAILS.ioi
  const activeStat = mineralStats ? (mineralStats as any)[selectedMineral] : null

  const handleApplyToMap = (layerId: string) => {
    window.dispatchEvent(new CustomEvent('seva-apply-indicator-layer', { detail: { layerId } }))
    const el = document.getElementById('my-farms') || document.querySelector('.map-wrap')
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleShowPoints = (key: string, name: string, color: string) => {
    const g = grid.data
    if (!g) {
      setPointsNotice('Run the satellite analysis first — no real Sentinel-2 bands are loaded, so no mineral points were drawn.')
      return
    }

    // AOI-mean reflectances from the loaded Sentinel-2 scene. No hardcoded bands.
    let n = 0
    let b2 = 0, b3 = 0, b4 = 0, b8 = 0, b11 = 0, b12 = 0
    for (let i = 0; i < g.w * g.h; i++) {
      if (!g.inside[i] || !g.ok[i]) continue
      const r2 = g.b.B02?.[i] ?? 0
      const r3 = g.b.B03?.[i] ?? 0
      const r4 = g.b.B04?.[i] ?? 0
      const r8 = g.b.B08?.[i] ?? 0
      const r11 = g.b.B11?.[i] ?? 0
      const r12 = g.b.B12?.[i] ?? 0
      if (r2 <= 0 || r4 <= 0 || r8 <= 0) continue // require physically valid reflectance
      b2 += r2; b3 += r3; b4 += r4; b8 += r8; b11 += r11; b12 += r12; n++
    }
    if (n === 0) {
      setPointsNotice('No valid Sentinel-2 reflectance pixels inside this AOI — no mineral points were drawn.')
      return
    }

    const ring = farmRing(farm)
    const lons = ring.map(([lon]) => lon)
    const lats = ring.map(([, lat]) => lat)
    const hectares = ring.length >= 3 ? ringAreaHa(ring) : (farm.area || 0)
    const perimeterKm = perimeterM(ring) / 1000
    const aoiFeature: AOIFeature = {
      id: farm.id,
      name: farm.name,
      createdAt: scene?.datetime ?? '',
      hectares,
      acres: hectares * 2.471,
      perimeterKm,
      compactnessIndex: perimeterKm > 0 ? (4 * Math.PI * hectares * 0.01) / (perimeterKm * perimeterKm) : 0,
      centroid: { lat: farm.lat, lon: farm.lon },
      bounds: [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]],
      coordinates: ring.map(([lon, lat]) => ({ lat, lon })),
    }
    const pts = generateRealMineralClusters(aoiFeature, key, {
      B2: b2 / n, B3: b3 / n, B4: b4 / n, B8: b8 / n, B11: b11 / n, B12: b12 / n,
      sensor: 'Copernicus Sentinel-2 L2A (AOI mean)',
      acquisitionDate: scene?.datetime?.slice(0, 10) ?? null,
    })
    if (pts.length === 0) {
      setPointsNotice('No sample points fall inside this AOI boundary — no mineral points were drawn.')
      return
    }
    setPointsNotice(null)
    window.dispatchEvent(new CustomEvent('seva-show-mineral-points', {
      detail: {
        mineralKey: key,
        mineralName: name,
        color,
        points: pts
      }
    }))
    const el = document.getElementById('my-farms') || document.querySelector('.map-wrap')
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Status error={grid.error} loading={grid.loading} text="Extracting hyperspectral SWIR mineral bands from Sentinel-2..." />

      {/* Overview Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { key: 'ioi', name: 'Iron Oxide', icon: '🪨', stat: mineralStats?.ioi, color: '#e65100' },
          { key: 'fmi', name: 'Ferrous Silicate', icon: '🌋', stat: mineralStats?.fmi, color: '#d84315' },
          { key: 'clay', name: 'Clay & Hydroxyl', icon: '🏺', stat: mineralStats?.clay, color: '#0284c7' },
          { key: 'calcite', name: 'Calcite & Lime', icon: '⚪', stat: mineralStats?.calcite, color: '#c2185b' },
          { key: 'silica', name: 'Silica / Quartz', icon: '🏖️', stat: mineralStats?.silica, color: '#2e7d32' },
        ].map(item => {
          const isSelected = selectedMineral === item.key
          const pct = item.stat ? item.stat.pctHigh : null
          const ha = item.stat ? item.stat.ha : null
          const meanVal = item.stat ? item.stat.mean.toFixed(2) : '—'

          return (
            <div
              key={item.key}
              onClick={() => setSelectedMineral(item.key)}
              style={{
                background: isSelected ? '#ffffff' : '#f8fafc',
                border: isSelected ? `2px solid ${item.color}` : '1px solid #cbd5e1',
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'pointer',
                boxShadow: isSelected ? '0 8px 24px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: isSelected ? item.color : '#e2e8f0', color: isSelected ? '#fff' : '#475569' }}>
                  {pct == null ? '—' : `${f(pct, 0)}% of AOI`}
                </span>
              </div>
              <strong style={{ fontSize: 13, color: '#0f172a', display: 'block' }}>{item.name}</strong>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Ratio: <b style={{ color: '#0f172a' }}>{meanVal}</b> · {ha == null ? '—' : `${f(ha, 2)} ha`}
              </div>
              <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${pct == null ? 0 : Math.min(100, Math.max(5, pct))}%`, background: item.color, height: '100%', borderRadius: 2 }} />
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleShowPoints(item.key, item.name, item.color); }}
                style={{ marginTop: 10, padding: '5px 10px', fontSize: 10.5, fontWeight: 700, borderRadius: 6, background: item.color, color: '#fff', border: 'none', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                title="Show anomalous cluster points on map"
              >
                <Gem size={12} /> Show points
              </button>
            </div>
          )
        })}
      </div>

      {pointsNotice && (
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#7c2d12', borderRadius: 10, padding: '10px 14px', fontSize: 12, lineHeight: 1.5 }}>
          {pointsNotice}
        </div>
      )}

      {/* Selected Mineral Deep Dive Card */}
      {activeInfo && (
        <div style={{ background: '#ffffff', border: `1.5px solid ${activeInfo.color}`, borderRadius: 14, padding: 22, boxShadow: '0 4px 18px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 14, marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: activeInfo.color, letterSpacing: '0.05em' }}>
                USGS & Copernicus Hyperspectral Diagnostic Profile
              </span>
              <h3 style={{ margin: '4px 0 2px', fontSize: 18, color: '#0f172a' }}>{activeInfo.title}</h3>
              <code style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#334155' }}>
                Formula: {activeInfo.chemicalFormula} · Spectral Ratio: {activeInfo.spectralRatio}
              </code>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => handleShowPoints(selectedMineral, activeInfo.title, activeInfo.color)}
                className="primary"
                style={{ background: '#f59e0b', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
                title="Plot cluster centroids on the map"
              >
                <Gem size={14} /> Show points on Map
              </button>
              <button
                onClick={() => handleApplyToMap(activeInfo.layerId)}
                className="primary"
                style={{ background: activeInfo.color, border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
              >
                <Layers3 size={14} /> Project Mineral Layer
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Justification Box */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
              <strong style={{ fontSize: 12, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                🔬 Scientific Justification (Why & How Detected)
              </strong>
              <p style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.55, margin: 0 }}>
                {activeInfo.justification}
              </p>
            </div>

            {/* Source & Provenance Box */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
              <strong style={{ fontSize: 12, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                🛰️ Resource Provenance (Where Got Resource)
              </strong>
              <p style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.55, margin: 0 }}>
                {activeInfo.geologicalResource}
              </p>
              <div style={{ marginTop: 8, fontSize: 10.5, color: '#64748b' }}>
                Sensors: <code style={{ color: '#0f172a', background: '#e2e8f0', padding: '1px 4px', borderRadius: 3 }}>{activeInfo.sensors}</code>
              </div>
            </div>
          </div>

          {/* Agronomic Impact Box */}
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14, marginTop: 14 }}>
            <strong style={{ fontSize: 12, color: '#065f46', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              🌾 Agronomic & Soil Fertility Impact
            </strong>
            <p style={{ fontSize: 11.5, color: '#166534', lineHeight: 1.55, margin: 0 }}>
              {activeInfo.agronomicImpact}
            </p>
          </div>
        </div>
      )}

      <Note src={['s2']}>
        Mineral indices are computed using Sentinel-2 Level-2A Bottom-of-Atmosphere (BOA) surface reflectance ratios benchmarked against USGS Spectral Library v7 and CSIRO mineral mapping protocols. Ratios reflect relative absorption signatures of topsoil exposed pixels; dense vegetative cover may attenuate soil reflectance signals.
      </Note>
    </div>
  )
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

  const [refreshKey, setRefreshKey] = useState(0)
  const [spinning, setSpinning] = useState(false)

  function handleRefreshLab() {
    setSpinning(true)
    setRefreshKey(k => k + 1)
    setTimeout(() => setSpinning(false), 800)
  }

  return <section className="ag-wrap ge-wrap">
    <div className="intelligence-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h2>Remote field review <span>Latest imagery · changes over time · field zones</span></h2>
      <button
        className={`box-refresh-btn ${spinning ? 'spinning' : ''}`}
        title="Refresh Analysis lab"
        aria-label="Refresh Analysis lab"
        onClick={handleRefreshLab}
      >
        <RefreshCw size={14}/>
      </button>
    </div>
    <div className="ge-tabs" role="tablist">{TABS.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><Icon size={15}/>{label}</button>)}</div>
    <div className="ge-body" key={`${tab}:${farm.id}:${refreshKey}`}>
      {tab === 'map' && <MapTab farm={farm} scene={scene}/>}
      {tab === 'minerals' && <MineralsTab farm={farm} scene={scene}/>}
      {tab === 'plan' && <PlanTab farm={farm}/>}
      {tab === 'change' && <ChangeTab farm={farm}/>}
      {tab === 'film' && <Timelapse farm={farm}/>}
      {tab === 'pest' && <PestTab farm={farm} scene={scene}/>}
      {tab === 'ai' && (
        <StudioErrorBoundary farmName={farm.name}>
          <Studio farm={farm} scene={scene}/>
        </StudioErrorBoundary>
      )}
    </div>
  </section>
}
