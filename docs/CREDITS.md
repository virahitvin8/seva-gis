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
| Fields2Cover | Autonomous agricultural robotics, boustrophedon swath planning & turn minimization |
| Archify (`tt-a1i/archify`) | End-to-end geospatial system methodology flowchart |
| Agent-Reach (`Panniantong/agent-reach`) | Multi-source precision agriculture parameter synthesis & commercial benchmark research |
| Hyperframes (`heygen-com/hyperframes`) | Declarative, code-driven video walkthrough generation |
| PPT-Master (`hugohe3/ppt-master`) | Automated precision agriculture presentation deck generation |
| Brag-Slim (`latent-spaces/brag`) | Single-command launch video, GIF, and social media compilation engine |
| BurnGuard (`ashmoonori-afk/BurnGuard`) | Agricultural crop residue & stubble fire detection with in-situ mulching advice |
| Hindsight (`vectorize-io/hindsight`) | Episodic field memory tracking longitudinal NDVI trajectories and resilience |
| Paperclip (`paperclipai/paperclip`) | Client-side agent task orchestrator for multi-step precision workflows |
| SlopMonster (`ItsssssJack/SlopMonster`) | Agronomic anti-hallucination and physical boundary guardrails |
| Matt Pocock Skills (`mattpocock/skills`) | Adversarial design grilling (`grill-me`), code review, and domain modeling |
| particles.js and vanta.js | Particle-network sign-in backdrop |
| Handy GPS style apps | Walk-the-boundary farm capture |

## Free hosting and domain

| Service | Role |
|---|---|
| GitHub Pages and GitHub Actions | Free public hosting and automatic deploys |
| DigitalPlat FreeDomain (`dpdns.org`, `qzz.io`) and is-a.dev | Optional free domain names, see `docs/DOMAIN.md` |
| FormSubmit | Delivers contact-chat messages to the maintainer's inbox |

Domain credentials are never stored in this repository. Registrar logins stay with the owner.
