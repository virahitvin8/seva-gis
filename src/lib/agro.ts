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

export function regionalSoilFallback(lat: number, lon: number): Soil {
  const isIndia = lat >= 8 && lat <= 36 && lon >= 68 && lon <= 97
  const isGangetic = isIndia && lat >= 23 && lat <= 31 && lon >= 75 && lon <= 89
  const isDeccan = isIndia && lat >= 15 && lat <= 23 && lon >= 73 && lon <= 81
  const isArid = isIndia && lat >= 24 && lat <= 30 && lon >= 69 && lon <= 76
  const isSouthRed = isIndia && lat >= 8 && lat <= 16 && lon >= 75 && lon <= 80

  let clay: [number, number, number] = [24, 28, 30]
  let sand: [number, number, number] = [38, 34, 32]
  let silt: [number, number, number] = [38, 38, 38]
  let ph: [number, number, number] = [6.8, 7.0, 7.1]
  let soc: [number, number, number] = [8.5, 6.2, 4.5]
  let n: [number, number, number] = [0.95, 0.72, 0.50]
  let cec: [number, number, number] = [18.0, 19.5, 20.0]
  let bd: [number, number, number] = [1.38, 1.44, 1.48]

  if (isGangetic) {
    clay = [27, 31, 34]
    sand = [31, 29, 27]
    silt = [42, 40, 39]
    ph = [7.3, 7.5, 7.6]
    soc = [6.8, 5.2, 3.8]
    n = [0.82, 0.65, 0.48]
    cec = [18.5, 20.2, 21.0]
    bd = [1.36, 1.42, 1.46]
  } else if (isDeccan) {
    clay = [48, 52, 54]
    sand = [22, 20, 19]
    silt = [30, 28, 27]
    ph = [7.9, 8.1, 8.2]
    soc = [5.6, 4.2, 3.1]
    n = [0.62, 0.48, 0.35]
    cec = [36.0, 38.5, 40.0]
    bd = [1.30, 1.38, 1.44]
  } else if (isArid) {
    clay = [11, 13, 15]
    sand = [77, 75, 74]
    silt = [12, 12, 11]
    ph = [8.2, 8.4, 8.4]
    soc = [2.2, 1.8, 1.2]
    n = [0.32, 0.25, 0.18]
    cec = [7.2, 8.0, 8.5]
    bd = [1.54, 1.58, 1.62]
  } else if (isSouthRed) {
    clay = [28, 32, 35]
    sand = [54, 50, 48]
    silt = [18, 18, 17]
    ph = [6.2, 6.0, 5.8]
    soc = [5.8, 4.0, 2.9]
    n = [0.58, 0.45, 0.32]
    cec = [12.5, 14.0, 15.0]
    bd = [1.45, 1.50, 1.55]
  }

  return {
    phh2o: { name: 'phh2o', unit: 'pH', depths: ph },
    soc: { name: 'soc', unit: 'g/kg', depths: soc },
    clay: { name: 'clay', unit: '%', depths: clay },
    sand: { name: 'sand', unit: '%', depths: sand },
    silt: { name: 'silt', unit: '%', depths: silt },
    nitrogen: { name: 'nitrogen', unit: 'g/kg', depths: n },
    cec: { name: 'cec', unit: 'cmol/kg', depths: cec },
    bdod: { name: 'bdod', unit: 'kg/dm³', depths: bd },
  }
}

async function fetchSoil0(lat: number, lon: number): Promise<Soil> {
  const props = ['phh2o', 'soc', 'clay', 'sand', 'silt', 'nitrogen', 'cec', 'bdod'].map(p => `property=${p}`).join('&')
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3500)
    const res = await fetch(`${ISRIC}?lon=${lon}&lat=${lat}&${props}&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean`, {
      signal: ctrl.signal
    })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json(), out: Soil = {}
      for (const l of data.properties?.layers || []) {
        const f = l.unit_measure.d_factor || 1
        out[l.name] = { name: l.name, unit: l.unit_measure.target_units, depths: l.depths.map((x: { values: { mean: number | null } }) => (x.values.mean === null ? NaN : x.values.mean / f)) }
      }
      if (out.clay && out.sand && out.phh2o && Number.isFinite(out.clay.depths[0])) {
        return out
      }
    }
  } catch {
    // Network failure, timeout or 504 from ISRIC
  }
  return regionalSoilFallback(lat, lon)
}

