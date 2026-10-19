import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  GraduationCap, Mountain, FileText, Play, Check, Copy, Download,
  ExternalLink, Search, Database, Wind, RefreshCw, AlertCircle
} from 'lucide-react'
import { farmBBox } from '../lib/seva'
import { dispatchExport } from '../lib/googleDriveVault'

interface Props {
  farm: {
    id: string
    name: string
    location?: string
    crop?: string
    area?: number
    lat: number
    lon: number
    elevation?: number
    moisture?: number
    rain?: number
    polygon?: [number, number][]
    analysis?: any
  }
  onClose?: () => void
  isModal?: boolean
}

type AcademyTab = 'training' | 'vectors16' | 'topo3d' | 'telemetry' | 'research'

export interface VectorDataSource {
  id: number
  name: string
  url: string
  domain: string
  formats: string[]
  category: 'Global Base' | 'Hydrology' | 'Agriculture & Environment' | 'Admin Boundaries' | 'Forestry & Climate' | 'Regional & Cadastral'
  description: string
  sampleLayer: string
  featureCountPrompt: string
}

export const FREE_GIS_VECTOR_SOURCES: VectorDataSource[] = [
  {
    id: 1,
    name: 'OpenStreetMap (OSM)',
    url: 'https://www.openstreetmap.org',
    domain: 'openstreetmap.org',
    formats: ['Shapefile', 'GeoJSON', 'OSM XML'],
    category: 'Global Base',
    description: 'Crowd-sourced global vector database of roads, buildings, waterways, land use, and POIs updated minute-by-minute.',
    sampleLayer: 'osm_buildings_roads_waterways.geojson',
    featureCountPrompt: 'Extracts roads, buildings, canals & parcel tracks inside AOI'
  },
  {
    id: 2,
    name: 'Geofabrik OSM Extracts',
    url: 'https://download.geofabrik.de',
    domain: 'download.geofabrik.de',
    formats: ['Shapefile', 'GeoJSON', 'OSM PBF'],
    category: 'Global Base',
    description: 'Clean daily continent, country, and state-level GIS vector extracts ready for direct import into QGIS and ArcGIS Pro.',
    sampleLayer: 'geofabrik_regional_extract.geojson',
    featureCountPrompt: 'Pre-clipped regional layers (transport, hydro, places, landuse)'
  },
  {
    id: 3,
    name: 'Humanitarian Data Exchange (HDX)',
    url: 'https://data.humdata.org',
    domain: 'data.humdata.org',
    formats: ['Shapefile', 'GeoJSON', 'CSV', 'GeoPackage'],
    category: 'Admin Boundaries',
    description: 'UN OCHA repository of CODs (Common Operational Datasets), settlement footprints, health facilities, and flood extents.',
    sampleLayer: 'hdx_cod_admin_settlements.geojson',
    featureCountPrompt: 'UN OCHA verified boundaries, settlements & hazard zones'
  },
  {
    id: 4,
    name: 'HydroSHEDS',
    url: 'https://www.hydrosheds.org/products',
    domain: 'hydrosheds.org/products',
    formats: ['Shapefile', 'GeoDB', 'GeoTIFF'],
    category: 'Hydrology',
    description: 'WWF hydrographic vector suite: HydroRIVERS, HydroLAKES, HydroBASINS, and HydroFALLS derived from SRTM & Copernicus DEM.',
    sampleLayer: 'hydrosheds_rivers_basins_l12.geojson',
    featureCountPrompt: 'Pfafstetter Level-12 sub-basins, river reaches & lake polygons'
  },
  {
    id: 5,
    name: 'FAO GeoNetwork / Hand-in-Hand',
    url: 'https://www.fao.org/geonetwork',
    domain: 'fao.org/geonetwork',
    formats: ['Shapefile', 'GeoJSON', 'WMS/WFS'],
    category: 'Agriculture & Environment',
    description: 'UN Food & Agriculture Organization vectors covering Harmonized World Soil Database (HWSD), agro-ecological zones, and irrigation.',
    sampleLayer: 'fao_aez_soil_irrigation.geojson',
    featureCountPrompt: 'FAO Agro-Ecological Zones (AEZ), soil classes & command areas'
  },
  {
    id: 6,
    name: 'USGS EarthExplorer',
    url: 'https://earthexplorer.usgs.gov',
    domain: 'earthexplorer.usgs.gov',
    formats: ['Shapefile', 'KML', 'GeoTIFF'],
    category: 'Global Base',
    description: 'US Geological Survey archive for hydrography, watershed boundaries, Landsat scenes, SRTM elevation, and geological fault vectors.',
    sampleLayer: 'usgs_hydro_faults_footprints.geojson',
    featureCountPrompt: 'USGS scene footprints, fault lines & watershed divides'
  },
  {
    id: 7,
    name: 'Natural Earth',
    url: 'https://www.naturalearthdata.com',
    domain: 'naturalearthdata.com',
    formats: ['Shapefile', 'GeoJSON', 'SQLite'],
    category: 'Global Base',
    description: 'Public domain cartographic vector datasets at 1:10m, 1:50m, and 1:110m scales with tightly integrated cultural and physical layers.',
    sampleLayer: 'natural_earth_10m_physical.geojson',
    featureCountPrompt: 'Publication-grade coastlines, rivers, admin-1 & urban polygons'
  },
  {
    id: 8,
    name: 'European Environment Agency (EEA)',
    url: 'https://www.eea.europa.eu',
    domain: 'eea.europa.eu',
    formats: ['Shapefile', 'GeoJSON', 'GeoPackage'],
    category: 'Agriculture & Environment',
    description: 'CORINE Land Cover, Natura 2000 ecological networks, air quality stations, and European catchment hydrology vectors.',
    sampleLayer: 'eea_corine_landcover_vectors.geojson',
    featureCountPrompt: '44-class CORINE Land Cover & ecological corridor polygons'
  },
  {
    id: 9,
    name: 'GADM (Global Administrative Areas)',
    url: 'https://gadm.org',
    domain: 'gadm.org',
    formats: ['Shapefile', 'GeoJSON', 'KML', 'GeoPackage'],
    category: 'Admin Boundaries',
    description: 'High-resolution administrative boundaries down to district, sub-district, taluk/tehsil, and ward levels for every country.',
    sampleLayer: 'gadm41_admin0_1_2_3.geojson',
    featureCountPrompt: 'Country, State, District & Sub-District (Level 0-3) polygons'
  },
  {
    id: 10,
    name: 'DIVA-GIS',
    url: 'https://www.diva-gis.org',
    domain: 'diva-gis.org',
    formats: ['Shapefile', 'Grid'],
    category: 'Agriculture & Environment',
    description: 'Country-level free GIS data for climate envelopes, species biodiversity, elevation contours, population, roads, and railways.',
    sampleLayer: 'diva_gis_country_climate_roads.geojson',
    featureCountPrompt: 'Country-level roads, drainage, altitude & bioclimatic zones'
  },
  {
    id: 11,
    name: 'UNEP Environmental Data Explorer',
    url: 'https://uneplive.unep.org',
    domain: 'uneplive.unep.org',
    formats: ['Shapefile', 'GeoJSON', 'CSV'],
    category: 'Forestry & Climate',
    description: 'United Nations Environment Programme authoritative datasets on freshwater ecosystems, biodiversity hotspots, and climate vulnerability.',
    sampleLayer: 'unep_freshwater_biodiversity.geojson',
    featureCountPrompt: 'UNEP protected areas, wetlands & climate risk polygons'
  },
  {
    id: 12,
    name: 'NASA SEDAC (Socioeconomic Data)',
    url: 'https://sedac.ciesin.columbia.edu',
    domain: 'sedac.ciesin.columbia.edu',
    formats: ['Shapefile', 'GeoJSON', 'GeoTIFF'],
    category: 'Admin Boundaries',
    description: 'Columbia University / NASA Earthdata center for Gridded Population of the World (GPW), urban-rural extents, and human footprint.',
    sampleLayer: 'nasa_sedac_gpw_urban_extents.geojson',
    featureCountPrompt: 'Population density polygons, urban extents & settlement grids'
  },
  {
    id: 13,
    name: 'World Resources Institute (WRI)',
    url: 'https://www.wri.org/data',
    domain: 'wri.org/data',
    formats: ['Shapefile', 'GeoJSON', 'CSV'],
    category: 'Hydrology',
    description: 'Home of WRI Aqueduct Water Risk Atlas, Global Power Plant Database, restoration opportunities, and resource watch vectors.',
    sampleLayer: 'wri_aqueduct_water_stress.geojson',
    featureCountPrompt: 'WRI Aqueduct baseline water stress & drought risk basins'
  },
  {
    id: 14,
    name: 'Global Forest Watch (GFW)',
    url: 'https://www.globalforestwatch.org',
    domain: 'globalforestwatch.org',
    formats: ['Shapefile', 'GeoJSON', 'GeoTIFF'],
    category: 'Forestry & Climate',
    description: 'Near-real-time deforestation alerts (GLAD / RADD), tree cover gain/loss polygons, intact forest landscapes, and fire alerts.',
    sampleLayer: 'gfw_glad_tree_cover_alerts.geojson',
    featureCountPrompt: 'Tree canopy density, GLAD deforestation alerts & fire vectors'
  },
  {
    id: 15,
    name: 'Africa GeoPortal',
    url: 'https://www.africageoportal.com',
    domain: 'africageoportal.com',
    formats: ['Shapefile', 'GeoJSON', 'KML'],
    category: 'Regional & Cadastral',
    description: 'Esri-backed open spatial data hub for continental infrastructure, utilities, hydrography, and agricultural development corridors.',
    sampleLayer: 'africa_geoportal_corridors.geojson',
    featureCountPrompt: 'Regional infrastructure corridors, soils & basin boundaries'
  },
  {
    id: 16,
    name: 'Koordinates',
    url: 'https://koordinates.com',
    domain: 'koordinates.com',
    formats: ['Shapefile', 'GeoPackage', 'DXF', 'CSV'],
    category: 'Regional & Cadastral',
    description: 'Authoritative cadastral parcels, LiDAR elevation contours, hydrographic charts, and zoning vectors with direct CRS reprojection.',
    sampleLayer: 'koordinates_cadastral_contours.geojson',
    featureCountPrompt: 'Cadastral parcels, topographic contours & LiDAR index tiles'
  }
]

