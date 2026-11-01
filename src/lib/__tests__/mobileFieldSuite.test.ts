import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateCadastralMetrics,
  calculateSegmentLengths,
  haversineDistanceM,
  SQ_METERS_PER_ACRE,
  SQ_METERS_PER_GUNTHA,
  SQ_METERS_PER_CENT
} from '../cadastralUnits'
import {
  encodeDigipin,
  decodeDigipin,
  toDms,
  formatAllCoordinateSystems,
  RURAL_VILLAGE_PRESETS
} from '../digipin'
import { simulateOtaUpdateAvailable } from '../../ota/liveUpdater'

test('calculates accurate multi-unit cadastral metrics including Guntha, Bigha, and Cents', () => {
  // 1 Acre = 4046.856 m² = 40 Guntha = 100 Cents = ~0.4047 Hectare
  const oneAcreSqM = SQ_METERS_PER_ACRE
  const metrics = calculateCadastralMetrics(oneAcreSqM, 254)

  assert.equal(metrics.acres.toFixed(2), '1.00')
  assert.equal(metrics.guntha.toFixed(1), '40.0')
  assert.equal(metrics.cents.toFixed(1), '100.0')
  assert.equal(metrics.hectares.toFixed(4), '0.4047')
  assert.ok(metrics.formatted.acres.includes('1.00 ac'))
  assert.ok(metrics.formatted.guntha.includes('40.0 Guntha'))
  assert.ok(metrics.formatted.cents.includes('100.0 Cents'))
  assert.ok(metrics.formatted.perimeter.includes('254 m'))
})

test('converts 10 hectares into accurate cadastral representations', () => {
  const tenHaSqM = 100000 // 10 ha
  const metrics = calculateCadastralMetrics(tenHaSqM, 1264)

  assert.equal(metrics.hectares.toFixed(2), '10.00')
  assert.ok(metrics.acres > 24.5 && metrics.acres < 24.8) // ~24.71 acres
  assert.ok(metrics.guntha > 980 && metrics.guntha < 990) // ~988.4 Guntha
  assert.ok(metrics.formatted.perimeter.includes('1.26 km'))
})

test('haversineDistanceM measures distance accurately between known points', () => {
  // 0.01 deg latitude is ~1,113 meters
  const dist = haversineDistanceM([78.4867, 17.3850], [78.4867, 17.3950])
  assert.ok(dist > 1100 && dist < 1125)
})

test('calculateSegmentLengths computes boundary edge distances', () => {
  const ring: [number, number][] = [
    [78.4867, 17.3850],
    [78.4897, 17.3850],
    [78.4897, 17.3880],
    [78.4867, 17.3850]
  ]
  const segments = calculateSegmentLengths(ring)
  assert.equal(segments.length, 3)
  assert.ok(segments[0] > 300 && segments[0] < 350)
})

test('encodeDigipin generates formatted 10-character alphanumeric DIGIPIN', () => {
  const digipin = encodeDigipin(16.9458, 79.7824)
  // Format should be XXX-XXX-XXXX
  assert.match(digipin, /^[2-9A-Z]{3}-[2-9A-Z]{3}-[2-9A-Z]{4}$/)
})

test('decodeDigipin reverses DIGIPIN back to coordinate bounds', () => {
  const digipin = '4P7-8K9-2M4A'
  const decoded = decodeDigipin(digipin)
  assert.ok(typeof decoded.lat === 'number')
  assert.ok(typeof decoded.lon === 'number')
  assert.ok(decoded.accuracyM <= 5.0)
})

test('formatAllCoordinateSystems returns unified 5-system coordinate bundle', () => {
  const allCoords = formatAllCoordinateSystems(17.3850, 78.4867)
  assert.ok(allCoords.digipin)
  assert.ok(allCoords.decimal.includes('+17.38500°'))
  assert.ok(allCoords.dms.includes('17°23\''))
  assert.ok(allCoords.utm.includes('44N'))
  assert.ok(allCoords.mgrs.includes('44N'))
})

test('RURAL_VILLAGE_PRESETS contains valid Indian agricultural hubs', () => {
  assert.ok(RURAL_VILLAGE_PRESETS.length >= 5)
  const gaddipalli = RURAL_VILLAGE_PRESETS.find(p => p.name === 'Gaddipalli')
  assert.ok(gaddipalli)
  assert.equal(gaddipalli.pincode, '508201')
  assert.equal(gaddipalli.state, 'Telangana')
})

test('simulateOtaUpdateAvailable triggers prompt callback with valid bundle info', async () => {
  let receivedVersion = ''
  let hotSwapTriggered = false

  simulateOtaUpdateAvailable((info, trigger) => {
    receivedVersion = info.version
    assert.equal(info.sizeFormatted, '1.8 MB')
    assert.equal(info.channel, 'Production')
    assert.ok(info.changelog && info.changelog.length > 0)
    hotSwapTriggered = typeof trigger === 'function'
  })

  assert.equal(receivedVersion, 'v4.3.0-OTA')
  assert.ok(hotSwapTriggered)
})
