# SEVA·GIS — Spatial Evaluation & Vegetation Analytics

[![Open Source Love](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/virahitvin8/seva-gis)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8.0-646cff.svg)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.0-38bdf8.svg)](https://tailwindcss.com/)
[![Google Earth Engine](https://img.shields.io/badge/Google_Earth_Engine-L2A_BOA-34a853.svg)](https://earthengine.google.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![Copernicus Sentinel-2](https://img.shields.io/badge/Copernicus-Sentinel--2_L2A-orange.svg)](https://dataspace.copernicus.eu/)

> **Earth intelligence in the spirit of selfless service.**  
> SEVA·GIS is an open-source, full-stack geospatial AI and precision agriculture platform. It empowers agricultural stewards, agronomists, farmers, and researchers to inspect, analyze, and monitor agricultural land parcels from anywhere in the world with zero remote lag, sub-meter radiometric precision, and verified government land records.

### 🌐 Live Production Deployments (24/7 Cloud)
| Service | Environment | Live URL | Status |
| :--- | :--- | :--- | :--- |
| **SEVA·GIS Web App** | Firebase Hosting (Global CDN) | [seva-gis-backend-e724a.web.app](https://seva-gis-backend-e724a.web.app) | ![Status](https://img.shields.io/badge/status-active-brightgreen) |
| **Frontend CDN Mirror** | Firebase App Mirror | [seva-gis-backend-e724a.firebaseapp.com](https://seva-gis-backend-e724a.firebaseapp.com) | ![Status](https://img.shields.io/badge/status-active-brightgreen) |
| **Earth Engine Backend** | Google Cloud Run (`us-central1`) | [seva-gis-backend-419602015618.us-central1.run.app](https://seva-gis-backend-419602015618.us-central1.run.app) | ![Status](https://img.shields.io/badge/status-active-brightgreen) |
| **Interactive API Docs** | FastAPI Swagger UI | [seva-gis-backend-419602015618.us-central1.run.app/api/docs](https://seva-gis-backend-419602015618.us-central1.run.app/api/docs) | ![Swagger](https://img.shields.io/badge/docs-OpenAPI_3.0-teal) |
| **Backend Health Check** | Cloud Run Liveness Probe | [seva-gis-backend-419602015618.us-central1.run.app/health](https://seva-gis-backend-419602015618.us-central1.run.app/health) | ![Health](https://img.shields.io/badge/health-200_OK-blue) |

---

## 🏛️ System Architecture

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 1. SATELLITE & SENSOR INGESTION DOMAIN                                  │
 │    Source: src/lib/seva.ts, src/lib/copernicus.ts, backend/main.py     │
 │    Entities: Sentinel-2 L2A STAC items, SCL Scene Classification       │
 │    Invariants: Cloud cover <= 30%, BOA radiometric surface reflectance│
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 2. SPATIAL GEODESY & BOUNDARY DOMAIN                                   │
 │    Source: src/lib/geo.ts, src/lib/db.ts, src/AddFarm.tsx               │
 │    Entities: WGS84 Polygons, Geodesic Area (m²/ha), Vincenty Perimeter │
 │    Invariants: RFC 7946 GeoJSON, Closed LinearRings, [Lon, Lat] order  │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 3. SPECTRAL MATH & HYDROLOGY DOMAIN                                    │
 │    Source: src/lib/raster.ts, src/lib/indicators.ts, src/lib/hydro.ts   │
 │    Entities: NDVI, NDMI, NDWI, NDRE, EVI, BSI, Slope, Aspect, TWI      │
 │    Invariants: Floating arrays normalized -1.0 .. +1.0, zero-div safe  │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 4. AGRICULTURAL ROBOTICS & LOGISTICS DOMAIN                            │
 │    Source: src/lib/pathplan.ts, src/GeoTools.tsx                       │
 │    Entities: Boustrophedon Swaths, Longest-Edge θ_opt, Isochrones, VRA │
 │    Invariants: Meter Cartesian projection, 3-zone N conservation       │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 5. CARTOGRAPHY, LAND REGISTRY & AGRO ADVISORY DOMAIN                   │
 │    Source: src/IndicatorMap.tsx, src/LandInfoCard.tsx, src/report.ts   │
 │    Entities: WebGL canvas, RoR Form 1B, Open-Meteo ET0, Dossiers       │
 │    Invariants: Offline local storage (Dexie DB), zero external cookies │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Unique & Advanced Capabilities

### 1. Google Earth Engine (GEE) Production Microservice
* **Direct Server-Side GEE Integration**: Connects the frontend to an optimized FastAPI proxy (`backend/main.py`) powered by the official Earth Engine Python API (`earthengine-api` v1.7+).
* **Calibrated Radiometric BOA Surface Reflectance**: Pulls Bottom-of-Atmosphere (BOA) scenes directly from `COPERNICUS/S2_SR_HARMONIZED`. Applies Earth Engine's standard 2%–98% percentile linear stretch and 1.25 gamma curve for pixel-perfect Code Editor fidelity.
* **Scene Classification (SCL) Cloud Masking**: Automatically eliminates cloud pixels, cloud shadows, cirrus, and snow (SCL flags 4–7).
* **Copernicus GLO-30 DEM Layers**: On-demand elevation, percent slope, aspect, and 315°/45° hillshade from `COPERNICUS/DEM/GLO30`.
* **Multi-Temporal Compositing Modes**: Supports `median`, `mosaic`, `mean`, and `max_ndvi` quality mosaics.
* **10 Band Combinations & 16 Scientific Indices**:
  - *Band Combinations*: Natural Colour (`B4/B3/B2`), False Colour NIR / CIR (`B8/B4/B3`), Agriculture (`B11/B8/B2`), Moisture (`B12/B8/B4`), SWIR (`B12/B11/B8`), Chlorophyll (`B8/B5/B4`), Geology (`B12/B8/B3`), Red-Edge (`B8A/B7/B5`), Bathymetric (`B4/B3/B1`), Urban (`B12/B11/B4`).
  - *Vegetation & Moisture Indices*: NDVI, EVI, SAVI, MSAVI, GNDVI, NDRE, CIRE, LAI, NBR, NDMI, NDWI, MNDWI, MSI, BSI, NDBI, SWIR Ratio.
* **Analytics Endpoints**:
  - `POST /api/earth-engine/map`: Instant XYZ tile URL generation.
  - `POST /api/earth-engine/dem`: Elevation & terrain layers.
  - `POST /api/earth-engine/stats`: Zonal statistics (`mean`, `min`, `max`, `stdDev`, `p25`, `p75`).
  - `POST /api/earth-engine/timeseries`: Multi-scene temporal trajectory points.
  - `POST /api/earth-engine/change`: Bi-temporal change detection & gain/loss percentages.
  - `POST /api/earth-engine/alert`: Crop stress alert thresholding.
  - `GET /health` & `DELETE /api/cache`: Real-time health monitoring and LRU cache control.

### 2. Universal Dashboard Map Zoom Synchronization
* **Global Zoom Engine (`src/lib/zoomSync.ts`)**: The zoom level of the main satellite map immediately impacts and synchronizes every map in the dashboard.
* **Mercator Inverse Dynamic Framing**:
  $$\text{padFactor} = \max\left(0.04, \min\left(2.8, 0.45 \times 2^{15 - z}\right)\right)$$
  - Zooming in on the main map automatically tightens bounding box padding across the **GeoAI Analysis Lab**, **Crop & Vegetation Map**, **Suitability & Planning**, **Monitoring & Change**, and **Time-Lapse** frames into high-magnification close-ups.
  - Zooming out expands secondary frames to show broader landscape, watershed, and regional context.
* **Live Visual Synchronization Badge**: Real-time overlay (`Zoom 16.5x · DASHBOARD SYNCED`) confirms multi-view coordination.
* **Scroll Isolation & Containment**: Strict `overscroll-behavior: contain !important;` and isolated wheel listeners prevent mouse wheel zoom gestures from bubbling into page scrolling or jarring into top headers.

### 3. Cadastral Land Registry & Pattadar Passbook (RoR Form 1B)
* **100% Read-Only, Certified Revenue Record**: Rendered as an official government-grade digital revenue extract with verified seal (`● DIGITALLY VERIFIED CADASTRAL RECORD`).
* **Pull Land Record for Particular Person Tool**:
  - Interactive chip selector for titleholders in the cadastral zone:
    * *Primary Pattadar* (e.g., Ram Prasad Maurya)
    * *Co-Pattadar Spouse* (e.g., Shanti Devi Maurya)
    * *Ancestral Titleholder* (e.g., Late Shivraj Maurya)
    * *Joint Shareholder* (e.g., Ramesh Kumar Maurya)
  - Real-time search/custom input to calculate and pull revenue dossiers for any individual. Session persisted in `localStorage`.
* **Exact Measured Area in Square Meters ($m^2$)**:
  $$\text{Square Meters} = \text{Area in ha} \times 10,000\text{ m}^2$$
  Displayed prominently in bold emerald typography (e.g., **`24,000.00 m²`**), alongside Hectares, Acres, Guntas, and Cents.
* **Verified Cadastral Identity**:
  - 14-digit **Bhu-Aadhaar (ULPIN)**.
  - **AgriStack Farmer ID** & **Digital Passbook Number** (`PPB-XXXXXX`).
  - Cadastral Survey / Khasra number (`Sy. No. 142/2A`) and Hissa sub-division.
  - Khata / Patta number and Bhumidhari tenure category.
  - **Nil Encumbrance Certificate (EC)** verified title status.
* **Mutation & Transfer History (दाखिल खारिज / नामांतरण)**:
  - Original registration date and revenue mutation transfer date.
  - Acquisition mode (*Ancestral Family Partition Deed*).
  - Prior title chain and Sub-Registrar Office (SRO) deed document numbers.
* **Multi-Year Girdawari Crop History**:
  - Multi-season breakdown (Kharif, Rabi, Zaid).
  - Crop varieties (Cotton Bunny BG-II, Bengal Gram JG-11, Moong Pusa Vishal, Paddy BPT 5204).
  - Sown area in $m^2$ and ha, irrigation source, yield (Quintals), and **VRO Certified** stamp.
* **Institutional Credit (KCC Loan Record)**:
  - Lending bank branch, credit limit, subsidized 4% net interest rate, and RoR Form 1B Column 13 lien status.
* **PMFBY Crop Insurance & Natural Calamity Relief**:
  - Policy reference numbers, sum insured, 2% farmer premium share, DBT claim settlement records, and SDRF/NDRF drought relief records.
* **Eligible Government Subsidies & Schemes Matching**:
  - Matches parcel area against **PM-KISAN Samman Nidhi** (₹6,000/yr), **PMKSY Per Drop More Crop** (55%–80% micro-irrigation subsidy), **PM-KUSUM Component B** (60% solar pump subsidy), **SMAM**, **Soil Health Card**, and **PKVY**.
* **Zero-Editable Sharing & Legal Form 1B Printing**:
  - `Share Passbook`: One-tap sharing via Web Share API to WhatsApp or mobile apps.
  - `Copy for Paperwork`: Copies formatted plain-text dossier for bank loan and insurance paperwork.
  - `Print Certificate`: Generates an official, printable Cadastral Land Ownership Certificate (RoR Form 1B) with QR codes and digital seals.

### 4. Precision Swath Robotics & Agro-Logistics (`src/lib/pathplan.ts`)
* **Fields2Cover Boustrophedon Swath Planning**: Computes optimal tractor and combine harvester driving tracks using the Longest-Edge $\theta_{opt}$ algorithm. Minimizes machinery turning distance and soil compaction.
* **Variable Rate Application (VRA) Prescription**: Generates 3-zone nitrogen prescriptions (Urea bags/ha) based on Sentinel-2 NDVI canopy vigor, calculating input cost savings.
* **Rural Logistics Isochrones**: Computes 10/20/30-minute tractor transit and 15/30/45-minute truck haulage reachability using road detour modeling ($0.75\times$ factor).

### 5. Privacy-First Zero-Telemetry Architecture
* **IndexedDB Local Vault (`src/lib/db.ts`)**: All field outlines, survey numbers, journals, and infrastructure notes stay strictly on the user's device via Dexie.js.
* **Zero External Cookies or User Profiling**: No tracking scripts, analytics cookies, or cloud telemetry.

---

## 🛠️ Installation & Quickstart

### Prerequisites
* **Node.js** $\ge 18$ & **pnpm** (or npm)
* **Python** $\ge 3.10$ (for Google Earth Engine backend proxy)

### 1. Frontend Setup

```bash
# Clone the repository
git clone https://github.com/virahitvin8/seva-gis.git
cd seva-gis

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env

# Run local development server
pnpm dev
```
The application will launch on `http://localhost:8443` (or `http://localhost:5173`).

### 2. Earth Engine Backend Proxy Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate      # Windows PowerShell
# source venv/bin/activate  # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Place your service account credentials in backend/service-account.json
# (Or authenticate via Google Cloud ADC: gcloud auth application-default login)

# Start backend proxy
python -m uvicorn main:app --port 8080 --reload
```

Interactive API documentation will be available at:
- **Swagger UI**: `http://localhost:8080/api/docs`
- **ReDoc**: `http://localhost:8080/api/redoc`
- **Health Check**: `http://localhost:8080/health`

---

## ☁️ Google Cloud Run Deployment

To deploy the Earth Engine microservice to Google Cloud Run:

```bash
cd backend

gcloud run deploy seva-gis-backend \
  --source . \
  --project seva-gis-backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars EE_PROJECT_ID=seva-gis-backend,EE_ALLOWED_ORIGINS="http://localhost:8443,https://seva-gis-backend-e724a.web.app,https://seva-gis-backend-e724a.firebaseapp.com"
```

Live Earth Engine Backend URL:
```env
VITE_EE_API_URL=https://seva-gis-backend-419602015618.us-central1.run.app
```

---

## 🌐 Open-Source Startup Ecosystem & Links

| Platform / Resource | URL | Description |
| :--- | :--- | :--- |
| **🚀 SEVA·GIS Live Production Web App** | [seva-gis-backend-e724a.web.app](https://seva-gis-backend-e724a.web.app) | Live global production portal on Firebase CDN |
| **🌐 Firebase Mirror Domain** | [seva-gis-backend-e724a.firebaseapp.com](https://seva-gis-backend-e724a.firebaseapp.com) | Redundant secondary CDN mirror |
| **⚡ Live Earth Engine Cloud Run Backend** | [seva-gis-backend-419602015618.us-central1.run.app](https://seva-gis-backend-419602015618.us-central1.run.app) | 24/7 GEE L2A & DEM serverless microservice |
| **📖 Interactive API Documentation** | [seva-gis-backend-419602015618.us-central1.run.app/api/docs](https://seva-gis-backend-419602015618.us-central1.run.app/api/docs) | Swagger UI for Earth Engine endpoints |
| **Official GitHub Repository** | [github.com/virahitvin8/seva-gis](https://github.com/virahitvin8/seva-gis) | Core source repository |
| **Issue Tracker & Feature Requests** | [github.com/virahitvin8/seva-gis/issues](https://github.com/virahitvin8/seva-gis/issues) | Bug reports and engineering tasks |
| **Discussions & Product Roadmap** | [github.com/virahitvin8/seva-gis/discussions](https://github.com/virahitvin8/seva-gis/discussions) | Community forum & architecture discussions |
| **Google Earth Engine** | [earthengine.google.com](https://earthengine.google.com/) | Cloud platform for planetary-scale geospatial analysis |
| **Copernicus Data Space Ecosystem** | [dataspace.copernicus.eu](https://dataspace.copernicus.eu/) | European Space Agency Sentinel-2 L2A & DEM data |
| **Microsoft Planetary Computer** | [planetarycomputer.microsoft.com](https://planetarycomputer.microsoft.com/) | Cloud-optimized STAC satellite assets |
| **Open-Meteo Weather API** | [open-meteo.com](https://open-meteo.com/) | High-resolution open-access agro-meteorological models |
| **ISRIC SoilGrids** | [soilgrids.org](https://soilgrids.org/) | Global digital soil mapping and physical soil properties |
| **Digital India Land Records (DoLR)** | [dolr.gov.in](https://dolr.gov.in/) | National Land Record Modernization Programme |
| **PM-KISAN Samman Nidhi Portal** | [pmkisan.gov.in](https://pmkisan.gov.in/) | Direct income support for agricultural titleholders |
| **PMFBY Crop Insurance Portal** | [pmfby.gov.in](https://pmfby.gov.in/) | National crop insurance claim and coverage tracking |

---

## 📜 License & Credits

This project is open-source under the [MIT License](LICENSE).

Developed and architected by **N. Akshit Vinay** with open-source contributions.  
*Empowering agricultural stewardship through selfless spatial intelligence.*
