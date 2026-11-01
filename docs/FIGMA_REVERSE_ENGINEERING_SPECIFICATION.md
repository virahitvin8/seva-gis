# MASTER DESIGN & REVERSE-ENGINEERING SPECIFICATION: SEVA.GIS UNIFIED WEB & ANDROID FIELD SUITE
**Target Platforms**: Progressive Web App (PWA) + Android Native Shell (`@capacitor/android`)  
**Design System Persona**: High-Contrast Outdoor Tactical Field Instrument + Precision Scientific WebGIS  
**Production Repository**: `virahitvin8/seva-gis`  
**Live Production URL**: `https://sevagis.dpdns.org`  
**License**: GNU Affero General Public License v3 (AGPL-3.0) — Open Source to Everyone  

---

## 1. PRODUCT IDENTITY & VISUAL DIRECTION

### Core Brand & Vision
* **Brand Name**: **SEVA.GIS** — Open-Source Earth Intelligence & Precision Agriculture Suite
* **Tagline**: *"Built for the ground. Open to everyone. Earth intelligence, in the spirit of selfless service."*
* **Core Philosophy**: Zero cloud rental fees, zero per-seat licensing, and zero vendor lock-in. Powered by client-side WebGPU/WASM, free Copernicus Sentinel-1/2 constellations, open-source AI (samgeo / FastSAM), and hardware-native mobile field tools.

### Visual Archetype & Palette Tokens (Strict Hex Tokens)
* **Primary Canvas**: `#020617` (Obsidian Slate 950) — High-contrast dark field instrument canvas engineered for zero-glare outdoor readability in midday agricultural sunlight.
* **HUD Card / Glass Surface**: `rgba(15, 23, 42, 0.92)` with `backdrop-filter: blur(16px)` and `1px solid #1E293B` (Slate 800).
* **Primary Brand & Healthy Biomass Accent**: `#10B981` (Emerald 500) paired with `#059669` (Emerald 600) and polygon fill `rgba(16, 185, 129, 0.15)`.
* **Target Reticle, Pin-Drop & Moderate Stress**: `#F59E0B` (Amber 500) with surface `rgba(245, 158, 11, 0.15)`.
* **Critical Z-Score Anomaly Alert (`z < -1.5`)**: `#EF4444` (Red 500) with surface `rgba(127, 29, 29, 0.35)`.
* **GeoAI / Hydrological / samgeo Accent**: `#06B6D4` (Cyan 500) and `#3B82F6` (Blue 500).
* **Text Tokens**: `#F8FAFC` (Primary Slate 50), `#94A3B8` (Secondary Slate 400), `#64748B` (Technical Slate 500).

### Typography
* **Display / Studio Titles**: `'Space Grotesk'` (700 Bold / 800 ExtraBold, letter-spacing `-0.02em`).
* **Controls, Forms & Multilingual UI**: `'Plus Jakarta Sans'` (500 Medium / 600 SemiBold, fluent in English, Telugu తెలుగు, Hindi हिन्दी).
* **Telemetry, Coordinates, DIGIPIN, Cadastral Units & Band Math**: `'JetBrains Mono'` with `font-variant-numeric: tabular-nums`.

### Sunlight Readability & Touch Ergonomics
* **Minimum 48×48dp Tactile Hit Targets**: Guaranteed minimum sizing for gloved or muddy hands in midday sun.
* **Zero Hover-Dependent Interactions**: All functions, tooltips, and disclosures operate reliably via physical tap/click or drag.
* **Stationary Center Target Reticle (`🎯`)**: The crosshair stays locked at the exact viewport center while the user pans and pinch-zooms the map underneath it, eliminating finger-jitter aiming.

---

## 2. ZERO-COORDINATE LAND DISCOVERY & PAN/ZOOM MECHANICS

### 1. Top Zero-Coordinate Omni-Search Bar
* **Voice Mic Icon + Search Input**: *"No coordinates? Speak or type Village, PIN Code, Post Office, Mandal/Taluk, or Mandi Landmark..."*
* **Horizontal Scrollable Quick-Jump Chips**:
  - `📍 Guntur Mirchi Yard (522004)`
  - `📍 Warangal Cotton Belt (506002)`
  - `📍 Nashik Vineyards (422001)`
  - `📍 Karnal Basmati (132001)`
  - `📍 Mandya Sugarcane (571401)`

