# 04. In-Browser Client WebGIS, WebGPU & Edge Spatial Analytics

> **Zero-Server Client Compute & Hardware-Accelerated Geospatial Mapping**  
> Repositories powering browser-side DuckDB SQL, WebGL/WebGPU shaders, high-DPI vector rendering, and binary geometry streaming.

---

## 1. Flagship Repositories

| Repository | Stars | Language | Primary Role in SEVA·GIS |
| :--- | :--- | :--- | :--- |
| [opengeos/GeoLibre](https://github.com/opengeos/GeoLibre) | 1.1k+ | TypeScript | Cloud-native GIS platform combining DuckDB, MapLibre, and Cesium for cross-platform web/desktop GIS. |
| [duckdb/duckdb-wasm](https://github.com/duckdb/duckdb-wasm) | 3.5k+ | C++ / WASM / TS | In-browser analytical SQL engine running spatial functions and zonal stats locally with 0 server latency and $0 hosting cost. |
| [visgl/deck.gl](https://github.com/visgl/deck.gl) | 13k+ | TypeScript / WebGL2 | High-performance WebGL/WebGPU framework for rendering 1,000,000+ vector parcels and 3D terrain meshes smoothly at 60 FPS. |
| [maplibre/maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js) | 6.8k+ | TypeScript | The open-source standard for GPU-accelerated interactive vector and raster map rendering in modern browsers. |
| [open-geospatial/geoparquet](https://github.com/open-geospatial/geoparquet) | 1.2k+ | Specification | Apache Parquet geospatial standard: 50x faster load times and 80% smaller size than legacy GeoJSON/Shapefiles. |
| [flatgeobuf/flatgeobuf](https://github.com/flatgeobuf/flatgeobuf) | 2.1k+ | C++ / JS / Rust | Binary spatial format with embedded spatial index (R-tree) enabling client HTTP Range requests for viewport streaming. |
| [geotiffjs/geotiff.js](https://github.com/geotiffjs/geotiff.js) | 1.8k+ | JavaScript | Pure JavaScript GeoTIFF parser for in-browser client raster rendering, band arithmetic, and histogram calculation. |
| [CesiumGS/cesium](https://github.com/CesiumGS/cesium) | 12.5k+ | JavaScript | 3D globe and geospatial virtual globe engine for visualizing satellite orbital passes and 3D terrain elevation models. |
| [keplergl/kepler.gl](https://github.com/keplergl/kepler.gl) | 10k+ | TypeScript / React | Geospatial analysis tool for large-scale data sets with dynamic time-playback, filters, and multi-variable choropleths. |
| [turfjs/turf](https://github.com/Turfjs/turf) | 8.5k+ | TypeScript | Modular spatial analysis engine written in pure JavaScript for in-browser planar geometry calculations. |

---

## 2. Technical Integration Blueprint for SEVA·GIS

### Zero-Server Spatial SQL with DuckDB-WASM
Allows calculating village-wide agricultural statistics, crop acreage totals, and PMFBY insurance payout qualifications directly inside the user's browser tab:

```typescript
import * as duckdb from '@duckdb/duckdb-wasm'

// 1. Initialize DuckDB-WASM inside browser worker
const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()
const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)
const worker = new Worker(bundle.mainWorker!)
const logger = new duckdb.ConsoleLogger()
const db = new duckdb.AsyncDuckDB(logger, worker)
await db.instantiate(bundle.mainModule, bundle.pthreadWorker)

// 2. Query GeoParquet cadastral parcels locally
const conn = await db.connect()
await conn.query(`
  INSTALL spatial;
  LOAD spatial;
  CREATE TABLE parcels AS SELECT * FROM read_parquet('andhra_cadastral_parcels.parquet');
  
  -- Compute zonal acreage and identify high-stress parcels
  SELECT 
    crop_type,
    count(*) as total_plots,
    round(sum(area_ha), 2) as total_hectares,
    round(avg(ndvi_mean), 3) as avg_ndvi,
    count(case when stress_percentage >= 33 then 1 end) as pmfby_claims_triggered
  FROM parcels
  GROUP BY crop_type;
`)
```
