import LogoLoader from './LogoLoader'
import Aurora from './Aurora'
import { MitraBye } from './Mitra'
import { clearGreeting } from './lib/greet'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  LogIn,
  UserPlus,
  User as UserIcon,
  ExternalLink,
  BookOpen,
  HelpCircle,
  Sprout,
  ShieldCheck,
  Layers,
  Sparkles,
  Star
} from 'lucide-react'
import MethodologyModal from './MethodologyModal'
import Lang from './Lang'
import { GUEST, closeWorkspace, db, login, openWorkspace, register, sessionId, setSession } from './lib/db'

import Wordmark from './Wordmark'
import { logoMark as logo } from './assets/brand'

const REMEMBER = 'seva-remembered'
type Known = { name: string; email: string }
const known = (): Known[] => { try { return JSON.parse(localStorage.getItem(REMEMBER) || '[]') } catch { return [] } }
const remember = (k: Known) => localStorage.setItem(REMEMBER, JSON.stringify([k, ...known().filter(x => x.email !== k.email)].slice(0, 4)))
const forget = (email: string) => localStorage.setItem(REMEMBER, JSON.stringify(known().filter(x => x.email !== email)))

type Who = { id: string; name: string; email: string }
const Ctx = createContext<{ who: Who; signOut: () => void }>({ who: { id: GUEST, name: 'Guest', email: '' }, signOut: () => {} })
export const useAccount = () => useContext(Ctx)

