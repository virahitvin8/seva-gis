import { test } from 'node:test'
import assert from 'node:assert/strict'
import { centroid, areaHa, perimeterM, parseCoordinate, orderRing } from '../geo.ts'

const square: [number, number][] = [
  [0, 0],
  [0.01, 0],
  [0.01, 0.01],
  [0, 0.01],
]

test('centroid averages the ring coordinates', () => {
  assert.deepEqual(centroid(square), { lat: 0.005, lon: 0.005 })
})

test('areaHa returns ~123.9 ha for a 0.01° square near the equator', () => {
  const ha = areaHa(square)
  assert.ok(ha > 120 && ha < 128, `expected ~123.9 ha, got ${ha}`)
})

test('areaHa is zero for fewer than three points', () => {
  assert.equal(areaHa([[0, 0], [1, 1]]), 0)
})

test('perimeterM returns ~4450 m for a 0.01° square', () => {
  const m = perimeterM(square)
  assert.ok(m > 4400 && m < 4500, `expected ~4453 m, got ${m}`)
})

test('parseCoordinate reads degrees/minutes/seconds with a hemisphere', () => {
  const v = parseCoordinate('14° 26′ 6″ N', 'lat')
  assert.ok(v !== null && Math.abs(v - 14.435) < 1e-6, `got ${v}`)
})

test('parseCoordinate rejects a hemisphere that does not match the axis', () => {
  assert.equal(parseCoordinate('14 N', 'lon'), null)
})

test('parseCoordinate rejects out-of-range latitudes', () => {
  assert.equal(parseCoordinate('91 N', 'lat'), null)
})

test('orderRing restores a simple polygon and its true area', () => {
  // A shuffled ring self-crosses, which makes the shoelace sum cancel to 0.
  const shuffled: [number, number][] = [
    [0, 0],
    [0.01, 0.01],
    [0.01, 0],
    [0, 0.01],
  ]
  assert.equal(areaHa(shuffled), 0)

  const ordered = orderRing(shuffled)
  assert.equal(ordered.length, 4)
  const ha = areaHa(ordered)
  assert.ok(ha > 120 && ha < 128, `expected ~123.9 ha after ordering, got ${ha}`)
})
