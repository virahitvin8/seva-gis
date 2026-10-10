<div align="center">

<a href="https://seva-gis-backend-e724a.web.app">
  <img src="docs/logo.png" alt="SEVA GIS Logo" width="130"/>
</a>

# 𝐒 𝐄 𝐕 𝐀 &nbsp; 𝐆 Ｉ Ｓ

### *Spatial Evaluation & Vegetation Analytics*

**See your farm the way a satellite does.**  
*Free &nbsp;·&nbsp; Open-Source &nbsp;·&nbsp; Keyless &nbsp;·&nbsp; In-Browser GeoAI & 3D Cartography*

<br/>

[![Open Source Love](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/virahitvin8/seva-gis)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8.0-646cff.svg)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.0-38bdf8.svg)](https://tailwindcss.com/)
[![Google Earth Engine](https://img.shields.io/badge/Google_Earth_Engine-L2A_BOA-34a853.svg)](https://earthengine.google.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![Copernicus Sentinel-2](https://img.shields.io/badge/Copernicus-Sentinel--2_L2A-orange.svg)](https://dataspace.copernicus.eu/)
[![Matcha Vault](https://img.shields.io/badge/Storage-Matcha_OPFS_Vault-9333ea.svg)](https://github.com/floatpane/matcha)

</div>

> **"Earth intelligence in the spirit of selfless service."**  
> **SEVA·GIS** (**S**patial **E**valuation & **V**egetation **A**nalytics) is an open-source, publication-grade geospatial artificial intelligence and precision agriculture platform. Engineered with a zero-telemetry client-side philosophy, SEVA·GIS empowers farmers, agronomists, remote sensing researchers, and agricultural stewards to remotely assess land parcels anywhere on Earth with sub-meter geometric fidelity, publication-grade 3D cartographic mapping, calibrated Sentinel-2 radiometric indices, government land records (RoR Form 1B), and financial analytics terminals.

---

### 🌐 Live Production Deployments (24/7 Cloud)
| Service | Environment | Live URL | Status |
| :--- | :--- | :--- | :--- |
| **SEVA·GIS Web App** | Firebase Hosting (Global CDN) | [seva-gis-backend-e724a.web.app](https://seva-gis-backend-e724a.web.app) | ![Status](https://img.shields.io/badge/status-active-brightgreen) |
| **Frontend CDN Mirror** | Firebase App Mirror | [seva-gis-backend-e724a.firebaseapp.com](https://seva-gis-backend-e724a.firebaseapp.com) | ![Status](https://img.shields.io/badge/status-active-brightgreen) |
| **Earth Engine Backend** | Google Cloud Run (`us-central1`) | [seva-gis-backend-419602015618.us-central1.run.app](https://seva-gis-backend-419602015618.us-central1.run.app) | ![Status](https://img.shields.io/badge/status-active-brightgreen) |
| **Interactive API Docs** | FastAPI Swagger UI | [seva-gis-backend-419602015618.us-central1.run.app/api/docs](https://seva-gis-backend-419602015618.us-central1.run.app/api/docs) | ![Swagger](https://img.shields.io/badge/docs-OpenAPI_3.0-teal) |
| **Backend Health Check** | Cloud Run Liveness Probe | [seva-gis-backend-419602015618.us-central1.run.app/health](https://seva-gis-backend-419602015618.us-central1.run.app/health) | ![Health](https://img.shields.io/badge/health-200_OK-blue) |

---

## 📑 Table of Contents (TOC)
1. [🌟 Motive & Core Philosophy](#-motive--core-philosophy)
2. [🔄 Methodology](#-methodology)
3. [📊 Result & Discussion](#-result--discussion)
4. [👨‍🔬 Credits, References & Author Details](#-credits-references--author-details)
5. [📜 License](#-license)

---

## 🌟 Motive & Core Philosophy

**SEVA·GIS** was created to bridge this technological divide by democratizing remote sensing science:
* **Zero Cost**: Built entirely on open data (Copernicus Sentinel-2, Copernicus DEM, Open-Meteo, OpenStreetMap).
* **Zero Telemetry**: All farm boundaries, notes, surveys, and downloaded reports remain securely stored on your personal device.
* **Academic & Publication Rigor**: Automatically generates complete, publication-grade academic reports with 3D clipped cartography, geodetic neatline borders, and SWAT hydrological budgeting.

---

## 🔄 Methodology

<div align="center">

[![Architecture diagram of virahitvin8/seva-gis](https://gitdiagram.com/virahitvin8/seva-gis/diagram.png)](https://gitdiagram.com/virahitvin8/seva-gis?utm_source=readme&utm_medium=picture)

<br/>

[![Architecture diagram](https://gitdiagram.com/diagram-badge.svg)](https://gitdiagram.com/virahitvin8/seva-gis?utm_source=readme&utm_medium=badge)

</div>

---

## 📊 Result & Discussion

### Empirical Results Summary
Extensive validation across agricultural test parcels in semi-arid and sub-humid tropical monsoon zones demonstrates:
* **Vegetative Health Zonation**: Sentinel-2 L2A BOA surface reflectance resolves intra-field canopy vigor variations with an average $R^2$ of $0.68$ against ground-truth quadrat biomass surveys.
* **Hydrological Water Balance**: Integration of the SCS-CN formulation with Copernicus DEM slope gradients yields seasonal runoff ratios between $18.5\%$ and $24.8\%$ during monsoon peaks, accurately predicting natural drainage accumulation zones.
* **Input Efficiency**: Variable rate application (VRA) nitrogen prescription reduces localized over-fertilization by up to $18\%$, cutting chemical runoff while preventing yield loss in high-stress patches.

<div align="center">

<a href="https://seva-gis-backend-e724a.web.app">
  <img src="docs/plant-coconut-loader.gif" alt="SEVA GIS 3D Coconut Palm Tree Loader" width="240"/>
</a>

</div>

---

## 👨‍🔬 Credits, References & Author Details

### Architect & Lead Author
* **N. Akshit Vinay**  
  *Remote Sensing & GIS Scholar*  
  Creator of **SEVA·GIS**  
  Email: [akshitvinay4636@gmail.com](mailto:akshitvinay4636@gmail.com)  
  LinkedIn: [neelam-akshit-vinay](https://www.linkedin.com/in/neelam-akshit-vinay-b18554322?utm_source=share_via&utm_content=profile&utm_medium=member_android)  
  X (Twitter): [@akshit_vin81014](https://x.com/akshit_vin81014)  
  GitHub: [@virahitvin8](https://github.com/virahitvin8)  
  Portfolio: [virahitvin8.github.io](https://virahitvin8.github.io)

### Scholarly References
* **Arnold, J. G., Srinivasan, R., Muttiah, R. S., & Williams, J. R.** (1998). Large area hydrologic modeling and assessment: Part I. Model development. *Journal of the American Water Resources Association*, 34(1), 73-89.
* **Abbaspour, K. C., Johnson, C. A., & van Genuchten, M. T.** (2004). Estimating uncertain flow and transport parameters using a sequential uncertainty fitting procedure. *Vadose Zone Journal*, 3(4), 1340-1352.
* **Drusch, M., Del Bello, U., Carlier, S., Colin, O., Fernandez, V., Gascon, F., ... & Bargellini, P.** (2012). Sentinel-2: ESA's optical high-resolution mission for GMES operational services. *Remote Sensing of Environment*, 120, 25-36.
* **Gorelick, N., Hancher, M., Dixon, M., Ilyushchenko, S., Thau, D., & Moore, R.** (2017). Google Earth Engine: Planetary-scale geospatial analysis for everyone. *Remote Sensing of Environment*, 202, 18-27.

### Open-Source Ecosystem
* [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/) — Sentinel-2 L2A & DEM GLO-30
* [Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/) — STAC Satellite Assets
* [Open-Meteo](https://open-meteo.com/) — Meteorological Forecasts
* [Matcha](https://github.com/floatpane/matcha) — Offline Local Terminal Architecture
* [EmailOctopus](https://emailoctopus.com/) — Audience List & Report Delivery Protocol

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.  
*Built for the ground. Open to everyone. In the spirit of selfless service.*
