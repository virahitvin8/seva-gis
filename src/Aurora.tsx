import { useEffect, useRef } from 'react'

// Drifting glow particles joined by light threads that bend toward the pointer (the particles.js / vanta.js "net" idea).
export default function Aurora() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext('2d')!
    let w = 0, h = 0, raf = 0, mx = -999, my = -999
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const cols = ['#b6f36a', '#5eead4', '#fee08b', '#7dd3fc']
    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string }
    let ps: P[] = []
    const size = () => {
      const r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1)
      w = c.width = r.width * d; h = c.height = r.height * d
      const n = Math.min(70, Math.round((r.width * r.height) / 14000))
      ps = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35 * d, vy: (Math.random() - 0.5) * 0.35 * d, r: (1 + Math.random() * 2) * d, c: cols[Math.floor(Math.random() * cols.length)] }))
    }
    size(); addEventListener('resize', size)
    const move = (e: PointerEvent) => { const r = c.getBoundingClientRect(), d = w / r.width; mx = (e.clientX - r.left) * d; my = (e.clientY - r.top) * d }
    addEventListener('pointermove', move)
    const link = Math.min(w, h) * 0.17
    let lastTime = 0
    const draw = (t: number) => {
      if (!still) raf = requestAnimationFrame(draw)
      if (t - lastTime < 30) return
      lastTime = t

      ctx.clearRect(0, 0, w, h)
      const g = ctx.createRadialGradient(w * 0.3 + Math.sin(t / 4000) * w * 0.1, h * 0.35, 0, w * 0.4, h * 0.4, w * 0.7)
      g.addColorStop(0, '#1e5a3acc'); g.addColorStop(0.5, '#0f2d4a55'); g.addColorStop(1, '#00000000')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
      for (const p of ps) {
        if (!still) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1 }
        const dx = p.x - mx, dy = p.y - my, dd = Math.hypot(dx, dy)
        if (dd < 160 && !still) { p.x += (dx / dd) * 0.6; p.y += (dy / dd) * 0.6 }
      }
      ctx.lineWidth = 1
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y)
        if (d < link) { ctx.globalAlpha = (1 - d / link) * 0.5; ctx.strokeStyle = ps[i].c; ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.stroke() }
      }
      for (const p of ps) {
        ctx.fillStyle = p.c
        ctx.globalAlpha = 0.35
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 0.95
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); removeEventListener('pointermove', move) }
  }, [])
  return <canvas ref={ref} className="au-canvas" aria-hidden="true"/>
}
