export type SupportedLanguage = 'en' | 'te' | 'hi';

export type EngineType = 'gee' | 'qgis' | 'arcmap' | 'matlab' | 'sevagis';

export type PortDataType =
  | 'AOI_POLYGON'
  | 'MULTISPECTRAL_RASTER'
  | 'SAR_BACKSCATTER'
  | 'DEM_TERRAIN'
  | 'HYDRO_VECTOR'
  | 'MATRIX_1D_SERIES'
  | 'COMPOSITE_REPORT';

export interface NodePort {
  id: string;
  nodeId: string;
  label: string;
  direction: 'input' | 'output';
  dataType: PortDataType;
  bandOrFormula: string;
  selected: boolean;
}

export interface EngineNode {
  id: string;
  engine: EngineType;
  title: string;
  subtitle: string;
  badge: string;
  ports: NodePort[];
}

export interface NodeConnection {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
  isValid: boolean;
  validationMessage: string;
}

export interface CoordinateLatLon {
  lat: number;
  lon: number;
}

export interface AOIFeature {
  id: string;
  name: string;
  createdAt: string;
  hectares: number;
  acres: number;
  perimeterKm: number;
  compactnessIndex: number;
  centroid: CoordinateLatLon;
  bounds: [[number, number], [number, number]];
  coordinates: CoordinateLatLon[];
}

export interface SpectralIndexResult {
  id: string;
  code: string;
  name: string;
  category: 'vegetation' | 'moisture' | 'soil' | 'disease' | 'terrain' | 'water';
  formula: string;
  citation: string;
  sensor: string;
  /** Acquisition date reported by the backend; null when no date was supplied. */
  acquisitionDate: string | null;
  value: number;
  unit: string;
  confidencePct: number;
  status: 'Optimal' | 'Moderate' | 'Watch' | 'Critical';
  frontSummary: string;
  backTechnicalDetail: string;
  agronomicAction: string;
}

export interface MineralClusterPoint {
  id: string;
  lat: number;
  lon: number;
  ratio: number;
  areaHa: number;
  sensor: string;
  /** Acquisition date reported by the backend; null when the backend did not supply one. */
  date: string | null;
  mineral: string;
  mineralKey: string;
  soilType?: string;
  confidence: string;
}

export interface MineralIndicationResult {
  id: string;
  mineralKey?: string;
  color?: string;
  mineralGroup: string;
  statusLabel: 'Indicated (Spectrally Inferred)';
  bandRatioFormula: string;
  citation: string;
  sensorSource: string;
  acquisitionDate: string | null;
  meanRatioValue: number;
  aoiCoveragePercent: number;
  confidencePct: number;
  absorptionFeatureMicrons: string;
  justification: string;
  agronomicRelevance: string;
  points?: MineralClusterPoint[];
}

export interface SwatParameterRank {
  rank: number;
  parameterCode: string;
  parameterName: string;
  formulation: 'SWAT-2012 / FQFA' | 'SCS-CN / Beven-Kirkby';
  /** Calibrated sensitivity statistics — only populated after a real SWAT/SUFI-2 run on the backend. */
  tStatSensitivity: number | null;
  pValue: number | null;
  /** Parameter value fitted by site calibration; null until a real run exists. */
  fittedValue: number | null;
  validRange: string;
  whatItMeans: string;
  whereItIsOnAoi: string;
  justification: string;
}

export interface TimeSeriesPoint {
  date: string;
  ndvi: number;
  ndwi: number;
  ndmi: number;
  ndre: number;
  sensorPass: string;
  /** Cloud cover percentage for the pass; null when the data source does not report it. */
  cloudCoverPct: number | null;
}

export interface WeatherTelemetry {
  status: 'ok' | 'unavailable';
  provider: string;
  timestamp?: string;
  reason?: string;
  current: {
    airTempC: number | null;
    humidityPct: number | null;
    precipitationMm: number;
    windSpeedKmh: number | null;
    soilTemp0cmC: number | null;
    soilMoistureM3M3: number | null;
  } | null;
  daily: Array<{
    date: string;
    tempMaxC: number | null;
    tempMinC: number | null;
    precipMm: number;
    et0Mm: number | null;
  }>;
}
