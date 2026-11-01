# 03. Spatial Automation Pipelines, Orchestration & Engines

> **High-Throughput Geospatial Processing, Batch Execution & Workflow Automation**  
> Repositories powering distributed raster algebra, vector geometry transformations, pipeline DAGs, and headless GIS orchestration.

---

## 1. Flagship Repositories

| Repository | Stars | Language | Primary Role in SEVA·GIS |
| :--- | :--- | :--- | :--- |
| [opengeos/leafmap](https://github.com/opengeos/leafmap) | 3.8k+ | Python | Universal geospatial analysis package: interactive mapping, split-panel comparison, timelapse generation, and batch vector geoprocessing. |
| [opengeos/RustGIS](https://github.com/opengeos/RustGIS) | 600+ | Rust | Pure Rust GIS engine: zero-overhead polygon clipping, ray-casting point-in-polygon (PIP), and SIMD band math. |
| [OSGeo/gdal](https://github.com/OSGeo/gdal) | 4.8k+ | C++ / Python | The foundational geospatial data abstraction library for raster and vector translation, warping, and reprojection. |
| [rasterio/rasterio](https://github.com/rasterio/rasterio) | 2.5k+ | Python / Cython | Pythonic raster I/O for GeoTIFFs, coordinate transformations, and windowed reading. |
| [geopandas/geopandas](https://github.com/geopandas/geopandas) | 4.6k+ | Python | Spatial vector operations on pandas dataframes (spatial joins, intersections, buffers, and centroids). |
| [shapely/shapely](https://github.com/shapely/shapely) | 3.7k+ | Python / C (GEOS) | Fast planar geometry calculations based on GEOS (validity checks, buffering, union, difference). |
| [pyproj4/pyproj](https://github.com/pyproj4/pyproj) | 1.1k+ | Python / C (PROJ) | Cartographic projections and coordinate system transformations (WGS84 EPSG:4326 to UTM EPSG:32644). |
| [makepath/xarray-spatial](https://github.com/makepath/xarray-spatial) | 800+ | Python / Numba | Raster-based spatial analytics on GPU/CPU with zero GDAL C-dependency (NDVI, hillshade, slope, aspect, zonal stats). |
| [dask/dask](https://github.com/dask/dask) | 12k+ | Python | Parallel computing library scaling Python geospatial workflows across multi-core CPUs and distributed clusters. |
| [prefecthq/prefect](https://github.com/PrefectHQ/prefect) | 17k+ | Python | Modern workflow orchestration for scheduling recurring weekly Sentinel-2 data pulls, alerts, and field reports. |

---

## 2. Technical Integration Blueprint for SEVA·GIS

### Headless Crop Vigor Batch Pipeline (Rasterio + Xarray-Spatial)
Processes multi-spectral bands across thousands of registered farms concurrently without spinning up a heavy desktop GIS GUI:

```python
import rasterio
from xarray_spatial import ndvi
import xarray as xr

# 1. Windowed read of Sentinel-2 Red (B4) and NIR (B8) rasters
with rasterio.open("s2_b4_red.tif") as red_src, rasterio.open("s2_b8_nir.tif") as nir_src:
    red_data = red_src.read(1)
    nir_data = nir_src.read(1)

# 2. Vectorized NDVI Computation via Xarray-Spatial
red_xr = xr.DataArray(red_data)
nir_xr = xr.DataArray(nir_data)
ndvi_xr = ndvi(red=red_xr, nir=nir_xr)

# 3. Zonal statistics over farmer AOI polygons
mean_ndvi = float(ndvi_xr.mean().values)
print(f"[SEVA·GIS Automation] Batch NDVI Mean: {mean_ndvi:.3f}")
```
