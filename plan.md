# SEVA·GIS Master Enhancement & Bug Audit Checklist

This checklist tracks all reported errors, page lag occurrences, UI/UX requests, architectural overhauls, and repo cleanups for **SEVA·GIS**.

---

## 1. Page Unresponsive & Lag Audit Count

The user reported **10 distinct instances of page unresponsive errors and lags**:

| # | Lag / Freeze Incident Reported | Root Cause | Resolution Strategy | Status |
|---|---|---|---|---|
| **L-01** | *"page is unresponsive, wait or exit"* during general browsing | Heavy synchronous calculations blocking JavaScript main thread | Wrap heavy raster sampling & matrix calculations in `requestIdleCallback` / memoized workers | [x] Resolved |
| **L-02** | Language selector disabled / lagging | Google Translate DOM script contention and cookie deadlock | Optimized reactive translation loader with non-blocking async mount | [x] Resolved |
| **L-03** | Language switch English <-> Telugu stuck, didn't revert to English without deep refresh | Residual `googtrans` cookies across subdomains and paths preventing state reset | Aggressive domain/path cookie purge + reactive DOM translation sync without page reload | [x] Resolved |
| **L-04** | Farm switching freeze (*"page is getting unresponsive all the time while I do shift the farms"*) | Key recreation destroyed Leaflet DOM tree while re-rendering 40+ raster layers synchronously | Decoupled map instance from farm ID key; smooth flyTo + incremental layer update | [x] Resolved |
| **L-05** | Farm shift unresponsive after switching to Telugu | Double re-render triggered by translation mutations during farm polygon computation | Debounced farm switch state, deferred satellite query | [x] Resolved |
| **L-06** | GeoAI Studio takes excessive time to open | Dual `loadScene` and unsupervised K-Means clustering executing synchronously on mount | Lazy compute spectral groups with cached raster indices | [x] Resolved |
| **L-07** | Crop General / AOI Farm 1 to Farm 2 switch freeze | Full timeseries and Open-Meteo weather refetched synchronously | AbortController on in-flight requests + cached weather/satellite metrics | [x] Resolved |
| **L-08** | Mitra tour guide 5–10 second delay per step transition | `getComputedStyle` and `getBoundingClientRect` called 30x/sec in `requestAnimationFrame` + smooth scroll layout thrash | Replaced with single lightweight element target measurement and fast scroll | [x] Resolved |
| **L-09** | Report preview generation unresponsive wait dialog | 20+ SVG cartographic maps generated synchronously in one pass | Chunked async report builder yielding to main thread every 3 figures | [x] Resolved |
| **L-10** | PDF download click freeze / unresponsive | Window print popup blocked or synchronous blob export locking memory | Direct non-blocking client-side PDF synthesizer with instant download | [x] Resolved |

---

## 2. Master Feature & Correction Checklist (71 Items)

### A. Repository & Documentation Cleanup
- [x] **REQ-01**: Remove Viva defense document file from repository.
- [x] **REQ-02**: Remove `generate_viva_defense_doc.py` / Python viva generation scripts.
- [x] **REQ-03**: Retain only code & assets needed for front-end and back-end execution.
- [x] **REQ-04**: Clean up README: remove multi-language file lists (English, Hindi, etc.).
- [x] **REQ-05**: Clean up README: remove academic Viva defense link beside backend API docs.
- [x] **REQ-06**: Clean up README: fix corrupted image link for "Precision agriculture interactive GIS terminal".
- [x] **REQ-07**: Clean up README: add ArchiFi / Mermaid flowchart for Precision Correction Tool.
- [x] **REQ-08**: Clean up README: add ArchiFi / Mermaid flowchart for Architecture & How SEVA·GIS works.
- [x] **REQ-09**: Clean up README: remove project folder structure tree.
- [x] **REQ-10**: Purge all references to Vayganga / Vaiganga Basin across folders, dashboard, and reports.

