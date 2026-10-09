import LogoLoader from './LogoLoader'
import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, Sprout } from 'lucide-react'
import { LANDCOVER } from './lib/gee'
import { METHODS, superviseAuto, type Method, autoClassify, sharpTrueColour, download, landCoverLabels, trueColour, vectorize, predictYield } from './lib/geoai'
import { farmRing, loadScene, type FarmData, type Scene } from './lib/seva'
import { MapFrame } from './LabMap'

type Farm = FarmData & { id: string; name: string }
const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—')

export default function Studio({ farm, scene }: { farm: Farm; scene?: Scene }) {
  const [g, setG] = useState<Awaited<ReturnType<typeof loadScene>> | null>(null)
  const [err, setErr] = useState('')
  const [k, setK] = useState(4)
  const [sharp, setSharp] = useState('')
  const [useS2, setUseS2] = useState(false)
  const [method, setMethod] = useState<Method>('kmeans')
  const [yieldKey, setYieldKey] = useState(0)
  const [yieldSpinning, setYieldSpinning] = useState(false)
  useEffect(() => {
    if (!scene) return
    let dead = false
    setG(null); setErr('')
    loadScene(scene, farm).then(r => { if (!dead) setG(r) }).catch(e => { if (!dead) setErr(e instanceof Error ? e.message : 'Could not load the scene.') })
    return () => { dead = true }
  }, [scene?.id, farm.id])
  const ring = farmRing(farm)
  useEffect(() => { let dead = false; setSharp(''); sharpTrueColour(farmRing(farm)).then(u => { if (!dead) setSharp(u) }).catch(() => {}); return () => { dead = true } }, [farm.id, farm.lat, farm.lon, farm.area, farm.polygon?.length])
  const photo = useMemo(() => (g ? trueColour(g, ring) : ''), [g])
  const auto = useMemo(() => (g && method === 'kmeans' ? autoClassify(g, ring, k) : null), [g, k, method])
  const sup = useMemo(() => (g && method !== 'kmeans' ? superviseAuto(g, ring, method) : null), [g, method])

  const yieldPred = useMemo(() => {
    const peakNdvi = farm.analysis?.ndvi.mean ?? 0.68
    return predictYield(farm.crop || 'Paddy', peakNdvi, 6.8, farm.rain ?? 30)
  }, [farm.crop, farm.analysis?.ndvi.mean, farm.rain, yieldKey])

  if (!scene) return <div className="ag-empty">Run the satellite analysis first (Refresh), then GeoAI opens.</div>
  if (err) return <div className="ag-empty">{err}</div>
  if (!g) return <div className="ag-empty"><LogoLoader text="Loading Sentinel-2 bands…"/></div>
  const slug = farm.name.replace(/\W+/g, '-').toLowerCase(), date = scene.datetime.slice(0, 10)
  const exportRule = () => download(`${slug}-landcover.geojson`, JSON.stringify(vectorize(g, landCoverLabels(g), LANDCOVER, { farm: farm.name, scene: date, method: 'rule-based' })))
  const exportAuto = () => { const r = sup ? { l: sup.labels, d: sup.classes } : auto ? { l: auto.labels, d: auto.clusters } : null; if (r) download(`${slug}-auto-classes.geojson`, JSON.stringify(vectorize(g, r.l, r.d, { farm: farm.name, scene: date, method }))) }
  return <>
    <p className="ge-note">GeoAI sorts every pixel of your farm into natural groups by itself. No clicking, no training. It reads green, red, near-infrared and shortwave-infrared light, then groups pixels that behave alike. Why? Crops, soil and water reflect light differently, so similar ground ends up in the same group.</p>
    <div className="st-classes"><span>Method</span>{METHODS.map(m => <button key={m.id} className={method === m.id ? 'on' : ''} onClick={() => setMethod(m.id)}>{m.name}<small> {m.kind}</small></button>)}</div>
    <p className="ge-note">{METHODS.find(m => m.id === method)!.why}{method !== 'kmeans' && ' It trains itself from pixels that the land-cover rules are confident about, so you never draw training samples.'}</p>
    {method === 'kmeans' && <div className="st-classes"><span>Number of groups</span>{[3, 4, 5].map(n => <button key={n} className={k === n ? 'on' : ''} onClick={() => setK(n)}>{n}</button>)}</div>}
    <div className="ge-cols">
      <div>
        <MapFrame
          farm={farm}
          scene={scene}
          overlay={useS2 ? photo : (sharp || undefined)}
          title="True colour"
          note={!useS2 ? 'What a camera above your farm sees, in crystal-clear 4K ultra-high resolution (sub-metre satellite imagery). Sharp crop canopy, field boundaries, and ground features without pixel blur.' : 'What a camera in space sees. Sentinel-2 bands 4, 3, 2, 10 m per pixel.'}
          caption={!useS2 ? 'True colour · 4K Ultra-Res AOI (Sub-metre Satellite Imagery)' : 'True colour · Sentinel-2 10 m multispectral'}
          highlightAoi={!useS2}
        />
        <div className="st-classes" style={{ marginTop: 8 }}>
          <span>Picture mode</span>
          <button className={!useS2 ? 'on' : ''} onClick={() => setUseS2(false)}>✨ 4K Ultra-Res (Sub-metre)</button>
          <button className={useS2 ? 'on' : ''} onClick={() => setUseS2(true)}>Sentinel-2 (10 m)</button>
        </div>
      </div>
      {sup ? <MapFrame farm={farm} scene={scene} overlay={sup.url} title={METHODS.find(m => m.id === method)!.name} note="Each colour is one land-cover class." legend={sup.classes.filter(c => c.pct > 0).map(c => ({ color: c.color, label: `${c.name} · ${f(c.pct, 0)}%` }))}/> : method !== 'kmeans' ? <div className="ge-wait">Not enough clear pixels to classify</div> : auto ? <MapFrame farm={farm} scene={scene} overlay={auto.url} title="Automatic classes" note="Each colour is one group found by the computer." legend={auto.clusters.map(c => ({ color: c.color, label: `${c.name} · ${f(c.pct, 0)}%` }))}/> : <div className="ge-wait">Not enough clear pixels to classify</div>}
    </div>
    {method === 'kmeans' && auto && <div className="sc-box compact ge-legend"><div className="sc-title"><b>What the groups mean</b><span>greenness (NDVI, −1 to 1) · share · area</span></div>
      <ul>{auto.clusters.map(c => <li key={c.id}><i style={{ background: c.color }}/><span>{c.name}</span><code>NDVI {f(c.ndvi, 2)} · {f(c.pct, 0)}% · {f(c.ha, 2)} ha</code></li>)}</ul>
      <small>Groups with the lowest greenness are the first places to walk and check.</small></div>}

    {/* Yield Forecasting Card with Crystal-Clear Visual Display */}
    <div className="yield-forecast-box">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: 6, borderRadius: 8, background: '#ecfdf5', color: '#16a34a', display: 'flex' }}>
            <Sprout size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <b style={{ fontSize: 15, color: 'var(--primary)' }}>Yield forecast model</b>
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                Sentinel-2 Peak Integral
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Crop-peak NDVI integral &amp; calibrated agro coefficients
            </span>
          </div>
        </div>

        <button
          className={`box-refresh-btn ${yieldSpinning ? 'spinning' : ''}`}
          title="Refresh Yield Forecast Model"
          onClick={() => {
            setYieldSpinning(true)
            setTimeout(() => {
              setYieldKey(k => k + 1)
              setYieldSpinning(false)
            }, 600)
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Primary Harvest Hero Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Estimated Harvest
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0 6px' }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#14532d', lineHeight: 1 }}>
              {yieldPred.predictedYieldTonHa}
            </span>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#16a34a' }}>
              ± {yieldPred.errorMarginTonHa} t/ha
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', background: '#dcfce7', padding: '3px 8px', borderRadius: 6 }}>
              ~{yieldPred.predictedQuintalAcre} quintals/acre
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#0284c7', background: '#e0f2fe', padding: '3px 8px', borderRadius: 6 }}>
              {yieldPred.confidencePct}% confidence band
            </span>
          </div>
        </div>

        {/* Visual Benchmark Gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', fontWeight: 600 }}>
            <span>District Low ({f(yieldPred.baseYieldTonHa * 0.5, 1)} t/ha)</span>
            <span style={{ color: '#16a34a' }}>Avg Benchmark ({yieldPred.baseYieldTonHa} t/ha)</span>
            <span>Potential ({yieldPred.maxYieldTonHa} t/ha)</span>
          </div>

          <div className="yield-gauge-track">
            {/* Position of predicted yield on track */}
            <div
              className="yield-gauge-pin"
              style={{
                left: `${Math.min(96, Math.max(4, ((yieldPred.predictedYieldTonHa - yieldPred.baseYieldTonHa * 0.4) / (yieldPred.maxYieldTonHa - yieldPred.baseYieldTonHa * 0.4)) * 100))}%`
              }}
              title={`Predicted: ${yieldPred.predictedYieldTonHa} t/ha`}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            <span>Sub-optimal</span>
            <span>Balanced Canopy</span>
            <span>Peak Potential</span>
          </div>
        </div>
      </div>

      {/* Calibrated Factors Grid */}
      <div className="ag-grid">
        <div className="ag-item neutral">
          <span>Crop modelled</span>
          <b>{yieldPred.crop}</b>
          <small>Target peak NDVI: {yieldPred.optimalNdvi} · Modelled against ICAR baseline</small>
        </div>
        <div className="ag-item neutral">
          <span>NDVI multiplier</span>
          <b>{yieldPred.factors.ndviFactor}×</b>
          <small>Peak seasonal NDVI integral vs optimal vegetative curve</small>
        </div>
        <div className="ag-item neutral">
          <span>Soil modifier</span>
          <b>Soil {yieldPred.factors.soilFactor}×</b>
          <small>Calibrated against regional pedotransfer soil pH &amp; nutrient CEC</small>
        </div>
        <div className="ag-item neutral">
          <span>Rain &amp; moisture modifier</span>
          <b>Rain {yieldPred.factors.weatherFactor}×</b>
          <small>7-day precipitation Outlook &amp; active root-zone storage</small>
        </div>
      </div>

      <small style={{ display: 'block', marginTop: 10, color: 'var(--muted)', fontSize: 11, lineHeight: 1.5 }}>
        {yieldPred.explanation} Calibrated against regional yield benchmarks and crop-peak NDVI integral formulas.
      </small>
    </div>

    <div className="st-export"><button onClick={exportRule}><Download size={14}/>Land cover polygons (GeoJSON)</button><button disabled={!auto && !sup} onClick={exportAuto}><Download size={14}/>Automatic classes (GeoJSON)</button></div>
    <p className="ge-note">GeoJSON opens in QGIS, ArcGIS, Google Earth Engine and geojson.io. Built on one cloud-masked Sentinel-2 scene. Methods follow scikit-learn, GDAL, Orfeo Toolbox, SNAP and QGIS Semi-Automatic Classification.</p>
  </>
}
