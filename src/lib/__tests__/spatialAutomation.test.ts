import test from 'node:test'
import assert from 'node:assert/strict'
import {
  searchSentinelStac,
  buildTiTilerTileUrl,
  buildSentinelNdviTileUrl,
  PUBLIC_STAC_ENDPOINTS,
} from '../stacTitiler'
import {
  delineateParcelBoundaryFromPoint,
  isPointInsideParcel,
} from '../boundaryDelineator'
import {
  executeInBrowserSpatialSql,
  exportToGeoParquetSchema,
} from '../geolibreDuckDb'

test('buildTiTilerTileUrl creates compliant XYZ tile endpoint with expression and colormap', () => {
  const url = buildTiTilerTileUrl({
    cogUrl: 'https://example.com/sentinel_b8.tif',
    expression: '(b1-b2)/(b1+b2)',
    colormapName: 'rdylgn',
    rescale: [-0.1, 0.85],
  })

  assert.ok(url.startsWith('https://titiler.xyz/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png'))
  assert.ok(url.includes('url=https%3A%2F%2Fexample.com%2Fsentinel_b8.tif'))
  assert.ok(url.includes('colormap_name=rdylgn'))
  assert.ok(url.includes('rescale=-0.1%2C0.85'))
})

test('buildSentinelNdviTileUrl constructs dual-band ratio tile link', () => {
  const url = buildSentinelNdviTileUrl(
    'https://example.com/b4.tif',
    'https://example.com/b8.tif',
    'ylgn'
  )
  assert.ok(url.includes('colormap_name=ylgn'))
  assert.ok(url.includes('expression=%28b1-b2%29%2F%28b1%2Bb2%29'))
})

test('searchSentinelStac returns valid catalog items with fallback resilience', async () => {
  const items = await searchSentinelStac({
    bbox: [78.1, 14.2, 78.2, 14.3],
    startDate: '2026-10-01',
    endDate: '2026-10-25',
    maxCloudCover: 15,
  })

  assert.ok(Array.isArray(items))
  assert.ok(items.length > 0)
  assert.equal(items[0].collection, 'sentinel-2-l2a')
  assert.ok(items[0].assets.B04)
  assert.ok(items[0].assets.B08)
})

test('delineateParcelBoundaryFromPoint generates closed polygon ring and calculates area & perimeter', () => {
  const lat = 14.4426
  const lon = 79.9865
  const res = delineateParcelBoundaryFromPoint(lat, lon, { radiusMeters: 120 })

  assert.ok(res.ring.length >= 4)
  // Ensure closed polygon
  assert.deepEqual(res.ring[0], res.ring[res.ring.length - 1])
  assert.ok(res.areaHectares > 0.5 && res.areaHectares < 15)
  assert.ok(res.perimeterMeters > 100)
  assert.ok(res.confidenceScore >= 0.9)
  assert.equal(res.algorithm, 'UNet-Sentinel2')

  // Center point should be inside the parcel
  assert.equal(isPointInsideParcel(lat, lon, res.ring), true)
  // Far outside point should not be inside
  assert.equal(isPointInsideParcel(lat + 0.1, lon + 0.1, res.ring), false)
})

test('executeInBrowserSpatialSql calculates PMFBY loss triggers and recommendations', () => {
  const parcels = [
    {
      id: 'p1',
      name: 'Plot A (Healthy Paddy)',
      crop: 'Paddy',
      areaHa: 2.5,
      ndvi: 0.74,
      ndmi: 0.42,
      stressFraction: 0.08,
    },
    {
      id: 'p2',
      name: 'Plot B (Drought Damaged)',
      crop: 'Cotton',
      areaHa: 4.0,
      ndvi: 0.32,
      ndmi: 0.08,
      stressFraction: 0.65, // > 33% threshold
    },
  ]

  const stats = executeInBrowserSpatialSql(parcels)
  assert.equal(stats.length, 2)

  // Plot A
  assert.equal(stats[0].pmfbyLossThresholdExceeded, false)
  assert.equal(stats[0].stressPercentage, 8)

  // Plot B
  assert.equal(stats[1].pmfbyLossThresholdExceeded, true)
  assert.equal(stats[1].stressPercentage, 65)
  assert.ok(stats[1].estimatedLossPercentage > 50)
  assert.ok(stats[1].recommendedAction.includes('PMFBY'))
})

test('exportToGeoParquetSchema formats valid GeoParquet feature specification', () => {
  const ring: [number, number][] = [
    [78.0, 14.0],
    [78.01, 14.0],
    [78.01, 14.01],
    [78.0, 14.01],
    [78.0, 14.0],
  ]
  const schema: any = exportToGeoParquetSchema([
    { id: 'farm-1', name: 'Kisan Kendra Plot', ring },
  ])

  assert.equal(schema.version, '1.0.0-geoparquet')
  assert.equal(schema.features.length, 1)
  assert.equal(schema.features[0].geometry.type, 'Polygon')
  assert.deepEqual(schema.features[0].geometry.coordinates[0], ring)
})
