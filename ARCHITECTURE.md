# SEVA.GIS Architecture

## 1. Layers

| Layer | Responsibility | Tech |
|---|---|---|
| Presentation | Sign-in, map studio, field intelligence, node graph, reports | React 19, TypeScript, Vite 8, Leaflet, Tailwind CSS v4, motion (CSS/SVG) |
| Application | State, i18n (en/te/hi), guards, exporters | Hooks, `Guard` error boundaries, `translations.ts`, `src/lib/api.ts` |
| Service (backend) | Auth, GEE processing, weather proxy, email, bridge dispatch | Node/Express (`server/geeServer.ts`) |
| Engines | Compute and cartography | Google Earth Engine (service account), PyQGIS, arcpy, MATLAB Engine / GNU Octave, GDAL |
| Delivery | Web, mobile, desktop | GitHub Pages + backend host, Capacitor (Android/iOS), Tauri (Windows/macOS/Linux) |

## 2. Data flow

```
User draws AOI (EPSG:4326 GeoJSON)
    │
    ▼
src/lib/api.ts  api('/api/gee/indices', { method:'POST', body: {geometry, start, end} })
    │                 ↕  VITE_API_BASE prefix
    ▼
server/geeServer.ts  POST /api/gee/indices
    │  1. authenticateViaPrivateKey (GEE_KEY_JSON, GEE_PROJECT_ID)
    │  2. COPERNICUS/S2_SR_HARMONIZED — filter, SCL-mask, median
    │  3. reduceRegion (NDVI, NDRE, NDMI, NDWI, band ratios)
    │  4. pixel-share mineral % above stated threshold
    │  5. Copernicus GLO-30 DEM → slope
    │  returns: { status, sensor, scenes, firstDate, lastDate, stats, mineralShare, bands, slopeDeg }
    │
    ▼
Frontend renders values only when status === 'ok'
If status !== 'ok' → "Data unavailable" card with reason field
Exports (GeoJSON, KML, CSV, XLSX, scripts) generated from the same response
```

## 3. VITE_API_BASE

| Environment | Value |
|---|---|
| GitHub Pages (static) | `""` — API calls will 404; weather falls back to Open-Meteo direct |
| Cloud Run / Render / Fly | `https://api.sevagis.example.com` |
| Local dev | `http://localhost:3001` |

All `fetch('/api/...')` calls go through `src/lib/api.ts → api()` which:
- Prepends `VITE_API_BASE`
- Checks `Content-Type` before `res.json()` (prevents HTML 404 being parsed as OAuth JSON)

## 4. Engine adapter

One interface, four implementations:

```ts
interface Engine {
  id: 'gee' | 'qgis' | 'arcmap' | 'matlab';
  run(op: Op, aoi: GeoJSON, p: Params): Promise<Result | Unavailable>;
}
```

- **GEE:** Server-side service account; downloadable Code Editor + Python scripts for users.
- **QGIS:** PyQGIS plugin listens on `127.0.0.1:8765` (pull AOI, push composite).
- **ArcMap / ArcGIS Pro:** `.pyt` toolbox using `arcpy` (Python 2.7 for ArcMap 10.x, Python 3 for Pro). No decompiling.
- **MATLAB / Octave:** MATLAB Engine API when licensed; GNU Octave CLI as free fallback.

## 5. Node graph

Typed ports (`AOI_POLYGON`, `MULTISPECTRAL_RASTER`, `DEM_TERRAIN`, `SAR_BACKSCATTER`, `HYDRO_VECTOR`, `MATRIX_1D_SERIES`, `COMPOSITE_REPORT`).

A `COMPATIBLE_PORT_MATRIX` decides validity per port pair:
- ✅ Valid link → green dotted line, `validatePortConnection()` returns `isValid: true`
- ❌ Invalid link → red line with the exact incompatibility reason

Ports are selected per port element (not node-wide). Lines are drawn inside the scroll container so they translate with the nodes. The graph opens **only** on user request.

## 6. Map rendering

- Max native zoom per basemap source, `maxZoom` extended with smoothing
- Main map zoom 13 · Report map zoom 19
- Buttons: **Zoom to AOI** (`fitBounds`), **Zoom to Active Layer** (layer extent), **Lock to AOI** (`setMaxBounds` on AOI bounds with padding)
- On `document.visibilitychange` fires `map.invalidateSize()` → prevents dark map after screen lock

## 7. Auth (Google OAuth 2.0 — Authorization Code flow)

