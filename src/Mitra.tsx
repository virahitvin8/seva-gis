import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { mitraDp } from './assets/brand'

type Step = {
  sel: string
  title: string
  body: string
  action?: () => void
  mode?: 'lite' | 'pro'
}

function scrollAndReveal(id: string | null, sel?: string) {
  window.dispatchEvent(new CustomEvent('seva-tour-reveal', { detail: id || sel || '*' }))
  const el = (id ? document.getElementById(id) : null) || (sel ? document.querySelector(sel) : null)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

const ALL_STEPS: Step[] = [
  // Lite / Mobile App Steps
  {
    mode: 'lite',
    sel: '[data-tour="lite-menu"]',
    title: 'Field Menu (Three Lines)',
    body: 'Open the three-line menu anytime to pick your farm, mark field boundaries with GPS, plan water or borewells, and create reports.',
    action: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
  },
  {
    mode: 'lite',
    sel: '[data-tour="lite-aoi-banner"]',
    title: 'Selected Field & Health Score',
    body: "See today's weather, overall plant vigor out of 100, and NAVI's plain-language tip for this exact area of interest.",
    action: () => scrollAndReveal(null, '[data-tour="lite-aoi-banner"]'),
  },
  {
    mode: 'lite',
    sel: '[data-tour="lite-map"]',
    title: 'Map & Layer Checkboxes',
    body: 'Switch tick boxes on or off for Plant Health, Water & Moisture, Land Cover, Soil, and Slope. Record walking GPS corners or pins live.',
    action: () => scrollAndReveal(null, '[data-tour="lite-map"]'),
  },
  {
    mode: 'lite',
    sel: '[data-tour="lite-metrics"]',
    title: 'Tap (i) to Check Data Sources',
    body: 'Every number shows its exact satellite capture date, formula, and open data source when you tap the (i) info button.',
    action: () => scrollAndReveal(null, '[data-tour="lite-metrics"]'),
  },
  {
    mode: 'lite',
    sel: '[data-tour="lite-report-btn"]',
    title: 'Simplified Field Report',
    body: 'Generate a clean visual summary with your area map, waypoints, time-lapse comparison, and share via Email, WhatsApp, or SMS.',
    action: () => scrollAndReveal(null, '[data-tour="lite-report-btn"]'),
  },
  {
    mode: 'lite',
    sel: '[data-tour="lite-signout"], .profile .logout, .profile',
    title: 'Language & Safe Sign Out',
    body: 'Switch between English, Hindi, or Telugu anytime, or sign out securely. Your fields remain stored privately on this device.',
    action: () => scrollAndReveal(null, '[data-tour="lite-signout"], .profile'),
  },

  // Pro / Full Website Steps
  {
    mode: 'pro',
    sel: '.sidebar nav, .topbar .breadcrumb',
    title: 'Your menu & workspace',
    body: 'Overview takes you to the top, My farms to your field boundaries, Crop journal to your seasonal logs, Alerts to stressed parcels, and Reports to printable dossiers.',
    action: () => { window.scrollTo({ top: 0, behavior: 'smooth' }) },
  },
  {
    mode: 'pro',
    sel: '.page-heading .primary, .page-heading button',
    title: 'Add a field boundary',
    body: 'Draw an area of interest on the satellite basemap, walk its boundary with mobile GPS, enter coordinates, or upload GeoJSON, KML, GPX, WKT, or ESRI Shapefiles.',
    action: () => { window.scrollTo({ top: 0, behavior: 'smooth' }) },
  },
  {
    mode: 'pro',
    sel: '.map-card',
    title: 'The live map & field GPS',
    body: 'Explore 10 m Sentinel-2 imagery with Handy GPS pins, boundary walking tools, layer ticks, and precision distance measurement.',
    action: () => scrollAndReveal(null, '.map-card'),
  },
  {
    mode: 'pro',
    sel: '.intelligence-grid',
    title: 'Field intelligence & spectral metrics',
    body: 'Live Sentinel-2 BOA metrics: plant vigor score, moisture status, rainfall outlook, and Copernicus DEM surface slope.',
    action: () => scrollAndReveal(null, '.intelligence-grid'),
  },
  {
    mode: 'pro',
    sel: '#section-agro-water',
    title: 'Agro & water planning panels',
    body: 'Water volume needed, daily crop demand, soil texture, drainage flow, borewells, and pipeline layout for the selected field.',
    action: () => scrollAndReveal('section-agro-water'),
  },
  {
    mode: 'pro',
    sel: '#section-intelligence-lab',
    title: 'Analysis lab',
    body: 'Inspect true-colour imagery, land cover, spectral indices, seasonal change, and map-based explanations for the selected area.',
    action: () => {
      window.dispatchEvent(new CustomEvent('seva-set-lab-tab', { detail: 'map' }))
      scrollAndReveal('section-intelligence-lab')
    },
  },
  {
    mode: 'pro',
    sel: '.ge-wrap, #section-intelligence-lab',
    title: 'GeoAI studio',
    body: 'Explore land-cover grouping, management zones, spectral patterns, and GeoAI-assisted interpretation for the selected area.',
    action: () => {
      window.dispatchEvent(new CustomEvent('seva-set-lab-tab', { detail: 'ai' }))
      scrollAndReveal('section-intelligence-lab', '.ge-wrap')
    },
  },
  {
    mode: 'pro',
    sel: '#section-measurement-tools',
    title: 'Precision tools',
    body: 'Use measurement, buffers, layer tools, and field SMS/WhatsApp/Email dispatch for the selected area.',
    action: () => scrollAndReveal('section-measurement-tools'),
  },
  {
    mode: 'pro',
    sel: '#create-report-button',
    title: 'Field reports & sharing',
    body: 'Generate reports in English, Hindi, or Telugu with waypoints, parameter maps, time-lapse comparisons, and direct mail or WhatsApp sharing.',
    action: () => scrollAndReveal('create-report-button', '.intelligence-heading button'),
  },
  {
    mode: 'pro',
    sel: '.profile .logout, .profile',
    title: 'Privacy & signing out',
    body: 'Sign out securely whenever you are done. Your farm boundaries and local settings stay safely saved on this device.',
    action: () => scrollAndReveal(null, '.profile .logout, .profile'),
  },
]

function resolveActiveSteps(): Step[] {
  if (typeof document !== 'undefined' && document.getElementById('lite-shell-root')) {
    return ALL_STEPS.filter(s => s.mode === 'lite')
  }
  return ALL_STEPS.filter(s => s.mode === 'pro')
}

type Rect = { x: number; y: number; w: number; h: number }

function useTarget(step: Step | undefined, stepIdx: number) {
  const sel = step?.sel ?? null
  const [rect, setRect] = useState<Rect | null>(null)

  const measure = useCallback(() => {
    if (!sel) return setRect(null)
    const selectors = sel.split(',').map(s => s.trim())
    let el: HTMLElement | null = null
    for (const s of selectors) {
      const found = document.querySelector<HTMLElement>(s)
      if (found && found.offsetWidth > 0 && found.offsetHeight > 0) {
        el = found
        break
      }
    }
    if (!el) return setRect(null)
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return setRect(null)
    setRect({ x: r.left, y: r.top, w: r.width, h: r.height })
  }, [sel])

  useLayoutEffect(() => {
    if (!sel || !step) return
    if (step.action) step.action()

    measure()
    const timers = [60, 180, 380, 680].map(ms => setTimeout(measure, ms))

    const onScrollOrResize = () => measure()
    window.addEventListener('resize', onScrollOrResize, { passive: true })
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true })

    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [sel, step, stepIdx, measure])

  return rect
}

