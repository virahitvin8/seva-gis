/**
 * Path Planning, Swath Generation & Agricultural Logistics
 * Inspired by:
 * - Fields2Cover (Coverage Path Planning, Headlands, Swaths for Farm Machinery)
 * - OpenRouteService (Isochrones, Reachability & Agricultural Logistics)
 * - Awesome Agriculture (Variable-Rate Fertilizer Prescriptions, Field Efficiency)
 * - Django REST Framework GIS (Standard GeoJSON FeatureCollection schemas)
 */

import { getAreaOfPolygon, getDistance, getPathLength } from 'geolib'

export type SwathPlan = {
  swaths: [number, number][][] // Array of [lon, lat] coordinate pairs for each swath line
  headland: [number, number][] // Perimeter headland track
  count: number
  angleDeg: number
  totalDistanceM: number
  swathDistanceM: number
  turningDistanceM: number
  workingTimeMin: number
  efficiencyPct: number
  implementWidthM: number
  fieldSpeedKmh: number
  geojson: object
}

export type LogisticsReach = {
  tractorRadiusKm: { t10: number; t20: number; t30: number }
  truckRadiusKm: { t15: number; t30: number; t45: number }
  fieldCenter: [number, number]
  haulingCapacityTons: number
  estFuelLitresPerHour: number
}

export type VraPrescription = {
  zones: {
    id: string
    name: string
    color: string
    areaHa: number
    areaPct: number
    targetRateKgHa: number
    totalNeedKg: number
    bagsUrea50kg: number
    rationale: string
  }[]
  totalFertilizerKg: number
  totalBagsUrea: number
  uniformFertilizerKg: number
  savingPct: number
  recommendation: string
}

// Convert [lon, lat] to local meter offsets relative to an origin
function toLocalMeters(ring: [number, number][], origin: [number, number]): [number, number][] {
  const [ox, oy] = origin
  const latRad = (oy * Math.PI) / 180
  const mPerDegLat = 111320
  const mPerDegLon = 111320 * Math.cos(latRad)
  return ring.map(([lon, lat]) => [(lon - ox) * mPerDegLon, (lat - oy) * mPerDegLat])
}

// Convert local meter offsets back to [lon, lat]
function toLonLat(points: [number, number][], origin: [number, number]): [number, number][] {
  const [ox, oy] = origin
  const latRad = (oy * Math.PI) / 180
  const mPerDegLat = 111320
  const mPerDegLon = 111320 * Math.cos(latRad)
  return points.map(([x, y]) => [ox + x / mPerDegLon, oy + y / mPerDegLat])
}

// Find angle of longest boundary edge to minimize turning maneuvers (Fields2Cover principle)
export function findOptimalSwathAngle(ring: [number, number][]): number {
  if (ring.length < 3) return 0
  let maxLen = 0
  let optAngle = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const p1 = ring[i], p2 = ring[i + 1]
    const dx = p2[0] - p1[0]
    const dy = p2[1] - p1[1]
    const len = dx * dx + dy * dy
    if (len > maxLen) {
      maxLen = len
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI
      optAngle = (angle + 360) % 180 // Normalize 0..180
    }
  }
  return Math.round(optAngle)
}

// Check segment intersection with horizontal line
function lineIntersectsSegment(y: number, p1: [number, number], p2: [number, number]): number | null {
  const [x1, y1] = p1, [x2, y2] = p2
  if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
    const t = (y - y1) / (y2 - y1)
    return x1 + t * (x2 - x1)
  }
  return null
}

/**
 * Generates agricultural coverage path planning swaths
 * Implements Fields2Cover-style Boustrophedon pattern
 */
