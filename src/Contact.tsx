import { useEffect, useRef, useState } from 'react'
import { Lightbulb, Mail, MessageSquareWarning, Minus, X } from 'lucide-react'

const TO = 'akshitvinay4636@gmail.com'
const W3_KEY = '9d66d425-b661-4b50-b09e-929f493eb635'
const KINDS = [['contact', 'Contact', Mail, 'say hello or ask a question'], ['suggestion', 'Suggestion', Lightbulb, 'an idea to make SEVA.GIS better'], ['complaint', 'Complaint', MessageSquareWarning, 'something is broken or wrong']] as const
type Kind = (typeof KINDS)[number][0]
type Step = 'pick' | 'name' | 'msg' | 'email' | 'sending' | 'done' | 'err'
type Line = { who: 'bot' | 'me'; text: string }

export default function Contact() {
  const [open, setOpen] = useState(false), [dismissed, setDismissed] = useState(false)
  const [kind, setKind] = useState<Kind>('contact'), [step, setStep] = useState<Step>('pick')
  const [lines, setLines] = useState<Line[]>([{ who: 'bot', text: 'Hi there! I am the SEVA.GIS SAHAYAK. What would you like to do?' }])
  const [val, setVal] = useState(''), [data, setData] = useState({ name: '', message: '', email: '' }), [typing, setTyping] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = () => { if (!dismissed && innerHeight + scrollY >= document.documentElement.scrollHeight - 160) setOpen(true) }
    addEventListener('scroll', check, { passive: true }); check()
    return () => removeEventListener('scroll', check)
  }, [dismissed])
  useEffect(() => { box.current?.scrollTo({ top: 9999, behavior: 'smooth' }) }, [lines, typing, step])

  const say = (text: string, then?: () => void) => { setTyping(true); setTimeout(() => { setTyping(false); setLines(l => [...l, { who: 'bot', text }]); then?.() }, 650) }
  const me = (text: string) => setLines(l => [...l, { who: 'me', text }])

  const pick = (k: Kind) => {
    setKind(k); me(KINDS.find(x => x[0] === k)![1]); setStep('name')
    say(k === 'complaint' ? 'Sorry about that. Let us fix it. What is your name?' : k === 'suggestion' ? 'Great, we love ideas! What is your name?' : 'Lovely. What is your name?')
  }
  function formPost(email: string) {
    try {
      const n = 'fs-' + Date.now()
      const fr = document.createElement('iframe'); fr.name = n; fr.style.display = 'none'
      const f = document.createElement('form'); f.method = 'POST'; f.action = `https://formsubmit.co/${TO}`; f.target = n; f.style.display = 'none'
      const fields: Record<string, string> = { _subject: `SEVA.GIS ${kind}: ${data.name}`, _template: 'table', _captcha: 'false', type: kind, name: data.name, email: email || '(not given)', message: data.message }
      Object.entries(fields).forEach(([k, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i) })
      document.body.append(fr, f); f.submit()
      setTimeout(() => { fr.remove(); f.remove() }, 15000)
      return true
    } catch { return false }
  }
  async function send(email: string) {
    setStep('sending')
    try {
      if (W3_KEY) {
        const w = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ access_key: W3_KEY, subject: `SEVA.GIS ${kind}: ${data.name}`, from_name: 'SEVA.GIS', type: kind, name: data.name, ...(email ? { email, replyto: email } : {}), message: data.message }) })
        const wj = await w.json().catch(() => ({}))
        if (!w.ok || !wj.success) throw new Error(String(wj.message || ''))
        setStep('done'); say('Message sent. Thank you, ' + data.name + '! We read every one.'); return
      }
      const r = await fetch(`https://formsubmit.co/ajax/${TO}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ _subject: `SEVA.GIS ${kind}: ${data.name}`, _template: 'table', _captcha: 'false', type: kind, name: data.name, email: email || '(not given)', message: data.message }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.success === 'false' || j.success === false) throw new Error(String(j.message || ''))
      setStep('done'); say('Message sent. Thank you, ' + data.name + '! We read every one.')
    } catch (e) {
      const m = e instanceof Error ? e.message : ''
      if (!/activat/i.test(m) && formPost(email)) {
        setStep('done'); say('Sent, but I could not confirm delivery. To be safe, your email app will open with the message ready. Just press Send.')
        window.open(`mailto:${TO}?subject=${encodeURIComponent('SEVA.GIS ' + kind + ': ' + data.name)}&body=${encodeURIComponent(data.message + '\n\nFrom: ' + data.name + (email ? ' (' + email + ')' : ''))}`, '_self')
        return
      }
      setStep('err')
      if (/activat/i.test(m)) say('The mailbox is not switched on yet. The admin needs to click the activation email from FormSubmit once. Please try again later, or write to ' + TO + '.')
      else say('Sorry, that did not go through. Check your internet and press Try again. You can also write to ' + TO + '.')
    }
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = val.trim()
    if (step === 'name') { if (!v) return; me(v); setData(d => ({ ...d, name: v })); setVal(''); setStep('msg'); say(`Nice to meet you, ${v}. Type your ${kind} below.`) }
    else if (step === 'msg') { if (v.length < 5) return; me(v); setData(d => ({ ...d, message: v })); setVal(''); setStep('email'); say('Want a reply? Add your email, or press Skip. It is optional.') }
    else if (step === 'email') { me(v || '(skipped)'); setData(d => ({ ...d, email: v })); setVal(''); send(v) }
  }
  const reset = () => { setStep('pick'); setLines([{ who: 'bot', text: 'Hi again! What would you like to do?' }]); setData({ name: '', message: '', email: '' }); setVal('') }

  if (!open) return dismissed ? <button className="cb-tab" onClick={() => { setOpen(true) }}>Chat with us</button> : null
  const typed = step === 'name' || step === 'msg' || step === 'email'
  return <aside className="cb" aria-label="Contact, suggestion or complaint chat">
    <header><i className="cb-dot"/><b>SEVA.GIS SAHAYAK</b>
      <button aria-label="Minimise" onClick={() => { setOpen(false); setDismissed(true) }}><Minus size={13}/></button>
      <button aria-label="Close" onClick={() => { setOpen(false); setDismissed(true) }}><X size={13}/></button></header>
    <div className="cb-log" ref={box}>
      {lines.map((l, i) => <p key={i} className={l.who}>{l.who === 'bot' && <em>Sahayak says:</em>}{l.text}</p>)}
      {typing && <p className="bot cb-typing"><span/><span/><span/></p>}
      {step === 'pick' && !typing && <div className="cb-pick">{KINDS.map(([k, label, Icon, hint]) => <button key={k} onClick={() => pick(k)}><Icon size={15}/><span><b>{label}</b><small>{hint}</small></span></button>)}</div>}
      {(step === 'done' || step === 'err') && !typing && <div className="cb-pick"><button onClick={step === 'err' ? () => send(data.email) : reset}><span><b>{step === 'err' ? 'Try again' : 'Send another'}</b></span></button></div>}
    </div>
    {typed && <form onSubmit={submit}>
      {step === 'msg' ? <textarea autoFocus rows={2} maxLength={3000} placeholder={`Your ${kind}…`} value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e) } }}/>
        : <input autoFocus type={step === 'email' ? 'email' : 'text'} maxLength={step === 'email' ? 120 : 80} placeholder={step === 'name' ? 'Your name' : 'you@example.com (optional)'} value={val} onChange={e => setVal(e.target.value)}/>}
      {step === 'email' && <button type="button" onClick={() => { me('(skipped)'); send('') }}>Skip</button>}
      <button className="go">{step === 'email' ? 'Send message' : 'Send'}</button>
    </form>}
    {step === 'sending' && <div className="cb-sending">Sending…</div>}
  </aside>
}
