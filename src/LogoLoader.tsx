import { useEffect, useRef } from 'react'

type Props = { text?: string; state?: 'wait' | 'error'; size?: number; inline?: boolean }
type V = [number, number, number]
type P = { sc: V; pl: V; tr: V; hue: number; hue2: number; sat: number; lig: number; dl: number; tw: number; r: number; role: number }

const CYCLE = 7200
const clamp = (v: number) => Math.max(0, Math.min(1, v))
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const mix = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

function build(N: number): P[] {
  const rnd = rng(7), g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5
  const out: P[] = []
  type Seg = { a: V; b: V; len: number }
  const segs: Seg[] = [], tips: V[] = []
  const grow = (p: V, d: V, len: number, depth: number) => {
    const q: V = [p[0] + d[0] * len, p[1] + d[1] * len, p[2] + d[2] * len]
    segs.push({ a: p, b: q, len })
    if (!depth) { tips.push(q); return }
    const kids = depth === 3 ? 4 : 3
    for (let k = 0; k < kids; k++) {
      const az = (k / kids) * 6.283 + rnd() * 0.8 + depth, tilt = depth === 3 ? 0.95 + rnd() * 0.3 : 0.7 + rnd() * 0.4
      const dx = Math.sin(tilt) * Math.cos(az), dz = Math.sin(tilt) * Math.sin(az), dy = -Math.cos(tilt)
      const n: V = [d[0] * 0.55 + dx, d[1] * 0.55 + dy, d[2] * 0.55 + dz], m = Math.hypot(...n)
      grow(q, [n[0] / m, n[1] / m, n[2] / m], len * 0.66, depth - 1)
    }
  }
  grow([0, 0.38, 0], [0, -1, 0], 0.3, 3)
  const segLen = segs.reduce((s, x) => s + x.len, 0)
  const ground = 0.88
  for (let i = 0; i < N; i++) {
    const u = i / N, role = u < 0.14 ? 0 : u < 0.36 ? 1 : 2
    // scatter: a loose sphere shell around the centre
    const a = rnd() * 6.283, e = Math.acos(2 * rnd() - 1), R = 0.55 + rnd() * 0.5
    const sc: V = [Math.sin(e) * Math.cos(a) * R, Math.cos(e) * R * 0.9, Math.sin(e) * Math.sin(a) * R]
    let pl: V, tr: V, hue: number, sat = 0.85, lig = 0.55
    // plant: stem, four leaves in 3D, a little soil mound
    const pr = (i * 0.618034) % 1
    if (pr < 0.3) { const t = rnd(); pl = [Math.sin(t * 2.4) * 0.05 + g() * 0.012, ground - 0.1 - t * 0.7, g() * 0.012] }
    else if (pr < 0.82) {
      const leaf = Math.floor(rnd() * 4), az = leaf * 1.5708 + 0.4, top = leaf < 2
      const ox = Math.sin(0.0) * 0.05, oy = top ? 0.16 : 0.42, L = top ? 0.46 : 0.36
      const uu = rnd(), v = rnd() * 2 - 1, w = Math.sin(Math.PI * uu) * 0.2 * v, ang = -0.7
      const dx = Math.cos(ang) * L * uu, dy = Math.sin(ang) * L * uu * 0.9
      pl = [ox + Math.cos(az) * dx - Math.sin(az) * w, oy + dy + w * 0.2, Math.sin(az) * dx + Math.cos(az) * w]
    } else { const ra = rnd() * 6.283, rr = Math.sqrt(rnd()) * 0.34; pl = [Math.cos(ra) * rr, ground - 0.02 * (1 - rr / 0.34) + g() * 0.01, Math.sin(ra) * rr * 0.6] }
    // tree: trunk, branches, canopy blobs
    const tu = (i * 0.754877) % 1
    if (tu < 0.16) { const t = rnd(), r = 0.095 * (1 - t * 0.55), an = rnd() * 6.283; tr = [Math.cos(an) * r, ground - t * (ground - 0.38), Math.sin(an) * r] }
    else if (tu < 0.4) { let pick = rnd() * segLen, s = segs[0]; for (const x of segs) { if (pick < x.len) { s = x; break } pick -= x.len } const t = rnd(); tr = mix(s.a, s.b, t); tr = [tr[0] + g() * 0.02, tr[1], tr[2] + g() * 0.02] }
    else { const tip = tips[Math.floor(rnd() * tips.length)]; tr = [tip[0] + g() * 0.5, tip[1] + g() * 0.34 + 0.06, tip[2] + g() * 0.5] }
    // colours: wood amber, stem and leaves greens, cyan glints, a few golden fruit
    const c = rnd()
    let hue2: number
    if (tu < 0.4) { hue2 = 28 + rnd() * 14; sat = 0.9; lig = 0.5 }
    else if (c < 0.12) hue2 = 176 + rnd() * 18
    else if (c < 0.2) hue2 = 44 + rnd() * 10
    else hue2 = 95 + rnd() * 55
    if (pr < 0.3) hue = 80 + rnd() * 20
    else if (pr >= 0.82) hue = 38 + rnd() * 10
    else if (c < 0.12) hue = 176 + rnd() * 18
    else hue = 100 + rnd() * 50
    lig = 0.5 + rnd() * 0.14
    out.push({ sc, pl, tr, hue, hue2, sat, lig, dl: rnd(), tw: rnd() * 6.283, r: 0.7 + rnd() * 0.9, role })
  }
  return out
}

