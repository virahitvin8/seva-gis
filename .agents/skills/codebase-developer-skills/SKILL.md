---
name: codebase-developer-skills
description: >-
  Type-safe engineering patterns, React 19 + Tailwind v4 standards, and
  composable UI conventions for precision agriculture tools.
---

# Codebase Developer Skills: Type-Safe React & Precision UI

Inspired by [mattpocock/skills](https://github.com/mattpocock/skills) and [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills), this skill establishes type-safe conventions and UI patterns for modern developer agents.

---

## 1. Type Safety & Domain Modeling

### Strict Geometrical Types
Avoid loose `any` types for geospatial structures. Use explicit coordinate tuples and domain schemas:

```typescript
export type LonLat = [number, number]
export type LinearRing = LonLat[]
export type GeoPolygon = LonLat[][]

export type SwathPlan = {
  swaths: LonLat[][]
  headland: LonLat[]
  count: number
  angleDeg: number
  totalDistanceM: number
  workingTimeMin: number
  efficiencyPct: number
  geojson: object
}
```

### Pure Functional Transformers
- Isolate mathematical transformations (e.g., coordinate rotations, bounding box clipping, Boustrophedon line intersections) as pure functions that accept inputs and return deterministic values without DOM side effects.
- Wrap expensive geometric recalculations in React `useMemo` hooks keyed on immutable polygon coordinate hashes.

---

## 2. Precision Agriculture UI Standards

- **Plain-Language Explanations:** Every metric must feature a contextual scale and an explanation ("Why?") line. Farmers and non-GIS operators should never see raw numbers without operational meaning.
- **Micro-Animations & Visual Hierarchy:** Use Tailwind CSS utility classes directly in JSX. Ensure smooth transitions for sliders, tabs, and export buttons.
- **Responsive Geometry:** Ensure toolkits adapt seamlessly from 4K desktop screens down to mobile Android field devices.