### 2. Stationary Center Target Reticle (`🎯 Center Target Lock`)
* **Viewport Placement**: Anchored permanently at exact geometric center (`left: 50%`, `top: 50%`, `transform: translate(-50%, -50%)`).
* **Visual Geometry**: 48×48dp glowing Amber (`#F59E0B`) ring with N/S/E/W ticks and a 6×6dp center red laser dot.
* **Map Interaction**: The satellite map pans and zooms smoothly *underneath* the stationary reticle.
* **Floating Live Pill (Below Reticle)**:
  `DIGIPIN: V82-3PG-535J | 17.3850°N, 78.4867°E | 248m MSL`

### 3. Reticle Boundary Action Dock
* `[🎯 Center Reticle: ON/OFF]`
* `[📍 + Drop Corner Pin (N)]`: Drops a numbered vertex at the center crosshair.
* `[✨ Snap 10ha Field Here]`: Instant 1-click parcel delineation around the center crosshair.

### 4. Stabilized Pan/Zoom Dock (Right Edge)
* Vertical floating glass dock with 48×48dp tactile hit buttons:
  - `[ + ]` Zoom In
  - `[ - ]` Zoom Out
  - `[ ⛶ ]` Fit Parcel Boundary
  - `[ 🔒 ]` Wheel Zoom Guard

---

## 3. SCREEN-BY-SCREEN ARCHITECTURE (14 FULL SCENES / ARTBOARDS)

### Screen 1: Mobile Fields Area Measure (Cadastral HUD)
* **Canvas**: Mobile 390×844 / Tablet 820×1180.
* **Map Viewport**: Full-bleed high-res satellite imagery with stationary Amber Reticle (`🎯`) and glowing Emerald parcel polygon.
* **Bottom Cadastral Ribbon** (simultaneously displaying 6 Indian & global units in `tabular-nums`):
  - **Acres**: `24.60 ac` (Emerald bold)
  - **Hectares**: `9.96 ha` (White bold)
  - **Guntha**: `984.0 Guntha` (Amber bold, 1 Acre = 40 Guntha)
  - **Bigha**: `39.35 Bigha` (Pucca Bigha standard)
  - **Cents**: `2,460 Cents` (Southern India standard, 1 Acre = 100 Cents)
  - **Perimeter**: `1,265 m` with individual segment distance labels (`312m`, `318m`, `315m`, `320m`) on polygon edges.
* **Bottom Action Bar**:
  - `[+ Drop Corner Pin at Crosshair]` (Emerald button, 52dp height)
  - `[🚶 Walk Boundary GPS]` (Toggle continuous Kalman-filtered GNSS tracking)

### Screen 2: Mobile Handy GPS Tactical Console
* **Dual-Dial High-Contrast Outdoor Telemetry Screen**:
  - **360° Rotating Compass Rose**: Cardinal markers (N, E, S, W), Current Azimuth (`042° NE`), and Red Waypoint Pointer pointing toward the next field corner or stress anomaly hotspot (`118.4m`).
  - **6-Card Telemetry Grid**:
    1. *Latitude (WGS84)*: `17.385044° N`
    2. *Longitude (WGS84)*: `78.486671° E`
    3. *Mappls DIGIPIN*: `V82-3PG-535J`
    4. *Copernicus GLO-30 Elevation*: `248m MSL`
    5. *Speed & Odometer*: `4.2 km/h` · `1.84 km`
    6. *UTM / MGRS Grid Zone*: `44Q 234120 1923450`
* **Waypoint Manager**:
  - `[Mark Soil Sample Point]`
  - `[Navigate to Z-Score Anomaly]`

### Screen 3: Mobile Agronomic GPS Map Camera
* **Live Camera Viewfinder**: Real-time camera feed with rule-of-thirds scouting grid and hardware horizon level line.
* **Translucent, Tamper-Proof Agronomic Geo-Stamp Card** (Burned directly into photo canvas):
  - *Left*: Square Satellite Mini-Map showing field polygon outline, camera direction cone, and red pin.
  - *Right Forensic Block*:
    - Cadastral Survey / Plot Name: `Sy. No. 142/A — Mirchi Plot 3`
    - DIGIPIN: `V82-33R-CWV9`
    - Coordinates: `Lat 17.3850° N · Lng 78.4867° E · Elev 248m MSL`
    - Spectral Biomass: `Sentinel-2 Mean NDVI: 0.847 · NDMI: 0.312`
    - Z-Score Anomaly: `OPTIMAL (z = +0.82)`
    - Timestamp: `2026-11-01T14:32:00Z`
* **Large 64×64dp White/Emerald Shutter Button**: `[📸 Capture Geo-Stamped Crop Photo]`.

