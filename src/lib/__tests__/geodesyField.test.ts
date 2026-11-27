import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toUtm,
  toMgrs,
  toDdm,
  toOpenLocationCode,
  toMaidenhead,
  transformWgs84ToDatum,
  estimateGeoidHeightM,
  computeOrthometricAltitudeM,
  estimateMagneticDeclinationDeg,
  computeIgrfField,
  parseIgrfCof,
  parseGeoidPgm,
  sampleGeoidUndulation,
  CoordinateAverager,
  relativeDirectionFromDelta,
  buildFdrsTelemetryFrames,
  bearingDeg,
  compassCardinal16,
  geodesicDistanceM,
  projectWaypoint,
  crossTrackErrorM,
  computeRouteLegTelemetry,
  computeSolarLunarEphemeris,
  computeAveragedFix,
  computeTrackStats,
  exportWaypointsAndTrackGpx,
  exportWaypointsAndTrackKml,
  exportWaypointsCsv,
  parseGpxOrKml,
} from '../geodesyField';
import { ProximityVoiceScheduler } from '../fieldAudioSensors';
import { buildMapLibreRasterStyle, planOfflineTileRegion } from '../offlineMapLayers';

test('toUtm and toMgrs compute accurate WGS84 coordinates for Hyderabad', () => {
  const utm = toUtm(17.385, 78.4867);
  assert.equal(utm.zoneNumber, 44);
  assert.equal(utm.hemisphere, 'N');
  assert.equal(utm.bandLetter, 'Q');
  assert.equal(utm.epsg, 32644);
  assert.ok(Math.abs(utm.easting - 232957.6) < 2, `easting=${utm.easting}`);
  assert.ok(Math.abs(utm.northing - 1923897.3) < 2, `northing=${utm.northing}`);

  const mgrs = toMgrs(17.385, 78.4867, 5);
  assert.ok(mgrs.startsWith('44N (44Q) '), mgrs);
});

test('toDdm, toOpenLocationCode, and toMaidenhead encode accurately', () => {
  const ddm = toDdm(17.385, true);
  assert.ok(ddm.startsWith("17°23.1000'N"), ddm);

  const plus = toOpenLocationCode(17.385, 78.4867);
  assert.match(plus, /^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$/);

  const maiden = toMaidenhead(17.385, 78.4867);
  assert.equal(maiden.length, 6);
  assert.ok(maiden.startsWith('MK'), maiden);
});

test('transformWgs84ToDatum shifts coordinates for non-WGS84 datums', () => {
  const shifted = transformWgs84ToDatum(17.385, 78.4867, 500, 'INDIAN75');
  assert.equal(shifted.datum, 'INDIAN75');
  assert.ok(Math.abs(shifted.lat - 17.385) > 0.0001);
  assert.ok(Math.abs(shifted.lon - 78.4867) > 0.0001);
});

test('estimateGeoidHeightM models Indian Ocean Geoid Low and orthometric MSL', () => {
  const nIndia = estimateGeoidHeightM(10.0, 78.0);
  assert.ok(nIndia < -60 && nIndia > -115, `expected deep negative geoid in South India, got ${nIndia}`);

  const msl = computeOrthometricAltitudeM(200, 10.0, 78.0);
  assert.ok(msl.mslM > 260, `expected MSL > ellipsoid height where N < 0, got ${msl.mslM}`);
  assert.equal(msl.mode, 'egm-model');

  const manual = computeOrthometricAltitudeM(200, 10.0, 78.0, 12.5);
  assert.equal(manual.mslM, 212.5);
  assert.equal(manual.mode, 'manual');
});

test('estimateMagneticDeclinationDeg returns realistic declination', () => {
  const decl = estimateMagneticDeclinationDeg(17.385, 78.4867, new Date('2026-06-01T00:00:00Z'));
  assert.ok(decl > -10 && decl < 10, `decl=${decl}`);
});

test('projectWaypoint and bearingDeg round-trip geodesic navigation', () => {
  const target = projectWaypoint(17.385, 78.4867, 45, 1000);
  const dist = geodesicDistanceM(17.385, 78.4867, target.lat, target.lon);
  const brng = bearingDeg(17.385, 78.4867, target.lat, target.lon);
  assert.ok(Math.abs(dist - 1000) < 2, `dist=${dist}`);
  assert.ok(Math.abs(brng - 45) < 0.2, `brng=${brng}`);
  assert.equal(compassCardinal16(brng), 'NE');
});

