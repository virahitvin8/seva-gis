import { useEffect, useRef } from 'react'
import { PARTICLES, type ParticleDef } from './assets/logoPoints'

type Props = { text?: string; state?: 'wait' | 'error'; size?: number; inline?: boolean }
type V = [number, number, number]

const CYCLE = 8400
const clamp = (v: number) => Math.max(0, Math.min(1, v))
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const mix = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const mixCol = (a: V, b: V, t: number): V => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]

export default function LogoLoader({ text = 'Loading…', state = 'wait', size = 64, inline }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return

    const d = Math.min(2, window.devicePixelRatio || 1)
    const S = size
    c.width = S * d
    c.height = S * d

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isError = state === 'error'

    // Choose particle count based on size
    const count = S < 48 ? 160 : S < 80 ? 300 : PARTICLES.length
    const pts: ParticleDef[] = PARTICLES.slice(0, count)

    // Per-particle phase offsets
    const offsets = pts.map((_, i) => ({
      dl: ((i * 37) % 100) / 450,
      tw: ((i * 73) % 100) / 100 * Math.PI * 2,
      r: 0.8 + (((i * 17) % 50) / 100),
    }))

    const K = S * 0.44
    let raf = 0

    const star = (x: number, y: number, r: number) => {
      ctx.beginPath()
      ctx.moveTo(x - r * 2.6, y); ctx.lineTo(x, y - r * 0.35); ctx.lineTo(x + r * 2.6, y); ctx.lineTo(x, y + r * 0.35); ctx.closePath()
      ctx.moveTo(x, y - r * 2.6); ctx.lineTo(x + r * 0.35, y); ctx.lineTo(x, y + r * 2.6); ctx.lineTo(x - r * 0.35, y); ctx.closePath()
      ctx.fill()
    }

    const frame = (now: number) => {
      const t = still ? 0 : now
      const ph = still ? 0.72 : (t % CYCLE) / CYCLE

      ctx.setTransform(d, 0, 0, d, (S * d) / 2, (S * d) / 2)
      ctx.clearRect(-S / 2, -S / 2, S, S)

      // 3D camera rotation
      const ay = still ? 0.4 : (t / 1400) % (Math.PI * 2)
      const ax = -0.15 + (still ? 0 : Math.sin(t / 1900) * 0.12)
      const ca = Math.cos(ay), sa = Math.sin(ay)
      const cx = Math.cos(ax), sx = Math.sin(ax)
      const cam = S * 2.8

      // Transformation phases:
      // 0.00 .. 0.16 : 3D SEVA.GIS Logo
      // 0.16 .. 0.30 : Dismantle & Sparkle Dispersion (CODM disintegrate shockwave)
      // 0.30 .. 0.44 : 3D Stardust converges into Plant Seedling Sprout
      // 0.44 .. 0.68 : SPARKLE WAVE BOOST -> surges into Coconut Palm Tree!
      // 0.68 .. 0.84 : Swaying Coconut Tree in 3D
      // 0.84 .. 1.00 : Dismantle & Re-converge to 3D Logo
      const projected = pts.map((p, i) => {
        const { dl, tw, r: baseR } = offsets[i]
        let v: V
        let rgb: V
        let boost = 0
        let spread = 0

        if (ph < 0.16) {
          // Phase 1: 3D Logo
          v = p.lg
          rgb = p.rgbL
        } else if (ph < 0.30) {
          // Phase 2: Dismantle to Scatter
          const m = ease(clamp((ph - 0.16) / 0.14 - dl))
          v = mix(p.lg, p.sc, m)
          // CODM mythical gun chromatic stardust
          const mythicCol: V = [60, 245, 220]
          rgb = mixCol(p.rgbL, mythicCol, m)
          spread = Math.sin(m * Math.PI)
          boost = spread * 0.45
        } else if (ph < 0.44) {
          // Phase 3: Scatter to Plant Seedling
          const m = ease(clamp((ph - 0.30) / 0.14 - dl))
          v = mix(p.sc, p.pl, m)
          const mythicCol: V = [60, 245, 220]
          rgb = mixCol(mythicCol, p.rgbP, m)
          spread = 1 - m
        } else if (ph < 0.68) {
          // Phase 4: Sparkle Wave Boost - Plant to Coconut Tree!
          const uWave = clamp((ph - 0.44) / 0.24)
          const hFactor = clamp((0.85 - p.tr[1]) / 1.35)
          const grown = ease(clamp((uWave * 1.35 - hFactor * 0.85) / 0.5))
          v = mix(p.pl, p.tr, grown)
          rgb = mixCol(p.rgbP, p.rgbT, grown)
          // Sparkle wave proximity
          const dist = Math.abs(hFactor - uWave)
          boost = Math.exp(-(dist * dist) / 0.032) * 1.6
        } else if (ph < 0.84) {
          // Phase 5: Swaying Coconut Tree
          const sw = Math.sin(t / 600 + tw) * 0.035
          v = [p.tr[0] + sw, p.tr[1], p.tr[2]]
          rgb = p.rgbT
        } else {
          // Phase 6: Scatter & Re-converge to 3D Logo
          const m = ease(clamp((ph - 0.84) / 0.16 - dl))
          v = mix(p.tr, p.lg, m)
          rgb = mixCol(p.rgbT, p.rgbL, m)
          spread = Math.sin(m * Math.PI)
          boost = spread * 0.35
        }

        // Apply idle floating turbulence
        const swX = Math.sin(t / 800 + tw) * 0.02 * spread
        const swY = Math.cos(t / 900 + tw) * 0.02 * spread
        const X = (v[0] + swX) * K
        const Y = (v[1] + swY) * K
        const Z = v[2] * K

        const x1 = X * ca + Z * sa
        const z1 = -X * sa + Z * ca
        const y2 = Y * cx - z1 * sx
        const z2 = Y * sx + z1 * cx

        return { x: x1, y: y2, z: z2, rgb, boost, tw, baseR }
      }).sort((a, b) => a.z - b.z)

      // Render 3D particles with depth sorting & sparkles
      for (const item of projected) {
        const { x: X, y: Y, z: Z, rgb, boost, tw, baseR } = item
        const f = cam / (cam - Z)
        const x = X * f
        const y = Y * f
        const depth = clamp(0.45 + Z / (S * 0.85))

        // Error state shifts palette to fiery ruby / warning amber
        let r = rgb[0]
        let g = rgb[1]
        let b = rgb[2]

        if (isError) {
          r = Math.min(255, rgb[0] + 160)
          g = Math.max(30, Math.round(rgb[1] * 0.35))
          b = Math.max(30, Math.round(rgb[2] * 0.25))
        }

        const shimmer = 0.82 + 0.3 * Math.sin(t / 180 + tw)
        const pr = Math.min(255, Math.round(r * shimmer + boost * 150))
        const pg = Math.min(255, Math.round(g * shimmer + boost * 190))
        const pb = Math.min(255, Math.round(b * shimmer + boost * 210))

        const rad = Math.max(0.65, S * 0.011 * baseR * (1 + boost * 0.9)) * f
        const al = Math.min(1, (0.65 + 0.35 * shimmer) * (0.55 + depth * 0.55))

        // Soft halo on boosted sparkles
        if (boost > 0.45) {
          ctx.beginPath()
          ctx.arc(x, y, rad * 2.2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${Math.round(pr * 0.4)},${Math.round(pg * 0.5)},${Math.round(pb * 0.6)},${(al * 0.4).toFixed(2)})`
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(x, y, rad, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${pr},${pg},${pb},${al.toFixed(2)})`
        ctx.fill()

        // Starburst glints on energetic sparkles
        if (boost > 0.6 || (shimmer > 1.08 && Math.sin(t / 140 + tw * 2) > 0.94)) {
          ctx.globalCompositeOperation = 'lighter'
          ctx.fillStyle = isError ? 'rgba(255,220,160,0.95)' : 'rgba(240,255,250,0.95)'
          star(x, y, rad * 1.25)
          ctx.globalCompositeOperation = 'source-over'
        }
      }

      ctx.globalCompositeOperation = 'source-over'
      if (!still) raf = requestAnimationFrame(frame)
    }

    frame(0)
    if (!still) raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [size, state])

  return (
    <span className={`ll ${state} ${inline ? 'inline' : ''}`} role={state === 'error' ? 'alert' : 'status'} aria-live="polite">
      <canvas ref={ref} className="ll-canvas" style={{ width: size, height: size }} aria-hidden="true" />
      {text && <span className="ll-text">{text}</span>}
    </span>
  )
}
