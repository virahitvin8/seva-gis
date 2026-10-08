import LogoLoader from './LogoLoader'
import Aurora from './Aurora'
import { MitraBye } from './Mitra'
import { clearGreeting } from './lib/greet'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { LogIn, UserPlus, User as UserIcon } from 'lucide-react'
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
  const pw = useRef<HTMLInputElement>(null)

  async function enter(w: Who) { sessionStorage.removeItem('seva-bye'); await openWorkspace(w.id); setSession(w.id); setWho(w) }
  useEffect(() => {
    (async () => {
      const id = sessionId()
      if (id === GUEST) await enter({ id: GUEST, name: 'Guest', email: '' })
      else if (id) { const u = await db.users.get(id); if (u) await enter({ id: u.id, name: u.name, email: u.email }) }
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
  const signOut = () => { sessionStorage.setItem('seva-bye', '1'); sessionStorage.removeItem('seva-mitra-asked'); clearGreeting(); closeWorkspace(); setSession(null); setWho(null); setForm({ name: '', email: '', password: '' }) }

  if (booting) return <div className="ll-full"><LogoLoader text="Opening SEVA.GIS…" size={96}/></div>
  if (who) return <Ctx.Provider value={{ who, signOut }}>{children}</Ctx.Provider>
  return <div className="au-wrap">
    {sessionStorage.getItem('seva-bye') && <MitraBye/>}
    <section className="au-hero">
      <Aurora/>
      <div className="au-hero-copy">
        <div className="au-logo"><img src={logo} alt=""/><Wordmark/></div>
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
      <p>{mode === 'in' ? 'SEVA.GIS helps you see your farms, every day.' : 'Make an account to save your farms and records.'}</p>
      {mode === 'in' && saved.length > 0 && <div className="au-known"><span>Welcome back, tap your name</span>{saved.map(k => <div className="au-chip" key={k.email}><button type="button" onClick={() => { setForm({ ...form, email: k.email, password: '' }); setTimeout(() => pw.current?.focus(), 30) }}><b>{(k.name || k.email)[0].toUpperCase()}</b><span>{k.name}<small>{k.email}</small></span></button><button type="button" aria-label={`Forget ${k.name}`} onClick={() => { forget(k.email); setSaved(known()) }}>×</button></div>)}</div>}
      <div className="au-tabs"><button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Sign in</button><button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>Create account</button></div>
      {mode === 'up' && <label>Your name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name"/></label>}
      <label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" placeholder="you@example.com"/></label>
      <label>Password<input ref={pw} required type="password" minLength={mode === 'up' ? 8 : 1} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} placeholder={mode === 'up' ? 'At least 8 characters' : ''}/></label>
      {error && <div className="au-err" role="alert">{error}</div>}
      <button className="au-go" disabled={busy}>{mode === 'in' ? <LogIn size={16}/> : <UserPlus size={16}/>}{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      <div className="au-or"><span>or</span></div>
      {guestAsk
        ? <div className="au-guestname"><label>What should we call you?<input autoFocus value={guestName} maxLength={30} onChange={e => setGuestName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (guestName.trim()) enter({ id: GUEST, name: guestName.trim(), email: '' }) } }} placeholder="Your name" autoComplete="given-name"/></label>
          <button type="button" className="au-guest" disabled={!guestName.trim()} onClick={() => enter({ id: GUEST, name: guestName.trim(), email: '' })}><UserIcon size={15}/>Continue as guest</button></div>
        : <button type="button" className="au-guest" onClick={() => setGuestAsk(true)}><UserIcon size={15}/>Try it as a guest</button>}
      <small>Your account is saved in this browser. Passwords are hashed on your device and never sent anywhere, so there is no reset or sync. Back up from Data manager.</small>
    </form>
  </div>
}
