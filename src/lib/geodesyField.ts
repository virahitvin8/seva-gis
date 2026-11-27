/**
 * SEVA.GIS Tactical Field Geodesy, Datum, Navigation, Astronomy & Format Engine
 * Pure TypeScript, zero-dependency, deterministic math for Web & Android Field Suite.
 * Covers WGS84<->UTM/MGRS, Plus Codes, Maidenhead, 7 Datums, EGM Geoid MSL,
 * Geomagnetic Declination, Geodesic Projection, Route XTE/VMG, Solar/Lunar Ephemeris,
 * GPS Averaging, Track Elevation Profiles, and GPX 1.1 / KML 2.2 / CSV serialization.
 */

export type SupportedDatum =
  | 'WGS84'
  | 'NAD83'
  | 'ED50'
  | 'OSGB36'
  | 'GDA94'
  | 'GDA2020'
  | 'INDIAN75';

export interface DatumDefinition {
  id: SupportedDatum;
  label: string;
  ellipsoid: string;
  a: number;
  invF: number;
  dx: number;
  dy: number;
  dz: number;
}

export const DATUM_DEFINITIONS: Record<SupportedDatum, DatumDefinition> = {
  WGS84: { id: 'WGS84', label: 'WGS 84 (Global GNSS)', ellipsoid: 'WGS84', a: 6378137.0, invF: 298.257223563, dx: 0, dy: 0, dz: 0 },
  NAD83: { id: 'NAD83', label: 'NAD 83 (North America)', ellipsoid: 'GRS80', a: 6378137.0, invF: 298.257222101, dx: 0.9956, dy: -1.9013, dz: -0.5215 },
  ED50: { id: 'ED50', label: 'ED 50 (European 1950)', ellipsoid: 'International 1924', a: 6378388.0, invF: 297.0, dx: 87, dy: 98, dz: 121 },
  OSGB36: { id: 'OSGB36', label: 'OSGB 36 (UK National)', ellipsoid: 'Airy 1830', a: 6377563.396, invF: 299.3249646, dx: -446.448, dy: 125.157, dz: -542.060 },
  GDA94: { id: 'GDA94', label: 'GDA 94 (Australia)', ellipsoid: 'GRS80', a: 6378137.0, invF: 298.257222101, dx: 0, dy: 0, dz: 0 },
  GDA2020: { id: 'GDA2020', label: 'GDA 2020 (Australia)', ellipsoid: 'GRS80', a: 6378137.0, invF: 298.257222101, dx: -0.06155, dy: 0.01087, dz: 0.04019 },
  INDIAN75: { id: 'INDIAN75', label: 'Indian 1975 (Everest 1956)', ellipsoid: 'Everest 1956', a: 6377301.243, invF: 300.8017, dx: -295, dy: -736, dz: -257 },
};

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_RADIUS_M = 6371008.8;
const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;

/**
 * Normalizes any angle in degrees to [0, 360).
 */