const cache = new Map<string, { at: number; p: Promise<unknown> }>()
function cached<T>(kind: string, lat: number, lon: number, fn: (a: number, b: number) => Promise<T>, force = false): Promise<T> {
  const k = `${kind}:${lat.toFixed(4)}:${lon.toFixed(4)}`
  if (force) cache.delete(k)
  const hit = cache.get(k)
  if (hit && Date.now() - hit.at < 600000) return hit.p as Promise<T>
  const p = fn(lat, lon); cache.set(k, { at: Date.now(), p }); p.catch(() => cache.delete(k)); return p
}
export function invalidateAgroCache(kind?: 'w' | 's' | 'all') {
  if (!kind || kind === 'all') cache.clear()
  else {
    for (const k of cache.keys()) {
      if (k.startsWith(`${kind}:`)) cache.delete(k)
    }
  }
}
export const fetchWeather = (lat: number, lon: number, force = false) => cached('w', lat, lon, fetchWeather0, force)
export const fetchSoil = (lat: number, lon: number, force = false) => cached('s', lat, lon, fetchSoil0, force)

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

export function kidFriendlyIndicator(id: string, v: number, stressPct = 0): { label: string; note: string; tone: Tone } {
  switch (id) {
    case 'ndvi': {
      const cls = ndviClass(v)
      const meaning = v >= 0.6 ? 'Super Green & Strong' : v >= 0.45 ? 'Healthy Active Crop' : v >= 0.3 ? 'Moderate / Young Crop' : 'Sparse / Stressed Crop'
      return {
        label: 'Plant Health (NDVI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)} · ${stressPct.toFixed(0)}% weak pixels). Reason: Leaves absorb red sunlight and bounce near-infrared rays like mirrors. High score means lush, happy leaves.`,
        tone: cls.tone
      }
    }
    case 'evi': {
      const meaning = v >= 0.45 ? 'Thick layered foliage' : v >= 0.3 ? 'Moderate canopy' : 'Light canopy'
      return {
        label: 'Thick Canopy Growth (EVI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Measures real green leaf volume without getting blinded by heavy leaf density or bright sun glare.`,
        tone: v >= 0.4 ? 'good' : v >= 0.25 ? 'neutral' : 'warn'
      }
    }
    case 'savi': {
      const meaning = v >= 0.4 ? 'Solid crop establishment' : 'Young sprouts / sparse cover'
      return {
        label: 'True Growth Past Soil (SAVI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Filters out soil brightness so you see real plant growth even when bare dirt is showing through.`,
        tone: v >= 0.35 ? 'good' : 'neutral'
      }
    }
    case 'msavi': {
      const meaning = v >= 0.4 ? 'Strong vegetative canopy' : 'Early emergence stage'
      return {
        label: 'Auto-Cleaned Crop Score (MSAVI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Self-adjusts for soil color to measure exact baby or young crop leaves without false alarms.`,
        tone: v >= 0.35 ? 'good' : 'neutral'
      }
    }
    case 'gndvi': {
      const meaning = v >= 0.6 ? 'Well-fed with nitrogen' : v >= 0.4 ? 'Moderate nitrogen' : 'Hungry leaves (needs food)'
      return {
        label: 'Leaf Food & Nitrogen (GNDVI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Green light reflection shows how well plants are eating their nitrogen meals.`,
        tone: v >= 0.5 ? 'good' : v >= 0.35 ? 'neutral' : 'warn'
      }
    }
    case 'ndre': {
      const meaning = v >= 0.4 ? 'Deep canopy is rich green' : 'Early nitrogen hunger alert'
      return {
        label: 'Deep Canopy Health (NDRE)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Peeks deep into mature crops to catch nitrogen hunger days before human eyes see yellowing.`,
        tone: v >= 0.35 ? 'good' : 'warn'
      }
    }
    case 'cire': {
      const meaning = v >= 1.5 ? 'High chlorophyll reserves' : 'Moderate green pigment'
      return {
        label: 'Chlorophyll Fuel Gauge (CIre)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Directly counts green chlorophyll solar cells that turn sunlight into crop sugars.`,
        tone: v >= 1.2 ? 'good' : 'neutral'
      }
    }
    case 'nbr': {
      const meaning = v >= 0.35 ? 'Intact, living crop' : 'Dry stubble or damaged patch'
      return {
        label: 'Crop Surface Health (NBR)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Detects undamaged living crop; drops near zero if burned, scorched, or storm-damaged.`,
        tone: v >= 0.3 ? 'good' : 'warn'
      }
    }
    case 'ndwi': {
      const meaning = v < 0 ? 'Dry surface (no flood puddles)' : 'Standing water / puddle risk'
      return {
        label: 'Standing Water & Flooding (NDWI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Water absorbs infrared light. Negative score proves plants, not a standing flood pond.`,
        tone: v > 0.1 ? 'bad' : 'good'
      }
    }
    case 'mndwi': {
      const meaning = v < 0 ? 'No surface puddles' : 'Wet surface / waterlogged'
      return {
        label: 'Clean Water Puddles (MNDWI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Confirms dry surface soil without muddy standing flood water.`,
        tone: v > 0 ? 'warn' : 'good'
      }
    }
    case 'ndmi': {
      const meaning = v >= 0.2 ? 'Juicy, well-hydrated leaves' : v >= 0.05 ? 'Adequate leaf moisture' : 'Thirsty, wilting leaves'
      return {
        label: 'Leaf Water Juice (NDMI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Shows leaves have plenty of water inside and aren't drying out or wilting under sun.`,
        tone: v >= 0.15 ? 'good' : v >= 0 ? 'neutral' : 'bad'
      }
    }
    case 'msi': {
      const meaning = v <= 0.8 ? 'Low thirst (plants drink happily)' : 'High thirst (irrigate soon)'
      return {
        label: 'Crop Thirst Alarm (MSI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Lower score is better; shows how easily water is evaporating from leaf pores.`,
        tone: v <= 0.9 ? 'good' : 'warn'
      }
    }
    case 'ndbi': {
      const meaning = v < 0 ? 'Living vegetated farm ground' : 'Hard packed soil / road'
      return {
        label: 'Living Ground Check (NDBI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Negative score confirms healthy living farm land rather than bare stone or road.`,
        tone: v < 0 ? 'good' : 'neutral'
      }
    }
    case 'bsi': {
      const meaning = v < 0 ? 'Crop covers the ground' : 'Exposed bare soil visible'
      return {
        label: 'Exposed Bare Dirt (BSI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Negative means green crop canopy shields the soil; positive means tilled open dirt.`,
        tone: v < 0 ? 'good' : 'neutral'
      }
    }
    case 'stress': {
      const meaning = v <= 0.15 ? 'Safe (no hidden sickness)' : 'Early stress detected'
      return {
        label: 'Early Stress Radar',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Combines red-edge chlorophyll drop and water deficit to warn you 5 days before visible yellowing.`,
        tone: v <= 0.2 ? 'good' : 'bad'
      }
    }
    case 'reip': {
      const meaning = v >= 712 ? 'High nitrogen, young vigor' : 'Crop heading towards maturity'
      return {
        label: 'Peak Green Wave (REIP)',
        note: `Meaning: ${meaning} (${v.toFixed(1)} nm). Reason: Above 712 nm means leaves are loaded with nitrogen food and growing energetically.`,
        tone: v >= 710 ? 'good' : 'neutral'
      }
    }
    case 'lai': {
      return {
        label: 'Leaf Blanket Layers (LAI)',
        note: `Meaning: ${v.toFixed(1)} m² leaf area per m² ground. Reason: Tells you how many layers of green leaves cover your soil for biomass growth.`,
        tone: v >= 2 ? 'good' : 'neutral'
      }
    }
    case 'chla': {
      const meaning = v >= 3 ? 'High green pigment reserves' : 'Moderate green pigment'
      return {
        label: 'Krishi Leaf Greening (CIgreen)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: High green pigment means strong photosynthesis and fat grains/fruits forming.`,
        tone: v >= 2.5 ? 'good' : 'neutral'
      }
    }
    case 'tvdi': {
      const meaning = v <= 0.35 ? 'Cool & hydrated (no drought)' : 'Warm canopy under heat stress'
      return {
        label: 'Heat & Drought Pressure (TVDI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Cool plant temperature proves roots are drinking soil water to sweat and cool down.`,
        tone: v <= 0.4 ? 'good' : 'warn'
      }
    }
    case 'cwsi': {
      const meaning = v <= 0.3 ? 'Happy sweating crop' : 'Thirsty plant closing pores'
      return {
        label: 'Plant Sweat Index (CWSI)',
        note: `Meaning: ${meaning} (${v.toFixed(2)}). Reason: Near zero means leaf breathing pores are wide open, sweating, and happy.`,
        tone: v <= 0.3 ? 'good' : 'warn'
      }
    }
    case 'sar_wet': {
      const meaning = v >= 20 && v <= 55 ? 'Comfortable root moisture' : v > 70 ? 'Waterlogged roots' : 'Dry root bed'
      return {
        label: 'Root-Zone Water Balance (SAR)',
        note: `Meaning: ${meaning} (${v.toFixed(1)}%). Reason: Simulates radar echo and terrain drainage to check if roots have air or are drowning.`,
        tone: v > 70 ? 'warn' : 'good'
      }
    }
    case 'lst': {
      return {
        label: 'Ground Surface Temp (LST)',
        note: `Meaning: ${v.toFixed(1)} °C. Reason: Plant leaf canopy shades the soil from harsh sun heat, keeping roots cool.`,
        tone: v <= 35 ? 'good' : 'warn'
      }
    }
    default:
      return {
        label: id.toUpperCase(),
        note: `Meaning: Measured score ${v.toFixed(2)}. Reason: Farm satellite telemetry calculated for your field.`,
        tone: 'neutral'
      }
  }
}

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—')

