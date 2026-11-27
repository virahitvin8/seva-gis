import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

maplibregl.setWorkerUrl(workerUrl);
import {
  LocateFixed, Layers, Box, Crosshair, MapPin, Footprints, Pause, Check, Undo2, Download
} from 'lucide-react';
import {
  OPEN_MAP_LAYERS,
  buildMapLibreRasterStyle,
  planOfflineTileRegion,
  cacheOfflineTilesToStorage,
  getOfflineTileCacheCount,
  type BaseLayerId,
} from '../lib/offlineMapLayers';
import { formatSpeedUnit } from '../lib/fieldAudioSensors';
import { formatAllCoordinateSystems } from '../lib/digipin';
import type { FieldWaypoint, TrackPoint } from '../lib/geodesyField';
import type { CadastralAreaMetrics } from '../lib/cadastralUnits';
import { useI18n } from '../lib/i18n';
import type { LiveGnssFix, UnitSystem } from './HandyGpsConsole';

interface TacticalMapViewProps {
  centerCoord: [number, number]; // [lon, lat]
  onChangeCenter: (next: [number, number]) => void;
  gpsFix: LiveGnssFix | null;
  pins: [number, number][];
  closedRing: [number, number][];
  waypoints: FieldWaypoint[];
  trackPoints: TrackPoint[];
  unitSystem: UnitSystem;
  cadastralMetrics: CadastralAreaMetrics;
  isWalkingPerimeter: boolean;
  onDropPin: () => void;
  onUndoPin: () => void;
  onToggleWalkPerimeter: () => void;
  onApplyBoundary?: () => void;
  onNotifyToast: (msg: string) => void;
}

const LAYER_ORDER: BaseLayerId[] = ['esri-satellite', 'osm-standard', 'opentopomap'];