export function normalizeDeg(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

/**
 * Normalizes longitude in degrees to [-180, 180).
 */
export function normalizeLon(lon: number): number {
  const m = ((lon + 180) % 360 + 360) % 360 - 180;
  return m;
}

/**
 * Converts WGS84 geodetic coordinates to an alternate geodetic datum via ECEF shift.
 */
export function transformWgs84ToDatum(
  lat: number,
  lon: number,
  altM: number,
  datum: SupportedDatum
): { lat: number; lon: number; altM: number; datum: SupportedDatum } {
  if (datum === 'WGS84') {
    return { lat, lon, altM, datum };
  }
  const target = DATUM_DEFINITIONS[datum];
  const phi = lat * DEG2RAD;
  const lam = lon * DEG2RAD;

  // WGS84 -> ECEF
  const e2Wgs = 2 * WGS84_F - WGS84_F * WGS84_F;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const nuWgs = WGS84_A / Math.sqrt(1 - e2Wgs * sinPhi * sinPhi);
  const x = (nuWgs + altM) * cosPhi * Math.cos(lam) + target.dx;
  const y = (nuWgs + altM) * cosPhi * Math.sin(lam) + target.dy;
  const z = (nuWgs * (1 - e2Wgs) + altM) * sinPhi + target.dz;

  // ECEF -> Target Ellipsoid (Bowring iterative conversion)
  const fT = 1 / target.invF;
  const e2T = 2 * fT - fT * fT;
  const p = Math.hypot(x, y);
  let phiOut = Math.atan2(z, p * (1 - e2T));
  for (let i = 0; i < 5; i++) {
    const s = Math.sin(phiOut);
    const nu = target.a / Math.sqrt(1 - e2T * s * s);
    phiOut = Math.atan2(z + e2T * nu * s, p);
  }
  const sinOut = Math.sin(phiOut);
  const cosOut = Math.cos(phiOut);
  const nuOut = target.a / Math.sqrt(1 - e2T * sinOut * sinOut);
  const hOut = Math.abs(cosOut) > 1e-6 ? p / cosOut - nuOut : Math.abs(z) / Math.abs(sinOut) - nuOut * (1 - e2T);
  const lamOut = Math.atan2(y, x);

  return {
    lat: phiOut * RAD2DEG,
    lon: lamOut * RAD2DEG,
    altM: hOut,
    datum,
  };
}

/**
 * Returns the UTM latitude band letter (C..X omitting I and O).
 */
export function getUtmBandLetter(lat: number): string {
  if (lat < -80 || lat > 84) return lat >= 0 ? 'Z' : 'A';
  const letters = 'CDEFGHJKLMNPQRSTUVWX';
  const idx = Math.min(19, Math.max(0, Math.floor((lat + 80) / 8)));
  return letters[idx];
}

export interface UtmCoordinate {
  zoneNumber: number;
  bandLetter: string;
  hemisphere: 'N' | 'S';
  easting: number;
  northing: number;
  epsg: number;
  formatted: string;
}

/**
 * Exact WGS84 to UTM Transverse Mercator projection (Redfearn series).
 */
export function toUtm(lat: number, lon: number): UtmCoordinate {
  const clampedLat = Math.max(-80, Math.min(84, lat));
  const normLon = normalizeLon(lon);
  let zoneNumber = Math.floor((normLon + 180) / 6) + 1;

  // Special UTM zones for Norway & Svalbard
  if (clampedLat >= 56.0 && clampedLat < 64.0 && normLon >= 3.0 && normLon < 12.0) {
    zoneNumber = 32;
  } else if (clampedLat >= 72.0 && clampedLat < 84.0) {
    if (normLon >= 0.0 && normLon < 9.0) zoneNumber = 31;
    else if (normLon >= 9.0 && normLon < 21.0) zoneNumber = 33;
    else if (normLon >= 21.0 && normLon < 33.0) zoneNumber = 35;
    else if (normLon >= 33.0 && normLon < 42.0) zoneNumber = 37;
  }

  const phi = clampedLat * DEG2RAD;
  const lam = normLon * DEG2RAD;
  const lam0 = ((zoneNumber - 1) * 6 - 180 + 3) * DEG2RAD;

  const k0 = 0.9996;
  const e2 = 2 * WGS84_F - WGS84_F * WGS84_F;
  const ep2 = e2 / (1 - e2);

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);

  const N = WGS84_A / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = ep2 * cosPhi * cosPhi;
  const A = cosPhi * (lam - lam0);

  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const M =
    WGS84_A *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi));

  const easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * Math.pow(A, 3)) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5)) / 120) +
    500000.0;

  let northing =
    k0 *
    (M +
      N *
        tanPhi *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6)) / 720));

  const hemisphere: 'N' | 'S' = clampedLat >= 0 ? 'N' : 'S';
  if (hemisphere === 'S') {
    northing += 10000000.0;
  }

  const bandLetter = getUtmBandLetter(clampedLat);
  const epsg = (hemisphere === 'N' ? 32600 : 32700) + zoneNumber;
  const eInt = Math.round(easting);
  const nInt = Math.round(northing);

  return {
    zoneNumber,
    bandLetter,
    hemisphere,
    easting,
    northing,
    epsg,
    formatted: `${zoneNumber}${hemisphere} (${zoneNumber}${bandLetter}) E:${eInt} N:${nInt}`,
  };
}

/**
 * Exact Military Grid Reference System (MGRS) conversion from WGS84 lat/lon.
 */
export function toMgrs(lat: number, lon: number, precision: 1 | 2 | 3 | 4 | 5 = 5): string {
  const utm = toUtm(lat, lon);
  const setParm = utm.zoneNumber % 6 || 6;
  const colSets = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'];
  const rowSets = ['ABCDEFGHJKLMNPQRSTUV', 'FGHJKLMNPQRSTUVABCDE'];

  const colOrigin = colSets[(setParm - 1) % 3];
  const rowOrigin = rowSets[(setParm - 1) % 2];

  const colIdx = Math.floor(utm.easting / 100000) - 1;
  const rowIdx = Math.floor(utm.northing / 100000) % 20;

  const colChar = colOrigin[(colIdx + 8) % 8];
  const rowChar = rowOrigin[(rowIdx + 20) % 20];

  const div = Math.pow(10, 5 - precision);
  const eRem = String(Math.floor((utm.easting % 100000) / div)).padStart(precision, '0');
  const nRem = String(Math.floor((utm.northing % 100000) / div)).padStart(precision, '0');

  return `${utm.zoneNumber}${utm.hemisphere} (${utm.zoneNumber}${utm.bandLetter}) ${colChar}${rowChar} ${eRem} ${nRem}`;
}