export function weatherParams(w: Weather): Param[] {
  const bal = w.rain7 - w.et0Past7, balNext = w.rainNext7 - w.et0Next7
  const heat = w.tmaxNext7 >= 38, frost = w.tminNext7 <= 2
  const disease = w.rh >= 85 && w.temp >= 18 && w.temp <= 30
  return [
    { label: 'Air temperature', value: `${f(w.temp)} °C`, note: `Meaning: Today ${f(w.tminToday, 0)} to ${f(w.tmaxToday, 0)} °C. Reason: ${heat ? 'Heat risk; crops transpire rapidly.' : frost ? 'Frost alert; protect tender crops.' : 'Ideal warmth for plant enzymes to make sugars fast.'}`, tone: heat ? 'bad' : frost ? 'bad' : 'neutral' },
    { label: 'Humidity', value: `${f(w.rh, 0)} %`, note: `Meaning: ${w.rh >= 80 ? 'High air moisture' : 'Comfortable air moisture'}. Reason: ${disease ? 'Warm & humid air; inspect leaf undersides for fungal spots.' : 'Comfortable air keeps leaves crisp without mold risk.'}`, tone: disease ? 'warn' : 'neutral' },
    { label: 'Vapour pressure deficit', value: `${f(w.vpd, 2)} kPa`, note: `Meaning: ${w.vpd > 2 ? 'Air is very thirsty' : w.vpd < 0.4 ? 'Air is very damp' : 'Comfortable air breathing'}. Reason: ${w.vpd > 2 ? 'Air pulls water fast; plants close breathing pores.' : w.vpd < 0.4 ? 'Soggy air slows natural crop sweating.' : 'Sweet spot for plants to breathe and sweat naturally.'}`, tone: w.vpd > 2 ? 'bad' : 'neutral' },
    { label: 'Wind', value: `${f(w.wind)} km/h`, note: `Meaning: ${w.wind > 20 ? 'Breezy wind' : 'Gentle breeze'}. Reason: ${w.wind > 20 ? 'Hold off spraying sprays to avoid drifting onto neighbor plots.' : 'Calm breeze is safe for spraying foliar nutrition.'}`, tone: w.wind > 25 ? 'warn' : 'good' },
    { label: 'UV index', value: f(w.uv, 1), note: `Meaning: Daily max ${f(w.uvMax, 1)}. Reason: ${w.uvMax >= 8 ? 'Intense solar radiation; mulch bare soil to stop rapid drying.' : 'Mild sunlight without solar leaf scorch risk.'}`, tone: w.uvMax >= 8 ? 'warn' : 'neutral' },
    { label: 'Solar radiation', value: `${f(w.radToday)} MJ/m²`, note: `Meaning: Daylight solar energy. Reason: Powers daily crop photosynthesis and grain development.`, tone: 'neutral' },
    { label: 'Rain, last 7 days', value: `${f(w.rain7)} mm`, note: `Meaning: Last 30 days ${f(w.rain30, 0)} mm. Reason: Showers kept surface soil damp and washed dust off foliage.`, tone: 'neutral' },
    { label: 'Rain, next 7 days', value: `${f(w.rainNext7)} mm`, note: `Meaning: ${w.rainNext7 >= 15 ? 'Good showers coming' : 'Dry week ahead'}. Reason: ${w.rainNext7 >= 15 ? 'Natural rainfall will replenish soil moisture.' : 'Little rain expected; rely on pump/drip irrigation.'}`, tone: 'neutral' },
    { label: 'Evapotranspiration (ET0)', value: `${f(w.et0Past7)} mm`, note: `Meaning: Water evaporated into sky. Reason: Sun and breeze lifted ~${f(w.et0Past7, 0)} mm of moisture from your soil and crop.`, tone: 'neutral' },
    { label: 'Water balance, past 7 d', value: `${bal >= 0 ? '+' : ''}${f(bal)} mm`, note: `Meaning: ${bal < -15 ? 'Water deficit (needs irrigation)' : 'Adequate moisture'}. Reason: ${bal < -15 ? 'Plants drank more than rain gave; irrigate to maintain growth.' : 'Rainfall kept pace with crop water demand.'}`, tone: bal < -15 ? 'bad' : bal < 0 ? 'warn' : 'good' },
    { label: 'Water balance, next 7 d', value: `${balNext >= 0 ? '+' : ''}${f(balNext)} mm`, note: `Meaning: ${balNext < -20 ? 'Expect ~' + f(-balNext, 0) + ' mm deficit' : 'Balanced outlook'}. Reason: ${balNext < -20 ? 'Plan to apply ~20–25 mm irrigation over coming days.' : 'No major moisture shortage predicted.'}`, tone: balNext < -20 ? 'warn' : 'good' },
    { label: 'Growing degree days', value: `${f(w.gdd30, 0)} °C·d`, note: `Meaning: Heat points stored. Reason: Crop biological clock is ticking right on schedule towards maturity.`, tone: 'neutral' },
    { label: 'Heat / frost outlook', value: heat ? 'Heat risk' : frost ? 'Frost risk' : 'None', note: `Meaning: 7-day range ${f(w.tminNext7, 0)} to ${f(w.tmaxNext7, 0)} °C. Reason: No thermal shock; plants stay comfortable day and night.`, tone: heat || frost ? 'bad' : 'good' },
  ]
}

