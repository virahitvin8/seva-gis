import { useEffect, useRef, useState } from 'react'
import { Languages, Check } from 'lucide-react'
import { useI18n, LANGUAGE_OPTIONS } from './lib/i18n'

export default function Lang() {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <div className="lg notranslate" translate="no" ref={ref}>
      <button
        className="lg-btn notification"
        aria-label={t('lang.label')}
        title={t('lang.label')}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <Languages size={18} />
      </button>

      {open && (
        <div className="lg-menu notranslate" translate="no" role="menu">
          <div className="lg-menu-header">
            <Languages size={13} />
            <span>{t('lang.select')}</span>
          </div>
          {LANGUAGE_OPTIONS.map(option => (
            <button
              key={option.code}
              role="menuitemradio"
              aria-checked={lang === option.code}
              className={`lg-opt-btn ${lang === option.code ? 'on' : ''}`}
              onClick={() => {
                setLang(option.code)
                setOpen(false)
              }}
            >
              <div className="lg-opt-labels">
                <span className="lg-opt-label">{option.label}</span>
                <span className="lg-opt-sub">{option.native}</span>
              </div>
              {lang === option.code && <Check size={14} className="lg-check-icon" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