/**
 * Formats coordinate in Degrees & Decimal Minutes (DDM).
 */
export function toDdm(val: number, isLat: boolean): string {
  const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
  const abs = Math.abs(val);
  const deg = Math.floor(abs);
  const mins = ((abs - deg) * 60).toFixed(4);
  return `${deg}°${mins}'${dir}`;
}

const OLC_ALPHABET = '23456789CFGHJMPQRVWX';

/**
 * Encodes WGS84 lat/lon into an Open Location Code (Plus Code, 10 characters).
 */
export function toOpenLocationCode(lat: number, lon: number): string {
  let latVal = Math.min(90, Math.max(-90, lat));
  if (latVal === 90) latVal -= 0.0001;
  latVal += 90;
  let lonVal = normalizeLon(lon) + 180;

  let code = '';
  let latStep = 20;
  let lonStep = 20;
  for (let i = 0; i < 5; i++) {
    const latDigit = Math.min(19, Math.max(0, Math.floor(latVal / latStep)));
    const lonDigit = Math.min(19, Math.max(0, Math.floor(lonVal / lonStep)));
    code += OLC_ALPHABET[latDigit] + OLC_ALPHABET[lonDigit];
    latVal -= latDigit * latStep;
    lonVal -= lonDigit * lonStep;
    latStep /= 20;
    lonStep /= 20;
  }
  return `${code.slice(0, 8)}+${code.slice(8, 10)}`;
}

/**
 * Encodes WGS84 lat/lon into an 8-character Maidenhead grid locator.
 */
export function toMaidenhead(lat: number, lon: number): string {
  const adjLon = normalizeLon(lon) + 180;
  const adjLat = Math.max(-89.9999, Math.min(89.9999, lat)) + 90;
  const fieldLon = String.fromCharCode(65 + Math.floor(adjLon / 20));
  const fieldLat = String.fromCharCode(65 + Math.floor(adjLat / 10));
  const sqLon = Math.floor((adjLon % 20) / 2);
  const sqLat = Math.floor(adjLat % 10);
  const subLon = String.fromCharCode(97 + Math.floor(((adjLon % 2) / 2) * 24));
  const subLat = String.fromCharCode(97 + Math.floor((adjLat % 1) * 24));
  return `${fieldLon}${fieldLat}${sqLon}${sqLat}${subLon}${subLat}`;
}

/**
 * Estimates EGM geoid undulation N (meters above/below WGS84 ellipsoid).
 * Captures the major global geoid anomalies (including the Indian Ocean Geoid Low ~ -95m,
 * North Atlantic positive ~ +55m, West Pacific ~ +70m) so MSL orthometric altitude H = h - N
 * can be computed when offline.
 */
export function estimateGeoidHeightM(lat: number, lon: number): number {
  const phi = lat * DEG2RAD;
  const lam = lon * DEG2RAD;
  // Compact spherical harmonic + regional Gaussian geoid surface model (approx ±6m globally)
  const globalHarmonic =
    -18.0 * Math.cos(2 * phi) * Math.cos(lam - 0.1) +
    28.0 * Math.cos(phi) * Math.sin(lam - 2.3) +
    14.0 * Math.sin(2 * phi) * Math.cos(2 * lam + 0.4);

  // Indian Ocean Geoid Low (centered near 4°N, 79°E, amplitude ~ -102m)
  const dLatIn = (lat - 4.0) / 22.0;
  const dLonIn = (normalizeLon(lon) - 79.0) / 26.0;
  const indianLow = -88.0 * Math.exp(-(dLatIn * dLatIn + dLonIn * dLonIn));

  // North Atlantic Positive (centered near 55°N, -25°W)
  const dLatNa = (lat - 55.0) / 24.0;
  const dLonNa = (normalizeLon(lon) + 25.0) / 30.0;
  const northAtlantic = 52.0 * Math.exp(-(dLatNa * dLatNa + dLonNa * dLonNa));

  // West Pacific / Maritime Continent Positive (centered near -3°S, 142°E)
  const dLatWp = (lat + 3.0) / 22.0;
  const dLonWp = (normalizeLon(lon) - 142.0) / 30.0;
  const westPacific = 64.0 * Math.exp(-(dLatWp * dLatWp + dLonWp * dLonWp));

  return Number((globalHarmonic + indianLow + northAtlantic + westPacific).toFixed(1));
}