export function soilWaterParams(w: Weather): Param[] {
  const pct = (v: number) => `${f(v * 100, 0)} %`
  const root = w.soilM.d9_27
  return [
    { label: 'Soil moisture 0-1 cm', value: pct(w.soilM.d0_1), note: `Meaning: Surface skin dampness. Reason: Changes fast with sunshine; good for seeds just planted to sprout.`, tone: 'neutral' },
    { label: 'Soil moisture 3-9 cm', value: pct(w.soilM.d3_9), note: `Meaning: Seedling drinking zone. Reason: Moist zone where young roots pull easy water without drying out.`, tone: w.soilM.d3_9 < 0.12 ? 'warn' : 'neutral' },
    { label: 'Soil moisture 9-27 cm', value: pct(root), note: `Meaning: Active root zone water. Reason: Where 80% of mature feeding roots live; maintains rapid leaf growth.`, tone: root < 0.12 ? 'bad' : root < 0.2 ? 'warn' : 'good' },
    { label: 'Soil moisture 27-81 cm', value: pct(w.soilM.d27_81), note: `Meaning: Deep subsoil safety reserve. Reason: Acts as a backup tank that deep roots tap during dry weeks.`, tone: 'neutral' },
    { label: 'Soil temperature 0 cm', value: `${f(w.soilT.d0)} °C`, note: `Meaning: Surface ground warmth. Reason: Warms the plant base nicely without baking the crown.`, tone: 'neutral' },
    { label: 'Soil temperature 6 cm', value: `${f(w.soilT.d6)} °C`, note: `Meaning: Sprouting depth warmth. Reason: ${w.soilT.d6 < 10 ? 'Too cold for seeds to sprout.' : w.soilT.d6 > 35 ? 'Hot soil; shade or irrigate.' : 'Ideal warm bed for seeds to wake up and germinate fast.'}`, tone: w.soilT.d6 < 10 || w.soilT.d6 > 35 ? 'warn' : 'good' },
    { label: 'Soil temperature 18 cm', value: `${f(w.soilT.d18)} °C`, note: `Meaning: Active root bed warmth. Reason: Warm microbes busily digest fertilizers into ready plant food.`, tone: 'neutral' },
    { label: 'Soil temperature 54 cm', value: `${f(w.soilT.d54)} °C`, note: `Meaning: Deep earth temperature. Reason: Steady thermal buffer protecting the lower root system day and night.`, tone: 'neutral' },
  ]
}

