export type Tone = 'good' | 'warn' | 'bad' | 'neutral'
export type Param = { label: string; value: string; note: string; tone: Tone }
export type Weather = {
  time: string; temp: number; rh: number; vpd: number; wind: number; uv: number; cloud: number
  soilT: { d0: number; d6: number; d18: number; d54: number }
  soilM: { d0_1: number; d1_3: number; d3_9: number; d9_27: number; d27_81: number }
  rain30: number; rain7: number; rainNext7: number; et0Past7: number; et0Next7: number
  gdd30: number; gddNext7: number; tmaxToday: number; tminToday: number; radToday: number; uvMax: number
  tminNext7: number; tmaxNext7: number
}
export type SoilLayer = { name: string; unit: string; depths: number[] }
export type Soil = Record<string, SoilLayer>

const ISRIC = 'https://rest.isric.org/soilgrids/v2.0/properties/query'
const sum = (a: number[]) => a.reduce((x, y) => x + (y || 0), 0)

async function fetchWeather0(lat: number, lon: number): Promise<Weather> {
  const current = 'temperature_2m,relative_humidity_2m,vapour_pressure_deficit,wind_speed_10m,uv_index,cloud_cover,soil_temperature_0cm,soil_temperature_6cm,soil_temperature_18cm,soil_temperature_54cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,soil_moisture_27_to_81cm'
  const daily = 'et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min,shortwave_radiation_sum,uv_index_max'
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${current}&daily=${daily}&past_days=30&forecast_days=7&timezone=auto`)
  if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`)
  const d = await res.json(), c = d.current, day = d.daily
  const t0 = 30
  const past = (k: string, n: number) => (day[k] as number[]).slice(t0 - n, t0)
  const next = (k: string) => (day[k] as number[]).slice(t0, t0 + 7)
  const gdd = (mx: number[], mn: number[]) => sum(mx.map((x, i) => Math.max(0, (x + mn[i]) / 2 - 10)))
  return {
    time: c.time, temp: c.temperature_2m, rh: c.relative_humidity_2m, vpd: c.vapour_pressure_deficit, wind: c.wind_speed_10m, uv: c.uv_index, cloud: c.cloud_cover,
    soilT: { d0: c.soil_temperature_0cm, d6: c.soil_temperature_6cm, d18: c.soil_temperature_18cm, d54: c.soil_temperature_54cm },
    soilM: { d0_1: c.soil_moisture_0_to_1cm, d1_3: c.soil_moisture_1_to_3cm, d3_9: c.soil_moisture_3_to_9cm, d9_27: c.soil_moisture_9_to_27cm, d27_81: c.soil_moisture_27_to_81cm },
    rain30: sum(past('precipitation_sum', 30)), rain7: sum(past('precipitation_sum', 7)), rainNext7: sum(next('precipitation_sum')),
    et0Past7: sum(past('et0_fao_evapotranspiration', 7)), et0Next7: sum(next('et0_fao_evapotranspiration')),
    gdd30: gdd(past('temperature_2m_max', 30), past('temperature_2m_min', 30)), gddNext7: gdd(next('temperature_2m_max'), next('temperature_2m_min')),
    tmaxToday: day.temperature_2m_max[t0], tminToday: day.temperature_2m_min[t0], radToday: day.shortwave_radiation_sum[t0], uvMax: day.uv_index_max[t0],
    tminNext7: Math.min(...next('temperature_2m_min')), tmaxNext7: Math.max(...next('temperature_2m_max')),
  }
}

async function fetchSoil0(lat: number, lon: number): Promise<Soil> {
  const props = ['phh2o', 'soc', 'clay', 'sand', 'silt', 'nitrogen', 'cec', 'bdod'].map(p => `property=${p}`).join('&')
  const res = await fetch(`${ISRIC}?lon=${lon}&lat=${lat}&${props}&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean`)
  if (!res.ok) throw new Error(`SoilGrids returned ${res.status}`)
  const data = await res.json(), out: Soil = {}
  for (const l of data.properties.layers) {
    const f = l.unit_measure.d_factor || 1
    out[l.name] = { name: l.name, unit: l.unit_measure.target_units, depths: l.depths.map((x: { values: { mean: number | null } }) => (x.values.mean === null ? NaN : x.values.mean / f)) }
  }
  return out
}

