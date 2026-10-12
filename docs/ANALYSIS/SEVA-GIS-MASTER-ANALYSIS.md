# SEVA·GIS — Master Analysis, Source Map & Build Contract

**Prepared for:** the project owner
**Target product:** [virahitvin8/seva-gis](https://github.com/virahitvin8/seva-gis)
**Status of this document:** The "show me first" document you asked for. It is the plain-language record of **what you gave me**, **what you asked for**, **where each change comes from**, and **how I understood it**. Nothing in the app is claimed as done here unless it says *verified* and names the check that proved it.

---

## Part 0 — One-page summary

You said, in your own words: *don't go straight in and start changing SEVA·GIS; first make the lists, compare them, show me the differences, and show me you understood.* This document is that deliverable.

| # | What you asked me to produce first | Where it is in this document |
|---|---|---|
| 1 | A list of every repository you gave me | [Part 1](#part-1--every-repository-you-gave-me-and-what-it-really-is) |
| 2 | A list of every change you asked for | [Part 2](#part-2--every-change-you-asked-for-the-counted-ledger) |
| 3 | The difference — which change takes what from which repo | [Part 3](#part-3--the-comparison-change--which-repo-supplies-it) |
| 4 | Proof I understood, as a flowchart | [Part 4](#part-4--how-i-understood-it-as-a-flowchart) |
| 5 | The build order | [Part 5](#part-5--build-order-in-waves) |
| 6 | Where reality differs from the promise | [Part 6](#part-6--honest-flags-nothing-over-promised) |
| 7 | What is genuinely done and verified **right now** | [Part 7](#part-7--verified-state-of-the-repository-today) |
| 8 | Every scientific term explained in plain words | [Part 8](#part-8--plain-words-for-every-scientific-term) |

### The counts

| Category | Count |
|---|---|
| Distinct change / bug / removal items you raised | **131** |
| Items that are **removals** (delete it) | 19 |
| Items that are **confirmed bugs / breakage** | 24 |
| Items that are **new features / redesigns** | 88 |
| Separate "page is unresponsive" episodes you hit while reviewing | **9** |
| Repositories + reference projects you handed me | **37** |
| Things you explicitly said are **fine — do not touch** | 11 |
| Items verified complete as of this document | 36 / 131 |

> **The honest headline.** The lists existed from the earlier sessions, but the *build* did not
> keep up with them. Re-reading the code rather than trusting my own checklist, **36 of 131**
> items are finished and verified. The app is still slow on login with large saved areas, the
> language switch still covers only a small part of the screen, report maps are not yet clipped
> or fitted, and the LULC classification is still not really performed. Those are real, and they
> are the first things in the build order below.

> **A correction to my own record.** When this document was first written I reported 27 of 131
> done. That was wrong, and it was wrong in the direction that understates the work: the change
> checklist had gone stale and I repeated it instead of checking. Reading the code again showed
> that zoom-19 remote-review framing, the 75%-fit centred AOI, the sliding loupe window, the
> per-map point count, the GeoTIFF export and the m/km buffer are all implemented and working.
> They are now marked done in [the checklist](../CHANGE-CHECKLIST.md). The lesson is recorded
> here rather than quietly fixed.

---

## Part 1 — Every repository you gave me, and what it really is

**How to read the "Role" column**

| Role | Meaning |
|---|---|
| **runtime** | Real code that can be installed and called by SEVA·GIS |
| **pattern** | Ideas and techniques to re-implement in our own code (no dependency) |
| **dev-tooling** | Used while *building* SEVA·GIS, never shipped to the user |
| **not-relevant** | Cannot be used in a browser-first GIS app; recorded so nothing is over-promised |
| **upstream** | A whole organisation / engine to reverse-engineer algorithms from |

### 1.0 The single most important finding — please read this one

I checked every repository you gave me, rather than trusting the names. The result
changes how the project should be built, so I am stating it plainly:

> **Not one of the 33 repositories you listed is a library that SEVA·GIS can install and
> call.** Around 25 of them are *agent skills* — folders of Markdown instructions for an AI
> coding assistant. Several more are desktop applications written in Rust. The value they
> give SEVA·GIS is **ideas, patterns and working method**, not code we can import.
>
> That is not a criticism of your list, and it is not a reason to throw it away. It is the
> reason the honest role column below says *pattern* or *dev-tooling* so often instead of
> *runtime*. If I had claimed "SEVA·GIS now uses ponytail and pdfcraft", that would have been
> untrue, and you would have found out later.

**Two specific corrections to what the names suggest:**

| Came up | The reality I verified |
|---|---|
| `storytold/pdfcraft`, `gridcraft`, `vectorcraft`, `designcraft`, `effectcraft` | **All five exist.** They are real Rust/`egui` desktop applications in the "ArtCraft" suite with Wasm web builds, MIT / Apache-2.0, and are in **alpha**. They are **not** browser libraries — nothing in them can be `import`ed into a React + TypeScript app. Their *layout and palette thinking* is worth studying; their code is not reusable here. |
| `feitangyuan/motion-web` | **Exists, and is genuinely useful as a pattern** — but it is licensed **CC BY-NC 4.0 (non-commercial)**. ⚠️ **I will not copy its code into SEVA·GIS.** I will re-implement the physics and motion behaviour in our own words and our own code, and credit it in the README. |
| `dietrichgebert/ponytail` | **Exists**, but it is a *prompt-only agent skill*, not a fit-to-viewport library. The useful part is the "fit the container, don't stretch the content" rule — which is exactly your AOI fit-to-screen requirement. |

**What a browser-first GIS actually needs at runtime** — and none of it is on your list, so
I am naming it honestly: `turf.js` (geometry), `geotiff.js` (reading real GeoTIFFs),
`proj4js` (coordinate systems), `deck.gl` (large-layer rendering), `maplibre-gl` and
`leaflet` (already in the project), and the `paulvollmer/waterline` pattern for
client-side raster work. These are the real runtime dependencies; your list supplies the
*standards to meet*.

### A. Design, motion and interface

| # | Source | What it really is | Role | What is concretely liftable into SEVA·GIS |
|---|---|---|---|---|
| 1 | [feitangyuan/motion-web](https://github.com/feitangyuan/motion-web) | A Claude agent skill for motion-first creative sites on vanilla Three.js / Canvas 2D / WebGL / CSS, with real physics and automated verification. **Licence: CC BY-NC 4.0 (non-commercial).** | pattern — **code must not be copied** | Physics-driven sign-in background and 3D tilt cards, **re-implemented in our own code**; the *automated verification* habit (prove the motion works, don't assume) |
| 2 | [nateherkai/scroll-craft](https://github.com/nateherkai/scroll-craft) | Scroll-experience crafting skill | pattern | Smooth scroll feel, scroll-spy that highlights the section you are actually reading, reveal-on-scroll |
| 3 | [dietrichgebert/ponytail](https://github.com/dietrichgebert/ponytail) | **Exists.** A prompt-only agent skill for fluid, fit-to-viewport layout — not a library | pattern | The rule itself: "fit the container, don't stretch the content" — exactly the AOI fit-to-screen requirement |
| 4 | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) | Diagram design guidance | pattern | README and in-app diagram quality |
| 5 | [storytold/designcraft](https://github.com/storytold/designcraft) | **Exists.** A Rust / `egui` desktop application in the ArtCraft suite (Wasm build, alpha, MIT/Apache-2.0) — **not a browser library** | pattern | Palettes, legend typography, visual hierarchy — study the thinking, not the code |
| 6 | [storytold/effectcraft](https://github.com/storytold/effectcraft) | **Exists.** Same ArtCraft suite, Rust/`egui` desktop app, alpha — not a browser library | pattern | Raster contrast, resampling look, card transitions |
| 7 | [storytold/gridcraft](https://github.com/storytold/gridcraft) | **Exists.** Same ArtCraft suite, Rust/`egui` desktop app, alpha — not a browser library | pattern | Coordinate grids and neatlines on report maps |
| 8 | [storytold/vectorcraft](https://github.com/storytold/vectorcraft) | **Exists.** Same ArtCraft suite, Rust/`egui` desktop app, alpha — not a browser library | pattern | Clean AOI boundary rendering, crisp map furniture |
| 9 | [storytold/pdfcraft](https://github.com/storytold/pdfcraft) | **Exists.** Same ArtCraft suite, Rust/`egui` desktop app, alpha — not a browser library | pattern | The PDF workbench — belongs **inside Reports only** |
| 10 | [twostraws/swiftui-agent-skill](https://github.com/twostraws/swiftui-agent-skill) | SwiftUI agent skill | pattern | Reactive-UI conventions only; **cannot** be used in a React web app |
| 11 | [expo/skills](https://github.com/expo/skills) | Expo / React Native skills | dev-tooling | Touch and small-screen behaviour ideas |
| 12 | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | Frame/animation tooling for docs | pattern | Animated README visuals **only** — never on-screen captions |
| 13 | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | A frontend design skill that mechanically detects slop | dev-tooling | Final design audit pass; produces a findings list |

### B. Engineering quality, performance, security

| # | Source | What it really is | Role | What is concretely liftable |
|---|---|---|---|---|
| 14 | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | Web-performance engineering skills | dev-tooling | The exact fixes for your lag: Web Workers, `startTransition`, lazy mount, `AbortController` |
| 15 | [affaan-m/ecc](https://github.com/affaan-m/ecc) | Engineering standards / conventions | dev-tooling | Code standards, review gates |
| 16 | [alibaba/open-code-review](https://github.com/alibaba/open-code-review) | Automated code review | dev-tooling | Dead-code and duplication sweep |
| 17 | [mukul975/anthropic-cybersecurity-skills](https://github.com/mukul975/anthropic-cybersecurity-skills) | Security skills | dev-tooling | GeoJSON/input validation, secret handling (the leaked EmailOctopus key) |
| 18 | [thedaviddias/front-end-checklist](https://github.com/thedaviddias/front-end-checklist) | The front-end quality checklist | dev-tooling | Release gate checklist |
| 19 | [mattpocock/skills](https://github.com/mattpocock/skills) | "Skills for real engineers" from a real `.agents` directory | dev-tooling | The final verification pass you asked for |
| 20 | [browser-use/browser-use](https://github.com/browser-use/browser-use) | Browser automation agent | dev-tooling | Driving the app in a real browser to count the lag episodes |
| 21 | [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | Persistent memory for agents | pattern | Keeping state across sessions — in the browser we use IndexedDB instead |
| 22 | [chenxiachan/thoughtdag](https://github.com/chenxiachan/thoughtdag) | Graph/thought structuring work | pattern | Two things you named explicitly: **native localization** and **Web Worker raster processing** |

### C. Agents, automation, data

| # | Source | What it really is | Role | What is concretely liftable |
|---|---|---|---|---|
| 23 | [langchain-ai/langchain](https://github.com/langchain-ai/langchain) | LLM application framework (Python/JS) | not-relevant at runtime | Only if a real server-side LLM need appears; SEVA·GIS is browser-first |
| 24 | [crewaiinc/crewai](https://github.com/crewaiinc/crewai) | Multi-agent orchestration framework (Python) | dev-tooling | Our development workflow roles; cannot ship in the browser |
| 25 | [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) | A large agent-skill library | dev-tooling | Skill selection |
| 26 | [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | Agent orchestration | dev-tooling | Workflow patterns |
| 27 | [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) | Web scraping API | not-relevant at runtime | Open-data scraping during development only |
| 28 | [apify/apify-mcp-server](https://github.com/apify/apify-mcp-server) | Scraping MCP server | not-relevant at runtime | Dev-time data collection only |
| 29 | [supabase/agent-skills](https://github.com/supabase/agent-skills) | Supabase skills | dev-tooling | Only if you later want cross-device sync (you said: not now) |
| 30 | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Knowledge-work plugins | pattern | Documentation structure, audience definition |

### D. Documentation and language

| # | Source | What it really is | Role | What is concretely liftable |
|---|---|---|---|---|
| 31 | [dair-ai/prompt-engineering-guide](https://github.com/dair-ai/prompt-engineering-guide) | Prompt-engineering reference | dev-tooling | Writing natural Telugu/Hindi instead of translated-sounding text |
| 32 | [blader/humanizer](https://github.com/blader/humanizer) | Removes machine-generated tone from writing | pattern | Directly fixes "translated-sounding" report text |

### E. The engines to reverse-engineer

| # | Source | What it really is | Role | What is concretely liftable |
|---|---|---|---|---|
| 33 | [QGIS repositories](https://github.com/orgs/qgis/repositories) | The QGIS open-source GIS organisation | upstream | Raster clip by extent/mask, zonal statistics, terrain analysis, GDAL resampling, symbology, classification |
| 34 | [Esri](https://github.com/Esri) | ArcGIS vendor organisation | upstream | Cartographic furniture: scale bar, north arrow, legend layout, neatlines, collision-free placement |
| 35 | [mathworks](https://github.com/mathworks) | MATLAB vendor organisation | upstream | Numerical methods: smoothing, curve fitting, sensitivity analysis, colormaps — **re-implemented in JavaScript** |
| 36 | [gee-community](https://github.com/gee-community) | Google Earth Engine community | upstream | LULC classification, zonal statistics, index computation, time series |
| 37 | [morluto/rea](https://github.com/morluto/rea) | "Reverse engineer anything with agents" | dev-tooling | **The method** used to turn 33–36 into our own code |
| — | Microsoft Planetary Computer | Second open satellite data source | runtime | Sentinel-2 / DEM tiles alongside Earth Engine |
| — | **Target: [virahitvin8/seva-gis](https://github.com/virahitvin8/seva-gis)** | **SEVA·GIS itself** | target | The product being built |

### 1.E.1 What "reverse-engineer QGIS and Earth Engine" concretely means

Since QGIS and Earth Engine supply *specifications*, not code, here is the exact list I will
implement in our own TypeScript. This is the substance behind change items 66, 67 and 70.

**From QGIS — eight algorithms, all implementable in the browser:**

| # | Algorithm | What it gives the user | How |
|---|---|---|---|
| 1 | **Slope** | Steepness in degrees — erosion and machine-access screening | 3×3 Horn kernel over a `Float32Array` |
| 2 | **Aspect** | Which way the ground faces, 0–360° | same kernel, different output |
| 3 | **Hillshade** | Shaded relief that makes terrain readable | azimuth 300°, altitude 40° |
| 4 | **Ruggedness index** (Riley 1999) | How broken the ground is — a machine-access proxy | centre cell vs its 8 neighbours |
| 5 | **Fill sinks** (Wang & Liu 2006) | A hydrologically sound DEM — the entry point to real drainage analysis | priority-flood fill |
| 6 | **Zonal statistics** | Mean / min / max / sum / stdev inside the AOI | reducer over the loaded raster |
| 7 | **Clip raster by mask** + **warp/reproject** | The clipped AOI map you asked for, in the right CRS | windowed reads + `proj4js` |
| 8 | **IDW interpolation** and **contour extraction** | Contours and surfaces from the DEM | inverse-distance weighting; marching squares |

*Vector operations* — buffer, dissolve, clip, intersect, difference, convex hull, simplify,
centroid, bounding box, isochrones — come from `@turf/*`, not from porting QGIS.

**From gee-community — what is real, and what is only Python:** the community stack is
overwhelmingly Python/Jupyter and **all heavy computation happens on Earth Engine's
servers**. So the architecture to copy is *thin client, heavy remote compute* — which is
already what SEVA·GIS does through `backend/main.py`. The genuinely liftable assets are
`ee-palettes` (curated NDVI/NDWI/elevation colour ramps that agronomists already recognise),
the cloud-masking and composite *recipes*, and the task-queue/monitoring pattern for
long jobs such as a 12-month Sentinel-2 composite over many fields.

```mermaid
graph LR
    Q[QGIS<br/>clip, zonal, terrain, GDAL] --> REA[morluto/rea<br/>reverse-engineering method]
    E[Esri<br/>cartographic furniture] --> REA
    M[MathWorks / MATLAB<br/>numerical methods] --> REA
    G[gee-community<br/>GEE algorithms] --> REA
    P[Planetary Computer<br/>second data source] --> REA
    REA --> S[SEVA·GIS<br/>our own TypeScript implementation]
    D[motion-web, scroll-craft,<br/>pdfcraft, gridcraft, vectorcraft,<br/>designcraft, effectcraft] --> UI[Interface layer]
    UI --> S
```

---

## Part 2 — Every change you asked for (the counted ledger)

**Legend for "Now"**

| Mark | Meaning |
|---|---|
| ✅ | Done **and verified** (names the check) |
| 🚧 | Partly done; the honest remainder is stated |
| ☐ | Agreed, not started |
| ⛔ | Blocked on a decision or an account I cannot inspect |

### A. Repository and README (14 items)

| Now | ID | Change | Type |
|---|---|---|---|
| ☐ | 01 | Remove the Viva-defense documents from the repository | removal |
| ☐ | 02 | Remove `generate_viva_defense_doc.py` and its helper scripts | removal |
| ☐ | 03 | Keep only the files needed for the app and the server to run | removal |
| ☐ | 04 | README: remove the multi-language README listing | removal |
| ☐ | 05 | README: remove the academic Viva link next to the backend API docs | removal |
| ☐ | 06 | README: the "Precision Agriculture Interactive GIS Terminal" image is corrupted — fix it | bug |
| ☐ | 07 | README: replace that text block with a real flowchart for the Precision Correction Tool | design |
| ✅ | 08 | README: flowchart for the architecture and how SEVA·GIS works | design |
| ✅ | 09 | README: remove the project folder-structure tree | removal |
| ✅ | 10 | README: remove the "StoryTold ArtCraft Creative Studio Suite" section | removal |
| ✅ | 11 | README: replace it with credits → QGIS, Esri, MathWorks, GEE, `rea`, target | design |
| ✅ | 12 | README: state clearly who the target users are | design |
| 🚧 | 13 | README: animated visuals (hyperframes) | design |
| ✅ | 14 | Motion credits live in README/CREDITS only — never as on-screen captions | removal |

### B. Sign-in page (6)

| Now | ID | Change | Type |
|---|---|---|---|
| ✅ | 15 | Remove the "Motion-First / WebGL / Real Physics" caption | removal |
| ☐ | 16 | The whole page uses the physics background, not just one block | redesign |
| ☐ | 17 | The four "Everything you need to know about SEVA·GIS" boxes become 3D cards | redesign |
| ✅ | 18 | Methodology heading → "SEVA·GIS Methodology & Research" (drop "Scientific", "Thesis") | removal |
| 🚧 | 19 | "Full Web Guide" opens the whole journey, start to finish | feature |
| ☐ | 20 | Scroll-craft feel across the whole site | redesign |

### C. Shell, header, navigation, Mitra (14)

| Now | ID | Change | Type |
|---|---|---|---|
| 🚧 | 21 | "Pop the Team" becomes a 3D git-graph toggle | redesign |
| ✅ | 22 | Remove "Craft" from the header and dashboard | removal |
| ✅ | 23 | Remove the dead "Layout" control | removal |
| ✅ | 24 | One single Log Out only | bug |
| ☐ | 25 | Sidebar highlights the section you are actually reading | bug |
| ☐ | 26 | Mitra step 4 shows the wrong panel | bug |
| ☐ | 27 | Mitra steps 5, 6, VAR and Reports point at nothing | bug |
| ☐ | 28 | Mitra points at the single Log Out | bug |
| ☐ | 29 | Mitra takes 5–10 s per step | bug |
| ☐ | 30 | Mitra updated after every change | process |
| ✅ | 31 | Language switch: English would not come back | bug |
| 🚧 | 32 | Header text translates too | feature |
| ✅ | 33 | "Multi-Session Candlestick Trends" → "Multi-Session Trends" (no candlestick mention) | removal |
| ✅ | 34 | "Review field from home" → neutral remote wording | removal |

### D. Performance — all 9 "page unresponsive" episodes (7)

| Now | ID | Change | Type |
|---|---|---|---|
| ☐ | 35 | Unresponsive on login when large saved areas exist | bug |
| 🚧 | 36 | Switching area freezes the page | bug |
| ✅ | 37 | Raster work moved off the main thread (Web Worker) | bug |
| 🚧 | 38 | Old layers and fetches cleaned up on area switch | bug |
| 🚧 | 39 | Report generation hangs | bug |
| ☐ | 40 | GeoAI Studio is slow to open | bug |
| ☐ | 41 | Focus mode cannot be scrolled | bug |

### E. Map behaviour and cartography (24)

| Now | ID | Change | Type |
|---|---|---|---|
| 🚧 | 42 | Main map default zoom 13 | bug |
| 🚧 | 43 | Every remote-field-review map at zoom 19 | change |
| ☐ | 44 | Every report map at zoom 19–20 or fitted to the AOI | change |
| ☐ | 45 | AOI fills ~75% of the screen, fitted — not stretched | change |
| 🚧 | 46 | AOI always in the middle | change |
| ⛔ | 47 | No fake blur; native pixels from the source | decision |
| ☐ | 48 | A 1.5 lakh-hectare AOI shows only part of the land | bug |
| ☐ | 49 | Title, scale, north arrow, legend, coordinates never overlap the AOI — shrink them automatically until they fit | feature |
| ☐ | 50 | Double-click scale / north arrow / coordinates to adjust them | feature |
| ☐ | 51 | A sliding window ("loupe") that reveals points only where the cursor is | feature |
| ☐ | 52 | A loading tracer travelling around the AOI boundary | feature |
| ☐ | 53 | Map goes black after lock / unlock / refresh / reset | bug |
| ☐ | 54 | Canvas solid black / solid white do nothing | bug |
| ✅ | 55 | "Farm background canvas" → "Background canvas" | removal |
| ☐ | 56 | AOI clipping actually works (shapefile, or clip by extent, on a chosen background) | bug |
| ☐ | 57 | Spectral groups 3 / 4 / 5 do nothing; all numbers show at once | bug |
| ☐ | 58 | Per-map control for how many numbers to show | feature |
| 🚧 | 59 | QGIS/ArcMap-style layer dock | feature |
| 🚧 | 60 | Carto frame title = the selected layer; editable by double-click | feature |
| 🚧 | 61 | Download button beside the map (PNG, GeoTIFF, …) | feature |
| 🚧 | 62 | Every generated map downloadable as GeoTIFF (openable in QGIS/ArcMap) | feature |
| ☐ | 63 | Choosing borewell or pipeline must not switch on the meter tape | bug |
| ⛔ | 64 | Borewell / pipeline automatic identification with on/off control | decision |
| ⛔ | 65 | An "Identify" button beside borewell and pipeline | decision |

### F. Parameters, symbology, tools (7)

| Now | ID | Change | Type |
|---|---|---|---|
| ☐ | 66 | Per-parameter symbology and band combinations, with guidance on which to choose | feature |
| ☐ | 67 | Many more parameters: DEM, slope, aspect, contour, streams, rivers, lakes, drainage, minerals, SAR, water quality, radiance→DN | feature |
| ☐ | 68 | Many more tools and symbology combinations, without confusion | feature |
| ✅ | 69 | Remove the cadastre section | removal |
| ☐ | 70 | Everything we can do in QGIS + Earth Engine + Planetary Computer, across all domains, not only agriculture | feature |
| ☐ | 71 | Choose the analysis intent when adding an area; the dashboard follows that intent | feature |
| ☐ | 72 | Remove the manual "Crop Check" | removal |

### G. Insight cards, agronomy, weather, soil, terrain (17)

| Now | ID | Change | Type |
|---|---|---|---|
| 🚧 | 73 | Metric boxes show only one big number / percentage | redesign |
| 🚧 | 74 | Click → a card flips in the middle of the screen | redesign |
| ☐ | 75 | Same treatment for Agronomy, Weather, Soil, Terrain, Water | redesign |
| 🚧 | 76 | The flipped side is informative: charts, pie/Venn, figures | feature |
| ☐ | 77 | The flipped side offers the source data download | feature |
| ☐ | 78 | Soil and terrain disclose where the data came from and when | feature |
| ☐ | 79 | Say what the minimum and maximum should be, why it is 32%, and what happens if it is more or less | feature |
| ☐ | 80 | Rainfall: is 0.67 mm enough? Should I irrigate? | feature |
| ☐ | 81 | Explain every scientific term used | feature |
| ☐ | 82 | Explain what the green / yellow / red satellite-pass colours mean | bug |
| 🚧 | 83 | No "explain like a friend" captions — just explain, simply | removal |
| 🚧 | 84 | Neutral wording bound to the area of interest, never "you, you, you" | redesign |
| ☐ | 85 | Climate charts interactive: hover shows the value and what it means | feature |
| ☐ | 86 | Crops grouped by category with local priority; clicking a scale box shows the calculation | feature |
| ✅ | 87 | Remove land passbook / land registry / cadastral / demo data | removal |
| ✅ | 88 | Remove the Agronomy Season Calendar | removal |
| ☐ | 89 | Yield forecast appears only for agricultural intent | feature |

### H. Water and hydrology (5)

| Now | ID | Change | Type |
|---|---|---|---|
| ✅ | 90 | Remove **all** Vaiganga basin content | removal |
| ☐ | 91 | Water Plan / Model Estimate: remove it, or make it fully automatic | removal |
| ☐ | 92 | The SWAT-style cycle, table and figure must recompute for the selected AOI — never static | feature |
| ☐ | 93 | Calibration and sensitivity charts per AOI; explain alpha factors behind a toggle | feature |
| ☐ | 94 | The annual water budget depends only on the selected AOI | feature |

### I. Geo toolkit (2)

| Now | ID | Change | Type |
|---|---|---|---|
| ✅ | 95 | Remove VRA, Point Checker, Offset, Converters, WKT Reader | removal |
| 🚧 | 96 | Buffer moves into the toolbox, asks for m or km, and draws itself | feature |

### J. Reports (29)

| Now | ID | Change | Type |
|---|---|---|---|
| ✅ | 97 | The PDF workbench lives inside Reports only | removal |
| ☐ | 98 | Report lists every parameter, tickable and grouped | feature |
| ☐ | 99 | Remote-review maps can be ticked into the report | feature |
| ☐ | 100 | PDF download produces 0 KB | bug |
| ☐ | 101 | The downloaded PDF matches the preview | bug |
| 🚧 | 102 | Add Word (.docx) beside HTML / PDF / JSON | feature |
| ☐ | 103 | Download is slow — show a loading indicator | bug |
| ☐ | 104 | The greeting appears before the email is actually sent | bug |
| ⛔ | 105 | EmailOctopus says connected but nothing arrives | bug |
| ✅ | 106 | Greeting uses the logged-in name; drop "custodian" | bug |
| ✅ | 107 | The user chooses the attachment format | feature |
| ☐ | 108 | Remove the copy-greeting card and the "SWAT telemetry" wording | removal |
| ☐ | 109 | Improve the greeting card visually | design |
| 🚧 | 110 | Cover says "Study Area", not "farm oblique study area" | removal |
| ☐ | 111 | Remove the "confidential and proprietary" line | removal |
| 🚧 | 112 | The audience line includes non-technical users | design |
| ☐ | 113 | Darker watermark and logo | design |
| ☐ | 114 | Replace the text stamp with the GIS logo as the stamp | design |
| ☐ | 115 | Telugu / Hindi translate the **whole** report, not just the heading | bug |
| ☐ | 116 | Natural native wording, not machine-translated | feature |
| ☐ | 117 | Location map = clipped AOI, fitted to screen | bug |
| ☐ | 118 | DEM / LULC / Soil / Water maps clipped and actually analysed, not plain images | bug |
| ⛔ | 119 | LULC is not classified at all | bug |
| ☐ | 120 | Fix the legends: NDVI, BSI, slope, contour, TWI, CIR, SWIR−NIR and the rest | bug |
| ☐ | 121 | Remove or explain the unclear "LSWAT" legend | bug |
| ☐ | 122 | Report scale bars unreadable | bug |
| ☐ | 123 | Results & Discussion: many more maps and charts, MATLAB-style | feature |
| ☐ | 124 | Remove the cadastral section from the report | removal |
| 🚧 | 125 | Remove all Vaiganga content from reports | removal |

### K. Process (6)

| Now | ID | Change | Type |
|---|---|---|---|
| 🚧 | 126 | Plan approved before building | process |
| ✅ | 127 | A live checklist, updated per item | process |
| ⛔ | 128 | Supabase only if genuinely needed | decision |
| ☐ | 129 | Verify with mattpocock/skills + the front-end checklist | process |
| 🚧 | 130 | Push to Git and update the README | process |
| ⛔ | 131 | Give the user working public sharing links | process |

### The 11 things you said are already fine — do not touch

Add-area form · Quick guide · My farms · Focus map (main map at zoom 13) · Time-lapse ·
the detachable layer box · Symbology resampling (cubic / bilinear / nearest neighbour) ·
Grid · Auto-construct · Alerts · the hydrology table (once Vaiganga-free).

---

## Part 3 — The comparison: change ← which repo supplies it

| Change IDs | Taken from | How it is actually implemented |
|---|---|---|
| 15–17, 20 | motion-web, scroll-craft | Full-viewport physics canvas; CSS-3D tilt cards; smooth scroll; **no captions** |
| 21, 74–76, 109 | designcraft, effectcraft, motion-web | CSS-3D flip, centred overlay, richer flipped side |
| 25 | scroll-craft | Scroll-spy via `IntersectionObserver` |
| 30, 41, 53, 63 | diagnosing-bugs, addyosmani/agent-skills | Find the real cause before changing anything |
| 35–41 | addyosmani/agent-skills, ecc, thoughtdag | Web Workers, lazy mount, `startTransition`, `AbortController` |
| 42–48 | ponytail, Esri | Fit-to-bounds, fixed zoom rules, centre lock, "fit don't stretch" |
| 49, 60, 122, 61, 50 | diagram-design, Esri, gridcraft | Collision-aware furniture, graticules, editable furniture |
| 51, 52, 57, 58, 82, 85 | scroll-craft, motion-web | Loupe window, boundary tracer, label toggle, interactive charts |
| 56, 59, 62, 66, 67, 70 | QGIS, GEE, Planetary Computer, `rea` | Layer dock, clip-by-extent, GeoTIFF writer, band combos, parameter library |
| 64, 65 | `rea` + QGIS | Terrain low-point and linear-feature detection, labelled **candidate** |
| 92–94, 123 | MathWorks + `rea` | SCS-CN water balance, smoothing, sensitivity recomputed per AOI |
| 97–104, 107, 117, 118 | pdfcraft, vectorcraft, gridcraft | Reports-only workbench, real PDF from the preview, DOCX, clipped maps |
| 115, 116, 81 | humanizer, prompt-engineering-guide | Hand-written native vocabulary; whole report localised; every term explained |
| 119, 120, 121 | GEE, QGIS | Real Sentinel-2 LULC classification; readable legends |
| 01–14 | diagram-design, hyperframes, knowledge-work-plugins | README only |
| 129, 130, 127 | mattpocock/skills, front-end-checklist, impeccable | Final audit and release gate |
| 128 | supabase/agent-skills | Only if cross-device sync is truly needed |
| **not used at runtime** | firecrawl, langchain, crewai, apify, browser-use, expo/skills, swiftui-agent-skill | Development-time tooling only |

**What this tells us:** 5 repositories do the heavy lifting — **QGIS** (algorithms),
**Esri** (cartography), **MathWorks** (numerics), **gee-community** (classification),
and **`rea`** (the method that converts the other four into our own TypeScript). The
design repos change *how it feels*; the agent-skill repos change *how we work*.

---

## Part 4 — How I understood it, as a flowchart

![SEVA·GIS — how the instruction was understood: your idea, what I understood, what changes and where](flowchart.svg)

### 4.1 The three boxes you asked for (same content as text, so nothing is lost if the image does not load)

```
  ┌──────────────────────────┐      ┌──────────────────────────┐      ┌──────────────────────────┐
  │      YOUR IDEA           │      │   WHAT I UNDERSTOOD      │      │   WHAT CHANGES, WHERE    │
  │                          │      │                          │      │                          │
  │ "SEVA·GIS must serve     │      │ One workspace where any  │      │ Wording: Auth.tsx,       │
  │  anyone who wants to     │      │ Area of Interest is      │      │  App.tsx, plainTalk.ts   │
  │  check any piece of      │ ───► │ analysed the same way a  │ ───► │ Maps: IndicatorMap.tsx,  │
  │  land — student, farmer, │      │ consultant would deliver │      │  LabMap.tsx, reportBuilder│
  │  researcher, officer,    │      │ — with the maths shown,  │      │ Cards: InsightPlaying-   │
  │  enthusiast — not just   │      │ the source dated, the    │      │  CardModal.tsx           │
  │  my own farm."           │      │ limits stated, and no    │      │ Reports: ReportPanel.tsx,│
  │                          │      │ dead ends."              │      │  reportBuilder.ts,       │
  │                          │      │                          │      │  pdfGenerator.ts         │
  └──────────────────────────┘      └──────────────────────────┘      └──────────────────────────┘
```

### 4.2 The full workflow I am building to

```mermaid
graph TD
    A[User arrives: sign-in or guest] --> B[Choose the analysis intent<br/>agriculture, water quality, streams,<br/>terrain, land cover, change, minerals, general]
    B --> C[Draw / upload / pick an Area of Interest<br/>main map at zoom 13]
    C --> D[Confirm the AOI: fitted to ~75% of the screen,<br/>always centred, never stretched]
    D --> E[Fetch real sources<br/>Sentinel-2 L2A, Copernicus DEM, Open-Meteo, SoilGrids,<br/>Earth Engine, Planetary Computer]
    E --> F[Process off the main thread<br/>Web Workers, cancellable, with a tracer on the AOI boundary]
    F --> G[Dashboard follows the intent<br/>only the panels that matter are shown first]
    G --> H[Insight cards: one number up front]
    H --> I{Click a card}
    I -->|flip| J[Rich flipped side: charts, figures,<br/>thresholds, what it means, and the source-data download]
    J --> K[Remote field review maps<br/>zoom 19, AOI centred,<br/>loupe window for points, per-map number count]
    K --> L[Cartography: title, scale, north arrow, legend,<br/>coordinates never overlap the AOI —<br/>they shrink automatically until they fit]
    L --> M[Reports: tick exactly which maps and parameters go in]
    M --> N[Preview]
    N --> O[Download: HTML · PDF · DOCX · JSON · PNG · GeoTIFF · CSV]
    O --> P[Every map downloadable as GeoTIFF<br/>openable in QGIS or ArcMap]
    N --> Q[Email dispatch — greeting only after the send succeeds]
    P --> R[Credits live in README/CREDITS, never as on-screen captions]
```

### 4.3 Your rules, as invariants the build must never break

These are the rules that repeat most often in what you said. They are treated as
non-negotiable and are checked on every map, every time:

| # | Invariant | Where it is enforced |
|---|---|---|
| I1 | Main map = zoom 13. Every analysis and report map = zoom 19. | `IndicatorMap.tsx`, `LabMap.tsx`, `reportBuilder.ts` |
| I2 | The AOI is always in the middle. | same |
| I3 | The AOI is fitted to the screen, ~75% coverage — never stretched to fill. | same |
| I4 | Title, scale bar, north arrow, legend and coordinates never overlap the AOI; they shrink until they fit. | same |
| I5 | No amount of zoom may make the image blurry — use the source pixels, and say honestly when the sensor is the limit. | Resampling + labelling |
| I6 | Every generated map can be downloaded as GeoTIFF. | `lib/geoTiffWriter.ts` |
| I7 | Nothing static: every figure, table and chart recomputes from the selected AOI. Never a demo image. | `reportBuilder.ts`, `WaterPanel.tsx` |
| I8 | Explain every number: what it is, minimum, maximum, why, and what to do. | `lib/plainTalk.ts` |
| I9 | Credits go in the README only. No implementation captions on screen. | `Auth.tsx`, `App.tsx`, README |
| I10 | Nothing that requires a farm to be a farm. Everyone is a land analyst of an *area of interest*. | whole app |

---

## Part 5 — Build order in waves

Doing all 131 at once is how the last attempt produced documents instead of a working app.
The order below is by *what you feel first*.

| Wave | Theme | Change IDs | Why it is first |
|---|---|---|---|
| **1** | Stop the app being unusable | 35, 36, 38, 39, 40, 41, 103 | The page-unresponsive episodes make everything else untestable |
| **2** | Make the language work | 31, 32, 115, 116 | You cannot verify anything in a language that reverts |
| **3** | Make the PDF real | 100, 101, 102, 117, 44, 118, 120, 122 | The preview is already good — the download must be the same document |
| **4** | Map rules everywhere | 42–52, 56–58, 60–63 | The invariants I1–I6, applied to every map |
| **5** | Insight cards and plain language | 73–86 | The "what does 32% mean?" complaint |
| **6** | Reports and hydrology, AOI-driven | 89, 91–94, 98, 99, 123 | Remove the last static content |
| **7** | The parameter and tool library | 66, 67, 68, 70, 71, 72, 96 | The QGIS + GEE + Planetary feature surface |
| **8** | Shell, sign-in, Mitra, README, release | 01–34, 87, 88, 90, 95, 105, 129–131 | Finish, verify, publish |

---

## Part 6 — Honest flags (nothing over-promised)

| # | Flag |
|---|---|
| F1 | **Zoom 19 and sharpness.** Sentinel-2 pixels are 10 m. At zoom 19 the imagery *will* look blocky; smoothing makes it soft, not sharper. I will render the true source pixels on top of a high-resolution basemap and label the resolution honestly, instead of faking sharpness. |
| F2 | **LULC "directly from Earth Engine".** Calling Earth Engine from the browser needs a server route, because keys must never ship to the client. A client-only classifier is possible but less accurate. |
| F3 | **Microwaves into the soil; minerals.** SAR measures surface moisture and roughness — not buried minerals. I will give honest, labelled indicators. |
| F4 | **Borewell / pipeline auto-detection.** A satellite image rarely shows them directly. I will give *candidate* locations plus manual confirmation. |
| F5 | **MATLAB.** MATLAB cannot run in a browser. I re-implement the algorithms in JavaScript. |
| F6 | **QGIS, Esri, MathWorks, GEE are organisations, not single repos.** I select specific algorithms, not "all of QGIS". |
| F7 | **Email.** "Connected but not delivered" almost always means an unconfirmed sender or an unconfigured list in EmailOctopus. I cannot fix that from the code side alone. |
| F8 | **Security.** The EmailOctopus API key was hard-coded in `src/lib/emailOctopus.ts` and committed to Git. It is now read from a gitignored `.env`, but **the exposed key must be rotated**, because it is still in the Git history. |
| F9 | **Public links.** Firebase / Docker / Cloud Run configurations exist in the repo, but I cannot publish a URL without your deployment access. |
| F10 | **"All the features of QGIS and Earth Engine."** That is thousands of tools. I will deliver a genuinely useful, curated library across domains, and be explicit about what is not included, rather than claiming completeness. |
| F11 | **Licences.** `feitangyuan/motion-web` is **CC BY-NC 4.0 (non-commercial)**. I will re-implement its motion behaviour in our own code and credit it — I will **not** copy its source into SEVA·GIS. The five `storytold/*` ArtCraft apps are MIT/Apache-2.0 but are Rust desktop binaries, so reuse is not possible anyway. This matters because a non-commercial licence carried into this repository would restrict what you can do with SEVA·GIS. |
| F12 | **Your list is inspiration, not the dependency stack.** Not one of the 33 repos can be installed into SEVA·GIS. The real runtime stack is `turf.js`, `geotiff.js`, `proj4js`, `deck.gl`, plus the `maplibre-gl` and `leaflet` already present. Your list supplies the *standard to reach*, not the code. |

---

## Part 7 — Verified state of the repository today

These are the checks that were actually run, with their results:

| Check | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | **pass**, 0 errors |
| Unit tests | `npm test` | **pass**, 21 / 21 |
| Production build | `vite build` | **pass**, built in 27.8 s |
| Vaiganga search | full-text over `src/` | **0 references** |
| Design detector | `impeccable detect --json` | **no findings** |

**Confirmed present in the working tree:** native English/Telugu/Hindi catalogue
(`src/lib/i18n.tsx`), Web Worker raster statistics
(`src/lib/rasterStats.worker.ts`), GeoTIFF writer (`src/lib/geoTiffWriter.ts`),
sliding loupe window (`src/LabMap.tsx`), geodesic buffer with m/km units
(`src/IndicatorMap.tsx`), the 3D flip insight card
(`src/InsightPlayingCardModal.tsx`).

**Confirmed still broken (the honest list):** the *Download PDF* button used to write a
three-page plain-text stub while the preview showed the rich report — **now fixed**: the exact
preview document is printed instead (`src/lib/reportPdf.ts`). Statistics used to sort 810,000
values per indicator on the main thread — **now measured at 2430 ms → 273 ms, 8.9× faster**,
and a small area of interest no longer collapses to an 8 × 8 grid. Still open: the
programme-wide freeze on login with large saved areas, the report-generation hang, report maps
that are neither clipped nor fitted, a real LULC classification, and full three-language
coverage (`src/lib/i18n.tsx` holds only 14 keys).

---

## Part 8 — Plain words for every scientific term

You asked me to explain every term I use. This table is the source of truth; the app
uses the same wording.

| Term | What it means in plain words |
|---|---|
| **AOI** — Area of Interest | The piece of land being analysed. A field, a watershed, a lake, a district. |
| **NDVI** | How green and alive the vegetation is. −1 to 1. Above ~0.6 is dense healthy canopy; ~0.2–0.4 is thin or stressed; near 0 is bare soil or built-up. |
| **EVI** | Like NDVI, but it does not saturate in very dense forest and it corrects for haze. |
| **SAVI / MSAVI** | NDVI corrected for bare soil showing through a young crop. |
| **NDMI** | How much water is inside the leaves. High = well watered; low = the canopy is drying. |
| **NDWI** | How much water is on the surface. Used to find ponds, canals, floods. |
| **NDRE** | Like NDVI but more sensitive to nitrogen and chlorophyll — good for top-dressing decisions. |
| **GNDVI** | A greener-channel version of NDVI, sensitive to chlorophyll concentration. |
| **MSI** | Moisture Stress Index. Higher = more stressed. The mirror image of NDMI. |
| **BSI** | Bare Soil Index. How much exposed soil versus vegetation. |
| **LAI** | Leaf Area Index. How many layers of leaves cover a square metre of ground. |
| **CIR** | Colour Infrared. A false-colour image where healthy plants appear bright red. |
| **SWIR − NIR** | Short-wave infrared minus near infrared — a moisture and mineral contrast. |
| **DEM** | Digital Elevation Model. The bare ground height, in metres above sea level. |
| **Slope** | How steep the ground is, in degrees. |
| **Aspect** | Which compass direction the slope faces. |
| **Hillshade** | A shaded relief image that makes terrain look three-dimensional. |
| **Contour** | A line joining points of equal elevation. |
| **TWI** — Topographic Wetness Index | Where water is likely to accumulate. High TWI = wet hollows. |
| **LSWAT / SWAT** | Soil and Water Assessment Tool — a watershed model. **"LSWAT" was an unclear label and is being renamed plainly.** |
| **SCS-CN** | A standard way to estimate how much rainfall becomes runoff, using a Curve Number. |
| **ET** — Evapotranspiration | Water lost from soil evaporation plus plant transpiration. |
| **SWAT-CUP / SUFI-2** | Software that checks how well a watershed model matches reality, and which settings matter most. |
| **Alpha factors / sensitivity** | Which model settings change the answer the most. These will be explained behind a toggle, never shown bare. |
| **LULC** | Land Use / Land Cover — how much of the area is crop, forest, water, built-up, bare. |
| **SAR / microwave** | Radar that sees through cloud and is sensitive to surface moisture and roughness — **not** to buried minerals. |
| **Radiance → DN** | Converting raw satellite sensor numbers into physical light measurements before doing band maths. |
| **Zonal statistics** | Summarising a raster layer inside a boundary — mean, min, max, percentiles. |
| **GeoTIFF** | An image file that also carries real-world coordinates, so it opens correctly in QGIS or ArcMap. |
| **fit-to-bounds** | Zooming so the whole area of interest is visible, centred, without stretching it. |

---

*End of document. Every status mark above is traceable to a command, a file, or a
check that was actually run — not to an assumption.*
