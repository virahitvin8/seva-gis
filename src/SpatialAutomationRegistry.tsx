import React, { useState, useMemo } from 'react'
import {
  Search,
  ExternalLink,
  Code2,
  Copy,
  Check,
  X,
  Layers,
  Sparkles,
  Cpu,
  Globe,
  Radio,
  Share2,
  Bookmark,
  Terminal,
  Activity,
  Download,
  Filter,
} from 'lucide-react'

export interface RepoEntry {
  id: string
  name: string
  githubUrl: string
  stars: string
  language: string
  domain: 'stac' | 'geoai' | 'automation' | 'webgis' | 'drone' | 'agronomy' | 'dispatch'
  domainTitle: string
  desc: string
  sevaRole: string
  integrationSnippet: string
}

export const REPO_REGISTRY: RepoEntry[] = [
  // --- CLOUD-NATIVE EO & STAC ---
  {
    id: 'titiler',
    name: 'developmentseed/titiler',
    githubUrl: 'https://github.com/developmentseed/titiler',
    stars: '2.1k+',
    language: 'Python',
    domain: 'stac',
    domainTitle: 'Cloud-Native EO & STAC',
    desc: 'Lightweight dynamic tile server built on FastAPI and rio-tiler.',
    sevaRole: 'Computes on-the-fly NDVI/NDMI tiles from remote Cloud-Optimized GeoTIFFs (COGs) without downloading full gigabyte scenes.',
    integrationSnippet: `import httpx\ntitiler_url = "https://titiler.xyz/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=" + cog_url + "&expression=(b8-b4)/(b8+b4)&colormap_name=rdylgn"`,
  },
  {
    id: 'pystac',
    name: 'stac-utils/pystac',
    githubUrl: 'https://github.com/stac-utils/pystac',
    stars: '1.1k+',
    language: 'Python',
    domain: 'stac',
    domainTitle: 'Cloud-Native EO & STAC',
    desc: 'Core Python library for building and querying SpatioTemporal Asset Catalogs (STAC).',
    sevaRole: 'Automates cloud-free Sentinel-2 L2A scene searches by AOI bbox and date window.',
    integrationSnippet: `import pystac_client\nclient = pystac_client.Client.open("https://earth-search.aws.element84.com/v1")\nsearch = client.search(collections=["sentinel-2-l2a"], bbox=farm_bbox, limit=1)`,
  },
  {
    id: 'planetary_computer',
    name: 'microsoft/planetary-computer-sdk',
    githubUrl: 'https://github.com/microsoft/planetary-computer-sdk',
    stars: '800+',
    language: 'Python',
    domain: 'stac',
    domainTitle: 'Cloud-Native EO & STAC',
    desc: 'Open-access API for Microsoft Planetary Computer multi-petabyte environmental catalog.',
    sevaRole: 'Provides signed SAS tokens for instant access to Sentinel-2, Landsat-9, and Copernicus DEM.',
    integrationSnippet: `import planetary_computer as pc\nsigned_item = pc.sign(stac_item)\nred_href = signed_item.assets["B04"].href`,
  },
  {
    id: 'rio_tiler',
    name: 'cogeotiff/rio-tiler',
    githubUrl: 'https://github.com/cogeotiff/rio-tiler',
    stars: '1.4k+',
    language: 'Python',
    domain: 'stac',
    domainTitle: 'Cloud-Native EO & STAC',
    desc: 'Rasterio plugin for reading spatial raster data over HTTP Range requests.',
    sevaRole: 'Reads exact farm boundary bounding boxes from COGs in milliseconds.',
    integrationSnippet: `from rio_tiler.io import COGReader\nwith COGReader(s2_cog_url) as cog:\n    img = cog.part(farm_bbox, indexes=(4, 8))`,
  },
  {
    id: 'zarr',
    name: 'zarr-developers/zarr-python',
    githubUrl: 'https://github.com/zarr-developers/zarr-python',
    stars: '1.9k+',
    language: 'Python',
    domain: 'stac',
    domainTitle: 'Cloud-Native EO & STAC',
    desc: 'Chunked, compressed, N-dimensional array storage for massive multidimensional data.',
    sevaRole: 'Streams ERA5-Land climate reanalysis grids and soil profile depth cubes.',
    integrationSnippet: `import zarr\nroot = zarr.open("https://storage.googleapis.com/era5_cube.zarr", mode="r")\nrain_series = root["precipitation"][:, lat_idx, lon_idx]`,
  },

  // --- GEOAI & VISION ---
  {
    id: 'samgeo',
    name: 'opengeos/segment-geospatial',
    githubUrl: 'https://github.com/opengeos/segment-geospatial',
    stars: '3.5k+',
    language: 'Python',
    domain: 'geoai',
    domainTitle: 'GeoAI & Deep Learning',
    desc: 'Segment Anything Model (SAM / FastSAM / SAM 2) adapted for geospatial data.',
    sevaRole: 'Zero-shot promptable parcel boundary delineation directly from satellite & drone imagery.',
    integrationSnippet: `from samgeo import SamGeo\nsam = SamGeo(model_type="vit_h")\nsam.generate("sentinel2_field.tif", "parcel_mask.tif")\ngdf = sam.tiff_to_geojson("parcel_mask.tif")`,
  },
  {
    id: 'field_boundary',
    name: 'starfiee/field-boundary-delineation',
    githubUrl: 'https://github.com/starfiee/field-boundary-delineation',
    stars: '400+',
    language: 'Python',
    domain: 'geoai',
    domainTitle: 'GeoAI & Deep Learning',
    desc: 'Sentinel-2 field boundary segmentation using U-Net neural network architecture.',
    sevaRole: 'Extracts Indian smallholder plot boundaries, medhs (bunds), and irrigation ditches.',
    integrationSnippet: `import torch\nmodel = torch.hub.load("starfiee/field-boundary-delineation", "unet_s2")\nboundary_mask = model.predict(s2_multispectral_tensor)`,
  },
  {
    id: 'torchgeo',
    name: 'microsoft/torchgeo',
    githubUrl: 'https://github.com/microsoft/torchgeo',
    stars: '2.8k+',
    language: 'Python',
    domain: 'geoai',
    domainTitle: 'GeoAI & Deep Learning',
    desc: 'PyTorch domain library for multispectral remote sensing deep learning.',
    sevaRole: 'Crop type classification, multi-temporal crop rotation detection, and stress mapping.',
    integrationSnippet: `from torchgeo.datasets import Sentinel2\nfrom torchgeo.models import ResNet50\ndataset = Sentinel2(paths="data/s2", bands=["B02", "B03", "B04", "B08"])`,
  },
  {
    id: 'clay_model',
    name: 'Clay-Foundation/model',
    githubUrl: 'https://github.com/Clay-Foundation/model',
    stars: '1.2k+',
    language: 'Python',
    domain: 'geoai',
    domainTitle: 'GeoAI & Deep Learning',
    desc: 'Foundation model for Earth Observation trained on multi-sensor global satellite data.',
    sevaRole: 'Extracts multi-spectral feature embeddings for automated anomaly detection.',
    integrationSnippet: `from clay import ClayModel\nmodel = ClayModel.from_pretrained("clay-v1-base")\nembeddings = model(s2_image_tensor)`,
  },
  {
    id: 'agml',
    name: 'Project-AgML/AgML',
    githubUrl: 'https://github.com/Project-AgML/AgML',
    stars: '600+',
    language: 'Python',
    domain: 'geoai',
    domainTitle: 'GeoAI & Deep Learning',
    desc: 'Centralized framework for agricultural machine learning and benchmarking.',
    sevaRole: 'Pre-trained crop disease detectors, fruit counting, and yield estimation models.',
    integrationSnippet: `import agml\nloader = agml.data.AgData("apple_detection")\nmodel = agml.models.DetectionModel("efficientdet_d0")`,
  },

  // --- SPATIAL AUTOMATION & ENGINES ---
  {
    id: 'leafmap',
    name: 'opengeos/leafmap',
    githubUrl: 'https://github.com/opengeos/leafmap',
    stars: '3.8k+',
    language: 'Python',
    domain: 'automation',
    domainTitle: 'Spatial Automation & ETL',
    desc: 'Python package for geospatial analysis and interactive mapping by Prof. Qiusheng Wu.',
    sevaRole: 'Automates split-panel satellite comparisons, cloud-free composites, and vector exports.',
    integrationSnippet: `import leafmap\nm = leafmap.Map()\nm.add_cog_layer(nir_cog_url, name="Sentinel-2 NIR")\nm.add_split_map(left_layer="NDVI_2025", right_layer="NDVI_2026")`,
  },
  {
    id: 'rustgis',
    name: 'opengeos/RustGIS',
    githubUrl: 'https://github.com/opengeos/RustGIS',
    stars: '600+',
    language: 'Rust',
    domain: 'automation',
    domainTitle: 'Spatial Automation & ETL',
    desc: 'Fast, free, and open-source GIS written in pure Rust without Python GIL lag.',
    sevaRole: 'Ultra-fast polygon rasterization, SIMD band math, and zero-copy geometry clipping.',
    integrationSnippet: `use geo::{Polygon, Simplify};\nlet simplified = farm_polygon.simplify(&0.00004);`,
  },
  {
    id: 'gdal',
    name: 'OSGeo/gdal',
    githubUrl: 'https://github.com/OSGeo/gdal',
    stars: '4.8k+',
    language: 'C++ / Python',
    domain: 'automation',
    domainTitle: 'Spatial Automation & ETL',
    desc: 'Translator library for raster and vector geospatial data formats.',
    sevaRole: 'Reprojects EPSG:4326 to local UTM zones and generates Cloud-Optimized GeoTIFF pyramids.',
    integrationSnippet: `gdalwarp -t_srs EPSG:32644 -r bilinear -co TILED=YES -co COMPRESS=DEFLATE raw_s2.tif warped_cog.tif`,
  },
  {
    id: 'xarray_spatial',
    name: 'makepath/xarray-spatial',
    githubUrl: 'https://github.com/makepath/xarray-spatial',
    stars: '800+',
    language: 'Python',
    domain: 'automation',
    domainTitle: 'Spatial Automation & ETL',
    desc: 'Raster-based spatial analytics on GPU/CPU with Numba acceleration and zero GDAL C-dependency.',
    sevaRole: 'Calculates hillshade, slope, aspect, and NDVI arrays concurrently.',
    integrationSnippet: `from xarray_spatial import ndvi, slope\nndvi_grid = ndvi(red=red_da, nir=nir_da)\nslope_grid = slope(dem_da)`,
  },

  // --- CLIENT WEBGIS & EDGE SQL ---
  {
    id: 'geolibre',
    name: 'opengeos/GeoLibre',
    githubUrl: 'https://github.com/opengeos/GeoLibre',
    stars: '1.1k+',
    language: 'TypeScript',
    domain: 'webgis',
    domainTitle: 'Client WebGIS & Edge SQL',
    desc: 'Cloud-native GIS platform combining DuckDB, MapLibre, and Cesium.',
    sevaRole: 'Architecture benchmark for SEVA·GIS in-browser vector and raster querying.',
    integrationSnippet: `import { GeoLibreApp } from 'geolibre'\nconst app = new GeoLibreApp({ mapEngine: 'maplibre', sqlEngine: 'duckdb' })`,
  },
  {
    id: 'duckdb_wasm',
    name: 'duckdb/duckdb-wasm',
    githubUrl: 'https://github.com/duckdb/duckdb-wasm',
    stars: '3.5k+',
    language: 'C++ / WASM',
    domain: 'webgis',
    domainTitle: 'Client WebGIS & Edge SQL',
    desc: 'WebAssembly edition of DuckDB bringing full analytical SQL directly to the browser.',
    sevaRole: 'Executes zonal statistics and PMFBY loss triggers directly on user device with 0 server costs.',
    integrationSnippet: `await conn.query("SELECT crop, sum(area_ha) FROM parcels WHERE ndvi < 0.4 GROUP BY crop")`,
  },
  {
    id: 'deckgl',
    name: 'visgl/deck.gl',
    githubUrl: 'https://github.com/visgl/deck.gl',
    stars: '13k+',
    language: 'TypeScript',
    domain: 'webgis',
    domainTitle: 'Client WebGIS & Edge SQL',
    desc: 'WebGL2 and WebGPU-powered framework for large-scale data visualization.',
    sevaRole: 'Renders 100,000+ village cadastral field boundaries smoothly at 60 FPS.',
    integrationSnippet: `import { GeoJsonLayer } from '@deck.gl/layers'\nnew GeoJsonLayer({ id: 'parcels', data: 'parcels.fgb', getFillColor: [46, 204, 113, 160] })`,
  },
  {
    id: 'flatgeobuf',
    name: 'flatgeobuf/flatgeobuf',
    githubUrl: 'https://github.com/flatgeobuf/flatgeobuf',
    stars: '2.1k+',
    language: 'C++ / JS / Rust',
    domain: 'webgis',
    domainTitle: 'Client WebGIS & Edge SQL',
    desc: 'High-performance binary encoding for geographic features with embedded spatial index.',
    sevaRole: 'Allows streaming only the farm parcels currently visible in the user viewport via HTTP Range requests.',
    integrationSnippet: `import { deserialize } from 'flatgeobuf/lib/mjs/geojson.js'\nconst res = await fetch('parcels.fgb', { headers: { Range: 'bytes=0-4096' } })`,
  },

  // --- DRONE PHOTOGRAMMETRY & LIDAR ---
  {
    id: 'odm',
    name: 'OpenDroneMap/ODM',
    githubUrl: 'https://github.com/OpenDroneMap/ODM',
    stars: '5.8k+',
    language: 'C++ / Python',
    domain: 'drone',
    domainTitle: 'Drone Photogrammetry & LiDAR',
    desc: 'Open-source command-line toolkit to process aerial drone imagery into maps and 3D models.',
    sevaRole: 'Stitches farmer drone surveys into high-res orthomosaics, surface models, and 3D meshes.',
    integrationSnippet: `docker run -ti -v $(pwd)/images:/code/images opendronemap/odm --project-path /code`,
  },
  {
    id: 'pdal',
    name: 'PDAL/PDAL',
    githubUrl: 'https://github.com/PDAL/PDAL',
    stars: '2.4k+',
    language: 'C++ / Python',
    domain: 'drone',
    domainTitle: 'Drone Photogrammetry & LiDAR',
    desc: 'Point Data Abstraction Library for translating, filtering, and processing point clouds.',
    sevaRole: 'Classifies ground points and extracts tree canopy height models (CHM = DSM - DTM).',
    integrationSnippet: `pdal ground -i drone_flight.laz -o ground_classified.laz`,
  },
  {
    id: 'potree',
    name: 'potree/potree',
    githubUrl: 'https://github.com/potree/potree',
    stars: '4.8k+',
    language: 'JavaScript',
    domain: 'drone',
    domainTitle: 'Drone Photogrammetry & LiDAR',
    desc: 'WebGL-based point cloud viewer for massive LiDAR datasets in a browser tab.',
    sevaRole: 'Enables 3D walkthroughs of orchard canopy structure and topographical contours.',
    integrationSnippet: `Potree.loadPointCloud("pointclouds/farm/metadata.json", "Farm LiDAR", function(e) { scene.addPointCloud(e.pointcloud); })`,
  },

  // --- AGRONOMY & HYDROLOGY ---
  {
    id: 'farmvibes',
    name: 'microsoft/farmvibes-ai',
    githubUrl: 'https://github.com/microsoft/farmvibes-ai',
    stars: '1.8k+',
    language: 'Python',
    domain: 'agronomy',
    domainTitle: 'Agronomy & Hydrology',
    desc: 'Multi-modal geospatial ML models for sustainable agriculture and carbon accounting.',
    sevaRole: 'Calculates field-specific soil carbon sequestration and crop water stress.',
    integrationSnippet: `from farmvibes.ai import WorkflowClient\nclient = WorkflowClient()\nclient.run_workflow("crop_readiness", geometry=farm_geojson)`,
  },
  {
    id: 'pyeto',
    name: 'm35/pyeto',
    githubUrl: 'https://github.com/m35/pyeto',
    stars: '350+',
    language: 'Python',
    domain: 'agronomy',
    domainTitle: 'Agronomy & Hydrology',
    desc: 'Python library for calculating reference evapotranspiration (ETo) using FAO-56 Penman-Monteith.',
    sevaRole: 'Powers precision irrigation scheduling cards based on live temperature and humidity.',
    integrationSnippet: `import pyeto\neto = pyeto.fao56_penman_monteith(net_rad, t_mean, wind_speed, actual_vap_pressure, sat_vap_pressure)`,
  },
  {
    id: 'soilgrids',
    name: 'ISRICWorldSoil/SoilGrids250m',
    githubUrl: 'https://github.com/ISRICWorldSoil/SoilGrids250m',
    stars: '300+',
    language: 'Python / R',
    domain: 'agronomy',
    domainTitle: 'Agronomy & Hydrology',
    desc: 'Global 250m resolution soil property maps by ISRIC World Soil Information.',
    sevaRole: 'Derives sand, clay, and organic matter to compute Available Water Capacity (AWC).',
    integrationSnippet: `import requests\nresp = requests.get(f"https://rest.isric.org/soilgrids/v2.0/properties/query?lon={lon}&lat={lat}")`,
  },

  // --- RURAL DISPATCH & IOT ---
  {
    id: 'opensms',
    name: 'daslearning-org/OpenSMS',
    githubUrl: 'https://github.com/daslearning-org/OpenSMS',
    stars: '150+',
    language: 'Python / Android',
    domain: 'dispatch',
    domainTitle: 'Rural Field Dispatch & IoT',
    desc: 'Open-source SMS API server turning an Android device into a cellular SMS gateway.',
    sevaRole: 'Dispatches Telugu, Hindi, and English crop health alerts to farmer mobile phones via local SIM.',
    integrationSnippet: `curl -X POST "http://10.65.171.208:9292/sms/" -H "Authorization: Bearer <TOKEN>" -d '{"number":"+919876543210","text":"SEVA.GIS Alert"}'`,
  },
  {
    id: 'remotion',
    name: 'remotion-dev/remotion',
    githubUrl: 'https://github.com/remotion-dev/remotion',
    stars: '22k+',
    language: 'TypeScript / React',
    domain: 'dispatch',
    domainTitle: 'Rural Field Dispatch & IoT',
    desc: 'Create videos programmatically using React and web technologies.',
    sevaRole: 'Renders automated 15-second animated field health briefing MP4s for WhatsApp dispatch.',
    integrationSnippet: `import { renderMedia } from '@remotion/renderer'\nawait renderMedia({ composition, serveUrl, outputLocation: 'kisan_briefing.mp4' })`,
  },
  {
    id: 'farm_lora',
    name: 'timmbogner/Farm-Data-Relay-System',
    githubUrl: 'https://github.com/timmbogner/Farm-Data-Relay-System',
    stars: '120+',
    language: 'C / C++',
    domain: 'dispatch',
    domainTitle: 'Rural Field Dispatch & IoT',
    desc: 'ESP-NOW and LoRa long-range agricultural sensor network without relying on cellular data.',
    sevaRole: 'Relays remote field soil moisture probes back to the village kiosk.',
    integrationSnippet: `#include <esp_now.h>\n// Transmit soil moisture reading over 1km LoRa mesh`,
  },
]

