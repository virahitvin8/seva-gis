import { useState, useEffect, useCallback } from 'react'

export type ZoomEventDetail = {
  zoom: number
  center?: { lat: number; lon: number }
  scale?: number
}

const STORAGE_KEY = 'seva-global-zoom'
const EVENT_NAME = 'seva-zoom-sync'

export function getSavedZoom(fallback = 15): number {
  if (typeof window === 'undefined') return fallback
  const saved = localStorage.getItem(STORAGE_KEY)
  const parsed = saved ? parseFloat(saved) : NaN
  return Number.isFinite(parsed) && parsed >= 3 && parsed <= 18 ? parsed : fallback
}

export function setGlobalZoom(zoom: number, center?: { lat: number; lon: number }): void {
  if (typeof window === 'undefined') return
  const clamped = Math.max(3, Math.min(19, Math.round(zoom * 10) / 10))
  localStorage.setItem(STORAGE_KEY, String(clamped))
  window.dispatchEvent(
    new CustomEvent<ZoomEventDetail>(EVENT_NAME, {
      detail: {
        zoom: clamped,
        center,
        scale: Math.pow(2, clamped - 15),
      },
    })
  )
}

export function useGlobalZoom(defaultZoom = 15): {
  zoom: number
  center?: { lat: number; lon: number }
  padFactor: number
  scaleFactor: number
  setZoom: (z: number) => void
} {
  const [state, setState] = useState<{ zoom: number; center?: { lat: number; lon: number } }>(() => ({
    zoom: getSavedZoom(defaultZoom),
  }))

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<ZoomEventDetail>
      if (custom.detail && Number.isFinite(custom.detail.zoom)) {
        setState({
          zoom: custom.detail.zoom,
          center: custom.detail.center,
        })
      }
    }
    window.addEventListener(EVENT_NAME, handler)
    return () => window.removeEventListener(EVENT_NAME, handler)
  }, [])

  // Mathematical Mercator inverse padding factor:
  // At zoom 15: padFactor is standard 0.45
  // When zooming in (+1 zoom = 2x magnification): padFactor halves down to 0.05
  // When zooming out (-1 zoom = 0.5x magnification): padFactor doubles up to 2.5
  const padFactor = Math.max(0.04, Math.min(2.8, 0.45 * Math.pow(2, 15 - state.zoom)))
  const scaleFactor = Math.pow(2, state.zoom - 15)

  const setZoom = useCallback((z: number) => {
    setGlobalZoom(z, state.center)
  }, [state.center])

  return {
    zoom: state.zoom,
    center: state.center,
    padFactor,
    scaleFactor,
    setZoom,
  }
}
