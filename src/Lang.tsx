import { useEffect, useRef, useState } from 'react'
import { Languages, Check } from 'lucide-react'

const OPTS = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'हिन्दी', native: 'Hindi' },
  { code: 'te', label: 'తెలుగు', native: 'Telugu' }
]
const KEY = 'seva-lang'

// Patch DOM methods to protect React 19 from Google Translate DOM mutations
let domPatched = false
function patchDom() {
  if (domPatched || typeof window === 'undefined') return
  domPatched = true

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

  const rp = Node.prototype.replaceChild
  Node.prototype.replaceChild = function <T extends Node>(this: Node, newChild: Node, oldChild: T): T {
    if (oldChild.parentNode !== this) return oldChild
    return rp.call(this, newChild, oldChild) as T
  }
}

// Thoroughly wipe all variants of googtrans cookies across all domains & paths
function clearAllGoogleTransCookies() {
  const host = window.location.hostname
  const domains: string[] = ['', host]

  if (host.includes('.')) {
    domains.push(`.${host}`)
    const parts = host.split('.')
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(i).join('.')
      if (parent.includes('.')) {
        domains.push(parent)
        domains.push(`.${parent}`)
      }
    }
  }

  const paths = ['/', window.location.pathname, '']
  for (const d of domains) {
    for (const p of paths) {
      const domPart = d ? `; domain=${d}` : ''
      const pathPart = p ? `; path=${p}` : ''
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC${pathPart}${domPart}`
      document.cookie = `googtrans=; max-age=0${pathPart}${domPart}`
    }
  }
  try {
    sessionStorage.removeItem('googtrans')
    localStorage.removeItem('googtrans')
  } catch {}
}

function setLanguageCookie(code: string) {
  if (code === 'en') {
    clearAllGoogleTransCookies()
    return
  }

  const v = `/en/${code}`
  const host = window.location.hostname
  const exp = 'Fri, 31 Dec 2099 23:59:59 GMT'

  document.cookie = `googtrans=${v}; expires=${exp}; path=/`
  if (host.includes('.')) {
    document.cookie = `googtrans=${v}; expires=${exp}; path=/; domain=${host}`
    document.cookie = `googtrans=${v}; expires=${exp}; path=/; domain=.${host}`
  }
}

let scriptLoading = false
function ensureGoogleTranslateLoaded(onReady?: () => void) {
  patchDom()

  if (document.querySelector('script[src*="translate.google.com"]')) {
    if (onReady) onReady()
    return
  }

  if (scriptLoading) return
  scriptLoading = true

  ;(window as unknown as { googleTranslateElementInit: () => void }).googleTranslateElementInit = () => {
    try {
      const g = (window as unknown as { google?: { translate?: { TranslateElement: new (o: object, id: string) => void } } })?.google
      if (g?.translate?.TranslateElement) {
        new g.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,hi,te',
            autoDisplay: false,
            layout: 0
          },
          'seva-gt'
        )
      }
      if (onReady) setTimeout(onReady, 100)
    } catch (e) {
      console.warn('Google Translate initialization notice:', e)
    }
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

  // Initialize on mount
  useEffect(() => {
    patchDom()
    document.documentElement.lang = cur

    if (cur !== 'en') {
      setLanguageCookie(cur)
      ensureGoogleTranslateLoaded(() => {
        // Trigger translation if combo is ready
        const sel = document.querySelector<HTMLSelectElement>('select.goog-te-combo')
        if (sel && sel.value !== cur) {
          sel.value = cur
          sel.dispatchEvent(new Event('change'))
        }
      })
    } else {
      // Clean up any residual translate cookies so English remains pure and fast
      clearAllGoogleTransCookies()
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const pick = (code: string) => {
    setOpen(false)
    if (code === cur) return

    localStorage.setItem(KEY, code)
    setCur(code)
    document.documentElement.lang = code

    if (code === 'en') {
      // 1. Thoroughly wipe all Google Translate cookies
      clearAllGoogleTransCookies()

      // 2. Try resetting the select combo if available
      try {
        const sel = document.querySelector<HTMLSelectElement>('select.goog-te-combo')
        if (sel) {
          sel.value = ''
          sel.dispatchEvent(new Event('change'))
        }
      } catch {}

      // 3. Try to click restore button in Google's top iframe banner if present
      try {
        const bannerFrame = document.querySelector<HTMLIFrameElement>('.goog-te-banner-frame')
        if (bannerFrame?.contentDocument) {
          const restoreBtn = bannerFrame.contentDocument.querySelector<HTMLElement>('.goog-te-button button, [id*="restore"]')
          if (restoreBtn) restoreBtn.click()
        }
      } catch {}

      // 4. Without reload: just clear cookies and let Google Translate settle naturally
      // (window.location.reload() was causing 1-2s blank flash every 2-3 minutes)
      clearAllGoogleTransCookies()
      return
    }

    // Target is a non-English language (hi or te)
    setLanguageCookie(code)

    const applyToCombo = () => {
      const sel = document.querySelector<HTMLSelectElement>('select.goog-te-combo')
      if (sel) {
        sel.value = code
        sel.dispatchEvent(new Event('change'))
        return true
      }
      return false
    }

    // Try applying directly without reload
    if (applyToCombo()) return

    // If combo is not ready yet, load script and poll up to 2.5 seconds
    ensureGoogleTranslateLoaded()
    let attempts = 0
    const pollInterval = setInterval(() => {
      attempts++
      if (applyToCombo() || attempts > 20) {
        clearInterval(pollInterval)
        // No reload fallback - just let it settle, avoids blank screen
      }
    }, 120)
  }

  return (
    <div className="lg notranslate" translate="no" ref={ref}>
      <button
        className="lg-btn notification"
        aria-label="Change language"
        title="Change language / भाषा बदलें / భాషను మార్చండి"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Languages size={18} />
      </button>

      {open && (
        <div className="lg-menu notranslate" translate="no" role="menu">
          <div className="lg-menu-header">
            <Languages size={13} />
            <span>Select Language</span>
          </div>
          {OPTS.map(o => (
            <button
              key={o.code}
              role="menuitemradio"
              aria-checked={cur === o.code}
              className={`lg-opt-btn ${cur === o.code ? 'on' : ''}`}
              onClick={() => pick(o.code)}
            >
              <div className="lg-opt-labels">
                <span className="lg-opt-label">{o.label}</span>
                <span className="lg-opt-sub">{o.native}</span>
              </div>
              {cur === o.code && <Check size={14} className="lg-check-icon" />}
            </button>
          ))}
        </div>
      )}

      {/* Hidden container where Google Translate attaches its translation widget */}
      <div id="seva-gt" style={{ display: 'none' }} aria-hidden="true" />
    </div>
  )
}
