import { useEffect, useRef, useState } from 'react'
import {
  Sprout,
  Droplets,
  Mountain,
  Compass,
  ShieldCheck,
  HardDrive,
  Activity,
  Play,
  Pause,
  RotateCw,
  Sparkles,
} from 'lucide-react'
import { PARTICLES, type ParticleDef } from '../assets/logoPoints'

export type DomainKey = 'agri' | 'hydro' | 'terrain' | 'geology' | 'hazard' | 'vault'

export interface ClockwiseTechnique {
  angle: string
  clockLabel: string
  title: string
  sensor: string
  formula: string
  desc: string
  unitBadge: string
}

export interface DomainSpec {
  name: string
  shortName: string
  tag: string
  icon: typeof Sprout
  color: string
  rgb: [number, number, number]
  secondaryRgb: [number, number, number]
  bg: string
  border: string
  techniques: ClockwiseTechnique[]
}

export const DOMAIN_DATA: Record<DomainKey, DomainSpec> = {
  agri: {
    name: 'Precision Agriculture & Plant Dynamics',
    shortName: 'Precision Agriculture',
    tag: 'Sentinel-2 L2A BOA · Red-Edge · Robotics',
    icon: Sprout,
    color: '#10b981',
    rgb: [16, 185, 129],
    secondaryRgb: [56, 242, 208],
    bg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.38)',
    techniques: [
      {
        angle: '12:00',
        clockLabel: '0° N · Step 01',
        title: 'Chlorophyll Red-Edge (NDRE / CIre)',
        sensor: 'Sentinel-2 Band 5 (705 nm) & Band 7 (783 nm)',
        formula: '(B08 - B05) / (B08 + B05)',
        desc: 'Detects early canopy nitrogen deficiency and foliar chlorophyll breakdown weeks before visible yellowing occurs.',
        unitBadge: 'Index [-1.0 to +1.0]',
      },
      {
        angle: '02:00',
        clockLabel: '60° NE · Step 02',
        title: 'Photosynthetic Canopy Biomass (NDVI)',
        sensor: 'Sentinel-2 Band 4 (Red) & Band 8 (NIR)',
        formula: '(B08 - B04) / (B08 + B04)',
        desc: 'Quantifies normalized vegetative vigor, leaf area index (LAI), and photosynthetic biomass volume at 10 m resolution.',
        unitBadge: '10m BOA Reflectance',
      },
      {
        angle: '04:00',
        clockLabel: '120° SE · Step 03',
        title: 'Soil-Adjusted Stand Index (SAVI / MSAVI)',
        sensor: 'Sentinel-2 Red & NIR + Canopy Factor L=0.5',
        formula: '[(1 + L)(B08 - B04)] / (B08 + B04 + L)',
        desc: 'Suppresses background bright or wet soil reflectance noise in young, sparse, or emergent row-crop stands.',
        unitBadge: 'L = 0.5 Soil Correction',
      },
      {
        angle: '06:00',
        clockLabel: '180° S · Step 04',
        title: 'Machinery Swath Routing (Fields2Cover)',
        sensor: 'Client Geodesic & Cartesian Swath Engine',
        formula: 'min θ { Turn_loss(θ) + Overlap(θ) }',
        desc: 'Computes continuous non-overlapping boustrophedon tractor and 10-rotor UAV spray paths with optimal headland turns.',
        unitBadge: 'WGS84 / UTM Waypoints',
      },
      {
        angle: '08:00',
        clockLabel: '240° SW · Step 05',
        title: 'Variable-Rate Nitrogen Prescriptions (VRA)',
        sensor: 'SEVA Precision Zonal Engine',
        formula: 'N_rate(i) = Base_N × [1 - (NDVI(i) - μ) / σ]',
        desc: 'Partitions the parcel into High, Medium, and Low vigor management zones to cut excess urea while boosting weak zones.',
        unitBadge: 'kg N / ha Prescription',
      },
      {
        angle: '10:00',
        clockLabel: '300° NW · Step 06',
        title: 'Phenology & Growing Degree Days (GDD)',
        sensor: 'Open-Meteo ERA5-Land + S2 Time-Series',
        formula: 'GDD = Σ max(0, (T_max + T_min)/2 - T_base)',
        desc: 'Tracks thermal accumulation across vegetative, flowering, and grain-filling crop stages automatically.',
        unitBadge: '°C·days Thermal Sum',
      },
    ],
  },
  hydro: {
    name: 'Hydrology & Catchment Drainage',
    shortName: 'Hydrology & Drainage',
    tag: 'Copernicus DEM · D8 Routing · SCS-CN',
    icon: Droplets,
    color: '#06b6d4',
    rgb: [6, 182, 212],
    secondaryRgb: [56, 189, 248],
    bg: 'rgba(6, 182, 212, 0.14)',
    border: 'rgba(6, 182, 212, 0.38)',
    techniques: [
      {
        angle: '12:00',
        clockLabel: '0° N · Step 01',
        title: 'Topographic Wetness Index (TWI)',
        sensor: 'Copernicus GLO-30 DEM (30m Orthometric)',
        formula: 'TWI = ln(α / tan β)',
        desc: 'Calculates spatial soil moisture convergence and waterlogging zones from upslope contributing area (α) and local slope (β).',
        unitBadge: 'Dimensionless Wetness',
      },
      {
        angle: '02:00',
        clockLabel: '60° NE · Step 02',
        title: 'D8 Flow Direction & Accumulation',
        sensor: 'Priority-Flood Depression-Free DEM Kernel',
        formula: 'Dir = argmax_i [ (Z_0 - Z_i) / d_i ]',
        desc: 'Traces overland storm runoff trajectories and natural convergent drainage corridors across every parcel cell.',
        unitBadge: '8-Direction Steepest Drop',
      },
      {
        angle: '04:00',
        clockLabel: '120° SE · Step 03',
        title: 'Strahler Stream Channel Network',
        sensor: 'Hydrological Hierarchy Extractor',
        formula: 'ω = max(ω_1, ω_2) + (ω_1 == ω_2 ? 1 : 0)',
        desc: 'Delineates 1st to 4th order ephemeral and perennial drainage gullies to site farm ponds, bunds, and check dams.',
        unitBadge: 'Orders ω = 1..4',
      },
      {
        angle: '06:00',
        clockLabel: '180° S · Step 04',
        title: 'SCS-CN Surface Runoff Yield',
        sensor: 'USDA NRCS Curve Number & SWAT Formulation',
        formula: 'Q = (P - 0.2S)² / (P + 0.8S)',
        desc: 'Quantifies storm event runoff depth (mm) and rainwater harvesting volume from hydrologic soil group and land cover.',
        unitBadge: 'mm Storm Runoff Yield',
      },
      {
        angle: '08:00',
        clockLabel: '240° SW · Step 05',
        title: 'Saxton-Rawls Soil Hydraulics Core',
        sensor: 'ISRIC SoilGrids 2.0 (Clay, Sand, SOC)',
        formula: 'AWC = θ_FC(33 kPa) - θ_PWP(1500 kPa)',
        desc: 'Derives Field Capacity, Permanent Wilting Point, saturated hydraulic conductivity (Ksat), and available water capacity.',
        unitBadge: 'mm/m Rootzone Storage',
      },
      {
        angle: '10:00',
        clockLabel: '300° NW · Step 06',
        title: 'Open Water & Moisture Deficit (NDWI / NDMI)',
        sensor: 'Sentinel-2 Band 3 (Green), Band 8 (NIR) & Band 11 (SWIR)',
        formula: 'NDWI = (B03 - B08)/(B03 + B08) · NDMI = (B08 - B11)/(B08 + B11)',
        desc: 'Pinpoints standing surface water in farm ponds alongside root-zone canopy hydration deficit prior to wilting.',
        unitBadge: 'Surface & Canopy Water',
      },
    ],
  },
  terrain: {
    name: 'Terrain & 3D Topography',
    shortName: 'Terrain & DEM',
    tag: 'Copernicus GLO-30 · Horn Gradient · Hillshade',
    icon: Mountain,
    color: '#f59e0b',
    rgb: [245, 158, 11],
    secondaryRgb: [251, 191, 36],
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.38)',
    techniques: [
      {
        angle: '12:00',
        clockLabel: '0° N · Step 01',
        title: 'Copernicus GLO-30 Digital Elevation',
        sensor: 'Copernicus GLO-30 DSM + Open-Meteo Elevation',
        formula: 'Z(x, y) [m MSL Orthometric]',
        desc: 'Streams real 30-metre surface elevation grids with cubic-spline densification for hypsometric and contour mapping.',
        unitBadge: 'Meters Above Sea Level',
      },
      {
        angle: '02:00',
        clockLabel: '60° NE · Step 02',
        title: 'Horn Slope Gradient (%)',
        sensor: '3×3 Weighted Finite-Difference Kernel',
        formula: 'Slope = arctan √[ (∂z/∂x)² + (∂z/∂y)² ]',
        desc: 'Classifies parcel relief into level (0–3%), gently undulating (3–8%), and steep (>8%) erosion-sensitive grades.',
        unitBadge: 'Degrees (°) & Grade (%)',
      },
      {
        angle: '04:00',
        clockLabel: '120° SE · Step 03',
        title: 'Multi-Directional Hillshade Relief',
        sensor: 'Lambertian Solar Illumination Engine',
        formula: 'I = cos(θ_z)cos(S) + sin(θ_z)sin(S)cos(φ_s - A)',
        desc: 'Synthesizes 315° NW solar azimuth illumination to expose micro-ridges, terraces, and gully incisions in 3D.',
        unitBadge: 'Azimuth 315° · Alt 45°',
      },
      {
        angle: '06:00',
        clockLabel: '180° S · Step 04',
        title: 'Surface Aspect & Solar Insolation',
        sensor: '2D Gradient Orientation Vector',
        formula: 'Aspect = 180° - arctan2(∂z/∂y, -∂z/∂x)',
        desc: 'Computes compass orientation (0° N to 360°) of every slope facet to model solar radiation and evapotranspiration.',
        unitBadge: '0°–360° Azimuthal Bearing',
      },
      {
        angle: '08:00',
        clockLabel: '240° SW · Step 05',
        title: 'Drainage Divide & Ridge Crests',
        sensor: 'Geodesic Zero-Laplacian Extractor',
        formula: '∇²Z < 0 · Flow_Acc = Local Minimum',
        desc: 'Maps natural micro-catchment ridge lines where overland water bifurcates into adjacent sub-basins.',
        unitBadge: 'Watershed Crest Vector',
      },
      {
        angle: '10:00',
        clockLabel: '300° NW · Step 06',
        title: 'Topographic Convergence Sinks',
        sensor: 'Planchon-Darboux Depression Fill',
        formula: 'Depth_sink = Z_filled(x,y) - Z_raw(x,y)',
        desc: 'Isolates closed micro-depressions prone to standing floodwater, anaerobic root stress, and salt crusting.',
        unitBadge: 'Sink Depth (m)',
      },
    ],
  },
  geology: {
    name: 'Geology & Mineral Exploration',
    shortName: 'Geology & Minerals',
    tag: 'Sentinel-2 SWIR Spectroscopy · USGS Band Math',
    icon: Compass,
    color: '#a855f7',
    rgb: [168, 85, 247],
    secondaryRgb: [216, 180, 254],
    bg: 'rgba(168, 85, 247, 0.14)',
    border: 'rgba(168, 85, 247, 0.38)',
    techniques: [
      {
        angle: '12:00',
        clockLabel: '0° N · Step 01',
        title: 'Ferrous Iron Mineral Index (FMI)',
        sensor: 'Sentinel-2 Band 12 (2190 nm) & Band 8A (865 nm)',
        formula: 'FMI = B12 / B08A (SWIR2 / Narrow NIR)',
        desc: 'Maps surface ferrous silicates, magnetite-rich sands, and ferruginous lateritic regolith exposures.',
        unitBadge: 'SWIR2 / NIR Ratio',
      },
      {
        angle: '02:00',
        clockLabel: '60° NE · Step 02',
        title: 'Iron Oxide & Gossan Ratio (IOI)',
        sensor: 'Sentinel-2 Band 4 (Red) & Band 2 (Blue)',
        formula: 'IOI = B04 / B02 (665 nm / 490 nm)',
        desc: 'Highlights ferric iron charge-transfer absorption in weathered hematite, goethite, and oxidized gossan caps.',
        unitBadge: 'VNIR Charge Transfer',
      },
      {
        angle: '04:00',
        clockLabel: '120° SE · Step 03',
        title: 'Clay & Hydroxyl Minerals Ratio (HMR)',
        sensor: 'Sentinel-2 Band 11 (1610 nm) & Band 12 (2190 nm)',
        formula: 'HMR = B11 / B12 (SWIR1 / SWIR2)',
        desc: 'Captures Al-OH and Mg-OH vibrational absorption near 2.2 μm to identify kaolinite, illite, and smectite clays.',
        unitBadge: '2.2 μm Hydroxyl Band',
      },
      {
        angle: '06:00',
        clockLabel: '180° S · Step 04',
        title: 'Carbonate & Calcite Alteration Index (CCI)',
        sensor: 'Sentinel-2 B11, B04 & B08A',
        formula: 'CCI = (B11 + B04) / B08A',
        desc: 'Delineates calcareous kankar nodules, limestone outcrops, and alkaline carbonate soil horizons.',
        unitBadge: 'Calcite / Dolomite Proxy',
      },
      {
        angle: '08:00',
        clockLabel: '240° SW · Step 05',
        title: 'Silica & Quartz Weathering Index (SQI)',
        sensor: 'Sentinel-2 Band 11 (SWIR1) & Band 4 (Red)',
        formula: 'SQI = B11 / B04',
        desc: 'Tracks quartz-rich sandy alluvium, quartzite ridges, and leached siliceous topsoil fractions.',
        unitBadge: 'Silicate Weathering Ratio',
      },
      {
        angle: '10:00',
        clockLabel: '300° NW · Step 06',
        title: 'SWIR False-Color Lithology Composite',
        sensor: 'Sentinel-2 RGB = B12 / B11 / B02',
        formula: 'R: 2190 nm · G: 1610 nm · B: 490 nm',
        desc: 'Separates exposed bedrock lithologies, hydrothermal alteration halos, and alluvial fans in high contrast.',
        unitBadge: '3-Band Litho Composite',
      },
    ],
  },
  hazard: {
    name: 'Catastrophe, Hazard & Soil Health',
    shortName: 'Hazard & Soil Health',
    tag: 'Dynamic World · Soil Salinity · Burn Scars',
    icon: ShieldCheck,
    color: '#ef4444',
    rgb: [239, 68, 68],
    secondaryRgb: [251, 113, 133],
    bg: 'rgba(239, 68, 68, 0.14)',
    border: 'rgba(239, 68, 68, 0.38)',
    techniques: [
      {
        angle: '12:00',
        clockLabel: '0° N · Step 01',
        title: 'Combined Canopy Stress Risk Flag',
        sensor: 'Multi-Sensor Red-Edge + SWIR Consensus',
        formula: 'Stress = 0.6 × (0.35 - NDRE) + 0.4 × (0.25 - NDMI)',
        desc: 'Flags acute pest, blight, or drought hotspots where chlorophyll loss coincides with leaf water depletion.',
        unitBadge: 'Compound Stress Alert',
      },
      {
        angle: '02:00',
        clockLabel: '60° NE · Step 02',
        title: 'Normalized Burn Ratio (NBR)',
        sensor: 'Sentinel-2 Band 8 (NIR) & Band 12 (SWIR2)',
        formula: 'NBR = (B08 - B12) / (B08 + B12)',
        desc: 'Quantifies post-harvest residue burning footprints, wildfire severity (ΔNBR), and char deposition.',
        unitBadge: 'USGS Burn Severity Scale',
      },
      {
        angle: '04:00',
        clockLabel: '120° SE · Step 03',
        title: 'Normalized Salinity Index (NDSI)',
        sensor: 'Sentinel-2 Band 4 (Red) & Band 3 (Green)',
        formula: 'NDSI = (B04 - B03) / (B04 + B03)',
        desc: 'Detects surface white salt efflorescence and secondary canal-command salinization across irrigated tracts.',
        unitBadge: 'dS/m Salinity Proxy',
      },
      {
        angle: '06:00',
        clockLabel: '180° S · Step 04',
        title: 'Sheet Erosion Vulnerability Factor',
        sensor: 'Slope Gradient × Stream Power Index (SPI)',
        formula: 'Erosion = Slope(%) × ln(Flow_Acc + 1)',
        desc: 'Pinpoints vulnerable topsoil wash corridors where steep slope and concentrated overland flow converge.',
        unitBadge: 'RUSLE / SPI Risk Class',
      },
      {
        angle: '08:00',
        clockLabel: '240° SW · Step 05',
        title: 'Inundation & Cloudburst Ponding Risk',
        sensor: 'Topographic Sinks × Modified NDWI',
        formula: 'Ponding = Sinks(>10 cm) ∩ (MNDWI > 0)',
        desc: 'Maps sub-parcel flood-ponding pockets during monsoon cloudbursts to guide emergency surface drainage trenches.',
        unitBadge: 'Inundation Footprint',
      },
      {
        angle: '10:00',
        clockLabel: '300° NW · Step 06',
        title: 'Bare Soil & Residue Exposure (BSI)',
        sensor: 'Sentinel-2 B11, B04, B08 & B02',
        formula: 'BSI = [(B11 + B04) - (B08 + B02)] / [(B11 + B04) + (B08 + B02)]',
        desc: 'Separates exposed bare mineral soil from crop residue mulch for conservation-tillage and carbon audits.',
        unitBadge: 'Bare Ground Fraction',
      },
    ],
  },
  vault: {
    name: 'Google Drive Cloud Vault & Cartography',
    shortName: 'Drive Vault & Export',
    tag: 'Automated Cloud Sync · Zero Fees · 19X Cartography',
    icon: HardDrive,
    color: '#3b82f6',
    rgb: [59, 130, 246],
    secondaryRgb: [96, 165, 250],
    bg: 'rgba(59, 130, 246, 0.14)',
    border: 'rgba(59, 130, 246, 0.38)',
    techniques: [
      {
        angle: '12:00',
        clockLabel: '0° N · Step 01',
        title: 'Hierarchical Google Drive Vault (SEVA GIS)',
        sensor: 'Google Drive REST v3 Multipart Sync',
        formula: 'Root: SEVA GIS / [GeoTIFF, Images, Reports, Vector]',
        desc: 'Automatically provisions and syncs every analytical artifact into structured Google Drive subfolders.',
        unitBadge: 'Zero-Cost Cloud Backup',
      },
      {
        angle: '02:00',
        clockLabel: '60° NE · Step 02',
        title: '19X High-DPI Thesis Cartographic Composer',
        sensor: 'QGIS Print Layout & Publication Engine',
        formula: 'Coordinate Graticule + North Rose + Dual Scale + Legend',
        desc: 'Generates publication-ready 300+ DPI cartographic plates with collision-free neatlines and metadata blocks.',
        unitBadge: '19X Publication Plates',
      },
      {
        angle: '04:00',
        clockLabel: '120° SE · Step 03',
        title: 'Float32 GeoTIFF EPSG:4326 Writer',
        sensor: 'Native Client-Side Binary TIFF Encoder',
        formula: 'IEEE-754 Float32 + GeoKeyDirectoryTag (WGS84)',
        desc: 'Writes uncompressed scientific Float32 GeoTIFF rasters ready for direct drag-and-drop into QGIS or ArcGIS Pro.',
        unitBadge: 'EPSG:4326 Float32 TIFF',
      },
      {
        angle: '06:00',
        clockLabel: '180° S · Step 04',
        title: 'Zero-Error Offline Device Guarantee',
        sensor: 'IndexedDB Workspace + Direct Blob Stream',
        formula: 'Local Persistence + Instant Retry Queue',
        desc: 'Guarantees zero data loss: every parcel boundary, raster statistic, and report saves locally even without internet.',
        unitBadge: 'Offline-First Vault',
      },
      {
        angle: '08:00',
        clockLabel: '240° SW · Step 05',
        title: 'Verified Executive Email Delivery',
        sensor: 'Automated Dossier Dispatch Pipeline',
        formula: 'HTML + Attachment Summary Dispatch',
        desc: 'Delivers formatted agronomic and hydrological executive summaries directly to farmer or researcher inboxes.',
        unitBadge: 'Instant Inbox Dispatch',
      },
      {
        angle: '10:00',
        clockLabel: '300° NW · Step 06',
        title: 'Universal Multi-Engine Archival Bundle',
        sensor: 'PDF, Word (.doc), ZIP, KML, Shapefile & GeoJSON',
        formula: 'Cross-Engine Interoperability Standard',
        desc: 'Packages field boundaries, PyQGIS/ArcPy scripts, and spectral tables into a single portable research archive.',
        unitBadge: '6-Format Master Archive',
      },
    ],
  },
}

