<div align="center">

<img src="docs/logo.png" alt="SEVA.GIS logo" width="160"/>

# SEVA.GIS

**S**patial **E**valuation & **V**egetation **A**nalytics

Free, open-source GeoAI farm monitor. Live Sentinel-2 satellite data, explained in plain language.

[**Open the app**](https://sevagis.dpdns.org) · [Backup link](https://virahitvin8.github.io/seva-gis/) · [Report a bug](https://github.com/virahitvin8/seva-gis/issues) · [Credits](docs/CREDITS.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![Vite 8](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Tailwind 4](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)
![Sentinel-2](https://img.shields.io/badge/Sentinel--2-live-2f8f4e)
![No API keys](https://img.shields.io/badge/API%20keys-none-success)
![Font Awesome](https://img.shields.io/badge/icons-Font%20Awesome%206-528dd7?logo=fontawesome&logoColor=white)
![Syne](https://img.shields.io/badge/headings-Syne-111?logo=googlefonts&logoColor=white)
![Manrope](https://img.shields.io/badge/text-Manrope%20%2B%20DM%20Sans-111?logo=googlefonts&logoColor=white)

![SEVA.GIS guided tour with Mitra](docs/tour.gif)

### Quick tour with Mitra: where is what

![Click-by-click quick tour: where everything is in SEVA.GIS](docs/quick-tour.gif)

### Mitra's walkthrough with real satellite data

A real farm (Ludhiana, Punjab) analysed live with Sentinel-2: map, analysis lab, time-lapse and report. [Watch the video (WebM)](docs/seva-gis-tour.webm)

![Mitra walkthrough with real data](docs/seva-gis-tour.gif)


</div>

## Contents

[Why SEVA.GIS](#why-sevagis) · [Quick tour](#quick-tour) · [Features](#features) · [Data sources](#data-sources) · [Method](#method) · [Limitations](#limitations) · [Getting started](#getting-started) · [Project layout](#project-layout) · [Author](#author) · [Credits](#credits)

## Why SEVA.GIS

SEVA.GIS reads the newest Sentinel-2 picture of your farm boundary and turns it into plain answers: how healthy the crop is, whether it needs water, and what the ground is like.

- Real, keyless data only. A new account starts empty: you add your own farm.
- Works on desktop and Android, and installs as an app (Add to Home screen).
- Written for readers aged 16 and over. Each result has a scale and a "Why?" line.

## Quick tour

After sign-in, **Mitra**, the in-app guide, offers a short tour. Each step highlights part of the screen and explains it. You can go back, skip a step, or skip the whole tour, and reopen it any time from the **Quick tour with Mitra** button at the top right, next to your profile.

The animation above walks through every step: menu, adding a farm, the live map, numbers with scales, advice, the analysis lab and GeoAI studio, geo tools, reports, the contact chat and signing out.

## Features

| Area | Capability |
|---|---|
| Farm boundary | Draw, walk with GPS, type corners, or upload GeoJSON, KML, GPX, WKT, CSV and zipped Shapefiles |
| Imagery | Newest cloud-filtered Sentinel-2 L2A scene, cloud-masked and clipped to the boundary. A Copernicus-style true-colour view and Esri high-resolution imagery to zoom level 18 |
| Indices | NDVI, NDMI, NDWI, NDRE, EVI, BSI and more, each with a verdict |
| Terrain | Copernicus 30 m DEM: slope, aspect, hillshade, contours, TWI |
| Base maps | Esri Imagery, Streets, Light, Dark and Topo, with a farm-only clipped view locked to the boundary |
| GeoAI studio | Sharpened true-colour view plus automatic classification: k-means++ (unsupervised), minimum-distance and maximum-likelihood (supervised, self-trained from rule-based land cover). Methods follow scikit-learn, GDAL, Orfeo Toolbox, SNAP and QGIS SCP. GeoJSON export |
| Nearby water and power | Overpass (OpenStreetMap) finds borewells, tube wells, hand pumps, lakes, ponds, streams, canals, pipelines, poles, transformers and power lines within 1 km. Distance buffer rings, inside/outside marking and per-layer on/off toggles. Your own borewells and pipelines get buffer rings too |
| Languages | English, Hindi and Telugu toggle beside the notification bell (Google Translate widget) |
| Analysis lab | True-colour, land cover, zones, change and weak-spot maps, each explained and marked with vulnerability points |
| Geo tools | WKT reader, offset and buffer, each with in-app how-to guides |
| Reports | PDF download (print to PDF) and one-file HTML report with selectable maps. Each map sheet has a coordinate frame, title, north arrow, scale bar and legend, and elements can be moved by double-clicking in the preview |
| Weather and soil | Open-Meteo forecast and pest risk, SoilGrids soil properties |
| Contact | In-app message widget that delivers to the maintainer's inbox |
| Guide | Mitra greets you by time of day and in several languages, and offers a skippable guided tour |
| Accounts | Local, in-browser accounts. Data stays on your device |

## Data sources

| Data | Provider |
|---|---|
| Sentinel-2 L2A, Copernicus DEM | Microsoft Planetary Computer |
| Weather and climate | Open-Meteo |
| Soil | SoilGrids (ISRIC) |
| Imagery and base maps | Esri |
| 3D terrain | AWS Terrain Tiles |

## Method

1. Find the newest Sentinel-2 scene over the farm (last 60 days, then 180) with under 30% cloud.
2. Mask cloud, shadow and bad pixels using the scene classification layer.
3. Compute spectral indices inside the boundary.
4. Derive slope, aspect and drainage from the DEM.
5. Draw maps with a legend for every colour scale.
6. Convert numbers to advice with the reason shown next to it.

| Signal | Rule |
|---|---|
| NDVI below 0.3 | Pixel counted as stressed |
| Over 20% stressed pixels, or mean NDVI below 0.4 | Farm flagged for attention |
| NDMI below 0.1 | Leaves look dry, used in irrigation advice |
| 15 mm or more rain in 7 days | Advice becomes "hold, rain due" |
| Slope above 15% | Challenging for construction |

## Limitations

- A satellite shows where a crop is weaker, not why.
- Pest and moisture scores are rules of thumb, not forecasts.
- Sentinel-2 resolution is 10 m, so very small farms have few pixels.
- Accounts are local to one browser. There is no sync or password reset.
- Construction notes are not an engineering survey.

## Getting started

```bash
pnpm install
pnpm dev        # development server
pnpm build      # production build
pnpm preview    # serve the build
```

## Project layout

```
src/        React + Vite + Tailwind application
src/lib/    geospatial, raster and GeoAI logic
public/     web manifest and static assets
docs/       additional notes
```

See [DESIGN.md](DESIGN.md) for design notes and [CONTRIBUTING.md](CONTRIBUTING.md) to contribute.

## Author

Idea, design and code by **N. Akshit Vinay**, for everyone who loves the land and wants to see it grow.

[Email](mailto:akshitvinay4636@gmail.com) · [LinkedIn](https://www.linkedin.com/in/neelam-akshit-vinay-b18554322) · [GitHub](https://github.com/virahitvin8)

Released under the [MIT License](LICENSE).

## Publish and domain

Every push to `main` builds and deploys to GitHub Pages through `.github/workflows/pages.yml`. In the repo go to Settings, Pages, Source, GitHub Actions (one time). A free custom name is optional; see [docs/DOMAIN.md](docs/DOMAIN.md).

## Design and fonts

- Icons: [Font Awesome Free](https://github.com/FortAwesome/Font-Awesome) (sign-in page, dashboard header, empty state).
- Fonts: Syne (animated headings), Manrope and DM Sans (text), JetBrains Mono (labels), Mr Dafoe (wordmark), all open-licence Google Fonts, chosen with the [awesome-fonts](https://github.com/brabadu/awesome-fonts) list as a guide.
- Sign-in graphics: a pointer-reactive particle network (idea from [Pts](https://github.com/williamngan/pts)) and a node-flow strip (idea from the node editor in [Graphite](https://github.com/GraphiteEditor/Graphite)); molecule-style linked nodes follow [Mol*](https://github.com/molstar/molstar).
- Reports carry the SEVA.GIS logo, a watermark, location, satellite date and a data-source list on the first page.

## Credits

Data providers, libraries, methods and hosting are listed in [docs/CREDITS.md](docs/CREDITS.md).
