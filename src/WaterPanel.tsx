import LogoLoader from './LogoLoader'
import { useEffect, useMemo, useState } from 'react'
import { CircleDot, Droplets, RefreshCw, Route, Trash2, Waves, BarChart3, Activity, Compass, MessageCircle, Sparkles } from 'lucide-react'
import SourceNote, { type SourceKey } from './SourceNote'
import { fetchSoil, fetchWeather, textureClass, type Param, type Soil, type Tone, type Weather } from './lib/agro'
import { CROPS, METHODS, pipeHydraulics, pumpKw, soilHydraulics } from './lib/hydro'
import { removeBorewell, removePipeline, updateBorewell, updatePipeline, lengthM, useAssets, type Pipeline } from './lib/assets'
import { bandFor, sampleAt, type Grid } from './lib/indicators'
import { ScaleBox } from './Scale'
import { indexStat, loadDem, type FarmData } from './lib/seva'
import IrrigationDecisionCard from './IrrigationDecisionCard'
import { getGroundTalk } from './lib/plainTalk'

type Props = { farm: FarmData & { id: string; name: string } }
type Remote<T> = { key: string; data?: T; error?: string }
type Cfg = { crop: string; method: string }
const CFG = 'seva-water'
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—')
const DIAS = [40, 50, 63, 75, 90, 110, 125, 160, 200]

function Card({ title, sub, icon: Icon, items, empty = 'Waiting for enough data to show this estimate.', src = ['weather', 'model'], onRefresh }: { src?: SourceKey[]; title: string; sub: string; icon: typeof Droplets; items?: Param[]; empty?: string; onRefresh?: () => void }) {
  const [spinning, setSpinning] = useState(false)
  const handleRefresh = () => {
    setSpinning(true)
    setTimeout(() => setSpinning(false), 800)
    onRefresh?.()
  }
  return <section className="ag-card"><div className="ag-head"><Icon size={17}/><h3>{title}</h3><small>{sub}</small>
    {onRefresh && <button className={`box-refresh-btn ${spinning ? 'spinning' : ''}`} title={`Refresh ${title}`} onClick={handleRefresh}><RefreshCw size={13}/></button>}
  </div>
    {items ? <div className="ag-grid">{items.map(p => <div key={p.label} className={`ag-item ${p.tone}`}><span>{p.label}</span><b>{p.value}</b><small>{p.note}</small></div>)}</div> : <div className="ag-empty">{/^Loading|^Waiting/i.test(empty) ? <LogoLoader text={empty}/> : empty}</div>}<SourceNote of={src}/></section>
}

function Guide({ title, unit, rows }: { title: string; unit: string; rows: [string, string, string][] }) {
  return <div className="sc-box compact"><div className="sc-title"><b>{title}</b><span>{unit}</span></div><div className="sc-bar">{rows.map(r => <i key={r[1]} style={{ background: r[0], flex: 1 }}/>)}</div>
    <ul>{rows.map(r => <li key={r[1]}><i style={{ background: r[0] }}/><span>{r[1]}</span><code>{r[2]}</code></li>)}</ul></div>
}

