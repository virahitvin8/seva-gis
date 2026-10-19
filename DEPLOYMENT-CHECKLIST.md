# SEVA·GIS — Production Deployment & Release Checklist (v1.0.0)

**Project:** SEVA·GIS (Spatial Evaluation & Vegetation Analytics, Geographic Information System)  
**License:** Apache-2.0  
**Repository:** `https://github.com/virahitvin8/seva-gis`  
**Production Domain:** `https://sevagis.dpdns.org`  
**Latest Release Commit:** `85b323b`  
**Verification Date:** October 2026  
**Quality Status:** 91/91 Automated Tests Passing (100%), 0 TypeScript Errors, Production Build Succeeded  

---

## 1. Pre-Flight Quality & Verification Gates

| Gate | Command | Expected Output | Status | Evidence |
|---|---|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` | Exit code 0, 0 diagnostic errors | PASS | `tsc --noEmit` clean |
| **Automated Unit Suite** | `npm test` | 91/91 tests passing, 0 failures | PASS | Node 22 native runner, 1.3s duration |
| **Production Bundle** | `npm run build` | Clean `dist/` bundle within 25s | PASS | Vite 8 + Rolldown, 20.67s build time |
| **Secret Scan** | Gitleaks / pattern check | Zero hardcoded API keys or tokens | PASS | Constitution Rule 7 strictly verified |
| **i18n Key Parity** | `npm run i18n:coverage` | 100% key parity across en, te, hi | PASS | Telugu & Hindi native scripts verified |

---

## 2. Core Functional Checklists

### 2.1 Google Sign-In & Vault Integration
- [x] **OAuth Client ID Validator:** Supports standard Google Cloud Web client IDs (`\d{10,}-[a-zA-Z0-9_-]{15,}\.apps\.googleusercontent\.com`).
- [x] **Zero-Lockout Fallback:** When running on localhost or with third-party cookies disabled, launches the BMW Executive Sign-In modal.
- [x] **One-Click Local Session:** Users can enter their Gmail and immediately sign in with guest/vault persistence.
- [x] **Drive Vault Backup:** Exports project AOIs, NDVI metrics, and farmer records safely to browser LocalStorage and optional Google Drive.
- [x] **Session Logout:** Clean sign-out resets the user profile and redirects safely to the landing interface.

### 2.2 Area of Interest (AOI) Engine & Boundary Tooling
- [x] **Self-Intersecting Auto-Healing:** Hourglass and bowtie polygons clicked out of order are auto-repaired using `orderRing` radial sorting.
- [x] **One-Click Quick AOI (`⚡ 5 ha at Center`):** Immediately drops an exact 5-hectare rectangular polygon at the map crosshairs.
- [x] **Non-Blocking Field Naming:** Form submission does not stall on empty name fields; auto-generates `${crop} Parcel (${lat}°N, ${lon}°E)`.
- [x] **Coordinate Formats:** Accurately parses Decimal Degrees, DMS (Degrees Minutes Seconds), and standard GeoJSON rings.
- [x] **Area & Perimeter Calculations:** Tested against geodesic standards (~123.9 ha for 0.01° square at equator; ~4,450 m perimeter).
- [x] **Local-First Privacy:** Farm geometry coordinates remain strictly in-browser (Constitution Rule 10).

### 2.3 Visual Design & BMW Executive Palette
- [x] **Canvas Background:** Clean `#f8fafd` light canvas with subtle silver `#d0d8e8` micro-borders.
- [x] **Primary Typography:** BMW Navy `#0b1f35` and `#1a2b42` for maximum legibility and contrast.
- [x] **Brand Accents:** BMW Electric Blue `#0066b3`, `#0080d6`, and M-Sport `#003f7a` highlights.
- [x] **No Dark Green / Black Spill:** Clockwise parameter dial, 3-step production workflow, and knowledge cards migrated to BMW Executive theme.
- [x] **WCAG 2.2 AA Compliance:** High contrast text on all interactive surfaces and form inputs.

