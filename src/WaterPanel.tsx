import LogoLoader from './LogoLoader'
import { useEffect, useMemo, useState } from 'react'
import { CircleDot, Droplets, RefreshCw, Route, Trash2, Waves } from 'lucide-react'
import SourceNote, { type SourceKey } from './SourceNote'
import { fetchSoil, fetchWeather, textureClass, type Param, type Soil, type Tone, type Weather } from './lib/agro'
import { CROPS, METHODS, pipeHydraulics, pumpKw, soilHydraulics } from './lib/hydro'
import { removeBorewell, removePipeline, updateBorewell, updatePipeline, lengthM, useAssets, type Pipeline } from './lib/assets'
import { bandFor, sampleAt, type Grid } from './lib/indicators'
import { ScaleBox } from './Scale'
import { indexStat, loadDem, type FarmData } from './lib/seva'
import IrrigationDecisionCard from './IrrigationDecisionCard'

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
