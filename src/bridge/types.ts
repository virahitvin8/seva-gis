/**
 * SEVA.GIS Desktop Link - TypeScript Type Definitions
 * Specification: seva-exchange v1
 */

export interface SevaSource {
  app: 'QGIS' | 'ArcGIS' | 'SEVA' | string
  version?: string
  project?: string
}

export interface SevaGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

export interface SevaResultProperties {
  seva_id: string
  name?: string
  crop?: string
  sv_scene?: string
  sv_synced?: string
  sv_ndvi?: number
  sv_ndmi?: number
  sv_ndre?: number
  sv_health?: string
  sv_stress?: number
  sv_dndvi?: number
  sv_irrig?: string
  sv_vran?: number
  sv_alert?: number
  [key: string]: any
}

export interface SevaFeature {
  type: 'Feature'
  geometry: SevaGeometry
  properties: SevaResultProperties
}

export interface SevaExchangePayload {
  type: 'FeatureCollection'
  seva_exchange: '1'
  source: SevaSource
  created: string
  features: SevaFeature[]
  run_id?: string
}

export interface BridgeHealth {
  ok: boolean
  app: string
  v: number
  last_poll_age: number | null
}
