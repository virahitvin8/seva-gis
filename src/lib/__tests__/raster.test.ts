import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rampColor, rasterSize, statsOf } from '../raster.ts'

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