test('crossTrackErrorM and computeRouteLegTelemetry compute XTE, VMG, and ETA', () => {
  const start = { lat: 17.385, lon: 78.4867 };
  const end = projectWaypoint(start.lat, start.lon, 0, 1000);
  const offTrack = projectWaypoint(start.lat, start.lon, 90, 50); // 50m east of north leg
  const xte = crossTrackErrorM(offTrack.lat, offTrack.lon, start.lat, start.lon, end.lat, end.lon);
  assert.ok(Math.abs(xte - 50) < 2, `xte=${xte}`);

  const leg = computeRouteLegTelemetry(offTrack.lat, offTrack.lon, 2.0, 0, end.lat, end.lon, start);
  assert.ok(leg.distanceM > 990 && leg.distanceM < 1010);
  assert.ok(leg.vmgMs > 1.8);
  assert.ok(leg.etaSeconds !== null && leg.etaSeconds > 400);
});

test('computeSolarLunarEphemeris produces sunrise, sunset, and moon phase', () => {
  const astro = computeSolarLunarEphemeris(17.385, 78.4867, new Date('2026-03-21T06:00:00Z'));
  assert.ok(astro.sunriseUtc && astro.sunsetUtc && astro.civilDuskUtc);
  assert.ok(astro.dayLengthMin && astro.dayLengthMin > 700 && astro.dayLengthMin < 740);
  assert.ok(astro.moonIlluminationPct >= 0 && astro.moonIlluminationPct <= 100);
});

test('computeAveragedFix computes accuracy-weighted centroid and CEP95', () => {
  const avg = computeAveragedFix([
    { lat: 17.38500, lon: 78.48670, altitudeM: 510, accuracyM: 1.5, timestamp: 1000 },
    { lat: 17.38502, lon: 78.48672, altitudeM: 512, accuracyM: 2.0, timestamp: 2000 },
    { lat: 17.38550, lon: 78.48720, altitudeM: 525, accuracyM: 20.0, timestamp: 3000 },
  ]);
  assert.ok(avg);
  assert.equal(avg.sampleCount, 3);
  assert.equal(avg.bestAccuracyM, 1.5);
  assert.ok(avg.lat < 17.3851, 'high-accuracy fixes should dominate weighted mean');
  assert.ok(avg.estimatedCep95M > 0);
});

test('computeTrackStats computes distance, speed, ascent, descent, and profile', () => {
  const p1 = { lat: 17.385, lon: 78.4867, altM: 500, timestamp: 0, speedMs: 1.5 };
  const p2Geo = projectWaypoint(p1.lat, p1.lon, 90, 200);
  const p2 = { lat: p2Geo.lat, lon: p2Geo.lon, altM: 515, timestamp: 100000, speedMs: 2.0 };
  const p3Geo = projectWaypoint(p2.lat, p2.lon, 90, 200);
  const p3 = { lat: p3Geo.lat, lon: p3Geo.lon, altM: 505, timestamp: 200000, speedMs: 2.0 };

  const stats = computeTrackStats([p1, p2, p3]);
  assert.equal(stats.pointCount, 3);
  assert.ok(Math.abs(stats.distanceM - 400) < 4);
  assert.equal(stats.elapsedSeconds, 200);
  assert.ok(Math.abs(stats.ascentM - 15) < 0.2);
  assert.ok(Math.abs(stats.descentM - 10) < 0.2);
  assert.equal(stats.profile.length, 3);
});

test('GPX, KML, and CSV serialization and parsing round-trip cleanly', () => {
  const wps = [
    { id: 'wp-1', label: 'Borewell North', lat: 17.385, lon: 78.4867, altM: 512, type: 'water', createdAt: '2026-11-27T10:00:00Z' },
  ];
  const trk = [
    { lat: 17.385, lon: 78.4867, altM: 512, timestamp: 1795773600000 },
    { lat: 17.386, lon: 78.4877, altM: 514, timestamp: 1795773660000 },
  ];

  const gpx = exportWaypointsAndTrackGpx('Test Plot', wps, trk);
  assert.ok(gpx.includes('<gpx version="1.1"'));
  assert.ok(gpx.includes('<wpt lat="17.3850000" lon="78.4867000"'));
  const parsedGpx = parseGpxOrKml(gpx);
  assert.equal(parsedGpx.waypoints.length, 1);
  assert.equal(parsedGpx.waypoints[0].label, 'Borewell North');
  assert.equal(parsedGpx.track.length, 2);

  const kml = exportWaypointsAndTrackKml('Test Plot', wps, trk);
  assert.ok(kml.includes('<kml xmlns="http://www.opengis.net/kml/2.2">'));
  const parsedKml = parseGpxOrKml(kml);
  assert.equal(parsedKml.waypoints.length, 1);
  assert.equal(parsedKml.track.length, 2);

  const csv = exportWaypointsCsv(wps);
  assert.ok(csv.includes('Borewell North'));
  assert.ok(csv.includes('44N'));
});