export default function LogoLoader({ text = 'Loading…', state = 'wait', size = 64, inline }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext('2d')!
    const d = Math.min(2, devicePixelRatio || 1), S = size
    c.width = S * d; c.height = S * d
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const err = state === 'error'
    const ps = build(S < 48 ? 150 : S < 80 ? 360 : 640)
    const K = S * 0.46
    let raf = 0
    const star = (x: number, y: number, r: number) => {
      ctx.beginPath(); ctx.moveTo(x - r * 2.4, y); ctx.lineTo(x, y - r * 0.3); ctx.lineTo(x + r * 2.4, y); ctx.lineTo(x, y + r * 0.3); ctx.closePath()
      ctx.moveTo(x, y - r * 2.4); ctx.lineTo(x + r * 0.3, y); ctx.lineTo(x, y + r * 2.4); ctx.lineTo(x - r * 0.3, y); ctx.closePath(); ctx.fill()
    }
    const frame = (now: number) => {
      const t = still ? 0 : now, ph = still ? 0.75 : (t % CYCLE) / CYCLE
      ctx.setTransform(d, 0, 0, d, (S * d) / 2, (S * d) / 2)
      ctx.clearRect(-S / 2, -S / 2, S, S)
      const ay = still ? 0.4 : t / 1500, ax = -0.16 + Math.sin(t / 2100) * 0.12
      const ca = Math.cos(ay), sa = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax), cam = S * 2.8
      const sweep = (t / 1100) % 3
      const q = ps.map(p => {
        const dl = p.dl * 0.3
        let v: V, grown = 0, spread = 0
        if (ph < 0.1) { v = p.sc; spread = 1 }
        else if (ph < 0.34) { const m = ease(clamp((ph - 0.1) / 0.24 - dl * 0.8)); v = mix(p.sc, p.pl, m); spread = 1 - m }
        else if (ph < 0.42) v = p.pl
        else if (ph < 0.68) { const delay = ((0.88 - p.tr[1]) / 1.6) * 0.45; grown = ease(clamp(((ph - 0.42) / 0.26 - delay) / 0.55)); v = mix(p.pl, p.tr, grown) }
        else if (ph < 0.82) { v = p.tr; grown = 1 }
        else if (ph < 0.96) { const m = ease(clamp((ph - 0.82) / 0.14 - dl * 0.8)); v = mix(p.tr, p.sc, m); grown = 1 - m; spread = m }
        else { v = p.sc; spread = 1 }
        const sw = Math.sin(t / 700 + p.tw) * 0.035 * spread
        const X = (v[0] + sw) * K, Y = (v[1] + Math.cos(t / 800 + p.tw) * 0.03 * spread) * K, Z = v[2] * K
        const x1 = X * ca + Z * sa, z1 = -X * sa + Z * ca, y2 = Y * cx - z1 * sx, z2 = Y * sx + z1 * cx
        return { p, x: x1, y: y2, z: z2, spread, grown }
      }).sort((a, b) => a.z - b.z)
      for (const { p, x: X, y: Y, z: Z, spread, grown } of q) {
        const f = cam / (cam - Z), x = X * f, y = Y * f, depth = clamp(0.5 + Z / (S * 0.9))
        const band = Math.max(0, 1 - Math.abs((X + Y) / S + 0.5 - sweep + 0.5) * 3.4)
        const hue = err ? 4 + (p.hue - 90) * 0.28 + band * 22 : p.hue + (p.hue2 - p.hue) * grown + Math.sin(t / 500 + p.tw + p.dl * 4) * 16 - band * 50
        const tw = 0.5 + 0.5 * Math.sin(t / 130 + p.tw * 3)
        const lig = Math.min(0.88, (p.lig + band * 0.3 + spread * 0.08 + grown * 0.04) * (0.62 + depth * 0.55))
        const al = Math.min(1, (0.55 + 0.35 * tw) * (0.5 + depth * 0.6))
        ctx.fillStyle = `hsla(${((hue % 360) + 360) % 360},${Math.round(p.sat * 100)}%,${Math.round(lig * 100)}%,${al.toFixed(2)})`
        const r = Math.max(0.5, S * 0.0078 * p.r) * f
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill()
        if (tw > 0.985) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `hsla(${((hue % 360) + 360) % 360},100%,78%,.9)`; star(x, y, r * 1.1); ctx.globalCompositeOperation = 'source-over' }
      }
      ctx.globalCompositeOperation = 'source-over'
      if (!still) raf = requestAnimationFrame(frame)
    }
    frame(0)
    if (!still) raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [size, state])
  return <span className={`ll ${state} ${inline ? 'inline' : ''}`} role={state === 'error' ? 'alert' : 'status'} aria-live="polite">
    <canvas ref={ref} className="ll-canvas" style={{ width: size, height: size }} aria-hidden="true"/>
    {text && <span className="ll-text">{text}</span>}
  </span>
}
