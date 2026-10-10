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
  if (v >= 0.6) return { label: 'Strong green cover', tone: 'good' }
  if (v >= 0.5) return { label: 'Steady green cover', tone: 'good' }
  if (v >= 0.35) return { label: 'Cover building', tone: 'warn' }
  if (v >= 0.2) return { label: 'Thin green cover', tone: 'warn' }
  return { label: 'Little green cover', tone: 'bad' }
}

export function kidFriendlyIndicator(id: string, v: number, stressPct = 0): { label: string; note: string; tone: Tone } {
  switch (id) {
    case 'ndvi': {
      const cls = ndviClass(v)
      const condition = v >= 0.6 ? 'Most of the field has strong green cover in this image.' : v >= 0.45 ? 'The field has a steady green-cover signal.' : v >= 0.3 ? 'Green cover is still building, or parts of the field are thinner.' : 'There is little green cover in this image; this can be normal after harvest or early planting.'
      return {
        label: 'Plant Health (NDVI)',
        note: `NDVI is ${v.toFixed(2)} (a 0–1 style score, not a percent). ${condition} About ${stressPct.toFixed(0)}% of clear field pixels fall below the app's low-cover flag. Walk those patches and compare with the crop's age; this image cannot tell the cause by itself.`,
        tone: cls.tone
      }
    }
    case 'evi': {
      const condition = v >= 0.45 ? 'The canopy looks full in this pass.' : v >= 0.3 ? 'The canopy is filling in.' : 'The image shows lighter plant cover.'
      return {
        label: 'Canopy cover (EVI)',
        note: `EVI is ${v.toFixed(2)}. ${condition} Compare with the same field over time, and check thin-looking patches in person; crop stage and weeds can change this reading.`,
        tone: v >= 0.4 ? 'good' : v >= 0.25 ? 'neutral' : 'warn'
      }
    }
    case 'savi': {
      const condition = v >= 0.4 ? 'Plants cover much of the soil in this image.' : 'Soil is still visible between plants, which can be expected early in the season.'
      return {
        label: 'Crop cover with soil showing (SAVI)',
        note: `SAVI is ${v.toFixed(2)}. ${condition} Use it to follow crop cover as it closes over the rows; it does not measure yield.`,
        tone: v >= 0.35 ? 'good' : 'neutral'
      }
    }
    case 'msavi': {
      return {
        label: 'Young crop cover (MSAVI)',
        note: `MSAVI is ${v.toFixed(2)}. It helps track sparse cover where soil is visible. A low value can simply mean the crop has not filled the rows yet; check planting date and field edges.`,
        tone: v >= 0.35 ? 'good' : 'neutral'
      }
    }
    case 'gndvi': {
      return {
        label: 'Leaf greenness signal (GNDVI)',
        note: `GNDVI is ${v.toFixed(2)}. It gives another view of leaf greenness, but it cannot confirm a nitrogen shortage. If a patch looks pale, compare crop age and ask for a soil or leaf test before changing fertilizer.`,
        tone: v >= 0.5 ? 'good' : v >= 0.35 ? 'neutral' : 'warn'
      }
    }
    case 'ndre': {
      return {
        label: 'Mature canopy greenness (NDRE)',
        note: `NDRE is ${v.toFixed(2)}. It can help compare dense crop areas that look alike from above. A low patch is a reason to inspect, not proof of nitrogen hunger or an early diagnosis.`,
        tone: v >= 0.35 ? 'good' : 'warn'
      }
    }
    case 'cire': {
      return {
        label: 'Leaf colour signal (CIre)',
        note: `CIre is ${v.toFixed(2)}. Higher readings often go with greener leaves in this image. Compare the same crop and growth stage; this is not a direct leaf test or fertilizer recommendation.`,
        tone: v >= 1.2 ? 'good' : 'neutral'
      }
    }
    case 'nbr': {
      return {
        label: 'Crop cover change signal (NBR)',
        note: `NBR is ${v.toFixed(2)}. Use the map to spot areas that look different from the rest, then check for harvest, dry residue, fire, or crop damage on the ground. The score alone cannot identify what happened.`,
        tone: v >= 0.3 ? 'good' : 'warn'
      }
    }
    case 'ndwi': {
      return {
        label: 'Surface water signal (NDWI)',
        note: `NDWI is ${v.toFixed(2)}. A higher signal can mark open water or very wet surfaces. Check low spots after rain; this satellite score alone cannot confirm flooding or drainage.`,
        tone: v > 0.1 ? 'bad' : 'good'
      }
    }
    case 'mndwi': {
      return {
        label: 'Open-water check (MNDWI)',
        note: `MNDWI is ${v.toFixed(2)}. Use bright patches as places to check for standing water, wet soil, or a non-field surface. Confirm in person before changing drainage.`,
        tone: v > 0 ? 'warn' : 'good'
      }
    }
    case 'ndmi': {
      const condition = v >= 0.2 ? 'The canopy has a stronger moisture signal in this pass.' : v >= 0.05 ? 'The canopy moisture signal is in the middle range.' : 'The canopy moisture signal is low.'
      return {
        label: 'Canopy moisture signal (NDMI)',
        note: `NDMI is ${v.toFixed(2)}. ${condition} Check soil near the roots and compare with recent rain before deciding to irrigate; this is not a soil moisture reading.`,
        tone: v >= 0.15 ? 'good' : v >= 0 ? 'neutral' : 'bad'
      }
    }
    case 'msi': {
      return {
        label: 'Canopy dryness signal (MSI)',
        note: `MSI is ${v.toFixed(2)}. Higher values can point to a drier-looking canopy. Check the affected rows and soil moisture before planning irrigation.`,
        tone: v <= 0.9 ? 'good' : 'warn'
      }
    }
    case 'ndbi': {
      return {
        label: 'Bare or built surface signal (NDBI)',
        note: `NDBI is ${v.toFixed(2)}. Use the map to find exposed or built-looking patches; dry soil, roads, roofs, and crop residue can look similar from space.`,
        tone: v < 0 ? 'good' : 'neutral'
      }
    }
    case 'bsi': {
      return {
        label: 'Exposed soil signal (BSI)',
        note: `BSI is ${v.toFixed(2)}. Brighter areas may have more soil showing between rows. Check whether this is expected for the crop stage or a patch where plants failed to establish.`,
        tone: v < 0 ? 'good' : 'neutral'
      }
    }
    case 'stress': {
      return {
        label: 'Combined stress flag',
        note: `The app's stress flag is ${Math.round(v * 100)} out of 100. It combines several satellite signals to highlight a patch for a closer look; it does not identify a cause or promise advance warning.`,
        tone: v <= 0.2 ? 'good' : 'bad'
      }
    }
    case 'reip': {
      return {
        label: 'Canopy colour point (REIP)',
        note: `REIP is ${v.toFixed(1)} nm. It tracks a change in the crop's colour response. Compare like-for-like crop stages; it is not a direct nitrogen or maturity test.`,
        tone: v >= 710 ? 'good' : 'neutral'
      }
    }
    case 'lai': {
      return {
        label: 'Estimated leaf cover (LAI)',
        note: `The model estimates ${v.toFixed(1)} m² of leaf area per m² of ground. Treat this as a rough canopy-cover guide, not a leaf count or a harvest estimate.`,
        tone: v >= 2 ? 'good' : 'neutral'
      }
    }
    case 'chla': {
      return {
        label: 'Leaf greenness estimate (CIgreen)',
        note: `CIgreen is ${v.toFixed(2)}. It is a satellite estimate related to leaf greenness, not a measurement of chlorophyll in a leaf sample or a prediction of grain or fruit size.`,
        tone: v >= 2.5 ? 'good' : 'neutral'
      }
    }
    default:
      return {
        label: id.toUpperCase(),
        note: `${id.toUpperCase()} is ${v.toFixed(2)} in this image. Use the coloured map to find areas to inspect, and confirm important decisions in the field.`,
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
    { label: 'Air temperature', value: `${f(w.temp)} °C`, note: `Today is forecast at ${f(w.tminToday, 0)}–${f(w.tmaxToday, 0)} °C. The coming week reaches ${f(w.tmaxNext7, 0)} °C high and ${f(w.tminNext7, 0)} °C low; check local conditions if heat or cold is forecast.`, tone: heat || frost ? 'warn' : 'neutral' },
    { label: 'Humidity', value: `${f(w.rh, 0)} %`, note: `${w.rh >= 80 ? 'Air is humid.' : 'Air is not especially humid.'} When it is warm and humid, check leaves for disease symptoms; weather alone cannot tell whether a crop is infected.`, tone: disease ? 'warn' : 'neutral' },
    { label: 'Air dryness for crops (VPD)', value: `${f(w.vpd, 2)} kPa`, note: `${w.vpd > 2 ? 'The air may draw water from leaves quickly.' : w.vpd < 0.4 ? 'The air is very damp.' : 'The air is in a moderate dryness range.'} Check the crop and soil together; this is a weather estimate, not a plant reading.`, tone: w.vpd > 2 ? 'warn' : 'neutral' },
    { label: 'Wind', value: `${f(w.wind)} km/h`, note: `${w.wind > 20 ? 'Wind may carry spray off target.' : 'Winds are lighter in this forecast.'} Check the product label and wind at the field before spraying.`, tone: w.wind > 20 ? 'warn' : 'neutral' },
    { label: 'UV index', value: f(w.uv, 1), note: `Forecast daily peak is ${f(w.uvMax, 1)}. This describes sun exposure; it does not predict crop damage or soil drying by itself.`, tone: w.uvMax >= 8 ? 'warn' : 'neutral' },
    { label: 'Solar energy today', value: `${f(w.radToday)} MJ/m²`, note: 'A weather estimate of sunlight reaching the ground today. Cloud and shade across the field can differ from the regional model.', tone: 'neutral' },
    { label: 'Rain, last 7 days', value: `${f(w.rain7)} mm`, note: `${f(w.rain30, 0)} mm is estimated for the last 30 days. Compare this with your rain gauge; nearby storms can miss a field.`, tone: 'neutral' },
    { label: 'Rain forecast, next 7 days', value: `${f(w.rainNext7)} mm`, note: `${w.rainNext7 >= 15 ? 'Rain is in the forecast.' : 'Only a little rain is forecast.'} Check the local forecast again before irrigation or field work.`, tone: 'neutral' },
    { label: 'Reference water demand (ET₀)', value: `${f(w.et0Past7)} mm`, note: 'This estimates water demand from a standard reference surface over the past week. Your crop may use more or less depending on its stage and local conditions.', tone: 'neutral' },
    { label: 'Rain minus reference demand, past 7 days', value: `${bal >= 0 ? '+' : ''}${f(bal)} mm`, note: `${bal < -15 ? 'Reference demand was greater than recorded rain.' : bal < 0 ? 'Rain was a little below reference demand.' : 'Recorded rain met or exceeded reference demand.'} This is a rough weather balance, not a direct measurement of water in your root zone.`, tone: bal < -15 ? 'warn' : bal < 0 ? 'neutral' : 'good' },
    { label: 'Rain minus reference demand, next 7 days', value: `${balNext >= 0 ? '+' : ''}${f(balNext)} mm`, note: `${balNext < -20 ? 'The forecast points to a dry week.' : balNext < 0 ? 'Some water demand may exceed forecast rain.' : 'Forecast rain may meet reference demand.'} Check soil near the crop before deciding how much to irrigate.`, tone: balNext < -20 ? 'warn' : 'neutral' },
    { label: 'Accumulated warmth (GDD)', value: `${f(w.gdd30, 0)} °C·d`, note: 'A running temperature total used to compare crop development. It only helps when paired with the right crop, planting date, and growth stage.', tone: 'neutral' },
    { label: 'Heat / frost outlook', value: heat ? 'Heat may occur' : frost ? 'Cold may occur' : 'No strong alert', note: `Forecast range for the next week is ${f(w.tminNext7, 0)}–${f(w.tmaxNext7, 0)} °C. Check a local forecast and the crop's sensitivity before taking action.`, tone: heat || frost ? 'warn' : 'good' },
  ]
}

export function soilWaterParams(w: Weather): Param[] {
  const pct = (v: number) => `${f(v * 100, 0)} %`
  const root = w.soilM.d9_27
  return [
    { label: 'Soil moisture 0–1 cm', value: pct(w.soilM.d0_1), note: 'Estimated moisture in the top skin of soil. It can change quickly after sun or rain; check the seed bed by hand.', tone: 'neutral' },
    { label: 'Soil moisture 3–9 cm', value: pct(w.soilM.d3_9), note: 'A model estimate around shallow roots. If seedlings look limp, feel the soil at their root depth before watering.', tone: w.soilM.d3_9 < 0.12 ? 'warn' : 'neutral' },
    { label: 'Soil moisture 9–27 cm', value: pct(root), note: 'Estimated moisture below the surface. Check soil in the crop’s active root zone; this broad-area model is not a field sensor.', tone: root < 0.12 ? 'warn' : root < 0.2 ? 'neutral' : 'good' },
    { label: 'Soil moisture 27–81 cm', value: pct(w.soilM.d27_81), note: 'A deeper-layer estimate. Whether roots can reach this water depends on the crop and soil layers.', tone: 'neutral' },
    { label: 'Soil temperature at surface', value: `${f(w.soilT.d0)} °C`, note: 'Modelled ground temperature at the surface; use a thermometer in the field for seed or planting decisions.', tone: 'neutral' },
    { label: 'Soil temperature at 6 cm', value: `${f(w.soilT.d6)} °C`, note: `${w.soilT.d6 < 10 ? 'This model is showing cool soil.' : w.soilT.d6 > 35 ? 'This model is showing hot soil.' : 'This model is showing moderate soil warmth.'} Check the actual seed depth before planting or re-sowing.`, tone: w.soilT.d6 < 10 || w.soilT.d6 > 35 ? 'warn' : 'neutral' },
    { label: 'Soil temperature at 18 cm', value: `${f(w.soilT.d18)} °C`, note: 'A model estimate below the surface. Local shade, moisture, and soil cover can change the temperature in your field.', tone: 'neutral' },
    { label: 'Soil temperature at 54 cm', value: `${f(w.soilT.d54)} °C`, note: 'A broad-area estimate of deeper soil temperature, not a direct reading from the farm.', tone: 'neutral' },
  ]
}

export function soilParams(s: Soil): Param[] {
  const top = (k: string) => s[k]?.depths[0], mid = (k: string) => s[k]?.depths[1]
  const clay = top('clay'), sand = top('sand'), silt = top('silt'), ph = top('phh2o'), soc = top('soc'), n = top('nitrogen'), cec = top('cec'), bd = top('bdod')
  const phMeaning = ph < 5.5 ? 'on the acidic side' : ph > 8 ? 'on the alkaline side' : 'within a broad middle range'
  return [
    { label: 'Soil texture', value: textureClass(clay, sand, silt), note: `Model estimate: ${f(sand, 0)}% sand, ${f(silt, 0)}% silt, and ${f(clay, 0)}% clay near the surface. Sandy soil often drains faster; more clay can hold water longer. Check a handful of soil to confirm.`, tone: 'neutral' },
    { label: 'Soil pH', value: f(ph, 1), note: `The model places this soil ${phMeaning}. pH can affect how available nutrients are, but this is a regional estimate. Get a soil test before adding lime, gypsum, ash, or fertilizer.`, tone: ph < 5.5 || ph > 8 ? 'warn' : 'neutral' },
    { label: 'Organic carbon', value: `${f(soc)} g/kg`, note: `Estimated carbon in the topsoil: ${f(soc)} g/kg. Carbon is part of soil organic matter, which helps soil hold structure and nutrients. Confirm with a soil test before changing inputs.`, tone: soc < 10 ? 'warn' : 'neutral' },
    { label: 'Total nitrogen', value: `${f(n, 2)} g/kg`, note: `Estimated total nitrogen in the topsoil. It is not the same as nitrogen immediately available to this crop; use a soil test and crop advice to plan fertilizer.`, tone: n < 1 ? 'warn' : 'neutral' },
    { label: 'Nutrient-holding capacity (CEC)', value: `${f(cec)} cmol/kg`, note: `CEC estimates how well soil can hold some nutrients. Lower values can mean nutrients wash through more easily, but fertilizer timing should follow a field test and crop plan.`, tone: cec < 10 ? 'warn' : 'neutral' },
    { label: 'Bulk density', value: `${f(bd, 2)} kg/dm³`, note: `This model estimates how tightly packed the soil is. If roots struggle or water ponds, check the soil with a spade; do not till deeply from this number alone.`, tone: bd > 1.6 ? 'warn' : 'neutral' },
    { label: 'Clay at 5–15 cm', value: `${f(mid('clay'), 0)} %`, note: 'Regional estimate of clay just below the surface. Compare it with a soil pit; a local layer can affect how quickly water moves down.', tone: 'neutral' },
  ]
}