### Screen 4: In-App Live OTA Hot-Swap Banner & Notification
* **Top Glassmorphic Notification Banner**:
  - Pulsing green sparkle indicator + *"⚡ New SEVA.GIS Web Update Available (v4.3.1) — Updates directly inside your installed app, zero APK download required!"*
  - Emerald button `[1-Tap Hot-Swap]` with inline real-time progress bar (`Updating 100%...`).
  - Status Pill: `✓ Synced with Live Web Build (v4.3.1-OTA) · Zero APK Reinstall`.

### Screen 5: 14 Spectral Indices & Zonal Histogram Drawer
* **Swipe-Up Bottom Sheet**:
  - 14-Index Selector Grid: `NDVI`, `EVI`, `NDRE`, `SAVI`, `FVC`, `NDMI`, `MSI`, `NDWI`, `ET0`, `DEM`, `Slope`, `Aspect`, `TWI`, `NDBI`.
  - 5-Bin Pixel Frequency Histogram bar chart with mean ($\mu$) and standard deviation ($\sigma$).
  - 3 Iso-Variance Management Zones:
    - *Zone A (High Vigour)*: Green fill, healthy biomass.
    - *Zone B (Moderate Transition)*: Amber fill, routine maintenance.
    - *Zone C (Stress Deficit $z < -1.5$)*: Red pulsing fill with VRA fertilizer/irrigation prescriptions.

### Screen 6: Desktop WebGIS Workstation (1440×900)
* **Top App Bar**: SEVA.GIS Brand, Live GNSS Accuracy Pill (`±1.2m 3D Fix`), Studio Switcher, and In-App OTA banner.
* **Split-Screen Satellite Viewport**: True Color RGB vs Active Spectral Heatmap + Basemap Switcher + Opacity Slider.
* **Bottom-Right 10m Pixel Probe Card**: Reflectance signature bar chart (`B2 Blue`, `B3 Green`, `B4 Red`, `B5 Red-Edge`, `B8 NIR`, `B11 SWIR`) and Z-score anomaly status.
* **Left Panel**: Bidirectional QGIS Sync Bridge (Local directory selector, layer group name, `[Push Layers to QGIS]` and `[Import from QGIS]`).

### Screen 7: samgeo / GeoAI Boundary Delineation Studio
* **Zero-Shot Boundary Extractor**: ViT-H / FastSAM client-side model runner.
* **Delineation Metrics**:
  - Delineation Confidence Score: `96.8%`
  - Automated Vertex Count: `18 points`
  - Area Extent: `10.02 ha`
* **Cadastral Delineator**: Single tap on any agricultural field polygon auto-traces field bunds and roads.

### Screen 8: Visual Workflow Builder Studio (Pipeline Nodes)
* **Interactive Canvas**: Drag-and-drop spatial data pipeline nodes:
  - Node 1: `STAC Sentinel-2 Ingestion`
  - Node 2: `samgeo U-Net Segmentation`
  - Node 3: `DuckDB-WASM Zonal Statistics`
  - Node 4: `Multilingual Advisory Engine (EN/TE/HI)`
  - Node 5: `OpenSMS Android SIM Gateway Dispatch`
* **Live Execution**: Visual animated pulses showing sub-second execution path across browser workers.

### Screen 9: TiTiler & STAC Cloud-Native COG Explorer
* **Cloud-Native COG Streaming**:
  - Direct dynamic XYZ tile generation without backend raster caching.
  - Custom band math expression editor (`(B08 - B04) / (B08 + B04)`).
  - Real-time colormap selector (`viridis`, `magma`, `rdylgn`, `spectral`).
  - Min/Max rescale dynamic sliders.

### Screen 10: DuckDB-WASM Spatial SQL & PMFBY Crop Insurance Audit
* **In-Browser Analytical Engine**:
  - Interactive SQL console executing spatial queries directly over GeoParquet and GeoJSON.
  - Sub-second execution timer: `⏱ Execution Time: 12.4ms (DuckDB-WASM v1.28)`.
  - PMFBY Claim Audit Card:
    - Yield Deficit Index: `-38.4%`
    - Status Badge: `CLAIM_APPROVED`
    - Payout Estimate: `₹48,200 / ha`

### Screen 11: Rural Outreach & Remotion Video Studio
* **Multilingual Bulletins**:
  - Toggle between English, Telugu (తెలుగు), and Hindi (हिन्दी).
  - 4 Agricultural Advisory Templates (Crop Health, Irrigation, Pest Alert, Weather Warning).
