<div align="center">

<h1>
  <img src="public/logo.png" alt="SEVA·GIS Logo" width="48" style="vertical-align: middle; margin-right: 12px;" />
  SEVA·GIS: Spatial Evaluation & Vegetation Analytics
</h1>

### One unified, zero-telemetry GeoAI platform for precision remote sensing, land parcel intelligence, and planetary cartography.

**Empowering land stewards, agronomists, hydrologists, and geospatial researchers with publication-grade Earth intelligence.**

[![Live Web App](https://img.shields.io/badge/Production-sevagis.dpdns.org-2f8f4e?style=flat-square&logo=googlechrome&logoColor=white)](https://sevagis.dpdns.org)
[![Firebase CDN](https://img.shields.io/badge/Mirror-Firebase_CDN-ffca28?style=flat-square&logo=firebase&logoColor=black)](https://seva-gis-backend-e724a.web.app)
[![Cloud Run Backend](https://img.shields.io/badge/Google_Cloud_Run-FastAPI_v2-4285f4?style=flat-square&logo=googlecloud&logoColor=white)](https://seva-gis-backend-419602015618.us-central1.run.app/api/docs)
[![Copernicus Sentinel-2](https://img.shields.io/badge/Copernicus-Sentinel--2_L2A-e05d44?style=flat-square&logo=esa&logoColor=white)](https://dataspace.copernicus.eu/)
[![Copernicus DEM](https://img.shields.io/badge/Elevation-GLO--30_DEM-009688?style=flat-square)](https://spacedata.copernicus.eu/)
[![React 19](https://img.shields.io/badge/React-v19.0-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.0-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald?style=flat-square)](LICENSE)

<br />

**[Production App](https://sevagis.dpdns.org)** · **[Firebase Mirror](https://seva-gis-backend-e724a.web.app)** · **[Backend API Docs](https://seva-gis-backend-419602015618.us-central1.run.app/api/docs)**

[What You Can Analyze](#what-you-can-analyze) · [The Precision Correction Suite](#the-precision-correction-suite) · [Architecture & How SEVA·GIS Works](#architecture--how-sevagis-works) · [Git Repositories](#git-repositories) · [Vibe Coding & Agentic Engineering](#vibe-coding--agentic-engineering) · [Credits & QGIS Inspirations](#credits--qgis-inspirations) · [Live Testing Links](#live-testing-links)

<br />

<img src="docs/portal_preview.png" alt="SEVA·GIS Precision Agriculture Interactive GIS Terminal" width="1200" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.25);" />

<br /><br />

<table aria-label="SEVA GIS Community">
<tr>
<td align="center" width="460">
  <a href="https://sevagis.dpdns.org">
    <img src="public/logo.png" height="42" alt="SEVA GIS" /><br />
    <strong>Earth Intelligence in the Spirit of Selfless Service</strong>
  </a><br />
  <sub>Open-Source · Keyless · Zero-Telemetry · Client-Side GeoAI</sub>
</td>
</tr>
</table>

<br />

</div>

---

## What is SEVA·GIS?

**SEVA·GIS** (**S**patial **E**valuation & **V**egetation **A**nalytics) is an open-source, publication-grade geospatial intelligence and spatial analytics platform. Engineered with a strict client-side, zero-telemetry philosophy, SEVA·GIS empowers smallholder farmers, agronomists, remote sensing scientists, and land stewards to assess agricultural parcels and study areas anywhere on Earth with sub-meter geometric clarity, calibrated satellite spectral indices, 3D terrain cartography, and hydrological modeling.

Unlike proprietary software suites that lock users into closed ecosystems and harvest private field data, SEVA·GIS processes rasters locally in the browser using the Origin Private File System (OPFS), WebGL, and direct Google Earth Engine APIs with zero personal tracking.

---

## What You Can Analyze

| Domain & Feature | Input Data Sources | Analytical Outputs & Physical Metrics |
| :--- | :--- | :--- |
| **Vegetation Health & Vigor** | Sentinel-2 L2A BOA (10m) | Calibrated NDVI, EVI, GNDVI, and VARI intra-field canopy distribution. |
| **Canopy Nitrogen & Chlorophyll** | Sharpened Red-Edge (B5, B7, B8A) | NDRE, CIre, and REIP non-saturating dense canopy nitrogen metrics. |
| **Moisture & Water Stress** | SWIR-1 (B11), SWIR-2 (B12), NIR | NDMI and NDWI canopy equivalent water thickness and drought stress. |
| **Soil & Emergence Decoupling** | VNIR + SWIR Bands | SAVI, OSAVI, MSAVI2, and BSI eliminating bare soil spectral interference. |
| **3D Topography & Hydrology** | Copernicus GLO-30 DEM (30m) | Slope, aspect, hillshade, TWI, flow accumulation, and SCS-CN runoff volume. |
| **All-Weather Cloud Penetration** | Sentinel-1 SAR GRD C-Band | Microwave dual-pol (VV, VH) backscatter and VH-VV dB volume scattering proxy. |
| **Machinery Navigation & Robotics** | Polygon Boundary & Obstacles | Optimal swath tracks, minimum headland loops, and compaction lanes. |
| **Input Optimization** | Multi-Spectral Management Zones | Calibrated multi-zone nitrogen and nutrient application boundaries. |

---

## The Precision Correction Suite

To bridge the gap between raw 10m/20m satellite observations and ultra-high-resolution aerial or field-grade survey accuracy, SEVA·GIS applies a comprehensive 10-stage correction pipeline in [seva_corrected_pipeline.js](seva_corrected_pipeline.js).

### ArchiFi Flow: Precision Radiometric & Geometric Correction Engine

```mermaid
flowchart TD
    classDef input fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef step fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#ecfdf5;
    classDef output fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#f8fafc;

    RAW[Raw Sentinel-2 L2A 10m/20m + Copernicus DEM + Sentinel-1 SAR]:::input

    RAW --> S1[1. Cloud & Shadow Decontamination\nCloud Score+ cs_cdf >= 0.60 + ESA SCL 4-7 + 20m Dilation]:::step
    S1 --> S2[2. Sub-Pixel Co-Registration Tracking\n2D NIR cross-correlation displacement dx, dy vs temporal baseline]:::step
    S2 --> S3[3. Super-Resolution Sharpening\n20m Red-Edge / SWIR -> 10m via VNIR multilinear bases]:::step
    S3 --> S4[4. Topographic Sun-Canopy Normalization\nSCS+C illumination correction via Copernicus 30m DEM]:::step
    S4 --> S5[5. Boundary Inward Core Erosion\n-10m inner-field buffer excluding perimeter mixed pixels]:::step
    S5 --> S6[6. Phenological Bi-Temporal Interpolation\nInverse harmonic time-weighting between clean satellite passes]:::step
    S6 --> S7[7. All-Weather Radar Cross-Sensor Fusion\nSentinel-1 C-Band dual-pol VH-VV dB canopy volume fallback]:::step
    S7 --> S8[8. Full-Spectrum Agronomic Indices\nNDVI, NDRE, EVI, OSAVI, MSAVI2, NDMI, BSI, REIP, CIre]:::step
    S8 --> S9[9. Spatial Autocorrelation Error Correction\nMoran's I degrees-of-freedom adjustment: Neff ≈ N / 4]:::step
    S9 --> S10[10. In-Situ Handheld Sensor & Field Calibration\nOLS transfer regression: Ycal = aX + b, R², RMSE]:::step

    S10 --> OUT[Clean SEVA·GIS Field Intelligence & Continuous Spline Surface]:::output
```

### Correction Method Specifications

| # | Correction Technique | Mathematical & Physical Algorithm | Practical Field Benefit |
| :-: | :--- | :--- | :--- |
| **1** | **Cloud & Shadow Penumbra Purging** | Google Cloud Score+ (`cs_cdf >= 0.60`) $\cap$ ESA SCL (4–7) $\rightarrow$ `focalMax(20m)` | Eliminates diffuse shadow rims and thin cirrus that falsely depress NDVI by up to 35%. |
| **2** | **Sub-Pixel Co-Registration Tracking** | 2D NIR cross-correlation displacement against clear baseline: $\vec{\Delta} = \sqrt{dx^2 + dy^2}$ | Detects orbital shift (> 4.5 m) to prevent neighbor property bleed on micro-parcels. |
| **3** | **Regression Super-Resolution (20m $\rightarrow$ 10m)** | Multilinear regression using B2, B3, B4, B8 + bilinear residual texture re-injection | Delivers 100 pixels per hectare instead of 25, while strictly preserving radiometric flux. |
| **4** | **Topographic Normalization (SCS+C)** | Sun-Canopy-Sensor with empirical parameter $C = \text{offset}/\text{scale}$ over Copernicus DEM | Normalizes solar irradiance on sloped terrain, eliminating self-shadowing on hillsides. |
| **5** | **Boundary Inward Erosion (-10m)** | Negative buffer `AOI.buffer(-10m)` + tri-tier sensitivity testing (core vs nominal vs outer) | Excludes mixed perimeter pixels (bunds, dirt roads, fences) from true crop statistics. |
| **6** | **Phenological Bi-Temporal Interpolation** | Inverse time-weighted interpolation between clean forward and backward satellite passes | Provides target-date estimates when the specific date is overcast or between passes. |
| **7** | **All-Weather SAR Microwave Fusion** | Sentinel-1 C-Band (5.405 GHz) dual-pol backscatter + 30m speckle filter $\rightarrow$ $(VH - VV \text{ dB})$ | Penetrates heavy monsoon cloud cover to track canopy structure and biomass volume. |
| **8** | **Full-Spectrum Agronomic Indices** | Red-Edge indices (NDRE, CIre) + Soil-adjusted (OSAVI, MSAVI2) + Water absorption (NDMI) | Bypasses high-biomass NDVI saturation and eliminates bare soil reflectance in young crops. |
| **9** | **Spatial Autocorrelation Modeling** | Adjusts degrees of freedom for spatial neighbor autocorrelation: $N_{\text{eff}} \approx N / 4$ | Prevents pseudo-replication and reports statistically honest standard error of the mean. |
| **10** | **In-Situ Handheld Sensor Calibration** | OLS regression ($Y_{\text{cal}} = a \cdot X + b$) against SPAD meters, soil probes, or quadrat clips | Translates dimensionless satellite ratios into physical, field-calibrated units. |

---

## Architecture & How SEVA·GIS Works

SEVA·GIS operates on a decoupled client-first architecture where intensive spatial rendering, boundary buffering, and local vault persistence occur inside the user's browser, while heavy petabyte-scale planetary raster reductions are dispatched to Google Earth Engine via an authenticated FastAPI proxy.

### ArchiFi Flow: System Architecture & Data Stream

```mermaid
graph TB
    subgraph Browser ["Client Environment (React 19 + Vite 8 + WebGL)"]
        UI["SEVA·GIS Web Interface\n(Interactive Leaflet Map + Studio + Agro Panel)"]
        ENGINE["Client Raster Engine (raster.ts)\n• Bicubic Spline (Keys a=-0.5)\n• Bilinear & Nearest-Neighbour\n• DRA Contrast & Sub-pixel Clipping"]
        VAULT["Matcha OPFS Vault\nZero-Telemetry Encrypted Browser Storage"]
        REPORT["Report Engine (reportBuilder.ts)\nHigh-Res PDF & Word Export"]
    end

    subgraph Backend ["Cloud Run Proxy Engine (FastAPI + Python 3.12)"]
        API["FastAPI REST Endpoints\n• /api/earth-engine/map\n• /api/earth-engine/stats\n• /api/earth-engine/dem\n• /api/earth-engine/change"]
        AUTH["ADC / Service Account Auth Handler"]
    end

    subgraph Satellite ["Planetary Cloud Data Providers"]
        GEE["Google Earth Engine API\n• COPERNICUS/S2_SR_HARMONIZED\n• GOOGLE/CLOUD_SCORE_PLUS/V1\n• COPERNICUS/DEM/GLO30\n• COPERNICUS/S1_GRD"]
        MPC["Microsoft Planetary Computer\nSTAC Planetary Catalog"]
        ESRI["Esri World Imagery\nHigh-Res Cartographic Base Tiles"]
    end

    UI <--> ENGINE
    UI <--> VAULT
    UI --> REPORT
    ENGINE <--> API
    API <--> AUTH
    AUTH <--> GEE
    UI -. Direct WMS / WMTS .-> MPC
    UI -. Basemap Tiles .-> ESRI
```

---

## Git Repositories

| Repository | Description | Link |
| :--- | :--- | :--- |
| **Frontend Web App & Monorepo** | Main React 19, Vite, Leaflet, and client GeoAI application codebase | [virahitvin8/seva-gis](https://github.com/virahitvin8/seva-gis) |
| **Cloud Run Backend Engine** | FastAPI Earth Engine proxy service with Cloud ADC authentication | [virahitvin8/seva-gis/tree/main/backend](https://github.com/virahitvin8/seva-gis/tree/main/backend) |
| **Production Branch** | Canonical deployment branch powering live production instances | [virahitvin8/seva-gis (branch: main)](https://github.com/virahitvin8/seva-gis/tree/main) |

---

## Vibe Coding & Agentic Engineering

SEVA·GIS is engineered using **Vibe Coding** principles and advanced agentic pair-programming workflows:

- **Human-in-the-Loop Domain Mastery:** Bridging deep agronomic field experience, spatial geometry, and remote sensing theory with real-time AI code generation.
- **Strict Invariant Verification:** Every mathematical routine—from Sun-Canopy-Sensor topographic angles to Moran's I spatial degrees of freedom—is verified against live API telemetry before deployment.
- **Zero-Dependency Native Architecture:** Choosing lightweight native web capabilities (Canvas, WebGL, CSS Grid, OPFS) over heavy external dependencies to maintain lightning-fast load times.
- **Agent Skill Orchestration:** Custom `.agents/skills` managing precision spatial pipelines, coverage robotics math, and code review guardrails.

---

## Credits & QGIS Inspirations

SEVA·GIS stands upon the shoulders of giants in the free and open-source geospatial software (FOSS4G) community:

- **Gary Sherman & the QGIS Community:** For pioneering free, open-source desktop GIS and proving that spatial analysis belongs to everyone, not just proprietary software monopolies.
- **Frank Warmerdam & OSGeo (GDAL/OGR):** The foundational translator library for raster and vector geospatial data formats that powers planetary mapping.
- **Gerald Evenden & the PROJ Project:** For open-source cartographic projections and geodetic coordinate transformations.
- **GRASS GIS:** For forty years of open-source algorithmic rigor in raster neighborhood analysis, terrain hydrology, and watershed science.
- **Vladimir Agafonkin & the Leaflet Team:** For creating the world's most elegant, lightweight, mobile-friendly interactive mapping library.
- **Fields2Cover Robotics Team:** For groundbreaking open-source coverage path planning algorithms designed for precision agricultural vehicles.
- **European Space Agency (ESA) Copernicus Programme:** For open, unrestricted access to the Sentinel-2 multispectral and Sentinel-1 radar constellations.
- **Google Earth Engine Team:** For petabyte-scale planetary earth observation infrastructure and cloud geoprocessing APIs.
- **MathWorks MATLAB:** For mathematical and algorithmic inspirations in matrix operations, polynomial curve fitting, and agricultural signal processing for vegetation phenology time-series.

---

## Live Testing Links

| Service | Environment / Host | Direct Testing URL | Verification Status |
| :--- | :--- | :--- | :--- |
| **SEVA·GIS Web App (Production)** | Cloudflare DNS / Web Host | [sevagis.dpdns.org](https://sevagis.dpdns.org) | ![Active](https://img.shields.io/badge/status-active-brightgreen) |
| **Firebase Production Mirror** | Google Cloud CDN | [seva-gis-backend-e724a.web.app](https://seva-gis-backend-e724a.web.app) | ![Active](https://img.shields.io/badge/status-active-brightgreen) |
| **Earth Engine Cloud Run Proxy** | Google Cloud Run (`us-central1`) | [seva-gis-backend-419602015618.us-central1.run.app](https://seva-gis-backend-419602015618.us-central1.run.app) | ![Active](https://img.shields.io/badge/status-active-brightgreen) |
| **Interactive API Documentation** | FastAPI Swagger UI | [seva-gis-backend-419602015618.us-central1.run.app/api/docs](https://seva-gis-backend-419602015618.us-central1.run.app/api/docs) | ![Swagger](https://img.shields.io/badge/docs-OpenAPI_3.0-teal) |
| **Live Backend Health Check** | Cloud Run Liveness Probe | [seva-gis-backend-419602015618.us-central1.run.app/health](https://seva-gis-backend-419602015618.us-central1.run.app/health) | ![Health](https://img.shields.io/badge/health-200_OK-blue) |
| **GEE Active Indicators API** | Cloud Run REST Endpoint | [seva-gis-backend-419602015618.us-central1.run.app/api/earth-engine/indicators](https://seva-gis-backend-419602015618.us-central1.run.app/api/earth-engine/indicators) | ![API](https://img.shields.io/badge/API-200_OK-brightgreen) |

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

*Earth intelligence in the spirit of selfless service.*
