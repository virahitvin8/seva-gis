export type GrowthStage = 'sowing' | 'vegetative' | 'flowering' | 'grain_fill' | 'maturity'

export type CropStageDef = {
  id: GrowthStage
  name: string
  kcMultiplier: number
  healthyNdviRange: [number, number]
  optimalNdmi: number
  waterSensitivity: 'low' | 'moderate' | 'critical'
  advisory: string
}

export const GROWTH_STAGES: CropStageDef[] = [
  {
    id: 'sowing',
    name: 'Sowing / Emergence',
    kcMultiplier: 0.45,
    healthyNdviRange: [0.18, 0.35],
    optimalNdmi: 0.05,
    waterSensitivity: 'moderate',
    advisory: 'Check whether the rows have emerged evenly. Feel the seed bed and look for crusting or ponded water.',
  },
  {
    id: 'vegetative',
    name: 'Vegetative / Tillering',
    kcMultiplier: 0.85,
    healthyNdviRange: [0.45, 0.72],
    optimalNdmi: 0.22,
    waterSensitivity: 'moderate',
    advisory: 'The crop is building leaves and roots. Compare thin and dense patches, then check the soil and plants in person.',
  },
  {
    id: 'flowering',
    name: 'Flowering / Heading (Peak)',
    kcMultiplier: 1.15,
    healthyNdviRange: [0.72, 0.88],
    optimalNdmi: 0.35,
    waterSensitivity: 'critical',
    advisory: 'During flowering, visit the crop regularly. If plants wilt or the root zone is dry, follow local crop advice before watering.',
  },
  {
    id: 'grain_fill',
    name: 'Grain Filling / Pod Set',
    kcMultiplier: 0.95,
    healthyNdviRange: [0.58, 0.78],
    optimalNdmi: 0.25,
    waterSensitivity: 'moderate',
    advisory: 'As grain or pods fill, check whether the crop is staying even across the field and watch for dry patches.',
  },
  {
    id: 'maturity',
    name: 'Maturity / Ripening',
    kcMultiplier: 0.55,
    healthyNdviRange: [0.35, 0.55],
    optimalNdmi: 0.10,
    waterSensitivity: 'low',
    advisory: 'Greenness can fade as the crop ripens. Check the crop and harvest timing before deciding whether a change is normal.',
  },
]

export type CropSpec = {
  id: string
  name: string
  category: 'Cereal' | 'Commercial' | 'Pulse' | 'Oilseed' | 'Vegetable'
  durationDays: number
  stages: Record<GrowthStage, { days: [number, number]; ndviExpected: number }>
}

