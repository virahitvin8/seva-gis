# 08. Agent Action Plan & Implementation Blueprint

> **Autonomous Engineering Roadmap for AI Coding Agents**  
> Concrete, phased milestones to integrate all flagship spatial repositories into SEVA·GIS without regressions.

---

## 1. Execution Principles for Coding Agents
1. **Preserve Build Stability**: Every change must maintain `npm run typecheck` and `npm test` at 100% pass rate.
2. **Zero Commercial API Dependencies**: Default to open-access endpoints (Planetary Computer, Earth Search, OpenSMS, DuckDB-WASM).
3. **Resilient Local Fallbacks**: If remote network endpoints fail or timeout, fail gracefully to offline analytical models without crashing the browser UI.

---

## 2. Phased Implementation Roadmap

### Phase 1: Core Spatial Automation & In-Browser Analytics (Completed)
- [x] **RustGIS Algorithm Bridge**: Integrated RDP simplification, Visvalingam-Whyatt, and Ray-Casting PIP in `src/lib/rustGisBridge.ts`.
- [x] **STAC & TiTiler Client**: Implemented dynamic COG tile URL generator and Planetary Computer search in `src/lib/stacTitiler.ts`.
- [x] **GeoAI Boundary Delineator**: Implemented promptable smallholder parcel boundary extraction in `src/lib/boundaryDelineator.ts`.
- [x] **GeoLibre & DuckDB-WASM Engine**: Implemented in-browser SQL analytics and PMFBY loss qualification in `src/lib/geolibreDuckDb.ts`.
- [x] **OpenSMS SIM Gateway Relay**: Deployed same-origin `/api/opensms-proxy` and client handler in `src/lib/openSmsGateway.ts`.

---

### Phase 2: Visual Node Workflow Studio Expansion (Completed)
- [x] **Register New Hubs**: Added `cloudnative`, `geoai`, `rustgis`, and `dispatch` platform hubs to `src/NodeWorkflowBuilder.tsx`.
- [x] **Add Core Nodes**: Added `stac_pc`, `titiler_ndvi`, `geoai_sam`, `geoai_unet`, `rust_rdp`, `duckdb_zonal`, `opensms_dispatch`, and `remotion_video`.
- [x] **Multi-Target Script Generation**: Added automated code generation for PySTAC, samgeo, RustGIS SIMD, and OpenSMS Bash cURL.
- [x] **Figma UI & Glassmorphism Theme Overhaul**: Replaced pitch-black booting screens and dark purple headers with modern luminous GeoAI palettes.

---

### Phase 3: Spatial Automation Registry Studio (Next Step)
- [ ] **Interactive In-App Registry**: Build `src/SpatialAutomationRegistry.tsx` allowing users to browse, filter, inspect, and copy code recipes for the top 100+ geospatial repositories directly inside SEVA·GIS.
- [ ] **Link to NodeWorkflowBuilder & App Shell**: Expose a quick launcher button in the top navigation bar and Node Studio so researchers can directly inspect toolchain documentation while designing GIS workflows.

---

### Phase 4: Field Survey & Video Dossier Synthesis
- [ ] **Remotion Video Synthesis**: Add an automated 15-second MP4 render flow that compiles farm polygon boundary, NDVI color ramp, and audio advisory for instant WhatsApp delivery.
- [ ] **Offline PWA Sync**: Enable full offline caching of farm boundaries using IndexedDB and Service Workers so farmers in remote areas with zero cell connectivity can record crop damage surveys.
