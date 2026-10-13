// React binding for the SEVA·GIS message catalogues.
//
// The catalogue data lives in `src/lib/i18nCatalog.ts` (plain TypeScript, no JSX) so
// it can be unit-tested directly by Node's test runner and checked for key parity
// across English, Hindi and Telugu.
//
// Run `npm run i18n:coverage` to see how much of the app is still untranslated.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CATALOGS, STORE_KEY, isLang, type Lang } from './i18nCatalog'

export { CATALOGS, LANGUAGE_OPTIONS, type Lang, type Catalog } from './i18nCatalog'

type I18nValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, fallback?: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY)
      if (isLang(saved)) return saved
    } catch {
      // storage unavailable
    }
    // Also check sessionStorage as fallback
    try {
      const sessionSaved = sessionStorage.getItem(STORE_KEY)
      if (isLang(sessionSaved)) return sessionSaved
    } catch {
      // storage unavailable
    }
    return 'en'
  })

  // Sync to both localStorage and sessionStorage for maximum persistence
  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORE_KEY, lang)
      sessionStorage.setItem(STORE_KEY, lang)
    } catch {
      // storage unavailable
    }
  }, [lang])

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key, fallback) => CATALOGS[lang][key] ?? CATALOGS.en[key] ?? fallback ?? key,
    }),
    [lang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}
