# SEVA.GIS Credits and Reference Sources

SEVA.GIS means **Spatial Evaluation & Vegetation Analytics**. The project is intended to make spatial inspection and remote-sensing analysis more approachable while preserving source transparency and honest limitations.

## Data providers

| Source | Use |
|---|---|
| ESA Copernicus Sentinel-2 L2A | Multispectral imagery and spectral indices |
| Microsoft Planetary Computer | Public STAC/COG scene discovery and browser fallback |
| Google Earth Engine | Optional authenticated cloud tiles, statistics, time series, and change analysis |
| Copernicus GLO-30 DEM | Elevation, slope, aspect, hillshade, and terrain derivatives |
| Open-Meteo | Weather and forecast inputs |
| ISRIC SoilGrids | Regional soil-property estimates |
| Esri and OpenStreetMap | Basemaps and nearby spatial context where enabled |

## Open-source libraries

React, Vite, Tailwind CSS, Leaflet, MapLibre GL, Turf, shpjs, Dexie, Motion, Lucide, and the Python FastAPI/Earth Engine service libraries.

## Research and design references

| Reference | Role in SEVA.GIS |
|---|---|
| QGIS and GDAL/OGR | Raster/vector workflows, clipping, georeferencing, symbology, and export behavior |
| Esri/ArcGIS cartography | Map furniture, legends, scale, north arrows, and layout conventions |
| Google Earth Engine and `gee-community` | Cloud masking, band math, satellite collections, and tile patterns |
| MathWorks | Numerical methods, matrix calculations, time-series fitting, and hydrology references |
| `morluto/rea` | Reverse-engineering methodology for studying observable behavior before reimplementation |
| `feitangyuan/motion-web` | Motion and physics direction for the sign-in experience |
| StoryTold Craft projects | Report composition, grids, vector layout, design, and effects; reports-only inspiration |
| `front-end-checklist` | Accessibility, responsiveness, semantic UI, and production readiness checks |
| `mattpocock/skills` and local `.agents/skills` | Type safety, review discipline, geospatial invariants, and verification loops |
| Human-reviewed language guidance | Natural Telugu and Hindi scientific/agricultural terminology |

These references are not automatically copied into the runtime and are not claims that SEVA.GIS implements every capability of the referenced projects.

## Attribution rules

- Keep repository and tool credits in documentation, not visible implementation-slogan captions.
- Attribute external data and algorithms near the relevant report or export.
- Do not claim validation, sensor precision, classification accuracy, or delivery success without a reproducible test.
- Do not store credentials, service-account files, or private deployment details in this repository.