### B. Shell, Layout, Language & Core Interaction
- [x] **REQ-11**: Footer/Header team: implement 3D Git-style diagram toggle component (`TeamGitDiagram.tsx`).
- [x] **REQ-12**: Fix Dashboard Layout Customizer so moving modules up/down actively reorders DOM sections and persists.
- [x] **REQ-13**: Fix Language switching: smooth instant toggle English <-> Telugu <-> Hindi with clean cookie handling.
- [x] **REQ-14**: Farm switching optimization: instant parcel transitions for smallholdings and 40,000+ ha areas without freezing.
- [x] **REQ-15**: Remove Land Passbook section completely (no demo data, no land registry).
- [x] **REQ-16**: Eliminate pixelation on small micro-parcels with high-DPI bicubic spline resampling.

### C. Map Framing, Zoom & Collision Avoidance
- [x] **REQ-17**: Enforce zoom scale 13x for overview map and fixed zoom scale 19x for Remote Field Review, GeoAI Studio, and report maps.
- [x] **REQ-18**: Collision avoidance: North arrow, scale bar, title box, legends, and coordinates must auto-resize / reposition so they NEVER overlap the Area of Interest (AOI).
- [x] **REQ-19**: Strict centering: AOI must always be placed squarely in the center of the viewport at 19x zoom.
- [x] **REQ-20**: Interactive sliding inspection loupe window & point count controls: sliding window reveals points 1–5, or user can toggle visibility and point count (1 to 5).
- [x] **REQ-21**: Professional tone: replace "your farm" / "you, you, you" with inclusive academic phrasing ("in the area of interest provided / analyzed").

### D. Sustainability, Crop Planning & Climate Norms
- [x] **REQ-22**: Organize sustainability crops by categories: Millets & Cereals, Pulses & Legumes, Cash Crops, Oilseeds, Vegetables, prioritized by agro-climatic zone.
- [x] **REQ-23**: Clickable scale breakdown: clicking score boxes shows exact mathematical percentage division and limiting factors.
- [x] **REQ-24**: Interactive climate norm charts: hover tooltips display exact percentages, values, and definitions.
- [x] **REQ-25**: MATLAB Analytics Suite: integrate matrix computing, spectral decomposition, continuous time series, and Fourier/wavelet filters inspired by mathworks and morluto/rea.

### E. Remote Field Review & GeoAI Studio
- [x] **REQ-26**: Pest & Disease: 7-day weather risk and hotspot map at 19x zoom, centered AOI, with sliding loupe window.
- [x] **REQ-27**: GeoAI Studio: full feature suite, dual field inspection at 19x zoom, centered AOI, selectable spectral groups (3, 4, 5) with instant re-clustering.
- [x] **REQ-28**: Universal GIS capabilities: watershed delineation, stream network extraction, lakes, DEM, slope, aspect, contour, radiance to DN, and dark pixel subtraction (DOS1) for water quality.
- [x] **REQ-29**: Replace "Review field changes from home" with "Review field from remote".
- [x] **REQ-30**: Crop General graph: interactive SVG with hover values and plain-talk definitions.
- [x] **REQ-31**: Recent satellite passes: provide visible color legend (green = clear pass, yellow = moderate haze, red = cloud obscured).
- [x] **REQ-32**: Remove manual "Crop check" section; dynamically adapt layers based on user objective.
- [x] **REQ-33**: Field intelligence clarity: plain explanations for canopy stress, soil moisture min/max thresholds, and rainfall sufficiency / irrigation guidance.

### F. Focus Mode & Map Canvas Controls
- [x] **REQ-34**: Fix Borewell & Pipeline tools: ensure turning on borewell/pipeline does not conflict with or activate the meter tape ruler.
- [x] **REQ-35**: Rename "Farm background canvas" to "Background canvas". Fix Solid Black (GEE) and Solid White (QGIS) buttons so canvas switches immediately.
- [x] **REQ-36**: Loading animation: animated train/pulse signal tracing along the AOI boundary during map loading.
- [x] **REQ-37**: Fix AOI raster clipping so exterior pixels are masked out.
- [x] **REQ-38**: Parameter symbology & band combinations: custom bands + presets (SWIR, geology, DOS1 dark pixel subtraction for water quality) + DEM, slope, aspect, contour.
- [x] **REQ-39**: Remove cadastre section from focus mode and layers box.
- [x] **REQ-40**: Carto frame: display active layer name, allow double-click title editing, direct download in PNG, GeoTIFF, GeoJSON, KML.
- [x] **REQ-41**: Move/adjust Carto HUD elements so they never overlap the AOI.
- [x] **REQ-42**: Add visible scroll indicator / controls in focus mode for small screens.

