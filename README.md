# SEVA·GIS (Spatio-Ecological Vector & Analysis GIS)

> **Reverse Engineering Anything (REA) Project**  
> *Autonomous Browser-First Precision GIS, Earth Observation & Remote Sensing Observatory*  
> **Author & Architect**: N. Akshit Vinay ([@virahitvin8](https://github.com/virahitvin8/seva-gis))  
> **License**: MIT Open Source

[![Live Platform](https://img.shields.io/badge/Platform-Live%20Web%20App-10b981?style=flat-square)](https://github.com/virahitvin8/seva-gis)
[![Sentinel-2 L2A](https://img.shields.io/badge/Radiometry-Sentinel--2%20BOA%2010m-3b82f6?style=flat-square)](https://dataspace.copernicus.eu/)
[![Copernicus DEM](https://img.shields.io/badge/Elevation-Copernicus%20GLO--30-f59e0b?style=flat-square)](https://spacedata.copernicus.eu/)
[![Zero Backend](https://img.shields.io/badge/Device%20Privacy-100%25%20Client--Side-6366f1?style=flat-square)](https://github.com/virahitvin8/seva-gis)
[![Multi-Language](https://img.shields.io/badge/Languages-EN%20%7C%20HI%20%7C%20TE-ec4899?style=flat-square)](https://github.com/virahitvin8/seva-gis)

---

## 🌍 What is SEVA·GIS?

**SEVA·GIS** (*Spatial Evaluation & Vegetation Analytics*) is an open-source, client-side planetary observatory born from the **REA (Reverse Engineering Anything)** philosophy. 

Traditional GIS workflows require hefty desktop installations (QGIS, ArcMap, ArcGIS Pro, MATLAB) or cloud subscriptions with strict quotas and paid API keys (Google Earth Engine). SEVA·GIS reverse engineers the computational pipelines of QGIS, ArcMap, MATLAB, and GEE into a unified, lightweight, zero-subscription, zero-API-key web interface running directly inside your browser.

With SEVA·GIS, any student, farmer, research scholar, agronomist, or GIS analyst can delineate an Area of Interest (from 0.5 hectares up to 80,000+ hectares), ingest calibrated Sentinel-2 L2A bottom-of-atmosphere (BOA) reflectances, stream 30 m Copernicus DEM elevations, model surface water hydrology, detect mineral deposits, and compile official legal dossiers in seconds.

---

## ⚡ Core Technological Capabilities

### 1. 🔄 Multi-Platform Node Workflow Studio
Reverse engineers 5 premier GIS & remote sensing environments:
- **Google Earth Engine (GEE)**: Generates production `.js` Earth Engine scripts with reducer chains and image collection filters.
- **PyQGIS (QGIS 3.x)**: Exports `.py` scripts utilizing `QgsRasterCalculator`, native symbology, and vector processing.
- **ArcMap / ArcGIS Pro (ArcPy)**: Generates `.py` scripts utilizing `arcpy.sa` Map Algebra and raster calculators.
- **MATLAB GIS Toolbox**: Generates `.m` scientific scripts using `multispectralImage`, matrix algebra, and surface meshing.
- **SEVA·GIS Client Engine**: Executes pure JavaScript/WebGL raster processing with interactive node wire linking (emerald green for verified connections, crimson red for schema mismatches).

### 2. 💎 Mineral Exploration & Hyperspectral Lithology Suite
Automates USGS and Copernicus spectral absorption algorithms for regional geological prospecting:
- **Ferrous Minerals Index (FMI)**: `SWIR2 / SWIR1` (Band 12 / Band 11) for detecting hematite, goethite, and iron sulfides.
- **Iron Oxide Index (IOI)**: `Red / Blue` (Band 4 / Band 2) identifying gossan caps and limonite alterations.
- **Clay & Hydroxyl Alteration**: `(SWIR1 / SWIR2) × (NIR / Red)` targeting hydrothermal kaolinite, illite, and sericite.
- **Calcite & Carbonates Ratio**: `(Red + SWIR2) / SWIR1` for carbonate platforms, marble, and limestone karst.
- **Silica & Quartz Enrichment**: `SWIR1 / Green` (Band 11 / Band 3) identifying chert and quartzite ridges.

### 3. 🌱 Precision Agronomy & Variable Rate Application (VRA)
- Computes 30+ vegetative indices: **NDVI, NDMI, NDWI, EVI, SAVI, MSAVI, GNDVI, NDRE, BSI, MSI**.
- Canopy water stress detection with localized nitrogen booster prescriptions (+25% N/ha in stressed zones).
- Micro-climate meteorological budgeting with regional fallback resilience (eliminating Open-Meteo 503 errors).

### 4. 💧 Hydrological Modeling & Water Balance Engine
- **USDA SCS-CN (Curve Number)** empirical water balance formulation.
- **Hargreaves Reference Evapotranspiration (ETo)** and real-time surface runoff yield quantification.
- Topographic wetness index (TWI), flow accumulation, and depression ponding risk modeling.

### 5. 🗺️ High-Clarity Satellite Imagery & Geodesy
- Dual-engine Leaflet + MapLibre streaming up to **Zoom 22** without resolution breakdown.
- LiDAR laser perimeter boundary scanning with smooth neon pulse animations.
- Dedicated "Zoom to AOI" toolbar control respecting smallholdings (0.5 ha) to mega-catchments (80,000+ ha).

### 6. 🛸 Drone Precision Studio (1m GSD UAV Suite)
- **High-Resolution UAV Orthomosaics**: Sub-meter (1.0 m GSD) ortho-rectification and flight mission simulation.
- **Smallholder Sentinel-2 Purity Analysis**: Flags mixed-pixel border contamination on smallholdings (< 2.0 ha) and calculates pure internal pixel shares.
- **Fields2Cover Swath Robotics**: Autonomous coverage path planning generating parallel swaths, headland turns, waypoint logs, and flight distance metrics.
- **Leaf Color Chart (LCC) Ground Truth Engine**: Calibrates satellite NDVI readings against IRRI 6-panel field leaf color charts to prevent over-fertilization.
- **Automated UAV Dossier**: One-click generation of the Drone Mission Dossier with geodetic telemetry and pilot checklist.

### 7. 📄 Autonomous Multi-Lingual Dossier Generation
- Official academic, banking, and insurance dossiers available in **English**, **Hindi (हिन्दी)**, and **Telugu (తెలుగు)**.
- Selectable formats: **HTML Dossier**, **Print-Ready PDF**, **Word Document (.doc)**, **Raw JSON**, **GitHub Markdown README**, and **Complete ZIP Bundle**.
- One-click **Cartographic Images Export** (.zip) preserving North arrows, geodetic neatlines, and scale bars.
- Automated audience onboarding and email delivery via **EmailOctopus** without forced `.eml` downloads.

---

## 🌐 Live Subdomains & Automated DNS
SEVA·GIS is accessible worldwide across zero-cost developer domains:
- **`sevagis.dpdns.org`** — [https://sevagis.dpdns.org](https://sevagis.dpdns.org) *(Live Primary Deployment)*
- **`sevagis.is-a.dev`** — Active Pull Request [is-a-dev/register#57108](https://github.com/is-a-dev/register/pull/57108) (Automated CI checks passed)
- **`sevagis.is-a.bot`** — Active Pull Request [free-domains/is-a.bot#555](https://github.com/free-domains/is-a.bot/pull/555) (CNAME target: `sevagis.dpdns.org`)
- **`sevagis.stusite.me`** — Managed DNS via StuSite dashboard

---

## 🖥️ Desktop GIS Plugins (QGIS & ArcMap)

SEVA·GIS provides native open-source plugins in the [`plugins/`](plugins/) folder:

1. **QGIS 3.x Plugin (`plugins/qgis/`)**:
   - Installable via QGIS Plugin Manager (`plugins/public/seva_gee_flow_qgis.zip`).
   - Standalone Python runner: [`plugins/qgis/sevagis_qgis_plugin.py`](plugins/qgis/sevagis_qgis_plugin.py) for the QGIS Python Console.
2. **ArcMap 10.x & ArcGIS Pro Toolbox (`plugins/arcgis/`)**:
   - Native Python Toolbox: [`plugins/arcgis/SEVA_GIS_Toolbox.pyt`](plugins/arcgis/SEVA_GIS_Toolbox.pyt).
   - Ingests vector polygons, computes Map Algebra indices, and calculates SCS-CN water balance without external dependencies.

---

## 🚀 Quickstart & Local Development

The project is built with **React 19**, **Vite 8**, **TypeScript 5.7**, and **Tailwind CSS v4**.

```bash
# 1. Clone the repository
git clone https://github.com/virahitvin8/seva-gis.git
cd "seva gis"

# 2. Install dependencies
npm install

# 3. Launch development server
npm run dev
```

Visit `http://localhost:8443` (or the port indicated by Vite) to access the workspace.

---

## 💰 Open-Source Monetization Blueprint for the Founder

As an open-source creator of a cutting-edge platform like SEVA·GIS, here are the top 6 proven monetization opportunities and eligibility criteria tailored to your skill set:

### 1. PMFBY Crop Insurance & Micro-Fintech Claims Verification API
- **Opportunity**: Agricultural insurance companies (Pradhan Mantri Fasal Bima Yojana - PMFBY) and rural credit banks spend crores on manual ground surveys to verify crop damage before disbursing claims.
- **Model**: Offer an automated B2B Verification API. Charge ₹50 to ₹250 per field appraisal report. Banks and insurers upload field coordinates; SEVA·GIS generates an authenticated pre/post-peril satellite health damage dossier.
- **Eligibility**: You have already built the PMFBY and Bank Loan Health Appraisal engines directly into SEVA·GIS.

### 2. Variable Rate Prescription (VRA) Data Feeds for Drones & Tractors
- **Opportunity**: Agri-drone spraying services and tractor manufacturers need precise geo-referenced shapefiles (`.shp`, `.geojson`) to control variable spray nozzles for urea, DAP, and pesticides.
- **Model**: Charge drone operator networks a per-acre or monthly subscription to generate VRA flight path prescription maps.

### 3. Mineral Prospecting & Exploration Advisory Services
- **Opportunity**: Junior mining companies, quarry operators, and geological survey consultants pay high fees for hyperspectral alteration mapping (FMI, Iron Oxide, Hydroxyl, Calcite, Silica) to narrow drilling targets.
- **Model**: Provide regional geological exploration dossiers and customized remote sensing prospectivity maps.

### 4. Enterprise White-Label Deployments for Agritech Startups
- **Opportunity**: Agri-input companies (seed and fertilizer manufacturers) and digital farming apps want to provide satellite monitoring to their farmers under their own corporate brand.
- **Model**: License a white-label SEVA·GIS instance (custom logo, domain, and database) for an annual enterprise license fee ($3,000 – $15,000/year).

### 5. Open-Source Fellowships, Grants & Incubators
You are strongly eligible to apply for leading geospatial and deep-tech grants:
- **Copernicus Masters & ESA Open Space Innovation Platform (OSIP)**: Substantial non-dilutive equity-free grants for projects leveraging Copernicus Sentinel data for public good.
- **Digital Transport & Agriculture Accelerator Grants (Govt of India / MeitY / BIRAC / NABARD)**.
- **GitHub Sponsors & Open Collective**: Enable community contributions from research scholars and agronomy institutions.

### 6. Custom Desktop Plugin Development & Training
- **Opportunity**: Government irrigation departments, universities, and forestry boards often require specialized QGIS or ArcGIS toolboxes tailored to their state borders.
- **Model**: Offer paid QGIS/ArcPy development contracts, specialized hydrology workshops, and professional GIS consulting.

---

## 🔒 Data Sovereignty & Privacy

SEVA·GIS adheres to strict data privacy principles:
- **Zero Third-Party Tracking**: All vector boundaries, geometry measurements, and spectral stats remain inside your browser's IndexedDB.
- **Optional Google Drive Vault**: Cloud storage is completely user-controlled; files sync only to the user's private Google Drive under `SEVA GIS/`.
- **Offline First**: The application continues to function in the field even without active internet connectivity.

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome!  
Please open an issue or pull request at [https://github.com/virahitvin8/seva-gis](https://github.com/virahitvin8/seva-gis).

*Built with selfless service for every farmer, researcher, and earth explorer.*