* **Direct SIM Gateway Dispatch**:
  - Integrates OpenSMS Android hardware gateway (`http://10.65.171.208:9292/sms/`).
  - 1-click native SMS and WhatsApp link generator.
* **15-Second Remotion Automated Video Generator**:
  - Programmatic animated crop report video rendered entirely in React.

### Screen 12: Drone Precision Studio (1m GSD Flight Planner)
* **Autonomous Flight Mission Planner**:
  - Target Ground Sampling Distance (GSD): `1.0 cm/px`
  - Sensor Presets: DJI Mavic 3 Multispectral, Phantom 4 RTK, WingtraOne, Custom.
  - Parameters: Flight Altitude (`80 m`), Cruise Speed (`8.5 m/s`), Forward Overlap (`75%`), Side Overlap (`70%`).
* **Export Docks**:
  - `[Download DJI Pilot 2 KML / WPML]`
  - `[Download QGroundControl Plan]`
  - `[Export Pix4D / Agisoft GeoTIFF Project]`

### Screen 13: Bidirectional GEE ⟷ QGIS Live Bridge
* **Bridge Actions**:
  - Push active GeoTIFFs, GeoJSON vectors, and QML symbology directly to local QGIS working directory.
  - Auto-generate Python PyQGIS scripts and Google Earth Engine (GEE) Code Editor exports.
  - Import layers exported from QGIS with 1-click coordinate reprojection.

### Screen 14: Automated Direct Dispatch Console (Email & SMS)
* **Direct Inbox Email Delivery**:
  - Delivers complete agronomic reports directly to user inbox (e.g., `akshitvinay4636@gmail.com`) via backend Node.js SMTP transport (TLS 465 / STARTTLS 587) or REST APIs (Resend, SendGrid, Brevo).
  - Formats: Print-Ready PDF, Interactive HTML Dossier, Word DOCX, Raw JSON Data, and Complete ZIP Bundle.
  - Zero manual `.eml` downloads required.
* **Direct Mobile SMS Dispatch**:
  - Dispatches localized SMS advisories through the local Android SIM gateway.

---

## 4. AUTOMATED WEB-TO-APP CI/CD & LIVE OTA HOT-SWAP PIPELINE

### Architecture Overview
```
Developer / AI Agent
        │
        ▼ (git push origin main)
┌────────────────────────────────────────────────────────┐
│               GitHub Actions CI/CD Pipeline             │
│                                                        │
│  1. Checkout code & Setup Node.js 22                   │
│  2. npm ci && npm test (119 passing tests)             │
│  3. npm run build (Vite production bundle in dist/)    │
│  4. Stamp dist/version.json with Git SHA & Run Number  │
│  5. Deploy to Web Server (sevagis.dpdns.org)           │
│  6. Compile Android Debug APK via Capacitor Gradle     │
│  7. Upload Live OTA Bundle to Capgo Release Channel    │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│     Live Web Users      │ │   Installed Android     │
│   (Browser / Desktop)   │ │    Field Devices        │
│                         │ │                         │
│ • liveUpdater.ts polls  │ │ • @capgo/capacitor-     │
│   /version.json         │ │   updater checks channel│
│ • Detects newer version │ │ • Downloads delta bundle│
│ • Displays top banner   │ │ • Displays top banner   │
│   "⚡ Update Available" │ │   "⚡ Update Available" │
│ • 1-Tap instant refresh │ │ • 1-Tap 1.5s hot-swap   │
│   with updated code!    │ │   without APK reinstall!│
└─────────────────────────┘ └─────────────────────────┘
```

### GitHub Actions Workflow: `.github/workflows/deploy.yml`
```yaml
name: Deploy to GitHub Pages & Android OTA

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Execute Automated Test Suite
        run: npm test

      - name: Build Production Web Bundle
        run: npm run build
        env:
          NODE_OPTIONS: --max-old-space-size=4096
          VITE_EE_API_URL: "https://seva-gis-backend-419602015618.us-central1.run.app"

      - name: SPA Fallback + CNAME + Version Stamping
        run: |
          cp dist/index.html dist/404.html
          echo "sevagis.dpdns.org" > dist/CNAME
          node -e '
            const fs = require("fs");
            const vPath = "dist/version.json";
            const v = fs.existsSync(vPath) ? JSON.parse(fs.readFileSync(vPath, "utf-8")) : { version: "4.3.1" };
            v.buildDate = new Date().toISOString();
            v.commit = "${{ github.sha }}";
            v.buildNumber = ${{ github.run_number }};
            fs.writeFileSync(vPath, JSON.stringify(v, null, 2));
          '

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4

  android-ota:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install & Build Production Bundle
        run: |
          npm ci
          npm run build

      - name: Publish OTA Bundle to Installed Android Apps (Zero APK Reinstall)
        env:
          CAPGO_API_KEY: ${{ secrets.CAPGO_API_KEY }}
        run: |
          if [ -n "$CAPGO_API_KEY" ]; then
            npx --yes @capgo/cli bundle upload --channel Production --apikey "$CAPGO_API_KEY"
          fi
```