const DOMAIN_KEYS = Object.keys(DOMAIN_DATA) as DomainKey[]

const clamp = (v: number) => Math.max(0, Math.min(1, v))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export default function ClockwiseDispersionDial() {
  const [selectedDomain, setSelectedDomain] = useState<DomainKey>('agri')
  const [activeTechniqueIndex, setActiveTechniqueIndex] = useState<number>(0)
  const [stepIntervalMs, setStepIntervalMs] = useState<1000 | 3000 | 5000>(3000)
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true)
  const [autoCycleDomains, setAutoCycleDomains] = useState<boolean>(false)
  const [stepProgress, setStepProgress] = useState<number>(0) // 0..1 within current clockwise step

  // Track transition burst timestamp for loading-dispersion wave effect
  const lastStepTimestampRef = useRef<number>(performance.now())
  const prevNodeIndexRef = useRef<number>(5)
  const activeIndexRef = useRef<number>(0)
  const selectedDomainRef = useRef<DomainKey>('agri')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  activeIndexRef.current = activeTechniqueIndex
  selectedDomainRef.current = selectedDomain

  const currentDomain = DOMAIN_DATA[selectedDomain]
  const currentTechnique = currentDomain.techniques[activeTechniqueIndex] || currentDomain.techniques[0]

  // Trigger a fresh dispersion burst whenever domain or technique index changes
  const selectDomainAndStartClockwise = (key: DomainKey) => {
    prevNodeIndexRef.current = activeIndexRef.current
    setSelectedDomain(key)
    setActiveTechniqueIndex(0)
    setStepProgress(0)
    setIsAutoPlaying(true)
    lastStepTimestampRef.current = performance.now()
  }

  const selectTechniqueNode = (idx: number) => {
    prevNodeIndexRef.current = activeIndexRef.current
    setActiveTechniqueIndex(idx)
    setStepProgress(0)
    lastStepTimestampRef.current = performance.now()
  }

  // Automatic clockwise stepping timer (1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 1...)
  useEffect(() => {
    if (!isAutoPlaying) return

    lastStepTimestampRef.current = performance.now()
    let rafId = 0

    const tick = (now: number) => {
      const elapsed = now - lastStepTimestampRef.current
      if (elapsed >= stepIntervalMs) {
        lastStepTimestampRef.current = now
        setStepProgress(0)
        setActiveTechniqueIndex(prev => {
          prevNodeIndexRef.current = prev
          const next = (prev + 1) % 6
          if (next === 0 && autoCycleDomains) {
            setSelectedDomain(curDom => {
              const idx = DOMAIN_KEYS.indexOf(curDom)
              return DOMAIN_KEYS[(idx + 1) % DOMAIN_KEYS.length]
            })
          }
          return next
        })
      } else {
        setStepProgress(clamp(elapsed / stepIntervalMs))
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isAutoPlaying, stepIntervalMs, selectedDomain, autoCycleDomains])

  // Mesmerizing Loading-Dispersion 3D + Orbital Canvas Engine
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const S = 440
    canvas.width = S * dpr
    canvas.height = S * dpr

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coreParticles: ParticleDef[] = PARTICLES.slice(0, 120)

    const coreOffsets = coreParticles.map((_, i) => ({
      dl: ((i * 37) % 100) / 420,
      tw: (((i * 73) % 100) / 100) * Math.PI * 2,
      r: 0.75 + ((i * 19) % 55) / 100,
    }))

    // 72 orbital dispersion particles streaming clockwise between nodes 1->2->3->4->5->6
    const streamParticles = Array.from({ length: 72 }, (_, i) => ({
      seed: i / 72,
      radialJitter: (((i * 29) % 100) / 100 - 0.5) * 28,
      phase: (((i * 53) % 100) / 100) * Math.PI * 2,
      size: 1.1 + ((i * 17) % 40) / 25,
    }))

    const drawStar = (x: number, y: number, r: number) => {
      ctx.beginPath()
      ctx.moveTo(x - r * 2.7, y)
      ctx.lineTo(x, y - r * 0.36)
      ctx.lineTo(x + r * 2.7, y)
      ctx.lineTo(x, y + r * 0.36)
      ctx.closePath()
      ctx.moveTo(x, y - r * 2.7)
      ctx.lineTo(x + r * 0.36, y)
      ctx.lineTo(x, y + r * 2.7)
      ctx.lineTo(x - r * 0.36, y)
      ctx.closePath()
      ctx.fill()
    }

    let raf = 0
    let lastDraw = 0

    const render = (now: number) => {
      if (!reducedMotion) raf = requestAnimationFrame(render)
      if (now - lastDraw < 28) return
      lastDraw = now

      const dom = DOMAIN_DATA[selectedDomainRef.current]
      const [cr, cg, cb] = dom.rgb
      const [sr, sg, sb] = dom.secondaryRgb
      const curIdx = activeIndexRef.current
      const prevIdx = prevNodeIndexRef.current

      // Elapsed time since last clockwise step transition (0..1)
      const stepElapsed = clamp((now - lastStepTimestampRef.current) / stepIntervalMs)
      // Dispersion wave peaks right after each step transition (0.0 -> 0.45) then settles into orbital resonance
      const dispersionBurst = Math.sin(clamp(stepElapsed / 0.55) * Math.PI)

      ctx.setTransform(dpr, 0, 0, dpr, (S * dpr) / 2, (S * dpr) / 2)
      ctx.clearRect(-S / 2, -S / 2, S, S)

      // 1. Ambient rotating dispersion aura rings
      const ringRadius = 158
      const targetAngleRad = ((curIdx * 60 - 90) * Math.PI) / 180
      const prevAngleRad = ((prevIdx * 60 - 90) * Math.PI) / 180

      // Compute shortest clockwise interpolation from prevIdx to curIdx
      let deltaAngle = targetAngleRad - prevAngleRad
      if (deltaAngle < 0) deltaAngle += Math.PI * 2
      if (deltaAngle > Math.PI * 1.5) deltaAngle = Math.PI / 3
      const sweepMorph = easeInOut(clamp(stepElapsed / 0.42))
      const liveHandAngle = prevAngleRad + deltaAngle * sweepMorph

      // Radial glow behind active node
      const activeNodeX = ringRadius * Math.cos(targetAngleRad)
      const activeNodeY = ringRadius * Math.sin(targetAngleRad)
      const nodeGlow = ctx.createRadialGradient(activeNodeX, activeNodeY, 2, activeNodeX, activeNodeY, 64)
      nodeGlow.addColorStop(0, `rgba(${cr},${cg},${cb},${(0.42 + dispersionBurst * 0.3).toFixed(2)})`)
      nodeGlow.addColorStop(0.5, `rgba(${sr},${sg},${sb},0.14)`)
      nodeGlow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = nodeGlow
      ctx.beginPath()
      ctx.arc(activeNodeX, activeNodeY, 64, 0, Math.PI * 2)
      ctx.fill()

      // 2. Clockwise Dispersion Stardust Streamers (flowing 1 -> 2 -> 3 -> 4 -> 5 -> 6)
      for (const sp of streamParticles) {
        // Continuous clockwise flow + burst acceleration during transition
        const flowT = (sp.seed + now / 5200) % 1
        const angle = flowT * Math.PI * 2 - Math.PI / 2

        // Particles near the live clockwise sweep hand flare with dispersion energy
        let angleDiff = Math.abs(Math.atan2(Math.sin(angle - liveHandAngle), Math.cos(angle - liveHandAngle)))
        const proximity = Math.exp(-(angleDiff * angleDiff) / 0.35)

        // During dispersion burst, particles scatter outward then reconverge on the orbital track
        const scatter = dispersionBurst * Math.sin(now / 180 + sp.phase) * 18 * proximity
        const r = ringRadius + sp.radialJitter * (0.35 + dispersionBurst * 0.65) + scatter
        const px = r * Math.cos(angle)
        const py = r * Math.sin(angle)

        const alpha = clamp(0.18 + proximity * 0.68 + dispersionBurst * 0.22)
        const rad = sp.size * (0.85 + proximity * 1.15 + dispersionBurst * 0.4)

        ctx.beginPath()
        ctx.arc(px, py, rad, 0, Math.PI * 2)
        ctx.fillStyle =
          proximity > 0.45
            ? `rgba(${sr},${sg},${sb},${alpha.toFixed(2)})`
            : `rgba(${cr},${cg},${cb},${(alpha * 0.75).toFixed(2)})`
        ctx.fill()

        if (proximity > 0.72 && Math.sin(now / 120 + sp.phase) > 0.3) {
          ctx.globalCompositeOperation = 'lighter'
          ctx.fillStyle = 'rgba(240, 255, 252, 0.92)'
          drawStar(px, py, rad * 1.15)
          ctx.globalCompositeOperation = 'source-over'
        }
      }

      // 3. Spoke Dispersion Wave (particles surging from center core to active node)
      for (let s = 0; s < 14; s++) {
        const u = ((s / 14) + now / 900) % 1
        const dist = 50 + u * (ringRadius - 50)
        const lateral = Math.sin(u * Math.PI * 3 - now / 160) * (1 - u) * (6 + dispersionBurst * 10)
        const perpAngle = liveHandAngle + Math.PI / 2
        const sx = dist * Math.cos(liveHandAngle) + lateral * Math.cos(perpAngle)
        const sy = dist * Math.sin(liveHandAngle) + lateral * Math.sin(perpAngle)
        const sAlpha = Math.sin(u * Math.PI) * (0.55 + dispersionBurst * 0.4)

        ctx.beginPath()
        ctx.arc(sx, sy, 1.8 + (1 - u) * 1.4, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${sr},${sg},${sb},${sAlpha.toFixed(2)})`
        ctx.fill()
      }

      // 4. Center 3D Loading-Dispersion Core (morphing Logo -> Stardust Dispersion -> Seedling -> Canopy)
      const K = 54
      const ay = reducedMotion ? 0.4 : (now / 1350) % (Math.PI * 2)
      const ax = -0.15 + (reducedMotion ? 0 : Math.sin(now / 1800) * 0.14)
      const ca = Math.cos(ay)
      const sa = Math.sin(ay)
      const cx = Math.cos(ax)
      const sx = Math.sin(ax)
      const cam = 210

      const projected = coreParticles
        .map((p, i) => {
          const { dl, tw, r: baseR } = coreOffsets[i]
          // Sync morph with the clockwise step progress so every step has a visible dispersion-convergence wave!
          const ph = stepElapsed
          let vx = p.lg[0]
          let vy = p.lg[1]
          let vz = p.lg[2]
          let boost = 0

          if (ph < 0.28) {
            // Dismantle & sparkle dispersion burst right as new clockwise parameter engages
            const m = easeInOut(clamp(ph / 0.28 - dl * 0.5))
            vx = p.lg[0] + (p.sc[0] - p.lg[0]) * m
            vy = p.lg[1] + (p.sc[1] - p.lg[1]) * m
            vz = p.lg[2] + (p.sc[2] - p.lg[2]) * m
            boost = Math.sin(m * Math.PI) * 0.85
          } else if (ph < 0.65) {
            // Stardust converges into 3D plant/canopy structure
            const m = easeInOut(clamp((ph - 0.28) / 0.37 - dl * 0.5))
            vx = p.sc[0] + (p.tr[0] - p.sc[0]) * m
            vy = p.sc[1] + (p.tr[1] - p.sc[1]) * m
            vz = p.sc[2] + (p.tr[2] - p.sc[2]) * m
            boost = (1 - m) * 0.55
          } else {
            // Gentle 3D resonance before returning to logo for next clockwise step
            const m = easeInOut(clamp((ph - 0.65) / 0.35 - dl * 0.4))
            vx = p.tr[0] + (p.lg[0] - p.tr[0]) * m
            vy = p.tr[1] + (p.lg[1] - p.tr[1]) * m
            vz = p.tr[2] + (p.lg[2] - p.tr[2]) * m
            boost = Math.sin(m * Math.PI) * 0.35
          }

          const X = vx * K
          const Y = vy * K
          const Z = vz * K

          const x1 = X * ca + Z * sa
          const z1 = -X * sa + Z * ca
          const y2 = Y * cx - z1 * sx
          const z2 = Y * sx + z1 * cx

          return { x: x1, y: y2, z: z2, boost, tw, baseR }
        })
        .sort((a, b) => a.z - b.z)

      for (const item of projected) {
        const f = cam / (cam - item.z)
        const px = item.x * f
        const py = item.y * f
        const shimmer = 0.8 + 0.25 * Math.sin(now / 170 + item.tw)
        const pr = Math.min(255, Math.round(cr * shimmer + item.boost * 140))
        const pg = Math.min(255, Math.round(cg * shimmer + item.boost * 180))
        const pb = Math.min(255, Math.round(cb * shimmer + item.boost * 195))
        const rad = Math.max(0.75, 1.35 * item.baseR * (1 + item.boost * 0.8)) * f
        const al = clamp(0.68 + item.boost * 0.32)

        ctx.beginPath()
        ctx.arc(px, py, rad, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${pr},${pg},${pb},${al.toFixed(2)})`
        ctx.fill()

        if (item.boost > 0.55 && Math.sin(now / 130 + item.tw) > 0.78) {
          ctx.globalCompositeOperation = 'lighter'
          ctx.fillStyle = 'rgba(245, 255, 252, 0.92)'
          drawStar(px, py, rad * 1.2)
          ctx.globalCompositeOperation = 'source-over'
        }
      }
    }

    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [stepIntervalMs])

  // Calculate SVG geometry for the 6 clockwise nodes on a 440x440 coordinate space
  const CX = 220
  const CY = 220
  const ORBIT_R = 158
  const activeAngleDeg = activeTechniqueIndex * 60 - 90
  const activeAngleRad = (activeAngleDeg * Math.PI) / 180
  const handTipX = CX + (ORBIT_R - 26) * Math.cos(activeAngleRad)
  const handTipY = CY + (ORBIT_R - 26) * Math.sin(activeAngleRad)

  // Continuous clockwise progress angle (including smooth sub-step progress!)
  const continuousClockwiseDeg = (activeTechniqueIndex + stepProgress) * 60
  const continuousRad = ((continuousClockwiseDeg - 90) * Math.PI) / 180
  const sweepHeadX = CX + ORBIT_R * Math.cos(continuousRad)
  const sweepHeadY = CY + ORBIT_R * Math.sin(continuousRad)

  return (
    <section
      className="au-intents-section"
      aria-label="Domain Explorer & Clockwise Techniques"
      style={{
        width: '100%',
        background: 'linear-gradient(180deg, rgba(2, 27, 17, 0.9) 0%, rgba(3, 16, 11, 0.98) 100%)',
        borderTop: '1px solid rgba(52, 211, 153, 0.22)',
        padding: '72px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 16px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              color: '#34d399',
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 14,
            }}
          >
            <Activity size={14} /> Autonomous Clockwise Dispersion Engine · 6 Domains × 6 Parameters
          </span>
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 900,
              color: '#f8fafc',
              margin: '0 0 12px',
              letterSpacing: '-0.02em',
            }}
          >
            Domain Intelligence &amp; Clockwise Parameter Engine
          </h2>
          <p style={{ fontSize: 15.5, color: '#94a3b8', maxWidth: 780, margin: '0 auto', lineHeight: 1.6 }}>
            Select any spatial discipline below — such as <b>Precision Agriculture</b> or <b>Hydrology &amp; Drainage</b> — and watch the engine automatically cycle clockwise from <b>#1 → #2 → #3 → #4 → #5 → #6</b> with 3D particle dispersion.
          </p>
        </div>

        {/* Domain Selection Tabs */}
        <div
          role="tablist"
          aria-label="Geospatial Domains"
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}
        >
          {DOMAIN_KEYS.map(key => {
            const dom = DOMAIN_DATA[key]
            const isSel = selectedDomain === key
            const Icon = dom.icon
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isSel}
                onClick={() => selectDomainAndStartClockwise(key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                  background: isSel ? dom.color : 'rgba(255, 255, 255, 0.05)',
                  color: isSel ? '#03150d' : '#e2e8f0',
                  border: isSel ? `1.5px solid ${dom.color}` : '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: isSel ? `0 0 24px ${dom.color}66` : 'none',
                  transform: isSel ? 'translateY(-1px)' : 'none',
                }}
              >
                <Icon size={16} />
                <span>{dom.shortName}</span>
              </button>
            )
          })}
        </div>

        {/* Clockwise Cadence & Auto-Dispersion Control Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 28,
            padding: '10px 18px',
            borderRadius: 14,
            background: 'rgba(15, 23, 42, 0.65)',
            border: `1px solid ${currentDomain.border}`,
            width: 'fit-content',
            marginInline: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setIsAutoPlaying(p => !p)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 13px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              background: isAutoPlaying ? currentDomain.color : 'rgba(255,255,255,0.08)',
              color: isAutoPlaying ? '#03150d' : '#f8fafc',
              border: 'none',
            }}
          >
            {isAutoPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isAutoPlaying ? 'Clockwise Auto-Flow: ON' : 'Paused (Click to Resume)'}</span>
          </button>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 700, marginRight: 2 }}>Step Speed:</span>
            {([1000, 3000, 5000] as const).map(ms => {
              const active = stepIntervalMs === ms
              return (
                <button
                  key={ms}
                  type="button"
                  onClick={() => {
                    setStepIntervalMs(ms)
                    setIsAutoPlaying(true)
                    lastStepTimestampRef.current = performance.now()
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 7,
                    fontSize: 11.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: active ? currentDomain.bg : 'rgba(255,255,255,0.05)',
                    color: active ? currentDomain.color : '#cbd5e1',
                    border: active ? `1px solid ${currentDomain.color}` : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {ms / 1000}s {ms === 3000 ? '(Default)' : ''}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setAutoCycleDomains(d => !d)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 11px',
              borderRadius: 7,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              background: autoCycleDomains ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255,255,255,0.04)',
              color: autoCycleDomains ? '#38bdf8' : '#94a3b8',
              border: autoCycleDomains ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid rgba(255,255,255,0.1)',
            }}
            title="When enabled, automatically advances to the next spatial domain after completing #1 -> #6"
          >
            <RotateCw size={12} />
            <span>Auto-Switch Domain after #6: {autoCycleDomains ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Main Interactive Clockwise Dispersion Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 32,
            alignItems: 'center',
            background: 'linear-gradient(145deg, rgba(10, 31, 22, 0.78) 0%, rgba(4, 17, 12, 0.9) 100%)',
            border: `1.5px solid ${currentDomain.border}`,
            borderRadius: 24,
            padding: 'clamp(20px, 3vw, 36px)',
            boxShadow: `0 20px 60px rgba(0, 0, 0, 0.55), inset 0 0 40px ${currentDomain.bg}`,
            backdropFilter: 'blur(14px)',
          }}
        >
          {/* Left Column: 3D Particle Dispersion Canvas + SVG Clockwise Dial */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 440,
              aspectRatio: '1/1',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Loading-Dispersion 3D & Stardust Canvas Layer */}
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />

            {/* Interactive SVG Clockwise Parameter Dial */}
            <svg
              viewBox="0 0 440 440"
              style={{
                width: '100%',
                height: '100%',
                overflow: 'visible',
                position: 'relative',
                zIndex: 2,
              }}
            >
              <defs>
                <radialGradient id="clockwiseHubGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={currentDomain.color} stopOpacity="0.32" />
                  <stop offset="65%" stopColor={currentDomain.color} stopOpacity="0.08" />
                  <stop offset="100%" stopColor={currentDomain.color} stopOpacity="0" />
                </radialGradient>
                <filter id="nodeNeonGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Outer Compass & Azimuthal Tick Ring */}
              <circle
                cx={CX}
                cy={CY}
                r={196}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="1"
              />
              {Array.from({ length: 36 }, (_, i) => {
                const a = ((i * 10 - 90) * Math.PI) / 180
                const isMajor = i % 6 === 0
                const r1 = isMajor ? 186 : 191
                const r2 = 196
                return (
                  <line
                    key={i}
                    x1={CX + r1 * Math.cos(a)}
                    y1={CY + r1 * Math.sin(a)}
                    x2={CX + r2 * Math.cos(a)}
                    y2={CY + r2 * Math.sin(a)}
                    stroke={isMajor ? currentDomain.color : 'rgba(255,255,255,0.16)'}
                    strokeWidth={isMajor ? 2 : 1}
                  />
                )
              })}

              {/* Main Clockwise Orbital Track */}
              <circle
                cx={CX}
                cy={CY}
                r={ORBIT_R}
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="2"
                strokeDasharray="5 7"
              />

              {/* Continuous Clockwise Progress Ring (fills smoothly from 12:00 through #1 -> #2 -> #3 -> #4 -> #5 -> #6) */}
              <circle
                cx={CX}
                cy={CY}
                r={ORBIT_R}
                fill="none"
                stroke={currentDomain.color}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={`${(continuousClockwiseDeg / 360) * (2 * Math.PI * ORBIT_R)} ${2 * Math.PI * ORBIT_R}`}
                transform={`rotate(-90 ${CX} ${CY})`}
                style={{ opacity: 0.85, filter: 'url(#nodeNeonGlow)' }}
              />

              {/* Live Orbiting Clockwise Sweep Comet Head */}
              <circle
                cx={sweepHeadX}
                cy={sweepHeadY}
                r={5.5}
                fill="#ffffff"
                stroke={currentDomain.color}
                strokeWidth={3}
                filter="url(#nodeNeonGlow)"
              />

              {/* Ambient Center Glow */}
              <circle cx={CX} cy={CY} r={116} fill="url(#clockwiseHubGlow)" />

              {/* Spokes from Center Hub to all 6 Clockwise Nodes */}
              {currentDomain.techniques.map((tech, idx) => {
                const angleDeg = idx * 60 - 90
                const rad = (angleDeg * Math.PI) / 180
                const x1 = CX + 58 * Math.cos(rad)
                const y1 = CY + 58 * Math.sin(rad)
                const x2 = CX + (ORBIT_R - 26) * Math.cos(rad)
                const y2 = CY + (ORBIT_R - 26) * Math.sin(rad)
                const isCurrent = activeTechniqueIndex === idx
                const isPassed = idx < activeTechniqueIndex
                return (
                  <line
                    key={tech.title}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={
                      isCurrent
                        ? currentDomain.color
                        : isPassed
                        ? `${currentDomain.color}88`
                        : 'rgba(255,255,255,0.16)'
                    }
                    strokeWidth={isCurrent ? 3 : isPassed ? 1.8 : 1.2}
                    strokeDasharray={isCurrent ? 'none' : '3 4'}
                  />
                )
              })}

              {/* Active Clockwise Pointer Needle */}
              <line
                x1={CX}
                y1={CY}
                x2={handTipX}
                y2={handTipY}
                stroke={currentDomain.color}
                strokeWidth="3.5"
                strokeLinecap="round"
                style={{
                  transition: 'all 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                  filter: 'url(#nodeNeonGlow)',
                }}
              />

              {/* Center Translucent Hub Ring framing the 3D Dispersion Core */}
              <circle
                cx={CX}
                cy={CY}
                r={56}
                fill="rgba(4, 20, 14, 0.58)"
                stroke={currentDomain.color}
                strokeWidth="2.5"
              />
              <circle
                cx={CX}
                cy={CY}
                r={50}
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={CX}
                y={CY - 28}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="8.5"
                fontWeight="800"
                letterSpacing="0.08em"
              >
                SEVA·GIS
              </text>
              <text
                x={CX}
                y={CY + 34}
                textAnchor="middle"
                fill={currentDomain.color}
                fontSize="9"
                fontWeight="900"
                letterSpacing="0.06em"
              >
                STEP {activeTechniqueIndex + 1} → {((activeTechniqueIndex + 1) % 6) + 1}
              </text>
              <text
                x={CX}
                y={CY + 45}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="7.5"
                fontWeight="700"
              >
                {stepIntervalMs / 1000}s CLOCKWISE
              </text>

              {/* 6 Interactive Clockwise Parameter Nodes (1 -> 2 -> 3 -> 4 -> 5 -> 6) */}
              {currentDomain.techniques.map((tech, idx) => {
                const angleDeg = idx * 60 - 90
                const rad = (angleDeg * Math.PI) / 180
                const nx = CX + ORBIT_R * Math.cos(rad)
                const ny = CY + ORBIT_R * Math.sin(rad)
                const isCurrent = activeTechniqueIndex === idx
                const isNext = (activeTechniqueIndex + 1) % 6 === idx
                const nodeR = isCurrent ? 27 : 20
                const ringCircumference = 2 * Math.PI * 32

                return (
                  <g
                    key={tech.title}
                    onClick={() => selectTechniqueNode(idx)}
                    style={{ cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Parameter ${idx + 1}: ${tech.title} at ${tech.angle}`}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selectTechniqueNode(idx)
                      }
                    }}
                  >
                    {/* Per-Node Countdown Progress Halo when Active */}
                    {isCurrent && (
                      <circle
                        cx={nx}
                        cy={ny}
                        r={32}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={`${stepProgress * ringCircumference} ${ringCircumference}`}
                        transform={`rotate(-90 ${nx} ${ny})`}
                      />
                    )}

                    {/* Subtle pulse ring on Next clockwise target node */}
                    {isNext && (
                      <circle
                        cx={nx}
                        cy={ny}
                        r={25}
                        fill="none"
                        stroke={currentDomain.color}
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                        opacity={0.7}
                      />
                    )}

                    <circle
                      cx={nx}
                      cy={ny}
                      r={nodeR}
                      fill={isCurrent ? currentDomain.color : '#071a12'}
                      stroke={isCurrent ? '#ffffff' : currentDomain.color}
                      strokeWidth={isCurrent ? 3 : 1.8}
                      filter={isCurrent ? 'url(#nodeNeonGlow)' : undefined}
                    />

                    {/* Step Number 1..6 */}
                    <text
                      x={nx}
                      y={ny - 1}
                      textAnchor="middle"
                      fill={isCurrent ? '#03150d' : '#f8fafc'}
                      fontSize={isCurrent ? '13.5' : '11.5'}
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      {idx + 1}
                    </text>

                    {/* Clockwise Angle Subtitle inside node */}
                    <text
                      x={nx}
                      y={ny + 10}
                      textAnchor="middle"
                      fill={isCurrent ? '#042f1e' : '#94a3b8'}
                      fontSize="7.5"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {tech.angle}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Right Column: Live Parameter Telemetry & Clockwise Sequence Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Top Live Progress Strip */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 900,
                      background: currentDomain.bg,
                      color: currentDomain.color,
                      border: `1px solid ${currentDomain.border}`,
                      padding: '4px 12px',
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Sparkles size={12} />
                    Clockwise Position {currentTechnique.angle} · Parameter #{activeTechniqueIndex + 1} of 6
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#e2e8f0',
                      background: 'rgba(255,255,255,0.06)',
                      padding: '3px 10px',
                      borderRadius: 999,
                    }}
                  >
                    {currentTechnique.unitBadge}
                  </span>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: currentDomain.color, fontFamily: 'monospace' }}>
                  Next: #{((activeTechniqueIndex + 1) % 6) + 1} in {Math.max(0.1, ((1 - stepProgress) * stepIntervalMs) / 1000).toFixed(1)}s
                </span>
              </div>

              {/* Smooth Animated Dispersion Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: 6,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.round(stepProgress * 100)}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${currentDomain.color}, #ffffff)`,
                    borderRadius: 999,
                    boxShadow: `0 0 12px ${currentDomain.color}`,
                    transition: 'width 60ms linear',
                  }}
                />
              </div>
            </div>

            {/* Domain Subtitle */}
            <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {currentDomain.name} · {currentDomain.tag}
            </div>

            {/* Active Parameter Title & Description */}
            <h3 style={{ fontSize: 'clamp(21px, 2.5vw, 27px)', fontWeight: 900, color: '#f8fafc', margin: 0, lineHeight: 1.25 }}>
              #{activeTechniqueIndex + 1}. {currentTechnique.title}
            </h3>

            <p style={{ fontSize: 14.5, color: '#cbd5e1', lineHeight: 1.65, margin: 0 }}>
              {currentTechnique.desc}
            </p>

            {/* Sensor & Formula Telemetry Boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginTop: 2 }}>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'block',
                    marginBottom: 5,
                    fontWeight: 700,
                  }}
                >
                  Satellite Sensor / Computing Engine
                </span>
                <b style={{ fontSize: 13, color: '#38bdf8', lineHeight: 1.4, display: 'block' }}>
                  {currentTechnique.sensor}
                </b>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${currentDomain.border}`,
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'block',
                    marginBottom: 5,
                    fontWeight: 700,
                  }}
                >
                  Exact Mathematical Formulation
                </span>
                <code style={{ fontSize: 12.5, color: '#34d399', fontFamily: 'monospace', fontWeight: 700 }}>
                  {currentTechnique.formula}
                </code>
              </div>
            </div>

            {/* 6-Step Clockwise Sequence Matrix (1 -> 2 -> 3 -> 4 -> 5 -> 6) */}
            <div style={{ marginTop: 6 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Clockwise Sequence (1 → 2 → 3 → 4 → 5 → 6)</span>
                <span style={{ color: currentDomain.color }}>Click any step or watch auto-rotation</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                {currentDomain.techniques.map((t, i) => {
                  const isCur = activeTechniqueIndex === i
                  return (
                    <button
                      key={t.title}
                      type="button"
                      onClick={() => selectTechniqueNode(i)}
                      style={{
                        padding: '8px 11px',
                        borderRadius: 10,
                        fontSize: 11.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: isCur ? currentDomain.color : 'rgba(255,255,255,0.04)',
                        color: isCur ? '#03150d' : '#cbd5e1',
                        border: isCur ? `1.5px solid #ffffff` : '1px solid rgba(255,255,255,0.09)',
                        boxShadow: isCur ? `0 0 18px ${currentDomain.color}66` : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'inline-grid',
                          placeItems: 'center',
                          fontSize: 11,
                          fontWeight: 900,
                          fontFamily: 'monospace',
                          background: isCur ? '#03150d' : 'rgba(255,255,255,0.1)',
                          color: isCur ? currentDomain.color : '#f8fafc',
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.title.split(' (')[0]}
                        </div>
                        <div
                          style={{
                            fontSize: 9.5,
                            opacity: 0.8,
                            fontFamily: 'monospace',
                          }}
                        >
                          {t.angle} Clockwise
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
