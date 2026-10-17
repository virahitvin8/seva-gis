import { useEffect } from 'react';
import L from 'leaflet';

/** Presentation only: never starts or retries satellite requests. */
export function useBoundaryProcessing(
  map: L.Map | null,
  boundary: ReadonlyArray<readonly [number, number]> | null | undefined,
  processing: boolean,
) {
  useEffect(() => {
    if (!map || !processing || !boundary || boundary.length < 3) return;
    if (boundary.some(([lat, lng]) => !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) return;
    const paneName = 'seva-processing';
    const existing = map.getPane(paneName);
    const pane = existing ?? map.createPane(paneName);
    const createdPane = !existing;
    pane.classList.add('seva-processing-pane');
    const renderer = L.svg({ pane: paneName, padding: 0.5 });
    if (!renderer) return; // graceful fallback for browsers without SVG
    renderer.addTo(map);
    const points: L.LatLngTuple[] = boundary.map(([lat, lng]) => [lat, lng]);
    const first = points[0];
    if (!first) { renderer.remove(); return; }
    points.push([first[0], first[1]]);

    const createdLayers: L.Layer[] = [];

    // 1. Holographic interior radar polygon fill
    const radarFill = L.polygon(points, {
      renderer, pane: paneName, interactive: false,
      className: 'seva-boundary-radar-fill', smoothFactor: 0,
    }).addTo(map);
    createdLayers.push(radarFill);

    // 2. High-precision laser and rail perimeter lines
    const lineKinds = ['rail', 'halo', 'laser', 'pulse'];
    lineKinds.forEach(kind => {
      const layer = L.polyline(points, {
        renderer, pane: paneName, interactive: false,
        className: `seva-boundary-${kind}`, smoothFactor: 0,
      }).addTo(map);
      const path = layer.getElement();
      if (path) {
        path.setAttribute('pathLength', '1000');
        path.setAttribute('aria-hidden', 'true');
        path.setAttribute('focusable', 'false');
      }
      createdLayers.push(layer);
    });

    // 3. Vertex targeting beacons on boundary corners
    boundary.forEach(([lat, lng]) => {
      const beacon = L.circleMarker([lat, lng], {
        renderer, pane: paneName, interactive: false,
        radius: 3.5,
        className: 'seva-boundary-beacon',
      }).addTo(map);
      createdLayers.push(beacon);
    });

    return () => {
      createdLayers.forEach(layer => layer.remove());
      renderer.remove();
      // The pane itself is a plain div that Leaflet never reclaims. Leaving it behind
      // accumulates one empty SVG pane per farm visit, so remove it when we made it.
      if (createdPane) {
        pane.replaceChildren();
        pane.remove();
      }
    };
  }, [map, boundary, processing]);
}
