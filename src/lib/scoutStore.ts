import { useSyncExternalStore } from 'react'

export type ScoutSpot = {
  id: number
  lat: number
  lon: number
  distM: number
  bearing: string
  degree: number
  ndvi: number
  signature: string
  inspection: string
  priority: 'High' | 'Medium' | 'Low'
}

export function generateScoutHotspots(farm: { lat?: number; lon?: number; area?: number }): ScoutSpot[] {
  const centerLat = farm.lat || 14.4
  const centerLon = farm.lon || 78.1

  return [
    {
      id: 1,
      lat: +(centerLat + 0.00045).toFixed(5),
      lon: +(centerLon + 0.00035).toFixed(5),
      distM: 65,
      bearing: 'North-East',
      degree: 42,
      ndvi: 0.32,
      signature: 'Low chlorophyll & canopy yellowing (NDRE drop)',
      inspection: 'Inspect leaf undersides for aphid colonies or yellow rust pustules. Check if basal nitrogen was leached.',
      priority: 'High',
    },
    {
      id: 2,
      lat: +(centerLat - 0.00040).toFixed(5),
      lon: +(centerLon + 0.00020).toFixed(5),
      distM: 52,
      bearing: 'South-East',
      degree: 155,
      ndvi: 0.28,
      signature: 'Severe canopy moisture deficit (NDMI drop)',
      inspection: 'Check for clogged drip lateral, dry furrow tail, or shallow hardpan soil layer.',
      priority: 'High',
    },
    {
      id: 3,
      lat: +(centerLat + 0.00020).toFixed(5),
      lon: +(centerLon - 0.00050).toFixed(5),
      distM: 58,
      bearing: 'North-West',
      degree: 300,
      ndvi: 0.38,
      signature: 'Thin stand density (emerging weed competition)',
      inspection: 'Check for uneven crop emergence, rodent damage, or localized weed infestation.',
      priority: 'Medium',
    },
  ]
}

type ScoutState = {
  showOnMap: boolean
  focusedSpotId: number | null
}

const KEY = 'seva-scout-settings'
let state: ScoutState = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      showOnMap: saved.showOnMap ?? true,
      focusedSpotId: null,
    }
  } catch {
    return { showOnMap: true, focusedSpotId: null }
  }
})()

const listeners = new Set<() => void>()
const notify = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ showOnMap: state.showOnMap }))
  } catch {}
  listeners.forEach((l) => l())
}

export const useScoutState = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => state
  )

export const setShowHotspotsOnMap = (show: boolean) => {
  state = { ...state, showOnMap: show }
  notify()
}

export const toggleHotspotsOnMap = () => {
  state = { ...state, showOnMap: !state.showOnMap }
  notify()
}

export const focusHotspotOnMap = (spotId: number) => {
  state = { ...state, showOnMap: true, focusedSpotId: spotId }
  notify()
  // Scroll smoothly to map card
  const mapEl =
    document.querySelector('.map-card') ||
    document.querySelector('.field-map') ||
    document.getElementById('my-farms')
  if (mapEl) {
    mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
