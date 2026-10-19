import { type Grid } from './lib/indicators'
import { type FarmData, type WeekRec } from './lib/seva'

export type ReportFarm = FarmData & { id: string; name: string; location: string; crop: string; sample?: boolean; passes?: WeekRec[] }

export type CartOpts = { title: boolean; north: boolean; scale: boolean; legend: boolean; coords: boolean }
export type ReportLang = 'en' | 'hi' | 'te'
export type ReportOpts = {
  maps: string[]
  cart: CartOpts
  contour: number
  lang?: ReportLang
  include3dTerrain?: boolean
  includeCharts?: boolean
  includeTables?: boolean
  includeContoursGrid?: boolean
  bandSymbologies?: string[]
  viewport?: { bbox?: [number, number, number, number]; zoom?: number }
}

export const MAP_CHOICES: { id: string; name: string; note: string; group: string }[] = [
  { id: 'fresh', name: 'Study Area Location & Boundary (Fig 3.1)', note: 'Sentinel-2 / Esri World Imagery with geodetic neatline', group: 'Satellite' },
  { id: 'ndvi', name: 'Canopy Health (NDVI) Zonation (Fig 4.1)', note: 'Sentinel-2 L2A BOA Surface Reflectance crop vigor map', group: 'Vegetation' },
  { id: 'ndmi', name: 'Leaf Moisture & Hydration (NDMI) (Fig 4.2)', note: 'Canopy water stress and hydration zonation', group: 'Vegetation' },
  { id: 'terrain', name: 'Hypsometric Elevation & Contours (Fig 3.2)', note: 'Copernicus DEM GLO-30 with configurable contour interval', group: 'Topography' },
  { id: 'lulc', name: 'Land Use / Land Cover (Fig 3.3)', note: 'In-browser Sentinel-2 L2A threshold classification', group: 'Land Cover' },
  { id: 'soil', name: 'Soil Context Map (Fig 3.4)', note: 'Base-map context; no spatial soil raster is bundled', group: 'Soil & Weather' },
  { id: 'stations', name: 'Meteorological Context (Fig 3.5)', note: 'Open-Meteo gridded weather for the farm location', group: 'Soil & Weather' },
  { id: 'discharge', name: 'Ground Discharge & Stream Network (Fig 3.6)', note: 'Shown only with an attached gauge-record dataset', group: 'Hydrology' },
  { id: 'water_balance', name: 'Landuse Water Summary & Hydrology (Fig 4.1 & 4.2)', note: 'Shown only when a calibrated model run is attached', group: 'Hydrology' },
  { id: 'calibration', name: 'SWAT Streamflow Calibration (Fig 4.3)', note: 'Shown only when a calibration run is recorded', group: 'Hydrology' },
  { id: 'sensitivity', name: 'Global Parameter Sensitivity (Fig 4.7)', note: 'Parameter list with literature ranges until a calibration run exists', group: 'Hydrology' },
  { id: 'ndwi', name: 'Surface Water & Wetland (NDWI)', note: 'Open water bodies and saturated depressions', group: 'Water' },
  { id: 'evi', name: 'Dense Canopy Coverage (EVI)', note: 'Enhanced vegetation index mitigating aerosol distortion', group: 'Vegetation' },
  { id: 'ndre', name: 'Nitrogen Red Edge Stress (NDRE)', note: 'Red edge early nitrogen deficiency detection', group: 'Vegetation' },
  { id: 'bsi', name: 'Bare Soil Index (BSI)', note: 'Fallow land, exposed soil and tillage contrast', group: 'Soil' },
  { id: 'slope', name: 'Topographic Slope Zonation', note: 'Gradient steepness model derived from 30m DEM', group: 'Topography' },
  { id: 'twi', name: 'Topographic Wetness Index (TWI)', note: 'Spatial flow convergence and soil saturation index', group: 'Hydrology' },
]

export const BAND_SYMBOLOGY_CHOICES: { id: string; name: string; note: string; bands: string }[] = [
  { id: 'rgb', name: 'Natural True Colour', note: 'Standard human eye vision RGB', bands: 'B04·B03·B02' },
  { id: 'cir', name: 'Colour Infrared (CIR)', note: 'Chlorophyll reflectance in deep red', bands: 'B08·B04·B03' },
  { id: 'agri', name: 'Agriculture (SWIR-NIR)', note: 'Lush crop canopy bright green, soil brown', bands: 'B11·B08·B02' },
  { id: 'moist_rgb', name: 'Moisture & Water Stress', note: 'Shortwave infrared canopy moisture deficit', bands: 'B12·B08·B04' },
  { id: 'geology_rgb', name: 'Land / Water & Soil Contrast', note: 'Sharp boundary contrast between soil and moisture', bands: 'B12·B08·B03' },
  { id: 're_rgb', name: 'Vegetation & Chlorophyll Edge', note: 'Red-edge early stress diagnosis', bands: 'B08·B05·B04' },
]

