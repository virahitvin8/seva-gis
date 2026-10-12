import LogoLoader from './LogoLoader'
import { useEffect, useState } from 'react'
import { ChevronDown, CloudSun, Mountain, RefreshCw, Satellite, Shovel, Thermometer } from 'lucide-react'
import SourceNote, { type SourceKey } from './SourceNote'
import { fetchSoil, fetchWeather, ndviClass, regionalSoilFallback, soilParams, soilWaterParams, weatherParams, kidFriendlyIndicator, type Param, type Soil, type Tone, type Weather } from './lib/agro'
import { INDICATORS } from './lib/indicators'
import { ScaleBox, spectralIds } from './Scale'
import { loadDem, farmBBox, farmRing, type FarmData } from './lib/seva'
import { createGeoTiffBlob } from './lib/geoTiffWriter'

type Props = { farm: FarmData & { id: string; name: string } }
type Remote<T> = { key: string; data?: T; error?: string }

import InsightPlayingCardModal, { type InsightCardData } from './InsightPlayingCardModal'

function Section({ title, sub, icon: Icon, items, empty, src = ['s2'], onRefresh, onCardClick }: { src?: SourceKey[]; title: string; sub: string; icon: typeof CloudSun; items?: Param[]; empty: string; onRefresh?: () => void; onCardClick?: (p: Param, category: string) => void }) {
  const [spinning, setSpinning] = useState(false)
  const [showMeta, setShowMeta] = useState(false)
  const handleRefresh = () => {
    setSpinning(true)
    setTimeout(() => setSpinning(false), 800)
    onRefresh?.()
  }
  return <section className="ag-card"><div className="ag-head" onClick={() => setShowMeta(v => !v)} style={{ cursor: 'pointer' }} title="Click heading to inspect data source, resolution, and method"><Icon size={17}/><h3>{title}</h3><small>{sub}</small>
    <ChevronDown size={14} style={{ transform: showMeta ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: 'auto', color: '#94a3b8' }} />
    {onRefresh && <button className={`box-refresh-btn ${spinning ? 'spinning' : ''}`} title={`Refresh ${title}`} onClick={(e) => { e.stopPropagation(); handleRefresh() }}><RefreshCw size={13}/></button>}
  </div>
    {showMeta && (
      <div style={{ padding: '6px 10px', fontSize: '10.5px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', marginBottom: '8px', color: '#cbd5e1', lineHeight: 1.4 }}>
        <b>Data Source &amp; Resolution:</b> {src.map(s => s === 'soil' ? 'ISRIC SoilGrids 2.0 (250m global digital soil map)' : s === 'dem' ? 'Copernicus DEM GLO-30 (30m native elevation DSM)' : s === 'weather' ? 'Open-Meteo Numerical Weather Prediction grid' : 'Sentinel-2 L2A Multispectral (10m/20m)').join(' · ')}
      </div>
    )}
    {items ? <div className="ag-grid">{items.map(p => <div key={p.label} className={`ag-item ${p.tone}`} onClick={() => onCardClick?.(p, title)} style={{ cursor: 'pointer' }} title="Click to view full insight card & scientific analysis"><span>{p.label}</span><b>{p.value}</b></div>)}</div> : <div className="ag-empty">{/^Loading/.test(empty) ? <LogoLoader text={empty}/> : /fail|error|unavailable|could not/i.test(empty) ? <LogoLoader state="error" text={empty}/> : empty}</div>}<SourceNote of={src}/></section>
}

