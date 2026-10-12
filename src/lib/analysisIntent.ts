// Analysis Intent System for SEVA·GIS
// Defines typed analytical intents, tailoring indicator priority, band combinations,
// visible analytical panels, and methodology disclosures to the user's specific domain.

export type AnalysisIntent =
  | 'general'
  | 'agriculture'
  | 'water'
  | 'drainage'
  | 'terrain'
  | 'landcover'
  | 'change'
  | 'geology'

export interface BandPreset {
  name: string
  rgb: [string, string, string]
  description: string
}

export interface IntentProfile {
  id: AnalysisIntent
  label: string
  shortDesc: string
  description: string
  primaryIndicators: string[]
  recommendedBands: BandPreset[]
  visiblePanels: ('overview' | 'indicators' | 'agro' | 'water' | 'terrain' | 'lulc' | 'journal' | 'matlab')[]
  showYieldEstimate: boolean
  limitations: string
}

export const INTENT_PROFILES: Record<AnalysisIntent, IntentProfile> = {
  general: {
    id: 'general',
    label: 'General Spatial Survey',
    shortDesc: 'Multi-purpose spatial inspection of any land boundary',
    description: 'Balanced spatial overview combining multispectral indices, elevation contours, and land cover classification.',
    primaryIndicators: ['ndvi', 'ndmi', 'elevation', 'twi', 'ndbi'],
    recommendedBands: [
      { name: 'True Colour (Natural)', rgb: ['B04', 'B03', 'B02'], description: 'Standard human eye perception of the ground' },
      { name: 'Colour Infrared (Vegetation)', rgb: ['B08', 'B04', 'B03'], description: 'Vivid red highlights healthy chlorophyll canopy' },
      { name: 'Agriculture (SWIR)', rgb: ['B11', 'B08', 'B02'], description: 'Distinguishes bare soil, moisture, and crop foliage' }
    ],
    visiblePanels: ['overview', 'indicators', 'agro', 'water', 'terrain', 'lulc', 'journal', 'matlab'],
    showYieldEstimate: false,
    limitations: 'General purpose indices should be verified with in-situ ground checks before making specific engineering or input decisions.'
  },
  agriculture: {
    id: 'agriculture',
    label: 'Precision Agriculture',
    shortDesc: 'Crop health, canopy vigour, chlorophyll, and water stress',
    description: 'Optimized for farm monitoring, variable rate input planning, early crop stress identification, and temporal growth monitoring.',
    primaryIndicators: ['ndvi', 'ndre', 'savi', 'msavi', 'chla', 'lai', 'ndmi', 'msi'],
    recommendedBands: [
      { name: 'Colour Infrared (CIR)', rgb: ['B08', 'B04', 'B03'], description: 'Highest sensitivity to vegetative canopy biomass' },
      { name: 'Agriculture SWIR', rgb: ['B11', 'B08', 'B02'], description: 'SWIR reflectance isolates crop moisture and soil moisture' },
      { name: 'Red Edge Normalized', rgb: ['B08', 'B05', 'B04'], description: 'Reveals early nitrogen deficiency before visible leaf yellowing' }
    ],
    visiblePanels: ['overview', 'indicators', 'agro', 'journal', 'matlab'],
    showYieldEstimate: true,
    limitations: 'Yield forecasts and crop stress metrics are empirical remote sensing estimates based on FAO-56 and Sentinel-2 10 m pixels. They do not replace field scouting or tissue tests.'
  },
  water: {
    id: 'water',
    label: 'Hydrology & Water Resources',
    shortDesc: 'Surface water delineation, soil moisture, and ponding',
    description: 'Specialized for water bodies, farm ponds, irrigation canal monitoring, and surface moisture distribution.',
    primaryIndicators: ['ndwi', 'mndwi', 'ndmi', 'twi', 'elevation'],
    recommendedBands: [
      { name: 'Land & Water Contrast', rgb: ['B08', 'B11', 'B04'], description: 'Sharp delineation between moisture bodies and surrounding terrain' },
      { name: 'Shortwave Infrared Water', rgb: ['B12', 'B08', 'B03'], description: 'Distinguishes deep open water from shallow wet sediment' },
      { name: 'Moisture Composite', rgb: ['B11', 'B08', 'B04'], description: 'Canopy and soil moisture gradient mapping' }
    ],
    visiblePanels: ['overview', 'indicators', 'water', 'terrain', 'journal'],
    showYieldEstimate: false,
    limitations: 'Optical water indices delineate open standing water and saturated topsoil. Sub-surface aquifer levels or buried pipeline infrastructure cannot be detected directly by optical sensors.'
  },
  drainage: {
    id: 'drainage',
    label: 'Drainage & Flow Dynamics',
    shortDesc: 'Runoff convergence, slope gradients, and flood vulnerability',
    description: 'Hydrological terrain modeling using Horn 1981 convolution kernels and Topographic Wetness Index to identify runoff pathways.',
    primaryIndicators: ['twi', 'elevation', 'slope', 'aspect', 'ndwi'],
    recommendedBands: [
      { name: 'Terrain Relief SWIR', rgb: ['B12', 'B08', 'B04'], description: 'Accentuates terrain micro-depressions and moist gullies' },
      { name: 'True Colour', rgb: ['B04', 'B03', 'B02'], description: 'Visual identification of natural drainage channels' }
    ],
    visiblePanels: ['overview', 'indicators', 'terrain', 'water'],
    showYieldEstimate: false,
    limitations: 'Topographic wetness index and slope are derived from Copernicus GLO-30 (30 m). Micro-culverts and field ridges smaller than 30 m are below sensor spatial resolution.'
  },
  terrain: {
    id: 'terrain',
    label: 'Terrain & Geomorphology',
    shortDesc: 'Elevation, slope, aspect, hillshade, and contours',
    description: 'Topographic assessment for civil planning, watershed management, contour terracing, and slope stability analysis.',
    primaryIndicators: ['elevation', 'slope', 'aspect', 'twi'],
    recommendedBands: [
      { name: 'True Colour Composite', rgb: ['B04', 'B03', 'B02'], description: 'Geographical landscape context' },
      { name: 'False Colour Infrared', rgb: ['B08', 'B04', 'B03'], description: 'Vegetation along topographic ridges and ravines' }
    ],
    visiblePanels: ['overview', 'indicators', 'terrain'],
    showYieldEstimate: false,
    limitations: 'Copernicus GLO-30 DEM has vertical accuracy of ~2-4 m. It is suitable for planning and hydrology, but not for cadastral or civil engineering boundary surveys.'
  },
  landcover: {
    id: 'landcover',
    label: 'Land Cover & Urban Growth',
    shortDesc: '9-class land classification, impervious surface, and barren soil',
    description: 'Evaluates built-up structures, impervious surfaces, tree cover, cropland, and seasonal bare soil using Dynamic World and NDBI.',
    primaryIndicators: ['ndbi', 'bsi', 'ndvi', 'ndwi', 'elevation'],
    recommendedBands: [
      { name: 'False Colour Urban', rgb: ['B12', 'B11', 'B04'], description: 'Highlights buildings and paved surfaces in bright cyan / silver' },
      { name: 'Atmospheric Removal', rgb: ['B12', 'B08', 'B03'], description: 'Clean penetration of haze for land cover classification' }
    ],
    visiblePanels: ['overview', 'indicators', 'lulc', 'journal'],
    showYieldEstimate: false,
    limitations: 'Classification uses Sentinel-2 10 m pixels. Small structures (<10 m) or mixed urban-vegetation pixels may be classified as mixed classes.'
  },
  change: {
    id: 'change',
    label: 'Temporal Change & Disturbance',
    shortDesc: 'Multi-scene delta analysis, burn severity, and harvest clearing',
    description: 'Tracks temporal anomalies, vegetative clearing, wildfire burn severity, and seasonal land transformation across satellite passes.',
    primaryIndicators: ['nbr', 'ndvi', 'ndmi', 'bsi'],
    recommendedBands: [
      { name: 'SWIR Disturbance', rgb: ['B12', 'B08', 'B04'], description: 'Highlights burned areas, cleared soil, and dry residue' },
      { name: 'Colour Infrared', rgb: ['B08', 'B04', 'B03'], description: 'Vegetation changes between baseline and current scene' }
    ],
    visiblePanels: ['overview', 'indicators', 'journal', 'matlab'],
    showYieldEstimate: false,
    limitations: 'Change detection requires comparable sun elevation and cloud-free scenes. Phenological seasonal changes must be differentiated from actual land clearance.'
  },
  geology: {
    id: 'geology',
    label: 'Geology & Mineral Outcrops',
    shortDesc: 'Lithological contrast, ferric oxides, and soil discrimination',
    description: 'Utilizes SWIR absorption bands to detect surface mineral exposure, iron-bearing soils, and rock weathering patterns.',
    primaryIndicators: ['bsi', 'ndbi', 'elevation', 'slope'],
    recommendedBands: [
      { name: 'Geology SWIR', rgb: ['B12', 'B11', 'B02'], description: 'Separates silicate minerals, carbonate rocks, and exposed clay' },
      { name: 'Shortwave Infrared Ratio', rgb: ['B12', 'B08', 'B04'], description: 'Enhances lithological boundaries in arid and semi-arid terrain' }
    ],
    visiblePanels: ['overview', 'indicators', 'terrain'],
    showYieldEstimate: false,
    limitations: 'Optical satellites only sample the uppermost optical skin of the earth surface. Deep mineral deposits or groundwater aquifers cannot be detected.'
  }
}

export const ALL_INTENTS: AnalysisIntent[] = [
  'general',
  'agriculture',
  'water',
  'drainage',
  'terrain',
  'landcover',
  'change',
  'geology'
]

export function getIntentProfile(intent: AnalysisIntent | undefined | null): IntentProfile {
  if (!intent || !(intent in INTENT_PROFILES)) {
    return INTENT_PROFILES.general
  }
  return INTENT_PROFILES[intent]
}

export const INTENT_ICONS: Record<AnalysisIntent, string> = {
  general: '🌐',
  agriculture: '🌾',
  water: '💧',
  drainage: '🌊',
  terrain: '⛰️',
  landcover: '🏙️',
  change: '🔄',
  geology: '🪨',
}

export function loadAnalysisIntent(): AnalysisIntent {
  try {
    const saved = localStorage.getItem('seva-analysis-intent') as AnalysisIntent
    if (saved && saved in INTENT_PROFILES) return saved
  } catch {}
  return 'general'
}

export function saveAnalysisIntent(intent: AnalysisIntent): void {
  try {
    localStorage.setItem('seva-analysis-intent', intent)
    window.dispatchEvent(new CustomEvent('seva-analysis-intent-changed', { detail: intent }))
  } catch {}
}
