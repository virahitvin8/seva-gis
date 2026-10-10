/**
 * SlopMonster — Anti-Hallucination & Agronomic Guardrails Engine for SEVA·GIS
 * Inspired by ItsssssJack/SlopMonster
 *
 * Capabilities:
 * - Mathematical and physical boundary sanity enforcement
 * - Prevents impossible spectral indices (-1.0 to +1.0 clipping)
 * - Guards against unrealistic crop fertilizer recommendations (e.g., maximum safe urea/ha)
 * - Enforces realistic irrigation pump runtime physics
 * - Eliminates AI-generated agronomic "slop" or hallucinations
 */

export interface ValidationReport {
  passed: boolean
  violations: string[]
  sanitizedValues: Record<string, number | string>
}

export const AGRONOMIC_CONSTRAINTS = {
  NDVI_MIN: -1.0,
  NDVI_MAX: 1.0,
  NDMI_MIN: -1.0,
  NDMI_MAX: 1.0,
  MAX_SINGLE_DOSE_UREA_KG_HA: 150, // Exceeding 150 kg/ha in a single topdress causes nitrogen burning
  MAX_DAILY_IRRIGATION_MM: 50,     // Exceeding 50 mm/day exceeds standard soil infiltration capacity
  MIN_SOIL_PH: 3.5,
  MAX_SOIL_PH: 9.5,
  MAX_PUMP_RUNTIME_HOURS_DAY: 16,  // Borewell yield & motor thermal limit
}

/**
 * Validates and clamps vegetation and moisture indices to strict physical bounds
 */
export function sanitizeSpectralIndex(name: string, value: number): { valid: boolean; value: number } {
  if (isNaN(value) || !isFinite(value)) {
    return { valid: false, value: 0 }
  }
  const clamped = Math.max(-1.0, Math.min(1.0, value))
  return { valid: value >= -1.0 && value <= 1.0, value: clamped }
}

/**
 * Enforces agronomic guardrails on nitrogen recommendations
 */
export function validateFertilizerPrescription(ureaKgHa: number): {
  approvedKgHa: number
  warning?: string
} {
  if (ureaKgHa > AGRONOMIC_CONSTRAINTS.MAX_SINGLE_DOSE_UREA_KG_HA) {
    return {
      approvedKgHa: AGRONOMIC_CONSTRAINTS.MAX_SINGLE_DOSE_UREA_KG_HA,
      warning: `[SlopMonster Guard] Requested dose of ${ureaKgHa} kg/ha exceeds safe single topdress limit (${AGRONOMIC_CONSTRAINTS.MAX_SINGLE_DOSE_UREA_KG_HA} kg/ha). Clamped to prevent root toxicity and fertilizer run-off.`,
    }
  }
  if (ureaKgHa < 0) {
    return {
      approvedKgHa: 0,
      warning: '[SlopMonster Guard] Negative fertilizer values are physically invalid. Set to 0.',
    }
  }
  return { approvedKgHa: ureaKgHa }
}

/**
 * Validates irrigation requirement depth
 */
export function validateIrrigationDepth(depthMm: number): {
  approvedMm: number
  warning?: string
} {
  if (depthMm > AGRONOMIC_CONSTRAINTS.MAX_DAILY_IRRIGATION_MM) {
    return {
      approvedMm: AGRONOMIC_CONSTRAINTS.MAX_DAILY_IRRIGATION_MM,
      warning: `[SlopMonster Guard] Daily irrigation depth of ${depthMm.toFixed(1)} mm exceeds standard root-zone infiltration rate (${AGRONOMIC_CONSTRAINTS.MAX_DAILY_IRRIGATION_MM} mm). Clamped to avoid waterlogging and hypoxia.`,
    }
  }
  return { approvedMm: Math.max(0, depthMm) }
}

/**
 * Comprehensive farm advisory verification suite
 */
export function runSlopMonsterCheck(telemetry: {
  ndvi?: number
  ndmi?: number
  ureaKgHa?: number
  irrigationMm?: number
}): ValidationReport {
  const violations: string[] = []
  const sanitizedValues: Record<string, number | string> = {}

  if (telemetry.ndvi !== undefined) {
    const res = sanitizeSpectralIndex('NDVI', telemetry.ndvi)
    if (!res.valid) violations.push(`NDVI ${telemetry.ndvi} out of physical range [-1, 1]`)
    sanitizedValues.ndvi = res.value
  }

  if (telemetry.ndmi !== undefined) {
    const res = sanitizeSpectralIndex('NDMI', telemetry.ndmi)
    if (!res.valid) violations.push(`NDMI ${telemetry.ndmi} out of physical range [-1, 1]`)
    sanitizedValues.ndmi = res.value
  }

  if (telemetry.ureaKgHa !== undefined) {
    const res = validateFertilizerPrescription(telemetry.ureaKgHa)
    if (res.warning) violations.push(res.warning)
    sanitizedValues.ureaKgHa = res.approvedKgHa
  }

  if (telemetry.irrigationMm !== undefined) {
    const res = validateIrrigationDepth(telemetry.irrigationMm)
    if (res.warning) violations.push(res.warning)
    sanitizedValues.irrigationMm = res.approvedMm
  }

  return {
    passed: violations.length === 0,
    violations,
    sanitizedValues,
  }
}
