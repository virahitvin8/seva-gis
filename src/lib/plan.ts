export type Climate = { tmean: number[]; tmin: number[]; rain: number[]; et0: number[]; years: number; annualRain: number }
export type CropSpec = {
  id: string; name: string; family: 'cereal' | 'legume' | 'oilseed' | 'root' | 'cash' | 'perennial'
  t: [number, number, number, number]; ph: [number, number, number, number]; clay: [number, number]
  cycle: number; kc: number; slopeMax: number; waterlog: boolean
}

// Growth limits follow the FAO EcoCrop style: [absolute min, optimum low, optimum high, absolute max] of monthly mean temperature.
export const PLAN_CROPS: CropSpec[] = [
  { id: 'rice', name: 'Rice (paddy)', family: 'cereal', t: [16, 22, 30, 36], ph: [4.5, 5.5, 7, 8.5], clay: [25, 60], cycle: 4, kc: 1.15, slopeMax: 2, waterlog: true },
  { id: 'wheat', name: 'Wheat', family: 'cereal', t: [4, 12, 22, 30], ph: [5.5, 6.2, 7.8, 8.5], clay: [15, 40], cycle: 5, kc: 0.95, slopeMax: 8, waterlog: false },
  { id: 'maize', name: 'Maize', family: 'cereal', t: [10, 18, 27, 35], ph: [5.2, 5.8, 7.5, 8.2], clay: [15, 35], cycle: 4, kc: 1.05, slopeMax: 8, waterlog: false },
  { id: 'sorghum', name: 'Sorghum / millet', family: 'cereal', t: [12, 20, 32, 40], ph: [5, 5.8, 8, 8.7], clay: [10, 45], cycle: 4, kc: 0.85, slopeMax: 10, waterlog: false },
  { id: 'chickpea', name: 'Chickpea / pulses', family: 'legume', t: [5, 14, 26, 32], ph: [5.5, 6, 8, 8.8], clay: [10, 40], cycle: 4, kc: 0.8, slopeMax: 8, waterlog: false },
  { id: 'soy', name: 'Soybean', family: 'legume', t: [12, 20, 30, 36], ph: [5.2, 6, 7, 8], clay: [15, 40], cycle: 4, kc: 1, slopeMax: 8, waterlog: false },
  { id: 'groundnut', name: 'Groundnut', family: 'legume', t: [14, 22, 30, 36], ph: [5, 5.8, 7, 8], clay: [5, 25], cycle: 4, kc: 0.95, slopeMax: 8, waterlog: false },
  { id: 'mustard', name: 'Mustard / rapeseed', family: 'oilseed', t: [5, 12, 24, 32], ph: [5.5, 6, 7.8, 8.5], clay: [10, 40], cycle: 4, kc: 0.95, slopeMax: 10, waterlog: false },
  { id: 'cotton', name: 'Cotton', family: 'cash', t: [15, 21, 32, 38], ph: [5.5, 6, 8, 8.8], clay: [20, 50], cycle: 6, kc: 1.05, slopeMax: 6, waterlog: false },
  { id: 'sugarcane', name: 'Sugarcane', family: 'cash', t: [15, 24, 32, 38], ph: [5.5, 6.2, 7.8, 8.5], clay: [20, 50], cycle: 11, kc: 1.1, slopeMax: 5, waterlog: false },
  { id: 'tomato', name: 'Tomato / vegetables', family: 'cash', t: [10, 18, 27, 34], ph: [5.5, 6, 6.8, 7.8], clay: [10, 35], cycle: 4, kc: 1.05, slopeMax: 8, waterlog: false },
  { id: 'potato', name: 'Potato', family: 'root', t: [6, 14, 21, 28], ph: [4.8, 5.5, 6.5, 7.5], clay: [5, 25], cycle: 4, kc: 1.05, slopeMax: 8, waterlog: false },
]

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export async function fetchClimate(lat: number, lon: number): Promise<Climate> {
  const y = new Date().getFullYear(), years = 3
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${y - years}-01-01&end_date=${y - 1}-12-31&daily=temperature_2m_mean,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo archive returned ${res.status}`)
  const d = (await res.json()).daily
  const tm = Array(12).fill(0), tn = Array(12).fill(0), rn = Array(12).fill(0), et = Array(12).fill(0), days = Array(12).fill(0)
  ;(d.time as string[]).forEach((t, i) => {
    const m = Number(t.slice(5, 7)) - 1
    if (Number.isFinite(d.temperature_2m_mean[i])) { tm[m] += d.temperature_2m_mean[i]; tn[m] += d.temperature_2m_min[i]; days[m]++ }
    rn[m] += d.precipitation_sum[i] || 0; et[m] += d.et0_fao_evapotranspiration[i] || 0
  })
  const rain = rn.map(v => v / years)
  return { tmean: tm.map((v, m) => v / (days[m] || 1)), tmin: tn.map((v, m) => v / (days[m] || 1)), rain, et0: et.map(v => v / years), years, annualRain: rain.reduce((a, b) => a + b, 0) }
}

const trap = (v: number, [a, b, c, d]: number[]) => (v <= a || v >= d ? 0 : v < b ? (v - a) / (b - a) : v <= c ? 1 : (d - v) / (d - c))

export type Suit = {
  crop: CropSpec; score: number; limiting: string; bestMonth: number; monthScores: number[]
  temp: number; water: number; soil: number; terrain: number; waterNeed: number; rainSeason: number; irrigation: number; harvest: number
}

export function suitability(c: Climate, crop: CropSpec, soil: { ph?: number; clay?: number }, slopePct: number | undefined, irrigated: boolean): Suit {
  const months = Math.max(1, Math.round(crop.cycle))
  const monthScores: number[] = [], detail: Suit[] = []
  const phF = soil.ph === undefined ? 1 : Math.max(0.1, trap(soil.ph, crop.ph))
  const clayF = soil.clay === undefined ? 1 : soil.clay >= crop.clay[0] && soil.clay <= crop.clay[1] ? 1 : Math.max(0.3, 1 - 0.03 * Math.min(Math.abs(soil.clay - crop.clay[0]), Math.abs(soil.clay - crop.clay[1])))
  const soilF = Math.min(phF, clayF)
  const terrainF = slopePct === undefined ? 1 : slopePct <= crop.slopeMax ? 1 : Math.max(0, 1 - (slopePct - crop.slopeMax) / crop.slopeMax)
  for (let s = 0; s < 12; s++) {
    let tF = 1, rain = 0, need = 0
    for (let k = 0; k < months; k++) {
      const m = (s + k) % 12
      tF = Math.min(tF, trap(c.tmean[m], crop.t))
      if (c.tmin[m] < 3 && crop.t[0] > 3 && k > 0) tF = Math.min(tF, 0.4)
      rain += c.rain[m]; need += crop.kc * c.et0[m]
    }
    const cover = need ? rain / need : 1
    const wF = irrigated ? 1 : Math.min(1, cover / 0.8)
    const score = Math.round(100 * Math.min(tF, wF, soilF, terrainF))
    monthScores.push(score)
    const lim = [['temperature', tF], ['water', wF], ['soil', soilF], ['terrain', terrainF]].sort((a, b) => (a[1] as number) - (b[1] as number))[0][0] as string
    detail.push({ crop, score, limiting: lim, bestMonth: s, monthScores: [], temp: tF, water: wF, soil: soilF, terrain: terrainF, waterNeed: need, rainSeason: rain, irrigation: Math.max(0, need - 0.75 * rain), harvest: (s + months) % 12 })
  }
  const best = detail.reduce((a, b) => (b.score > a.score ? b : a))
  return { ...best, monthScores }
}

export const SUIT_BANDS = [
  { to: 40, label: 'Not suitable', color: '#d73027' }, { to: 60, label: 'Marginal', color: '#fdae61' }, { to: 80, label: 'Suitable', color: '#a6d96a' }, { to: Infinity, label: 'Highly suitable', color: '#1a9850' },
]
export const suitBand = (s: number) => SUIT_BANDS.find(b => s < b.to)!

const NEXT: Record<CropSpec['family'], string> = {
  cereal: 'Follow a cereal with a legume (chickpea, soybean, groundnut) to restore soil nitrogen and break cereal pests.',
  legume: 'After a legume, a nitrogen-hungry cereal such as maize or wheat uses the residual nitrogen well.',
  oilseed: 'After an oilseed, plant a cereal; avoid another crucifer for two seasons to limit clubroot and aphids.',
  root: 'After potato or roots, plant a cereal or legume; avoid tomato and other solanaceae for at least two seasons.',
  cash: 'After a heavy-feeding cash crop, rest the soil with a legume or green manure before the next cash crop.',
  perennial: 'Intercrop with legumes between rows while the trees are young.',
}
export const rotationAdvice = (crop: CropSpec) => NEXT[crop.family]
