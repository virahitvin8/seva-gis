import { useEffect, useRef } from 'react'

/**
 * Motion-First Canvas 2D Ambient Physics Engine (feitangyuan/motion-web pattern)
 * Real spring damping, gravitational cursor well, orbital satellite rings, and click shockwave dynamics.
 */
export default function Aurora() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return

    let w = 0, h = 0, raf = 0
    const mouse = { x: -9999, y: -9999, targetX: -9999, targetY: -9999, active: false, clicking: false }
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const cols = ['#10b981', '#38bdf8', '#fbbf24', '#a855f7', '#34d399', '#60a5fa', '#22c55e']

    type Particle = {
      x: number
      y: number
      ox: number
      oy: number
      vx: number
      vy: number
      r: number
      c: string
      phase: number
      freq: number
      mass: number
    }

    type Shockwave = {
      x: number
      y: number
      radius: number
      maxRadius: number
      alpha: number
    }

    let ps: Particle[] = []
    const shockwaves: Shockwave[] = []

    const resize = () => {
      const r = c.getBoundingClientRect()
      const d = Math.min(2, window.devicePixelRatio || 1)
      w = c.width = r.width * d
      h = c.height = r.height * d
      const count = Math.min(105, Math.max(45, Math.round((r.width * r.height) / 10000)))
      ps = Array.from({ length: count }, () => {
        const px = Math.random() * w
        const py = Math.random() * h
        return {
          x: px,
          y: py,
          ox: px,
          oy: py,
          vx: (Math.random() - 0.5) * 0.4 * d,
          vy: (Math.random() - 0.5) * 0.4 * d,
          r: (1.4 + Math.random() * 2.2) * d,
          c: cols[Math.floor(Math.random() * cols.length)],
          phase: Math.random() * Math.PI * 2,
          freq: 0.0008 + Math.random() * 0.0018,
          mass: 0.8 + Math.random() * 0.6,
        }
      })
    }
    resize()
    window.addEventListener('resize', resize)

    const onPointerMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      const d = w / r.width
      mouse.targetX = (e.clientX - r.left) * d
      mouse.targetY = (e.clientY - r.top) * d
      mouse.active = true
    }

    const onPointerDown = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      const d = w / r.width
      const clickX = (e.clientX - r.left) * d
      const clickY = (e.clientY - r.top) * d
      shockwaves.push({
        x: clickX,
        y: clickY,
        radius: 10,
        maxRadius: Math.min(w, h) * 0.42,
        alpha: 0.85,
      })
    }

    const onPointerLeave = () => {
      mouse.active = false
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerleave', onPointerLeave)

    const linkDist = Math.min(w, h) * 0.17
    let prevTime = performance.now()

    const loop = (time: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(64, time - prevTime)
      prevTime = time

      // Smooth pointer interpolation with physical spring damping
      if (mouse.active) {
        mouse.x += (mouse.targetX - mouse.x) * 0.14
        mouse.y += (mouse.targetY - mouse.y) * 0.14
      }

      ctx.clearRect(0, 0, w, h)

      // Ambient radial gradient with soft breathing glow
      const breathe = Math.sin(time * 0.001) * 0.08
      const g1 = ctx.createRadialGradient(
        w * 0.28 + Math.cos(time * 0.0007) * w * 0.08,
        h * 0.32 + Math.sin(time * 0.0009) * h * 0.08,
        0,
        w * 0.4,
        h * 0.4,
        w * (0.65 + breathe)
      )
      g1.addColorStop(0, '#064e3bbf')
      g1.addColorStop(0.45, '#0c4a6e44')
      g1.addColorStop(1, '#00000000')
      ctx.fillStyle = g1
      ctx.fillRect(0, 0, w, h)

      // Secondary Solar & Indigo Glow Field
      const g2 = ctx.createRadialGradient(
        w * 0.82 + Math.sin(time * 0.0006) * w * 0.06,
        h * 0.72 + Math.cos(time * 0.0008) * h * 0.06,
        0,
        w * 0.8,
        h * 0.7,
        w * 0.45
      )
      g2.addColorStop(0, '#1e1b4b55')
      g2.addColorStop(0.5, '#042f2e33')
      g2.addColorStop(1, '#00000000')
      ctx.fillStyle = g2
      ctx.fillRect(0, 0, w, h)

      // Concentric orbital satellite rings simulating Copernicus Sentinel-2 orbits
      const orbCenterX = w * 0.32
      const orbCenterY = h * 0.46
      ctx.save()
      ctx.lineWidth = 1
      ctx.setLineDash([4, 12])
      for (let rIdx = 1; rIdx <= 3; rIdx++) {
        const orbR = (Math.min(w, h) * 0.22) * rIdx
        ctx.strokeStyle = rIdx === 1 ? 'rgba(56, 189, 248, 0.12)' : rIdx === 2 ? 'rgba(16, 185, 129, 0.10)' : 'rgba(251, 191, 36, 0.07)'
        ctx.beginPath()
        ctx.arc(orbCenterX, orbCenterY, orbR, 0, Math.PI * 2)
        ctx.stroke()

        // Rotating orbital beacon node
        const orbAngle = time * (0.00025 / rIdx) + rIdx
        const bx = orbCenterX + Math.cos(orbAngle) * orbR
        const by = orbCenterY + Math.sin(orbAngle) * orbR
        ctx.fillStyle = rIdx === 1 ? '#38bdf8' : rIdx === 2 ? '#34d399' : '#fbbf24'
        ctx.beginPath()
        ctx.arc(bx, by, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      // Process shockwaves from user clicks
      for (let sIdx = shockwaves.length - 1; sIdx >= 0; sIdx--) {
        const sw = shockwaves[sIdx]
        sw.radius += (dt / 16) * 6.5
        sw.alpha *= 0.94
        ctx.save()
        ctx.strokeStyle = `rgba(52, 211, 153, ${sw.alpha.toFixed(2)})`
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
        if (sw.alpha < 0.02 || sw.radius > sw.maxRadius) {
          shockwaves.splice(sIdx, 1)
        }
      }

      // Particle physics: spring damping, harmonic float, and cursor gravity well
      for (const p of ps) {
        if (!still) {
          p.phase += p.freq * dt
          p.x += p.vx * (dt / 16) + Math.cos(p.phase) * 0.28
          p.y += p.vy * (dt / 16) + Math.sin(p.phase) * 0.28

          // Elastic boundary bounce
          if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx) }
          else if (p.x > w) { p.x = w; p.vx = -Math.abs(p.vx) }
          if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy) }
          else if (p.y > h) { p.y = h; p.vy = -Math.abs(p.vy) }

          // Motion-web physics: Cursor attraction & repulsion force
          if (mouse.active) {
            const dx = mouse.x - p.x
            const dy = mouse.y - p.y
            const dist = Math.hypot(dx, dy)
            const radius = 220 * (w / (c.getBoundingClientRect().width || 1))
            if (dist < radius && dist > 1) {
              // Gentle gravitational pull towards cursor with physical velocity damping
              const pull = (1 - dist / radius) * 0.45 * (1 / p.mass)
              p.vx += (dx / dist) * pull
              p.vy += (dy / dist) * pull
            }
          }

          // Damping factor to prevent runaway acceleration
          p.vx *= 0.985
          p.vy *= 0.985
        }
      }

      // Constellation light threads connecting neighboring particles
      ctx.lineWidth = 0.8
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y)
          if (d < linkDist) {
            ctx.globalAlpha = (1 - d / linkDist) * 0.38
            ctx.strokeStyle = ps[i].c
            ctx.beginPath()
            ctx.moveTo(ps[i].x, ps[i].y)
            ctx.lineTo(ps[j].x, ps[j].y)
            ctx.stroke()
          }
        }
      }

      // Particle halo rings & glowing cores
      for (const p of ps) {
        ctx.fillStyle = p.c
        ctx.globalAlpha = 0.22
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2)
        ctx.fill()

        ctx.globalAlpha = 0.95
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])

  return <canvas ref={ref} className="au-canvas" aria-hidden="true" />
}

