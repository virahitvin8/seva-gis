---
name: antigravity-spatial-pipeline
description: >-
  Native Google Antigravity workflow patterns for zero-backend client-side GIS
  processing, WebGL tile streaming, IndexedDB caching, and agent tool execution.
---

# Antigravity Spatial Pipeline: Zero-Backend GIS Playbook

Inspired by [rmyndharis/antigravity-skills](https://github.com/rmyndharis/antigravity-skills), this skill provides direct guidelines for Google Antigravity agents operating on client-side geospatial web applications.

---

## 1. Antigravity Environment Conventions

- **Platform Environment:** React 19 + TypeScript 5.7 + Vite 8 + Tailwind CSS v4 in Windows PowerShell.
- **Development Server:** Runs on pre-allocated `$PORT` (default 8443). Do not run duplicate dev servers.
- **Command Rules:** Never execute `cd` commands. Set `Cwd` explicitly in tool calls.
- **JSX Strings:** Always use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings to prevent Vite build failures.
- **Component Exports:** Export components as default exports (`export default function Component()`).

---

## 2. In-Browser Geospatial Pipeline Architecture

### Keyless Data Ingestion (STAC / COG)
- Use standard `fetch()` with CORS support against Microsoft Planetary Computer STAC API (`https://planetarycomputer.microsoft.com/api/stac/v1`).
- Fetch Cloud-Optimized GeoTIFFs (COG) with byte-range requests where possible or load pre-rendered tile templates.
- Always include fallback providers (e.g., Copernicus Open Access Hub or Esri World Imagery when STAC scenes are overcast).

### Web Worker & Array Math Optimization
- Offload intensive raster pixel transforms (e.g., $1024 \times 1024$ multi-band matrices) to Web Workers.
- Use `Float32Array` or `Uint8ClampedArray` for pixel manipulation rather than standard JavaScript arrays to avoid garbage collection overhead.
- Utilize Canvas 2D image processing for hillshade and aspect calculation.

### Local Vault Storage (`src/lib/db.ts`)
- Use Dexie.js for IndexedDB abstraction.
- Store farm geometries as lightweight GeoJSON properties.
- Cache computed vegetation time-series locally so returning users experience instantaneous page loads without refetching satellite bands.