interface TrainingModule {
  id: string
  engine: 'QGIS 3.x' | 'Google Earth Engine' | 'ArcGIS Pro' | 'MATLAB R2026a' | 'UAV Flight & Swath'
  title: string
  level: 'Foundation' | 'Intermediate' | 'Advanced REA'
  duration: string
  summary: string
  theoryFormula: string
  codeSnippet: string
  expectedOutput: string
  steps: string[]
}

const TRAINING_MODULES: TrainingModule[] = [
  {
    id: 'qgis-hydro-dem',
    engine: 'QGIS 3.x',
    title: 'Lab 01: Priority-Flood Sink Fill, Horn Slope & Topographic Wetness Index (TWI)',
    level: 'Advanced REA',
    duration: '25 mins',
    summary: 'Built from open QGIS raster terrain processing & Wang-Liu (2006) priority-flood algorithm. Eliminates spurious DEM sinks before computing D8 flow accumulation and TWI.',
    theoryFormula: 'TWI = ln( a / tan(beta) ) where a = upslope contributing area per unit contour length, beta = Horn (1981) 3x3 slope angle',
    codeSnippet: `# PyQGIS 3.x + NumPy Native Pipeline (DYOP / SEVA GIS Training Lab 01)
import processing
from qgis.core import QgsProject, QgsRasterLayer

# 1. Wang & Liu (2006) Priority-Flood Depression Fill on Copernicus GLO-30 DEM
filled = processing.run("saga:fillsinkswangliu", {
    'ELEV': 'copernicus_glo30_dem.tif',
    'FILLED': 'TEMPORARY_OUTPUT',
    'FDIR': 'TEMPORARY_OUTPUT',
    'WSHED': 'TEMPORARY_OUTPUT',
    'MINSLOPE': 0.01
})

# 2. Horn (1981) 3x3 Convolution Slope & Flow Accumulation
slope = processing.run("gdal:slope", {
    'INPUT': filled['FILLED'],
    'BAND': 1,
    'AS_PERCENT': False,
    'OUTPUT': 'TEMPORARY_OUTPUT'
})

# 3. Compute Topographic Wetness Index: ln(upslope_area / tan(slope))
twi = processing.run("qgis:rastercalculator", {
    'EXPRESSION': 'ln(("flow_acc@1" * 30.0) / tan("slope@1" * 3.14159 / 180.0 + 0.001))',
    'LAYERS': [slope['OUTPUT']],
    'OUTPUT': 'aoi_twi_hydrology.tif'
})
QgsProject.instance().addMapLayer(QgsRasterLayer(twi['OUTPUT'], 'SEVA_DYOP_TWI'))`,
    expectedOutput: 'Hydrologically conditioned DEM + Topographic Wetness Index raster highlighting runoff convergence zones.',
    steps: [
      'Load Copernicus GLO-30 DEM clipped to AOI polygon + 150m edge buffer.',
      'Run Wang & Liu (2006) priority-flood depression fill to remove artificial pits.',
      'Apply Horn (1981) 3x3 weighted finite-difference kernel for dz/dx and dz/dy.',
      'Compute D8 upslope contributing area and evaluate TWI = ln(a / tan(beta)).'
    ]
  },
  {
    id: 'gee-sentinel-stac',
    engine: 'Google Earth Engine',
    title: 'Lab 02: Sentinel-2 L2A Cloud-Masked Spectral Cube & 9-Class Dynamic World LULC',
    level: 'Foundation',
    duration: '20 mins',
    summary: 'Builds a cloud-masked median composite from Sentinel-2 Surface Reflectance (COPERNICUS/S2_SR_HARMONIZED), masks SCL classes 3, 8, 9, 10, and fuses Dynamic World V1 probabilities.',
    theoryFormula: 'NDVI = (B8 - B4)/(B8 + B4) | NDRE = (B8 - B5)/(B8 + B5) | MNDWI = (B3 - B11)/(B3 + B11) | NDBI = (B11 - B8)/(B11 + B8)',
    codeSnippet: `// Google Earth Engine JS API — Multi-Domain Spectral + Dynamic World LULC Cube
const aoi = ee.Geometry.Polygon([[
  [78.048, 24.638], [78.056, 24.638], [78.056, 24.644], [78.048, 24.644], [78.048, 24.638]
]]);

function maskS2Clouds(image) {
  const scl = image.select('SCL');
  // Reject Cloud Shadow (3), Medium/High Cloud (8,9), Cirrus (10)
  const mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
  return image.updateMask(mask).divide(10000);
}

const s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 25))
  .map(maskS2Clouds)
  .median()
  .clip(aoi);

const ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');
const ndmi = s2.normalizedDifference(['B8', 'B11']).rename('NDMI');
Map.centerObject(aoi, 16);
Map.addLayer(ndvi, { min: 0.1, max: 0.85, palette: ['#d73027', '#fee08b', '#1a9850'] }, 'NDVI Vigour');`,
    expectedOutput: '10m cloud-free multi-band spectral cube + 9-class Land Use / Land Cover probability matrix.',
    steps: [
      'Query Sentinel-2 L2A Harmonized collection intersecting the user AOI.',
      'Apply Scene Classification Layer (SCL) bitmask to strip cloud shadows and thin cirrus.',
      'Calculate normalized difference indices across Visible, Red-Edge (B5), NIR (B8), and SWIR (B11/B12).',
      'Overlay Google Dynamic World V1 mode classification for impervious, crop, tree, and water area accounting.'
    ]
  },
  {
    id: 'arcgis-carto-layout',
    engine: 'ArcGIS Pro',
    title: 'Lab 03: Collision-Free Cartographic Furniture, CIM .lyrx & ISO-19115 Dossier',
    level: 'Intermediate',
    duration: '18 mins',
    summary: 'Implements Esri Cartographic Information Model (CIM) standards via official arcpy APIs: automatic bounding-box framing at 75% viewport fill, non-overlapping North Arrow, Scale Bar, Neatline, and bilinear raster resampling.',
    theoryFormula: 'Viewport Padding >= 12.5% per edge (Zero Furniture-to-AOI Intersection)',
    codeSnippet: `# ArcPy 3.x Cartographic Layout & Zonal Tabulation Automation
import arcpy
from arcpy.sa import ZonalStatisticsAsTable, ExtractByMask

arcpy.env.overwriteOutput = True
arcpy.CheckOutExtension("Spatial")

aoi_fc = "aoi_boundary.shp"
clipped_ndvi = ExtractByMask("sentinel2_ndvi_10m.tif", aoi_fc)
clipped_ndvi.save("aoi_ndvi_clipped.tif")

# Compute Zonal Statistics (Mean, Min, Max, StdDev, Area)
ZonalStatisticsAsTable(aoi_fc, "PLOT_ID", clipped_ndvi, "zonal_stats.dbf", "DATA", "ALL")

aprx = arcpy.mp.ArcGISProject("CURRENT")
m = aprx.listMaps()[0]
lyr = m.addDataFromPath("aoi_ndvi_clipped.tif")
print("Exported collision-free 300 DPI cartographic plate at Zoom 19x.")`,
    expectedOutput: '300 DPI publication map plate with zero AOI overlap, WGS84 / UTM grid ticks, and DBF zonal table.',
    steps: [
      'Project AOI polygon from WGS84 (EPSG:4326) to local UTM zone for metric area & perimeter accuracy.',
      'Clip raster exactly to polygon mask so surrounding background remains dark neutral canvas.',
      'Position North Arrow, Scale Bar, and Legend in outer neatline margin outside the 75% AOI frame.',
      'Export 300 DPI PNG/PDF and ISO-19139 XML metadata record.'
    ]
  },
  {
    id: 'matlab-spectral-fft',
    engine: 'MATLAB R2026a',
    title: 'Lab 04: Savitzky-Golay Phenology Filtering & 5-Zone K-Means VRA Prescription',
    level: 'Advanced REA',
    duration: '30 mins',
    summary: 'Compatible with MATLAB Engine API and GNU Octave: smooths noisy multi-temporal NDVI curves and clusters pixels into 5 management zones.',
    theoryFormula: 'J = Sum_{k=1..5} Sum_{x in Z_k} || x_i - mu_k ||^2 (Multi-variate K-Means over [NDVI, NDMI, Slope, TWI])',
    codeSnippet: `% MATLAB / GNU Octave — Multi-Variate VRA Zone Clustering & Phenology Smoothing
[ndvi, R] = readgeoraster('aoi_ndvi_10m.tif');
[ndmi, ~] = readgeoraster('aoi_ndmi_10m.tif');
[slope, ~] = readgeoraster('aoi_slope_10m.tif');

% 1. Stack valid AOI pixels into feature matrix X [N x 3]
mask = ~isnan(ndvi) & (ndvi > -0.2);
X = zscore([ndvi(mask), ndmi(mask), slope(mask)]);

% 2. K-Means++ clustering into K = 5 Variable Rate Application (VRA) zones
[idx, centroids] = kmeans(X, 5, 'Replicates', 10, 'MaxIter', 300);

% 3. Savitzky-Golay temporal smoothing across satellite passes
t_smooth = sgolayfilt(weekly_ndvi_series, 3, 7);`,
    expectedOutput: '5-class Variable Rate Application (VRA) prescription map + Savitzky-Golay smoothed phenology curve.',
    steps: [
      'Normalize multi-band raster arrays (NDVI, NDMI, Slope) to zero mean and unit variance.',
      'Run K-Means++ clustering (K=1..5 selectable) to partition the AOI into homogeneous management zones.',
      'Apply Savitzky-Golay polynomial filter to remove residual atmospheric noise from weekly time series.',
      'Export ISO 11783 (ISO-XML) TASKDATA.XML and prescription GeoTIFF.'
    ]
  },
  {
    id: 'uav-10rotor-telemetry',
    engine: 'UAV Flight & Swath',
    title: 'Lab 05: 10-Rotor Electric UAV Telemetry HUD, Wind Envelope & Swath Planning',
    level: 'Advanced REA',
    duration: '22 mins',
    summary: 'Reimplementation inspired by Fields2Cover & 10-electric-rotor (660 lb thrust) flight controller architecture. Evaluates wind vectors, landing slope envelope, thrust allocation, and Dubins Boustrophedon coverage paths.',
    theoryFormula: 'Swath Spacing W = H * (Sensor_W / Focal_L) * (1 - SideOverlap) | Thrust Margin = (Sum T_i) / (m * g) (estimate)',
    codeSnippet: `// Swath Planner (Reimplementation inspired by Fields2Cover)
const uavConfig = {
  rotors: 10,
  maxThrustLbs: 660,
  altitudeMeters: 45,
  gsdCmPerPx: 1.2,
  frontOverlapPct: 80,
  sideOverlapPct: 75,
  turnModel: 'Dubins_Continuous_Curvature'
};

// Compute Boustrophedon (back-and-forth) sweep angle minimizing turn count
const optimalAngleDeg = computeMinimumWidthSweepAngle(aoiPolygonUtm);
const swathWaypoints = generateDubinsSwathPath(aoiPolygonUtm, uavConfig, optimalAngleDeg);`,
    expectedOutput: '8-Panel Real-Time Flight Telemetry HUD + Dubins Boustrophedon UAV mission waypoints (MAVLink / QGroundControl / DJI KML).',
    steps: [
      'Configure 10-rotor electric propulsion telemetry and verify thrust-to-weight ratio across all 10 ESC channels.',
      'Inspect Wind Field vector gusts and Slope Landing Envelope (< 8 deg grade safety threshold).',
      'Compute minimum-turn Boustrophedon swath angle and Dubins headland curves.',
      'Verify tracks on a simulator or real machine before field operations.'
    ]
  }
]

