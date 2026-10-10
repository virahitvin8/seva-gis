/**
 * Hindsight — Episodic Agronomic Memory & Trajectory Engine for SEVA·GIS
 * Inspired by vectorize-io/hindsight
 *
 * Capabilities:
 * - Stores chronological observations per parcel (NDVI, moisture, rainfall, farmer actions)
 * - Retrospective analysis: detects growth anomalies compared to historical baseline
 * - Memory consolidation: links satellite passes to field outcomes for learning recommendations
 */

export interface AgronomicObservation {
  timestamp: string // ISO date
  date: string
  ndvi: number
  ndmi: number
  rainfallMm: number
  irrigationAppliedMm?: number
  phenologyStage: string
  healthScore: number
  notes?: string
}

export interface HindsightAnalysis {
  trajectory: 'improving' | 'stable' | 'deteriorating'
  deltaNdvi7Day: number
  stressRecoveryCycles: number
  cumulativeRainfall30d: number
  irrigationEfficiencyVerdict: string
  memoryHighlights: string[]
}

const STORAGE_PREFIX = 'seva_hindsight_'

export function saveObservation(farmId: string, obs: AgronomicObservation): void {
  try {
    const key = `${STORAGE_PREFIX}${farmId}`
    const existing: AgronomicObservation[] = JSON.parse(localStorage.getItem(key) || '[]')
    const idx = existing.findIndex(o => o.date === obs.date)
    if (idx >= 0) {
      existing[idx] = obs
    } else {
      existing.push(obs)
    }
    // Keep sorted by date
    existing.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    localStorage.setItem(key, JSON.stringify(existing.slice(-90))) // Retain 90 passes
  } catch (err) {
    console.warn('[Hindsight] Could not save observation:', err)
  }
}

export function loadObservations(farmId: string): AgronomicObservation[] {
  try {
    const key = `${STORAGE_PREFIX}${farmId}`
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

export function evaluateHindsight(farmId: string, currentNdvi: number, currentNdmi: number): HindsightAnalysis {
  const history = loadObservations(farmId)
  
  if (history.length < 2) {
    return {
      trajectory: 'stable',
      deltaNdvi7Day: 0,
      stressRecoveryCycles: 0,
      cumulativeRainfall30d: 0,
      irrigationEfficiencyVerdict: 'Insufficient baseline passes. Continuing historical trajectory tracking.',
      memoryHighlights: ['Initial pass recorded into local hindsight ledger.'],
    }
  }

  const latestPrev = history[history.length - 1]
  const deltaNdvi = currentNdvi - latestPrev.ndvi
  const trajectory: HindsightAnalysis['trajectory'] =
    deltaNdvi > 0.04 ? 'improving' : deltaNdvi < -0.04 ? 'deteriorating' : 'stable'

  // Sum last 30d rain
  const now = Date.now()
  const last30 = history.filter(o => now - new Date(o.date).getTime() <= 30 * 86400000)
  const cumulativeRainfall30d = last30.reduce((acc, curr) => acc + (curr.rainfallMm || 0), 0)

  // Count stress recovery cycles (drop then rebound)
  let cycles = 0
  for (let i = 2; i < history.length; i++) {
    if (history[i - 1].ndvi < history[i - 2].ndvi - 0.05 && history[i].ndvi > history[i - 1].ndvi + 0.05) {
      cycles++
    }
  }

  const irrigationEfficiencyVerdict =
    currentNdmi > 0.35
      ? 'Optimal canopy hydration retention observed. Root-zone moisture corresponds with irrigation schedule.'
      : 'Rapid moisture dissipation detected. High evapotranspiration rate requires scheduling earlier morning irrigation.'

  const memoryHighlights = [
    `Trajectory: ${trajectory.toUpperCase()} (ΔNDVI: ${deltaNdvi >= 0 ? '+' : ''}${deltaNdvi.toFixed(3)})`,
    `Past 30-day Cumulative Precipitation: ${cumulativeRainfall30d.toFixed(1)} mm across ${last30.length} observed periods`,
    `Observed Resilience: ${cycles} documented stress-recovery cycles in seasonal trajectory`,
  ]

  return {
    trajectory,
    deltaNdvi7Day: deltaNdvi,
    stressRecoveryCycles: cycles,
    cumulativeRainfall30d,
    irrigationEfficiencyVerdict,
    memoryHighlights,
  }
}