### 2.4 RustGIS Engine & Spatial Analytics
- [x] **Vectorized NDVI Pipeline:** Fast Float32 computation of Sentinel-2 Red (Band 4) and NIR (Band 8).
- [x] **Point-in-Polygon (PIP):** Ray-casting interior coordinate detection for boundary masking.
- [x] **Geometry Simplification:** Ramer-Douglas-Peucker (RDP) and Visvalingam-Whyatt algorithms verified.
- [x] **Drone Precision Grid:** 24x24 micro-cell orthomosaic indexing (VARI, GLI, TGI, MPRI).
- [x] **3D Suggestion Tree:** Interactive agronomic recommendations with multi-lingual audio/text advisories.

### 2.5 Multi-Format Professional Export Studio
- [x] **Float32 GeoTIFF:** Compliant Little-Endian TIFF with EPSG:4326 tie points and pixel scale tags.
- [x] **Shapefile & GeoJSON:** Standard RFC 7946 polygon geometry payloads.
- [x] **AutoCAD DXF:** R12 ASCII DXF format for CAD land-surveyors and engineers.
- [x] **Google Earth Engine (GEE):** Runnable JavaScript and headless Python Earth Engine scripts.
- [x] **GIS Desktop Scripting:** PyQGIS 3 scripts with XML QML styles, and ArcPy scripts with CIM LYRX documents.
- [x] **ISO-XML TaskData:** ISO 11783-10 rate-controller prescriptions for variable-rate agricultural sprayers.

---

## 3. Deployment Targets & Runbooks

### Target A: GitHub Pages (Automated CI/CD) — PRIMARY
- **Trigger:** Automatic on push to `main` branch.
- **Workflow File:** `.github/workflows/deploy.yml`
- **Steps Executed:**
  1. `actions/checkout@v4` and `actions/setup-node@v4` (Node 22).
  2. `npm install` and `npm run build`.
  3. Copies `dist/index.html` to `dist/404.html` for client-side SPA routing.
  4. Writes `dist/CNAME` with `sevagis.dpdns.org`.
  5. `actions/upload-pages-artifact@v3` and `actions/deploy-pages@v4`.
- **Live URL:** [https://sevagis.dpdns.org](https://sevagis.dpdns.org)

### Target B: Firebase Hosting — SECONDARY
- **Configuration:** `firebase.json` (pointing to `dist`), `.firebaserc` (project: `seva-gis-backend-e724a`).
- **Command:** `npm run deploy:firebase`
- **Cache Strategy:** 1-year immutable caching for static assets, no-cache on `index.html` for immediate updates.

### Target C: Google Cloud Run / Docker Container
- **Container Definition:** `Dockerfile` (multi-stage Node 22-alpine + nginx).
- **Listening Port:** `8080` (Cloud Run convention).
- **Run Command:**
  ```bash
  docker build -t gcr.io/seva-gis-backend-419602015618/seva-gis:latest .
  docker run -p 8080:8080 gcr.io/seva-gis-backend-419602015618/seva-gis:latest
  ```

### Target D: Local Production Server
- **Server Entrypoint:** `server.js` (Express/Node HTTP server).
- **Command:** `npm start`
- **Default Port:** `8080` or `process.env.PORT`.

---

## 4. Post-Deployment Verification (Smoke Testing)

Perform these 5 smoke checks immediately after any deployment:

- [ ] **Check 1: Custom Domain Reachability**  
  Navigate to `https://sevagis.dpdns.org` — confirm HTTP 200, valid SSL, and BMW Executive styling renders.
- [ ] **Check 2: Direct URL Refresh (SPA 404 Routing)**  
  Reload on any non-root path — verify `404.html` correctly passes routing back to React Router.
- [ ] **Check 3: One-Click AOI Creation**  
  Click `[⚡ 5 ha at Center]` on the map — verify instant polygon generation with live hectare readout.
- [ ] **Check 4: Multi-Language Switch**  
  Toggle between English, Telugu (తెలుగు), and Hindi (हिन्दी) — verify entire UI switches script without blank keys.
- [ ] **Check 5: Report & GeoTIFF Export**  
  Open Export Studio, download GeoTIFF — open in QGIS or viewer to verify Little-Endian Float32 raster tags.

---

## 5. Rollback & Emergency Recovery

In the event of an unexpected edge runtime issue:
1. **GitHub Pages Rollback:**
   ```bash
   git revert HEAD
   git push origin main
   ```
   *GitHub Actions will rebuild and deploy the prior verified commit in < 2 minutes.*
2. **Local Static Server Fallback:**
   ```bash
   npm run build
   node server.js
   ```