export default function TacticalMapView({
  centerCoord,
  onChangeCenter,
  gpsFix,
  pins,
  closedRing,
  waypoints,
  trackPoints,
  unitSystem,
  cadastralMetrics,
  isWalkingPerimeter,
  onDropPin,
  onUndoPin,
  onToggleWalkPerimeter,
  onApplyBoundary,
  onNotifyToast,
}: TacticalMapViewProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const gpsMarkerRef = useRef<maplibregl.Marker | null>(null);
  const suppressMoveRef = useRef(false);

  const [activeLayer, setActiveLayer] = useState<BaseLayerId>('esri-satellite');
  const [is3dTilt, setIs3dTilt] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const [cachingProgress, setCachingProgress] = useState<{ done: number; total: number } | null>(null);
  const [cachedTileCount, setCachedTileCount] = useState(0);

  useEffect(() => {
    getOfflineTileCacheCount().then(setCachedTileCount).catch(() => {});
  }, []);

  const syncOverlays = (map: maplibregl.Map) => {
    const polyCoords = closedRing.length >= 4 ? [closedRing] : [];
    const polygonGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: polyCoords.length > 0
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: polyCoords } }]
        : [],
    };
    const trackGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: trackPoints.length >= 2
        ? [{
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: trackPoints.map((p) => [p.lon, p.lat]) },
          }]
        : [],
    };
    const wptGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        ...pins.map((c, idx) => ({
          type: 'Feature' as const,
          properties: { kind: 'corner', title: String(idx + 1) },
          geometry: { type: 'Point' as const, coordinates: c },
        })),
        ...waypoints.map((w) => ({
          type: 'Feature' as const,
          properties: { kind: 'wpt', title: w.label },
          geometry: { type: 'Point' as const, coordinates: [w.lon, w.lat] },
        })),
      ],
    };

    const ensureSource = (id: string, data: GeoJSON.FeatureCollection) => {
      const existing = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(data);
      } else {
        map.addSource(id, { type: 'geojson', data });
      }
    };

    ensureSource('seva-farm-poly', polygonGeoJson);
    if (!map.getLayer('seva-farm-fill')) {
      map.addLayer({
        id: 'seva-farm-fill',
        type: 'fill',
        source: 'seva-farm-poly',
        paint: { 'fill-color': '#2E7D32', 'fill-opacity': 0.25 },
      });
    }
    if (!map.getLayer('seva-farm-outline')) {
      map.addLayer({
        id: 'seva-farm-outline',
        type: 'line',
        source: 'seva-farm-poly',
        paint: { 'line-color': '#66BB6A', 'line-width': 3 },
      });
    }

    ensureSource('seva-track-line', trackGeoJson);
    if (!map.getLayer('seva-track-layer')) {
      map.addLayer({
        id: 'seva-track-layer',
        type: 'line',
        source: 'seva-track-line',
        paint: { 'line-color': '#F57C00', 'line-width': 3.5 },
      });
    }

    ensureSource('seva-waypoints-pts', wptGeoJson);
    if (!map.getLayer('seva-waypoints-layer')) {
      map.addLayer({
        id: 'seva-waypoints-layer',
        type: 'circle',
        source: 'seva-waypoints-pts',
        paint: {
          'circle-radius': ['match', ['get', 'kind'], 'corner', 6, 7],
          'circle-color': ['match', ['get', 'kind'], 'corner', '#81C784', '#F57C00'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      });
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: buildMapLibreRasterStyle(activeLayer),
        center: centerCoord,
        zoom: 16.5,
        pitch: is3dTilt ? 52 : 0,
        attributionControl: false,
      });

      map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: unitSystem === 'imperial' ? 'imperial' : 'metric' }), 'bottom-left');

      map.on('load', () => {
        if (!cancelled) syncOverlays(map);
      });
      map.on('style.load', () => {
        if (!cancelled) syncOverlays(map);
      });
      map.on('moveend', () => {
        if (suppressMoveRef.current) {
          suppressMoveRef.current = false;
          return;
        }
        const c = map.getCenter();
        onChangeCenter([Number(c.lng.toFixed(7)), Number(c.lat.toFixed(7))]);
      });

      mapRef.current = map;
      setWebglError(false);

      return () => {
        cancelled = true;
        gpsMarkerRef.current?.remove();
        gpsMarkerRef.current = null;
        map.remove();
        mapRef.current = null;
      };
    } catch {
      setWebglError(true);
    }
  }, []);

  // Switch base layer dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(buildMapLibreRasterStyle(activeLayer));
  }, [activeLayer]);

  // Toggle 3D tilt pitch
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ pitch: is3dTilt ? 52 : 0, duration: 400 });
  }, [is3dTilt]);

  // Update vector overlays when pins/waypoints/track change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    syncOverlays(map);
  }, [pins, closedRing, waypoints, trackPoints]);

  // Update live GPS dot marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gpsFix) return;
    if (!gpsMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'w-4 h-4 rounded-full bg-[#38BDF8] border-2 border-white shadow-lg';
      gpsMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([gpsFix.lon, gpsFix.lat]).addTo(map);
    } else {
      gpsMarkerRef.current.setLngLat([gpsFix.lon, gpsFix.lat]);
    }
  }, [gpsFix]);

  const handleCenterOnMe = () => {
    if (gpsFix && mapRef.current) {
      suppressMoveRef.current = true;
      mapRef.current.flyTo({ center: [gpsFix.lon, gpsFix.lat], zoom: 17.5, duration: 600 });
      onChangeCenter([gpsFix.lon, gpsFix.lat]);
    } else if (!gpsFix) {
      onNotifyToast(t('field.toast.gpsLost'));
    }
  };

  const handleCycleLayer = () => {
    const idx = LAYER_ORDER.indexOf(activeLayer);
    const next = LAYER_ORDER[(idx + 1) % LAYER_ORDER.length];
    setActiveLayer(next);
  };

  const handleCacheOfflineTiles = async () => {
    if (cachingProgress) return;
    const plan = planOfflineTileRegion(
      activeLayer,
      {
        minLat: centerCoord[1] - 0.008,
        maxLat: centerCoord[1] + 0.008,
        minLon: centerCoord[0] - 0.008,
        maxLon: centerCoord[0] + 0.008,
      },
      13,
      16,
      90
    );
    setCachingProgress({ done: 0, total: plan.tileCount });
    const res = await cacheOfflineTilesToStorage(plan.urls, (done, total) => setCachingProgress({ done, total }));
    setCachingProgress(null);
    const count = await getOfflineTileCacheCount();
    setCachedTileCount(count);
    onNotifyToast(`${t('field.map.tilesSaved')}: ${res.cached}/${plan.tileCount}`);
  };

  const centerCoords = formatAllCoordinateSystems(centerCoord[1], centerCoord[0]);
  const speedKmh = gpsFix?.speedMs != null ? gpsFix.speedMs * 3.6 : 0;

  return (
    <div className="space-y-3 pb-4">
      <div className="relative h-[58vh] min-h-[380px] rounded-2xl overflow-hidden border border-[#2E2E2E] bg-[#121212] shadow-xl">
        {/* Real MapLibre GL Canvas */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Fallback SVG if WebGL unavailable on headless device */}
        {webglError && (
          <div className="absolute inset-0 bg-[#161B17] flex flex-col items-center justify-center p-6 text-center">
            <Layers size={36} className="text-[#81C784] mb-2" />
            <div className="text-sm font-bold text-white">{OPEN_MAP_LAYERS[activeLayer].name}</div>
            <p className="text-xs text-[#A3B1A6] font-mono mt-1">{centerCoords.decimal}</p>
          </div>
        )}

        {/* Fixed Central Precision Crosshair */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
          <div className="relative flex items-center justify-center">
            <Crosshair size={42} strokeWidth={1.6} className="text-[#F57C00] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" />
            <span className="w-2 h-2 rounded-full bg-white border border-[#121212] absolute" />
          </div>
        </div>

        {/* Floating Transparent Speed & Boundary Widget */}
        <div className="absolute top-3 left-3 z-20 bg-[#121212]/80 backdrop-blur-md border border-white/15 rounded-xl px-3.5 py-2.5 text-white space-y-1">
          <div className="text-[11px] text-[#C7D0C9] font-medium">{t('field.map.speed')}</div>
          <div className="font-['JetBrains_Mono',monospace] text-lg font-bold text-[#81C784] tabular-nums">
            {formatSpeedUnit(speedKmh, unitSystem)}
          </div>
          <div className="text-[11px] font-mono text-[#E5E7EB] tabular-nums pt-0.5 border-t border-white/10">
            {cadastralMetrics.formatted.acres} · {pins.length} pts
          </div>
        </div>

        {/* Active Layer Chip + Offline Cache Control */}
        <div className="absolute bottom-10 left-3 z-20 flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-[#121212]/85 border border-white/15 text-xs font-semibold text-white">
            {OPEN_MAP_LAYERS[activeLayer].name}
          </span>
          <button
            type="button"
            onClick={handleCacheOfflineTiles}
            disabled={!!cachingProgress}
            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#2E7D32] hover:bg-[#388E3C] text-xs font-bold text-white flex items-center gap-1.5 shadow-md"
          >
            <Download size={14} />
            <span>
              {cachingProgress
                ? `${cachingProgress.done}/${cachingProgress.total}`
                : `${t('field.map.cacheTiles')} (${cachedTileCount})`}
            </span>
          </button>
        </div>

        {/* 3 Right-Side Floating Action Buttons (48dp+) */}
        <div className="absolute right-3 top-3 z-20 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleCenterOnMe}
            className="min-h-[48px] min-w-[48px] px-3 rounded-xl bg-[#1E1E1E]/95 border border-[#3A3A3A] hover:border-[#4CAF50] text-white flex items-center justify-center shadow-lg"
            title={t('field.map.centerMe')}
            aria-label={t('field.map.centerMe')}
          >
            <LocateFixed size={22} className={gpsFix ? 'text-[#81C784]' : 'text-[#FFB74D]'} />
          </button>

          <button
            type="button"
            onClick={() => setIs3dTilt((v) => !v)}
            className={`min-h-[48px] min-w-[48px] px-3 rounded-xl border flex flex-col items-center justify-center shadow-lg text-[10px] font-bold ${
              is3dTilt
                ? 'bg-[#F57C00] border-[#FFB74D] text-[#121212]'
                : 'bg-[#1E1E1E]/95 border-[#3A3A3A] text-white'
            }`}
            title={is3dTilt ? t('field.map.tilt2d') : t('field.map.tilt3d')}
            aria-label={t('field.map.tilt3d')}
          >
            <Box size={20} />
            <span>{is3dTilt ? '3D' : '2D'}</span>
          </button>

          <button
            type="button"
            onClick={handleCycleLayer}
            className="min-h-[48px] min-w-[48px] px-3 rounded-xl bg-[#1E1E1E]/95 border border-[#3A3A3A] hover:border-[#F57C00] text-white flex items-center justify-center shadow-lg"
            title={t('field.map.layers')}
            aria-label={t('field.map.layers')}
          >
            <Layers size={22} className="text-[#FFB74D]" />
          </button>
        </div>
      </div>

      {/* Crosshair Readout + Survey Controls */}
      <div className="bg-[#1E1E1E] border border-[#2E2E2E] rounded-2xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#C7D0C9]">
          <span className="text-white font-bold">{centerCoords.decimal}</span>
          <span>DIGIPIN: <strong className="text-[#81C784]">{centerCoords.digipin}</strong></span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={onDropPin}
            className="min-h-[48px] px-3 rounded-xl bg-[#2E7D32] hover:bg-[#388E3C] text-white text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <MapPin size={16} />
            <span>{t('field.map.dropPin')}</span>
          </button>

          <button
            type="button"
            onClick={onToggleWalkPerimeter}
            className={`min-h-[48px] px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border ${
              isWalkingPerimeter
                ? 'bg-[#F57C00] border-[#FFB74D] text-[#121212]'
                : 'bg-[#121212] border-[#383838] text-white hover:bg-[#242424]'
            }`}
          >
            {isWalkingPerimeter ? <Pause size={16} /> : <Footprints size={16} className="text-[#F57C00]" />}
            <span>{isWalkingPerimeter ? t('field.map.stopWalk') : t('field.map.walkFence')}</span>
          </button>

          <button
            type="button"
            onClick={onUndoPin}
            disabled={pins.length === 0}
            className="min-h-[48px] px-3 rounded-xl bg-[#121212] border border-[#383838] hover:bg-[#242424] disabled:opacity-40 text-xs font-bold text-[#E5E7EB] flex items-center justify-center gap-1.5"
          >
            <Undo2 size={16} />
            <span>Undo ({pins.length})</span>
          </button>

          {onApplyBoundary && (
            <button
              type="button"
              onClick={onApplyBoundary}
              disabled={pins.length < 3}
              className="min-h-[48px] px-3 rounded-xl bg-[#2E7D32]/25 border border-[#4CAF50]/60 hover:bg-[#2E7D32]/40 disabled:opacity-40 text-xs font-bold text-[#A5D6A7] flex items-center justify-center gap-1.5"
            >
              <Check size={16} />
              <span>{t('field.map.saveFence')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