const cache = new Map<string, { at: number; p: Promise<unknown> }>()
function cached<T>(kind: string, lat: number, lon: number, fn: (a: number, b: number) => Promise<T>): Promise<T> {
  const k = `${kind}:${lat.toFixed(4)}:${lon.toFixed(4)}`, hit = cache.get(k)
  if (hit && Date.now() - hit.at < 600000) return hit.p as Promise<T>
  const p = fn(lat, lon); cache.set(k, { at: Date.now(), p }); p.catch(() => cache.delete(k)); return p
}
export const fetchWeather = (lat: number, lon: number) => cached('w', lat, lon, fetchWeather0)
export const fetchSoil = (lat: number, lon: number) => cached('s', lat, lon, fetchSoil0)

export function textureClass(clay: number, sand: number, silt: number) {
  if (silt + 1.5 * clay < 15) return 'Sand'
  if (silt + 1.5 * clay < 30) return 'Loamy sand'
  if (clay >= 40 && silt < 40 && sand <= 45) return 'Clay'
  if (clay >= 40 && silt >= 40) return 'Silty clay'
  if (clay >= 35 && sand > 45) return 'Sandy clay'
  if (clay >= 27 && sand <= 20) return 'Silty clay loam'
  if (clay >= 27 && sand <= 45) return 'Clay loam'
  if (clay >= 20 && sand > 45 && silt < 28) return 'Sandy clay loam'
  if (silt >= 80 && clay < 12) return 'Silt'
  if (silt >= 50 && clay < 27) return 'Silt loam'
  if (clay < 7 && silt < 50 && sand > 52) return 'Sandy loam'
  if (clay < 20 && sand > 52) return 'Sandy loam'
  return 'Loam'
}

export function ndviClass(v: number): { label: string; tone: Tone } {
  if (v >= 0.6) return { label: 'Excellent', tone: 'good' }
  if (v >= 0.5) return { label: 'Good', tone: 'good' }
  if (v >= 0.35) return { label: 'Moderate', tone: 'warn' }
  if (v >= 0.2) return { label: 'Stressed', tone: 'bad' }
  return { label: 'Bare or severe stress', tone: 'bad' }
}

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—')

export function weatherParams(w: Weather): Param[] {
  const bal = w.rain7 - w.et0Past7, balNext = w.rainNext7 - w.et0Next7
  const heat = w.tmaxNext7 >= 38, frost = w.tminNext7 <= 2
  const disease = w.rh >= 85 && w.temp >= 18 && w.temp <= 30
  return [
    { label: 'Air temperature', value: `${f(w.temp)} °C`, note: `Today ${f(w.tminToday, 0)} to ${f(w.tmaxToday, 0)} °C`, tone: heat ? 'bad' : 'neutral' },
    { label: 'Humidity', value: `${f(w.rh, 0)} %`, note: disease ? 'Warm and humid: fungal disease risk' : 'Disease pressure low to moderate', tone: disease ? 'warn' : 'neutral' },
    { label: 'Vapour pressure deficit', value: `${f(w.vpd, 2)} kPa`, note: w.vpd > 2 ? 'High atmospheric demand, plants close stomata' : w.vpd < 0.4 ? 'Very humid air, slow transpiration' : 'Comfortable range for most crops', tone: w.vpd > 2 ? 'bad' : 'neutral' },
    { label: 'Wind', value: `${f(w.wind)} km/h`, note: w.wind > 25 ? 'Avoid spraying' : 'Suitable for spraying', tone: w.wind > 25 ? 'warn' : 'good' },
    { label: 'UV index', value: f(w.uv, 1), note: `Daily max ${f(w.uvMax, 1)}`, tone: w.uvMax >= 8 ? 'warn' : 'neutral' },
    { label: 'Solar radiation', value: `${f(w.radToday)} MJ/m²`, note: 'Shortwave, today', tone: 'neutral' },
    { label: 'Rain, last 7 days', value: `${f(w.rain7)} mm`, note: `Last 30 days: ${f(w.rain30, 0)} mm`, tone: 'neutral' },
    { label: 'Rain, next 7 days', value: `${f(w.rainNext7)} mm`, note: w.rainNext7 >= 15 ? 'Meaningful rain forecast' : 'Little rain forecast', tone: 'neutral' },
    { label: 'Evapotranspiration (ET0)', value: `${f(w.et0Past7)} mm`, note: `Past 7 days; next 7 days ${f(w.et0Next7)} mm`, tone: 'neutral' },
    { label: 'Water balance, past 7 d', value: `${bal >= 0 ? '+' : ''}${f(bal)} mm`, note: bal < -15 ? 'Crop water use exceeds rain: irrigate' : 'Rain roughly covers crop demand', tone: bal < -15 ? 'bad' : bal < 0 ? 'warn' : 'good' },
    { label: 'Water balance, next 7 d', value: `${balNext >= 0 ? '+' : ''}${f(balNext)} mm`, note: balNext < -20 ? 'Expect to irrigate about ' + f(-balNext, 0) + ' mm' : 'No major deficit expected', tone: balNext < -20 ? 'warn' : 'good' },
    { label: 'Growing degree days', value: `${f(w.gdd30, 0)} °C·d`, note: `Last 30 days, base 10 °C; next 7 days +${f(w.gddNext7, 0)}`, tone: 'neutral' },
    { label: 'Heat / frost outlook', value: heat ? 'Heat risk' : frost ? 'Frost risk' : 'None', note: `Next 7 days: ${f(w.tminNext7, 0)} to ${f(w.tmaxNext7, 0)} °C`, tone: heat || frost ? 'bad' : 'good' },
  ]
}