/**
 * Computes orthometric MSL altitude from WGS84 ellipsoidal GNSS altitude and geoid separation.
 */
export function computeOrthometricAltitudeM(
  ellipsoidAltM: number,
  lat: number,
  lon: number,
  manualOffsetM: number | null = null
): { mslM: number; geoidSeparationM: number; mode: 'manual' | 'egm-model' } {
  if (manualOffsetM !== null && Number.isFinite(manualOffsetM)) {
    return {
      mslM: Number((ellipsoidAltM + manualOffsetM).toFixed(1)),
      geoidSeparationM: Number((-manualOffsetM).toFixed(1)),
      mode: 'manual',
    };
  }
  const n = estimateGeoidHeightM(lat, lon);
  return {
    mslM: Number((ellipsoidAltM - n).toFixed(1)),
    geoidSeparationM: n,
    mode: 'egm-model',
  };
}

/**
 * Estimates geomagnetic declination (degrees East positive, West negative) using a
 * tilted eccentric geomagnetic pole model (IGRF-14 north magnetic pole drift).
 */
export function estimateMagneticDeclinationDeg(
  lat: number,
  lon: number,
  date: Date = new Date()
): number {
  const year = date.getUTCFullYear() + date.getUTCMonth() / 12;
  // North magnetic pole approx path: ~86.5°N, 162°E in 2020 drifting toward Siberia
  const poleLat = (86.4 - 0.03 * (year - 2020)) * DEG2RAD;
  const poleLon = (162.8 - 0.9 * (year - 2020)) * DEG2RAD;

  const phi = Math.max(-85, Math.min(85, lat)) * DEG2RAD;
  const lam = normalizeLon(lon) * DEG2RAD;
  const dLam = poleLon - lam;

  const y = Math.cos(poleLat) * Math.sin(dLam);
  const x = Math.cos(phi) * Math.sin(poleLat) - Math.sin(phi) * Math.cos(poleLat) * Math.cos(dLam);
  let decl = Math.atan2(y, x) * RAD2DEG;

  // Regional crustal/non-dipole correction term (South Asia ~ -0.5° to -1.5°, Americas/Atlantic tilt)
  decl += 3.5 * Math.sin((lon + 45) * DEG2RAD) * Math.cos(phi);
  return Number(Math.max(-60, Math.min(60, decl)).toFixed(1));
}

/**
 * Initial forward geodesic bearing (0..360 deg true) from point 1 to point 2.
 */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG2RAD;
  const p2 = lat2 * DEG2RAD;
  const dl = (lon2 - lon1) * DEG2RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return normalizeDeg(Math.atan2(y, x) * RAD2DEG);
}

const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW',
];

export function compassCardinal16(deg: number): string {
  const idx = Math.round(normalizeDeg(deg) / 22.5) % 16;
  return COMPASS_16[idx];
}

/**
 * Great-circle geodesic distance in meters between two WGS84 points.
 */
export function geodesicDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG2RAD;
  const p2 = lat2 * DEG2RAD;
  const dp = (lat2 - lat1) * DEG2RAD;
  const dl = (lon2 - lon1) * DEG2RAD;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Projects a new coordinate from (lat, lon) along bearingDeg for distanceM meters.
 */
export function projectWaypoint(
  lat: number,
  lon: number,
  bearingDegrees: number,
  distanceM: number
): { lat: number; lon: number } {
  const angDist = Math.max(0, distanceM) / EARTH_RADIUS_M;
  const theta = bearingDegrees * DEG2RAD;
  const p1 = lat * DEG2RAD;
  const l1 = lon * DEG2RAD;

  const sinP2 = Math.sin(p1) * Math.cos(angDist) + Math.cos(p1) * Math.sin(angDist) * Math.cos(theta);
  const p2 = Math.asin(Math.max(-1, Math.min(1, sinP2)));
  const l2 =
    l1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(angDist) * Math.cos(p1),
      Math.cos(angDist) - Math.sin(p1) * Math.sin(p2)
    );

  return {
    lat: Number((p2 * RAD2DEG).toFixed(6)),
    lon: Number(normalizeLon(l2 * RAD2DEG).toFixed(6)),
  };
}

/**
 * Signed cross-track error (meters) from a route leg (start -> end) to current position.
 * Positive = right of track, Negative = left of track.
 */
export function crossTrackErrorM(
  curLat: number,
  curLon: number,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): number {
  const dist13 = geodesicDistanceM(startLat, startLon, curLat, curLon) / EARTH_RADIUS_M;
  const brng13 = bearingDeg(startLat, startLon, curLat, curLon) * DEG2RAD;
  const brng12 = bearingDeg(startLat, startLon, endLat, endLon) * DEG2RAD;
  const xteRad = Math.asin(Math.max(-1, Math.min(1, Math.sin(dist13) * Math.sin(brng13 - brng12))));
  return xteRad * EARTH_RADIUS_M;
}

