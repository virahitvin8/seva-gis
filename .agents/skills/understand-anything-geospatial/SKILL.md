---
name: understand-anything-geospatial
description: >-
  Deep semantic codebase comprehension and domain knowledge graph for SEVA·GIS.
  Maps Sentinel-2 L2A ingestion, Copernicus DEM, spectral band math, Fields2Cover
  swath robotics, openrouteservice reachability, and VRA prescriptions.
---

# Understand Anything: SEVA·GIS Geospatial Domain Knowledge Graph

Inspired by [Egonex-AI/Understand-Anything](https://github.com/Egonex-AI/Understand-Anything), this skill provides an instant mental model, business domain mapping, and AST dependency graph for developers and AI agents working on SEVA·GIS.

---

## 1. Core Domain Ontology & Data Flow

SEVA·GIS is organized into 5 decoupled operational domains:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 1. SATELLITE & SENSOR INGESTION DOMAIN                                  │
 │    Source: src/lib/seva.ts, src/lib/copernicus.ts                       │
 │    Entities: Sentinel-2 L2A STAC items, SCL Scene Classification       │
 │    Invariants: Cloud cover <= 30%, BOA radiometric surface reflectance│
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 2. SPATIAL GEODESY & BOUNDARY DOMAIN                                   │
 │    Source: src/lib/geo.ts, src/lib/db.ts, src/AddFarm.tsx               │
 │    Entities: WGS84 Polygons, Geodesic Area (m²/ha), Vincenty Perimeter │
 │    Invariants: RFC 7946 GeoJSON, Closed LinearRings, Lon/Lat ordering  │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 3. SPECTRAL MATH & HYDROLOGY DOMAIN                                    │
 │    Source: src/lib/raster.ts, src/lib/indicators.ts, src/lib/hydro.ts   │
 │    Entities: NDVI, NDMI, NDWI, NDRE, EVI, BSI, Slope, Aspect, TWI      │
 │    Invariants: Floating arrays normalized -1.0 .. +1.0, zero-div safe  │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 4. AGRICULTURAL ROBOTICS & LOGISTICS DOMAIN                            │
 │    Source: src/lib/pathplan.ts, src/GeoTools.tsx                       │
 │    Entities: Boustrophedon Swaths, Longest-Edge θ_opt, Isochrones, VRA │
 │    Invariants: Meter Cartesian projection, 3-zone N conservation       │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 5. CARTOGRAPHY & AGRO ADVISORY DOMAIN                                  │
 │    Source: src/IndicatorMap.tsx, src/AgroPanel.tsx, src/report.ts      │
 │    Entities: WebGL canvas, Open-Meteo ET0, PDF/HTML dossiers           │
 │    Invariants: Offline local storage (Dexie DB), zero external cookies │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Subsystem File Mapping & Responsibilities

| Subsystem | Canonical Files | Key Functions / Types | Data Contract |
|---|---|---|---|
| **STAC Satellite Query** | `src/lib/seva.ts` | `queryStacScenes()`, `farmRing()` | Inputs: BBOX, DateRange. Returns: STAC Assets (B02, B03, B04, B08, B11, SCL) |
| **Raster Band Math** | `src/lib/raster.ts`, `src/lib/indicators.ts` | `computeNdvi()`, `computeNdmi()`, `computeNdre()` | Inputs: Float32Array bands. Returns: Index grids & mean/min/max statistics |
| **DEM Hydrology** | `src/lib/hydro.ts` | `computeSlopeAspect()`, `computeTwi()` | Inputs: 30m Copernicus GLO-30 DEM. Returns: Slope %, Aspect °, Flow Accumulation |
| **Machinery Robotics** | `src/lib/pathplan.ts` | `generateCoveragePath()`, `findOptimalSwathAngle()` | Inputs: Field polygon, boom width (m). Returns: Swath LineStrings, turn distance, working hours |
| **Rural Logistics** | `src/lib/pathplan.ts` | `calculateFarmLogistics()` | Inputs: Farm polygon, speed (km/h). Returns: 10/20/30 min tractor & 15/30/45 min truck isochrones |
| **Precision VRA** | `src/lib/pathplan.ts` | `calculateVraPrescription()` | Inputs: Area ha, NDVI vigor. Returns: 3-zone Urea prescription & kg savings |
| **Local Vault** | `src/lib/db.ts` | `db.farms`, `db.journals` | Pure browser IndexedDB via Dexie. No remote user profiling or tracking |

---

## 3. High-Leverage Inspection Questions
When modifying SEVA·GIS:
1. **Will this break GeoJSON compliance?** (Ensure Coordinates are `[lon, lat]`, not `[lat, lon]`).
2. **Does this calculation handle edge cases?** (e.g., triangle or concave polygons in swath path planning, cloudy pixels in STAC querying).
3. **Does this maintain client-side privacy?** (Never send coordinates or farm shapes to third-party tracking APIs).