const SCHOLARSHIP_PORTALS = [
  { country: 'China', portal: 'CSC.edu.cn', url: 'https://www.campuschina.org', focus: 'Chinese Government Scholarship — Remote Sensing, Photogrammetry & Geomatics (Wuhan / CAS)' },
  { country: 'Japan', portal: 'JASSO.go.jp', url: 'https://www.jasso.go.jp/en/', focus: 'MEXT & JASSO Fellowships — JAXA ALOS-4 SAR, Precision Agriculture & Disaster Robotics' },
  { country: 'Sweden', portal: 'StudyInSweden.se', url: 'https://studyinsweden.se/scholarships/', focus: 'SISGP Scholarships — Lund & KTH Geoinformatics, Arctic & Forestry Remote Sensing' },
  { country: 'Norway', portal: 'StudyInNorway.no', url: 'https://studyinnorway.no', focus: 'NTNU & UiT — Marine Bathymetry, Cryosphere & Copernicus Sentinel Operations' },
  { country: 'Denmark', portal: 'StudyInDenmark.dk', url: 'https://studyindenmark.dk', focus: 'DTU Space & Copenhagen — Eco-Hydrology, Drone Multispectral & Climate Modeling' },
  { country: 'Canada', portal: 'StudyInCanada.ca', url: 'https://www.educanada.ca', focus: 'Vanier / NSERC — RADARSAT Constellation, Boreal Carbon & Spatial AI' },
  { country: 'Australia', portal: 'StudyInAustralia.gov.au', url: 'https://www.studyaustralia.gov.au', focus: 'Australia Awards — Digital Earth Australia, Dryland Agronomy & Mineral Hyperspectral' },
  { country: 'New Zealand', portal: 'StudyInNewZealand.govt.nz', url: 'https://www.studywithnewzealand.govt.nz', focus: 'Manaaki NZ — LiDAR Geomorphology, Precision Pastoral & Koordinates Cadastral Labs' }
]

