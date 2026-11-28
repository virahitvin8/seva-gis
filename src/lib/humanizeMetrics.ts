import type { Analysis } from './seva'

export interface ReferenceCitation {
  id: string
  parameter: string
  dataset: string
  resolution: string
  formula: string
  acquisitionDate: string
  cloudPct?: number
  methodNote: string
}

export interface HumanizedAoiCondition {
  hasAnalysis: boolean
  aoiHealthScore: number | null // 0..100 derived strictly from real NDVI
  conditionLabel: string
  conditionTone: 'good' | 'warn' | 'bad' | 'neutral'
  moistureStatus: string
  moistureTone: 'good' | 'warn' | 'bad' | 'neutral'
  landCoverSummary: string
  waterNeedMm: number | null
  waterVolumeM3: number | null
  dailyWaterMm: number | null
  stressSharePct: number | null
  slopeLabel: string
  naviSummary: string
  skyTheme: 'sunny' | 'rain' | 'dry' | 'harvest'
  references: ReferenceCitation[]
}

/**
 * Translates raw satellite/weather/terrain observations into plain "Area of Interest Condition"
 * insights without fabricating any unmeasured number (Constitution Rule 3 & Rule 14).
 */
export function humanizeAoiCondition(input: {
  areaHa?: number
  analysis?: Analysis
  rain7dMm?: number
  soilMoisturePct?: number
  elevationM?: number
}): HumanizedAoiCondition {
  const a = input.analysis
  const ndvi = a?.ndvi?.mean
  const ndmi = a?.ndmi?.mean
  const ndwi = a?.means?.ndwi
  const ndbi = a?.means?.ndbi
  const slopePct = a?.slopePct
  const stressPct = a?.stressPct
  const sceneDate = a?.scene?.datetime ? a.scene.datetime.slice(0, 10) : 'Unavailable'
  const cloudPct = a?.scene?.cloud

  const hasAnalysis = typeof ndvi === 'number' && Number.isFinite(ndvi)
  const aoiHealthScore = hasAnalysis
    ? Math.max(0, Math.min(100, Math.round(((ndvi + 0.1) / 0.95) * 100)))
    : null

  let conditionLabel = 'Awaiting Sentinel-2 acquisition'
  let conditionTone: 'good' | 'warn' | 'bad' | 'neutral' = 'neutral'
  if (hasAnalysis) {
    if (ndvi >= 0.55) {
      conditionLabel = 'Strong vegetation cover across selected AOI'
      conditionTone = 'good'
    } else if (ndvi >= 0.30) {
      conditionLabel = 'Moderate vegetation / mixed ground cover'
      conditionTone = 'warn'
    } else {
      conditionLabel = 'Low greenness or sparse vegetation signal'
      conditionTone = 'bad'
    }
  }

  let moistureStatus = 'Canopy moisture pending scene'
  let moistureTone: 'good' | 'warn' | 'bad' | 'neutral' = 'neutral'
  if (typeof ndmi === 'number' && Number.isFinite(ndmi)) {
    if (ndmi >= 0.2) {
      moistureStatus = 'Adequate canopy moisture'
      moistureTone = 'good'
    } else if (ndmi >= 0.0) {
      moistureStatus = 'Moderate moisture — check topsoil'
      moistureTone = 'warn'
    } else {
      moistureStatus = 'Dry canopy / moisture deficit signal'
      moistureTone = 'bad'
    }
  }

  let landCoverSummary = 'Awaiting land cover classification'
  if (typeof ndwi === 'number' && ndwi > 0.1) {
    landCoverSummary = 'Surface water or flooded pockets indicated (NDWI > 0.10)'
  } else if (typeof ndbi === 'number' && ndbi > 0.1 && (!hasAnalysis || ndvi < 0.25)) {
    landCoverSummary = 'Built-up, rock, or bare compacted surface indicated'
  } else if (hasAnalysis) {
    landCoverSummary = ndvi >= 0.45 ? 'Dominated by active vegetative canopy' : 'Open ground / light vegetative cover'
  }

  // Real simple water balance estimate only when weather/area inputs exist
  const rain = typeof input.rain7dMm === 'number' && Number.isFinite(input.rain7dMm) ? input.rain7dMm : null
  const area = typeof input.areaHa === 'number' && input.areaHa > 0 ? input.areaHa : null
  let dailyWaterMm: number | null = null
  let waterNeedMm: number | null = null
  let waterVolumeM3: number | null = null

  if (rain !== null) {
    const baseDailyDemand = typeof ndmi === 'number' && ndmi < 0 ? 4.8 : 4.0
    dailyWaterMm = Number(baseDailyDemand.toFixed(1))
    const weeklyNeed = Math.max(0, baseDailyDemand * 7 - 0.75 * rain)
    waterNeedMm = Number(weeklyNeed.toFixed(1))
    if (area !== null) {
      waterVolumeM3 = Math.round(weeklyNeed * area * 10)
    }
  }

  const slopeLabel =
    typeof slopePct === 'number' && Number.isFinite(slopePct)
      ? slopePct < 2
        ? `Flat (${slopePct.toFixed(1)}% grade)`
        : slopePct <= 6
          ? `Gentle (${slopePct.toFixed(1)}% grade)`
          : `Steep (${slopePct.toFixed(1)}% grade)`
      : 'Copernicus GLO-30 DEM pending'

  let skyTheme: HumanizedAoiCondition['skyTheme'] = 'sunny'
  if (rain !== null && rain >= 18) skyTheme = 'rain'
  else if (typeof ndmi === 'number' && ndmi < 0.05) skyTheme = 'dry'
  else if (hasAnalysis && ndvi >= 0.3 && ndvi < 0.5) skyTheme = 'harvest'

  const naviSummary = !hasAnalysis
    ? 'Select or trace your Area of Interest on the map to stream real Sentinel-2 satellite values.'
    : typeof stressPct === 'number' && stressPct > 15
      ? `Overall AOI Health Score is ${aoiHealthScore}/100. About ${stressPct.toFixed(0)}% of clear pixels show low greenness (NDVI < 0.30) — walk those marked spots to verify.`
      : `Overall AOI Health Score is ${aoiHealthScore}/100 with ${moistureStatus.toLowerCase()}. Tap any metric card to inspect the exact satellite date and formula.`

  const references: ReferenceCitation[] = [
    {
      id: 'ndvi',
      parameter: 'Vegetative Vigor & Canopy Health (NDVI / EVI / SAVI)',
      dataset: 'ESA Sentinel-2 L2A Bottom-of-Atmosphere (Microsoft Planetary Computer STAC)',
      resolution: '10 m optical pixels (SCL cloud/shadow masked)',
      formula: 'NDVI = (B08 - B04) / (B08 + B04)',
      acquisitionDate: sceneDate,
      cloudPct,
      methodNote: 'Computed strictly inside the selected AOI boundary in-browser; pixels below NDVI 0.30 indicate sparse greenness.',
    },
    {
      id: 'moisture',
      parameter: 'Canopy Water & Surface Moisture (NDMI / NDWI)',
      dataset: 'ESA Sentinel-2 L2A SWIR / NIR + Open-Meteo',
      resolution: '20 m SWIR resampled to AOI grid',
      formula: 'NDMI = (B08 - B11) / (B08 + B11)',
      acquisitionDate: sceneDate,
      cloudPct,
      methodNote: 'Indicates canopy liquid water status and surface ponding; confirm with physical soil inspection.',
    },
    {
      id: 'terrain',
      parameter: 'Elevation, Drainage & Slope',
      dataset: 'Copernicus DEM GLO-30 + ISRIC SoilGrids 250m',
      resolution: '30 m elevation / 250 m soil grid',
      formula: 'Horn 3×3 gradient kernel + D8 flow routing',
      acquisitionDate: 'Static Terrain Reference',
      methodNote: 'Identifies relative low-lying drainage paths and high-potential borewell recharge corridors.',
    },
  ]

  return {
    hasAnalysis,
    aoiHealthScore,
    conditionLabel,
    conditionTone,
    moistureStatus,
    moistureTone,
    landCoverSummary,
    waterNeedMm,
    waterVolumeM3,
    dailyWaterMm,
    stressSharePct: typeof stressPct === 'number' ? Number(stressPct.toFixed(0)) : null,
    slopeLabel,
    naviSummary,
    skyTheme,
    references,
  }
}

