---
name: precision-ag-superpowers
description: >-
  Disciplined engineering superpowers, verification loops, and invariant testing
  for precision agriculture, coverage path planning, and geospatial algorithms.
---

# Precision Ag Superpowers: Engineering Discipline & Verification Loops

Inspired by [obra/superpowers](https://github.com/obra/superpowers), this skill injects rigorous software engineering discipline, invariant validation, and zero-hallucination verification into precision agricultural development.

---

## 1. Core Engineering Superpowers

### Superpower 1: Invariant Verification Loop
Before proposing or applying any algorithmic change to agricultural math, verify the following core invariants:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      CORE AGRONOMIC INVARIANTS                         │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. Geodesic Polygons: Coordinates MUST follow WGS84 [lon, lat] order.  │
 │    LinearRings must be closed (point[0] === point[n-1]).               │
 │ 2. Radiometric Band Math: Denominators MUST have epsilon guard against │
 │    division by zero: (nir - red) / Math.max(1e-6, (nir + red)).        │
 │ 3. Swath Coverage: Implement width W must satisfy 1 <= W <= 36 meters. │
 │    Swath coordinates must stay clipped inside the headland polygon.    │
 │ 4. VRA Prescriptions: Total nutrient distributed cannot exceed 100% of │
 │    prescribed crop safety thresholds. Urea bags must round up (ceil).  │
 │ 5. Zero Network Leakage: All farm geometries, swath paths, and user    │
 │    records remain on-device in IndexedDB. Zero telemetry.              │
 └────────────────────────────────────────────────────────────────────────┘
```

### Superpower 2: Mathematical Contract Testing
For every spatial calculation, execute mental or automated unit contract checks:
- **Angle Normalization:** Ensure headings $\theta$ normalize cleanly to $0^\circ \dots 180^\circ$ for bidirectional machinery swaths.
- **Cartesian Projection:** Convert spherical coordinates to local Cartesian tangent planes ($x, y$ in meters relative to polygon centroid) before geometric clipping or rotation.
- **Detour Factor Bounds:** Ensure rural logistics isochrone models incorporate $0.75\times$ to $0.80\times$ road detour factors to reflect realistic transit conditions.

---

## 2. Step-by-Step Task Execution Protocol

1. **Investigate First:** Read the exact lines in `src/lib/pathplan.ts`, `src/lib/seva.ts`, or `src/GeoTools.tsx` before modifying.
2. **Preserve Compatibility:** Maintain RFC 7946 standard `FeatureCollection` formats so outputs can immediately open in QGIS and Trimble ISOBUS displays.
3. **Verify Edge Cases:**
   - Single-point or 2-point degenerate boundaries.
   - Self-intersecting polygons.
   - Extremely small plots ($< 0.1\text{ ha}$) or large commercial plots ($> 100\text{ ha}$).
4. **Clean Commits:** Write declarative, high-signal commit messages adhering to Conventional Commits (`feat(geotools): ...`).