export const DEFAULT_OPTS: ReportOpts = {
  maps: ['fresh', 'terrain', 'lulc', 'soil', 'stations', 'discharge', 'water_balance', 'calibration', 'sensitivity', 'ndvi', 'ndmi'],
  cart: { title: true, north: true, scale: true, legend: true, coords: true },
  contour: 5,
  lang: 'en',
  include3dTerrain: true,
  includeCharts: true,
  includeTables: true,
  includeContoursGrid: true,
  bandSymbologies: ['rgb', 'cir', 'agri'],
}

export const REPORT_LANG_NAMES: Record<ReportLang, { label: string; native: string }> = {
  en: { label: 'English', native: 'English' },
  hi: { label: 'Hindi', native: 'हिन्दी' },
  te: { label: 'Telugu', native: 'తెలుగు' },
}

export const I18N = {
  en: {
    docLang: 'en',
    eyebrow: 'PRECISION REMOTE SENSING & FARM ANALYTICS REPORT',
    titleSuffix: 'SEVA GIS',
    declarationTitle: 'DECLARATION & DATA SOURCES',
    tocTitle: 'TABLE OF CONTENTS',
    lofTitle: 'LIST OF FIGURES',
    lotTitle: 'LIST OF TABLES',
    abbrTitle: 'SYMBOLS & ABBREVIATIONS',
    abstractTitle: 'ABSTRACT',
    ch1Title: 'CHAPTER I: INTRODUCTION',
    ch2Title: 'CHAPTER II: REVIEW OF LITERATURE',
    ch3Title: 'CHAPTER III: MATERIALS AND METHODS',
    ch4Title: 'CHAPTER IV: RESULTS AND DISCUSSION',
    ch5Title: 'CHAPTER V: CONCLUSION AND RECOMMENDATIONS',
    refTitle: 'REFERENCES',
    appTitle: 'APPENDICES',
  },
  hi: {
    docLang: 'hi',
    eyebrow: 'सटीक सुदूर संवेदन एवं कृषि विश्लेषण रिपोर्ट',
    titleSuffix: 'सेवा जीआईएस',
    declarationTitle: 'घोषणा एवं डेटा स्रोत',
    tocTitle: 'विषय सूची (TABLE OF CONTENTS)',
    lofTitle: 'चित्रों की सूची (LIST OF FIGURES)',
    lotTitle: 'सारणियों की सूची (LIST OF TABLES)',
    abbrTitle: 'प्रतीक एवं संक्षिप्ताक्षर (SYMBOLS & ABBREVIATIONS)',
    abstractTitle: 'सार संक्षेप (ABSTRACT)',
    ch1Title: 'अध्याय I: परिचय (INTRODUCTION)',
    ch2Title: 'अध्याय II: साहित्य समीक्षा (REVIEW OF LITERATURE)',
    ch3Title: 'अध्याय III: सामग्री एवं विधियाँ (MATERIALS AND METHODS)',
    ch4Title: 'अध्याय IV: परिणाम एवं परिचर्चा (RESULTS AND DISCUSSION)',
    ch5Title: 'अध्याय V: निष्कर्ष एवं अनुशंसाएं (CONCLUSION)',
    refTitle: 'संदर्भ ग्रंथ सूची (REFERENCES)',
    appTitle: 'परिशिष्ट (APPENDICES)',
  },
  te: {
    docLang: 'te',
    eyebrow: 'ఖచ్చితమైన రిమోట్ సెన్సింగ్ & వ్యవసాయ విశ్లేషణ నివేదిక',
    titleSuffix: 'సేవా జిఐఎస్',
    declarationTitle: 'ప్రకటన & డేటా మూలాలు',
    tocTitle: 'విషయ సూచిక (TABLE OF CONTENTS)',
    lofTitle: 'చిత్రాల సూచిక (LIST OF FIGURES)',
    lotTitle: 'పట్టికల సూచిక (LIST OF TABLES)',
    abbrTitle: 'సంకేతాలు & సంక్షిప్త పదాలు (SYMBOLS & ABBREVIATIONS)',
    abstractTitle: 'సారాంశం (ABSTRACT)',
    ch1Title: 'అధ్యాయం I: పరిచయం (INTRODUCTION)',
    ch2Title: 'అధ్యాయం II: సాహిత్య సమీక్ష (REVIEW OF LITERATURE)',
    ch3Title: 'అధ్యాయం III: సామగ్రి మరియు పద్ధతులు (MATERIALS AND METHODS)',
    ch4Title: 'అధ్యాయం IV: ఫలితాలు మరియు చర్చ (RESULTS AND DISCUSSION)',
    ch5Title: 'అధ్యాయం V: ముగింపు మరియు సిఫార్సులు (CONCLUSION)',
    refTitle: 'సూచన గ్రంథాలు (REFERENCES)',
    appTitle: 'అనుబంధాలు (APPENDICES)',
  },
}

export { buildReport } from './reportBuilder'
