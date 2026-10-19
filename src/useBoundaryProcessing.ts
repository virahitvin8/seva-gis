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

    // 1. Interior ambience: a barely-there glassmorphic tint
    const radarFill = L.polygon(points, {
      renderer, pane: paneName, interactive: false,
      className: 'seva-boundary-radar-fill', smoothFactor: 0,
    }).addTo(map);
    createdLayers.push(radarFill);

    // 2. Premium perimeter: static rail + travelling comet with its luminous
    //    tail (halo) and the faintest outer aura. One shared speed, seamless loop.
    const lineKinds = ['rail', 'halo', 'comet', 'aura'];
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

    // 3. Quiet vertex waypoint anchors on boundary corners
    boundary.forEach(([lat, lng]) => {
      const beacon = L.circleMarker([lat, lng], {
        renderer, pane: paneName, interactive: false,
        radius: 1.8,
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
