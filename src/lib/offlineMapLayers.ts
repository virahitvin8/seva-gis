/**
 * SEVA.GIS Open MapLibre GL Layers & Offline Raster Tile Cache Manager
 * Derived from opengeos/terrio and opengeos/GeoLibre (MIT License).
 */

import type { StyleSpecification } from 'maplibre-gl';

export type BaseLayerId = 'esri-satellite' | 'osm-standard' | 'opentopomap';

export interface OpenLayerSpec {
  id: BaseLayerId;
  name: string;
  attribution: string;
  tileUrl: string;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
}

export const OPEN_MAP_LAYERS: Record<BaseLayerId, OpenLayerSpec> = {
  'esri-satellite': {
    id: 'esri-satellite',
    name: 'Esri World Imagery',
    attribution: 'Tiles © Esri — Maxar / Earthstar Geographics',
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
  },
  'osm-standard': {
    id: 'osm-standard',
    name: 'OpenStreetMap',
    attribution: '© OpenStreetMap contributors',
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
  },
  opentopomap: {
    id: 'opentopomap',
    name: 'OpenTopoMap Contours',
    attribution: '© OpenTopoMap (CC-BY-SA)',
    tileUrl: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 17,
    tileSize: 256,
  },
};

export const OFFLINE_TILE_CACHE_NAME = 'seva-offline-tiles-v1';

export function buildMapLibreRasterStyle(layerId: BaseLayerId): StyleSpecification {
  const layer = OPEN_MAP_LAYERS[layerId] || OPEN_MAP_LAYERS['esri-satellite'];
  return {
    version: 8,
    sources: {
      'base-raster': {
        type: 'raster',
        tiles: [layer.tileUrl],
        tileSize: layer.tileSize,
        minzoom: layer.minZoom,
        maxzoom: layer.maxZoom,
        attribution: layer.attribution,
      },
    },
    layers: [
      {
        id: 'base-raster-layer',
        type: 'raster',
        source: 'base-raster',
      },
    ],
  };
}

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}

function latToTileY(lat: number, z: number): number {
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clamped * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z)
  );
}

export interface OfflineTilePlan {
  layerId: BaseLayerId;
  tileCount: number;
  urls: string[];
  estimatedMb: number;
}

export function planOfflineTileRegion(
  layerId: BaseLayerId,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  minZoom = 13,
  maxZoom = 16,
  maxTiles = 180
): OfflineTilePlan {
  const spec = OPEN_MAP_LAYERS[layerId] || OPEN_MAP_LAYERS['esri-satellite'];
  const urls: string[] = [];
  for (let z = Math.max(spec.minZoom, minZoom); z <= Math.min(spec.maxZoom, maxZoom); z++) {
    const xMin = lonToTileX(bounds.minLon, z);
    const xMax = lonToTileX(bounds.maxLon, z);
    const yMin = latToTileY(bounds.maxLat, z);
    const yMax = latToTileY(bounds.minLat, z);
    for (let x = Math.min(xMin, xMax); x <= Math.max(xMin, xMax); x++) {
      for (let y = Math.min(yMin, yMax); y <= Math.max(yMin, yMax); y++) {
        if (urls.length >= maxTiles) break;
        urls.push(
          spec.tileUrl
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y))
        );
      }
      if (urls.length >= maxTiles) break;
    }
    if (urls.length >= maxTiles) break;
  }
  return {
    layerId,
    tileCount: urls.length,
    urls,
    estimatedMb: Number(((urls.length * 24) / 1024).toFixed(2)),
  };
}

export async function cacheOfflineTilesToStorage(
  urls: string[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<{ cached: number; failed: number }> {
  if (typeof caches === 'undefined') {
    return { cached: 0, failed: urls.length };
  }
  const cache = await caches.open(OFFLINE_TILE_CACHE_NAME);
  let cached = 0;
  let failed = 0;
  const total = urls.length;

  for (let i = 0; i < total; i += 6) {
    if (signal?.aborted) break;
    const batch = urls.slice(i, i + 6);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const existing = await cache.match(url);
          if (existing) {
            cached++;
            return;
          }
          const resp = await fetch(url, { mode: 'cors', signal });
          if (resp.ok || resp.type === 'opaque') {
            await cache.put(url, resp);
            cached++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      })
    );
    onProgress?.(Math.min(total, i + batch.length), total);
  }
  return { cached, failed };
}

export async function getOfflineTileCacheCount(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const cache = await caches.open(OFFLINE_TILE_CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

