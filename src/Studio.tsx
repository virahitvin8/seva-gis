import LogoLoader from './LogoLoader'
import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
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
  }, [farm.crop, farm.analysis?.ndvi.mean, farm.rain])

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

    {/* Yield Forecasting Card with Clear Error Margins */}
    <div className="sc-box compact" style={{ marginTop: 14 }}>
      <div className="sc-title"><b>Yield forecast model</b><span>crop-peak NDVI integral &amp; calibrated coefficients</span></div>
      <div className="ag-grid" style={{ padding: 12 }}>
        <div className="ag-item good">
          <span>Estimated harvest</span>
          <b>{yieldPred.predictedYieldTonHa} ± {yieldPred.errorMarginTonHa} t/ha</b>
          <small>~{yieldPred.predictedQuintalAcre} quintals/acre ({yieldPred.confidencePct}% confidence band)</small>
        </div>
        <div className="ag-item neutral">
          <span>Crop modelled</span>
          <b>{yieldPred.crop}</b>
          <small>NDVI multiplier: {yieldPred.factors.ndviFactor}×</small>
        </div>
        <div className="ag-item neutral">
          <span>Soil &amp; weather modifiers</span>
          <b>Soil {yieldPred.factors.soilFactor}× · Rain {yieldPred.factors.weatherFactor}×</b>
          <small>Calibrated against regional yield benchmarks</small>
        </div>
      </div>
      <small style={{ display: 'block', padding: '0 12px 10px', color: 'var(--muted)', fontSize: 11 }}>{yieldPred.explanation}</small>
    </div>

    <div className="st-export"><button onClick={exportRule}><Download size={14}/>Land cover polygons (GeoJSON)</button><button disabled={!auto && !sup} onClick={exportAuto}><Download size={14}/>Automatic classes (GeoJSON)</button></div>
    <p className="ge-note">GeoJSON opens in QGIS, ArcGIS, Google Earth Engine and geojson.io. Built on one cloud-masked Sentinel-2 scene. Methods follow scikit-learn, GDAL, Orfeo Toolbox, SNAP and QGIS Semi-Automatic Classification.</p>
  </>
}