export const EXTENDED_CROPS: CropSpec[] = [
  {
    id: 'paddy',
    name: 'Paddy / Rice',
    category: 'Cereal',
    durationDays: 120,
    stages: {
      sowing: { days: [0, 20], ndviExpected: 0.25 },
      vegetative: { days: [20, 55], ndviExpected: 0.60 },
      flowering: { days: [55, 80], ndviExpected: 0.84 },
      grain_fill: { days: [80, 105], ndviExpected: 0.70 },
      maturity: { days: [105, 120], ndviExpected: 0.45 },
    },
  },
  {
    id: 'wheat',
    name: 'Wheat',
    category: 'Cereal',
    durationDays: 130,
    stages: {
      sowing: { days: [0, 25], ndviExpected: 0.22 },
      vegetative: { days: [25, 60], ndviExpected: 0.58 },
      flowering: { days: [60, 90], ndviExpected: 0.80 },
      grain_fill: { days: [90, 115], ndviExpected: 0.68 },
      maturity: { days: [115, 130], ndviExpected: 0.42 },
    },
  },
  {
    id: 'cotton',
    name: 'Cotton',
    category: 'Commercial',
    durationDays: 160,
    stages: {
      sowing: { days: [0, 30], ndviExpected: 0.20 },
      vegetative: { days: [30, 70], ndviExpected: 0.55 },
      flowering: { days: [70, 110], ndviExpected: 0.78 },
      grain_fill: { days: [110, 140], ndviExpected: 0.65 },
      maturity: { days: [140, 160], ndviExpected: 0.40 },
    },
  },
  {
    id: 'maize',
    name: 'Maize (Corn)',
    category: 'Cereal',
    durationDays: 105,
    stages: {
      sowing: { days: [0, 20], ndviExpected: 0.24 },
      vegetative: { days: [20, 50], ndviExpected: 0.62 },
      flowering: { days: [50, 75], ndviExpected: 0.85 },
      grain_fill: { days: [75, 95], ndviExpected: 0.72 },
      maturity: { days: [95, 105], ndviExpected: 0.48 },
    },
  },
  {
    id: 'sugarcane',
    name: 'Sugarcane',
    category: 'Commercial',
    durationDays: 360,
    stages: {
      sowing: { days: [0, 45], ndviExpected: 0.28 },
      vegetative: { days: [45, 180], ndviExpected: 0.70 },
      flowering: { days: [180, 270], ndviExpected: 0.88 },
      grain_fill: { days: [270, 330], ndviExpected: 0.82 },
      maturity: { days: [330, 360], ndviExpected: 0.65 },
    },
  },
  {
    id: 'soybean',
    name: 'Soybean',
    category: 'Oilseed',
    durationDays: 100,
    stages: {
      sowing: { days: [0, 20], ndviExpected: 0.22 },
      vegetative: { days: [20, 45], ndviExpected: 0.56 },
      flowering: { days: [45, 70], ndviExpected: 0.80 },
      grain_fill: { days: [70, 90], ndviExpected: 0.66 },
      maturity: { days: [90, 100], ndviExpected: 0.38 },
    },
  },
  {
    id: 'mustard',
    name: 'Mustard',
    category: 'Oilseed',
    durationDays: 110,
    stages: {
      sowing: { days: [0, 20], ndviExpected: 0.20 },
      vegetative: { days: [20, 50], ndviExpected: 0.54 },
      flowering: { days: [50, 75], ndviExpected: 0.76 },
      grain_fill: { days: [75, 95], ndviExpected: 0.62 },
      maturity: { days: [95, 110], ndviExpected: 0.36 },
    },
  },
  {
    id: 'tomato',
    name: 'Tomato',
    category: 'Vegetable',
    durationDays: 115,
    stages: {
      sowing: { days: [0, 25], ndviExpected: 0.24 },
      vegetative: { days: [25, 50], ndviExpected: 0.58 },
      flowering: { days: [50, 80], ndviExpected: 0.82 },
      grain_fill: { days: [80, 100], ndviExpected: 0.74 },
      maturity: { days: [100, 115], ndviExpected: 0.52 },
    },
  },
  {
    id: 'potato',
    name: 'Potato',
    category: 'Vegetable',
    durationDays: 100,
    stages: {
      sowing: { days: [0, 20], ndviExpected: 0.22 },
      vegetative: { days: [20, 45], ndviExpected: 0.60 },
      flowering: { days: [45, 75], ndviExpected: 0.84 },
      grain_fill: { days: [75, 90], ndviExpected: 0.70 },
      maturity: { days: [90, 100], ndviExpected: 0.46 },
    },
  },
  {
    id: 'pulses',
    name: 'Pulses (Gram / Lentil / Pigeonpea)',
    category: 'Pulse',
    durationDays: 120,
    stages: {
      sowing: { days: [0, 25], ndviExpected: 0.20 },
      vegetative: { days: [25, 55], ndviExpected: 0.52 },
      flowering: { days: [55, 85], ndviExpected: 0.72 },
      grain_fill: { days: [85, 105], ndviExpected: 0.60 },
      maturity: { days: [105, 120], ndviExpected: 0.38 },
    },
  },
  {
    id: 'uncultivated',
    name: 'Uncultivated / Bare Land',
    category: 'Commercial',
    durationDays: 365,
    stages: {
      sowing: { days: [0, 60], ndviExpected: 0.15 },
      vegetative: { days: [60, 180], ndviExpected: 0.18 },
      flowering: { days: [180, 270], ndviExpected: 0.20 },
      grain_fill: { days: [270, 330], ndviExpected: 0.18 },
      maturity: { days: [330, 365], ndviExpected: 0.15 },
    },
  },
]

export function matchCropSpec(cropName: string = ''): CropSpec {
  const norm = cropName.toLowerCase().trim()
  if (norm.includes('bare') || norm.includes('uncultivated') || norm.includes('fallow') || norm.includes('waste')) {
    return EXTENDED_CROPS.find(c => c.id === 'uncultivated')!
  }
  // Pulses matching (Chickpea, Gram, Chana, Lentil, Masoor, Pigeonpea, Tur, Arhar, Moong, Urad, Cowpea, Lobia, Rajma, Peas)
  if (
    norm.includes('pulse') || norm.includes('chickpea') || norm.includes('gram') ||
    norm.includes('chana') || norm.includes('lentil') || norm.includes('masoor') ||
    norm.includes('pigeon') || norm.includes('tur') || norm.includes('toor') ||
    norm.includes('arhar') || norm.includes('moong') || norm.includes('urad') ||
    norm.includes('dal') || norm.includes('cowpea') || norm.includes('lobia') ||
    norm.includes('pea') || norm.includes('rajma') || norm.includes('bean')
  ) {
    return EXTENDED_CROPS.find(c => c.id === 'pulses')!
  }
  if (norm.includes('rice') || norm.includes('paddy') || norm.includes('dhan') || norm.includes('chawal')) {
    return EXTENDED_CROPS.find(c => c.id === 'paddy')!
  }
  if (norm.includes('wheat') || norm.includes('gehun')) {
    return EXTENDED_CROPS.find(c => c.id === 'wheat')!
  }
  if (norm.includes('maize') || norm.includes('corn') || norm.includes('makka')) {
    return EXTENDED_CROPS.find(c => c.id === 'maize')!
  }
  if (norm.includes('cotton') || norm.includes('kapas')) {
    return EXTENDED_CROPS.find(c => c.id === 'cotton')!
  }
  if (norm.includes('sugarcane') || norm.includes('ganna')) {
    return EXTENDED_CROPS.find(c => c.id === 'sugarcane')!
  }
  if (norm.includes('soybean') || norm.includes('soya')) {
    return EXTENDED_CROPS.find(c => c.id === 'soybean')!
  }
  if (norm.includes('mustard') || norm.includes('sarson') || norm.includes('rai') || norm.includes('rapeseed')) {
    return EXTENDED_CROPS.find(c => c.id === 'mustard')!
  }
  if (norm.includes('tomato') || norm.includes('tamatar')) {
    return EXTENDED_CROPS.find(c => c.id === 'tomato')!
  }
  if (norm.includes('potato') || norm.includes('aloo')) {
    return EXTENDED_CROPS.find(c => c.id === 'potato')!
  }
  return EXTENDED_CROPS.find(c => norm.includes(c.id)) || EXTENDED_CROPS[0]
}

