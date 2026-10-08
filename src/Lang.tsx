import { useEffect, useRef, useState } from 'react'
import { Languages } from 'lucide-react'

const OPTS = [{ code: 'en', label: 'English' }, { code: 'hi', label: 'हिन्दी' }, { code: 'te', label: 'తెలుగు' }]
const KEY = 'seva-lang'

function setCookie(code: string) {
  const v = code === 'en' ? '' : `/en/${code}`
  const host = location.hostname
  const exp = code === 'en' ? 'Thu, 01 Jan 1970 00:00:00 GMT' : 'Fri, 31 Dec 2099 00:00:00 GMT'
  document.cookie = `googtrans=${v}; expires=${exp}; path=/`
  document.cookie = `googtrans=${v}; expires=${exp}; path=/; domain=${host}`
}

let loaded = false
function patchDom() {
  const rc = Node.prototype.removeChild
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child
    return rc.call(this, child) as T
  }
  const ib = Node.prototype.insertBefore
  Node.prototype.insertBefore = function <T extends Node>(this: Node, n: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return n
    return ib.call(this, n, ref) as T
  }
}
function loadTranslate() {
  if (loaded) return
  loaded = true
  patchDom()
  ;(window as unknown as { googleTranslateElementInit: () => void }).googleTranslateElementInit = () => {
    const g = (window as unknown as { google: { translate: { TranslateElement: new (o: object, id: string) => void } } }).google
    new g.translate.TranslateElement({ pageLanguage: 'en', includedLanguages: 'en,hi,te', autoDisplay: false }, 'seva-gt')
  }
  const s = document.createElement('script')
  s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
  s.async = true
  document.body.appendChild(s)
}

export default function Lang() {
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState(() => localStorage.getItem(KEY) || 'en')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.documentElement.lang = cur
    if (cur !== 'en') { setCookie(cur); loadTranslate() }
  }, [])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const pick = (code: string) => {
    setOpen(false)
    if (code === cur) return
    localStorage.setItem(KEY, code)
    setCookie(code)
    setCur(code)
    document.documentElement.lang = code
    const sel = document.querySelector<HTMLSelectElement>('select.goog-te-combo')
    if (sel) { sel.value = code === 'en' ? 'en' : code; sel.dispatchEvent(new Event('change')); if (code !== 'en') return }
    location.reload()
  }
  return <div className="lg" ref={ref}>
    <button className="lg-btn notification" aria-label="Change language" aria-expanded={open} onClick={() => setOpen(!open)}><Languages size={19}/></button>
    {open && <div className="lg-menu notranslate" translate="no" role="menu">{OPTS.map(o => <button key={o.code} role="menuitemradio" aria-checked={cur === o.code} className={cur === o.code ? 'on' : ''} onClick={() => pick(o.code)}>{o.label}</button>)}</div>}
    <div id="seva-gt" aria-hidden="true"/>
  </div>
}
