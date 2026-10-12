import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MIN_GRID_PX, rampColor, rasterSize, statsOf } from '../raster.ts'

test('rampColor interpolates endpoints and midpoint', () => {
  assert.deepEqual(rampColor(['#000000', '#ffffff'], 0), [0, 0, 0])
  assert.deepEqual(rampColor(['#000000', '#ffffff'], 1), [255, 255, 255])
  assert.deepEqual(rampColor(['#000000', '#ffffff'], 0.5), [127.5, 127.5, 127.5])
})

test('rampColor clamps out-of-range inputs', () => {
  assert.deepEqual(rampColor(['#000000', '#ffffff'], -3), [0, 0, 0])
  assert.deepEqual(rampColor(['#000000', '#ffffff'], 9), [255, 255, 255])
})

test('rasterSize honours the pixel cap and never returns < 8 px', () => {
  const r = rasterSize([-1, 0, 1, 1], 10, 100)
  assert.equal(r.w, 100)
  assert.equal(r.h, 50)
  assert.ok(r.wm > 0 && r.hm > 0)

  const tiny = rasterSize([0, 0, 0.00001, 0.00001], 30, 1000)
  assert.ok(tiny.w >= 8 && tiny.h >= 8)
})

test('statsOf computes mean/min/max/percentiles over valid pixels', () => {
  const s = statsOf(new Float32Array([1, 2, 3, 4, 5]), () => true, [-Infinity, Infinity])
  assert.ok(s)
  assert.equal(s.n, 5)
  assert.equal(s.mean, 3)
  assert.equal(s.min, 1)
  assert.equal(s.max, 5)
  assert.equal(s.p10, 1)
  assert.equal(s.p50, 3)
  assert.equal(s.p90, 5)
})

test('statsOf respects the validity mask and value range', () => {
  const values = new Float32Array([1, 2, 3, 4, 5])
  const s = statsOf(values, i => i % 2 === 1, [-Infinity, Infinity])
  assert.ok(s)
  assert.equal(s.n, 2)
  assert.equal(s.mean, 3)

  const ranged = statsOf(values, () => true, [2, 4])
  assert.ok(ranged)
  assert.equal(ranged.n, 3)
  assert.equal(ranged.mean, 3)
})

test('statsOf returns null when nothing is valid', () => {
  assert.equal(statsOf(new Float32Array([1, 2]), () => false, [-Infinity, Infinity]), null)
})

test('rasterSize never collapses a small area of interest to a few blocky cells', () => {
  // A ~0.25 ha field at 10 m source resolution is only a few native pixels wide.
  // It must still be analysed on a dense grid so the map is smooth, not magnified blocks.
  const small = rasterSize([0, 0, 0.0005, 0.0005], 10, 900)
  assert.ok(
    Math.max(small.w, small.h) >= MIN_GRID_PX,
    `expected at least ${MIN_GRID_PX} px on the long side, got ${small.w}x${small.h}`,
  )

  // The pixel cap must still win for a very large area of interest.
  const large = rasterSize([-1, 0, 1, 1], 10, 100)
  assert.equal(large.w, 100)
  assert.equal(large.h, 50)
})

test('statsOf stays exact for small samples', () => {
  const s = statsOf(new Float32Array([5, 1, 4, 2, 3]), () => true, [-Infinity, Infinity])
  assert.ok(s)
  assert.equal(s.p10, 1)
  assert.equal(s.p50, 3)
  assert.equal(s.p90, 5)
})

test('statsOf measures a large raster with exact mean/min/max and close percentiles', () => {
  // 120,000 values crosses the internal sort-to-histogram threshold.
  const n = 120_000
  const values = new Float32Array(n)
  for (let i = 0; i < n; i++) values[i] = i

  const started = Date.now()
  const s = statsOf(values, () => true, [0, n])
  const elapsed = Date.now() - started

  assert.ok(s)
  assert.equal(s.n, n)
  assert.equal(s.min, 0)
  assert.equal(s.max, n - 1)
  assert.equal(s.mean, (n - 1) / 2)

  // The histogram bin width is (max - min) / 2048, so percentiles are within one bin.
  const binWidth = (n - 1) / 2048
  assert.ok(Math.abs(s.p10 - n * 0.1) <= binWidth * 2, `p10 was ${s.p10}`)
  assert.ok(Math.abs(s.p50 - n * 0.5) <= binWidth * 2, `p50 was ${s.p50}`)
  assert.ok(Math.abs(s.p90 - n * 0.9) <= binWidth * 2, `p90 was ${s.p90}`)

  // Sorting this many values used to take hundreds of milliseconds per indicator.
  assert.ok(elapsed < 200, `statistics took ${elapsed} ms for ${n} values`)
})
