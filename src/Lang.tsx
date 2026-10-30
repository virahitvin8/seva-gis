import { useEffect, useRef, useState } from 'react'
import { Languages, Check, ChevronDown } from 'lucide-react'
import { useI18n, LANGUAGE_OPTIONS } from './lib/i18n'

export default function Lang() {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentOption = LANGUAGE_OPTIONS.find(opt => opt.code === lang) || LANGUAGE_OPTIONS[0]

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const handleSelectLanguage = (code: typeof LANGUAGE_OPTIONS[number]['code']) => {
    setLang(code)
    setOpen(false)
    try {
      window.dispatchEvent(new CustomEvent('seva-lang-change', { detail: { lang: code } }))
    } catch {}
  }

  return (
    <div className="lg notranslate" translate="no" ref={ref}>
      <button
        type="button"
        className={`lg-pill-btn ${open ? 'active' : ''}`}
        aria-label={t('lang.label')}
        title={`${t('lang.label')}: ${currentOption.label} (${currentOption.native})`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(value => !value)}
      >
        <Languages size={15} className="lg-globe-icon" />
        <span className="lg-current-code">{currentOption.native}</span>
        <ChevronDown size={12} className={`lg-chevron ${open ? 'rotate' : ''}`} />
      </button>

      {open && (
        <div className="lg-menu notranslate" translate="no" role="menu" aria-label={t('lang.select')}>
          <div className="lg-menu-header">
            <Languages size={13} />
            <span>{t('lang.select')}</span>
          </div>
          {LANGUAGE_OPTIONS.map(option => (
            <button
              key={option.code}
              type="button"
              role="menuitemradio"
              aria-checked={lang === option.code}
              className={`lg-opt-btn ${lang === option.code ? 'on' : ''}`}
              onClick={() => handleSelectLanguage(option.code)}
            >
              <div className="lg-opt-labels">
                <span className="lg-opt-label">{option.native}</span>
                <span className="lg-opt-sub">{option.label}</span>
              </div>
              {lang === option.code && <Check size={14} className="lg-check-icon" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