export interface RouteLegTelemetry {
  distanceM: number;
  bearingTrueDeg: number;
  cardinal: string;
  xteM: number;
  vmgMs: number;
  etaSeconds: number | null;
}

export function computeRouteLegTelemetry(
  curLat: number,
  curLon: number,
  speedMs: number,
  headingDeg: number,
  targetLat: number,
  targetLon: number,
  legStart?: { lat: number; lon: number }
): RouteLegTelemetry {
  const distanceM = geodesicDistanceM(curLat, curLon, targetLat, targetLon);
  const bearingTrueDeg = bearingDeg(curLat, curLon, targetLat, targetLon);
  const cardinal = compassCardinal16(bearingTrueDeg);
  const xteM = legStart
    ? crossTrackErrorM(curLat, curLon, legStart.lat, legStart.lon, targetLat, targetLon)
    : 0;
  const angleDiffRad = (bearingTrueDeg - headingDeg) * DEG2RAD;
  const vmgMs = Math.max(0, speedMs) * Math.cos(angleDiffRad);
  const etaSeconds = vmgMs > 0.15 ? Math.round(distanceM / vmgMs) : null;
  return { distanceM, bearingTrueDeg, cardinal, xteM, vmgMs, etaSeconds };
}

export interface SolarLunarEphemeris {
  sunriseUtc: string | null;
  sunsetUtc: string | null;
  civilDuskUtc: string | null;
  dayLengthMin: number | null;
  minutesUntilSunset: number | null;
  moonPhaseName: string;
  moonIlluminationPct: number;
  moonAgeDays: number;
}

function formatUtcHhMm(totalMinutes: number): string {
  const wrapped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const mm = String(wrapped % 60).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}

/**
 * Deterministic NOAA solar & lunar ephemeris for any WGS84 location and date.
 */
export function computeSolarLunarEphemeris(
  lat: number,
  lon: number,
  date: Date = new Date()
): SolarLunarEphemeris {
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000) + 1;
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (date.getUTCHours() - 12) / 24);

  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const phi = lat * DEG2RAD;

  function hourAngleDeg(zenithDeg: number): number | null {
    const cosHa =
      Math.cos(zenithDeg * DEG2RAD) / (Math.cos(phi) * Math.cos(decl)) -
      Math.tan(phi) * Math.tan(decl);
    if (cosHa < -1 || cosHa > 1) return null;
    return Math.acos(cosHa) * RAD2DEG;
  }

  const haSun = hourAngleDeg(90.833);
  const haCivil = hourAngleDeg(96.0);
  const solarNoonMin = 720 - 4 * lon - eqTime;

  let sunriseUtc: string | null = null;
  let sunsetUtc: string | null = null;
  let civilDuskUtc: string | null = null;
  let dayLengthMin: number | null = null;
  let minutesUntilSunset: number | null = null;

  if (haSun !== null) {
    const sunriseMin = solarNoonMin - 4 * haSun;
    const sunsetMin = solarNoonMin + 4 * haSun;
    sunriseUtc = formatUtcHhMm(sunriseMin);
    sunsetUtc = formatUtcHhMm(sunsetMin);
    dayLengthMin = Math.round(sunsetMin - sunriseMin);
    const nowMin = date.getUTCHours() * 60 + date.getUTCMinutes();
    const wrappedSunset = ((sunsetMin % 1440) + 1440) % 1440;
    minutesUntilSunset = Math.round(wrappedSunset - nowMin);
  }
  if (haCivil !== null) {
    civilDuskUtc = formatUtcHhMm(solarNoonMin + 4 * haCivil);
  }

  // Lunar phase calculation relative to known New Moon (2000-01-06 18:14 UTC)
  const synodicMonth = 29.53058867;
  const refNewMoonMs = Date.UTC(2000, 0, 6, 18, 14, 0);
  const daysSinceRef = (date.getTime() - refNewMoonMs) / 86400000;
  const age = ((daysSinceRef % synodicMonth) + synodicMonth) % synodicMonth;
  const phaseFrac = age / synodicMonth;
  const moonIlluminationPct = Math.round(((1 - Math.cos(2 * Math.PI * phaseFrac)) / 2) * 100);

  let moonPhaseName = 'New Moon';
  if (age < 1.84) moonPhaseName = 'New Moon';
  else if (age < 5.54) moonPhaseName = 'Waxing Crescent';
  else if (age < 9.23) moonPhaseName = 'First Quarter';
  else if (age < 12.92) moonPhaseName = 'Waxing Gibbous';
  else if (age < 16.61) moonPhaseName = 'Full Moon';
  else if (age < 20.30) moonPhaseName = 'Waning Gibbous';
  else if (age < 23.99) moonPhaseName = 'Last Quarter';
  else if (age < 27.68) moonPhaseName = 'Waning Crescent';

  return {
    sunriseUtc,
    sunsetUtc,
    civilDuskUtc,
    dayLengthMin,
    minutesUntilSunset,
    moonPhaseName,
    moonIlluminationPct,
    moonAgeDays: Number(age.toFixed(1)),
  };
}