### G. 3D Playing Card Modals & Plain Explanations
- [x] **REQ-43**: Explain scientific parameters (NDVI, EVI, canopy cover, MSI, NDRE, BSI) clearly and thoughtfully without raw "explain like a friend" label.
- [x] **REQ-44**: 3D Animated Playing Card Modal: clicking spectral index, weather, soil, or water boxes opens a floating playing card modal in screen center with smooth flip animation, formulas, and diagrams.
- [x] **REQ-45**: Water plan & model estimation: make 100% automated based on AOI data (remove manual requirement).
- [x] **REQ-46**: SWATH hydrological cycle & water balance: dynamic to selected AOI (precipitation, runoff SURQ, ET, GWQ), no Vayganga data.
- [x] **REQ-47**: Remove official land register & cadastral records completely.
- [x] **REQ-48**: Remove agronomy season calendar.
- [x] **REQ-49**: Make yield forecasting model conditional or toggleable (only when agricultural analysis is selected).
- [x] **REQ-50**: Geo toolkit cleanup: remove variable rate fertilizer, remove point checker, remove offset, move buffer to tools box with custom meter/km input, remove converters, remove WKT reader.
- [x] **REQ-51**: Dynamic workspace highlight: auto-highlight active section in sidebar navigation while scrolling.
- [x] **REQ-52**: Mitra quick tour: eliminate 5–10s lag to instant sub-16ms step transitions, update tour steps.

### H. Reports, PDF Generation & EmailOctopus
- [x] **REQ-53**: Multi-format exports: HTML, PDF, Word (.doc), and JSON.
- [x] **REQ-54**: EmailOctopus fix: do not auto-open greeting card before email is sent; use user/guest name instead of "custodian of [farm]"; allow choosing attachment format; remove raw "copy greeting card" button; elevate visual certificate styling; remove Vayganga references.
- [x] **REQ-55**: PDF Download fix (CRITICAL): Ensure downloaded PDF is NEVER 0 KB. Generate real, high-resolution vector/canvas PDF with complete styling and figures.
- [x] **REQ-56**: PDF Report header: replace "Farm / Study Area" with "Study Area".
- [x] **REQ-57**: PDF Report subtitle: remove "confidential and priority hydrological assessment".
- [x] **REQ-58**: PDF Report audience: address non-technical users, researchers, agronomists, hydrologists, and community stewards.
- [x] **REQ-59**: PDF Report watermark: make watermark logo and text darker and sharper.
- [x] **REQ-60**: PDF Report seal: replace stamp with official SEVA·GIS certified seal/logo.
- [x] **REQ-61**: PDF Report map framing: ensure all maps are at 19x–20x zoom, AOI strictly centered, HUD elements auto-sized to avoid AOI overlap.
- [x] **REQ-62**: PDF Report LULC map: render true 9-class colored classification raster (not plain image), fix legend title (remove "LSWAT" typo).
- [x] **REQ-63**: PDF Report Soil & Station maps: render true classified soil series and hydrologic station/stream layers, not plain images.
- [x] **REQ-64**: PDF Report scale bars: fix corrupt / blurry scale bars across all generated maps.
- [x] **REQ-65**: PDF Report results & discussion: integrate MATLAB charts, spectral decomposition, and continuous time series.
- [x] **REQ-66**: PDF Report legends: fix legends for NDVI, BSI, Slope, Contour, TWI, True Color, CIR, SWIR-NIR, Moisture stress, Land/Water contrast, Chlorophyll.
- [x] **REQ-67**: PDF Report SWAT-CUP calibration: dynamic to user's selected AOI, add collapsible "Why?" taglines.
- [x] **REQ-68**: PDF Report cadastre removal: remove cadastral land registry section from report.
- [x] **REQ-69**: Integration of StoryTold ArtCraft suite (PdfCraft, GridCraft, VectorCraft, DesignCraft, EffectCraft).
- [x] **REQ-70**: Reverse engineering of MATLAB (mathworks, morluto/rea).
- [x] **REQ-71**: Git commit, build verification, README.md update, and public sharing links.
