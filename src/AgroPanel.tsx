import LogoLoader from './LogoLoader'
import { useEffect, useState } from 'react'
import { CloudSun, Mountain, Satellite, Shovel, Thermometer } from 'lucide-react'
import SourceNote, { type SourceKey } from './SourceNote'
import { fetchSoil, fetchWeather, ndviClass, soilParams, soilWaterParams, weatherParams, type Param, type Soil, type Tone, type Weather } from './lib/agro'
import { INDICATORS } from './lib/indicators'
import { ScaleBox, spectralIds } from './Scale'
import type { FarmData } from './lib/seva'

type Props = { farm: FarmData & { id: string; name: string } }
type Remote<T> = { key: string; data?: T; error?: string }

function Section({ title, sub, icon: Icon, items, empty, src = ['s2'] }: { src?: SourceKey[]; title: string; sub: string; icon: typeof CloudSun; items?: Param[]; empty: string }) {
  return <section className="ag-card"><div className="ag-head"><Icon size={17}/><h3>{title}</h3><small>{sub}</small></div>
    {items ? <div className="ag-grid">{items.map(p => <div key={p.label} className={`ag-item ${p.tone}`}><span>{p.label}</span><b>{p.value}</b><small>{p.note}</small></div>)}</div> : <div className="ag-empty">{/^Loading/.test(empty) ? <LogoLoader text={empty}/> : /fail|error|unavailable|could not/i.test(empty) ? <LogoLoader state="error" text={empty}/> : empty}</div>}<SourceNote of={src}/></section>
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
  const a = farm.analysis
  const spectral: Param[] | undefined = a?.means && INDICATORS.filter(i => i.source === 'S2' && i.ramp && a.means![i.id] !== undefined).map(i => {
    const v = a.means![i.id]
    const tone: Tone = i.id === 'ndvi' ? ndviClass(v).tone : 'neutral'
    return { label: i.name, value: v.toFixed(2), note: i.id === 'ndvi' ? `${ndviClass(v).label} · ${a.stressPct.toFixed(0)}% of pixels below 0.30` : i.desc, tone }
  })
  const terrain: Param[] | undefined = a && a.slopeDeg !== undefined ? [
    { label: 'Mean elevation', value: `${a.elevMean?.toFixed(0)} m`, note: 'Copernicus GLO-30 DEM', tone: 'neutral' },
    { label: 'Mean slope', value: `${a.slopeDeg.toFixed(1)}° (${a.slopePct?.toFixed(1)}%)`, note: a.slopeDeg > 8 ? 'Erosion risk: contour or terrace' : a.slopeDeg < 0.5 ? 'Very flat: check drainage' : 'Gentle, well drained', tone: a.slopeDeg > 8 ? 'warn' : 'good' },
  ] : undefined
  return <section className="ag-wrap">
    <div className="intelligence-heading"><h2>Agronomy parameters <span>Sentinel-2 · Open-Meteo · SoilGrids · Copernicus DEM</span></h2></div>
    <div className="ag-cols">
      <Section title="Crop & spectral indices" sub={a ? `Farm mean · ${new Date(a.scene.datetime).toLocaleDateString()}` : 'waiting for scene'} icon={Satellite} items={spectral} empty="Refresh to compute vegetation, water and soil indices from Sentinel-2." />
      <Section title="Weather & atmosphere" sub={w?.error ?? 'Open-Meteo, live'} icon={CloudSun} items={w?.data && weatherParams(w.data)} empty={w?.error ?? 'Loading weather…'}  src={['weather']}/>
      <Section title="Soil water & temperature" sub="Modelled by depth" icon={Thermometer} items={w?.data && soilWaterParams(w.data)} empty={w?.error ?? 'Loading soil moisture…'}  src={['weather', 'model']}/>
      <Section title="Soil properties" sub={s?.error ?? 'SoilGrids 250 m, 0-5 cm'} icon={Shovel} items={s?.data && soilParams(s.data)} empty={s?.error ?? 'Loading soil data…'}  src={['soil']}/>
      <Section title="Terrain" sub="Farm DEM statistics" icon={Mountain} items={terrain} empty="Elevation loads with the satellite analysis."  src={['dem']}/>
    </div>
    <details className="sc-guide" open><summary>How to read the spectral indices</summary><div className="sc-grid">{spectralIds.map(id => <ScaleBox key={id} id={id} compact/>)}</div></details>
    <div className="ag-key"><span><i className="good"/>Favourable</span><span><i className="warn"/>Watch</span><span><i className="bad"/>Act or risk</span><span><i/>Information only</span> Card edge colour shows the status of each value.</div>
    <small className="ag-note">Soil moisture, weather and SoilGrids are modelled at coarse resolution, not field sensors. Satellite indices use clear-sky pixels only.</small>
  </section>
}