function Profile({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const lo = Math.min(...values), hi = Math.max(...values), W = 220, H = 44, span = Math.max(hi - lo, 1)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${(i / (values.length - 1)) * W},${H - 4 - ((v - lo) / span) * (H - 10)}`).join(' ')
  return <svg viewBox={`0 0 ${W} ${H}`} className="wt-profile" role="img" aria-label="Elevation profile"><path d={`${d} L${W},${H} L0,${H} Z`} fill="#c6dbef" opacity=".6"/><path d={d} fill="none" stroke="#2171b5" strokeWidth="2"/>
    <text x="2" y="9" fontSize="8" fill="#4d5f56">{hi.toFixed(0)} m</text><text x="2" y={H - 1} fontSize="8" fill="#4d5f56">{lo.toFixed(0)} m</text></svg>
}

export default function WaterPanel({ farm }: Props) {
  const key = `${farm.id}:${farm.lat}:${farm.lon}`
  const [weather, setWeather] = useState<Remote<Weather>>({ key: '' })
  const [soil, setSoil] = useState<Remote<Soil>>({ key: '' })
  const [dem, setDem] = useState<{ key: string; grid?: Grid }>({ key: '' })
  const [showFriendHydrology, setShowFriendHydrology] = useState(false)
  const [cfgAll, setCfgAll] = useState<Record<string, Cfg>>(() => { try { return JSON.parse(localStorage.getItem(CFG) || '{}') } catch { return {} } })
  const cfg = cfgAll[farm.id] ?? { crop: 'wheat', method: 'furrow' }
  const setCfg = (p: Partial<Cfg>) => setCfgAll(a => { const n = { ...a, [farm.id]: { ...cfg, ...p } }; localStorage.setItem(CFG, JSON.stringify(n)); return n })
  const assets = useAssets()
  const borewells = assets.borewells.filter(b => b.farmId === farm.id), pipelines = assets.pipelines.filter(p => p.farmId === farm.id)

  useEffect(() => {
    let dead = false
    fetchWeather(farm.lat, farm.lon).then(data => { if (!dead) setWeather({ key, data }) }).catch(e => { if (!dead) setWeather({ key, error: e.message }) })
    fetchSoil(farm.lat, farm.lon).then(data => { if (!dead) setSoil({ key, data }) }).catch(e => { if (!dead) setSoil({ key, error: e.message }) })
    loadDem(farm).then(grid => { if (!dead) setDem({ key, grid }) }).catch(() => { if (!dead) setDem({ key }) })
    return () => { dead = true }
  }, [key, farm.polygon?.length, farm.area])

  const w = weather.key === key ? weather.data : undefined, s = soil.key === key ? soil.data : undefined, g = dem.key === key ? dem.grid : undefined
  const crop = CROPS.find(c => c.id === cfg.crop)!, method = METHODS.find(m => m.id === cfg.method)!

  const hyd = useMemo(() => {
    if (!s) return null
    const avg = (k: string) => { const v = (s[k]?.depths ?? []).slice(0, 3).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN }
    const sand = avg('sand'), clay = avg('clay'), silt = avg('silt'), soc = avg('soc')
    if (![sand, clay, silt, soc].every(Number.isFinite)) return null
    return { sand, clay, silt, texture: textureClass(clay, sand, silt), ...soilHydraulics(sand, clay, (soc * 1.724) / 10), ph: avg('phh2o'), bd: avg('bdod') }
  }, [s])

  const water = useMemo(() => {
    if (!hyd || !w) return null
    const wEff = w
    const area = farm.area || 0
    const etc7 = crop.kc * wEff.et0Next7, effRain = 0.75 * wEff.rainNext7, theta = wEff.soilM.d9_27
    const frac = clamp((theta - hyd.pwp) / (hyd.fc - hyd.pwp), 0, 1), taw = (hyd.fc - hyd.pwp) * crop.root * 1000
    const refill = frac < 0.5 ? (1 - frac) * taw : 0
    const need7 = Math.max(0, etc7 - effRain - Math.max(0, frac - 0.5) * taw)
    const netNow = refill || need7, dailyEtc = etc7 / 7, gross = netNow / method.eff
    const demandDay = (dailyEtc / method.eff) * area * 10
    const daysToMad = (frac - 0.5) * taw / Math.max(dailyEtc - effRain / 7, 0.1)
    return { etc7, effRain, frac, taw, refill, need7, netNow, dailyEtc, gross, volume: gross * area * 10, demandDay, interval: (taw * 0.5) / Math.max(dailyEtc, 0.1), daysToMad, area }
  }, [w, hyd, crop, method, farm.area])

  const terrain = useMemo(() => {
    if (!g) return null
    let n = 0, wet = 0, pond = 0
    for (let i = 0; i < g.w * g.h; i++) if (g.inside[i]) { n++; if (g.b.twi[i] >= 12) wet++; if (g.b.sink[i] >= 10) pond++ }
    return { twi: indexStat(g, 'twi'), flow: indexStat(g, 'flow'), slope: indexStat(g, 'slope'), wet: n ? (100 * wet) / n : 0, pond: n ? (100 * pond) / n : 0 }
  }, [g])

  const verdict: { tone: Tone; text: string } | null = water && (water.frac < 0.5
    ? { tone: 'warn', text: `The model shows about ${f(water.frac * 100, 0)}% of estimated root-zone water available. Check soil near the roots before watering; the model's rough refill estimate is ${f(water.refill, 0)} mm net (${f(water.gross, 0)} mm through the selected method${water.area ? `, about ${f(water.volume, 0)} m³ over ${f(water.area, 1)} ha` : ''}).` }
    : water.need7 > 5
      ? { tone: 'warn', text: `The model estimates crop water demand may exceed forecast rain by ${f(water.need7, 0)} mm over the next 7 days. Check soil near the roots and update the plan if local rain differs.` }
      : { tone: 'good', text: `The current model shows no large shortfall for the week (${f(water.etc7, 0)} mm estimated crop demand). Confirm with field soil and local rain before changing irrigation.` })

  const budget: Param[] | undefined = water ? [
    { label: 'Rain, last 30 days', value: `${f(w!.rain30, 0)} mm`, note: `Last 7 days: ${f(w!.rain7)} mm from the weather model`, tone: 'neutral' },
    { label: 'Estimated crop water demand, next 7 days', value: `${f(water.etc7, 0)} mm`, note: `Based on ${crop.name} and this model's weather estimate; crop stage changes demand.`, tone: 'neutral' },
    { label: 'Rain expected to reach the soil', value: `${f(water.effRain, 0)} mm`, note: `Planning estimate from ${f(w!.rainNext7, 0)} mm forecast rain; actual field rain and runoff may differ.`, tone: 'neutral' },
    { label: 'Estimated water in crop root zone', value: `${f(water.frac * 100, 0)} %`, note: `About ${f(water.frac * water.taw, 0)} of ${f(water.taw, 0)} mm estimated for ${crop.root} m of soil. This is a model, not a soil probe.`, tone: water.frac < 0.5 ? 'warn' : water.frac < 0.65 ? 'neutral' : 'good' },
    { label: 'Possible refill amount', value: `${f(water.refill, 0)} mm`, note: water.refill ? 'Model estimate only; check soil at root depth before applying.' : 'No refill amount is flagged by this model right now.', tone: water.refill ? 'warn' : 'neutral' },
    { label: 'Possible irrigation gap, next 7 days', value: `${f(water.need7, 0)} mm`, note: `Gross amount would be higher after method losses; this estimate uses ${Math.round(method.eff * 100)}% ${method.name.toLowerCase()} efficiency.`, tone: water.need7 > 20 ? 'warn' : 'neutral' },
    { label: 'Estimated daily crop demand', value: water.area ? `${f(water.demandDay, 0)} m³/day` : `${f(water.dailyEtc / method.eff, 1)} mm/day`, note: water.area ? `${f(water.area, 1)} ha and the selected crop/method assumptions` : 'Add a mapped farm area for a field volume', tone: 'neutral' },
    { label: 'Estimated time to use half the water reserve', value: `${f(water.interval, 0)} days`, note: 'A planning guide only; crop stage, rainfall, and actual soil moisture can change this.', tone: 'neutral' },
  ] : undefined

  const soilItems: Param[] | undefined = hyd ? [
    { label: 'Estimated soil type', value: hyd.texture, note: `Modelled topsoil: ${f(hyd.sand, 0)}% sand, ${f(hyd.silt, 0)}% silt, ${f(hyd.clay, 0)}% clay. Check a soil sample to confirm.`, tone: 'neutral' },
    { label: 'Moisture after excess water drains', value: `${f(hyd.fc * 100, 0)} %`, note: 'Model estimate of how much water this soil may hold after free drainage.', tone: 'neutral' },
    { label: 'Very dry soil estimate', value: `${f(hyd.pwp * 100, 0)} %`, note: 'Below this modelled moisture level, many crops struggle to draw water. Confirm with the soil and crop.', tone: 'neutral' },
    { label: 'Water the soil may hold for plants', value: `${f(hyd.awc, 0)} mm/m`, note: 'Estimated water available per metre of soil; actual storage depends on field layers and rooting depth.', tone: 'neutral' },
    { label: 'Estimated water entry into soil', value: `${f(hyd.ks, hyd.ks < 10 ? 1 : 0)} mm/h`, note: hyd.ks > 60 ? 'Model suggests fast entry; check whether water moves below the roots.' : hyd.ks > 20 ? 'Model suggests fairly fast entry; check the field after irrigation.' : hyd.ks > 5 ? 'Middle range in the soil model; watch how water spreads.' : 'Model suggests slow entry; look for ponding or runoff after rain.', tone: hyd.ks > 60 || hyd.ks < 5 ? 'warn' : 'neutral' },
    { label: 'Soil pH estimate', value: f(hyd.ph, 1), note: `${hyd.ph < 5.5 ? 'Acidic range' : hyd.ph > 8 ? 'Alkaline range' : 'Middle range'} in the regional model. Get a soil test before applying amendments.`, tone: 'neutral' },
  ] : undefined

  const poorDrain = !!hyd && !!terrain && (hyd.ks < 5 || terrain.wet > 25 || terrain.pond > 10)
  const drainItems: Param[] | undefined = hyd && terrain ? [
    { label: 'Estimated water movement through soil', value: hyd.ks > 60 ? 'Fast' : hyd.ks > 20 ? 'Fairly fast' : hyd.ks > 5 ? 'Middle range' : 'Slow', note: `${f(hyd.ks, 1)} mm/h from a soil model. Look for ponding or quick drainage in the field.`, tone: hyd.ks < 5 || hyd.ks > 60 ? 'warn' : 'neutral' },
    { label: 'Ground where water may collect', value: f(terrain.twi?.mean ?? NaN, 1), note: bandFor('twi', terrain.twi?.mean ?? NaN)?.label ?? 'Map estimate; check low spots after rain.', tone: (terrain.twi?.mean ?? 0) >= 12 ? 'warn' : 'neutral' },
    { label: 'Area with a wetness signal', value: `${f(terrain.wet, 0)} %`, note: 'Terrain model flags this share for closer checking; it does not confirm waterlogging.', tone: terrain.wet > 25 ? 'warn' : 'neutral' },
    { label: 'Modelled hollows', value: `${f(terrain.pond, 0)} %`, note: 'Parts of the terrain model with a low spot. Check whether water actually stands there.', tone: terrain.pond > 10 ? 'warn' : 'neutral' },
    { label: 'Largest upstream area', value: `${f(terrain.flow?.max ?? NaN, 1)} ha`, note: 'Land that may drain toward this point in the terrain model. Follow the path after rain.', tone: (terrain.flow?.max ?? 0) > 50 ? 'warn' : 'neutral' },
    { label: 'Average slope', value: `${f(terrain.slope?.mean ?? NaN, 1)}°`, note: (terrain.slope?.mean ?? 0) < 0.5 ? 'Nearly level here; look for pooling after rain.' : (terrain.slope?.mean ?? 0) > 8 ? 'Steeper ground; check where runoff concentrates.' : 'Gentle grade in the model; confirm the actual flow path on site.', tone: (terrain.slope?.mean ?? 0) < 0.5 || (terrain.slope?.mean ?? 0) > 8 ? 'warn' : 'neutral' },
  ] : undefined
  const drainAdvice = !hyd || !terrain ? '' : poorDrain
    ? 'Several model signals point to places worth checking. Walk the low spots and runoff paths after rain; get local advice before adding drains or earthworks.'
    : (terrain.slope?.mean ?? 0) > 8 ? 'The terrain is relatively steep in this model. Check for fast runoff or soil movement after rain.' : 'The broad model shows no strong drainage warning. Check field outlets and observe the field after heavy rain.'

  const sampleDem = (lon: number, lat: number) => (g ? sampleAt(g, lon, lat) : null)
  const profile = (p: Pipeline) => {
    if (!g || p.pts.length < 2) return []
    const total = lengthM(p.pts), out: number[] = []
    for (let k = 0; k <= 24; k++) {
      let target = (total * k) / 24, acc = 0
      for (let i = 1; i < p.pts.length; i++) {
        const seg = lengthM([p.pts[i - 1], p.pts[i]])
        if (acc + seg >= target || i === p.pts.length - 1) { const t = seg ? clamp((target - acc) / seg, 0, 1) : 0; const lon = p.pts[i - 1][0] + (p.pts[i][0] - p.pts[i - 1][0]) * t, lat = p.pts[i - 1][1] + (p.pts[i][1] - p.pts[i - 1][1]) * t; const v = sampleDem(lon, lat)?.dem; if (v !== undefined) out.push(v); break }
        acc += seg
      }
    }
    return out
  }
  const deepestLevel = borewells.length ? Math.max(...borewells.map(b => b.level)) : 0

  const refreshWeather = () => fetchWeather(farm.lat, farm.lon, true).then(data => setWeather({ key, data })).catch(e => setWeather({ key, error: e.message }))
  const refreshSoil = () => fetchSoil(farm.lat, farm.lon, true).then(data => setSoil({ key, data })).catch(e => setSoil({ key, error: e.message }))
  const refreshDem = () => loadDem(farm).then(grid => setDem({ key, grid })).catch(() => setDem({ key }))

  return <section className="ag-wrap wt-wrap">
    <div className="intelligence-heading"><h2>Water, irrigation &amp; drainage <span>Open-Meteo · SoilGrids · Copernicus DEM · your borewells and pipelines</span></h2>
      <div className="wt-pick"><label>Crop<select value={cfg.crop} onChange={e => setCfg({ crop: e.target.value })}>{CROPS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Irrigation<select value={cfg.method} onChange={e => setCfg({ method: e.target.value })}>{METHODS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div></div>
    
    {w && farm.analysis ? <IrrigationDecisionCard
      farmAreaHa={farm.area}
      cropName={crop.name}
      ndvi={farm.analysis.ndvi?.mean}
      ndmi={farm.analysis.ndmi.mean}
      et0Next7={w.et0Next7}
      rainNext7={w.rainNext7}
      soilMoisturePct={Math.round(w.soilM.d9_27 * 100)}
    /> : <div className="ag-empty">Waiting for live weather and a clear satellite reading. Irrigation amounts are hidden until both are available.</div>}

    {verdict && <div className={`wt-verdict ${verdict.tone}`}><Droplets size={18}/>{verdict.text}</div>}
    {(weather.key === key && weather.error) && <div className="ag-empty">Weather unavailable: {weather.error}</div>}
    <div className="ag-cols">
      <Card title="Water budget" sub={`${crop.name} · ${method.name}`} icon={Droplets} items={budget} empty={weather.error ? `Weather estimate unavailable: ${weather.error}` : 'Loading weather estimates…'} onRefresh={() => { refreshWeather(); refreshSoil() }}/>
      <Card title="Soil type & water holding" sub="Regional soil model" icon={Waves} items={soilItems} empty={soil.error ? `Soil data unavailable: ${soil.error}` : 'Loading soil estimates…'} src={['soil', 'model']} onRefresh={refreshSoil}/>
      <Card title="Drainage" sub="Soil and terrain model" icon={Waves} items={drainItems} empty={!g ? 'Loading terrain model…' : soil.error ? `Soil data unavailable: ${soil.error}` : 'Loading soil estimates…'} src={['soil', 'dem', 'model']} onRefresh={() => { refreshSoil(); refreshDem() }}/>
    </div>
    {drainAdvice && <div className={`wt-verdict ${poorDrain ? 'warn' : 'good'}`}><Waves size={18}/>{drainAdvice}</div>}

    {/* SWAT Hydrological Modeling & Water Balance Suite (Exact reproduction of MAPS REF thesis Fig 4.1, 4.2 & 4.7) */}
    <div className="wt-swat-suite" style={{ marginTop: 16, marginBottom: 16 }}>
      <section className="ag-card" style={{ padding: 16 }}>
        <div className="ag-head" style={{ marginBottom: 12 }}>
          <Activity size={18} className="text-emerald-500" />
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              SWAT Hydrological Cycle &amp; Basin Water Balance (Wainganga Watershed)
            </h3>
            <small style={{ fontSize: 10, color: '#64748b' }}>
              Soil and Water Assessment Tool (SWAT) calibrated simulation · Fig 4.1, 4.2 &amp; 4.7
            </small>
          </div>
        </div>

        {/* Key SWAT Balance Summary Badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
            <span style={{ fontSize: 9.5, color: '#64748b', display: 'block' }}>Precipitation (PREC)</span>
            <strong style={{ fontSize: 13, color: '#0284c7' }}>1,171.1 mm</strong>
            <small style={{ fontSize: 8.5, color: '#94a3b8', display: 'block' }}>Annual Basin Total</small>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
            <span style={{ fontSize: 9.5, color: '#64748b', display: 'block' }}>Surface Runoff (SURQ)</span>
            <strong style={{ fontSize: 13, color: '#e11d48' }}>359.31 mm</strong>
            <small style={{ fontSize: 8.5, color: '#94a3b8', display: 'block' }}>30.7% of Precipitation</small>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
            <span style={{ fontSize: 9.5, color: '#64748b', display: 'block' }}>Actual ET (ET)</span>
            <strong style={{ fontSize: 13, color: '#d97706' }}>401.90 mm</strong>
            <small style={{ fontSize: 8.5, color: '#94a3b8', display: 'block' }}>34.3% of Precipitation</small>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
            <span style={{ fontSize: 9.5, color: '#64748b', display: 'block' }}>Return Flow (GWQ)</span>
            <strong style={{ fontSize: 13, color: '#059669' }}>224.81 mm</strong>
            <small style={{ fontSize: 8.5, color: '#94a3b8', display: 'block' }}>Baseflow to Reaches</small>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
            <span style={{ fontSize: 9.5, color: '#64748b', display: 'block' }}>Percolation</span>
            <strong style={{ fontSize: 13, color: '#7c3aed' }}>400.05 mm</strong>
            <small style={{ fontSize: 8.5, color: '#94a3b8', display: 'block' }}>Vadose Zone Infiltration</small>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
            <span style={{ fontSize: 9.5, color: '#64748b', display: 'block' }}>SCS Curve No (CN2)</span>
            <strong style={{ fontSize: 13, color: '#0f172a' }}>75.62</strong>
            <small style={{ fontSize: 8.5, color: '#94a3b8', display: 'block' }}>Calibrated Hydrologic Value</small>
          </div>
        </div>

        {/* Fig 4.2 Schematic Cycle Diagram (Interactive SVG matching 6.jpeg) */}
        <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Fig 4.2 · Schematic Representation of the Watershed Water Balance</span>
              <button
                type="button"
                onClick={() => setShowFriendHydrology(prev => !prev)}
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: '1px solid #10b981', background: showFriendHydrology ? '#ecfdf5' : '#ffffff', color: '#047857', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Sparkles size={11} />
                <span>{showFriendHydrology ? 'Hide Friend Talk' : '🗣️ Explain Like Friends'}</span>
              </button>
            </div>
            <span style={{ fontSize: 9.5, color: '#64748b', fontWeight: 500 }}>SWAT Equilibrium: PREC = SURQ + LATQ + GWQ + ET + ΔS</span>
          </div>

          {showFriendHydrology && (
            <div style={{ background: '#ffffff', border: '1.5px solid #10b981', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 11, color: '#1e293b', lineHeight: 1.45 }}>
              <div style={{ fontWeight: 800, color: '#047857', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageCircle size={14} />
                <span>Ground Practical Water Balance (Friend to Friend):</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <li>
                  <b>Total Monsoon Rain (1,171 mm):</b> Imagine all the rain in a year stayed on the ground like a flat lake—it would stand nearly 4 feet deep across the entire watershed!
                </li>
                <li>
                  <b style={{ color: '#e11d48' }}>Runoff (359.3 mm · 31%):</b> Almost one-third of every rainstorm washes right over the soil surface straight into rivers before sinking in. Building contour bunds and farm ponds lets you capture this lost water!
                </li>
                <li>
                  <b style={{ color: '#d97706' }}>Crop Drinking &amp; Sun Evaporation (401.9 mm · 34%):</b> Crops drink this through their roots and "sweat" it out of leaves, while midday sun bakes moisture off the dirt. Mulching saves a huge share of this.
                </li>
                <li>
                  <b style={{ color: '#059669' }}>Deep Aquifer Recharge (224.8 mm GWQ + 400 mm Percolation):</b> Rain that sinks deep down into underground sand and rock layers. This is what keeps village borewells and wells pumping all through the dry summer.
                </li>
                <li>
                  <b style={{ color: '#0f172a' }}>Soil Sponge Score (CN = 75.6):</b> Standard agricultural loam soil. It acts like a moderate sponge: absorbs light showers easily, but water rolls right off during heavy downpours.
                </li>
              </ul>
            </div>
          )}

          <svg viewBox="0 0 650 250" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Atmospheric Zone / Cloud */}
            <path d="M 80,45 Q 90,25 115,30 Q 135,15 160,30 Q 185,20 205,38 Q 225,35 220,55 Q 225,70 205,75 L 85,75 Q 70,60 80,45 Z" fill="#93c5fd" opacity="0.6" stroke="#2563eb" strokeWidth="1.5" />
            <text x="145" y="55" fontSize="11" fontWeight="bold" fill="#1e3a8a" textAnchor="middle">Precipitation: 1,171.1 mm</text>

            {/* Precipitation Arrows downward */}
            <line x1="145" y1="75" x2="145" y2="105" stroke="#2563eb" strokeWidth="2.5" markerEnd="url(#arrow)" />
            <line x1="105" y1="75" x2="105" y2="105" stroke="#2563eb" strokeWidth="1.8" />
            <line x1="185" y1="75" x2="185" y2="105" stroke="#2563eb" strokeWidth="1.8" />

            {/* Ground Surface Slope */}
            <path d="M 30,110 Q 250,115 620,135 L 620,240 L 30,240 Z" fill="#d1fae5" stroke="#059669" strokeWidth="2" />
            <text x="50" y="125" fontSize="9" fontWeight="bold" fill="#065f46">Ground Surface (CN = 75.62)</text>

            {/* Evapotranspiration Arrow upward */}
            <line x1="330" y1="112" x2="330" y2="40" stroke="#d97706" strokeWidth="2.5" strokeDasharray="4,3" />
            <polygon points="330,34 326,44 334,44" fill="#d97706" />
            <text x="335" y="65" fontSize="10.5" fontWeight="bold" fill="#b45309">ET: 401.9 mm</text>

            {/* Surface Runoff Flowing to Stream Channel */}
            <path d="M 170,110 Q 380,120 540,135" fill="none" stroke="#e11d48" strokeWidth="3" />
            <polygon points="545,136 535,130 536,139" fill="#e11d48" />
            <text x="380" y="105" fontSize="10.5" fontWeight="bold" fill="#9f1239">Surface Runoff: 359.31 mm</text>

            {/* Soil Profile / Vadose Zone */}
            <rect x="50" y="140" width="460" height="40" fill="#fde68a" opacity="0.6" stroke="#d97706" strokeWidth="1" strokeDasharray="3,3" />
            <text x="60" y="155" fontSize="9" fontWeight="bold" fill="#92400e">Soil Profile (AWC 0.14 mm/mm)</text>
            <text x="60" y="170" fontSize="8.5" fill="#78350f">Lateral Flow: 9.95 mm · Percolation: 400.05 mm</text>

            {/* Lateral Flow arrow */}
            <line x1="300" y1="160" x2="520" y2="165" stroke="#b45309" strokeWidth="2" strokeDasharray="4,2" />
            <polygon points="525,166 517,162 518,170" fill="#b45309" />

            {/* Shallow Unconfined Aquifer */}
            <rect x="50" y="185" width="460" height="48" fill="#bae6fd" opacity="0.6" stroke="#0284c7" strokeWidth="1.2" />
            <text x="60" y="200" fontSize="9" fontWeight="bold" fill="#0369a1">Shallow Unconfined Aquifer</text>
            <text x="60" y="214" fontSize="8.5" fill="#075985">Revap: 151.58 mm · Return Flow (GWQ): 224.81 mm</text>

            {/* Revap arrow upward */}
            <line x1="240" y1="185" x2="240" y2="150" stroke="#7c3aed" strokeWidth="2" strokeDasharray="3,2" />
            <polygon points="240,144 236,152 244,152" fill="#7c3aed" />
            <text x="245" y="165" fontSize="8.5" fontWeight="bold" fill="#6d28d9">Revap: 151.6 mm</text>

            {/* Groundwater Return Flow to Stream Channel */}
            <path d="M 370,205 Q 490,205 540,175" fill="none" stroke="#059669" strokeWidth="2.5" />
            <polygon points="544,172 536,177 542,183" fill="#059669" />
            <text x="430" y="222" fontSize="9.5" fontWeight="bold" fill="#047857">GWQ: 224.81 mm</text>

            {/* Stream Channel Outlet */}
            <path d="M 535,130 L 620,135 L 620,240 L 535,240 Z" fill="#38bdf8" opacity="0.85" stroke="#0284c7" strokeWidth="2" />
            <text x="578" y="185" fontSize="11" fontWeight="bold" fill="#0f172a" textAnchor="middle">Stream</text>
            <text x="578" y="200" fontSize="8.5" fill="#0369a1" textAnchor="middle">Reach Outlet</text>
          </svg>
        </div>

        {/* Fig 4.7: SUFI-2 Global Sensitivity Analysis Ranking */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Fig 4.7 · SUFI-2 Global Sensitivity Analysis Ranking (SWAT-CUP)</span>
            <span style={{ fontSize: 9.5, color: '#059669', fontWeight: 600 }}>Calibration Target: Deoghat Gauging Station</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { rank: 1, name: 'r__CN2.mgt', desc: 'Initial SCS runoff curve number II value', tStat: -14.2, pVal: '0.0001', pct: 96, barColor: '#e11d48' },
              { rank: 2, name: 'v__ALPHA_BF.gw', desc: 'Baseflow alpha factor (days)', tStat: 8.4, pVal: '0.0032', pct: 82, barColor: '#0284c7' },
              { rank: 3, name: 'v__EPCO.bsn', desc: 'Plant uptake compensation factor', tStat: -6.2, pVal: '0.0084', pct: 71, barColor: '#d97706' },
              { rank: 4, name: 'v__REVAPMN.gw', desc: 'Threshold depth of water in shallow aquifer for revap (mm)', tStat: -4.7, pVal: '0.0142', pct: 62, barColor: '#7c3aed' },
              { rank: 5, name: 'v__ESCO.bsn', desc: 'Soil evaporation compensation factor', tStat: 3.9, pVal: '0.0210', pct: 54, barColor: '#059669' },
              { rank: 6, name: 'r__SOL_AWC(..).sol', desc: 'Available water capacity of the soil layer (mm/mm)', tStat: 3.1, pVal: '0.0381', pct: 45, barColor: '#0891b2' },
              { rank: 7, name: 'v__GWQMN.gw', desc: 'Threshold depth of water in shallow aquifer for return flow (mm)', tStat: -2.6, pVal: '0.0450', pct: 38, barColor: '#4f46e5' },
              { rank: 8, name: 'v__GW_REVAP.gw', desc: 'Groundwater revap coefficient', tStat: 2.2, pVal: '0.0520', pct: 31, barColor: '#64748b' },
            ].map(param => (
              <div key={param.rank} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                <span style={{ width: 18, fontWeight: 700, color: '#64748b' }}>#{param.rank}</span>
                <div style={{ width: 140, flexShrink: 0 }}>
                  <strong style={{ fontFamily: 'monospace', color: '#0f172a', display: 'block', fontSize: 10.5 }}>{param.name}</strong>
                  <span style={{ fontSize: 8.5, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{param.desc}</span>
                </div>
                <div style={{ flex: 1, background: '#f1f5f9', height: 12, borderRadius: 3, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: `${param.pct}%`, height: '100%', background: param.barColor, borderRadius: 2 }} />
                </div>
                <div style={{ width: 110, textAlign: 'right', flexShrink: 0, fontSize: 9.5 }}>
                  <span style={{ color: '#475569', marginRight: 6 }}>t-stat: <b>{param.tStat}</b></span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>p: {param.pVal}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>

    <div className="wt-assets">
      <section className="ag-card"><div className="ag-head"><CircleDot size={17}/><h3>Borewells</h3><small>Use the Borewell tool on the map to mark one</small>
        <button className="box-refresh-btn" title="Refresh Borewells" onClick={refreshDem}><RefreshCw size={13}/></button>
      </div>
        {borewells.length === 0 && <div className="ag-empty">No borewells marked. Click Borewell above the map, then click its location. Siting potential on the map shows where terrain favours recharge.</div>}
        {borewells.map(b => { const site = sampleDem(b.lon, b.lat)?.bw, supply = b.yieldM3h * b.hours, cover = water && water.demandDay ? (supply / water.demandDay) * 100 : NaN, band = site !== undefined ? bandFor('bw', site) : undefined
          const num = (k: 'depth' | 'level' | 'yieldM3h' | 'hours', label: string, unit: string) => <label>{label}<span><input type="number" min="0" step="any" value={b[k]} onChange={e => updateBorewell(b.id, { [k]: Math.max(0, +e.target.value) })}/>{unit}</span></label>
          return <div key={b.id} className="wt-asset"><div className="wt-asset-head"><input className="wt-name" value={b.name} onChange={e => updateBorewell(b.id, { name: e.target.value })}/><button aria-label="Remove borewell" onClick={() => removeBorewell(b.id)}><Trash2 size={14}/></button></div>
            <div className="wt-fields">{num('depth', 'Depth', 'm')}{num('level', 'Water level', 'm')}{num('yieldM3h', 'Yield', 'm³/h')}{num('hours', 'Pumping', 'h/day')}</div>
            <div className="ag-grid">
              <div className="ag-item neutral"><span>Daily supply</span><b>{f(supply, 0)} m³</b><small>{f(b.yieldM3h * 1000 / 60, 0)} L/min for {b.hours} h</small></div>
              <div className={`ag-item ${Number.isFinite(cover) ? (cover >= 100 ? 'good' : cover >= 60 ? 'warn' : 'bad') : 'neutral'}`}><span>Crop demand met</span><b>{Number.isFinite(cover) ? `${f(cover, 0)} %` : '—'}</b><small>{Number.isFinite(cover) ? (cover >= 100 ? 'Covers daily need' : 'Supplement with rain, storage or a second source') : 'Needs farm area and weather'}</small></div>
              <div className={`ag-item ${band ? (site! >= 50 ? 'good' : 'warn') : 'neutral'}`}><span>Terrain siting score</span><b>{site !== undefined ? `${f(site, 0)}/100` : '—'}</b><small>{band?.label ?? 'Outside the farm grid'}</small></div></div>
            <small className="ag-note">{b.lat.toFixed(5)}°, {b.lon.toFixed(5)}°. Siting score is a terrain proxy, not a groundwater survey.</small></div> })}
      </section>

      <section className="ag-card"><div className="ag-head"><Route size={17}/><h3>Pipelines</h3><small>Draw a route with the Pipeline tool on the map</small></div>
        {pipelines.length === 0 && <div className="ag-empty">No pipelines drawn. Click Pipeline above the map, click along the route, then Finish. Length, elevation lift, friction loss and pump power are worked out here.</div>}
        {pipelines.map(p => {
          const len = lengthM(p.pts), prof = profile(p), lift = prof.length > 1 ? prof[prof.length - 1] - prof[0] : NaN
          const h = pipeHydraulics(p.flow, p.dia, len), head = (Number.isFinite(lift) ? Math.max(lift, 0) : 0) + h.headLoss + method.head + deepestLevel
          const kw = pumpKw(p.flow, head), vTone: Tone = h.velocity < 0.6 ? 'warn' : h.velocity <= 2 ? 'good' : h.velocity <= 3 ? 'warn' : 'bad'
          return <div key={p.id} className="wt-asset"><div className="wt-asset-head"><input className="wt-name" value={p.name} onChange={e => updatePipeline(p.id, { name: e.target.value })}/><button aria-label="Remove pipeline" onClick={() => removePipeline(p.id)}><Trash2 size={14}/></button></div>
            <div className="wt-fields"><label>Pipe inside Ø<span><select value={p.dia} onChange={e => updatePipeline(p.id, { dia: +e.target.value })}>{DIAS.map(d => <option key={d} value={d}>{d}</option>)}</select>mm</span></label>
              <label>Flow<span><input type="number" min="0" step="any" value={p.flow} onChange={e => updatePipeline(p.id, { flow: Math.max(0, +e.target.value) })}/>m³/h</span></label>
              {water?.demandDay ? <button className="wt-use" onClick={() => updatePipeline(p.id, { flow: Math.round((water.demandDay / 8) * 10) / 10 })}>Size for daily demand over 8 h</button> : null}</div>
            <div className="ag-grid">
              <div className="ag-item neutral"><span>Length</span><b>{len < 1000 ? `${f(len, 0)} m` : `${f(len / 1000, 2)} km`}</b><small>{p.pts.length} points</small></div>
              <div className={`ag-item ${Number.isFinite(lift) ? (lift > 15 ? 'warn' : 'neutral') : 'neutral'}`}><span>Elevation change</span><b>{Number.isFinite(lift) ? `${lift >= 0 ? '+' : ''}${f(lift, 1)} m` : '—'}</b><small>{Number.isFinite(lift) ? (lift > 0 ? 'Uphill: pump must lift the water' : 'Downhill: gravity helps') : 'Route outside DEM grid'}</small></div>
              <div className={`ag-item ${vTone}`}><span>Water speed</span><b>{f(h.velocity, 2)} m/s</b><small>{h.velocity < 0.6 ? 'Too slow: silt can settle' : h.velocity <= 2 ? 'Good range 0.6 to 2' : h.velocity <= 3 ? 'Fast: use a larger pipe' : 'Surge and burst risk'}</small></div>
              <div className={`ag-item ${h.headLoss > 10 ? 'bad' : h.headLoss > 5 ? 'warn' : 'good'}`}><span>Friction loss</span><b>{f(h.headLoss, 1)} m</b><small>Hazen-Williams, C 150 (PVC/HDPE)</small></div>
              <div className="ag-item neutral"><span>Total pump head</span><b>{f(head, 0)} m</b><small>lift + friction + {method.head} m {method.name.toLowerCase()} pressure{deepestLevel ? ` + ${f(deepestLevel, 0)} m well level` : ''}</small></div>
              <div className="ag-item neutral"><span>Pump power</span><b>{f(kw, 1)} kW</b><small>{f(kw / 0.746, 1)} hp at 55% efficiency</small></div></div>
            <Profile values={prof}/></div> })}
      </section>
    </div>

    <details className="sc-guide"><summary>How to read the water numbers</summary><div className="sc-grid">
      <Guide title="Root-zone water available" unit="% of plant-available water" rows={[['#d73027', 'Irrigate now', '< 50 %'], ['#fee08b', 'Watch', '50 to 65 %'], ['#80cdc1', 'Comfortable', '65 to 90 %'], ['#01665e', 'Full', '≥ 90 %']]}/>
      <Guide title="Infiltration (Ks)" unit="mm per hour" rows={[['#01665e', 'Very slow, waterlogs', '< 1'], ['#80cdc1', 'Slow', '1 to 5'], ['#fee08b', 'Moderate', '5 to 20'], ['#a6d96a', 'Good', '20 to 60'], ['#fdae61', 'Very fast, leaches', '≥ 60']]}/>
      <Guide title="Water speed in pipe" unit="metres per second" rows={[['#fdae61', 'Silt settles', '< 0.6'], ['#1a9850', 'Good', '0.6 to 2'], ['#fee08b', 'Fast', '2 to 3'], ['#d73027', 'Burst risk', '≥ 3']]}/>
      <Guide title="Friction loss" unit="metres of head" rows={[['#1a9850', 'Efficient', '< 5'], ['#fee08b', 'Notable', '5 to 10'], ['#d73027', 'Upsize pipe', '≥ 10']]}/>
      {['twi', 'flow', 'sink', 'bw'].map(id => <ScaleBox key={id} id={id} compact/>)}</div></details>
    <small className="ag-note">Soil water and rain are modelled (Open-Meteo, SoilGrids at 250 m), terrain is Copernicus 30 m, and Kc and root depth are mid-season averages. On very flat land the 30 m DEM is noisy, so ponding and wetness are indicative only. Treat borewell siting as a first screen: confirm with a hydrogeological survey and test pumping before drilling.</small>
  </section>
}
