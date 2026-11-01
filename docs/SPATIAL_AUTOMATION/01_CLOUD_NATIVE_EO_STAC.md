# 01. Cloud-Native Earth Observation & STAC Catalogs

> **Zero-Download Satellite Processing at Planetary Scale**  
> Repositories powering Cloud-Optimized GeoTIFFs (COGs), SpatioTemporal Asset Catalogs (STAC), multidimensional Zarr arrays, and dynamic tile servers.

---

## 1. Flagship Repositories

| Repository | Stars | Language | Primary Role in SEVA·GIS |
| :--- | :--- | :--- | :--- |
| [developmentseed/titiler](https://github.com/developmentseed/titiler) | 2.1k+ | Python / FastAPI | Dynamic Web Tile server computing on-the-fly NDVI/NDMI from remote COGs without downloading full gigabyte satellite scenes. |
| [stac-utils/pystac](https://github.com/stac-utils/pystac) | 1.1k+ | Python | Core Python library for building, reading, and mutating STAC Item/Collection JSON. |
| [microsoft/planetary-computer-sdk](https://github.com/microsoft/planetary-computer-sdk) | 800+ | Python | Free access to Sentinel-2 L2A, Landsat-9, Copernicus DEM, and 100+ global environmental datasets with SAS signing. |
| [cogeotiff/rio-tiler](https://github.com/cogeotiff/rio-tiler) | 1.4k+ | Python | Rasterio plugin to read and extract pixel values, histograms, and band expressions from COGs over HTTP Range requests. |
| [stac-utils/stac-fastapi](https://github.com/stac-utils/stac-fastapi) | 700+ | Python | Production-grade STAC API server implementation with pgstac backend for indexing local farmer farm boundary scenes. |
| [radiantearth/stac-spec](https://github.com/radiantearth/stac-spec) | 1.8k+ | JSON Schema | Global specification standard for spatio-temporal cataloging of satellite, aerial, and drone rasters. |
| [zarr-developers/zarr-python](https://github.com/zarr-developers/zarr-python) | 1.9k+ | Python | Chunked, compressed, N-dimensional array storage format for climate reanalysis (ERA5) and weather time-series. |
| [fsspec/kerchunk](https://github.com/fsspec/kerchunk) | 650+ | Python | Cloud-native virtual file systems mapping legacy NetCDF/HDF5 archives into cloud-streamable Zarr metadata. |
| [cogeotiff/cog-spec](https://github.com/cogeotiff/cog-spec) | 600+ | Markdown | Cloud-Optimized GeoTIFF internal tile organization and HTTP GET range-request specification. |
| [stac-utils/pystac-client](https://github.com/stac-utils/pystac-client) | 600+ | Python | High-level search client for interactive querying of public and enterprise STAC API endpoints. |

---

## 2. Technical Integration Blueprint for SEVA·GIS

### Real-time Sentinel-2 L2A NDVI Tile Streaming
Instead of storing multi-gigabyte satellite scenes on disk, SEVA·GIS queries the public Element84 AWS / Microsoft Planetary Computer STAC catalog for the latest cloud-free Sentinel-2 L2A scene intersecting the farm's bounding box:

```python
import pystac_client
import planetary_computer as pc

# 1. Connect to Planetary Computer STAC
catalog = pystac_client.Client.open(
    "https://planetarycomputer.microsoft.com/api/stac/v1",
    modifier=pc.sign_inplace
)

# 2. Search for cloud-free (<15%) scene over Andhra Pradesh AOI
search = catalog.search(
    collections=["sentinel-2-l2a"],
    bbox=[79.95, 14.40, 80.05, 14.50],
    datetime="2026-10-01/2026-10-31",
    query={"eo:cloud_cover": {"lt": 15}},
    limit=1
)

item = next(search.items())
b04_red = item.assets["B04"].href
b08_nir = item.assets["B08"].href

# 3. TiTiler Dynamic Tile URL for Leaflet / MapLibre (Normalized Difference Math)
titiler_endpoint = (
    f"https://titiler.xyz/cog/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}.png?"
    f"url={b08_nir}&expression=(b1-b2)/(b1+b2)&assets={b04_red}&rescale=-0.1,0.85&colormap_name=rdylgn"
)
```
