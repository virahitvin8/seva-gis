/**
 * Cadastral Multi-Unit Measurement & Conversion Engine
 * Reverse-engineered from Fields Area Measure & Indian Revenue Department Standards.
 * 
 * Standard Conversions:
 * - 1 Hectare = 10,000 m² = ~2.4710538 Acres
 * - 1 Acre = 4,046.85642 m²
 * - 1 Guntha = 1/40 Acre = ~101.1714 m² (Standard in Maharashtra, Karnataka, Telangana, Gujarat)
 * - 1 Bigha (Standard Pucca) = 1/1.6 Acre = 2,529.285 m² = 0.625 Acre (Standard in UP, MP, Rajasthan)
 * - 1 Cent = 1/100 Acre = ~40.46856 m² (Standard in Tamil Nadu, Kerala, Andhra Pradesh)
 */

export interface CadastralAreaMetrics {
  sqMeters: number;
  hectares: number;
  acres: number;
  guntha: number;
  bigha: number;
  cents: number;
  perimeterM: number;
  formatted: {
    acres: string;
    hectares: string;
    guntha: string;
    bigha: string;
    cents: string;
    perimeter: string;
    sqMeters: string;
  };
}

export const SQ_METERS_PER_ACRE = 4046.8564224;
export const SQ_METERS_PER_HECTARE = 10000;
export const SQ_METERS_PER_GUNTHA = SQ_METERS_PER_ACRE / 40; // 101.17141 m²
export const SQ_METERS_PER_BIGHA = 2529.285264; // ~0.625 Acre (Standard Pucca Bigha)
export const SQ_METERS_PER_CENT = SQ_METERS_PER_ACRE / 100; // 40.46856 m²

/**
 * Calculates all multi-unit cadastral metrics from square meters and perimeter meters.
 */
export function calculateCadastralMetrics(
  sqMeters: number,
  perimeterM: number = 0
): CadastralAreaMetrics {
  const safeSqM = Math.max(0, sqMeters);
  const safePerimeter = Math.max(0, perimeterM);

  const acres = safeSqM / SQ_METERS_PER_ACRE;
  const hectares = safeSqM / SQ_METERS_PER_HECTARE;
  const guntha = safeSqM / SQ_METERS_PER_GUNTHA;
  const bigha = safeSqM / SQ_METERS_PER_BIGHA;
  const cents = safeSqM / SQ_METERS_PER_CENT;

  return {
    sqMeters: safeSqM,
    hectares,
    acres,
    guntha,
    bigha,
    cents,
    perimeterM: safePerimeter,
    formatted: {
      acres: `${acres.toFixed(2)} ac`,
      hectares: `${hectares.toFixed(2)} ha`,
      guntha: `${guntha.toFixed(1)} Guntha`,
      bigha: `${bigha.toFixed(2)} Bigha`,
      cents: `${cents.toFixed(1)} Cents`,
      perimeter: safePerimeter >= 1000 ? `${(safePerimeter / 1000).toFixed(2)} km` : `${Math.round(safePerimeter)} m`,
      sqMeters: `${Math.round(safeSqM).toLocaleString('en-IN')} m²`,
    },
  };
}

/**
 * Calculates geodesic distance between two [lon, lat] coordinates using Haversine formula (meters).
 */
export function haversineDistanceM(
  p1: [number, number],
  p2: [number, number]
): number {
  const R = 6371008.8; // Mean Earth radius in meters
  const [lon1, lat1] = p1;
  const [lon2, lat2] = p2;

  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates individual perimeter segment lengths (in meters) along a polygon ring.
 */
export function calculateSegmentLengths(ring: [number, number][]): number[] {
  if (!ring || ring.length < 2) return [];

  const lengths: number[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    lengths.push(haversineDistanceM(ring[i], ring[i + 1]));
  }
  return lengths;
}
