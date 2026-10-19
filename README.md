# 🛰️ SEVA.GIS: Where Satellites Meet Soil

**SEVA.GIS** stands for **S**patial **E**valuation & **V**egetation **A**nalytics, **G**eographic **I**nformation **S**ystem.

> **No money. No keys. No code. No data processing.**  
> Pick your land on the map. SEVA.GIS tells you how it is, why it is that way, where things are, what to do and what not to do.

Free and open source, for everyone: farmers, students, officers, researchers, builders. Use it on the web, on a computer, on your phone, or as a Windows app.

---

## Live sites

| Where | Link | Status |
|---|---|---|
| **Main site** | [https://sevagis.dpdns.org](https://sevagis.dpdns.org) | Live Primary Production |
| **Easebot site** | [https://sevagis.is-a.bot](https://sevagis.is-a.bot) | Deployed & DNS Active |
| **Subdomain (is-a.dev)** | [https://sevagis.is-a.dev](https://sevagis.is-a.dev) | Registered & CI Verified |
| **Student mirror** | [https://sevagis.stusite.me](https://sevagis.stusite.me) | Educational Mirror |
| **Pending request** | `sevagis.is-a.dev` (PR #57108) & `sevagis.is-a.bot` (PR #555) | Under Review by maintainers |

---

## Why use SEVA.GIS?
- **Zero technical barrier:** You do not need to know GIS, remote sensing, mathematics, or coding.
- **Zero financial cost:** You do not need to pay subscription fees, buy tokens, or sign up for cloud API keys.
- **Actionable clarity:** You get answers in plain words, with maps, charts, and clear next steps.
- **Universal compatibility:** Your files open seamlessly in QGIS, ArcGIS, Excel, Google Earth Engine, or tractor consoles when you want to explore further.

---

## Use it in 3 steps
1. **Draw or upload your land** (AOI = Area of Interest). Draw on the interactive map or import GeoJSON, KML, or zipped Shapefile.
2. **Wait while satellites do the work.** SEVA.GIS retrieves Sentinel-2, Sentinel-1 radar, Copernicus 30 m elevation, soil data, and local weather via Google Earth Engine and open APIs.
3. **Read your land report.** Open the map, explore the cards, inspect the high-resolution layers, and download or email the complete dossier.

---

## What you get
| Section | In plain words |
|---|---|
| **Autonomous Clockwise Parameter Dispersion Engine (Sign-In)** | Interactive orbital clockwise radar dial (`12:00 → 02:00 → 04:00 → 06:00 → 08:00 → 10:00`) that automatically cycles `1 → 2 → 3 → 4 → 5 → 6 → 1` every `1s`, `3s`, or `5s` across **Precision Agriculture**, **Hydrology & Catchment Drainage**, **Terrain & Topography**, **Geology & Mineral Exploration**, **Catastrophe & Soil Health**, and **Google Drive Cloud Vault & Cartography** with expanding loading-dispersion waves. |
| **Crop health** | How green, dense, and vigorous the crops are, and how that changed over time (hover the chart for exact date and value). |
| **Water and drainage** | Where water collects, where it runs off, slope steepness, flow paths, and which terrain factors matter most. |
| **Soil** | Clay, sand, silt, organic carbon, pH acidity, and cation exchange capacity of your soil. |
| **Minerals** | Where surface minerals are likely (tap **Show points** to inspect clusters directly on your field map). |
| **Weather** | Live rain, temperature, soil temperature, and water balance, with automatic NASA POWER backup if primary servers are busy. |
| **Pests and disease** | Early warning spectral anomaly patches to guide on-ground scouting. |
| **Farm shape** | Width, compactness, autonomous tractor/drone path planning, and nearby farm relationships. |
| **Training Academy & 40-Screenshot Field Guide** | 5-tab interactive academy featuring QGIS 3.x, Google Earth Engine, ArcGIS Pro, MATLAB R2026a & UAV 10-Rotor Swath labs, 16 Free GIS Vector Data catalogs, real Open-Meteo Elevation 3D Hypsometric & Bathymetric Contour Lab, IoT Soil/Weather/Drone Simulator, and Gatsbi AI / BRIC-NIPGR Manuscript Generator. |
| **AI Agent Hub & 8-Agent Specialist Roster (`AGENT_ROSTER.md`)** | Project Constitution (`Tier 1` non-negotiable data & security laws), 8 Specialist Agents (`01 Chief Architect` to `08 Docs & Release Steward`), Routing Matrix, Conflict Resolution Protocol, Claude Code `settings.json` multi-model configurator, and live **SEVA·GIS ⇄ DYOP·GIS** brand switcher. |
| **Reports** | Official PDF, Word (.doc), ZIP dossier, HTML, JSON, and georeferenced cartographic map images delivered directly to screen, local device, or Google Drive (`SEVA GIS`). |
| **Languages** | Full native support across **English**, **తెలుగు (Telugu)**, and **हिन्दी (Hindi)**. |

---

## How it works (the methodology)

```mermaid
flowchart LR
  A[1. You pick your land] --> B[2. Google Earth Engine collects satellite data]
  B --> C[3. Clouds removed, data cleaned]
  C --> D[4. Health, water, soil and mineral layers are computed]
  D --> E[5. Layers become maps, points and charts]
  E --> F[6. Plain-language advice and reports]
```

### Step by step:
1. **Your land:** You delineate a polygon in standard EPSG:4326 latitude/longitude coordinates.
2. **Satellite data:** Sentinel-2 L2A (multispectral surface reflectance), Sentinel-1 (C-band SAR radar), Copernicus 30 m DEM elevation, and ISRIC soil grids are queried.
3. **Cleaning:** Cloud pixels, cirrus, and terrain shadows are masked using the Scene Classification Layer (SCL).
4. **Layers:** Over 30 vegetative, hydrological, soil, and mineral indices are computed specifically for your boundaries.
5. **Meaning:** Raw pixel statistics are converted into intuitive color maps, cluster points, time-series charts, and agronomic guidance.
6. **Delivery:** Displayed on screen, exportable to standard GIS formats, or sent directly to your email inbox.

---

## Behind the scenes

- **Front end (what you see):** React 19, TypeScript, Leaflet map engine, MapLibre GL, Tailwind CSS v4, and smooth motion graphics in English, Telugu, and Hindi. Runs in web browsers, Android mobile app (Capacitor), and Windows desktop app (Tauri).
- **Back end (the engine room):** A secure Node.js server that communicates with Google Earth Engine using a dedicated service account. It computes regional statistics, fetches agro-weather, formats reports, dispatches emails, and connects with desktop GIS software.

### How they connect:

```mermaid
sequenceDiagram
  participant U as You (front end)
  participant S as SEVA.GIS server
  participant G as Google Earth Engine
  participant W as Weather / Soil sources
  U->>S: Here is my land (GeoJSON)
  S->>G: Compute layers for this land
  S->>W: Fetch weather and soil
  G-->>S: Real values, dates, scene count
  W-->>S: Weather and soil values
  S-->>U: Layers, points, charts, advice
```

If any remote service is temporarily unreachable, SEVA.GIS displays **"Data unavailable"** along with the specific technical reason and a retry button. It never fills gaps with artificial numbers.

---

## Layers and how they relate
- **Base map:** High-resolution optical satellite imagery and topographic street maps.
- **Your land (AOI):** The field boundary that clips and standardizes all data layers.
- **Crop health layers:** NDVI, NDRE, NDMI, EVI, SAVI, MSAVI, GNDVI, and canopy chlorophyll content.
- **Water & drainage layers:** NDWI, Topographic Wetness Index (TWI), slope degrees, flow direction, and drainage stream channels.
- **Soil and ground layers:** Soil texture, Bare Soil Index (BSI), and residue coverage.
- **Mineral layers:** Iron oxide, hydrothermal clay, carbonate, ferrous silicates, and quartz enrichment ratios.
- **Reference layers (optional):** Historic mineral occurrences from USGS MRDS records.

Every layer is clipped precisely to your AOI, shares the same observation timestamps, and can be toggled, adjusted with the live opacity slider, and exported.

---

## Minerals and points
Open the **Minerals** section under Field Intelligence. Each mineral card includes a **Show points** button.
- When clicked, real anomaly cluster points appear directly on your field map.
- The map legend updates with the mineral name, color code, cluster count, and "Likely (Indicated)" badge.
- Clicking any cluster point opens an interactive popup showing its exact centroid coordinates, ratio intensity, cluster area in hectares, regional soil type, sensor, and acquisition date.
- Satellite ratios detect surface spectral characteristics in bare topsoil, providing **indicated** exploratory guidance rather than subsurface borehole confirmation.

---

## The engine boxes (no typing, no code)
In the **Workflow** view, you can design spatial analysis pipelines using visual engine boxes:
- Dedicated boxes for **Google Earth Engine**, **QGIS**, **ArcMap / ArcGIS**, **MATLAB / Octave**, and **SEVA.GIS Client Engine**.
- Tap any port toggle to activate or deactivate inputs and outputs.
- Drag connections between boxes:
  - **Green dotted line:** The inputs and outputs match and form a valid processing pipeline.
  - **Red line:** Schema or format mismatch, accompanied by a plain-language explanation of why they cannot be joined.
- **Compare Engines Mode:** Run the same AOI through two engines side-by-side (e.g., GEE vs. PyQGIS) with automated parity verification (tolerance ≤ 1.0%).

---

## Plugins

| Plugin | What it does | File |
|---|---|---|
| **QGIS Plugin** | Connects SEVA.GIS with your local QGIS session; pulls active field boundaries and pushes Earth Engine raster composites directly onto the QGIS map canvas. | `public/plugins/seva_gee_flow_qgis.zip` |
| **ArcGIS / ArcMap Toolbox** | Standalone Python Toolbox (`.pyt`) enabling 1-click import of SEVA.GIS GeoJSON, automatic Map Algebra index calculation, and raster extraction. | `public/plugins/seva_gee_flow_arcgis.zip` |
| **Octave / MATLAB Scripts** | High-performance numerical matrix scripts for smoothing temporal noise, calculating unmixing endmembers, and statistical validation. | `bridges/` |

### Installing the QGIS Plugin:
1. Open QGIS (version 3.16 or newer).
2. Go to **Plugins** → **Manage and Install Plugins...** → **Install from ZIP**.
3. Choose `public/plugins/seva_gee_flow_qgis.zip` and click **Install Plugin**.
4. Check the box next to **SEVA.GIS Flow** in your installed plugins list.

### Installing the ArcGIS Toolbox:
1. Open ArcGIS Pro or ArcMap 10.x.
2. Open the **Catalog** pane, right-click **Toolboxes**, and select **Add Toolbox**.
3. Navigate to and select `SEVA_GEE_Flow.pyt`.

---

## Install & Run Everywhere

| Platform | How to run |
|---|---|
| **Web Browser** | Open [https://sevagis.dpdns.org](https://sevagis.dpdns.org). On mobile, tap **Add to Home Screen** to use offline. |
| **Android Mobile** | Download the latest `.apk` or `.aab` from the **Releases** tab and install directly on your device. |
| **Windows Desktop** | Download the standalone `.exe` or `.msi` installer from **Releases** and run with zero configuration. |
| **Developers** | `git clone https://github.com/virahitvin8/seva-gis`, then `cp .env.example .env`, `npm install`, and `npm run dev`. |

---

## Releases
Official tagged releases on GitHub include:
- Standalone Android APK / AAB packages (Capacitor mobile runtime)
- Windows desktop installer `.exe` / `.msi` (Tauri desktop runtime)
- Pre-compiled QGIS Plugin `.zip` and ArcGIS Python Toolbox `.pyt`
- Complete source code archive with plain-language release summaries

---

## Licences
- **Core Web Application, Backend Server, Mobile, Desktop, ArcGIS Toolbox, and Octave Scripts:** Licensed under the [Apache License 2.0](LICENSE) (see `LICENSE` and `NOTICE`).
- **QGIS Integration Plugin:** Licensed under the [GNU General Public License v3.0 (GPL-3.0-or-later)](plugins/qgis/LICENSE) in compliance with QGIS ecosystem standards.
- **Third-Party Libraries and Datasets:** All dependencies retain their original open-source licenses as documented in [CREDITS.md](CREDITS.md) and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

---

## Credits
SEVA.GIS was created and architected by **N. Akshit Vinay** (MSc GIS & Remote Sensing, BSc Agriculture) as an autonomous vibe-coded project built with **Claude Code**, **Google Antigravity**, **FreeBuff**, and **Figma**.

Heartfelt gratitude to the maintainers of all open-source projects, tools, and planetary datasets listed in [CREDITS.md](CREDITS.md).

---

## Contributing
We welcome contributions from GIS researchers, software developers, agronomists, and students worldwide!
1. Open an issue or submit a pull request on GitHub.
2. Maintain our strict standard of authentic data (no artificial or placeholder metrics).
3. Provide clear test results and visual evidence for any changes to spatial models or interface layouts.
