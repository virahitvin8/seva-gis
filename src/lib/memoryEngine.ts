/**
 * Persistent Long-Term Memory Engine for SEVA·GIS
 * Inspired by thedotmack/claude-mem architecture:
 * Stores episodic memories, semantic reflections, and agricultural timeline events for each farm.
 */

export type FarmMemory = {
  id: string
  farmId: string
  timestamp: string
  type: 'observation' | 'action' | 'gee_spectral' | 'cadastre' | 'mandi' | 'farmer_note'
  title: string
  content: string
  metrics?: {
    ndvi?: number
    moisture?: number
    areaHa?: number
    crop?: string
    surveyNo?: string
  }
}

const MEMORY_STORAGE_PREFIX = 'seva-farm-memories-'

export function getFarmMemories(farmId: string): FarmMemory[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${MEMORY_STORAGE_PREFIX}${farmId}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (err) {
    console.warn('[MemoryEngine] Failed to load farm memories:', err)
  }
  return getDefaultMemories(farmId)
}

export function saveFarmMemory(memory: Omit<FarmMemory, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): FarmMemory {
  const fullMemory: FarmMemory = {
    id: memory.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: memory.timestamp || new Date().toISOString(),
    ...memory,
  }

  const existing = getFarmMemories(memory.farmId)
  const updated = [fullMemory, ...existing.filter(m => m.id !== fullMemory.id)].slice(0, 50) // keep last 50 memories

  try {
    localStorage.setItem(`${MEMORY_STORAGE_PREFIX}${memory.farmId}`, JSON.stringify(updated))
  } catch (err) {
    console.warn('[MemoryEngine] Failed to persist memory:', err)
  }

  return fullMemory
}

export function clearFarmMemories(farmId: string): void {
  try {
    localStorage.removeItem(`${MEMORY_STORAGE_PREFIX}${farmId}`)
  } catch {}
}

function getDefaultMemories(farmId: string): FarmMemory[] {
  const now = new Date()
  const d1 = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10)
  const d2 = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)

  return [
    {
      id: `init-1-${farmId}`,
      farmId,
      timestamp: `${d1}T10:30:00Z`,
      type: 'gee_spectral',
      title: 'Google Earth Engine Baseline Sync',
      content: 'Harmonized Sentinel-2 L2A composite verified. Median NDVI computed at 0.64 across primary parcel.',
      metrics: { ndvi: 0.64 }
    },
    {
      id: `init-2-${farmId}`,
      farmId,
      timestamp: `${d2}T08:15:00Z`,
      type: 'cadastre',
      title: 'Digital RoR Form 1B Verified',
      content: 'Bhu-Aadhaar ULPIN registered. Adjoining family co-sharers (Sy. 75/2A, 75/2B, 75/3, 75/4) mapped on cadastral grid.',
    }
  ]
}
