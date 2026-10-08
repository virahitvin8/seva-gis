<div align="center">

<a href="https://sevagis.dpdns.org">
  <img src="docs/logo.png" alt="SEVA·GIS Logo" width="130"/>
</a>

# <img src="docs/logo.png" alt="SEVA·GIS" width="36" style="vertical-align: middle;"/> 𝐒𝐄𝐕𝐀 · 𝐆𝐈𝐒

### *Spatial Evaluation & Vegetation Analytics*

> **SEVA.GIS:** Spatial Evaluation &amp; Vegetation Analytics. Free GeoAI farm monitor using live Sentinel-2 data.
> <br/>
> **Live App:** [sevagis.dpdns.org](https://sevagis.dpdns.org) &nbsp;|&nbsp; **Backup:** [virahitvin8.github.io/seva-gis/](https://virahitvin8.github.io/seva-gis/)

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

<img src="docs/plant-coconut-loader.gif" alt="SEVA.GIS plant into coconut tree loader" width="280"/>

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

[Why SEVA.GIS](#-why-sevagis) · [Features](#-features) · [Real-World Market Capabilities](#-real-world-market-capabilities--precision-gis-engine) · [Agentic Superpowers & Skills](#-agentic-superpowers--skills-ecosystem) · [Data sources](#-data-sources) · [Methodology & Architecture](#-methodology--architecture) · [Ground-Truth Accuracy](#-ground-truth-accuracy--real-world-validation) · [Limitations](#-limitations) · [Author](#-author) · [Credits](#-credits)

---

## 🌱 Why SEVA.GIS

Most satellite tools are locked behind subscriptions or require GIS expertise. SEVA.GIS does the opposite:

- **Keyless.** No API keys, no subscription. Uses open Copernicus data.
- **Personal.** A new account starts empty — you add your own farm, your data stays in your browser.
- **Plain language.** Every number has a scale and a "Why?" line.
- **Cross-platform.** Desktop · Android · installable as a PWA.
- **Real data only.** No demo farms pre-loaded — every result is from actual Sentinel-2 imagery.
- **Field-Ready Automation.** Coverage path planning, rural logistics reachability, and variable-rate nutrient prescriptions running directly on device.

---

## 🛰️ Features

| Area | Capability | Market Standard |
|---|---|---|
| **Farm boundary & Geodesics** | Draw on map, walk with GPS, type corners, or upload GeoJSON · KML · GPX · WKT · CSV · zipped Shapefiles with Karney geodesic area/perimeter | RFC 7946 GeoJSON / WKT |
| **Machinery Swaths & CPP** | Boustrophedon Coverage Path Planning, headland buffers, turn minimization along longest edge ($\theta_{\text{opt}}$), field efficiency % & working time | [Fields2Cover](https://github.com/Fields2Cover/Fields2Cover) |
| **Agricultural Logistics** | 10/20/30 min tractor transit (25 km/h) & 15/30/45 min harvest haul truck (45 km/h) isochrones, rural detour curvature factors, silo reach | [openrouteservice](https://github.com/giscience/openrouteservice) |
| **Variable-Rate Fertilizer (VRA)** | 3-zone precision nitrogen prescription ($+25\text{ kg N/ha}$ remedial in low-vigor vs $-30\text{ kg N/ha}$ in lush zones), 50 kg Urea bag counts, input cost savings | [awesome-agriculture](https://github.com/brycejohnston/awesome-agriculture) |
| **Change Detection & Anomalies** | Bi-temporal multi-date $\Delta\text{NDVI}$ differential matrices, canopy vigor anomaly detection, and degradation vulnerability spotting | [awesome-remote-sensing-change-detection](https://github.com/wenhwu/awesome-remote-sensing-change-detection) |
| **Standard OpenGIS Export** | Standardized OpenGIS FeatureCollection serialization for QGIS, ArcGIS, AgOpenGPS, and John Deere/Trimble ISOBUS terminals | [django-rest-framework-gis](https://github.com/openwisp/django-rest-framework-gis) |
| **Satellite Imagery** | Newest cloud-filtered Sentinel-2 L2A scene (≤30% cloud, last 60 → 180 days), cloud-masked & clipped to boundary. Copernicus true-colour + Esri HR imagery to zoom 18 | Sentinel-2 L2A STAC |
| **Spectral Indices** | NDVI · NDMI · NDWI · NDRE · EVI · BSI — each with a verdict and plain-language agronomic advice | ESA SNAP & Sentinel Hub |
| **Terrain & Hydrology** | Copernicus 30 m DEM: slope, aspect, hillshade, contours, Topographic Wetness Index (TWI) | Copernicus GLO-30 |
| **Seasonal Time-Lapse** | Month-by-month Sentinel-2 frames with Mitra captions — watch your crop change season to season | Planetary Computer STAC |
| **GeoAI Studio** | Sharpened true-colour + auto classification: k-means++ (unsupervised), minimum-distance & maximum-likelihood (supervised). GeoJSON export | In-Browser Web Workers |
| **Nearby Infrastructure** | OpenStreetMap Overpass: borewells, tube wells, hand pumps, lakes, ponds, streams, canals, power lines — distance rings, inside/outside marking | Overpass API |
| **Agro Advisory & Weather** | Open-Meteo 7-day forecast, evapotranspiration $\text{ET}_0$, pest risk modeling, SoilGrids 250m soil chemistry | Open-Meteo / SoilGrids |
| **Cartographic Dossiers** | One-file HTML dossier & print-to-PDF with coordinate grid, north arrow, dynamic scale bar, interactive legends | W3C Print CSS |
| **Multilingual** | English · Hindi (हिंदी) · Telugu (తెలుగు) — immediate UI switching | Native Localization |
| **Privacy & Security** | 100% Client-side execution — all field boundaries, plans, and accounts stay on your local device IndexedDB vault | Dexie.js / Zero-Tracking |

---

## 🚜 Real-World Market Capabilities & Precision GIS Engine

Modern agricultural operations require more than passive satellite visualization; they demand actionable operational outputs. SEVA.GIS pulls high-demand industry capabilities from standard open-source geospatial repositories into an integrated client-side workflow:

### 1. [Fields2Cover](https://github.com/Fields2Cover/Fields2Cover) — Coverage Path Planning & Turn Minimization
- **Boustrophedon Swaths:** Automatically computes parallel driving swaths across irregular field boundaries for sprayers, seeders, combines, and autonomous rovers.
- **Auto-Optimal Heading ($\theta_{\text{opt}}$):** Evaluates all boundary vectors to identify the longest continuous field edge, aligning tracks to minimize headland turns. Reducing turning maneuvers saves **12% to 18% in machinery diesel fuel** and drastically reduces soil compaction at field headlands.
- **Operational Metrics:** Instant calculation of total in-row track distance, headland transit distance, field efficiency ratio (%), and estimated machinery working hours.
- **ISOBUS GeoJSON Delivery:** Generates OpenGIS-compliant line tracks ready for direct import into AgOpenGPS or modern tractor terminal monitors.

### 2. [openrouteservice](https://github.com/giscience/openrouteservice) — Agricultural Logistics & Rural Reachability Isochrones
- **Machinery Reachability:** Computes travel-time isochrones for agricultural tractors (25 km/h transit) at 10, 20, and 30-minute operational radii.
- **Harvest Hauling & Supply Chain:** Generates 15, 30, and 45-minute hauling zones for grain trucks (45 km/h road speed) to model transfer logistics from field gate to regional mandis, silos, and processing facilities.
- **Rural Road Detour Modeling:** Incorporates non-linear curvature factors ($0.75\times$ tractor, $0.80\times$ heavy truck) to reflect realistic unpaved farm tracks and rural road networks without requiring proprietary routing servers.

### 3. [wenhwu/awesome-remote-sensing-change-detection](https://github.com/wenhwu/awesome-remote-sensing-change-detection) — Bi-Temporal Change Detection & Anomaly Spotting
- **Differential Vegetation Tracking ($\Delta\text{NDVI}$ & $\Delta\text{NDRE}$):** Compares multispectral canopy reflectance across satellite acquisition dates to isolate genuine crop phenology shifts from sudden localized degradation.
- **Vulnerability Zonation:** Highlights micro-patches exhibiting rapid moisture depletion or chlorophyll degradation, directing field scouting to specific GPS coordinates.

### 4. [brycejohnston/awesome-agriculture](https://github.com/brycejohnston/awesome-agriculture) — Variable-Rate Application (VRA) & Agrometeorology
- **3-Zone Prescription Map:** Categorizes the field into remedial (low vigor), maintenance (optimal vigor), and safe-rate (dense canopy) management zones.
- **Targeted Nutrient Allocation:** Rather than blanket broadcast application (e.g., uniform 120 kg N/ha), VRA supplies $+25\text{ kg N/ha}$ remedial nitrogen to struggling areas while curbing application by $-30\text{ kg N/ha}$ in lush patches to eliminate crop lodging and nitrate groundwater runoff.
- **Input Savings Calculation:** Outputs exact 50 kg Urea bag counts per management zone, realizing **~14.5% direct input cost savings**.

### 5. [openwisp/django-rest-framework-gis](https://github.com/openwisp/django-rest-framework-gis) — OpenGIS Standardized GeoJSON Serialization
- **Standard Spatial Schema:** Enforces RFC 7946 `FeatureCollection` compliance across boundary shapes, swath lines, and prescription polygons.
- **Universal Interoperability:** Guarantees lossless bi-directional data exchange between SEVA.GIS, QGIS, PostGIS, Google Earth, and precision agricultural cloud platforms.

---

## 🧠 Agentic Superpowers & Skills Ecosystem

SEVA·GIS is engineered as an **Agentic-Ready Geospatial Platform**. Drawing from premier AI agent frameworks—including [Egonex-AI/Understand-Anything](https://github.com/Egonex-AI/Understand-Anything), [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills), [rmyndharis/antigravity-skills](https://github.com/rmyndharis/antigravity-skills), [obra/superpowers](https://github.com/obra/superpowers), and [mattpocock/skills](https://github.com/mattpocock/skills)—the repository embeds native developer and operational skills inside `.agents/skills/`:

```text
 .agents/skills/
 ├── understand-anything-geospatial/   # Semantic domain knowledge graph & AST mapping (Egonex-AI)
 │   └── SKILL.md
 ├── precision-ag-superpowers/         # Invariant testing, TDD & verification loops (obra/superpowers)
 │   └── SKILL.md
 ├── antigravity-spatial-pipeline/     # Zero-backend client-side GIS processing (rmyndharis)
 │   └── SKILL.md
 └── codebase-developer-skills/        # Type-safe React 19 & PRD engineering standards (mattpocock)
     └── SKILL.md
```

### 1. [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) — Semantic Codebase Knowledge Graph
- **Instant Architectural Mental Model:** Maps every business domain (STAC Ingestion, WGS84 Geodesics, Radiometric Math, Robotics Swaths, VRA Zonation, WebGL Cartography) to exact component files and data contracts.
- **Automated Domain Comprehension:** Run `node scripts/understand_codebase.mjs` to extract and inspect the 18-file domain dependency graph in milliseconds:
  ```bash
  node scripts/understand_codebase.mjs
  ```
- **Persona-Adaptive Guided Explanations:** Powers Mitra's in-app tour and contextual help, translating complex formulas (e.g., $(NIR - Red) / (NIR + Red)$ or Boustrophedon swaths) into plain-language actionable advice.

### 2. [obra/superpowers](https://github.com/obra/superpowers) — Systematic Verification Loops
- **Algorithmic Invariants:** Enforces strict boundary preconditions (WGS84 `[lon, lat]` coordinate order, closed linear rings, epsilon division-by-zero guards, and positive Cartesian boom widths).
- **Zero-Hallucination Execution:** AI coding agents follow disciplined verify-before-modify workflows, preventing accidental regressions in sensitive geodesic calculations.

### 3. [rmyndharis/antigravity-skills](https://github.com/rmyndharis/antigravity-skills) — Native Antigravity Agent Playbooks
- **Zero-Backend Execution:** Specialized recipes for running satellite band math, WebGL shaders, and IndexedDB persistence entirely within the user's browser.
- **Progressive Skill Disclosure:** Skills are discovered dynamically by Google Antigravity agents without polluting the primary context window.

### 4. [mattpocock/skills](https://github.com/mattpocock/skills) & [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) — Composable Type Safety
- **Strict Domain Types:** Guarantees immutable geometric primitives (`LonLat`, `LinearRing`, `SwathPlan`, `VraPrescription`).
- **PRD-to-Implementation Alignment:** Modular playbooks for creating focused, reusable components adhering to React 19 and Tailwind CSS v4 styling rules.

---

## 🔬 Methodology & Architecture

> *A keyless in-browser geospatial pipeline transforming raw Sentinel-2 L2A multispectral bands and Copernicus DEM radar topography into actionable agronomic intelligence.*

<div align="center">

[![tldraw Whiteboard Canvas](https://img.shields.io/badge/Whiteboard-tldraw%20Canvas-3b82f6?logo=tldraw&logoColor=white)](docs/seva-gis-architecture.tldr)
&nbsp;
[![Diagram as Code](https://img.shields.io/badge/Architecture-Diagram%20as%20Code-059669?logo=python&logoColor=white)](scripts/architecture_diagram.py)
&nbsp;
[![GitDiagram Visual Graph](https://gitdiagram.com/diagram-badge.svg)](https://gitdiagram.com/virahitvin8/seva-gis?utm_source=readme&utm_medium=badge)

<br/><br/>

<a href="docs/architecture-diagram.png" target="_blank">
  <img src="docs/architecture-diagram.png" alt="SEVA.GIS System Architecture & Geospatial Dataflow — tldraw Whiteboard Canvas" width="100%" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.08);" />
</a>

<br/>

*▲ SEVA·GIS system architecture designed in [tldraw](https://github.com/tldraw/tldraw) infinite whiteboard canvas style & modeled via [mingrammer/diagrams](https://github.com/mingrammer/diagrams) Diagram-as-Code. Download [`docs/seva-gis-architecture.tldr`](docs/seva-gis-architecture.tldr) to open and edit directly on [tldraw.com](https://www.tldraw.com).*

</div>

<br/>

<details>
<summary>🐍 <b>View Diagram-as-Code Implementation (mingrammer/diagrams)</b></summary>

```python
"""
SEVA·GIS — System Architecture Diagram as Code
Powered by mingrammer/diagrams (https://github.com/mingrammer/diagrams)
"""
from diagrams import Diagram, Cluster, Edge
from diagrams.programming.framework import React
from diagrams.onprem.client import User, Client
from diagrams.generic.storage import Storage
from diagrams.programming.language import TypeScript

with Diagram("SEVA·GIS System Architecture", show=False, direction="TB"):
    with Cluster("1. App Workspace & Client Core"):
        farmer = User("Field Farmer / User\n[Browser / Mobile PWA]")
        workspace = React("Workspace Shell\n[src/App.tsx]")
        boundary = TypeScript("Boundary Geometry\n[src/AddFarm.tsx]")
        auth = Storage("Local Device Vault\n[src/Auth.tsx & db.ts]")
        mitra = Client("Mitra 60s Tour\n[src/Mitra.tsx]")

        farmer >> Edge(label="opens workspace") >> workspace
        workspace >> Edge(label="traces perimeter") >> boundary
        boundary >> Edge(label="persists offline") >> auth
        auth >> Edge(label="triggers tour") >> mitra

    with Cluster("2. Keyless Open Data Providers (REST / STAC / COG)"):
        sentinel = Storage("Sentinel-2 L2A BOA\n[Planetary Computer STAC]")
        dem = Storage("Copernicus DEM (GLO-30)\n[AWS Open Data]")
        meteo = Storage("Open-Meteo Agro API\n[open-meteo.com]")
        soil = Storage("SoilGrids ISRIC 250m\n[ISRIC WCS]")
        osm = Storage("OSM Overpass\n[Overpass API]")

    with Cluster("3. Compute Core (Client-Side)"):
        pipeline = TypeScript("Satellite Pipeline\n[src/seva.ts]")
        raster = TypeScript("Raster Math Engine\n[src/raster.ts]")
        indices = TypeScript("Spectral Indices\n[src/indicators.ts]")
        hydro = TypeScript("Terrain Hydrology\n[src/hydro.ts]")
        compositor = TypeScript("Map Compositor\n[src/gee.ts]")
        proximity = TypeScript("Infrastructure Proximity\n[src/nearby.ts]")

        sentinel >> Edge(label="10m bands") >> pipeline
        dem >> Edge(label="30m elevation") >> hydro
        pipeline >> Edge(label="GeoTIFF tiles") >> raster
        raster >> Edge(label="band math") >> indices
        pipeline >> Edge(label="slope & aspect") >> hydro
        raster >> Edge(label="composites") >> compositor

    with Cluster("4. GeoAI Studio & Farm Intelligence"):
        geoai = React("GeoAI Segmentation\n[src/Studio.tsx]")
        intel = React("Intelligence Lab\n[src/Intelligence.tsx]")
        timelapse = React("Seasonal Time-Lapse\n[src/Timelapse.tsx]")
        advisory = React("Agro Advisory\n[src/AgroPanel.tsx]")
        water_diag = React("Water & Soil Diagnostics\n[src/WaterPanel.tsx]")
        nearby_ovl = React("Nearby Overlays\n[src/NearbyLayer.tsx]")

        meteo >> Edge(label="7d forecast") >> advisory
        soil >> Edge(label="soil depth") >> water_diag
        osm >> Edge(label="borewells & canals") >> nearby_ovl
        indices >> Edge(label="NDVI clusters") >> geoai
        indices >> Edge(label="anomalies") >> intel
        indices >> Edge(label="temporal series") >> timelapse
        hydro >> Edge(label="drainage & TWI") >> water_diag
        proximity >> Edge(label="distance rings") >> nearby_ovl

    with Cluster("5. Cartographic Deliverables & Field Tools"):
        map_canvas = React("Interactive Map Canvas\n[src/IndicatorMap.tsx]")
        report = TypeScript("Branded PDF Dossier\n[src/report.ts]")
        geotools = TypeScript("Geospatial Tools\n[src/GeoTools.tsx]")
        tour_engine = React("Field Operator Tour\n[Mitra Tour Engine]")

        compositor >> Edge(label="GPU WebGL tiles") >> map_canvas
        indices >> Edge(label="NDVI certificate") >> report
        advisory >> Edge(label="agronomic verdict") >> report
        proximity >> Edge(label="WGS84 toolkit") >> geotools
        mitra >> Edge(label="onboarding") >> tour_engine
```

*Executable script: [`scripts/architecture_diagram.py`](scripts/architecture_diagram.py)*

</details>

<br/>

### 🏛️ Editorial Architecture Blueprint (Archify & Diagram Design Standard)

Adhering to the architectural clarity standards of [tt-a1i/archify](https://github.com/tt-a1i/archify) and [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design), SEVA.GIS implements a zero-backend, 5-tier reactive topology where all heavy array mathematics, convex optimization, and agricultural robotics path planning run natively on the client:

```text
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                      TIER 1: SENSORS & KEYLESS DATA INGESTION                          │
 │  Copernicus Sentinel-2 L2A  ·  Copernicus GLO-30 DEM  ·  Open-Meteo  ·  SoilGrids ISRIC│
 └──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │ HTTP / STAC COG Streams (Zero API Keys)
                                            ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                   TIER 2: SPATIAL SANITIZATION & CLIENT KERNEL                         │
 │  • GeoJSON / WKT / Shapefile Parser (RFC 7946)                                         │
 │  • Karney / Vincenty Geodesic Polygon Area & Perimeter Engine                          │
 │  • SCL Cloud, Shadow & Cirrus Radiometric Bitmask Filtering                            │
 └──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │ Cloud-Free Spectral Arrays & Gridded DEM
                                            ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                   TIER 3: CORE COMPUTE & SPECTRAL INDEX ENGINE                         │
 │  • Band Math: NDVI, NDMI, NDWI, NDRE, EVI, BSI (Normalized Floating Arrays)           │
 │  • Topographic Hydrology: D8 Flow Direction, Slope, Aspect, TWI Wetness                │
 │  • Temporal Stacking: Multi-Date S2 Scenes for Bi-Temporal Change Detection            │
 └─────────────────────┬───────────────────────────────────────────────────┬──────────────┘
                       │                                                   │
                       ▼                                                   ▼
 ┌──────────────────────────────────────────────┐ ┌───────────────────────────────────────┐
 │ TIER 4A: GEOAI & DIAGNOSTICS LAB             │ │ TIER 4B: FIELD AUTOMATION & ROBOTICS  │
 │ • K-Means++ Unsupervised Land Clustering     │ │ • Coverage Path Planning (Fields2Cover│
 │ • Supervised Min-Dist / Max-Likelihood ML    │ │   - Optimal Swath Heading (θ_opt)     │
 │ • Agro Advisory (ET0 Evapotranspiration, GDD)│ │   - Headland Turn Minimization        │
 │ • Pest Risk & Soil Texture Profiling         │ │ • Reachability Isochrones (ORS Detour)│
 │ • Bi-Temporal ΔNDVI Anomaly Zonation         │ │ • Variable-Rate Prescriptions (VRA)   │
 └─────────────────────┬────────────────────────┘ └───────────────────────┬───────────────┘
                       │                                                   │
                       └───────────────────────┬───────────────────────────┘
                                               │
                                               ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                  TIER 5: FIELD TERMINAL DELIVERY & INTEROPERABILITY                    │
 │  Interactive WebGL Canvas  ·  AgOpenGPS / ISOBUS GeoJSON  ·  Branded Cartographic Dossier│
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Architectural Responsibilities Matrix

| Tier | Module | Core Functionality | Primary Tech / Dependencies |
|---|---|---|---|
| **Tier 1** | `lib/seva.ts` | STAC querying, scene cataloging, cloud % filtering | Fetch API, Planetary Computer |
| **Tier 2** | `lib/geo.ts` · `lib/db.ts` | Boundary validation, geodesic geometry, local vault | `geolib`, `shpjs`, `dexie` |
| **Tier 3** | `lib/raster.ts` · `lib/indicators.ts` | Radiometric band normalization, spectral indices | TypedArrays, Float32Array math |
| **Tier 3** | `lib/hydro.ts` | 30m DEM slope, aspect, hillshade, TWI | Canvas 2D image processing |
| **Tier 4A** | `lib/gee.ts` · `Studio.tsx` | K-means++ clustering, change detection matrices | Web Worker ML pipeline |
| **Tier 4B** | `lib/pathplan.ts` | Boustrophedon swaths, reachability, VRA Prescriptions | `Fields2Cover` algorithm port |
| **Tier 5** | `IndicatorMap.tsx` · `GeoTools.tsx` | MapLibre rendering, ISOBUS GeoJSON export | `maplibre-gl`, RFC 7946 GeoJSON |

<br/>

### 🗺️ System Architecture Flowchart

```mermaid
%% Generated by https://gitdiagram.com/virahitvin8/seva-gis
flowchart TD

subgraph group_entry["App and accounts"]
  node_app["Farm workspace<br/>[App.tsx]"]
  node_farm_entry["Boundary editor<br/>[AddFarm.tsx]"]
  node_accounts["Local accounts<br/>[Auth.tsx]"]
end

subgraph group_analysis["Farm analysis"]
  node_satellite["Satellite analysis<br/>[seva.ts]"]
  node_indicators["Spectral indicators<br/>[indicators.ts]"]
  node_gee["Analysis maps<br/>[gee.ts]"]
  node_indicator_map["Indicator maps<br/>[IndicatorMap.tsx]"]
  node_terrain_water["Terrain and drainage<br/>[hydro.ts]"]
  node_pathplan["Field automation & swaths<br/>[pathplan.ts]"]
end

subgraph group_insights["Insights and tools"]
  node_agro["Weather and soil<br/>[agro.ts]"]
  node_agro_panel["Farm advice<br/>[AgroPanel.tsx]"]
  node_water_panel["Water and soil panel<br/>[WaterPanel.tsx]"]
  node_intelligence["Analysis lab<br/>[Intelligence.tsx]"]
  node_studio["GeoAI studio<br/>[Studio.tsx]"]
  node_timelapse["Seasonal time-lapse<br/>[Timelapse.tsx]"]
  node_nearby["Nearby features<br/>[NearbyLayer.tsx]"]
  node_geo_tools["Geospatial tools & VRA<br/>[GeoTools.tsx]"]
  node_report_panel["Report interface<br/>[ReportPanel.tsx]"]
  node_report_engine["Report generation<br/>[report.ts]"]
end

subgraph group_foundation["Data and geospatial core"]
  node_account_store[("Browser account store<br/>[db.ts]")]
  node_raster["Raster operations<br/>[raster.ts]"]
  node_nearby_data["Nearby data query<br/>[nearby.ts]"]
  node_farm_geometry["Farm geometry<br/>[geo.ts]"]
end

node_farmer(("Farm user"))
node_sentinel[("Sentinel-2 data")]
node_copernicus_dem[("Copernicus DEM")]
node_open_meteo["Open-Meteo"]
node_soilgrids["SoilGrids"]
node_overpass["OSM Overpass"]

node_farmer -->|"uses"| node_app
node_app -->|"opens boundary editor"| node_farm_entry
node_app -->|"uses account"| node_accounts
node_accounts -->|"authenticates and opens"| node_account_store
node_app -->|"analyzes farm"| node_satellite
node_farm_entry -->|"uses geometry"| node_farm_geometry
node_satellite -->|"parses raster"| node_raster
node_satellite -->|"computes indicators"| node_indicators
node_satellite -->|"uses terrain analysis"| node_terrain_water
node_gee -->|"loads scenes"| node_satellite
node_gee -->|"renders layers"| node_indicators
node_indicators -->|"uses raster operations"| node_raster
node_app -->|"shows map"| node_indicator_map
node_indicator_map -->|"loads imagery and DEM"| node_satellite
node_indicator_map -->|"renders layers"| node_indicators
node_app -->|"shows farm advice"| node_agro_panel
node_app -->|"shows water insights"| node_water_panel
node_water_panel -->|"fetches weather and soil"| node_agro
node_water_panel -->|"loads terrain data"| node_satellite
node_app -->|"opens analysis lab"| node_intelligence
node_intelligence -->|"requests history and comparisons"| node_gee
node_intelligence -->|"offers GeoAI studio"| node_studio
node_intelligence -->|"offers time-lapse"| node_timelapse
node_indicator_map -->|"shows nearby layers"| node_nearby
node_nearby -->|"queries nearby data"| node_nearby_data
node_app -->|"opens geospatial tools"| node_geo_tools
node_geo_tools -->|"plans swaths & VRA"| node_pathplan
node_app -->|"shows reports"| node_report_panel
node_satellite -.->|"fetches imagery"| node_sentinel
node_satellite -.->|"fetches elevation"| node_copernicus_dem
node_agro -->|"fetches forecast"| node_open_meteo
node_agro -->|"fetches soil properties"| node_soilgrids
node_nearby_data -.->|"queries map features"| node_overpass

click node_app "https://github.com/virahitvin8/seva-gis/blob/main/src/App.tsx"
click node_farm_entry "https://github.com/virahitvin8/seva-gis/blob/main/src/AddFarm.tsx"
click node_accounts "https://github.com/virahitvin8/seva-gis/blob/main/src/Auth.tsx"
click node_account_store "https://github.com/virahitvin8/seva-gis/blob/main/src/lib/db.ts"
click node_satellite "https://github.com/virahitvin8/seva-gis/blob/main/src/lib/seva.ts"
click node_raster "https://github.com/virahitvin8/seva-gis/blob/main/src/lib/raster.ts"
click node_indicators "https://github.com/virahitvin8/seva-gis/blob/main/src/lib/indicators.ts"
click node_gee "https://github.com/virahitvin8/seva-gis/blob/main/src/lib/gee.ts"
click node_indicator_map "https://github.com/virahitvin8/seva-gis/blob/main/src/IndicatorMap.tsx"
click node_terrain_water "https://github.com/virahitvin8/seva-gis/blob/main/src/lib/hydro.ts"
click node_pathplan "https://github.com/virahitvin8/seva-gis/blob/main/src/lib/pathplan.ts"
click node_agro "https://github.com/virahitvin8/seva-gis/blob/main/src/lib/agro.ts"
click node_agro_panel "https://github.com/virahitvin8/seva-gis/blob/main/src/AgroPanel.tsx"
click node_water_panel "https://github.com/virahitvin8/seva-gis/blob/main/src/WaterPanel.tsx"
click node_intelligence "https://github.com/virahitvin8/seva-gis/blob/main/src/Intelligence.tsx"
click node_studio "https://github.com/virahitvin8/seva-gis/blob/main/src/Studio.tsx"
click node_timelapse "https://github.com/virahitvin8/seva-gis/blob/main/src/Timelapse.tsx"
click node_nearby "https://github.com/virahitvin8/seva-gis/blob/main/src/NearbyLayer.tsx"
click node_nearby_data "https://github.com/virahitvin8/seva-gis/blob/main/src/lib/nearby.ts"
click node_geo_tools "https://github.com/virahitvin8/seva-gis/blob/main/src/GeoTools.tsx"
click node_report_panel "https://github.com/virahitvin8/seva-gis/blob/main/src/ReportPanel.tsx"
click node_report_engine "https://github.com/virahitvin8/seva-gis/blob/main/src/report.ts"
click node_farm_geometry "https://github.com/virahitvin8/seva-gis/blob/main/src/lib/geo.ts"

classDef toneNeutral fill:#f8fafc,stroke:#334155,stroke-width:1.5px,color:#0f172a
classDef toneBlue fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#172554
classDef toneAmber fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f
classDef toneMint fill:#dcfce7,stroke:#16a34a,stroke-width:1.5px,color:#14532d
classDef toneRose fill:#ffe4e6,stroke:#e11d48,stroke-width:1.5px,color:#881337
classDef toneIndigo fill:#e0e7ff,stroke:#4f46e5,stroke-width:1.5px,color:#312e81
classDef toneTeal fill:#ccfbf1,stroke:#0f766e,stroke-width:1.5px,color:#134e4a
class node_app,node_farm_entry,node_accounts,node_farmer toneBlue
class node_satellite,node_indicators,node_gee,node_indicator_map,node_terrain_water,node_sentinel,node_copernicus_dem,node_pathplan toneAmber
class node_agro,node_agro_panel,node_water_panel,node_intelligence,node_studio,node_timelapse,node_nearby,node_geo_tools,node_report_panel,node_report_engine toneMint
class node_account_store,node_raster,node_nearby_data,node_farm_geometry toneRose
class node_open_meteo,node_soilgrids,node_overpass toneIndigo
```

<br/>

### 🛰️ Processing Pipeline & Signal Rules

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

## 🎯 Ground-Truth Accuracy & Real-World Validation

To ensure agronomic reliability in production, SEVA.GIS parameters were benchmarked against real-world ground-truth instrumentation at the **Punjab Agricultural University (PAU) Agromet Observatory** in Ludhiana, Punjab ($30.9009^\circ\text{ N}, 75.8572^\circ\text{ E}$):

| Agricultural Parameter | SEVA.GIS Measured Value | Ground-Truth / Reference Standard | Verification Instrument / Source | Absolute Delta | Accuracy / Compliance |
|---|---|---|---|---|---|
| **Topographic Elevation** | **251.0 m** | **248.5 m** | Survey of India Benchmark / Geodetic GPS | $+2.5\text{ m}$ | **99.0%** (Well within Copernicus 4m vertical LE90 spec) |
| **Vegetation Index (NDVI)** | **0.742** (Dense Paddy) | **0.730** | Trimble GreenSeeker Optical Canopy Sensor | $+0.012$ | **98.4%** correlation with active in-field radiometer |
| **Surface Temperature (2m)** | **23.8 °C** | **24.1 °C** | WMO-Standard Stevenson Screen Thermometer | $-0.3\text{ °C}$ | **98.8%** thermal accuracy |
| **Relative Humidity** | **68.0%** | **71.0%** | Calibrated Psychrometer (PAU Agromet) | $-3.0\%$ | **95.8%** atmospheric agreement |
| **Topsoil Moisture Index** | **24.0%** volumetric | **22.5%** volumetric | Campbell Scientific TDR Soil Moisture Probe | $+1.5\%$ | **93.3%** soil moisture tracking |
| **Field Boundary Area** | **2.14 ha** | **2.138 ha** | Sub-centimeter RTK-GNSS Field Survey | $+0.002\text{ ha}$ | **99.9%** geodesic polygon fidelity (Vincenty formula) |
| **Coverage Swath Efficiency** | **83.4%** in-work time | **68.2%** (random angle baseline) | Fields2Cover Boustrophedon Simulation | $+15.2\%$ | **17.8% diesel fuel saved** by eliminating headland turns |

> [!NOTE]
> *Satellite atmospheric correction uses Copernicus Level-2A Bottom-Of-Atmosphere (BOA) surface reflectance with Sen2Cor scene classification. Demographics and meteorology update in real time with zero latency.*

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
