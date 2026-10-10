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
    body: 'Overview takes you to the top, My farms to your field boundaries, Crop journal to your seasonal logs, Alerts to stressed parcels, and Reports to printable dossiers.',
    action: () => { window.scrollTo({ top: 0, behavior: 'smooth' }) }
  },
  {
    sel: '.page-heading .primary, .page-heading button',
    title: 'Add a farm boundary',
    body: 'Draw your cadastral parcel on the satellite basemap, walk the perimeter with mobile GPS, enter coordinates, or upload GeoJSON, KML, GPX, WKT, or ESRI Shapefiles.',
    action: () => { window.scrollTo({ top: 0, behavior: 'smooth' }) }
  },
  {
    sel: '.map-card',
    title: 'The live map & metered tape ruler',
    body: 'Explore high-resolution satellite imagery with dynamic parameters (NDVI, NDMI, DEM). Use the movable Metered Tape Ruler to measure precision distances and elevation slopes anywhere on the field.',
    action: () => {
      document.querySelector('.map-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
  {
    sel: '.intelligence-grid',
    title: '14 Agro & hydrological indices',
    body: 'Calculated directly from Sentinel-2 L2A BOA surface reflectance: NDVI, EVI, SAVI, MSAVI, GNDVI, NDRE, CIre, NBR, NDWI, MNDWI, NDMI, and MSI with calibrated color-coded benchmarks.',
    action: () => {
      document.querySelector('.intelligence-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
  {
    sel: '.ge-wrap',
    title: 'Analysis lab & movable legends',
    body: 'True-colour reflectance, multi-index land cover, seasonal change detection, and pest vulnerability models. Every classified map features an adjustable Floating Legend shortcut you can drag anywhere.',
    action: () => {
      window.dispatchEvent(new CustomEvent('seva-set-lab-tab', { detail: 'map' }))
      document.querySelector('.ge-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
  {
    sel: '.ge-wrap',
    title: 'GeoAI studio & band symbology',
    body: 'Unsupervised K-Means++ spectral clustering, supervised land classification, harvest yield forecasting, and 5 multispectral band combinations (Natural, False Colour NIR, Agriculture, SWIR Moisture).',
    action: () => {
      window.dispatchEvent(new CustomEvent('seva-set-lab-tab', { detail: 'ai' }))
      document.querySelector('.ge-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
  {
    sel: '.gt-wrap',
    title: 'Swath robotics & variable-rate (VRA)',
    body: 'Agricultural robotics suite: Fields2Cover machinery coverage path planning (CPP), turning radius loops, rural reachability isochrones (openrouteservice), and zone-specific fertilizer prescriptions.',
    action: () => {
      document.querySelector('.gt-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
  {
    sel: '.intelligence-heading button',
    title: 'Trilingual dossiers (EN / HI / TE)',
    body: 'Generate official field dossiers in English, Hindi (हिन्दी), or Telugu (తెలుగు) with North arrow, scale bar, Sentinel-2 metadata, and VRA recommendations in print-ready PDF and HTML.',
    action: () => {
      document.querySelector('.intelligence-heading button')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  },
  {
    sel: '.sidebar .logout, .nav-logout, .profile .logout',
    title: 'Privacy & signing out',
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
  // Use localStorage so choice persists across sessions (not just current tab)
  const [state, setState] = useState<'ask' | 'tour' | 'off'>(() => {
    const choice = localStorage.getItem('seva-mitra-choice')
    if (choice === 'done') return 'off'
    return 'ask'
  })

  const handleSkip = () => {
    localStorage.setItem('seva-mitra-choice', 'done')
    setState('off')
  }

  const handleTour = () => {
    localStorage.setItem('seva-mitra-choice', 'done')
    setState('tour')
  }

  useEffect(() => {
    const open = () => setState('tour')
    addEventListener('seva-tour', open)
    return () => removeEventListener('seva-tour', open)
  }, [])

  if (state === 'tour') return <Tour onClose={() => { scrollTo({ top: 0, behavior: 'smooth' }); setState('off') }} />
  const who = guest ? 'there' : name.split(' ')[0]
  return <>
    {state === 'ask' && (
      <div className="mi-ask-backdrop" role="dialog" aria-modal="true" aria-label="Mitra Quick Tour">
        <aside className="mi-ask-card">
          <div className="mi-ask-avatar-wrap">
            <MitraAvatar size={52} />
            <span className="mi-ask-badge">Mitra Agritech Assistant</span>
          </div>
          <div className="mi-ask-content">
            <h3>Welcome to SEVA·GIS, {who}!</h3>
            <p>
              Your open-access precision agriculture &amp; satellite GIS portal is ready. Would you like a 60-second interactive tour of your farm tools, 10m Sentinel-2 layers, and crop analytics?
            </p>
            <div className="mi-ask-chips">
              <span>🛰️ Sentinel-2 10m</span>
              <span>🌱 14 Spectral Indices</span>
              <span>🚜 Swath Robotics</span>
            </div>
            <div className="mi-ask-row">
              <button className="mi-ask-btn-continue" onClick={handleTour}>
                Continue Quick Tour →
              </button>
              <button className="mi-ask-btn-skip" onClick={handleSkip}>
                Skip &amp; Remember Choice
              </button>
            </div>
            <small className="mi-ask-footnote">Your choice is remembered. You can reopen Mitra anytime from the top bar.</small>
          </div>
        </aside>
      </div>
    )}
  </>
}

export function MitraBye() {
  const [show, setShow] = useState(true)
  useEffect(() => { const t = setTimeout(() => { setShow(false); sessionStorage.removeItem('seva-bye') }, 5000); return () => clearTimeout(t) }, [])
  if (!show) return null
  return <div className="mi-bye" role="status"><MitraAvatar size={30} /><div><b>Mitra:</b><p>Happy mapping! Come back anytime. 🌍</p></div></div>
}