export interface SpatialAutomationRegistryProps {
  isOpen: boolean
  onClose: () => void
  onSelectRepo?: (repo: RepoEntry) => void
}

export default function SpatialAutomationRegistry({ isOpen, onClose, onSelectRepo }: SpatialAutomationRegistryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [viewSnippetId, setViewSnippetId] = useState<string | null>(null)

  const filteredRepos = useMemo(() => {
    return REPO_REGISTRY.filter(r => {
      const matchesDomain = selectedDomain === 'all' || r.domain === selectedDomain
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.desc.toLowerCase().includes(q) ||
        r.sevaRole.toLowerCase().includes(q) ||
        r.language.toLowerCase().includes(q) ||
        r.domainTitle.toLowerCase().includes(q)
      return matchesDomain && matchesSearch
    })
  }, [selectedDomain, searchQuery])

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden font-sans">
        
        {/* Modal Header — Sapphire & Emerald Luminous Gradient */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-sky-950 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10">
              <Globe size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Global Spatial Automation & GeoAI Registry
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {REPO_REGISTRY.length} Core Repositories
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                The global open-source technology stack powering SEVA·GIS: Cloud-Native STAC, GeoAI, In-Browser SQL & Rural SIM Outreach.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/TOP_1000_GEOSPATIAL_REPOSITORIES.json"
              download="TOP_1000_GEOSPATIAL_REPOSITORIES.json"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer text-decoration-none"
              title="Download full machine-readable catalog of 1,000 repositories"
            >
              <Download size={13} />
              <span>Export 1,000 Repos (JSON)</span>
            </a>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer border border-slate-700"
              aria-label="Close Registry"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Domain Filters */}
        <div className="px-6 py-3.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search repositories, languages, or algorithms..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          {/* Domain Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
            {[
              { id: 'all', label: 'All Domains' },
              { id: 'stac', label: 'Cloud-Native STAC' },
              { id: 'geoai', label: 'GeoAI & Vision' },
              { id: 'automation', label: 'Automation & ETL' },
              { id: 'webgis', label: 'Client WebGIS' },
              { id: 'drone', label: 'Drone & LiDAR' },
              { id: 'agronomy', label: 'Agronomy' },
              { id: 'dispatch', label: 'Rural Dispatch' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedDomain(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedDomain === tab.id
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                    : 'bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Repository Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRepos.map(repo => {
              const isViewingSnippet = viewSnippetId === repo.id
              return (
                <div
                  key={repo.id}
                  className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition group hover:shadow-lg hover:shadow-sky-950/30"
                >
                  <div>
                    {/* Header: Repo Name & Stars Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <a
                        href={repo.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1.5 break-all group-hover:underline"
                      >
                        {repo.name}
                        <ExternalLink size={12} className="shrink-0 opacity-70" />
                      </a>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/20 shrink-0">
                        ⭐ {repo.stars}
                      </span>
                    </div>

                    {/* Meta Badges */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {repo.language}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                        {repo.domainTitle}
                      </span>
                    </div>

                    {/* Descriptions */}
                    <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                      {repo.desc}
                    </p>

                    <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 mb-3 text-[11px] leading-relaxed">
                      <strong className="text-slate-200 block mb-0.5">Role in SEVA·GIS:</strong>
                      <span className="text-slate-400">{repo.sevaRole}</span>
                    </div>

                    {/* Integration Code Snippet (Expandable) */}
                    {isViewingSnippet && (
                      <div className="mb-3 relative rounded-lg bg-slate-950 border border-slate-800 p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                        <pre className="whitespace-pre-wrap">{repo.integrationSnippet}</pre>
                        <button
                          onClick={() => handleCopy(repo.id, repo.integrationSnippet)}
                          className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] flex items-center gap-1 border border-slate-700"
                        >
                          {copiedId === repo.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          {copiedId === repo.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                    <button
                      onClick={() => setViewSnippetId(isViewingSnippet ? null : repo.id)}
                      className="text-slate-400 hover:text-white flex items-center gap-1.5 transition cursor-pointer text-[11px] font-medium"
                    >
                      <Code2 size={13} />
                      {isViewingSnippet ? 'Hide Recipe' : 'View Recipe'}
                    </button>

                    <button
                      onClick={() => handleCopy(repo.id, repo.integrationSnippet)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] flex items-center gap-1 transition cursor-pointer border border-slate-700"
                    >
                      {copiedId === repo.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedId === repo.id ? 'Copied Code' : 'Copy Code'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredRepos.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Layers size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold">No repositories match your current filter.</p>
              <p className="text-xs mt-1">Try resetting the domain filter or search term.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>All repositories verified compatible with SEVA·GIS Zero-Cost Architecture.</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="file:///media/akshit/RAMESH/SEVAGIS/seva%20gis/docs/SPATIAL_AUTOMATION/00_MASTER_INDEX.md"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline flex items-center gap-1"
            >
              Full Master Documentation Index
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
