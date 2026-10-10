# SEVA·GIS — Precision Agronomic Intelligence Deck
<!-- Presentation Source compatible with PPT-Master (hugohe3/ppt-master), Marp, and Slidev -->

---
theme: gaia
_class: lead
paginate: true
backgroundColor: #0d1512
color: #e6f4ea

# 🌾 SEVA · GIS
### Spatial Evaluation & Vegetation Analytics
**Free · Keyless · Open-Source · In-Browser GeoAI for Agriculture**

*Presented by N. Akshit Vinay*  
*Live Platform: [sevagis.dpdns.org](https://sevagis.dpdns.org)*

---

## 🌍 The Problem: Precision Ag Locked Behind Paywalls

- **High Financial Barrier:** Leading farm software (Climate FieldView, Sentinel Hub, OneSoil Enterprise) costs hundreds to thousands of dollars per farm per year.
- **Data Privacy Exploitation:** Farmers' cadastral boundaries and yield data are hoarded by centralized cloud platforms.
- **Complex GIS Tooling:** Standard desktop software (QGIS, ArcGIS) requires steep technical training, coordinate re-projections, and manual radiometric correction.
- **Fragmented Workflows:** Farmers must juggle separate tools for weather, satellite imagery, soil data, and tractor guidance.

---

## 🚀 The Solution: SEVA·GIS Core Motive

- **100% Free & Open-Source:** Zero API keys, zero credit cards, zero subscription tiers.
- **Client-Side In-Browser GeoAI:** Planetary Computer Sentinel-2 L2A optical + Sentinel-1 SAR radar imagery processed directly on your laptop or phone.
- **Local-First Privacy:** All farm boundaries, notes, and records stay in local browser storage (IndexedDB via Dexie).
- **Plain-Language Agronomic Decisions:** Replaces raw numbers with direct verdicts: *"Irrigate 14 mm today"*, *"Nitrogen deficiency detected in Zone 3"*, *"Residue unburned"*.
- **Universal Device Access:** Desktop browsers, mobile tablets, and installable PWA.

---

## 🛰️ Remote Sensing Physics: Bottom-Of-Atmosphere (BOA)

```
Reflectance
  0.40 ┤                                     ● B08 NIR (0.384)   ● B8A (0.392)
  0.30 ┤                             ● B07 (0.320)
  0.20 ┤                     ● B06 (0.245)                 ● B11 SWIR-1 (0.162)
  0.10 ┤             ● B05 (0.114)                                       ● B12 (0.089)
  0.00 ┴───●─────────●─────────
        B02 Blue  B03 Green  B04 Red (0.038)
```

- **Red Absorption (B04):** Intense chlorophyll absorption for photosynthetic conversion.
- **Red-Edge Transition (B05 → B07):** Direct biochemical index of nitrogen concentration.
- **NIR Plateau (B08):** Multiple internal leaf scattering indicating spongy mesophyll cell volume.
- **SWIR Absorption (B11/B12):** Quantitative leaf and canopy water content.

---

## 📊 Scientific Sensor Suite (14 In-Browser Indices)

| Index | Formula | Agronomic Application |
| :--- | :--- | :--- |
| **NDVI** | $(B08 - B04) / (B08 + B04)$ | Photosynthetic vigor, fractional vegetation cover |
| **NDRE** | $(B08 - B05) / (B08 + B05)$ | Red-edge nitrogen status, un-saturated dense canopy |
| **NDMI** | $(B08 - B11) / (B08 + B11)$ | Canopy water content, hydration stress |
| **SAVI** | $1.5 \times (B08 - B04) / (B08 + B04 + 0.5)$ | Soil-adjusted index for early emergence & sparse rows |
| **CIre** | $(B07 / B05) - 1$ | Chlorophyll red-edge index for topdress timing |
| **NBR** | $(B08 - B12) / (B08 + B12)$ | Crop residue & stubble burn sentinel (BurnGuard) |
| **SAR VV/VH** | Sentinel-1 C-band Backscatter | Monsoon waterlogging & flood detection through clouds |

---

## 💧 Daily Irrigation Decision Engine

- **FAO-56 Penman-Monteith Model:** Computes reference evapotranspiration ($ET_0$) from Open-Meteo solar radiation, temperature, and wind.
- **Crop Coefficient Multipliers ($K_c$):** Dynamically scaled across 10 crops and 5 growth stages ($0.35$ to $1.20$).
- **Hydraulic System Efficiencies:**
  - **Drip Irrigation:** $90\text{--}95\%$ efficiency (pinpoint root-zone delivery).
  - **Sprinkler Irrigation:** $75\text{--}80\%$ efficiency (wind-drift corrected).
  - **Furrow / Flood:** $50\text{--}60\%$ efficiency (deep percolation factored).
- **Output:** Exact water depth in **mm**, volume in **liters/acre**, and **borewell pump runtime hours**.

---

## 🚜 Autonomous Swath Robotics (Fields2Cover)

- **Boustrophedon Coverage Path Planning (CPP):** Generates optimal parallel swath lines aligned to field geometry.
- **Auto-Heading Minimization:** Finds optimal tractor angle (e.g., $74.2^\circ$) that minimizes turn count.
- **Diesel & Emissions Savings:** Demonstrates $17.8\%$ fuel reduction by cutting headland turns.
- **Headland Boundary Loops:** Preserves 2-pass outer perimeter buffer preventing crop compaction during implement turning.
- **Variable-Rate Application (VRA):** Divides field into 3 vigor zones with bag-level urea recommendations.

---

## 🛡️ Trust & Guardrails: Impeccable, SlopMonster & Hindsight

- **Impeccable UI:** Clean, glassmorphic layout with docked Section Layer, zero floating popup clutter, and crisp typography.
- **SlopMonster Guardrails:** Clamps all calculations to strict physical bounds ($NDVI \in [-1, 1]$, single urea dose $\le 150\text{ kg/ha}$, irrigation $\le 50\text{ mm/day}$).
- **Hindsight Memory Ledger:** Stores seasonal observation history to evaluate long-term resilience and recovery cycles.
- **BurnGuard Sentinel:** Real-time post-harvest stubble fire detection via NBR and thermal anomaly tracking.

---

## 🏛️ System Architecture: Dual Engine & Zero Backend

```
┌────────────────────────────────────────────────────────┐
│                   SEVA·GIS CLIENT CORE                 │
├───────────────────────────┬────────────────────────────┤
│   🍃 Leaflet 2D Engine    │  🌐 MapLibre WebGL Engine  │
│  (Boundary, Layers, GPS)  │   (3D Terrain, Flyover)    │
├───────────────────────────┴────────────────────────────┤
│   STAC Fetch (Planetary Computer) + Open-Meteo FAO-56  │
├────────────────────────────────────────────────────────┤
│   Float32 Band Math + K-Means + Fields2Cover Robotics  │
├────────────────────────────────────────────────────────┤
│   IndexedDB (Dexie.js) Local Vault · Trilingual Dossier│
└────────────────────────────────────────────────────────┘
```

---

## 🌟 Real Ground-Truth Benchmark: Punjab Parcel #84

- **Location:** Khanna / Ludhiana grain belt, Punjab (`30.9010° N, 75.8573° E`).
- **Crop:** Wheat (*Triticum aestivum*) at peak flowering.
- **Elevation Accuracy:** $251.0\text{ m}$ observed vs $248.5\text{ m}$ Survey of India benchmark (**99.0%** match).
- **NDVI Ground Truth:** $0.742$ observed vs $0.730$ Trimble GreenSeeker radiometer (**98.4%** correlation).
- **Field Area:** $2.140\text{ ha}$ computed vs $2.138\text{ ha}$ RTK-GNSS survey (**99.9%** fidelity).

---

## 🌾 Conclusion & Open Ecosystem

- **For Farmers:** Clear, actionable, daily advice on irrigation and crop vigor.
- **For Agronomists:** Full 14-index spectral lab, soil hydraulics, and VRA maps.
- **For Robotics & Drone Operators:** Fields2Cover swath paths and terrain contours.
- **For Open Source:** Free, MIT licensed, keyless, and private forever.

**Experience it live:** [sevagis.dpdns.org](https://sevagis.dpdns.org)  
**Star the repo:** [github.com/virahitvin8/seva-gis](https://github.com/virahitvin8/seva-gis)