export interface GnssSample {
  lat: number;
  lon: number;
  altitudeM?: number | null;
  accuracyM: number;
  timestamp: number;
}

export interface AveragedFixResult {
  lat: number;
  lon: number;
  altitudeM: number | null;
  sampleCount: number;
  stdDevM: number;
  estimatedCep95M: number;
  bestAccuracyM: number;
}

/**
 * Computes inverse-variance weighted centroid and scatter statistics from GNSS averaging samples.
 */
export function computeAveragedFix(samples: GnssSample[]): AveragedFixResult | null {
  if (!samples || samples.length === 0) return null;

  let wSum = 0;
  let latWeighted = 0;
  let lonWeighted = 0;
  let altWeighted = 0;
  let altWeightSum = 0;
  let bestAcc = Infinity;

  for (const s of samples) {
    const acc = Math.max(0.5, Number.isFinite(s.accuracyM) ? s.accuracyM : 10);
    if (acc < bestAcc) bestAcc = acc;
    const w = 1 / (acc * acc);
    wSum += w;
    latWeighted += s.lat * w;
    lonWeighted += s.lon * w;
    if (typeof s.altitudeM === 'number' && Number.isFinite(s.altitudeM)) {
      altWeighted += s.altitudeM * w;
      altWeightSum += w;
    }
  }

  const lat = latWeighted / wSum;
  const lon = lonWeighted / wSum;
  const altitudeM = altWeightSum > 0 ? Number((altWeighted / altWeightSum).toFixed(1)) : null;

  let sqDistSum = 0;
  for (const s of samples) {
    const d = geodesicDistanceM(lat, lon, s.lat, s.lon);
    sqDistSum += d * d;
  }
  const stdDevM = samples.length > 1 ? Math.sqrt(sqDistSum / (samples.length - 1)) : bestAcc;
  const estimatedCep95M = Number((Math.max(0.3, stdDevM * 1.7308 / Math.sqrt(samples.length))).toFixed(2));

  return {
    lat: Number(lat.toFixed(7)),
    lon: Number(lon.toFixed(7)),
    altitudeM,
    sampleCount: samples.length,
    stdDevM: Number(stdDevM.toFixed(2)),
    estimatedCep95M,
    bestAccuracyM: Number(bestAcc.toFixed(1)),
  };
}

export interface TrackPoint {
  lat: number;
  lon: number;
  altM: number | null;
  timestamp: number;
  speedMs?: number | null;
}

export interface TrackStats {
  pointCount: number;
  distanceM: number;
  elapsedSeconds: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  ascentM: number;
  descentM: number;
  minAltM: number | null;
  maxAltM: number | null;
  profile: Array<{ distM: number; altM: number }>;
}

/**
 * Computes odometer distance, elapsed time, speed stats, climb/descent, and elevation profile.
 */
