import { useEffect, useRef } from 'react'

// Motion-First Canvas 2D Ambient Physics Engine (feitangyuan/motion-web pattern)
export default function Aurora() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext('2d')!
    let w = 0, h = 0, raf = 0
    let mouse = { x: -9999, y: -9999, targetX: -9999, targetY: -9999, active: false }
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const cols = ['#10b981', '#38bdf8', '#fbbf24', '#a855f7', '#34d399', '#60a5fa']

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
    }
    let ps: Particle[] = []

    const resize = () => {
      const r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1)
      w = c.width = r.width * d
      h = c.height = r.height * d
      const count = Math.min(85, Math.max(35, Math.round((r.width * r.height) / 12000)))
      ps = Array.from({ length: count }, () => {
        const px = Math.random() * w
        const py = Math.random() * h
        return {
          x: px,
          y: py,
          ox: px,
          oy: py,
          vx: (Math.random() - 0.5) * 0.45 * d,
          vy: (Math.random() - 0.5) * 0.45 * d,
          r: (1.5 + Math.random() * 2.2) * d,
          c: cols[Math.floor(Math.random() * cols.length)],
          phase: Math.random() * Math.PI * 2,
          freq: 0.001 + Math.random() * 0.002,
        }
      })
    }
    resize()
    window.addEventListener('resize', resize)

    const onPointerMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect(), d = w / r.width
      mouse.targetX = (e.clientX - r.left) * d
      mouse.targetY = (e.clientY - r.top) * d
      mouse.active = true
    }
    const onPointerLeave = () => {
      mouse.active = false
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerleave', onPointerLeave)

    const linkDist = Math.min(w, h) * 0.16
    let prevTime = performance.now()

    const loop = (time: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(64, time - prevTime)
      prevTime = time

      // Smooth pointer interpolation
      if (mouse.active) {
        mouse.x += (mouse.targetX - mouse.x) * 0.15
        mouse.y += (mouse.targetY - mouse.y) * 0.15
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

      // Particle physics & spring return
      for (const p of ps) {
        if (!still) {
          p.phase += p.freq * dt
          p.x += p.vx * (dt / 16) + Math.cos(p.phase) * 0.25
          p.y += p.vy * (dt / 16) + Math.sin(p.phase) * 0.25

          // Bounce bounds
          if (p.x < 0 || p.x > w) p.vx *= -1
          if (p.y < 0 || p.y > h) p.vy *= -1

          // Physics repulsion field from mouse
          if (mouse.active) {
            const dx = p.x - mouse.x
            const dy = p.y - mouse.y
            const dist = Math.hypot(dx, dy)
            const repelRadius = 180 * (w / (c.getBoundingClientRect().width || 1))
            if (dist < repelRadius && dist > 1) {
              const force = (1 - dist / repelRadius) * 2.8
              p.x += (dx / dist) * force
              p.y += (dy / dist) * force
            }
          }
        }
      }

      // Draw light threads between neighbors
      ctx.lineWidth = 0.8
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y)
          if (d < linkDist) {
            ctx.globalAlpha = (1 - d / linkDist) * 0.42
            ctx.strokeStyle = ps[i].c
            ctx.beginPath()
            ctx.moveTo(ps[i].x, ps[i].y)
            ctx.lineTo(ps[j].x, ps[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw particle halos
      for (const p of ps) {
        ctx.fillStyle = p.c
        ctx.globalAlpha = 0.25
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 2.8, 0, Math.PI * 2)
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
      window.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])
  return <canvas ref={ref} className="au-canvas" aria-hidden="true" />
}
