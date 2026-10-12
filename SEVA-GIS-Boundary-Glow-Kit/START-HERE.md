# SEVA.GIS — glowing boundary processing

A soft green rail, luminous travelling tail, and bright comet orbit your farm boundary only while the existing map loading state is active. This is an activity indicator, not a percentage or a live satellite feed. Your website has not been changed.

## Exact changes

1. Copy `useBoundaryProcessing.ts` and `seva-boundary-processing.css` into your repository's `src/` folder.
2. In `src/IndicatorMap.tsx`, beside its imports, add:

```tsx
import { useBoundaryProcessing } from './useBoundaryProcessing';
import './seva-boundary-processing.css';
```

3. Inside `IndicatorMap`, after the `mapObj` state declaration and before the component's return, add the following at component scope (never inside an effect or condition). `useMemo` and `farmRing` are already imported:

```tsx
const processingBoundary = useMemo(
  () => farmRing(farm)
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
    .map(([lng, lat]) => [lat, lng] as const),
  [farm],
);

useBoundaryProcessing(
  mapObj,
  processingBoundary,
  loading || busy.length > 0,
);
```

`farmRing` returns longitude/latitude; Leaflet needs latitude/longitude. This conversion is important. `mapObj` is React state; do not pass `map.current` instead because a ref change does not trigger a render. The existing `loading` and `busy` state control the effect; do not introduce a separate fake timer.

4. In the boundary-frame effect, find the comment `Animated traveling pulse / train signal along the AOI boundary during map processing or scene loading`. Remove ONLY its following `if (busy.length > 0 || loading) { ... }` block containing `className: 'seva-train-pulse'`. Keep the regular `L.polygon(ring, ...)` and buffer/mask logic unchanged. The old block would otherwise draw a second animation over the new comet.

5. Optional: keep an existing visible loading message, or add an accessible status near the map:

```tsx
<div role="status" aria-live="polite" className="seva-processing-status">
  {loading || busy.length > 0 ? 'Processing map layers…' : ''}
</div>
```

Do not move keyboard focus when processing starts or ends.

## Why these changes

- Separate SVG pane: the glow stays above raster layers and below ordinary marker/popup panes; it never intercepts clicks.
- Full closed boundary: the comet does not jump across an open end.
- Normalized `pathLength`: the motion scales to different farm sizes.
- Cleanup: all added layers and their renderer are removed when processing ends, changes farms, or unmounts. Existing error handling must clear its real busy/loading flags; this effect does not change that logic.
- Reduced motion: a static perimeter replaces animation when the user requests it.
- No backend changes: no requests, retries, image edits, or scientific raster palette changes.

## Customize

In the CSS adjust `--seva-process-duration` (default `3.6s`; lower is faster), glow/core colors, halo stroke width, or shadow strength. Keep warning and NDVI/NDMI colors untouched. This effect requires an SVG-capable browser; it safely skips rendering otherwise.

## Preview and tests

Open `boundary-demo.html` in a browser alongside the included CSS. Click Start processing, Finish, and Simulate error. The demo illustrates the animation; it is not a working satellite map. Browser checks passed for travel, completion cleanup, error cleanup, reduced motion, and 390px mobile width. The integration hook has not been deployed or tested inside your authenticated production map.

The included 28-second silent motion-graphics MP4 shows the core workflow: define a field, processing perimeter, satellite layers, review and export. It is an illustrative overview, not a recording or exhaustive tutorial of every SEVA.GIS feature. Live imagery freshness depends on available satellite scenes and clouds.