test('IGRF-2025 full spherical harmonics match real geomagnetic declination globally', () => {
  // Sydney ~ +12.5° East, Hyderabad ~ -0.7° to -1.3° West, San Francisco ~ +13° East
  const syd = computeIgrfField(-33.8688, 151.2093, 0, 2025.5);
  assert.ok(syd.declinationDeg > 11 && syd.declinationDeg < 14.5, `Sydney decl=${syd.declinationDeg}`);
  assert.ok(syd.inclinationDeg < -60 && syd.inclinationDeg > -70, `Sydney inc=${syd.inclinationDeg}`);

  const sf = computeIgrfField(37.7749, -122.4194, 0, 2025.5);
  assert.ok(sf.declinationDeg > 11 && sf.declinationDeg < 15, `SF decl=${sf.declinationDeg}`);

  const hyd = computeIgrfField(17.385, 78.4867, 0.5, 2025.5);
  assert.ok(hyd.declinationDeg > -2.5 && hyd.declinationDeg < 0.5, `Hyderabad decl=${hyd.declinationDeg}`);
  assert.ok(hyd.totalIntensityNt > 38000 && hyd.totalIntensityNt < 46000, `Hyderabad F=${hyd.totalIntensityNt}`);

  const parsed = parseIgrfCof('IGRF2025 2025.00 13 8\n 1 0 -29350.00 0.00 12.60 0.00');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'IGRF2025');
  assert.equal(parsed[0].terms[0].g, -29350);
});

test('parseGeoidPgm and sampleGeoidUndulation decode binary P5 PGM grids accurately', () => {
  const header = 'P5\n# Offset -100\n# Scale 0.5\n2 2\n65535\n';
  const hdrBytes = new TextEncoder().encode(header);
  const full = new Uint8Array(hdrBytes.length + 8);
  full.set(hdrBytes, 0);
  const view = new DataView(full.buffer, hdrBytes.length);
  // Offset + Scale * val -> [ -100 + 0.5*200 = 0, -100 + 0.5*300 = 50, ... ]
  view.setUint16(0, 200, false);
  view.setUint16(2, 300, false);
  view.setUint16(4, 200, false);
  view.setUint16(6, 300, false);

  const grid = parseGeoidPgm(full);
  assert.equal(grid.width, 2);
  assert.equal(grid.height, 2);
  const sample0 = sampleGeoidUndulation(grid, 0, 0);
  assert.equal(sample0, 0);
  const sampleMid = sampleGeoidUndulation(grid, 0, 90);
  assert.equal(sampleMid, 25);
});

test('CoordinateAverager, ProximityVoiceScheduler, FDRS telemetry, and offline tile planner work together', () => {
  const avg = new CoordinateAverager(5);
  avg.addSample({ lat: 17.385, lon: 78.4867, altitudeM: 500, accuracyM: 3, timestamp: 1 });
  const r = avg.addSample({ lat: 17.3851, lon: 78.4868, altitudeM: 502, accuracyM: 3, timestamp: 2 });
  assert.ok(r && r.sampleCount === 2);
  avg.reset();
  assert.equal(avg.getCount(), 0);

  assert.equal(relativeDirectionFromDelta(5, 'en'), 'straight ahead');
  assert.equal(relativeDirectionFromDelta(-85, 'en'), 'turn left');
  assert.equal(relativeDirectionFromDelta(90, 'hi'), 'दाएँ मुड़ें');

  const spoken: string[] = [];
  const sched = new ProximityVoiceScheduler();
  assert.equal(sched.evaluate(150, 'turn right', (p) => spoken.push(p), 1000, 'en'), true);
  assert.equal(sched.evaluate(140, 'turn right', (p) => spoken.push(p), 5000, 'en'), false); // cooldown
  assert.equal(sched.evaluate(5, 'straight ahead', (p) => spoken.push(p), 6000, 'en'), true); // arrival bucket change

  const fdrs = buildFdrsTelemetryFrames({ lat: 17.385, lon: 78.4867, altitudeM: 512, speedMs: 1.5, accuracyM: 3.2 }, 42);
  assert.equal(fdrs.gatewayTopic, 'fdrs/data/42');
  assert.equal(fdrs.frames.length, 5);

  const style = buildMapLibreRasterStyle('opentopomap');
  assert.equal(style.layers[0].id, 'base-raster-layer');
  const plan = planOfflineTileRegion('osm-standard', { minLat: 17.38, maxLat: 17.39, minLon: 78.48, maxLon: 78.49 }, 14, 15, 50);
  assert.ok(plan.tileCount > 0 && plan.tileCount <= 50);
});