export default function AuthGate({ children }: { children: ReactNode }) {
  const [who, setWho] = useState<Who | null>(null)
  const [booting, setBooting] = useState(true)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [guestAsk, setGuestAsk] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<Known[]>(known)
  const [guideModalOpen, setGuideModalOpen] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const pw = useRef<HTMLInputElement>(null)

  async function enter(w: Who) {
    sessionStorage.removeItem('seva-bye')
    await openWorkspace(w.id, { name: w.name, email: w.email })
    if (rememberMe) {
      setSession(w.id)
      localStorage.setItem('seva-remember-me', 'true')
    }
    setWho(w)
  }

  const enterGuest = async (customName?: string) => {
    const chosen = (customName !== undefined ? customName.trim() : guestName.trim()) || 'Guest'
    localStorage.setItem('seva-guest-name', chosen)
    await enter({ id: GUEST, name: chosen, email: '' })
  }

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search)
      if (params.has('auth') || params.has('login') || params.has('signin')) {
        setBooting(false)
        return
      }
      const id = sessionId()
      if (id === GUEST) {
        const savedGuestName = localStorage.getItem('seva-guest-name') || 'Guest'
        await enter({ id: GUEST, name: savedGuestName, email: '' })
      } else if (id) {
        const u = await db.users.get(id)
        if (u) await enter({ id: u.id, name: u.name, email: u.email })
      }
      setBooting(false)
    })().catch(() => setBooting(false))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      if (mode === 'up' && form.password.length < 8) throw new Error('Use a password with at least 8 characters.')
      const u = mode === 'up' ? await register(form.name || form.email.split('@')[0], form.email, form.password) : await login(form.email, form.password)
      remember({ name: u.name, email: u.email }); setSaved(known())
      await enter({ id: u.id, name: u.name, email: u.email })
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.') }
    setBusy(false)
  }
  const signOut = () => {
    sessionStorage.setItem('seva-bye', '1')
    // Reset mitra choice so new session gets the welcome tour popup
    localStorage.removeItem('seva-mitra-choice')
    localStorage.removeItem('seva-guest-name')
    localStorage.removeItem('seva-remember-me')
    clearGreeting()
    closeWorkspace()
    setSession(null)
    setWho(null)
    setForm({ name: '', email: '', password: '' })
  }

  if (booting) return (
    <div className="ll-full">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: 92, height: 92, display: 'grid', placeItems: 'center' }}>
          <img
            src={logo}
            alt="SEVA·GIS"
            style={{ width: 80, height: 80, objectFit: 'contain', filter: 'drop-shadow(0 0 16px rgba(56,242,208,0.65))', zIndex: 1 }}
            onError={(e) => { e.currentTarget.src = '/logo.png' }}
          />
        </div>
        <LogoLoader inline size={32} text="Opening SEVA.GIS…" />
      </div>
    </div>
  )
  if (who) return <Ctx.Provider value={{ who, signOut }}>{children}</Ctx.Provider>

  return <div className="au-wrap">
    <div style={{ position: 'absolute', top: 16, right: 20, zIndex: 100 }}>
      <Lang />
    </div>
    {sessionStorage.getItem('seva-bye') && <MitraBye/>}
    <div className="au-main-split">
      <section className="au-hero">
        <Aurora/>
        <div className="au-hero-copy">
          <div className="au-logo"><img src={logo} alt="SEVA·GIS logo" onError={(e) => { e.currentTarget.src = '/logo.png' }}/><Wordmark/></div>
          <h2 className="au-full notranslate" translate="no" aria-label="Spatial Evaluation & Vegetation Analytics">{['Spatial', 'Evaluation', '&', 'Vegetation', 'Analytics'].map((w, wi) => <span className="au-w" key={w}>{[...w].map((ch, ci) => <b key={ci} className={ci === 0 && w !== '&' ? 'cap' : ''} style={{ animationDelay: `${(wi * 6 + ci) * 45}ms` }}>{ch}</b>)}</span>)}</h2>
          <p className="au-cherish">Every field you walk and every season you wait matters. We are glad you are here. Your land deserves to be seen, and you deserve to see it grow.</p>
          <ul className="au-stats"><li><i className="fa-solid fa-satellite"/><b>10 m</b><span>satellite detail</span></li><li><i className="fa-solid fa-cloud-sun-rain"/><b>Live</b><span>weather and soil</span></li><li><i className="fa-solid fa-hand-holding-heart"/><b>$0</b><span>no keys, no fees</span></li></ul>

          <div className="au-flow" aria-label="How SEVA.GIS works: satellite, bands, indices, advice">
            {[['fa-satellite-dish', 'Satellite', 'Sentinel-2'], ['fa-layer-group', 'Bands', 'Red, NIR, SWIR'], ['fa-seedling', 'Crop health', 'NDVI, NDMI'], ['fa-lightbulb', 'Advice', 'with a reason']].map(([ic, t, s], i) => <div className="au-node" key={t} style={{ animationDelay: `${i * 0.5}s` }}><i className={`fa-solid ${ic}`}/><b>{t}</b><span>{s}</span></div>)}
          </div>
        </div>
      </section>

      <form className="au-card" onSubmit={submit}>
        <h1>{mode === 'in' ? 'Welcome back' : 'Start for free'}</h1>
        <p>{mode === 'in' ? 'SEVA.GIS helps you see your farms, every day.' : 'Free setup. Save your farm boundaries and satellite records on this device.'}</p>
        {mode === 'in' && saved.length > 0 && <div className="au-known"><span>Welcome back, tap your name</span>{saved.map(k => <div className="au-chip" key={k.email}><button type="button" onClick={() => { setForm({ ...form, email: k.email, password: '' }); setTimeout(() => pw.current?.focus(), 30) }}><b>{(k.name || k.email)[0].toUpperCase()}</b><span>{k.name}<small>{k.email}</small></span></button><button type="button" aria-label={`Forget ${k.name}`} onClick={() => { forget(k.email); setSaved(known()) }}>×</button></div>)}</div>}
        <div className="au-tabs"><button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Sign in</button><button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>Create account</button></div>
        {mode === 'up' && <label>Your name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name" placeholder="Your name"/></label>}
        <label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" placeholder="you@example.com"/></label>
        <label>Password<input ref={pw} required type="password" minLength={mode === 'up' ? 8 : 1} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} placeholder={mode === 'up' ? 'At least 8 characters' : ''}/></label>
        <label className="au-remember-box" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 12px', fontSize: 12.5, color: '#e2e8f0', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#10b981', cursor: 'pointer' }}
          />
          <span>Remember me on this device (direct portal access on next visit)</span>
        </label>
        {error && <div className="au-err" role="alert">{error}</div>}
        <button className="au-go" disabled={busy}>{busy ? <LogoLoader inline size={18} text="Please wait…" /> : mode === 'in' ? <><LogIn size={16}/>Sign in</> : <><UserPlus size={16}/>Create free account</>}</button>
        <div className="au-or"><span>or</span></div>
        <button type="button" className="au-guest" onClick={() => enterGuest()}><UserIcon size={15}/>Continue as Guest · Instant access</button>
        <small style={{ display: 'block', textAlign: 'center', marginTop: 6, fontSize: 11, color: '#34d399', fontWeight: 600 }}>✓ Auto-remember active: Only log in once. Direct access to SEVA·GIS on every visit.</small>
        <small>Your account is saved on this device. Passwords are hashed locally and never transmitted. Back up or restore anytime from Data manager.</small>

        {/* Quick Documentation Links in Sign-in Card */}
        <div className="au-card-links">
          <a
            href="https://github.com/virahitvin8/seva-gis"
            target="_blank"
            rel="noreferrer"
            className="au-card-link-item"
            title="Open GitHub repository"
          >
            <Star size={12} style={{ color: '#b6f36a' }} />
            <span>GitHub</span>
          </a>
          <button
            type="button"
            onClick={() => setGuideModalOpen(true)}
            className="au-card-link-item"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', cursor: 'pointer' }}
            title="How SEVA.GIS works (Scientific Thesis & Methodology)"
          >
            <BookOpen size={12} />
            <span>How it works</span>
          </button>
          <a href="/faq.html" className="au-card-link-item" title="Frequently asked questions">
            <HelpCircle size={12} />
            <span>FAQ</span>
          </a>
          <a href="/ndvi-explained.html" className="au-card-link-item" title="NDVI Explained guide">
            <Sprout size={12} />
            <span>NDVI</span>
          </a>
        </div>
      </form>
    </div>

    {/* Full-width Knowledge Hub & Documentation Showcase below the fold */}
    <section className="au-hub" aria-label="Knowledge Hub and Documentation">
      <div className="au-hub-header">
        <span className="au-hub-tag">
          <ShieldCheck size={13} />
          Open Data &amp; Knowledge Base
        </span>
        <h2 className="au-hub-title">Everything you need to know about SEVA·GIS</h2>
        <p className="au-hub-desc">
          Transparent geospatial algorithms, open satellite pipelines, and clear agronomic guides. Zero tracking, zero hidden fees, and completely open source.
        </p>
      </div>

      <div className="au-hub-grid">
        {/* Card 1: Git Repository */}
        <div className="au-hub-card">
          <div>
            <div className="au-hub-card-head">
              <div className="au-hub-card-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/>
                </svg>
              </div>
              <span className="au-hub-card-badge">MIT License</span>
            </div>
            <h3>Open Source Codebase</h3>
            <p>
              Inspect the source code, run locally with Vite + React 19, or contribute improvements. Built entirely client-side with no central backend database.
            </p>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 12, color: '#b4c8b9', lineHeight: 1.6 }}>
              <li>100% open-source under permissive MIT license</li>
              <li>Zero backend tracking or central telemetry</li>
              <li>Inspect and audit satellite processing algorithms</li>
            </ul>
          </div>
          <div className="au-hub-card-foot">
            <span style={{ fontSize: 11, color: '#9fb5a5' }}>virahitvin8 / seva-gis</span>
            <a
              href="https://github.com/virahitvin8/seva-gis"
              target="_blank"
              rel="noreferrer"
              className="au-hub-card-btn"
            >
              <span>GitHub Repo</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Card 2: How It Works */}
        <div className="au-hub-card">
          <div>
            <div className="au-hub-card-head">
              <div className="au-hub-card-icon">
                <BookOpen size={22} />
              </div>
              <span className="au-hub-card-badge">Methodology</span>
            </div>
            <h3>How It Works Guide</h3>
            <p>
              Discover how SEVA.GIS queries Copernicus Sentinel-2 L2A tiles via Planetary Computer, removes cloud shadows, computes vegetation indices, and models yields.
            </p>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 12, color: '#b4c8b9', lineHeight: 1.6 }}>
              <li>Step-by-step farm boundary capture</li>
              <li>Sentinel-2 band math and 10 m raster grids</li>
              <li>Tractor swath routing &amp; VRA fertilizer zones</li>
            </ul>
          </div>
          <div className="au-hub-card-foot">
            <span style={{ fontSize: 11, color: '#9fb5a5' }}>Scientific Thesis</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => setGuideModalOpen(true)}
                className="au-hub-card-btn"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title="Open interactive research methodology & flowchart"
              >
                <span>Read Guide</span>
                <Sparkles size={13} />
              </button>
              <a
                href="/how-it-works.html"
                target="_blank"
                rel="noreferrer"
                title="Open full web guide in new tab"
                style={{ color: '#9fb5a5', display: 'grid', placeItems: 'center', textDecoration: 'none' }}
              >
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>

        {/* Card 3: FAQ */}
        <div className="au-hub-card">
          <div>
            <div className="au-hub-card-head">
              <div className="au-hub-card-icon">
                <HelpCircle size={22} />
              </div>
              <span className="au-hub-card-badge">Questions</span>
            </div>
            <h3>Frequently Asked Questions</h3>
            <p>
              Common answers regarding satellite pass frequencies, 10-metre pixel resolution, cloud cover handling, local storage safety, and offline mobile PWA setup.
            </p>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 12, color: '#b4c8b9', lineHeight: 1.6 }}>
              <li>Why is it free forever with no API key?</li>
              <li>How your data remains on your device</li>
              <li>Multi-language support (English, Hindi, Telugu)</li>
            </ul>
          </div>
          <div className="au-hub-card-foot">
            <span style={{ fontSize: 11, color: '#9fb5a5' }}>9 Answered Questions</span>
            <a href="/faq.html" className="au-hub-card-btn">
              <span>View FAQs</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Card 4: NDVI Explained */}
        <div className="au-hub-card">
          <div>
            <div className="au-hub-card-head">
              <div className="au-hub-card-icon">
                <Sprout size={22} />
              </div>
              <span className="au-hub-card-badge">Agronomy</span>
            </div>
            <h3>NDVI Explained</h3>
            <p>
              Learn how plants absorb red light and reflect near-infrared light, how to translate colour maps into field walking points, and when to inspect moisture or nitrogen.
            </p>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 12, color: '#b4c8b9', lineHeight: 1.6 }}>
              <li>Understanding NDVI value ranges</li>
              <li>Differentiating soil, stress, and vigor</li>
              <li>Actionable field inspection checklist</li>
            </ul>
          </div>
          <div className="au-hub-card-foot">
            <span style={{ fontSize: 11, color: '#9fb5a5' }}>Agronomic Reference</span>
            <a href="/ndvi-explained.html" className="au-hub-card-btn">
              <span>Read Guide</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '36px auto 0', paddingTop: 20, borderTop: '1px solid #ffffff12', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#64748b' }}>
        <span>SEVA·GIS — Spatial Evaluation &amp; Vegetation Analytics</span>
        <div style={{ display: 'flex', gap: 16 }}>
          <a href="https://github.com/virahitvin8/seva-gis" target="_blank" rel="noreferrer" style={{ color: '#9fb5a5', textDecoration: 'none' }}>GitHub</a>
          <a href="/how-it-works.html" style={{ color: '#9fb5a5', textDecoration: 'none' }}>How it works</a>
          <a href="/faq.html" style={{ color: '#9fb5a5', textDecoration: 'none' }}>FAQ</a>
          <a href="/ndvi-explained.html" style={{ color: '#9fb5a5', textDecoration: 'none' }}>NDVI</a>
        </div>
      </div>
    </section>

    {guideModalOpen && <MethodologyModal onClose={() => setGuideModalOpen(false)} />}
  </div>
}