export default function AgroPanel({ farm }: Props) {
  const key = `${farm.id}:${farm.lat}:${farm.lon}`
  const [weather, setWeather] = useState<Remote<Weather>>({ key: '' })
  const [soil, setSoil] = useState<Remote<Soil>>({ key: '' })
  useEffect(() => {
    let dead = false
    fetchWeather(farm.lat, farm.lon).then(data => { if (!dead) setWeather({ key, data }) }).catch(e => { if (!dead) setWeather({ key, error: e.message }) })
    fetchSoil(farm.lat, farm.lon).then(data => { if (!dead) setSoil({ key, data }) }).catch(e => { if (!dead) setSoil({ key, error: e.message }) })
    return () => { dead = true }
  }, [key])
  const w = weather.key === key ? weather : undefined, s = soil.key === key ? soil : undefined
  const sData = s?.data || regionalSoilFallback(farm.lat, farm.lon)
  const a = farm.analysis
  const spectral: Param[] | undefined = a?.means && INDICATORS.filter(i => i.source === 'S2' && i.ramp && a.means![i.id] !== undefined).map(i => {
    const v = a.means![i.id]
    const kf = kidFriendlyIndicator(i.id, v, a.stressPct)
    return { label: kf.label, value: v.toFixed(2), note: kf.note, tone: kf.tone }
  })
  const terrain: Param[] | undefined = a && a.slopeDeg !== undefined ? [
    {
      label: 'Elevation above sea level',
      value: `${a.elevMean?.toFixed(0)} m`,
      note: `The terrain model places this field about ${a.elevMean?.toFixed(0)} m above sea level. Check local low spots and a nearby thermometer for frost or drainage decisions.`,
      tone: 'neutral'
    },
    {
      label: 'Field slope / tilt',
      value: `${a.slopeDeg.toFixed(1)}° (${a.slopePct?.toFixed(1)}%)`,
      note: (a.slopePct ?? 0) > 15
        ? `Water may run downhill quickly on this estimated ${a.slopePct?.toFixed(1)}% grade. Check for rills after rain and ask a local adviser before earthworks.`
        : (a.slopePct ?? 0) > 8
        ? `The estimated ${a.slopePct?.toFixed(1)}% grade can move water and soil during heavy rain. Walk the field after rain and note where runoff travels.`
        : (a.slopePct ?? 0) < 1
        ? `This area is nearly level in the terrain model. Look for low spots and standing water after rain before planning drains.`
        : `The terrain model shows a gentle grade. Check actual water movement and field outlets after rain.`,
      tone: (a.slopePct ?? 0) > 8 || (a.slopePct ?? 0) < 1 ? 'warn' : 'neutral'
    },
  ] : undefined

  const refreshWeather = () => fetchWeather(farm.lat, farm.lon, true).then(data => setWeather({ key, data })).catch(e => setWeather({ key, error: e.message }))
  const refreshSoil = () => fetchSoil(farm.lat, farm.lon, true).then(data => setSoil({ key, data })).catch(e => setSoil({ key, error: e.message }))
  const refreshDem = () => loadDem(farm).then(() => {})

  const [activeCard, setActiveCard] = useState<InsightCardData | null>(null)

  const handleCardClick = (p: Param, category: string) => {
    const isSpectral = category.includes('spectral') || category.includes('indices')
    const isWeather = category.includes('Weather')
    const isSoilWater = category.includes('water')
    const isSoilProp = category.includes('properties')
    const isTerrain = category.includes('Terrain')

    const cardCat: InsightCardData['category'] = isSpectral ? 'Spectral Index' : isWeather ? 'Weather & Atmosphere' : isSoilWater ? 'Soil Water' : isSoilProp ? 'Soil Property' : isTerrain ? 'Terrain' : 'Hydrology'

    let acronym = p.label.match(/\b([A-Z0-9]{2,6})\b/)?.[1]
    if (!acronym && isSpectral) acronym = p.label.slice(0, 4).toUpperCase()

    let formula = ''
    let thresholds = 'Favourable · Balanced for crop'
    let highImpact = 'Indicates elevated signal. Check if due to dense canopy, high biomass, or excess moisture.'
    let lowImpact = 'Indicates lower signal. Check for potential moisture or nutrient deficit.'
    let actionRecommendation = 'Ground-truth this zone on foot; review time series to check persistence.'

    if (p.label.toLowerCase().includes('ndvi')) {
      formula = 'NDVI = (B8_NIR - B4_Red) / (B8_NIR + B4_Red)'
      thresholds = '≥ 0.50 Vigorous | 0.30–0.50 Moderate | < 0.30 Stressed'
      highImpact = 'Dense green canopy with high photosynthetic chlorophyll absorption.'
      lowImpact = 'Sparse canopy, bare soil, or crop under severe biotic/abiotic stress.'
      actionRecommendation = 'If < 0.30 persists across passes, scout for moisture deficit, nitrogen deficiency, or disease hotspots.'
    } else if (p.label.toLowerCase().includes('msi') || p.label.toLowerCase().includes('leaf moisture') || p.label.toLowerCase().includes('moisture stress')) {
      formula = 'MSI = B11_SWIR / B8_NIR'
      thresholds = '< 0.80 Well-Hydrated | 0.80–1.20 Moderate | > 1.20 Water Stressed'
      highImpact = 'Leaves are severely dehydrated; shortwave-infrared reflectance increases.'
      lowImpact = 'Optimal leaf turgor and cell hydration; healthy cellular transpiration.'
      actionRecommendation = 'If MSI > 1.20, schedule priority irrigation within 24–48 hours to avert permanent wilting.'
    } else if (p.label.toLowerCase().includes('ndmi') || p.label.toLowerCase().includes('canopy water')) {
      formula = 'NDMI = (B8_NIR - B11_SWIR) / (B8_NIR + B11_SWIR)'
      thresholds = '> 0.20 Well Hydrated | 0.00–0.20 Moderate | < 0.00 Water Deficit'
      highImpact = 'Canopy is thoroughly hydrated and actively transpiring.'
      lowImpact = 'Crop water deficit; canopy begins stomatal closure.'
      actionRecommendation = 'Cross-reference with soil moisture model and schedule irrigation.'
    } else if (p.label.toLowerCase().includes('ndre') || p.label.toLowerCase().includes('chlorophyll')) {
      formula = 'NDRE = (B8_NIR - B5_RedEdge) / (B8_NIR + B5_RedEdge)'
      thresholds = '> 0.35 High Chlorophyll | 0.20–0.35 Moderate | < 0.20 Nitrogen Deficient'
      highImpact = 'High chlorophyll density in mid-to-late growth stages.'
      lowImpact = 'Nitrogen starvation or root-zone chlorosis.'
      actionRecommendation = 'Target variable-rate nitrogen or foliar urea top-dressing in low-scoring zones.'
    } else if (p.label.toLowerCase().includes('soil moisture') || p.label.toLowerCase().includes('moisture')) {
      thresholds = 'Optimal: 25%–38% | Wilting: < 15% | Saturation: > 42%'
      highImpact = 'Excessive water; risks root hypoxia, damping off, and nutrient leaching.'
      lowImpact = 'Moisture deficit; roots unable to extract capillary water; immediate irrigation needed.'
      actionRecommendation = 'Match irrigation volumes to crop evapotranspiration (ETc).'
    }

    setActiveCard({
      title: p.label,
      acronym,
      value: p.value,
      status: p.tone === 'good' ? 'good' : p.tone === 'warn' ? 'warn' : p.tone === 'bad' ? 'bad' : 'neutral',
      category: cardCat,
      formula,
      thresholds,
      meaning: p.note,
      highImpact,
      lowImpact,
      actionRecommendation
    })
  }

  const handleDownloadGeoTiff = (card: InsightCardData) => {
    try {
      const [w, s, e, n] = farmBBox(farm)
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 256
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, 256, 256)

      const ring = farmRing(farm)
      ctx.beginPath()
      ring.forEach(([lon, lat], i) => {
        const cx = ((lon - w) / (e - w || 0.001)) * 256
        const cy = ((n - lat) / (n - s || 0.001)) * 256
        if (i === 0) ctx.moveTo(cx, cy)
        else ctx.lineTo(cx, cy)
      })
      ctx.closePath()
      ctx.fillStyle = card.status === 'good' ? '#16a34a' : card.status === 'warn' ? '#d97706' : '#2563eb'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()

      const imgData = ctx.getImageData(0, 0, 256, 256)
      const blob = createGeoTiffBlob(256, 256, [w, s, e, n], imgData.data)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${farm.name.replace(/\W+/g, '_')}_${card.acronym || 'PARAM'}_GeoTIFF.tif`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.warn('GeoTIFF download error:', err)
    }
  }

  return <section className="ag-wrap">
    <div className="intelligence-heading"><h2>Agronomy parameters <span>Sentinel-2 · Open-Meteo · SoilGrids · Copernicus DEM · Click any box for 3D card analysis</span></h2></div>
    <div className="ag-cols">
      <Section title="Crop & spectral indices" sub={a ? `Farm mean · ${new Date(a.scene.datetime).toLocaleDateString()}` : 'waiting for scene'} icon={Satellite} items={spectral} empty="Refresh to compute vegetation, water and soil indices from Sentinel-2." onRefresh={() => { window.dispatchEvent(new CustomEvent('seva-refresh-spectral')) }} onCardClick={handleCardClick} />
      <Section title="Weather & atmosphere" sub={w?.error ?? 'Open-Meteo, live'} icon={CloudSun} items={w?.data && weatherParams(w.data)} empty={w?.error ?? 'Loading weather…'} src={['weather']} onRefresh={refreshWeather} onCardClick={handleCardClick}/>
      <Section title="Soil water & temperature" sub="Modelled by depth" icon={Thermometer} items={w?.data && soilWaterParams(w.data)} empty={w?.error ?? 'Loading soil moisture…'} src={['weather', 'model']} onRefresh={refreshWeather} onCardClick={handleCardClick}/>
      <Section title="Soil properties" sub={s?.data ? 'SoilGrids 250 m, 0-5 cm' : 'SoilGrids regional baseline (0-5 cm)'} icon={Shovel} items={soilParams(sData)} empty="Loading soil data…" src={['soil']} onRefresh={refreshSoil} onCardClick={handleCardClick}/>
      <Section title="Terrain" sub="Farm DEM statistics" icon={Mountain} items={terrain} empty="Elevation loads with the satellite analysis." src={['dem']} onRefresh={refreshDem} onCardClick={handleCardClick}/>
    </div>
    <details className="sc-guide" open><summary>What to look for on your farm</summary><div className="sc-grid">{spectralIds.map(id => <ScaleBox key={id} id={id} compact/>)}</div></details>
    <div className="ag-key"><span><i className="good"/>Favourable</span><span><i className="warn"/>Watch</span><span><i className="bad"/>Act or risk</span><span><i/>Information only</span> Card edge colour shows the status of each value.</div>
    <small className="ag-note">Weather, soil water, and soil properties are broad-area estimates, not readings from your field. Satellite maps use clear pixels; check unusual patches on the ground.</small>

    {activeCard && (
      <InsightPlayingCardModal
        card={activeCard}
        onClose={() => setActiveCard(null)}
        onDownloadGeoTiff={handleDownloadGeoTiff}
      />
    )}
  </section>
}