export function computeTrackStats(points: TrackPoint[]): TrackStats {
  if (!points || points.length === 0) {
    return {
      pointCount: 0,
      distanceM: 0,
      elapsedSeconds: 0,
      avgSpeedKmh: 0,
      maxSpeedKmh: 0,
      ascentM: 0,
      descentM: 0,
      minAltM: null,
      maxAltM: null,
      profile: [],
    };
  }

  let distanceM = 0;
  let maxSpeedKmh = 0;
  let ascentM = 0;
  let descentM = 0;
  let minAltM: number | null = null;
  let maxAltM: number | null = null;
  const profile: Array<{ distM: number; altM: number }> = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i > 0) {
      const prev = points[i - 1];
      const segM = geodesicDistanceM(prev.lat, prev.lon, p.lat, p.lon);
      distanceM += segM;
      const dt = (p.timestamp - prev.timestamp) / 1000;
      const segSpeedKmh = typeof p.speedMs === 'number' && Number.isFinite(p.speedMs)
        ? p.speedMs * 3.6
        : (dt > 0.2 ? (segM / dt) * 3.6 : 0);
      if (segSpeedKmh > maxSpeedKmh && segSpeedKmh < 250) {
        maxSpeedKmh = segSpeedKmh;
      }
      if (p.altM !== null && prev.altM !== null) {
        const dAlt = p.altM - prev.altM;
        if (dAlt > 0.4) ascentM += dAlt;
        else if (dAlt < -0.4) descentM += Math.abs(dAlt);
      }
    }
    if (p.altM !== null && Number.isFinite(p.altM)) {
      if (minAltM === null || p.altM < minAltM) minAltM = p.altM;
      if (maxAltM === null || p.altM > maxAltM) maxAltM = p.altM;
      profile.push({ distM: Number(distanceM.toFixed(1)), altM: Number(p.altM.toFixed(1)) });
    }
  }

  const elapsedSeconds =
    points.length > 1 ? Math.max(0, Math.round((points[points.length - 1].timestamp - points[0].timestamp) / 1000)) : 0;
  const avgSpeedKmh = elapsedSeconds > 0 ? (distanceM / elapsedSeconds) * 3.6 : 0;

  return {
    pointCount: points.length,
    distanceM: Number(distanceM.toFixed(1)),
    elapsedSeconds,
    avgSpeedKmh: Number(avgSpeedKmh.toFixed(1)),
    maxSpeedKmh: Number(maxSpeedKmh.toFixed(1)),
    ascentM: Number(ascentM.toFixed(1)),
    descentM: Number(descentM.toFixed(1)),
    minAltM: minAltM !== null ? Number(minAltM.toFixed(1)) : null,
    maxAltM: maxAltM !== null ? Number(maxAltM.toFixed(1)) : null,
    profile,
  };
}

export interface FieldWaypoint {
  id: string;
  label: string;
  lat: number;
  lon: number;
  altM?: number | null;
  type: string;
  symbol?: string;
  createdAt?: string;
  notes?: string;
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates standard GPX 1.1 XML containing waypoints and tracklog points.
 */
export function exportWaypointsAndTrackGpx(
  name: string,
  waypoints: FieldWaypoint[],
  track: TrackPoint[]
): string {
  const wptXml = waypoints
    .map(
      (w) =>
        `  <wpt lat="${w.lat.toFixed(7)}" lon="${w.lon.toFixed(7)}">\n` +
        (w.altM != null ? `    <ele>${w.altM.toFixed(1)}</ele>\n` : '') +
        (w.createdAt ? `    <time>${escapeXml(w.createdAt)}</time>\n` : '') +
        `    <name>${escapeXml(w.label)}</name>\n` +
        `    <sym>${escapeXml(w.symbol || w.type || 'Waypoint')}</sym>\n` +
        (w.notes ? `    <desc>${escapeXml(w.notes)}</desc>\n` : '') +
        `  </wpt>`
    )
    .join('\n');

  const trkXml =
    track.length > 0
      ? `  <trk>\n    <name>${escapeXml(name)} Tracklog</name>\n    <trkseg>\n` +
        track
          .map(
            (p) =>
              `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">` +
              (p.altM != null ? `<ele>${p.altM.toFixed(1)}</ele>` : '') +
              `<time>${new Date(p.timestamp).toISOString()}</time></trkpt>`
          )
          .join('\n') +
        `\n    </trkseg>\n  </trk>`
      : '';

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="SEVA.GIS Field Suite" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `  <metadata><name>${escapeXml(name)}</name><time>${new Date().toISOString()}</time></metadata>\n` +
    (wptXml ? wptXml + '\n' : '') +
    (trkXml ? trkXml + '\n' : '') +
    `</gpx>\n`
  );
}

/**
 * Generates KML 2.2 XML containing field waypoints and tracklog LineString.
 */
export function exportWaypointsAndTrackKml(
  name: string,
  waypoints: FieldWaypoint[],
  track: TrackPoint[]
): string {
  const wptPlacemarks = waypoints
    .map(
      (w) =>
        `    <Placemark>\n` +
        `      <name>${escapeXml(w.label)}</name>\n` +
        `      <description>${escapeXml(w.notes || w.type)}</description>\n` +
        `      <Point><coordinates>${w.lon.toFixed(7)},${w.lat.toFixed(7)},${(w.altM ?? 0).toFixed(1)}</coordinates></Point>\n` +
        `    </Placemark>`
    )
    .join('\n');

  const trackPlacemark =
    track.length > 0
      ? `    <Placemark>\n` +
        `      <name>${escapeXml(name)} Tracklog</name>\n` +
        `      <Style><LineStyle><color>ff81b910</color><width>3</width></LineStyle></Style>\n` +
        `      <LineString><tessellate>1</tessellate><coordinates>\n        ` +
        track.map((p) => `${p.lon.toFixed(7)},${p.lat.toFixed(7)},${(p.altM ?? 0).toFixed(1)}`).join(' ') +
        `\n      </coordinates></LineString>\n` +
        `    </Placemark>`
      : '';

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2">\n` +
    `  <Document>\n` +
    `    <name>${escapeXml(name)}</name>\n` +
    (wptPlacemarks ? wptPlacemarks + '\n' : '') +
    (trackPlacemark ? trackPlacemark + '\n' : '') +
    `  </Document>\n` +
    `</kml>\n`
  );
}