export function autoDetectStage(spec: CropSpec, currentNdvi: number, currentNdmi: number = 0.2): GrowthStage {
  if (spec.id === 'uncultivated') return 'sowing'

  const sowingExp = spec.stages.sowing.ndviExpected
  const vegExp = spec.stages.vegetative.ndviExpected
  const flowExp = spec.stages.flowering.ndviExpected

  // 1. Peak reproductive / dense canopy (e.g., NDVI >= 0.65 for pulses)
  if (currentNdvi >= flowExp - 0.08) {
    return 'flowering'
  }

  // 2. Strong vegetative canopy or grain filling
  if (currentNdvi >= vegExp - 0.06) {
    return currentNdmi >= 0.16 ? 'vegetative' : 'grain_fill'
  }

  // 3. Early vegetative growth or late maturity
  if (currentNdvi >= sowingExp + 0.12) {
    return currentNdmi < 0.10 ? 'maturity' : 'vegetative'
  }

  // 4. Low canopy / early emergence
  return 'sowing'
}

export function computeStageAdjustedVerdict(
  cropId: string,
  stageId: GrowthStage,
  currentNdvi: number,
  currentNdmi?: number
) {
  const stage = GROWTH_STAGES.find(s => s.id === stageId) || GROWTH_STAGES[2]
  const crop = EXTENDED_CROPS.find(c => c.id === cropId) || EXTENDED_CROPS[0]

  // Handling for bare or uncultivated land
  if (crop.id === 'uncultivated') {
    return {
      healthScore: 85,
      status: 'Bare or fallow ground',
      tone: 'good' as const,
      note: `NDVI is ${currentNdvi.toFixed(2)}. Little green cover may be expected if this field is fallow; check the image against what is planted on the ground.`,
      isSenescence: false,
    }
  }

  const expected = crop.stages[stageId]?.ndviExpected ?? 0.7

  // If in maturity stage, declining NDVI is expected and healthy, not an anomaly!
  if (stageId === 'maturity') {
    if (currentNdvi <= 0.55 && currentNdvi >= 0.25) {
      return {
        healthScore: Math.round(85 + (0.55 - currentNdvi) * 20),
        status: 'Greenness may be fading with ripening',
        tone: 'good' as const,
        note: `NDVI is ${currentNdvi.toFixed(2)}. Lower green cover can be normal near harvest, but confirm the crop stage in the field.`,
        isSenescence: true,
      }
    }
  }

  const delta = currentNdvi - expected
  const healthScore = Math.min(100, Math.max(10, Math.round(80 + delta * 50)))

  if (delta >= 0.05) {
    return {
      healthScore,
      status: 'Greener than the general guide',
      tone: 'good' as const,
      note: `NDVI is ${currentNdvi.toFixed(2)}, above the general ${stage.name.toLowerCase()} guide of ${expected.toFixed(2)}. Compare with the last pass and the crop you see in the field.`,
      isSenescence: false,
    }
  } else if (delta >= -0.10) {
    return {
      healthScore,
      status: 'Close to the general guide',
      tone: 'good' as const,
      note: `NDVI is ${currentNdvi.toFixed(2)}, near the general ${stage.name.toLowerCase()} guide of ${expected.toFixed(2)}. This is a comparison, not a crop-health certificate.`,
      isSenescence: false,
    }
  } else if (delta >= -0.22) {
    return {
      healthScore,
      status: 'Below the general guide',
      tone: 'warn' as const,
      note: `NDVI is ${currentNdvi.toFixed(2)}, below the general ${stage.name.toLowerCase()} guide of ${expected.toFixed(2)}. Check planting date and compare recent clear imagery, the planting date, and the crop stage before changing water or fertilizer.`,
      isSenescence: false,
    }
  } else {
    return {
      healthScore,
      status: 'Well below the general guide',
      tone: 'bad' as const,
      note: `NDVI is ${currentNdvi.toFixed(2)}, well below the general ${stage.name.toLowerCase()} guide of ${expected.toFixed(2)}. Confirm the crop and stage, then inspect the field for gaps or visible problems.`,
      isSenescence: false,
    }
  }
}