export function soilWaterParams(w: Weather): Param[] {
  const pct = (v: number) => `${f(v * 100, 0)} %`
  const root = w.soilM.d9_27
  return [
    { label: 'Soil moisture 0-1 cm', value: pct(w.soilM.d0_1), note: 'Surface skin, changes within hours', tone: 'neutral' },
    { label: 'Soil moisture 3-9 cm', value: pct(w.soilM.d3_9), note: 'Seedling zone', tone: w.soilM.d3_9 < 0.12 ? 'warn' : 'neutral' },
    { label: 'Soil moisture 9-27 cm', value: pct(root), note: 'Active root zone', tone: root < 0.12 ? 'bad' : root < 0.2 ? 'warn' : 'good' },
    { label: 'Soil moisture 27-81 cm', value: pct(w.soilM.d27_81), note: 'Deep reserve', tone: 'neutral' },
    { label: 'Soil temperature 0 cm', value: `${f(w.soilT.d0)} °C`, note: 'Surface', tone: 'neutral' },
    { label: 'Soil temperature 6 cm', value: `${f(w.soilT.d6)} °C`, note: w.soilT.d6 < 10 ? 'Too cold for most germination' : w.soilT.d6 > 35 ? 'Hot: root stress possible' : 'Suitable for germination', tone: w.soilT.d6 < 10 || w.soilT.d6 > 35 ? 'warn' : 'good' },
    { label: 'Soil temperature 18 cm', value: `${f(w.soilT.d18)} °C`, note: 'Root zone', tone: 'neutral' },
    { label: 'Soil temperature 54 cm', value: `${f(w.soilT.d54)} °C`, note: 'Deep', tone: 'neutral' },
  ]
}

export function soilParams(s: Soil): Param[] {
  const top = (k: string) => s[k]?.depths[0], mid = (k: string) => s[k]?.depths[1]
  const clay = top('clay'), sand = top('sand'), silt = top('silt'), ph = top('phh2o'), soc = top('soc'), n = top('nitrogen'), cec = top('cec'), bd = top('bdod')
  const phNote = ph < 5.5 ? 'Acidic: liming may help' : ph > 8 ? 'Alkaline: watch micronutrients' : ph >= 6 && ph <= 7.5 ? 'Ideal for most crops' : 'Acceptable'
  return [
    { label: 'Texture', value: textureClass(clay, sand, silt), note: `Clay ${f(clay, 0)} · silt ${f(silt, 0)} · sand ${f(sand, 0)} %`, tone: 'neutral' },
    { label: 'Soil pH', value: f(ph, 1), note: phNote, tone: ph < 5.5 || ph > 8 ? 'warn' : 'good' },
    { label: 'Organic carbon', value: `${f(soc)} g/kg`, note: soc < 10 ? 'Low organic matter' : soc > 20 ? 'Rich in organic matter' : 'Moderate', tone: soc < 10 ? 'warn' : 'good' },
    { label: 'Total nitrogen', value: `${f(n, 2)} g/kg`, note: n < 1 ? 'Low native nitrogen' : 'Adequate native nitrogen', tone: n < 1 ? 'warn' : 'good' },
    { label: 'Cation exchange (CEC)', value: `${f(cec)} cmol/kg`, note: cec < 10 ? 'Low nutrient holding capacity' : cec > 25 ? 'High nutrient holding capacity' : 'Moderate holding capacity', tone: cec < 10 ? 'warn' : 'neutral' },
    { label: 'Bulk density', value: `${f(bd, 2)} kg/dm³`, note: bd > 1.6 ? 'Compacted: roots restricted' : 'Normal', tone: bd > 1.6 ? 'warn' : 'neutral' },
    { label: 'Clay at 5-15 cm', value: `${f(mid('clay'), 0)} %`, note: 'Subsurface drainage indicator', tone: 'neutral' },
  ]
}