export function MitraAvatar({ size = 38 }: { size?: number }) {
  return <span className="mi-av" style={{ width: size, height: size }} aria-hidden="true"><img src={mitraDp} alt="" width={size} height={size} draggable={false} /></span>
}

function Tour({ onClose }: { onClose: () => void }) {
  const [steps] = useState<Step[]>(resolveActiveSteps)
  const [i, setI] = useState(0)
  const step = steps[i] || steps[0]
  const rect = useTarget(step, i)

  const finishAndPersist = useCallback(() => {
    try {
      localStorage.setItem('seva-mitra-choice', 'done')
      sessionStorage.setItem('seva-mitra-choice', 'done')
    } catch {}
    onClose()
  }, [onClose])

  const next = useCallback(() => {
    if (i >= steps.length - 1) {
      finishAndPersist()
    } else {
      setI(v => v + 1)
    }
  }, [i, steps.length, finishAndPersist])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishAndPersist()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') setI(v => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [finishAndPersist, next])

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

  const handleSkipAll = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    finishAndPersist()
  }

  const handleSkipStep = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    next()
  }

  return <div className="mi-tour" role="dialog" aria-label="SEVA.GIS quick tour">
    {rect ? <div className="mi-spot" style={{ left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2 }} /> : <div className="mi-dim" />}
    <div className="mi-pop" ref={pop} style={{ left, top, width: W }}>
      <header><MitraAvatar size={30} /><b>NAVI</b><span>{i + 1} of {steps.length}</span><button type="button" aria-label="Close tour" onClick={handleSkipAll}><X size={15} /></button></header>
      <h4>{step.title}</h4><p>{step.body}</p>
      <div className="mi-dots">{steps.map((_, k) => <button type="button" key={k} aria-label={`Step ${k + 1}`} className={k === i ? 'on' : ''} onClick={() => setI(k)} />)}</div>
      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          className="mi-ghost"
          style={{ background: '#f1f5f9', border: '1.5px solid #cbd5e1', color: '#334155', fontWeight: 700, padding: '7px 12px', borderRadius: 8 }}
          onClick={handleSkipAll}
        >
          Skip all
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="mi-ghost"
            style={{ padding: '7px 10px', borderRadius: 8 }}
            onClick={handleSkipStep}
          >
            Skip step
          </button>
          <button
            type="button"
            className="mi-ghost"
            disabled={i === 0}
            onClick={() => setI(i - 1)}
            aria-label="Back"
            style={{ padding: '7px 8px', borderRadius: 8 }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="mi-go"
            onClick={next}
            style={{ background: '#10b981', borderColor: '#10b981', color: '#fff', fontWeight: 700, padding: '7px 14px', borderRadius: 8 }}
          >
            {i === steps.length - 1 ? 'Finish' : 'Next'}
            <ChevronRight size={15} />
          </button>
        </div>
      </footer>
    </div>
  </div>
}

