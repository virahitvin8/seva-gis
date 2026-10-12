import { test } from 'node:test'
import assert from 'node:assert/strict'
import { centroid, areaHa, perimeterM, parseCoordinate, orderRing, ensureClosedRing, validateAoiGeometry } from '../geo.ts'

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

test('ensureClosedRing appends first coordinate when open, preserves when closed', () => {
  const open: [number, number][] = [[0, 0], [1, 0], [1, 1]]
  const closed = ensureClosedRing(open)
  assert.equal(closed.length, 4)
  assert.deepEqual(closed[3], [0, 0])

  const alreadyClosed: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 0]]
  assert.equal(ensureClosedRing(alreadyClosed).length, 4)
})

test('validateAoiGeometry validates simple valid polygon and returns closed ring', () => {
  const result = validateAoiGeometry(square)
  assert.equal(result.valid, true)
  assert.equal(result.isSelfIntersecting, false)
  assert.equal(result.closedRing.length, 5)
  assert.ok(result.areaHa > 120 && result.areaHa < 128)
  assert.ok(result.perimeterM > 4400)
})

test('validateAoiGeometry rejects degenerate polygons with fewer than 3 points', () => {
  const res1 = validateAoiGeometry([[0, 0], [1, 1]])
  assert.equal(res1.valid, false)
  assert.ok(res1.error?.includes('at least 3'))

  const res2 = validateAoiGeometry([[0, 0], [0, 0], [0, 0]])
  assert.equal(res2.valid, false)
  assert.ok(res2.error?.includes('distinct non-coincident'))
})

test('validateAoiGeometry rejects out-of-range coordinates', () => {
  const res = validateAoiGeometry([[190, 0], [0, 0], [0, 10]])
  assert.equal(res.valid, false)
  assert.ok(res.error?.includes('WGS84'))
})

test('validateAoiGeometry detects self-intersecting polygon (hourglass / bowtie)', () => {
  // Bow-tie polygon
  const bowtie: [number, number][] = [
    [0, 0],
    [1, 1],
    [0, 1],
    [1, 0],
  ]
  const res = validateAoiGeometry(bowtie)
  assert.equal(res.valid, false)
  assert.equal(res.isSelfIntersecting, true)
  assert.ok(res.error?.includes('self-intersecting'))
})

test('validateAoiGeometry rejects oversized AOIs exceeding 250,000 ha limit', () => {
  // ~10 degree square is ~1.2 million km² >> 250,000 ha
  const huge: [number, number][] = [
    [70, 15],
    [80, 15],
    [80, 25],
    [70, 25],
  ]
  const res = validateAoiGeometry(huge)
  assert.equal(res.valid, false)
  assert.ok(res.error?.includes('250,000 ha'))
})
