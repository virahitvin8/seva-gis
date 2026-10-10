import type { Ind } from './indicators'
import type { FarmData, SceneOpts } from './seva'

const PROD_BACKEND_URL = 'https://seva-gis-backend-419602015618.us-central1.run.app'

export function getEarthEngineEndpoint(): string {
  if (typeof window === 'undefined') return ''
  const envUrl = import.meta.env.VITE_EE_API_URL?.replace(/\/$/, '')
  if (envUrl) return envUrl
  const savedUrl = localStorage.getItem('seva-ee-api-url')?.replace(/\/$/, '')
  if (savedUrl) return savedUrl
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8080'
  }
  return PROD_BACKEND_URL
}

export const isEarthEngineConfigured = Boolean(getEarthEngineEndpoint())

export type EarthEngineMapRequest = {
  farm: FarmData
  sceneOpts: SceneOpts
  layer: Ind
  bandCombination?: string
  compositing?: 'median' | 'mosaic' | 'mean' | 'max_ndvi'
  percentileStretch?: boolean
}

export type EarthEngineMapResponse = {
  tileUrl: string
  source: string
  sceneCount: string | number
  latestSceneDate?: string
  compositing?: string
  stretchMode?: string
  cached?: boolean
}

export async function createEarthEngineMap(
  { farm, sceneOpts, layer, bandCombination, compositing = 'median', percentileStretch = true }: EarthEngineMapRequest,
  signal?: AbortSignal
): Promise<EarthEngineMapResponse> {
  const endpoint = getEarthEngineEndpoint()
  if (!endpoint) throw new Error('Earth Engine endpoint is not set. Set VITE_EE_API_URL or run the backend proxy locally on port 8080.')
  if (!farm.polygon || farm.polygon.length < 3) throw new Error('Draw or upload a field boundary before requesting Earth Engine tiles.')

  const response = await fetch(`${endpoint}/api/earth-engine/map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      coordinates: farm.polygon,
      mode: sceneOpts.mode ?? 'latest',
      date: sceneOpts.date,
      start_date: sceneOpts.from,
      end_date: sceneOpts.to,
      max_cloud: sceneOpts.maxCloud ?? 30,
      indicator_id: bandCombination ? undefined : layer.id,
      band_combination: bandCombination,
      compositing,
      percentile_stretch: percentileStretch,
      visualization: {
        minimum: layer.range?.[0] ?? 0,
        maximum: layer.range?.[1] ?? 1,
        palette: (layer.ramp ?? ['#a50026', '#fee08b', '#006837']).map(c => c.replace('#', '')),
      },
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    tileUrl?: string
    detail?: string
    source?: string
    sceneCount?: string | number
    latestSceneDate?: string
    compositing?: string
    stretchMode?: string
    cached?: boolean
  }

  if (!response.ok) {
    throw new Error(payload.detail || `Earth Engine proxy returned ${response.status}.`)
  }
  if (!payload.tileUrl) {
    throw new Error('Earth Engine returned no map tile URL.')
  }

  return payload as EarthEngineMapResponse
}

export async function getEarthEngineDem(
  coordinates: [number, number][],
  layer: 'elevation' | 'slope' | 'aspect' | 'hillshade' = 'elevation',
  signal?: AbortSignal
) {
  const endpoint = getEarthEngineEndpoint()
  if (!endpoint) throw new Error('Earth Engine endpoint not configured.')
  const res = await fetch(`${endpoint}/api/earth-engine/dem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ coordinates, layer }),
  })
  if (!res.ok) throw new Error(`DEM request failed (${res.status})`)
  return res.json()
}

export async function getEarthEngineStats(
  coordinates: [number, number][],
  indicators: string[] = ['ndvi', 'evi', 'ndmi', 'ndwi', 'bsi'],
  signal?: AbortSignal
) {
  const endpoint = getEarthEngineEndpoint()
  if (!endpoint) throw new Error('Earth Engine endpoint not configured.')
  const res = await fetch(`${endpoint}/api/earth-engine/stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ coordinates, indicators }),
  })
  if (!res.ok) throw new Error(`Stats request failed (${res.status})`)
  return res.json()
}

export async function checkEarthEngineBackendHealth(): Promise<{
  ok: boolean
  service?: string
  project?: string
  engineReady?: boolean
  detail?: string
}> {
  const endpoint = getEarthEngineEndpoint()
  if (!endpoint) return { ok: false, detail: 'Endpoint not configured' }
  try {
    const res = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      const data = await res.json()
      return { ok: true, ...data }
    }
    return { ok: false, detail: `Health check returned ${res.status}` }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'Backend unreachable' }
  }
}
