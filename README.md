# SEVA·GIS — Spatial Evaluation & Vegetation Analytics

[![Open Source Love](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/virahitvin8/seva-gis)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8.0-646cff.svg)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.0-38bdf8.svg)](https://tailwindcss.com/)
[![Google Earth Engine](https://img.shields.io/badge/Google_Earth_Engine-L2A_BOA-34a853.svg)](https://earthengine.google.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.115-009688.svg)](https://fastapi.tiangolo.com/)

> **Earth intelligence in the spirit of selfless service.**  
> An open-source precision agriculture GIS and satellite analytics platform designed to inspect, monitor, and verify farm parcels from anywhere in the world without requiring physical field visits.

---

## 🛰️ Architecture Overview

```
Browser Client (SEVA·GIS Web App)
  ├── React 19 + Vite 8 + Tailwind CSS v4
  ├── Leaflet + MapLibre GL Tile Streaming
  ├── Client-Side Radiometric Canvas Engine (High-DPI 1024px+ · Laplacian Unsharp Masking)
  ├── Global Dashboard Zoom Synchronization Engine (Mercator Inverse Scale Dynamic Framing)
  └── Offline-First IndexedDB Geometry & Metadata Cache
          │
          ├── [HTTPS / REST] ───► Cloud Run / FastAPI Proxy (`backend/`)
          │                            │
          │                            ▼
          │                   Google Earth Engine (Python API v1.7.47)
          │                     ├── COPERNICUS/S2_SR_HARMONIZED (L2A BOA Reflectance)
          │                     ├── COPERNICUS/DEM/GLO30 (Copernicus 30m DEM)
          │                     └── Real-Time SCL Masking & 2%–98% Percentile Stretch
          │
          └── [HTTPS] ───► Open Data Providers
                             ├── Microsoft Planetary Computer (S2 L2A STAC Assets)
                             ├── Open-Meteo (High-Resolution Agro-Weather Forecasts)
                             ├── Nominatim OpenStreetMap (Reverse Cadastral Geocoding)
                             └── ISRIC SoilGrids (Global Soil Profile Estimates)
```

---

## 🌟 Key Features

### 1. Google Earth Engine (GEE) Radiometric Pipeline
* **Zero-Lag Calibrated Rendering**: Direct access to `COPERNICUS/S2_SR_HARMONIZED` surface reflectance with Google Earth Engine's standard 2%–98% percentile linear stretch and 1.25 gamma correction.
* **Scene Classification (SCL) Cloud Masking**: Intelligent filtering of clouds, cloud shadows, cirrus, and snow (flags 4–7).
* **Copernicus GLO-30 DEM Integration**: High-precision terrain modeling including elevation, percent slope, aspect, and 315°/45° hillshade.
* **10 Band Combinations & 16 Indices**: True colour (RGB), False colour NIR (CIR), Agriculture (`B11/B8/B2`), Moisture (`B12/B8/B4`), SWIR, NDVI, EVI, SAVI, MSAVI, NDRE, NDMI, NDWI, BSI, and LAI.
* **Advanced Analytics Endpoints**: Zonal statistics, multi-date temporal time-series, bi-temporal loss/gain change detection, and automated crop stress alerts.

### 2. Synchronized Dashboard Map Zoom Engine
* **Universal Zoom Propagation**: Changing the zoom level on the main satellite map immediately impacts and synchronizes all maps across the entire dashboard (GeoAI Analysis Lab, Crop & Vegetation maps, Monitoring & Change, Suitability, Pest Risk, and Time-lapse frames).
* **Mercator Inverse Dynamic Framing**: As you zoom in on the main map, secondary map bounding box padding automatically tightens ($0.45 \times 2^{15 - z}$), delivering sharp, high-magnification parcel focus.
* **Live Zoom Badge**: Prominent overlay showing live zoom multiplier (`Zoom 16.5x · Synced to Dashboard`).
* **Scroll Isolation & Containment**: Strict `overscroll-behavior: contain` and wheel event isolation preventing any page bouncing or jumping into top headlines during zooming.

### 3. Digital Cadastral Land Registry & Pattadar Passbook (RoR Form 1B)
* **100% Read-Only, Certified & Official**: Formatted as an official government-style digital revenue certificate with digital verification badge (`● DIGITALLY VERIFIED CADASTRAL RECORD`).
* **Pull Land Records for Any Particular Person**: Dedicated lookup tool with quick-switch chips for registered titleholders & co-pattadars (Primary Pattadar, Spouse, Ancestral Titleholder, Joint Shareholder) plus real-time search to calculate passbooks for any person.
* **Exact Measured Area in Square Meters ($m^2$)**: Computed directly from field boundaries:
  $$\text{Square Meters} = \text{Area in ha} \times 10,000\text{ m}^2$$
  Displayed in bold emerald typography (e.g., **`24,000.00 m²`**), alongside Hectares, Acres, Guntas, and Cents.
* **Full Cadastral Identity**: 14-digit Bhu-Aadhaar (ULPIN), AgriStack Farmer ID, Digital Passbook Number (`PPB-XXXXXX`), Khata/Patta number, Survey/Khasra number (`Sy. No. 142/2A`), and Hissa sub-division.
* **Mutation & Registration History (दाखिल खारिज)**: Original registration date, revenue mutation date, mode of acquisition (*Ancestral Family Partition Deed*), prior titleholder chain, and Sub-Registrar Office (SRO) deed references.
* **Past Grown Crops History (Girdawari Revenue Record)**: Multi-year Kharif, Rabi, and Zaid crop history with crop varieties, sown area in $m^2$ and ha, irrigation type, recorded yield (Quintals), and VRO verification badges.
* **Institutional Credit (KCC Loan)**: Active hypothecation charges recorded under RoR Form 1B Column 13 at subsidized 4% net interest rate.
* **PMFBY Crop Insurance & Natural Calamity Relief**: Policy details, DBT claim settlement records, and SDRF/NDRF disaster input subsidy relief records.
* **Eligible Government Subsidies & Schemes Dossier**: Automated eligibility matching for PM-KISAN (₹6,000/yr), PMKSY Per Drop More Crop, PM-KUSUM Component B (60% solar pump subsidy), SMAM, Soil Health Card, and PKVY.
* **Sharing & Paperwork Exports**:
  - `Share Passbook`: One-tap sharing via Web Share API to WhatsApp or mobile apps.
  - `Copy for Paperwork`: Copies structured plain-text dossier for bank loan and insurance paperwork.
  - `Print Certificate`: Opens a certified, printable Cadastral Land Ownership Certificate (RoR Form 1B) with official seals and QR codes ready for PDF export.

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js** $\ge 18$ and **pnpm** (or npm)
* **Python** $\ge 3.10$ (for Google Earth Engine backend proxy)

### 1. Frontend Setup

```bash
# Clone the repository
git clone https://github.com/virahitvin8/seva-gis.git
cd seva-gis

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env

# Start local development server
pnpm dev
```
The frontend will start on `http://localhost:8443` (or `http://localhost:5173`).

### 2. Earth Engine Backend Setup

```bash
cd backend

# Create virtual environment (optional)
python -m venv venv
venv\Scripts\activate  # On Windows
# source venv/bin/activate  # On Linux/macOS

# Install requirements
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Place your service account JSON file in backend/service-account.json
# (Or set EE_PROJECT_ID if using Application Default Credentials)

# Start backend server
python -m uvicorn main:app --port 8080 --reload
```
The Earth Engine backend will run on `http://localhost:8080`.
Interactive API documentation is accessible at:
- **Swagger UI**: `http://localhost:8080/api/docs`
- **ReDoc**: `http://localhost:8080/api/redoc`
- **Health Check**: `http://localhost:8080/health`

---

## ☁️ Google Cloud Run Deployment

To deploy the Earth Engine proxy to Google Cloud Run:

```bash
cd backend

# Build and deploy with Google Cloud SDK
gcloud run deploy seva-gis-backend \
  --source . \
  --project seva-gis-backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars EE_PROJECT_ID=seva-gis-backend,EE_ALLOWED_ORIGINS="https://your-frontend-domain.web.app"
```

Then update `VITE_EE_API_URL` in your frontend `.env` to your deployed Cloud Run URL:
```env
VITE_EE_API_URL=https://seva-gis-backend-xxxxx.a.run.app
```

---

## 🔗 Open-Source Startup Links & Ecosystem

| Resource | Link |
| :--- | :--- |
| **Official Repository** | [github.com/virahitvin8/seva-gis](https://github.com/virahitvin8/seva-gis) |
| **Issue Tracker** | [github.com/virahitvin8/seva-gis/issues](https://github.com/virahitvin8/seva-gis/issues) |
| **Discussions & Roadmap** | [github.com/virahitvin8/seva-gis/discussions](https://github.com/virahitvin8/seva-gis/discussions) |
| **Google Earth Engine** | [earthengine.google.com](https://earthengine.google.com/) |
| **Copernicus Open Access Hub** | [dataspace.copernicus.eu](https://dataspace.copernicus.eu/) |
| **Digital India Land Records (DoLR)** | [dolr.gov.in](https://dolr.gov.in/) |
| **PM-KISAN Samman Nidhi Portal** | [pmkisan.gov.in](https://pmkisan.gov.in/) |
| **PMFBY Crop Insurance Portal** | [pmfby.gov.in](https://pmfby.gov.in/) |

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Built with dedication by **N. Akshit Vinay** and open-source contributors.  
*Empowering agricultural stewardship through selfless spatial intelligence.*
