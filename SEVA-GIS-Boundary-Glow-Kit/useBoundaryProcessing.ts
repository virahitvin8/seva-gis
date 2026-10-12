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
    const pane = map.getPane(paneName) ?? map.createPane(paneName);
    pane.classList.add('seva-processing-pane');
    const renderer = L.svg({ pane: paneName, padding: 0.5 });
    if (!renderer) return; // graceful fallback for browsers without SVG
    renderer.addTo(map);
    const points: L.LatLngTuple[] = boundary.map(([lat, lng]) => [lat, lng]);
    const first = points[0];
    if (!first) { renderer.remove(); return; }
    points.push([first[0], first[1]]);
    const layers = ['rail', 'halo', 'comet'].map(kind => {
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
      return layer;
    });
    return () => {
      layers.forEach(layer => layer.remove());
      renderer.remove();
    };
  }, [map, boundary, processing]);
}