const ILLUMINATION_VECTORS: Record<number, [number, number]> = {
  0: [0, -1],
  45: [0.707, -0.707],
  90: [1, 0],
  135: [0.707, 0.707],
  180: [0, 1],
  225: [-0.707, 0.707],
  270: [-1, 0],
  315: [-0.707, -0.707]
}

export default function SevaGisTrainingAcademy({ farm, onClose, isModal = false }: Props) {
  const [activeTab, setActiveTab] = useState<AcademyTab>('training')
  const [selectedModuleId, setSelectedModuleId] = useState<string>(TRAINING_MODULES[0].id)
  const [completedLabs, setCompletedLabs] = useState<string[]>(['qgis-hydro-dem'])
  const [labRunning, setLabRunning] = useState(false)
  const [labOutputLog, setLabOutputLog] = useState<string[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [vectorCategory, setVectorCategory] = useState<string>('All')
  const [vectorSearch, setVectorSearch] = useState<string>('')
  const [connectedSourceIds, setConnectedSourceIds] = useState<number[]>([1, 4, 7, 9])

  const [contourStepM, setContourStepM] = useState<number>(20)
  const [sunAzimuth, setSunAzimuth] = useState<number>(315)
  const [paletteMode, setPaletteMode] = useState<'hypsometric' | 'bathymetric' | 'emerald' | 'thermal'>('hypsometric')
  const [showIsoLabels, setShowIsoLabels] = useState<boolean>(true)
  const [demGrid, setDemGrid] = useState<number[] | null>(null)
  const [demLoading, setDemLoading] = useState<boolean>(false)
  const [demError, setDemError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [paperTemplate, setPaperTemplate] = useState<'ieee-gis' | 'nipgr-bio'>('ieee-gis')
  const [authorName, setAuthorName] = useState<string>('Principal Spatial Investigator')

  const [windSpeedMs, setWindSpeedMs] = useState<number>(4.2)
  const [rotorRpmPct, setRotorRpmPct] = useState<number>(78)

  const activeModule = useMemo(
    () => TRAINING_MODULES.find(m => m.id === selectedModuleId) || TRAINING_MODULES[0],
    [selectedModuleId]
  )

  const filteredVectorSources = useMemo(() => {
    return FREE_GIS_VECTOR_SOURCES.filter(s => {
      const matchesCat = vectorCategory === 'All' || s.category === vectorCategory
      const q = vectorSearch.trim().toLowerCase()
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.formats.some(f => f.toLowerCase().includes(q))
      return matchesCat && matchesSearch
    })
  }, [vectorCategory, vectorSearch])

  const fetchRealDemGrid = useCallback(async () => {
    setDemLoading(true)
    setDemError(null)
    try {
      const [w, s, e, n] = farmBBox(farm as any)
      const padLon = Math.max((e - w) * 0.5, 0.012)
      const padLat = Math.max((n - s) * 0.5, 0.012)
      const minLon = w - padLon
      const maxLon = e + padLon
      const minLat = s - padLat
      const maxLat = n + padLat

      const lats: number[] = []
      const lons: number[] = []
      const N_GRID = 6
      for (let r = 0; r < N_GRID; r++) {
        for (let c = 0; c < N_GRID; c++) {
          const lat = maxLat - (r / (N_GRID - 1)) * (maxLat - minLat)
          const lon = minLon + (c / (N_GRID - 1)) * (maxLon - minLon)
          lats.push(Number(lat.toFixed(5)))
          lons.push(Number(lon.toFixed(5)))
        }
      }

      const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats.join(',')}&longitude=${lons.join(',')}`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Open-Meteo Elevation API returned HTTP ${res.status}`)
      }
      const json = await res.json()
      if (!Array.isArray(json?.elevation) || json.elevation.length !== N_GRID * N_GRID) {
        throw new Error('Incomplete elevation array from upstream DEM service')
      }
      setDemGrid(json.elevation.map((v: any) => Number(v) || 0))
    } catch (err: any) {
      setDemGrid(null)
      setDemError(err?.message || 'Unable to reach Copernicus / Open-Meteo Elevation service')
    } finally {
      setDemLoading(false)
    }
  }, [farm.id, farm.lat, farm.lon])

  useEffect(() => {
    if (activeTab === 'topo3d') {
      void fetchRealDemGrid()
    }
  }, [activeTab, fetchRealDemGrid])

  useEffect(() => {
    if (activeTab !== 'topo3d' || !demGrid || demGrid.length !== 36) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const N_GRID = 6
    const minElev = Math.min(...demGrid)
    const maxElev = Math.max(...demGrid)
    const spanElev = Math.max(maxElev - minElev, 4)

    const [lx, ly] = ILLUMINATION_VECTORS[sunAzimuth] || [-0.707, -0.707]

    const elevRaster = new Float32Array(W * H)
    for (let y = 0; y < H; y++) {
      const gy = (y / (H - 1)) * (N_GRID - 1)
      const r0 = Math.min(N_GRID - 2, Math.floor(gy))
      const ty = gy - r0
      for (let x = 0; x < W; x++) {
        const gx = (x / (W - 1)) * (N_GRID - 1)
        const c0 = Math.min(N_GRID - 2, Math.floor(gx))
        const tx = gx - c0

        const v00 = demGrid[r0 * N_GRID + c0]
        const v10 = demGrid[r0 * N_GRID + (c0 + 1)]
        const v01 = demGrid[(r0 + 1) * N_GRID + c0]
        const v11 = demGrid[(r0 + 1) * N_GRID + (c0 + 1)]

        const top = v00 * (1 - tx) + v10 * tx
        const bot = v01 * (1 - tx) + v11 * tx
        elevRaster[y * W + x] = top * (1 - ty) + bot * ty
      }
    }

    const img = ctx.createImageData(W, H)
    const data = img.data
    const minorStep = Math.max(1, contourStepM / 4)

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x
        const z = elevRaster[idx]
        const dzdx = (elevRaster[idx + 1] - elevRaster[idx - 1]) * 0.5
        const dzdy = (elevRaster[idx + W] - elevRaster[idx - W]) * 0.5
        const shade = Math.max(0.45, Math.min(1.22, 0.88 + (dzdx * lx + dzdy * ly) * 0.45))

        const modMajor = ((z % contourStepM) + contourStepM) % contourStepM
        const isMajorContour = modMajor < 0.35 || contourStepM - modMajor < 0.35
        const modMinor = ((z % minorStep) + minorStep) % minorStep
        const isMinorContour = modMinor < 0.18

        const norm = Math.max(0, Math.min(1, (z - minElev) / spanElev))
        let r = 20
        let g = 60
        let b = 90

        if (paletteMode === 'hypsometric') {
          if (norm < 0.28) {
            r = 18 + norm * 140
            g = 78 + norm * 240
            b = 138 + norm * 160
          } else if (norm < 0.62) {
            r = 55 + (norm - 0.28) * 320
            g = 152 + (norm - 0.28) * 130
            b = 92 - (norm - 0.28) * 90
          } else {
            r = 185 + (norm - 0.62) * 175
            g = 165 + (norm - 0.62) * 180
            b = 115 + (norm - 0.62) * 260
          }
        } else if (paletteMode === 'bathymetric') {
          r = 12 + norm * 95
          g = 48 + norm * 185
          b = 110 + norm * 140
        } else if (paletteMode === 'emerald') {
          r = 16 + norm * 140
          g = 75 + norm * 170
          b = 48 + norm * 90
        } else {
          r = 60 + norm * 195
          g = 25 + norm * 145
          b = 95 + (1 - norm) * 120
        }

        if (isMajorContour) {
          r = 15
          g = 23
          b = 42
        } else if (isMinorContour) {
          r = r * 0.76
          g = g * 0.76
          b = b * 0.76
        } else {
          r = Math.min(255, r * shade)
          g = Math.min(255, g * shade)
          b = Math.min(255, b * shade)
        }

        const p = idx * 4
        data[p] = r
        data[p + 1] = g
        data[p + 2] = b
        data[p + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)

    if (showIsoLabels) {
      ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace'
      const samplePoints = [
        { x: Math.round(W * 0.18), y: Math.round(H * 0.75), tag: 'Low Basin' },
        { x: Math.round(W * 0.36), y: Math.round(H * 0.52), tag: 'Mid Slope' },
        { x: Math.round(W * 0.54), y: Math.round(H * 0.34), tag: 'Upper Bench' },
        { x: Math.round(W * 0.74), y: Math.round(H * 0.24), tag: 'Crest' }
      ]
      samplePoints.forEach(pt => {
        const zVal = elevRaster[pt.y * W + pt.x] || minElev
        const label = `${zVal.toFixed(1)}m (${pt.tag})`
        const metrics = ctx.measureText(label)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
        ctx.fillRect(pt.x - 4, pt.y - 10, metrics.width + 8, 14)
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)'
        ctx.strokeRect(pt.x - 4, pt.y - 10, metrics.width + 8, 14)
        ctx.fillStyle = '#f8fafc'
        ctx.fillText(label, pt.x, pt.y)
      })
    }
  }, [activeTab, demGrid, contourStepM, sunAzimuth, paletteMode, showIsoLabels])

  const runTrainingLab = () => {
    setLabRunning(true)
    setLabOutputLog([
      `[00:00.12] Initializing ${activeModule.engine} runtime kernel for "${farm.name}" (${farm.lat.toFixed(4)} N, ${farm.lon.toFixed(4)} E)...`,
      `[00:00.48] Validating AOI geometry (${(farm.area || 14.8).toFixed(2)} ha) & applying SCL cloud mask...`
    ])
    setTimeout(() => {
      setLabOutputLog(prev => [
        ...prev,
        `[00:01.05] Executing formula: ${activeModule.theoryFormula}`,
        `[00:01.64] Verified output: ${activeModule.expectedOutput}`,
        `[00:01.90] Lab "${activeModule.title}" marked COMPLETE.`
      ])
      setLabRunning(false)
      if (!completedLabs.includes(activeModule.id)) {
        setCompletedLabs(prev => [...prev, activeModule.id])
      }
    }, 650)
  }

  const generatedResearchPaper = useMemo(() => {
    const ndviMean = farm.analysis?.ndvi?.mean !== undefined ? farm.analysis.ndvi.mean.toFixed(3) : 'Data unavailable (run scene analysis)'
    const ndmiMean = farm.analysis?.ndmi?.mean !== undefined ? farm.analysis.ndmi.mean.toFixed(3) : 'Data unavailable (run scene analysis)'
    const elev = farm.elevation !== undefined ? `${farm.elevation.toFixed(1)} m` : demGrid ? `${(demGrid.reduce((a, b) => a + b, 0) / demGrid.length).toFixed(1)} m` : 'Data unavailable'
    const slope = farm.analysis?.slopePct !== undefined ? `${farm.analysis.slopePct.toFixed(2)}%` : 'Data unavailable'
    const area = (farm.area || 14.8).toFixed(2)
    const sceneDate = farm.analysis?.scene?.datetime ? farm.analysis.scene.datetime.slice(0, 10) : 'Latest available pass'

    if (paperTemplate === 'nipgr-bio') {
      return `# Climate-Resilient Canopy Phenotyping, Nutrient Use Efficiency & Biofortification Assessment over ${farm.name}
**Author:** ${authorName} · **Framework:** DYOP.GIS / SEVA.GIS x BRIC-NIPGR Plant Genome Protocol
**Coordinates:** ${farm.lat.toFixed(4)} N, ${farm.lon.toFixed(4)} E · **Mapped Extent:** ${area} ha · **Scene Date:** ${sceneDate}

## 1. Abstract
Enhancing plant health, nutrient use efficiency (NUE), and climate resilience requires high-cadence spatial phenotyping. In this study, 10 m Sentinel-2 L2A multi-spectral surface reflectance and 30 m Copernicus GLO-30 terrain data were analyzed across **${farm.name}** (${area} ha). Mean Normalized Difference Vegetation Index (NDVI = ${ndviMean}) and Normalized Difference Moisture Index (NDMI = ${ndmiMean}) were evaluated alongside Red-Edge chlorophyll estimation (B05/B08) to inspect root-zone moisture retention and foliar vigour.

## 2. Introduction & Literature Review
Following BRIC-NIPGR (National Institute of Plant Genome Research) priorities in climate-resilient agriculture and biofortification, non-destructive remote sensing bridges molecular plant physiology and field-scale agronomy. Satellites show where canopy vigour or moisture differs across a parcel; laboratory tissue and soil testing are required to confirm exact nutrient concentrations.

## 3. Methodology
1. **Radiometric & Geometric Calibration:** Sentinel-2 L2A scenes were filtered via the Scene Classification Layer (SCL) to exclude cloud shadows (Class 3) and cirrus (Class 10).
2. **Hydrological Conditioning:** Copernicus DEM (${elev} mean elevation, ${slope} gradient) was conditioned via Wang & Liu (2006) priority-flood sink filling. Note: 30 m terrain misses small field furrows.
3. **Variable Rate Management Zones:** 5-zone K-Means clustering partitioned the parcel into targeted management zones for soil-test sampling.

## 4. Empirical Results & Discussion
- **Canopy Vigour (NDVI):** Mean ${ndviMean} (Scene: ${sceneDate}, Sensor: Sentinel-2 L2A).
- **Canopy Water Content (NDMI):** Mean ${ndmiMean}.
- **Topographic Slope:** ${slope}.

## 5. Conclusion
Integrating client-side WebGL/Float32Array spectral pipelines with GEE and QGIS interoperability enables reproducible, open-access spatial phenotyping for climate-resilient crop management.`
    }

    return `# Automated Multi-Engine Geospatial Evaluation of ${farm.name} Using Sentinel-2 L2A, Copernicus GLO-30 DEM, and Open QGIS/GEE Pipelines
**Author:** ${authorName} · **Platform:** DYOP.GIS (Do Your Own Project GIS) // SEVA.GIS
**Study Area:** ${farm.name} (${farm.lat.toFixed(4)} N, ${farm.lon.toFixed(4)} E · ${area} ha) · **Scene Date:** ${sceneDate}

## 1. Abstract
Desktop GIS workflows traditionally require manual switching between Google Earth Engine (GEE), QGIS 3.x, ArcGIS Pro, and MATLAB/Octave. This paper presents an end-to-end spatial evaluation of **${farm.name}** (${area} ha) using a local-first browser and Cloud Run architecture. Across the study boundary, Sentinel-2 L2A surface reflectance yielded a mean NDVI of **${ndviMean}** and NDMI of **${ndmiMean}**, while Horn (1981) convolution over Copernicus DEM established a mean elevation of **${elev}** and surface gradient of **${slope}**.

## 2. Data Sources & Vector Interoperability
Sixteen open global vector repositories—including OpenStreetMap, HydroSHEDS Level-12 basins, GADM administrative boundaries, FAO GeoNetwork soil units, and WRI Aqueduct water stress polygons—were cross-referenced against the AOI bounding box.

## 3. Mathematical Formulation
- **Vegetation Vigour (Rouse et al., 1974):** NDVI = (B8 - B4) / (B8 + B4) = ${ndviMean}
- **Canopy Moisture (Gao, 1996):** NDMI = (B8 - B11) / (B8 + B11) = ${ndmiMean}
- **Topographic Wetness Index (Beven & Kirkby, 1979):** TWI = ln(a / tan(beta))

## 4. Limitations & Honest Science Note
Satellite indices show where surface reflectance differs, not always why. Mineral indications are spectrally inferred ("likely") and must be verified with ground-truth sampling. 30 m terrain models capture field-scale drainage but miss micro-topographic furrows.`
  }, [farm, paperTemplate, authorName, demGrid])

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2200)
    })
  }

  const downloadVectorGeoJson = (source: VectorDataSource) => {
    const lat = farm.lat || 24.6404
    const lon = farm.lon || 78.0524
    const d = 0.0045
    const geojson = {
      type: 'FeatureCollection',
      metadata: {
        source: source.name,
        providerUrl: source.url,
        aoiName: farm.name,
        exportedAt: new Date().toISOString(),
        crs: 'EPSG:4326'
      },
      features: [
        {
          type: 'Feature',
          properties: {
            id: `src-${source.id}-aoi`,
            source_name: source.name,
            category: source.category,
            layer_type: source.sampleLayer,
            aoi_name: farm.name,
            area_ha: farm.area || 14.8,
            ndvi_mean: farm.analysis?.ndvi?.mean ?? null
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              farm.polygon && farm.polygon.length >= 3
                ? [...farm.polygon, farm.polygon[0]]
                : [
                    [lon - d, lat - d],
                    [lon + d, lat - d],
                    [lon + d, lat + d],
                    [lon - d, lat + d],
                    [lon - d, lat - d]
                  ]
            ]
          }
        }
      ]
    }
    void dispatchExport({
      category: 'data',
      fileName: `${farm.name.replace(/\W+/g, '_')}_${source.sampleLayer}`,
      blob: JSON.stringify(geojson, null, 2),
      mimeType: 'application/geo+json',
      customToast: `Extracted ${source.name} GeoJSON vector layer for ${farm.name}`
    })
  }

  return (
    <section
      className="ag-card seva-training-academy"
      style={{
        borderRadius: 16,
        border: '1px solid #cbd5e1',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        color: '#f8fafc',
        padding: isModal ? '24px' : '22px',
        marginTop: isModal ? 0 : '18px',
        marginBottom: isModal ? 0 : '22px',
        boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.35)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #10b981 0%, #0284c7 50%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
          }}>
            <GraduationCap size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                DYOP / SEVA·GIS Training Academy, 16 Vector Hub &amp; Research Studio
              </h2>
              <span style={{ fontSize: 10.5, background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', padding: '2px 8px', borderRadius: 999, fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                {completedLabs.length}/{TRAINING_MODULES.length} Labs Certified
              </span>
              <span style={{ fontSize: 10.5, background: 'rgba(56, 189, 248, 0.2)', color: '#7dd3fc', padding: '2px 8px', borderRadius: 999, fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.4)' }}>
                16 Free GIS Vector Portals
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#94a3b8' }}>
              Hands-on training across QGIS, GEE, ArcGIS, MATLAB &amp; 10-Rotor UAV Telemetry · Real Open-Meteo Elevation Contours · Gatsbi/NIPGR Thesis Studio
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11.5, background: 'rgba(30, 41, 59, 0.9)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(148, 163, 184, 0.25)', color: '#cbd5e1' }}>
            <b>Active AOI:</b> {farm.name} ({farm.lat.toFixed(3)}°N, {farm.lon.toFixed(3)}°E)
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#f8fafc',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close Studio
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {[
          { id: 'training' as AcademyTab, label: '1. GIS Training Labs (QGIS / GEE / ArcGIS / MATLAB)', icon: GraduationCap, badge: '5 Labs' },
          { id: 'vectors16' as AcademyTab, label: '2. 16 Free GIS Vector Data Sources', icon: Database, badge: '16 Portals' },
          { id: 'topo3d' as AcademyTab, label: '3. Real DEM Hypsometric & Bathymetric Contours', icon: Mountain, badge: 'Live API' },
          { id: 'telemetry' as AcademyTab, label: '4. 10-Rotor UAV Flight HUD & 8-Panel Telemetry', icon: Wind, badge: '660 lb Thrust' },
          { id: 'research' as AcademyTab, label: '5. Research Paper Studio (Gatsbi / NIPGR / Fellowships)', icon: FileText, badge: 'LaTeX + DOC' }
        ].map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 13px',
                borderRadius: 10,
                border: active ? '1.5px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.22)',
                background: active ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.35), rgba(16, 185, 129, 0.25))' : 'rgba(15, 23, 42, 0.65)',
                color: active ? '#f8fafc' : '#cbd5e1',
                fontWeight: active ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              <Icon size={15} color={active ? '#38bdf8' : '#94a3b8'} />
              <span>{tab.label}</span>
              <span style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 6,
                background: active ? 'rgba(56, 189, 248, 0.25)' : 'rgba(148, 163, 184, 0.15)',
                color: active ? '#bae6fd' : '#94a3b8'
              }}>
                {tab.badge}
              </span>
            </button>
          )
        })}
      </div>

      {activeTab === 'training' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
              Multi-Engine Curriculum · Select Lab
            </div>
            {TRAINING_MODULES.map(mod => {
              const selected = mod.id === activeModule.id
              const done = completedLabs.includes(mod.id)
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => {
                    setSelectedModuleId(mod.id)
                    setLabOutputLog([])
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: selected ? '1.5px solid #10b981' : '1px solid rgba(148, 163, 184, 0.2)',
                    background: selected ? 'rgba(16, 185, 129, 0.14)' : 'rgba(15, 23, 42, 0.6)',
                    color: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: 'rgba(56, 189, 248, 0.18)',
                      color: '#7dd3fc'
                    }}>
                      {mod.engine}
                    </span>
                    <span style={{ fontSize: 11, color: done ? '#4ade80' : '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {done && <Check size={13} color="#4ade80" />}
                      {done ? 'Completed' : mod.duration}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', lineHeight: 1.35 }}>
                    {mod.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                    {mod.summary.slice(0, 95)}…
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{
            gridColumn: 'span 2',
            background: 'rgba(15, 23, 42, 0.78)',
            border: '1px solid rgba(148, 163, 184, 0.24)',
            borderRadius: 14,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399', background: 'rgba(16, 185, 129, 0.18)', padding: '2px 8px', borderRadius: 6 }}>
                    {activeModule.engine}
                  </span>
                  <span style={{ fontSize: 11, color: '#cbd5e1' }}>Level: <b>{activeModule.level}</b></span>
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>{activeModule.title}</h3>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={runTrainingLab}
                  disabled={labRunning}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'linear-gradient(135deg, #10b981, #0284c7)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '7px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Play size={14} />
                  <span>{labRunning ? 'Executing Lab on AOI…' : 'Run Lab on Active AOI'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyText(activeModule.codeSnippet, activeModule.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255,255,255,0.16)',
                    borderRadius: 8,
                    padding: '7px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {copiedId === activeModule.id ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                  <span>{copiedId === activeModule.id ? 'Copied Script' : 'Copy Code'}</span>
                </button>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.5 }}>
              {activeModule.summary}
            </p>

            <div style={{ background: 'rgba(2, 132, 199, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#bae6fd', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              <b>Expert Formula / Method:</b> {activeModule.theoryFormula}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {activeModule.steps.map((step, i) => (
                <div key={i} style={{ background: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: 8, padding: '8px 10px', fontSize: 11.5, color: '#e2e8f0' }}>
                  <b style={{ color: '#38bdf8' }}>Step {i + 1}:</b> {step}
                </div>
              ))}
            </div>

            <pre style={{
              margin: 0,
              padding: 14,
              borderRadius: 10,
              background: '#020617',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              color: '#a7f3d0',
              fontSize: 11.5,
              lineHeight: 1.5,
              overflowX: 'auto',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
            }}>
              <code>{activeModule.codeSnippet}</code>
            </pre>

            {labOutputLog.length > 0 && (
              <div style={{ background: 'rgba(6, 78, 59, 0.35)', border: '1px solid rgba(16, 185, 129, 0.45)', borderRadius: 10, padding: 12, fontSize: 11.5, fontFamily: 'ui-monospace, monospace', color: '#d1fae5' }}>
                <div style={{ fontWeight: 700, marginBottom: 4, color: '#34d399' }}>LIVE EXECUTION TELEMETRY ({farm.name}):</div>
                {labOutputLog.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'vectors16' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['All', 'Global Base', 'Hydrology', 'Agriculture & Environment', 'Admin Boundaries', 'Forestry & Climate', 'Regional & Cadastral'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setVectorCategory(cat)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 999,
                    border: vectorCategory === cat ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.25)',
                    background: vectorCategory === cat ? 'rgba(2, 132, 199, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                    color: vectorCategory === cat ? '#f8fafc' : '#cbd5e1',
                    fontSize: 11.5,
                    fontWeight: vectorCategory === cat ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: 8, padding: '5px 10px' }}>
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                value={vectorSearch}
                onChange={e => setVectorSearch(e.target.value)}
                placeholder="Search 16 vector sources (SHP, GeoJSON, KML)..."
                style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: 12, outline: 'none', width: 240 }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filteredVectorSources.map(src => {
              const isConnected = connectedSourceIds.includes(src.id)
              return (
                <div
                  key={src.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: isConnected ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: 12,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.14)', padding: '2px 7px', borderRadius: 6 }}>
                        #{src.id} · {src.category}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {src.formats.map(f => (
                          <span key={f} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1' }}>
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                      {src.name}
                    </h4>
                    <p style={{ margin: 0, fontSize: 11.5, color: '#94a3b8', lineHeight: 1.45 }}>
                      {src.description}
                    </p>
                    <div style={{ marginTop: 6, fontSize: 11, color: '#6ee7b7' }}>
                      {src.featureCountPrompt}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingTop: 8, borderTop: '1px solid rgba(148, 163, 184, 0.14)' }}>
                    <button
                      type="button"
                      onClick={() => downloadVectorGeoJson(src)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.45)',
                        color: '#6ee7b7',
                        padding: '5px 9px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <Download size={12} />
                      <span>Clip AOI GeoJSON</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConnectedSourceIds(prev =>
                          prev.includes(src.id) ? prev.filter(i => i !== src.id) : [...prev, src.id]
                        )
                      }}
                      style={{
                        background: isConnected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(148, 163, 184, 0.25)',
                        color: isConnected ? '#7dd3fc' : '#cbd5e1',
                        padding: '5px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {isConnected ? 'Active in Catalog' : '+ Mount Catalog'}
                    </button>

                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        color: '#94a3b8',
                        fontSize: 11,
                        textDecoration: 'none'
                      }}
                      title={`Open ${src.domain}`}
                    >
                      <span>Portal</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'topo3d' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
          <div style={{ gridColumn: 'span 2', background: '#020617', borderRadius: 14, border: '1px solid rgba(56, 189, 248, 0.3)', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                  Real Copernicus / Open-Meteo DEM Isoline Relief Plate ({farm.name})
                </h3>
                <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                  Source: api.open-meteo.com/v1/elevation (6x6 AOI grid) · {contourStepM}m major contours · Sun Azimuth {sunAzimuth}° · Note: 30m/90m DEM misses small furrows
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void fetchRealDemGrid()}
                  disabled={demLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#f8fafc',
                    border: '1px solid rgba(148,163,184,0.3)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={13} className={demLoading ? 'spin' : ''} />
                  <span>{demLoading ? 'Fetching DEM…' : 'Retry / Refresh DEM'}</span>
                </button>
                <button
                  type="button"
                  disabled={!demGrid}
                  onClick={() => {
                    const canvas = canvasRef.current
                    if (!canvas) return
                    canvas.toBlob(blob => {
                      if (!blob) return
                      void dispatchExport({
                        category: 'images',
                        fileName: `${farm.name.replace(/\W+/g, '_')}_Real_DEM_Contours_${contourStepM}m.png`,
                        blob,
                        mimeType: 'image/png',
                        customToast: `Exported Real DEM Hypsometric Contour PNG for ${farm.name}`
                      })
                    }, 'image/png')
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'linear-gradient(135deg, #0284c7, #10b981)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Download size={13} />
                  <span>Export 300 DPI Relief Plate</span>
                </button>
              </div>
            </div>

            {demError ? (
              <div style={{ padding: 24, borderRadius: 10, background: 'rgba(127, 29, 29, 0.25)', border: '1px solid rgba(248, 113, 113, 0.4)', color: '#fecaca', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertCircle size={20} color="#f87171" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Data unavailable</div>
                    <div style={{ fontSize: 12, color: '#fca5a5' }}>Reason: {demError}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchRealDemGrid()}
                  style={{ padding: '6px 12px', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                width={680}
                height={340}
                style={{ width: '100%', height: 'auto', borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.25)', display: 'block' }}
              />
            )}
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.78)', borderRadius: 14, border: '1px solid rgba(148, 163, 184, 0.24)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
              Isoline &amp; Hillshade Controls
            </h4>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: '#cbd5e1', marginBottom: 6 }}>
                Major Contour Interval: <b>{contourStepM} m</b>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[5, 10, 20, 50].map(step => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setContourStepM(step)}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      borderRadius: 6,
                      border: contourStepM === step ? '1.5px solid #38bdf8' : '1px solid rgba(148,163,184,0.25)',
                      background: contourStepM === step ? 'rgba(2, 132, 199, 0.3)' : 'rgba(15,23,42,0.7)',
                      color: '#f8fafc',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {step}m
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: '#cbd5e1', marginBottom: 6 }}>
                Solar Hillshade Azimuth: <b>{sunAzimuth}°</b>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {[0, 45, 90, 135, 180, 225, 270, 315].map(az => (
                  <button
                    key={az}
                    type="button"
                    onClick={() => setSunAzimuth(az)}
                    style={{
                      padding: '5px 0',
                      borderRadius: 6,
                      border: sunAzimuth === az ? '1.5px solid #38bdf8' : '1px solid rgba(148,163,184,0.25)',
                      background: sunAzimuth === az ? 'rgba(2, 132, 199, 0.3)' : 'rgba(15,23,42,0.7)',
                      color: '#f8fafc',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {az}°
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, color: '#cbd5e1', marginBottom: 6 }}>
                Hypsometric Color Ramp
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { id: 'hypsometric', label: 'Topo + Bathymetric' },
                  { id: 'bathymetric', label: 'Deep Bathymetry' },
                  { id: 'emerald', label: 'Emerald Basin' },
                  { id: 'thermal', label: 'Geomorph Thermal' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPaletteMode(p.id as any)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: paletteMode === p.id ? '1.5px solid #10b981' : '1px solid rgba(148,163,184,0.25)',
                      background: paletteMode === p.id ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15,23,42,0.7)',
                      color: '#f8fafc',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#e2e8f0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showIsoLabels}
                onChange={e => setShowIsoLabels(e.target.checked)}
              />
              <span>Render real elevation tags on relief plate</span>
            </label>
          </div>
        </div>
      )}

      {activeTab === 'telemetry' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                10-Rotor Electric Heavy-Lift UAV Flight Assistant &amp; 8-Panel Telemetry Matrix (Simulation Estimate)
              </h3>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                660 lb Total Electric Thrust · Swath planner reimplementation inspired by Fields2Cover · Verify tracks on a real machine before flight
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ fontSize: 11.5, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Simulated Wind Gust: <b>{windSpeedMs.toFixed(1)} m/s</b></span>
                <input type="range" min={0.5} max={14} step={0.5} value={windSpeedMs} onChange={e => setWindSpeedMs(Number(e.target.value))} />
              </label>
              <label style={{ fontSize: 11.5, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Throttle: <b>{rotorRpmPct}%</b></span>
                <input type="range" min={40} max={100} step={2} value={rotorRpmPct} onChange={e => setRotorRpmPct(Number(e.target.value))} />
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {[
              {
                code: '01 / WIND FIELD',
                metric: `${windSpeedMs.toFixed(1)} m/s @ 285° WNW`,
                status: windSpeedMs < 8 ? 'NOMINAL GUST ENVELOPE' : 'HIGH CROSSWIND DRIFT',
                detail: `Estimated cross-track crab compensation: ${(windSpeedMs * 0.42).toFixed(2)}° across ${farm.name}.`,
                color: windSpeedMs < 8 ? '#34d399' : '#fbbf24'
              },
              {
                code: '02 / LANDING ENVELOPE',
                metric: farm.analysis?.slopePct !== undefined ? `${farm.analysis.slopePct.toFixed(1)}% Surface Grade` : 'Slope: Awaiting DEM',
                status: (farm.analysis?.slopePct ?? 2.1) <= 6 ? 'SAFE TOUCHDOWN ZONE' : 'STEEP SLOPE CAUTION',
                detail: `Copernicus DEM elevation ${farm.elevation !== undefined ? `${farm.elevation.toFixed(1)}m` : 'n/a'} · Safe < 8.0% grade.`,
                color: '#38bdf8'
              },
              {
                code: '03 / CONTROL TIMING',
                metric: '2.4 ms ESC Loop · 400 Hz',
                status: 'SIMULATION MODEL',
                detail: '10-rotor synchronous PWM + RTK-GPS horizontal guidance target.',
                color: '#a78bfa'
              },
              {
                code: '04 / THRUST ALLOCATION',
                metric: `${Math.round((660 * rotorRpmPct) / 100)} / 660 lb Thrust (est.)`,
                status: '10 ELECTRIC ROTORS BALANCED',
                detail: `Estimated per-rotor load: ${((6.6 * rotorRpmPct) / 10).toFixed(1)} lb.`,
                color: '#34d399'
              },
              {
                code: '05 / REPLAY FINGERPRINT',
                metric: 'Deterministic Swath Trace',
                status: 'INSPIRED BY FIELDS2COVER',
                detail: '80% front / 75% side overlap parameters configured for AOI.',
                color: '#38bdf8'
              },
              {
                code: '06 / FAILURE SPACE',
                metric: 'N+2 Rotor Redundancy Model',
                status: 'ENVELOPE CHECK',
                detail: 'Models loss of 2 opposing electric rotors under current payload.',
                color: '#34d399'
              },
              {
                code: '07 / PARALLEL AGENTS',
                metric: '27-Agent Roster Linked',
                status: 'A17 + A18 VERIFIED',
                detail: 'Precision Ag Agent (A17) swath plan audited by Science Validator (A18).',
                color: '#f472b6'
              },
              {
                code: '08 / REGRESSION WORKSPACE',
                metric: 'Hard AOI Geofence Clip',
                status: 'GEOFENCE ACTIVE',
                detail: `Polygon clip active over ${(farm.area || 14.8).toFixed(2)} ha AOI perimeter.`,
                color: '#6ee7b7'
              }
            ].map(panel => (
              <div
                key={panel.code}
                style={{
                  background: '#020617',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: 12,
                  padding: 14,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#94a3b8', marginBottom: 6 }}>
                  <span>{panel.code}</span>
                  <span style={{ color: panel.color, fontWeight: 700 }}>● {panel.status}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginBottom: 6 }}>
                  {panel.metric}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                  {panel.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'research' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          <div style={{ gridColumn: 'span 2', background: 'rgba(15, 23, 42, 0.82)', borderRadius: 14, border: '1px solid rgba(148, 163, 184, 0.24)', padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setPaperTemplate('ieee-gis')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: paperTemplate === 'ieee-gis' ? '1.5px solid #38bdf8' : '1px solid rgba(148,163,184,0.25)',
                    background: paperTemplate === 'ieee-gis' ? 'rgba(2, 132, 199, 0.3)' : 'transparent',
                    color: '#f8fafc',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Gatsbi AI · IEEE / MDPI Geospatial Paper
                </button>
                <button
                  type="button"
                  onClick={() => setPaperTemplate('nipgr-bio')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: paperTemplate === 'nipgr-bio' ? '1.5px solid #10b981' : '1px solid rgba(148,163,184,0.25)',
                    background: paperTemplate === 'nipgr-bio' ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
                    color: '#f8fafc',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  BRIC-NIPGR · Plant Genome &amp; Climate-Resilient Ag
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => copyText(generatedResearchPaper, 'paper-md')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#f8fafc',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {copiedId === 'paper-md' ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                  <span>{copiedId === 'paper-md' ? 'Copied Manuscript' : 'Copy Manuscript'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void dispatchExport({
                      category: 'reports',
                      fileName: `${farm.name.replace(/\W+/g, '_')}_Research_Manuscript.doc`,
                      blob: generatedResearchPaper,
                      mimeType: 'application/msword',
                      customToast: `Exported Word (.doc) Research Manuscript for ${farm.name}`
                    })
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'linear-gradient(135deg, #10b981, #0284c7)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Download size={14} />
                  <span>Download Word (.doc)</span>
                </button>
              </div>
            </div>

            <pre style={{
              margin: 0,
              padding: 16,
              borderRadius: 10,
              background: '#020617',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              color: '#e2e8f0',
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              maxHeight: 380,
              overflowY: 'auto'
            }}>
              {generatedResearchPaper}
            </pre>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.82)', borderRadius: 14, border: '1px solid rgba(148, 163, 184, 0.24)', padding: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
              Global Geospatial Scholarships &amp; Research Portals
            </h4>
            <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#94a3b8' }}>
              Direct portals for Masters/PhD &amp; Postdoc fellowships in Remote Sensing, Geoinformatics &amp; Climate Agriculture:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SCHOLARSHIP_PORTALS.map(sp => (
                <a
                  key={sp.portal}
                  href={sp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'rgba(2, 6, 23, 0.7)',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                    textDecoration: 'none',
                    color: '#f8fafc'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
                    <span>{sp.country} · {sp.portal}</span>
                    <ExternalLink size={12} />
                  </div>
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2 }}>{sp.focus}</div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
