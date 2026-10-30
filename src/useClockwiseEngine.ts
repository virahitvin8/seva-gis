/**
 * useClockwiseEngine — the single authoritative timer for the Clockwise
 * Parameter Engine on the entry experience (Rule 2 of the SEVA.GIS build
 * rules).
 *
 * Guarantees:
 * - Exactly ONE interval instance, created inside this hook and cleared in
 *   its effect cleanup. Ticks only update local UI state — never any
 *   network call.
 * - Strict clockwise order: 1 -> 2 -> ... -> N -> 1, one step every
 *   `intervalMs` (default 3000 ms). `rotation` only ever grows for the
 *   automatic cycle and for direct "select" calls, so the dial never jumps
 *   backwards; the explicit `prev()` transport button is the single
 *   intentional counter-clockwise move.
 * - A change of `resetKey` (for example the selected domain) resets cleanly
 *   to step 0 at 12 o'clock and starts a single fresh interval.
 * - Automatically pauses when the user pauses, when the engine scrolls out
 *   of the viewport (IntersectionObserver), when the tab is hidden, when an
 *   external hold is active (hover/focus), or when the visitor prefers
 *   reduced motion.
 */
import { useCallback, useEffect, useState } from 'react'

export const STEP_ANGLE = 60

export interface ClockwiseEngine {
  /** Active step index, 0-based (0 = Step 1 at 12 o'clock). */
  step: number
  /** Cumulative clockwise rotation in degrees for the orbiting indicator. */
  rotation: number
  /** Monotonic restart counter, bumped on every manual action and domain reset. */
  tick: number
  /** True when the visitor prefers reduced motion (auto-cycle disabled). */
  reducedMotion: boolean
  /** True when the user paused via the transport bar. */
  userPaused: boolean
  /** True when an automatic reason pauses the cycle (or the user paused). */
  paused: boolean
  /** True only for automatic pauses: reduced motion, hidden tab, off-screen. */
  autoPaused: boolean
  /** Attach to the engine container for off-screen pause detection. */
  containerRef: (node: HTMLDivElement | null) => void
  /** Select a step directly; the dial always travels clockwise to reach it. */
  selectStep: (index: number) => void
  /** Advance one step clockwise and restart the interval. */
  next: () => void
  /** Step one node counter-clockwise (manual transport only). */
  prev: () => void
  /** Toggle the manual pause. */
  toggleUserPause: () => void
}

export function useClockwiseEngine(
  resetKey: string,
  stepCount: number,
  options?: { intervalMs?: number; externalHold?: boolean }
): ClockwiseEngine {
  const intervalMs = options?.intervalMs ?? 3000
  const externalHold = options?.externalHold ?? false

  const [step, setStep] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [tick, setTick] = useState(0) // restart signal for the interval
  const [userPaused, setUserPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [offscreen, setOffscreen] = useState(false)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  // Visitors who prefer reduced motion never get an auto-cycling engine.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Pause while the tab is hidden.
  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === 'hidden')
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  // Pause while the engine is scrolled out of the viewport.
  useEffect(() => {
    if (!container) return
    const io = new IntersectionObserver(
      entries => setOffscreen(!entries[0]?.isIntersecting),
      { threshold: 0.15 }
    )
    io.observe(container)
    return () => io.disconnect()
  }, [container])

  const autoPaused = reducedMotion || hidden || offscreen || externalHold
  const paused = autoPaused || userPaused

  // A domain change (or any resetKey change) clears the old interval in the
  // cleanup below, resets to step 0, and starts one fresh interval.
  useEffect(() => {
    setStep(0)
    setRotation(r => r + ((0 - (r % 360) + 360) % 360))
    setTick(t => t + 1)
  }, [resetKey])

  // The single authoritative interval. Cleanup is deterministic: any change
  // of pause state, step count, domain or manual tick clears this timer
  // before a new one is created.
  useEffect(() => {
    if (paused || stepCount <= 1) return
    const id = window.setInterval(() => {
      setStep(s => (s + 1) % stepCount)
      setRotation(r => r + STEP_ANGLE)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [paused, stepCount, intervalMs, tick])

  const selectStep = useCallback(
    (index: number) => {
      const i = ((index % stepCount) + stepCount) % stepCount
      setStep(i)
      setRotation(r => r + ((i * STEP_ANGLE - (r % 360) + 360) % 360))
      setTick(t => t + 1)
    },
    [stepCount]
  )

  const next = useCallback(() => {
    setStep(s => (s + 1) % stepCount)
    setRotation(r => r + STEP_ANGLE)
    setTick(t => t + 1)
  }, [stepCount])

  const prev = useCallback(() => {
    setStep(s => (s - 1 + stepCount) % stepCount)
    setRotation(r => r - STEP_ANGLE)
    setTick(t => t + 1)
  }, [stepCount])

  const toggleUserPause = useCallback(() => setUserPaused(p => !p), [])

  return {
    step,
    rotation,
    tick,
    reducedMotion,
    userPaused,
    paused,
    autoPaused,
    containerRef: setContainer,
    selectStep,
    next,
    prev,
    toggleUserPause,
  }
}