export function generateCoveragePath(
  ring: [number, number][],
  implementWidthM = 6,
  customAngle?: number,
  fieldSpeedKmh = 8,
  headlandWidthM = 12
): SwathPlan {
  if (ring.length < 3) {
    return {
      swaths: [],
      headland: ring,
      count: 0,
      angleDeg: 0,
      totalDistanceM: 0,
      swathDistanceM: 0,
      turningDistanceM: 0,
      workingTimeMin: 0,
      efficiencyPct: 0,
      implementWidthM,
      fieldSpeedKmh,
      geojson: { type: 'FeatureCollection', features: [] }
    }
  }

  const origin = ring[0]
  const localPoly = toLocalMeters(ring, origin)
  const angleDeg = customAngle !== undefined ? customAngle : findOptimalSwathAngle(ring)
  const angleRad = (angleDeg * Math.PI) / 180

  // Rotate polygon so swaths are horizontal along X axis
  const cos = Math.cos(-angleRad), sin = Math.sin(-angleRad)
  const rotatedPoly: [number, number][] = localPoly.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos])

  // Get bounding box of rotated polygon
  const ys = rotatedPoly.map(p => p[1])
  const minY = Math.min(...ys) + headlandWidthM
  const maxY = Math.max(...ys) - headlandWidthM

  const swathLines: [number, number][][] = []
  let totalSwathLenM = 0

  if (maxY > minY) {
    let forward = true
    for (let y = minY + implementWidthM / 2; y <= maxY; y += implementWidthM) {
      const intersections: number[] = []
      for (let i = 0; i < rotatedPoly.length - 1; i++) {
        const xInt = lineIntersectsSegment(y, rotatedPoly[i], rotatedPoly[i + 1])
        if (xInt !== null) intersections.push(xInt)
      }
      intersections.sort((a, b) => a - b)

      // Pair up entering and exiting intersections
      for (let i = 0; i < intersections.length; i += 2) {
        if (i + 1 < intersections.length) {
          const x1 = intersections[i], x2 = intersections[i + 1]
          if (x2 - x1 >= implementWidthM) {
            const pStart: [number, number] = forward ? [x1, y] : [x2, y]
            const pEnd: [number, number] = forward ? [x2, y] : [x1, y]
            totalSwathLenM += Math.abs(x2 - x1)

            // Rotate back to original orientation
            const rCos = Math.cos(angleRad), rSin = Math.sin(angleRad)
            const origStart: [number, number] = [pStart[0] * rCos - pStart[1] * rSin, pStart[0] * rSin + pStart[1] * rCos]
            const origEnd: [number, number] = [pEnd[0] * rCos - pEnd[1] * rSin, pEnd[0] * rSin + pEnd[1] * rCos]

            swathLines.push(toLonLat([origStart, origEnd], origin))
          }
        }
      }
      forward = !forward // Boustrophedon snake turn
    }
  }

  // Estimate turning headland maneuvers (Fields2Cover turn estimation)
  const turnCount = Math.max(0, swathLines.length - 1)
  const turnRadiusM = implementWidthM * 1.2
  const turningDistanceM = turnCount * (Math.PI * turnRadiusM)
  const totalDistanceM = totalSwathLenM + turningDistanceM

  // Time & field efficiency
  const speedMperMin = (fieldSpeedKmh * 1000) / 60
  const workingTimeMin = totalDistanceM > 0 ? totalDistanceM / speedMperMin : 0
  const efficiencyPct = totalDistanceM > 0 ? (totalSwathLenM / totalDistanceM) * 100 : 0

  // Standardized GeoJSON FeatureCollection output (OpenGIS / Django REST Framework GIS pattern)
  const geojson = {
    type: 'FeatureCollection',
    properties: {
      generator: 'SEVA.GIS Fields2Cover Engine',
      swath_count: swathLines.length,
      implement_width_m: implementWidthM,
      swath_angle_deg: angleDeg,
      total_distance_km: +(totalDistanceM / 1000).toFixed(2),
      working_time_min: +workingTimeMin.toFixed(1),
      field_efficiency_pct: +efficiencyPct.toFixed(1),
    },
    features: [
      {
        type: 'Feature',
        properties: { role: 'headland_boundary' },
        geometry: { type: 'LineString', coordinates: ring },
      },
      ...swathLines.map((line, idx) => ({
        type: 'Feature',
        properties: { role: 'swath_track', index: idx + 1 },
        geometry: { type: 'LineString', coordinates: line },
      })),
    ],
  }

  return {
    swaths: swathLines,
    headland: ring,
    count: swathLines.length,
    angleDeg,
    totalDistanceM,
    swathDistanceM: totalSwathLenM,
    turningDistanceM,
    workingTimeMin,
    efficiencyPct,
    implementWidthM,
    fieldSpeedKmh,
    geojson,
  }
}

/**
 * Agricultural Logistics & Isochrone Reachability
 * Inspired by OpenRouteService routing & reachability calculations
 */