```
Browser              Frontend                   Backend
   │                    │                          │
   │ Click "Sign in"    │                          │
   │──────────────────► │ GET /api/auth/google/url │
   │                    │─────────────────────────►│ generate state, store in Map
   │                    │◄─────────────────────────│ { url: 'https://accounts.google.com/...&state=...' }
   │ Redirect to Google │                          │
   │◄───────────────────│                          │
   │                    │                          │
   │ User consents      │                          │
   │ Google redirects   │                          │
   │──────────────────────────────────────────────►│ GET /api/auth/google/callback?code=...&state=...
   │                    │                          │ verify state in Map (CSRF guard)
   │                    │                          │ exchange code → tokens
   │                    │                          │ verifyIdToken → { email, name }
   │                    │                          │ Set-Cookie: sevagis_session=JWT (httpOnly, secure, sameSite=lax)
   │◄──────────────────────────────────────────────│ Redirect to PUBLIC_APP_URL
```

Refresh tokens stay on the server only. Session verified via `GET /api/auth/me` (reads httpOnly cookie).

**Guest mode:** everything stays in the browser; no backend required.

## 8. Deployment topology

```
sevagis.dpdns.org ──► GitHub Pages (static SPA, CNAME)
                         │  VITE_API_BASE set in Pages workflow secret
                         ▼
                    Backend host (Cloud Run / Render / Fly)
                         ├─► Google Earth Engine (service account)
                         ├─► Open-Meteo / NASA POWER (weather proxy)
                         ├─► SMTP / EmailOctopus (report email)
                         └─► Local bridges: PyQGIS :8765 · arcpy .pyt · Octave CLI
```

`ALLOWED_ORIGINS` in the backend must list the Pages origin exactly — no wildcard, no `.endsWith()` shortcuts.

## 9. Failure modes and responses

| Failure | Response |
|---|---|
| Open-Meteo 503 | Retry ×2 with backoff → NASA POWER fallback → `status: 'unavailable'` + reason |
| No cloud-free Sentinel-2 scenes | `{ status: 'unavailable', reason: 'No cloud-free scenes…' }` |
| OAuth invalid_client | Clear message; Guest mode always available |
| SMTP unconfigured | 503 with reason; never a `.eml` download |
| Panel exception | `Guard` error boundary → "Try again / Reload" card |
| All APIs down (offline) | Friendly banner, no blank screen |

## 10. Quality gates (in order)

1. `npm run typecheck` — zero errors
2. `npm run build` — zero warnings
3. Gitleaks secret scan (CI)
4. Playwright matrix — ≥1 080 executed cases, screenshots to `/qa-evidence`, NDJSON log
5. Click checklist (`CLICK_CHECKLIST.md`) — desktop / tablet / phone, en / te / hi
6. Final review (`FINAL_REVIEW_ROLE.md`) — GO / NO-GO gate

## 11. Honesty policy

- **No synthetic data.** `et0Mm` and `soilTemp0cmC` are `null` when not provided by the upstream API; the UI renders "n/a".
- **No hardcoded dates.** Acquisition date comes from GEE `system:time_start`; scene count is displayed.
- **Estimated fallback.** When `VITE_API_BASE` is unset, `geeSpectralEngine.ts` uses a geometry-based estimator labelled `dataQuality: 'estimated'` with reduced confidence and a ⚠️ warning on every card.
- **Minerals are Indicated.** `% of AOI` = mean of binary pixel mask above a stated band-ratio threshold — not mineral abundance.
- **Citations on every index.** Formula, sensor, acquisition date, confidence, and peer-reviewed citation shown on every spectral card.

## 12. Licences (key dependencies)

| Dependency | Licence | Notes |
|---|---|---|
| React, Vite | MIT | |
| Leaflet | BSD-2-Clause | |
| Tailwind CSS | MIT | |
| Turf.js | MIT | |
| GDAL (via system) | MIT/X | |
| QGIS / PyQGIS | GPL-2.0 | Integrated via open PyQGIS API only |
| ArcGIS / arcpy | Proprietary | Automated only via official arcpy; not redistributed |
| MATLAB Engine | Proprietary | GNU Octave (GPL-3.0) used as free fallback |
| Google Earth Engine | GEE ToS | Service account; check ToS before commercial use |
| OpenSMS (daslearning-org) | MIT | |
| LeanREA (aicodeking) | MIT | Credited in README |

SEVA.GIS is licensed **GPL-3.0-or-later**. See `LICENSE` and `LICENSES/` for full dependency texts.