### In-App Client Auto-Updater: `src/ota/liveUpdater.ts`
```typescript
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export interface OtaUpdateInfo {
  version: string;
  sizeFormatted: string;
  changelog?: string[];
  channel: string;
}

export type OtaPromptCallback = (
  info: OtaUpdateInfo,
  triggerHotSwap: () => Promise<void>
) => void;

export async function checkAndApplySevaOtaUpdate(
  onPromptUser: OtaPromptCallback
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // 1. Android Shell: Native CapacitorUpdater Plugin
    const cap = (window as any).Capacitor;
    const nativeUpdater = cap?.Plugins?.CapacitorUpdater;
    if (nativeUpdater) {
      await nativeUpdater.notifyAppReady();
      const latest = await nativeUpdater.getLatest({ channel: 'Production' });
      if (latest?.url && latest?.version) {
        const downloadedBundle = await nativeUpdater.download({
          url: latest.url,
          version: latest.version,
        });

        onPromptUser(
          {
            version: latest.version,
            sizeFormatted: '1.8 MB',
            channel: 'Production',
            changelog: ['4-in-1 Mobile Field Suite', 'Zero-Coordinate Land Discovery', 'Handy GPS Telemetry'],
          },
          async () => {
            await nativeUpdater.set(downloadedBundle);
          }
        );
        return;
      }
    }

    // 2. Web & PWA Fallback: Checks version.json on server with cache busting
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      const currentStored = localStorage.getItem('seva_app_version') || '4.2.1';
      if (data && data.version && data.version !== currentStored) {
        onPromptUser(
          {
            version: data.version,
            sizeFormatted: '1.8 MB',
            channel: data.channel || 'Production',
            changelog: data.changelog || ['Automated Server & Mobile OTA Sync', 'Direct Email & SMS Dispatch'],
          },
          async () => {
            localStorage.setItem('seva_app_version', data.version);
            await new Promise((r) => setTimeout(r, 1200));
            window.location.reload();
          }
        );
      }
    }
  } catch (err) {
    console.debug('[SEVA OTA] Update check completed:', err);
  }
}
```

---

## 5. MASTER COPY-PASTE PROMPT FOR FIGMA AI, ONLOOK & ANTIGRAVITY

