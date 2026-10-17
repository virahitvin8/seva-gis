import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assessSmallholderPurity,
  unmixVegetationEndmember,
  computeDroneIndices,
  generateDroneOrthomosaicGrid,
  calibrateSatelliteWithGroundTruth,
  type GroundTruthPoint
} from './smallholderResolution'

test('assessSmallholderPurity correctly classifies 1-acre smallholder parcel', () => {
  const square1Acre: [number, number][] = [
    [78.45, 17.38],
    [78.4506, 17.38],
    [78.4506, 17.3806],
    [78.45, 17.3806],
    [78.45, 17.38],
  ]
  const metrics = assessSmallholderPurity(square1Acre, 0.4047) // ~1 acre

  assert.equal(metrics.isSmallholder, true)
  assert.ok(metrics.areaAcres >= 0.99 && metrics.areaAcres <= 1.05)
  assert.ok(metrics.rawPixelCount10m >= 35 && metrics.rawPixelCount10m <= 45)
  assert.ok(metrics.boundaryContaminationPct > 0)
  assert.ok(metrics.purityConfidenceScore >= 30 && metrics.purityConfidenceScore <= 95)
  assert.ok(metrics.resampledPixelCount1m >= 3500)
  assert.ok(metrics.vraSavingsPct >= 15)
})

test('unmixVegetationEndmember separates pure vegetation from soil background', () => {
  // Dense crop canopy: Low red, high NIR
  const dense = unmixVegetationEndmember(0.04, 0.78)
  assert.ok(dense.pureVegFraction > 0.75)
  assert.ok(dense.pureNdvi > 0.8)
  assert.ok(dense.backgroundSoilFraction < 0.25)

  // Mixed parcel edge: Moderate red, moderate NIR
  const mixed = unmixVegetationEndmember(0.18, 0.42)
  assert.ok(mixed.pureVegFraction < dense.pureVegFraction)
  assert.ok(mixed.backgroundSoilFraction > dense.backgroundSoilFraction)
})

test('computeDroneIndices calculates valid VARI, GLI, TGI, and MPRI values', () => {
  const healthyGreen = computeDroneIndices(60, 180, 40)
  assert.ok(healthyGreen.vari > 0)
  assert.ok(healthyGreen.gli > 0)
  assert.ok(healthyGreen.tgi > 0)
  assert.ok(healthyGreen.mpri > 0)

  const chloroticYellow = computeDroneIndices(190, 180, 40)
  assert.ok(chloroticYellow.vari < healthyGreen.vari)
})

test('generateDroneOrthomosaicGrid produces valid 24x24 micro-cell grid', () => {
  const bounds = {
    minLat: 17.380,
    maxLat: 17.382,
    minLon: 78.450,
    maxLon: 78.452,
  }
  const grid = generateDroneOrthomosaicGrid(bounds, 0.62, 250, 24)

  assert.equal(grid.length, 576) // 24 * 24
  const first = grid[0]
  assert.ok(first.ndvi >= 0.1 && first.ndvi <= 0.95)
  assert.ok(first.rgb.length === 3)
  assert.ok(['High', 'Nominal', 'Reduced'].includes(first.prescriptionZone))
})

test('calibrateSatelliteWithGroundTruth adjusts bias and computes correlation score', () => {
  const satelliteNdvi = 0.50
  const points: GroundTruthPoint[] = [
    {
      id: 'pt-1',
      lat: 17.38,
      lon: 78.45,
      label: 'North Furrow',
      observedHealth: 'excellent',
      leafColorChartScore: 5, // ~0.75 expected
      timestamp: '12:00',
      satelliteNdvi: 0.50,
      calibratedNdvi: 0.50,
      errorDelta: 0,
    },
    {
      id: 'pt-2',
      lat: 17.381,
      lon: 78.451,
      label: 'South Drainage',
      observedHealth: 'normal',
      leafColorChartScore: 4, // ~0.64 expected
      timestamp: '12:05',
      satelliteNdvi: 0.50,
      calibratedNdvi: 0.50,
      errorDelta: 0,
    },
  ]

  const result = calibrateSatelliteWithGroundTruth(satelliteNdvi, points)
  assert.ok(result.calibratedNdvi > satelliteNdvi) // biased higher by optimal ground observations
  assert.ok(result.biasOffset > 0)
  assert.ok(result.r2Score >= 0.85)
  assert.equal(result.calibratedPoints.length, 2)
})
