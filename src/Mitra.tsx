import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { mitraDp } from './assets/brand'

type Step = {
  sel: string
  title: string
  body: string
  action?: () => void
}

const STEPS: Step[] = [
  {
    sel: '.sidebar nav, .topbar .breadcrumb',
    title: 'Your menu & workspace',
    body: 'Overview takes you to the top, My farms to your farm list, Crop journal to your notes, Alerts to farms that need care, and Reports to your printable dossier.',
    action: () => { window.scrollTo({ top: 0, behavior: 'smooth' }) }
  },
  {
    sel: '.page-heading .primary, .page-heading button',
    title: 'Add a farm',
    body: 'Start here. Draw your farm boundary directly on the map, walk the perimeter with GPS, type coordinates, or upload GeoJSON, KML, GPX, WKT, or Shapefiles.',
    action: () => { window.scrollTo({ top: 0, behavior: 'smooth' }) }
  },
  {
    sel: '.map-card',
    title: 'The live map',
    body: 'Use Parameters to toggle between NDVI crop vigour, moisture and terrain, Base map for satellite or topo, and Whole map / Farm only to clip to your exact boundary.',
    action: () => {
      document.querySelector('.map-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
  {
    sel: '.intelligence-grid',
    title: 'NDVI indices with scales',
    body: 'Every number comes directly from the newest clear Sentinel-2 pass with a color-coded scale under it, so you can evaluate crop vigour and soil moisture at a glance.',
    action: () => {
      document.querySelector('.intelligence-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
  {
    sel: '.ge-wrap',
    title: 'Analysis lab',
    body: 'Explore Earth Engine-style analytics: true-colour reflectance, vegetation maps, seasonal NDVI change detection, and pest/disease weather vulnerability models.',
    action: () => {
      window.dispatchEvent(new CustomEvent('seva-set-lab-tab', { detail: 'map' }))
      document.querySelector('.ge-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
  {
    sel: '.ge-wrap',
    title: 'GeoAI studio',
    body: 'The in-browser GeoAI studio runs k-means++ spectral clustering and supervised classification directly on your device. It automatically groups your field into crop vigor zones.',
    action: () => {
      window.dispatchEvent(new CustomEvent('seva-set-lab-tab', { detail: 'ai' }))
      document.querySelector('.ge-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
  {
    sel: '.gt-wrap',
    title: 'Geo tools & robotics',
    body: 'Field calculation suite: machinery swath planner (Fields2Cover CPP), rural reachability isochrones (openrouteservice), variable-rate fertilizer (VRA), and geodesic calculators.',
    action: () => {
      document.querySelector('.gt-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
  {
    sel: '.intelligence-heading button',
    title: 'Branded farm reports',
    body: 'Generate a print-ready PDF or standalone HTML dossier with North arrow, scale bar, Sentinel-2 metadata, and agronomic index scorecards in one click.',
    action: () => {
      document.querySelector('.intelligence-heading button')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
  {
    sel: '.sidebar .logout, .nav-logout, .profile .logout',
    title: 'Signing out',
    body: 'Sign out securely whenever you are done. Your farm boundaries and local settings stay safely saved on this device.',
    action: () => {
      const el = document.querySelector('.sidebar .logout, .nav-logout, .profile .logout')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
]

type Rect = { x: number; y: number; w: number; h: number }

function useTarget(sel: string | null, stepIdx: number) {
  const [rect, setRect] = useState<Rect | null>(null)

  const measure = useCallback(() => {
    if (!sel) return setRect(null)
    const selectors = sel.split(',').map(s => s.trim())
    let el: HTMLElement | null = null
    for (const s of selectors) {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(s))
      const found = candidates.find(e => {
        const cs = getComputedStyle(e)
        return (e.offsetParent !== null || cs.position === 'fixed') && cs.display !== 'none' && cs.visibility !== 'hidden'
      })
      if (found) { el = found; break }
    }
    if (!el) return setRect(null)
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return setRect(null)
    setRect({ x: r.left, y: r.top, w: r.width, h: r.height })
  }, [sel])

  useLayoutEffect(() => {
    if (!sel) return
    const step = STEPS[stepIdx]
    if (step?.action) step.action()

    // Smoothly track element through scrolling and animations
    let frameId: number
    let lastM = 0
    const start = performance.now()
    const track = (now: number) => {
      if (now - lastM >= 33) {
        lastM = now
        measure()
      }
      if (now - start < 1200) {
        frameId = requestAnimationFrame(track)
      }
    }
    frameId = requestAnimationFrame(track)

    const onScrollOrResize = () => measure()
    window.addEventListener('resize', onScrollOrResize, { passive: true })
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true })

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [sel, stepIdx, measure])

  return rect
}

export function MitraAvatar({ size = 38 }: { size?: number }) {
  return <span className="mi-av" style={{ width: size, height: size }} aria-hidden="true"><img src={mitraDp} alt="" width={size} height={size} draggable={false} /></span>
}

function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const step = STEPS[i]
  const rect = useTarget(step.sel, i)

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') setI(v => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const next = () => (i >= STEPS.length - 1 ? onClose() : setI(i + 1))
  const pop = useRef<HTMLDivElement>(null)
  const [ph, setPh] = useState(220)

  useLayoutEffect(() => {
    if (pop.current) setPh(pop.current.offsetHeight)
  }, [i, rect])

  const pad = 10
  const W = Math.min(360, innerWidth - 28)
  let left = innerWidth / 2 - W / 2
  let top = innerHeight / 2 - 110

  if (rect) {
    const isSidebar = rect.x < 340 && (rect.x + rect.w) < 420
    if (isSidebar && rect.x + rect.w + pad + 16 + W < innerWidth) {
      left = rect.x + rect.w + pad + 16
      top = Math.max(14, Math.min(innerHeight - ph - 14, rect.y + 10))
    } else {
      left = Math.min(Math.max(14, rect.x + rect.w / 2 - W / 2), innerWidth - W - 14)
      const below = rect.y + rect.h + pad + 14
      const above = rect.y - pad - 14 - ph
      if (below + ph < innerHeight - 14) {
        top = below
      } else if (above > 14) {
        top = above
      } else {
        top = Math.max(14, Math.min(innerHeight - ph - 14, rect.y + rect.h - ph - 14))
      }
    }
  }

  return <div className="mi-tour" role="dialog" aria-label="SEVA.GIS quick tour">
    {rect ? <div className="mi-spot" style={{ left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2 }} /> : <div className="mi-dim" />}
    <div className="mi-pop" ref={pop} style={{ left, top, width: W }}>
      <header><MitraAvatar size={30} /><b>Mitra</b><span>{i + 1} of {STEPS.length}</span><button aria-label="Close tour" onClick={onClose}><X size={15} /></button></header>
      <h4>{step.title}</h4><p>{step.body}</p>
      <div className="mi-dots">{STEPS.map((_, k) => <button key={k} aria-label={`Step ${k + 1}`} className={k === i ? 'on' : ''} onClick={() => setI(k)} />)}</div>
      <footer>
        <button className="mi-ghost" onClick={onClose}>Skip all</button>
        <button className="mi-ghost" onClick={next}>Skip this step</button>
        <span />
        <button className="mi-ghost" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Back"><ChevronLeft size={16} /></button>
        <button className="mi-go" onClick={next}>{i === STEPS.length - 1 ? 'Finish' : 'Next'}<ChevronRight size={15} /></button>
      </footer>
    </div>
  </div>
}

export function MitraGuide({ name, guest }: { name: string; guest: boolean }) {
  const [state, setState] = useState<'ask' | 'tour' | 'off'>(() => (sessionStorage.getItem('seva-mitra-asked') ? 'off' : 'ask'))
  useEffect(() => { sessionStorage.setItem('seva-mitra-asked', '1') }, [])
  useEffect(() => {
    const open = () => setState('tour')
    addEventListener('seva-tour', open)
    return () => removeEventListener('seva-tour', open)
  }, [])
  if (state === 'tour') return <Tour onClose={() => { scrollTo({ top: 0, behavior: 'smooth' }); setState('off') }} />
  const who = guest ? 'there' : name.split(' ')[0]
  return <>
    {state === 'ask' && <aside className="mi-ask" role="dialog" aria-label="Mitra">
      <MitraAvatar size={30} />
      <div>
        <b>Mitra</b>
        <p>Hi {who}, I'm Mitra. Not sure where to begin? I can give you a quick tour of SEVA.GIS.</p>
        <div className="mi-row"><button className="mi-go" onClick={() => setState('tour')}>Show me around</button><button className="mi-ghost" onClick={() => setState('off')}>Skip</button></div>
      </div>
    </aside>}
  </>
}

export function MitraBye() {
  const [show, setShow] = useState(true)
  useEffect(() => { const t = setTimeout(() => { setShow(false); sessionStorage.removeItem('seva-bye') }, 5000); return () => clearTimeout(t) }, [])
  if (!show) return null
  return <div className="mi-bye" role="status"><MitraAvatar size={30} /><div><b>Mitra:</b><p>Happy mapping! Come back anytime. 🌍</p></div></div>
}
