# Credits

SEVA.GIS stands for **Spatial Evaluation & Vegetation Analytics**. Idea, design and code by N. Akshit Vinay.

## Data (free, no keys)

| Source | Used for |
|---|---|
| ESA Copernicus Sentinel-2 L2A, served by Microsoft Planetary Computer (STAC and TiTiler) | Satellite bands, indices, true colour |
| Copernicus GLO-30 DEM | Terrain, slope, aspect, hillshade, contours |
| Open-Meteo | Weather forecast and pest risk |
| ISRIC SoilGrids | Soil properties |
| Esri World Imagery, Streets, Topo and Light/Dark Gray | Base maps and sharp true colour |
| OpenStreetMap contributors via the Overpass API | Nearby water and power features |
| Google Translate widget | Hindi and Telugu page translation |

## Open-source libraries

React, Vite, Tailwind CSS, Leaflet, Turf.js (`@turf/buffer`), shpjs, Motion, lucide-react, gifenc, and the Playwright/Puppeteer tooling used to record the tour.

## Ideas and methods borrowed

| From | What |
|---|---|
| Google Earth Engine code-editor scripts | Index formulas, cloud masking with SCL, land-cover thresholds |
| Copernicus Browser and USGS EarthExplorer | True-colour stretch, clear imagery, layer toggles |
| QGIS and ArcGIS | Map layouts with title, legend, north arrow, scale bar and coordinate frame |
| scikit-learn, GDAL, Orfeo Toolbox, SNAP, QGIS Semi-Automatic Classification, ENVI, ERDAS | K-means, minimum-distance and maximum-likelihood classifiers |
| particles.js and vanta.js | Particle-network sign-in backdrop |
| Handy GPS style apps | Walk-the-boundary farm capture |

## Free hosting and domain

| Service | Role |
|---|---|
| GitHub Pages and GitHub Actions | Free public hosting and automatic deploys |
| DigitalPlat FreeDomain (`dpdns.org`, `qzz.io`) and is-a.dev | Optional free domain names, see `docs/DOMAIN.md` |
| FormSubmit | Delivers contact-chat messages to the maintainer's inbox |

Domain credentials are never stored in this repository. Registrar logins stay with the owner.