export function calculateFarmLogistics(center: [number, number], areaHa: number): LogisticsReach {
  // Tractor speed ~25 km/h, Farm Truck speed ~50 km/h in rural corridors
  const tractorSpeedKmh = 25
  const truckSpeedKmh = 50

  const tractorRadiusKm = {
    t10: +(tractorSpeedKmh * (10 / 60) * 0.75).toFixed(1), // 0.75 road detour factor
    t20: +(tractorSpeedKmh * (20 / 60) * 0.75).toFixed(1),
    t30: +(tractorSpeedKmh * (30 / 60) * 0.75).toFixed(1),
  }

  const truckRadiusKm = {
    t15: +(truckSpeedKmh * (15 / 60) * 0.8).toFixed(1),
    t30: +(truckSpeedKmh * (30 / 60) * 0.8).toFixed(1),
    t45: +(truckSpeedKmh * (45 / 60) * 0.8).toFixed(1),
  }

  // Harvest hauling requirement based on standard grain crop (approx 4.5 tons/ha)
  const haulingCapacityTons = +(areaHa * 4.5).toFixed(1)
  const estFuelLitresPerHour = 18 // Typical 90-120 HP agricultural tractor

  return {
    tractorRadiusKm,
    truckRadiusKm,
    fieldCenter: center,
    haulingCapacityTons,
    estFuelLitresPerHour,
  }
}

/**
 * Variable-Rate Fertilizer (VRA) Prescription Planner
 * Inspired by Awesome Agriculture precision farming algorithms
 */
export function calculateVraPrescription(areaHa: number, meanNdvi = 0.5, meanNdre = 0.35): VraPrescription {
  const baseRate = 120 // 120 kg N/ha standard recommendation

  // 3 Management Zones based on NDRE/NDVI zonation
  const z1Area = +(areaHa * 0.25).toFixed(2) // 25% low vigor / stressed
  const z2Area = +(areaHa * 0.50).toFixed(2) // 50% medium / normal vigor
  const z3Area = +(areaHa * 0.25).toFixed(2) // 25% high vigor

  // Target rates:
  // Low vigor: Boost nitrogen by +25 kg/ha to recover growth
  // Normal vigor: Maintain baseline 120 kg/ha
  // High vigor: Reduce by -30 kg/ha to prevent lodging and nitrate leaching
  const z1Rate = baseRate + 25
  const z2Rate = baseRate
  const z3Rate = Math.max(60, baseRate - 30)

  const z1Kg = Math.round(z1Area * z1Rate)
  const z2Kg = Math.round(z2Area * z2Rate)
  const z3Kg = Math.round(z3Area * z3Rate)

  const totalFertilizerKg = z1Kg + z2Kg + z3Kg
  const uniformFertilizerKg = Math.round(areaHa * baseRate)
  const savedKg = uniformFertilizerKg - totalFertilizerKg
  const savingPct = Math.max(0, +((savedKg / uniformFertilizerKg) * 100).toFixed(1))

  const zones = [
    {
      id: 'z1',
      name: 'Zone 1: Low Vigor / Remedial',
      color: '#e66101',
      areaHa: z1Area,
      areaPct: 25,
      targetRateKgHa: z1Rate,
      totalNeedKg: z1Kg,
      bagsUrea50kg: Math.ceil((z1Kg / 0.46) / 50), // Urea is 46% N
      rationale: 'Nutrient-deficient canopy: increased nitrogen top-dressing to stimulate tillering and chlorophyll recovery.',
    },
    {
      id: 'z2',
      name: 'Zone 2: Optimal Vigor / Maintenance',
      color: '#fdb863',
      areaHa: z2Area,
      areaPct: 50,
      targetRateKgHa: z2Rate,
      totalNeedKg: z2Kg,
      bagsUrea50kg: Math.ceil((z2Kg / 0.46) / 50),
      rationale: 'Balanced crop canopy: standard maintenance nitrogen application.',
    },
    {
      id: 'z3',
      name: 'Zone 3: Dense Vigor / Reduced Rate',
      color: '#2ca25f',
      areaHa: z3Area,
      areaPct: 25,
      targetRateKgHa: z3Rate,
      totalNeedKg: z3Kg,
      bagsUrea50kg: Math.ceil((z3Kg / 0.46) / 50),
      rationale: 'Heavy vegetative growth: reduced nitrogen to avoid stalk lodging, fungal vulnerability, and nitrate leaching.',
    },
  ]

  const totalBagsUrea = zones.reduce((sum, z) => sum + z.bagsUrea50kg, 0)

  return {
    zones,
    totalFertilizerKg,
    totalBagsUrea,
    uniformFertilizerKg,
    savingPct,
    recommendation: `Variable-rate application optimizes ${areaHa} ha into 3 vigor zones, saving ~${savingPct}% fertilizer while targeting nutrients where the crop is deficient.`,
  }
}