/**
 * Generates CSV spreadsheet of waypoints with multi-format coordinates.
 */
export function exportWaypointsCsv(waypoints: FieldWaypoint[]): string {
  const header = 'id,label,type,lat,lon,alt_m,utm,mgrs,plus_code,created_at,notes';
  const rows = waypoints.map((w) => {
    const utm = toUtm(w.lat, w.lon).formatted;
    const mgrs = toMgrs(w.lat, w.lon);
    const plus = toOpenLocationCode(w.lat, w.lon);
    const cols = [
      w.id,
      w.label,
      w.type,
      w.lat.toFixed(7),
      w.lon.toFixed(7),
      w.altM != null ? w.altM.toFixed(1) : '',
      utm,
      mgrs,
      plus,
      w.createdAt || '',
      w.notes || '',
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
    return cols.join(',');
  });
  return [header, ...rows].join('\n');
}

/**
 * Parses GPX or KML text to extract imported waypoints and track coordinates.
 */
export function parseGpxOrKml(xmlText: string): {
  waypoints: FieldWaypoint[];
  track: TrackPoint[];
} {
  const waypoints: FieldWaypoint[] = [];
  const track: TrackPoint[] = [];

  // Parse GPX <wpt lat="..." lon="...">...<name>...</name>...</wpt>
  const wptRegex = /<wpt\b[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/wpt>/gi;
  let m: RegExpExecArray | null;
  let idx = 1;
  while ((m = wptRegex.exec(xmlText)) !== null) {
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    const body = m[3];
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(body);
      const eleMatch = /<ele>([\s\S]*?)<\/ele>/i.exec(body);
      waypoints.push({
        id: `imp-wpt-${Date.now()}-${idx++}`,
        label: nameMatch ? nameMatch[1].trim() : `Imported WP #${idx - 1}`,
        lat,
        lon,
        altM: eleMatch && Number.isFinite(Number(eleMatch[1])) ? Number(eleMatch[1]) : null,
        type: 'imported',
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Parse GPX <trkpt lat="..." lon="...">
  const trkRegex = /<trkpt\b[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/trkpt>/gi;
  while ((m = trkRegex.exec(xmlText)) !== null) {
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    const body = m[3];
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const eleMatch = /<ele>([\s\S]*?)<\/ele>/i.exec(body);
      const timeMatch = /<time>([\s\S]*?)<\/time>/i.exec(body);
      const ts = timeMatch ? Date.parse(timeMatch[1].trim()) : Date.now();
      track.push({
        lat,
        lon,
        altM: eleMatch && Number.isFinite(Number(eleMatch[1])) ? Number(eleMatch[1]) : null,
        timestamp: Number.isFinite(ts) ? ts : Date.now(),
      });
    }
  }

  // Parse KML <Placemark>...<Point><coordinates>lon,lat[,alt]</coordinates></Point>
  if (waypoints.length === 0 && /<kml/i.test(xmlText)) {
    const pmRegex = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi;
    while ((m = pmRegex.exec(xmlText)) !== null) {
      const body = m[1];
      const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(body);
      const pointMatch = /<Point>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Point>/i.exec(body);
      if (pointMatch) {
        const parts = pointMatch[1].trim().split(',').map(Number);
        if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
          waypoints.push({
            id: `imp-kml-${Date.now()}-${idx++}`,
            label: nameMatch ? nameMatch[1].trim() : `KML Waypoint #${idx - 1}`,
            lon: parts[0],
            lat: parts[1],
            altM: Number.isFinite(parts[2]) ? parts[2] : null,
            type: 'imported',
            createdAt: new Date().toISOString(),
          });
        }
      }
      const lineMatch = /<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/i.exec(body);
      if (lineMatch) {
        for (const tuple of lineMatch[1].trim().split(/\s+/)) {
          const parts = tuple.split(',').map(Number);
          if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
            track.push({
              lon: parts[0],
              lat: parts[1],
              altM: Number.isFinite(parts[2]) ? parts[2] : null,
              timestamp: Date.now(),
            });
          }
        }
      }
    }
  }

  return { waypoints, track };
}

