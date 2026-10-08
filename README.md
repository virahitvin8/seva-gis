<div align="center">

<img src="docs/title-banner.jpg" alt="SEVA·GIS — Spatial Evaluation & Vegetation Analytics" width="760"/>

# 🌿 𝐒𝐄𝐕𝐀 · 𝐆𝐈𝐒

### *Spatial Evaluation & Vegetation Analytics*

**See your farm the way a satellite does.**
<br/>
Free &nbsp;·&nbsp; Keyless &nbsp;·&nbsp; Open-Source &nbsp;·&nbsp; In-Browser GeoAI

<br/>

[![🌾 Open the App](https://img.shields.io/badge/🌾%20Open%20the%20App-sevagis.dpdns.org-2f8f4e?style=for-the-badge&labelColor=1a1a2e)](https://sevagis.dpdns.org)
[![🔁 Backup Link](https://img.shields.io/badge/🔁%20Backup%20Link-GitHub%20Pages-6e40c9?style=for-the-badge&labelColor=1a1a2e)](https://virahitvin8.github.io/seva-gis/)
[![Report a Bug](https://img.shields.io/badge/🐛%20Bug%20Report-Issues-e34c26?style=for-the-badge&labelColor=1a1a2e)](https://github.com/virahitvin8/seva-gis/issues)

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
![React 19](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white)
![Vite 8](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite&logoColor=white)
![Tailwind 4](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)
![Sentinel-2](https://img.shields.io/badge/Sentinel--2-live%20imagery-2f8f4e?style=flat-square)
![No API keys](https://img.shields.io/badge/API%20keys-none%20needed-brightgreen?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8?style=flat-square&logo=pwa)

</div>

---

<div align="center">

## ✨ Try it — no login needed to explore

> *Draw your farm boundary, watch real Sentinel-2 satellite data load instantly, and get plain-language advice about crop health, irrigation need and soil — all in your browser.*

### **→ [Open SEVA.GIS now at sevagis.dpdns.org](https://sevagis.dpdns.org) ←**

*Works on desktop · Android · Installs as a PWA (Add to Home screen)*

</div>

---

## 🎬 Full walkthrough with real satellite data

> Mitra, the in-app guide, walks a real farm near **Ludhiana, Punjab** — live Sentinel-2 imagery, NDVI crop health, month-by-month time-lapse from June → October 2026, and a full downloadable report.

<div align="center">

[![Watch the full walkthrough — click to open the live app](docs/seva-gis-tour.gif)](https://sevagis.dpdns.org)

*▲ Click the animation to open the live app &nbsp;|&nbsp; [▶ Watch as video (WebM · 147 KB)](https://github.com/virahitvin8/seva-gis/blob/main/docs/seva-gis-tour.webm)*

</div>

---

<div align="center">

### 🌟 3D Sparkle Loader — Seedling to Coconut Palm Tree

> *Watch the interactive 3D particle loader: stardust particles dismantle from the SEVA·GIS emblem, spiral in 3D to assemble a fresh green seedling sprout, surge with an energetic sparkle wave boost into a majestic Coconut Palm Tree, and seamlessly re-converge.*

<img src="docs/plant-coconut-loader.gif" alt="SEVA·GIS 3D Sparkle Loader: seedling sprout with sparkle wave boost growing into a coconut palm tree" width="280"/>

<br/>

*▲ 3D sparkle loader — seedling sprout grows from soil with sparkle wave boost into a coconut palm tree*

</div>

---

## 🗺️ Where is what — guided quick tour

> First time? **Mitra** gives you a 60-second guided tour the moment you sign in. It highlights each part of the screen and explains it. You can skip, go back, or reopen it any time.

**Mitra's click-by-click tour:** menu → add farm → live map → NDVI indices → analysis lab → GeoAI studio → geo tools → report → sign out

<div align="center">

[![Mitra's click-by-click tour](docs/quick-tour.gif)](https://sevagis.dpdns.org)

*▲ Covers: menu · add farm · live map · indices with scales · analysis lab · GeoAI · geo tools · reports · sign out*

</div>

---

## 📖 Contents

[Why SEVA.GIS](#-why-sevagis) · [Features](#-features) · [Data sources](#-data-sources) · [Method](#-method) · [Limitations](#-limitations) · [Author](#-author) · [Credits](#-credits)

---

## 🌱 Why SEVA.GIS

Most satellite tools are locked behind subscriptions or require GIS expertise. SEVA.GIS does the opposite:

- **Keyless.** No API keys, no subscription. Uses open Copernicus data.
- **Personal.** A new account starts empty — you add your own farm, your data stays in your browser.
- **Plain language.** Every number has a scale and a "Why?" line.
- **Cross-platform.** Desktop · Android · installable as a PWA.
- **Real data only.** No demo farms pre-loaded — every result is from actual Sentinel-2 imagery.

---

## 🛰️ Features

| Area | Capability |
|---|---|
| **Farm boundary** | Draw on map, walk with GPS, type corners, or upload GeoJSON · KML · GPX · WKT · CSV · zipped Shapefiles |
| **Imagery** | Newest cloud-filtered Sentinel-2 L2A scene (≤30% cloud, last 60 → 180 days), cloud-masked & clipped to boundary. Copernicus true-colour + Esri HR imagery to zoom 18 |
| **Spectral indices** | NDVI · NDMI · NDWI · NDRE · EVI · BSI — each with a verdict and plain-language advice |
| **Terrain** | Copernicus 30 m DEM: slope, aspect, hillshade, contours, TWI |
| **Time-lapse** | Month-by-month Sentinel-2 frames with Mitra captions — watch your crop change season to season |
| **GeoAI studio** | Sharpened true-colour + auto classification: k-means++ (unsupervised), minimum-distance & maximum-likelihood (supervised). GeoJSON export |
| **Nearby features** | OpenStreetMap Overpass: borewells, tube wells, hand pumps, lakes, ponds, streams, canals, power lines — distance rings, inside/outside marking, per-layer toggles |
| **Analysis lab** | True-colour · land cover · zones · change · weak-spot maps, each explained with vulnerability points |
| **Weather & soil** | Open-Meteo forecast + pest risk, SoilGrids soil properties |
| **Reports** | PDF (print to PDF) + one-file HTML with coordinate frame, north arrow, scale bar, legend — moveable in preview |
| **Languages** | English · Hindi · Telugu (Google Translate toggle beside the notification bell) |
| **Geo tools** | WKT reader, offset & buffer, each with in-app how-to guides |
| **Accounts** | Local, in-browser — data stays on your device |

---

## 📡 Data sources

| Data | Provider |
|---|---|
| Sentinel-2 L2A · Copernicus DEM | [Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/) |
| Weather & climate | [Open-Meteo](https://open-meteo.com/) |
| Soil | [SoilGrids — ISRIC](https://soilgrids.org/) |
| Imagery & base maps | [Esri](https://www.esri.com/en-us/arcgis/products/arcgis-online/overview) |
| 3D terrain | [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) |
| Nearby features | [OpenStreetMap / Overpass API](https://overpass-api.de/) |

---

## 🔬 Method

1. Find the newest Sentinel-2 scene over the farm (last 60 days, then 180) with under 30% cloud.
2. Mask cloud, shadow and bad pixels using the scene classification layer.
3. Compute spectral indices inside the boundary.
4. Derive slope, aspect and drainage from the DEM.
5. Draw maps with a legend for every colour scale.
6. Convert numbers to advice with the reason shown next to it.

| Signal | Rule |
|---|---|
| NDVI below 0.3 | Pixel counted as stressed |
| >20% stressed pixels, or mean NDVI < 0.4 | Farm flagged for attention |
| NDMI below 0.1 | Leaves look dry → used in irrigation advice |
| 15 mm or more rain in 7 days | Advice becomes "hold, rain due" |
| Slope above 15% | Challenging for construction |

---

## ⚠️ Limitations

- A satellite shows *where* a crop is weaker, not *why*.
- Pest and moisture scores are rules of thumb, not forecasts.
- Sentinel-2 resolution is 10 m — very small farms have few pixels.
- Accounts are local to one browser. No sync or password reset.
- Construction notes are not an engineering survey.

---

## 👨‍💻 Author

<div align="center">

**N. Akshit Vinay**

*Idea, design and Vibe coded 💖 — for everyone who loves the land and wants to see it grow.*

<br/>

[![Email](https://img.shields.io/badge/Email-akshitvinay4636%40gmail.com-D14836?style=flat-square&logo=gmail&logoColor=white)](mailto:akshitvinay4636@gmail.com)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Neelam%20Akshit%20Vinay-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/neelam-akshit-vinay-b18554322)
[![GitHub](https://img.shields.io/badge/GitHub-virahitvin8-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/virahitvin8)

Released under the [MIT License](LICENSE).

</div>

---

## 🙏 Credits

Data providers, libraries, methods and hosting are fully listed in [docs/CREDITS.md](docs/CREDITS.md).

---

<div align="center">

*Powered by open data from ESA Copernicus*

**[⭐ Star this repo](https://github.com/virahitvin8/seva-gis/stargazers) if SEVA.GIS helped you or someone you know**

</div>