```markdown
# MASTER SYSTEM PROMPT: GENERATE SEVA.GIS UNIFIED WEB & ANDROID FIELD SUITE (14 SCENES)

Design and generate the complete, high-craft, production-grade UI for SEVA.GIS (Open-Source Earth Intelligence & Precision Agriculture Suite).

## THEME & TOKENS
- Primary Canvas: #020617 (Obsidian Slate 950)
- Surface HUD: rgba(15, 23, 42, 0.92) with 16px blur, border #1E293B
- Brand / Healthy Vegetation: #10B981 (Emerald 500) & #059669 (Emerald 600)
- Center Target Reticle & Stress: #F59E0B (Amber 500)
- Anomaly Deficit Alert: #EF4444 (Red 500)
- GeoAI / samgeo / Hydrology: #06B6D4 (Cyan 500) & #3B82F6 (Blue 500)
- Typography: Display 'Space Grotesk' (700/800, -0.02em), Controls 'Plus Jakarta Sans', Readouts 'JetBrains Mono' (tabular-nums)
- Minimum Touch Target: 48×48dp everywhere for gloved/muddy hands in bright sun. Zero hover-dependent states.

## SCREEN REQUIREMENTS (ALL 14 ARTBOARDS)

1. [Screen 1: Mobile Fields Area Measure (390×844)]
Full-bleed satellite map with stationary Amber Center Crosshair Reticle (48×48dp, N/S/E/W ticks, red center laser dot). The map pans underneath the crosshair. Bottom glass cadastral ribbon with tabular-nums showing 6 units simultaneously: Acres (24.60 ac), Hectares (9.96 ha), Guntha (984.0 Guntha), Bigha (39.35 Bigha), Cents (2,460 Cents), and Perimeter (1,265 m). Edge distance tags (312m, 318m). Bottom action bar: [+ Drop Corner Pin at Crosshair] (52dp) and [Walk Boundary GPS].

2. [Screen 2: Mobile Handy GPS Tactical Console (390×844)]
Dual-dial high-contrast telemetry screen: 360° rotating compass rose with cardinal markers, azimuth readout (042° NE), and red waypoint arrow pointing to stress anomaly (118.4m). 6-card grid: Lat/Lng, Mappls DIGIPIN (V82-3PG-535J), Copernicus GLO-30 Elevation (248m MSL), Speed (4.2 km/h) & Odometer (1.84 km), and UTM/MGRS Zone. 1-tap coordinate system toggle.

3. [Screen 3: Mobile Agronomic GPS Map Camera (390×844)]
Camera viewfinder with rule-of-thirds grid and horizon level line. Burned-in tamper-proof bottom geo-stamp card: Left square satellite thumbnail with field boundary polygon; Right forensic block with plot name, DIGIPIN, Lat/Lng, Elevation, Azimuth, Sentinel-2 Mean NDVI (0.847), NDMI (0.312), Z-score (OPTIMAL), and ISO timestamp. Large 64×64dp shutter button.

4. [Screen 4: In-App Live OTA Hot-Swap Banner & Notification (390×844)]
Top glassmorphic alert banner: Pulsing green dot, "⚡ New SEVA.GIS Web Update Available (v4.3.1) — In-App Hot-Swap (1.8 MB)", emerald button [1-Tap Hot-Swap] with inline progress bar (Updating 100%...), and status pill "✓ Synced with Live Web Build (v4.3.1-OTA) · Zero APK Reinstall".

5. [Screen 5: 14 Spectral Indices & Zonal Histogram Drawer (390×844)]
Swipe-up bottom sheet with 14-index grid (NDVI, EVI, NDRE, SAVI, FVC, NDMI, MSI, NDWI, ET0, DEM, Slope, Aspect, TWI, NDBI). 5-bin histogram bar chart with mean and standard deviation. 3 Iso-variance zones: Zone A (High Vigour), Zone B (Moderate), Zone C (Stress Deficit z < -1.5) with VRA fertilizer prescriptions.

6. [Screen 6: Desktop WebGIS Workstation (1440×900)]
Split-screen map (True Color RGB vs Spectral Heatmap) with slider, live GNSS accuracy pill (±1.2m 3D Fix), 10m pixel probe reflectance signature bar chart (B2, B3, B4, B5, B8, B11), and left-panel QGIS Live Bridge.

7. [Screen 7: samgeo / GeoAI Boundary Delineation Studio]
ViT-H / FastSAM polygon delineation runner, confidence meter (96.8%), vertex editor, automated field bund tracer.

8. [Screen 8: Visual Workflow Builder Studio]
Node canvas connecting STAC Ingestion -> samgeo Segmentation -> DuckDB-WASM Zonal Stats -> Multilingual Advisory -> OpenSMS Gateway. Animated data flow pulses.

9. [Screen 9: TiTiler & STAC Cloud-Native COG Explorer]
Dynamic XYZ tile URL generator, custom band math editor, colormap picker (viridis, magma, rdylgn), min/max rescale sliders.

10. [Screen 10: DuckDB-WASM Spatial SQL & PMFBY Crop Insurance Audit]
In-browser SQL editor, 12.4ms execution pill, PMFBY yield deficit audit card, CLAIM_APPROVED badge.

11. [Screen 11: Rural Outreach & Remotion Video Studio]
English, Telugu (తెలుగు), and Hindi (हिन्दी) advisory bulletins, 1-click OpenSMS SIM dispatch, WhatsApp links, and 15s automated Remotion video player.

12. [Screen 12: Drone Precision Studio (1m GSD Flight Planner)]
Autonomous flight path generator, sensor presets, altitude/speed/overlap controls, DJI Pilot 2 KML, and QGroundControl export docks.

13. [Screen 13: Bidirectional GEE ⟷ QGIS Live Bridge]
Push GeoTIFFs, vectors, and QML styles to local QGIS project; auto-generate PyQGIS and Earth Engine scripts.

14. [Screen 14: Automated Direct Dispatch Console]
Direct inbox email sender for PDF, HTML, DOCX, JSON, ZIP via Node.js SMTP/API; instant SMS delivery via Android SIM gateway.
```
