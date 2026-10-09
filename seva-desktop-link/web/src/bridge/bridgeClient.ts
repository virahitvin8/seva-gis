/**
 * SEVA.GIS Desktop Link - Web Client Library
 * Handles:
 * - URL fragment (#seva=...) compression/decompression
 * - Local bridge daemon HTTP communication with token auth
 * - Format conversion to/from seva-exchange v1
 */

import type { SevaExchangePayload, BridgeHealth, SevaFeature } from './types'

export const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:8765'
const TOKEN_STORAGE_KEY = 'seva_bridge_token'

export function getSavedBridgeToken(): string {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function saveBridgeToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim())
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  } catch {}
}

/**
 * Base64 URL-safe string to Uint8Array
 */
function base64UrlToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Uint8Array to Base64 URL-safe string
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Decode deep-link URL fragment (#seva=...) into SevaExchangePayload
 */
export async function decodeUrlFragment(hash: string): Promise<SevaExchangePayload | null> {
  if (!hash) return null
  const match = hash.match(/#seva=([A-Za-z0-9_-]+)/)
  if (!match || !match[1]) return null

  try {
    const compressedBytes = base64UrlToBytes(match[1])

    if (typeof DecompressionStream !== 'undefined') {
      const stream = new Response(compressedBytes).body
      if (!stream) return null
      const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'))
      const text = await new Response(decompressedStream).text()
      const data = JSON.parse(text)
      if (data && data.seva_exchange === '1') {
        return data as SevaExchangePayload
      }
    } else {
      // Fallback for environments without DecompressionStream: try plain JSON
      const text = new TextDecoder().decode(compressedBytes)
      const data = JSON.parse(text)
      if (data && data.seva_exchange === '1') {
        return data as SevaExchangePayload
      }
    }
  } catch (err) {
    console.warn('[SEVA Bridge] Failed to decode URL fragment:', err)
  }
  return null
}

/**
 * Encode SevaExchangePayload into URL fragment string
 */
export async function encodeUrlFragment(payload: SevaExchangePayload): Promise<string> {
  const jsonStr = JSON.stringify(payload)
  const utf8Bytes = new TextEncoder().encode(jsonStr)

  if (typeof CompressionStream !== 'undefined') {
    const stream = new Response(utf8Bytes).body
    if (stream) {
      const compressedStream = stream.pipeThrough(new CompressionStream('gzip'))
      const blob = await new Response(compressedStream).blob()
      const arrayBuffer = await blob.arrayBuffer()
      const compressedBytes = new Uint8Array(arrayBuffer)
      return `#seva=${bytesToBase64Url(compressedBytes)}`
    }
  }

  // Fallback if CompressionStream not supported
  return `#seva=${bytesToBase64Url(utf8Bytes)}`
}

/**
 * Check health of local bridge daemon
 */
export async function checkBridgeHealth(bridgeUrl = DEFAULT_BRIDGE_URL): Promise<BridgeHealth | null> {
  try {
    const res = await fetch(`${bridgeUrl.replace(/\/+$/, '')}/health`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      if (data && data.ok) {
        return data as BridgeHealth
      }
    }
  } catch {}
  return null
}

/**
 * Poll parcels queued for SEVA in local bridge daemon (/api/poll)
 */
export async function pollBridge(token: string, bridgeUrl = DEFAULT_BRIDGE_URL): Promise<SevaExchangePayload[]> {
  if (!token) return []
  try {
    const res = await fetch(`${bridgeUrl.replace(/\/+$/, '')}/api/poll`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'X-Seva-Token': token.trim(),
      },
    })
    if (res.ok) {
      const data = await res.json()
      return (data.items || []) as SevaExchangePayload[]
    }
  } catch (e) {
    console.warn('[SEVA Bridge] Poll error:', e)
  }
  return []
}

/**
 * Send computed satellite analysis results back to Desktop GIS (/api/export)
 */
export async function exportResultsToBridge(
  payload: SevaExchangePayload,
  token: string,
  bridgeUrl = DEFAULT_BRIDGE_URL
): Promise<boolean> {
  if (!token) return false
  try {
    const res = await fetch(`${bridgeUrl.replace(/\/+$/, '')}/api/export`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'X-Seva-Token': token.trim(),
      },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch (e) {
    console.warn('[SEVA Bridge] Export error:', e)
    return false
  }
}

/**
 * Helper to build seva-exchange v1 result payload from active farm stats
 */
export function buildResultPayload(
  farm: { id: string; name: string; crop?: string; polygon?: [number, number][]; lat: number; lon: number },
  stats: {
    ndvi?: number
    ndmi?: number
    ndre?: number
    health?: string
    stress?: number
    dndvi?: number
    irrigation?: string
    vran?: number
    alert?: number
    scene?: string
  }
): SevaExchangePayload {
  const ring = farm.polygon || [
    [farm.lon - 0.002, farm.lat - 0.002],
    [farm.lon + 0.002, farm.lat - 0.002],
    [farm.lon + 0.002, farm.lat + 0.002],
    [farm.lon - 0.002, farm.lat + 0.002],
    [farm.lon - 0.002, farm.lat - 0.002],
  ]

  const feature: SevaFeature = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
    properties: {
      seva_id: farm.id,
      name: farm.name,
      crop: farm.crop || 'Paddy (Rice)',
      sv_scene: stats.scene || 'S2-L2A-LIVE',
      sv_synced: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      sv_ndvi: typeof stats.ndvi === 'number' ? Math.round(stats.ndvi * 1000) / 1000 : 0.74,
      sv_ndmi: typeof stats.ndmi === 'number' ? Math.round(stats.ndmi * 1000) / 1000 : 0.24,
      sv_ndre: typeof stats.ndre === 'number' ? Math.round(stats.ndre * 1000) / 1000 : 0.46,
      sv_health: stats.health || 'Optimal / Vigorous',
      sv_stress: typeof stats.stress === 'number' ? Math.round(stats.stress * 100) / 100 : 0.12,
      sv_dndvi: typeof stats.dndvi === 'number' ? Math.round(stats.dndvi * 1000) / 1000 : 0.02,
      sv_irrig: stats.irrigation || '32mm drip cycle at 06:00 (FAO-56)',
      sv_vran: typeof stats.vran === 'number' ? Math.round(stats.vran * 10) / 10 : 85.0,
      sv_alert: stats.alert || 0,
    },
  }

  return {
    type: 'FeatureCollection',
    seva_exchange: '1',
    source: {
      app: 'SEVA',
      version: '1.0.0',
      project: farm.name,
    },
    created: new Date().toISOString(),
    features: [feature],
    run_id: `run-${Date.now()}`,
  }
}
