# SEVA.GIS Click-to-Click Checklist

Run on the **built** site (`npm run build && npm start`).  
Repeat on **desktop (1440px)**, **tablet (768px)** and **phone (375px)**, in **English**, **Telugu** and **Hindi**, on **normal** and **slow 3G**.  
Tick a box only when you saw the expected result. Save a screenshot for every section.

---

## 1. Sign-in page

- [ ] Logo shows above the name SEVA·GIS and floats gently (static if reduced-motion is on)
- [ ] Headline shows the full form of SEVA.GIS plus a one-line meaning
- [ ] "Earth Intelligence for every acre watershed and AOI" is **gone**
- [ ] Tagline reads exactly: *"Autonomous browser-first spatial analysis. Pick any area of interest, compute 30+ spectral insights, export 19+ cartography and analysis outputs to your Google Drive. Zero subscription fee, zero API keys, complete privacy on your device."*
- [ ] Tagline is translated in **te** and **hi** (no English fallback)
- [ ] "Launch interactive demo workspace" button is **gone**
- [ ] Colours are bright, contrast is readable, motion graphics are smooth
- [ ] Each domain card opens a modal listing every parameter, formula, sensor, purpose
- [ ] The 3 step cards carry captions: **Draw / Inject AOI**, **Stream satellite**, **Inspect observations**
- [ ] Methodology section is titled "SEVA.GIS Methodology" and the animated flowchart plays
- [ ] Open-source, How it works, FAQ and NDA links all open

## 2. Account

- [ ] "Continue with Google" opens Google's consent screen (no 401 invalid_client error)
- [ ] After consent you land in the workspace, signed in, `GET /api/auth/me` returns `authenticated: true`
- [ ] With a bad or missing client ID, a clear message appears and Guest mode still works
- [ ] Guest login opens the workspace without any backend call
- [ ] Sign out clears the session cookie; page reload shows the sign-in screen

## 3. Area of Interest and map

- [ ] Name a field, draw a polygon, finish it; area in ha and acres matches QGIS calculation
- [ ] Self-intersecting polygon is rejected with a human-readable reason
- [ ] Map loads with a progress bar (no snake/spinner only)
- [ ] AOI boundary has a clear, creative highlight (glow or animated ring)
- [ ] Zoom in to max: imagery stays sharp (no blocky pixels); main map zoom 13, report map zoom 19
- [ ] **Zoom to AOI** button focuses the AOI only
- [ ] **Zoom to Active Layer** button focuses the layer extent
- [ ] **Lock to AOI** locks the map to AOI bounds (cannot pan outside), not a zoomed-in corner
- [ ] After screen lock and wake, the map is not dark or blank (`invalidateSize` fired)
- [ ] Opacity slider changes the layer live; layer stays sharp when zooming

## 4. Layers and tools

- [ ] Add vector and add raster both work (file upload accepted)
- [ ] Toggle each raster layer; legend values match the layer
- [ ] Combined stress flag shows real data (or "Data unavailable" with reason, never a 503 card)
- [ ] Symbology panel changes colours and band assignments
- [ ] Basemap switcher works (at least 2 basemaps)
- [ ] Clip to AOI produces a clipped output
- [ ] Mirror window opens and syncs pan/zoom
- [ ] Export studio exports map output (PNG or GeoTIFF)
- [ ] "Copy GEE script" copies valid JavaScript to clipboard
- [ ] "Open in Earth Engine" opens `code.earthengine.google.com` with the script

## 5. Node graph (GEE / QGIS / ArcMap / MATLAB / SEVA.GIS)

- [ ] Node graph does **NOT** open by itself after choosing an AOI
- [ ] Each engine has its own labelled box
- [ ] Clicking port 1 selects **only** port 1 (not port 2 or the whole node)
- [ ] Scrolling moves nodes and connecting lines together (no line drift)
- [ ] Compatible port link draws a **green dotted** line
- [ ] Incompatible port link draws a **red** line with the reason
- [ ] "Generate scripts" produces valid GEE JS, PyQGIS Python, arcpy Python, and Octave `.m` code

## 6. Field intelligence

- [ ] Crop health chart: hover shows exact date (YYYY-MM-DD) and index value
- [ ] Values and dates match a fresh GEE `reduceRegion` run (tolerance 1%)
- [ ] `scenes`, `firstDate` and `lastDate` from the API are shown in the UI
- [ ] Rainfall mm does **not** overlap the cloud icon
- [ ] Vegetation and disease cards flip front/back on click, with full technical detail
- [ ] "What to look for" triangle legends are **collapsed** by default; expand on click
- [ ] Each mineral card shows: justification, sensor, acquisition date, **% of AOI above ratio threshold**, and says "**Indicated** (Spectrally Inferred)"
- [ ] Hydrology/SWAT row click highlights the zone on the map and explains what/where/why
- [ ] Confidence % is lower (≤ 60%) when `dataQuality === 'estimated'`

## 7. Weather

- [ ] Weather loads from Open-Meteo or falls back to NASA POWER, with provider name shown
- [ ] When both fail: "Data unavailable — *reason*" card, **never** a raw 503 response
- [ ] `soilTemp0cmC` is a real sensor value or shows "n/a" — never `airTemp − 0.7`
- [ ] `et0Mm` is a real Open-Meteo FAO ET₀ value or shows "n/a" — never hardcoded 4.2

## 8. Farm geometry and sharing

- [ ] Width, compactness, path planning and nearby farms display and match QGIS output
- [ ] Overall health score (e.g. 56/100) is explained with its component breakdown
- [ ] GeoJSON, KML, CSV, XLSX download and open in QGIS, ArcGIS and Excel without errors
- [ ] No raw WhatsApp text dump on the main dashboard
- [ ] SMS/WhatsApp dispatch opens `sms:` / `https://api.whatsapp.com/send?…` URI or calls OpenSMS

## 9. Reports and email

- [ ] "Generate report" preview matches all displayed data values
- [ ] "Send to email": a **real** email arrives in the inbox (not an `.eml` download)
- [ ] Selected formats (PDF, DOCX, ZIP, HTML, JSON) arrive as attachments
- [ ] Cartographic images are included when the "Include maps" option is checked
- [ ] Report body is **fully** in Telugu/Hindi (body paragraphs, not only headings)

## 10. Workspace

- [ ] PMFBY, loan appraisal and backup/restore items sit in the **tree menu**, not on the main dashboard
- [ ] Backup → download JSON; Restore → upload that JSON → data round-trips correctly
- [ ] Terminal session telemetry reflects real operations, not placeholder demo text

## 11. Resilience

- [ ] Offline: friendly banner "No internet connection", no blank screen, no crash
- [ ] Any panel exception: `Guard` error boundary shows "Try again" and "Reload" buttons
- [ ] Browser console (DevTools → Console): **zero errors** in en, te, hi on the built site
- [ ] Keyboard-only walk-through: Tab/Shift-Tab reaches all interactive elements, Enter activates them

---

## Evidence template

For each section, attach:

```
Section: ____
Viewport: 1440 / 768 / 375 px
Language: en / te / hi
Network: normal / slow 3G
Screenshot: qa-evidence/section-<n>-<viewport>-<lang>.png
Result: PASS / FAIL
Notes: ___
```

Save all screenshots in `qa-evidence/` for CI artifact collection.