export function MitraGuide({ name, guest }: { name: string; guest: boolean }) {
  const [state, setState] = useState<'ask' | 'tour' | 'off'>(() => {
    try {
      const choice = localStorage.getItem('seva-mitra-choice') || sessionStorage.getItem('seva-mitra-choice')
      if (choice === 'done') return 'off'
    } catch {}
    return 'ask'
  })

  const handleSkip = () => {
    try {
      localStorage.setItem('seva-mitra-choice', 'done')
      sessionStorage.setItem('seva-mitra-choice', 'done')
    } catch {}
    setState('off')
  }

  const handleTour = () => {
    try {
      localStorage.setItem('seva-mitra-choice', 'done')
      sessionStorage.setItem('seva-mitra-choice', 'done')
    } catch {}
    setState('tour')
  }

  const handleCloseTour = () => {
    try {
      localStorage.setItem('seva-mitra-choice', 'done')
      sessionStorage.setItem('seva-mitra-choice', 'done')
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setState('off')
  }

  useEffect(() => {
    const open = () => setState('tour')
    addEventListener('seva-tour', open)
    return () => removeEventListener('seva-tour', open)
  }, [])

  if (state === 'tour') return <Tour onClose={handleCloseTour} />
  const who = guest ? 'there' : name.split(' ')[0]
  return <>
    {state === 'ask' && (
      <div className="mi-ask-backdrop" role="dialog" aria-modal="true" aria-label="NAVI Quick Tour">
        <aside className="mi-ask-card">
          <div className="mi-ask-avatar-wrap">
            <MitraAvatar size={52} />
            <span className="mi-ask-badge">NAVI Agritech Assistant</span>
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
                Continue Quick Tour with NAVI →
              </button>
              <button className="mi-ask-btn-skip" onClick={handleSkip}>
                Skip all · Explore on my own
              </button>
            </div>
            <small className="mi-ask-footnote">Your choice is remembered. You can reopen NAVI anytime from the bottom menu beside Sign out.</small>
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
  return <div className="mi-bye" role="status"><MitraAvatar size={30} /><div><b>NAVI:</b><p>Happy mapping! Come back anytime. 🌍</p></div></div>
}