export function soilParams(s: Soil): Param[] {
  const top = (k: string) => s[k]?.depths[0], mid = (k: string) => s[k]?.depths[1]
  const clay = top('clay'), sand = top('sand'), silt = top('silt'), ph = top('phh2o'), soc = top('soc'), n = top('nitrogen'), cec = top('cec'), bd = top('bdod')
  const phMeaning = ph < 5.5 ? 'Acidic soil' : ph > 8 ? 'Alkaline soil' : 'Ideal sweet soil'
  const phReason = ph < 5.5 ? 'Liming or wood ash helps unlock phosphorus.' : ph > 8 ? 'Add gypsum or organic compost to free micronutrients.' : 'Neutral sweetness allows roots to drink all fertilizers without blockages.'
  return [
    { label: 'Texture', value: textureClass(clay, sand, silt), note: `Meaning: Clay ${f(clay, 0)}% · silt ${f(silt, 0)}% · sand ${f(sand, 0)}%. Reason: Ideal balanced dirt; holds water like a sponge but still drains excess.`, tone: 'neutral' },
    { label: 'Soil pH', value: f(ph, 1), note: `Meaning: ${phMeaning} (${f(ph, 1)}). Reason: ${phReason}`, tone: ph < 5.5 || ph > 8 ? 'warn' : 'good' },
    { label: 'Organic carbon', value: `${f(soc)} g/kg`, note: `Meaning: Humus / Organic matter. Reason: ${soc < 10 ? 'Low humus; adding cow dung, compost or green manure will boost fertility.' : 'Good humus holding nutrients naturally.'}`, tone: soc < 10 ? 'warn' : 'good' },
    { label: 'Total nitrogen', value: `${f(n, 2)} g/kg`, note: `Meaning: Native soil nitrogen. Reason: ${n < 1 ? 'Moderate native nitrogen; feed crops with split doses during vegetative growth.' : 'Rich natural nitrogen supply in topsoil.'}`, tone: n < 1 ? 'warn' : 'good' },
    { label: 'Cation exchange (CEC)', value: `${f(cec)} cmol/kg`, note: `Meaning: Nutrient holding sponge. Reason: ${cec < 10 ? 'Low holding capacity; apply fertilizers in smaller frequent doses.' : 'Good holding capacity; holds onto fertilizer so heavy rain doesn\'t wash it away.'}`, tone: cec < 10 ? 'warn' : 'neutral' },
    { label: 'Bulk density', value: `${f(bd, 2)} kg/dm³`, note: `Meaning: Soil softness / looseness. Reason: ${bd > 1.6 ? 'Compacted ground; deep tilling will loosen soil.' : 'Soft and airy; roots can push down and breathe oxygen easily.'}`, tone: bd > 1.6 ? 'warn' : 'neutral' },
    { label: 'Clay at 5-15 cm', value: `${f(mid('clay'), 0)} %`, note: `Meaning: Subsurface clay layer. Reason: Catches sinking water so moisture stays within root reach.`, tone: 'neutral' },
  ]
}
