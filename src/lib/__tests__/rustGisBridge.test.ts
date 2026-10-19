import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ramerDouglasPeucker,
  visvalingamWhyatt,
  computeBoundingBox,
  pointInPolygonWithBBox,
  computeVectorizedNdvi,
  runRustGisBenchmark,
  type RustCoord,
} from '../rustGisBridge'

test('Ramer-Douglas-Peucker simplifies collinear points cleanly', () => {
  // A straight horizontal line with micro-deviations
  const straightLine: RustCoord[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0.0001 },
    { x: 2, y: -0.0001 },
    { x: 3, y: 0.0001 },
    { x: 4, y: 0 },
  ]

  const simplified = ramerDouglasPeucker(straightLine, 0.01)
  assert.equal(simplified.length, 2)
  assert.deepEqual(simplified[0], { x: 0, y: 0 })
  assert.deepEqual(simplified[1], { x: 4, y: 0 })

  // Line with a prominent corner and intermediate points along the segments
  const cornerLine: RustCoord[] = [
    { x: 0, y: 0 },
    { x: 1, y: 2.50005 }, // along (0,0) -> (2,5)
    { x: 2, y: 5.0 },     // sharp peak
    { x: 3, y: 2.49995 }, // along (2,5) -> (4,0)
    { x: 4, y: 0 },
  ]

  const cornerSimplified = ramerDouglasPeucker(cornerLine, 0.01)
  assert.equal(cornerSimplified.length, 3)
  assert.deepEqual(cornerSimplified[0], { x: 0, y: 0 })
  assert.deepEqual(cornerSimplified[1], { x: 2, y: 5.0 })
  assert.deepEqual(cornerSimplified[2], { x: 4, y: 0 })
})

test('Visvalingam-Whyatt preserves critical corners while dropping negligible area vertices', () => {
  const polygon: RustCoord[] = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5.01, y: 2.5 }, // tiny bump
    { x: 5, y: 5 },
    { x: 0, y: 5 },
    { x: 0, y: 0 },
  ]

  const simplified = visvalingamWhyatt(polygon, 0.1)
  assert.ok(simplified.length < polygon.length)
  assert.ok(simplified.length >= 4)
})

test('Bounding box & Ray-Casting PIP accurately identifies interior coordinates', () => {
  const farmRing: RustCoord[] = [
    { x: 10, y: 10 },
    { x: 20, y: 10 },
    { x: 20, y: 20 },
    { x: 10, y: 20 },
    { x: 10, y: 10 },
  ]

  const bbox = computeBoundingBox(farmRing)
  assert.equal(bbox.minX, 10)
  assert.equal(bbox.maxX, 20)
  assert.equal(bbox.minY, 10)
  assert.equal(bbox.maxY, 20)

  // Point inside
  assert.equal(pointInPolygonWithBBox({ x: 15, y: 15 }, farmRing, bbox), true)

  // Points outside
  assert.equal(pointInPolygonWithBBox({ x: 5, y: 15 }, farmRing, bbox), false)
  assert.equal(pointInPolygonWithBBox({ x: 25, y: 15 }, farmRing, bbox), false)
  assert.equal(pointInPolygonWithBBox({ x: 15, y: 25 }, farmRing, bbox), false)
})

test('Vectorized NDVI correctly computes Sentinel-2 NIR & Red bands', () => {
  const nir = new Float32Array([0.8, 0.6, 0.1, 0.0])
  const red = new Float32Array([0.1, 0.2, 0.1, 0.0])

  const stats = computeVectorizedNdvi(nir, red)

  // Pixel 0: (0.8 - 0.1) / (0.8 + 0.1) = 0.7 / 0.9 ≈ 0.7778
  assert.ok(Math.abs(stats.ndvi[0] - 0.7777778) < 0.001)

  // Pixel 1: (0.6 - 0.2) / (0.6 + 0.2) = 0.4 / 0.8 = 0.5
  assert.ok(Math.abs(stats.ndvi[1] - 0.5) < 0.001)

  // Pixel 2: (0.1 - 0.1) / (0.1 + 0.1) = 0
  assert.ok(Math.abs(stats.ndvi[2] - 0.0) < 0.001)

  // Pixel 3: 0.0 / 0.0 -> zero denominator handled as NaN
  assert.ok(Number.isNaN(stats.ndvi[3]))
  assert.equal(stats.validPixels, 3)
})

test('runRustGisBenchmark executes complete stress test with throughput metrics', () => {
  const bench = runRustGisBenchmark(500)
  assert.equal(bench.originalVertices, 500)
  assert.ok(bench.rdpVertices <= 500)
  assert.ok(bench.vwVertices <= 500)
  assert.ok(bench.pipChecksPerSec > 1000)
  assert.ok(bench.vectorizedRasterOpsPerSec > 10000)
})
