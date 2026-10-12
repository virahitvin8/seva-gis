// Native localization for SEVA·GIS. Replaces the Google-Translate DOM mutation with
// an explicit message catalog so switching language is instant, persists across
// reloads, and never depends on an external widget.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'hi' | 'te'

type Catalog = Record<string, string>

const en: Catalog = {
  'nav.overview': 'Overview',
  'nav.farms': 'My areas',
  'nav.terminal': 'Terminal',
  'nav.journal': 'Crop journal',
  'nav.alerts': 'Alerts',
  'nav.reports': 'Reports',
  'action.add': 'Add an area',
  'action.addAnother': 'Add another area',
  'empty.title': 'Add your first area',
  'empty.body':
    'Add an outline for any area you want to review remotely. SEVA·GIS shows the latest clear Sentinel-2 pass so you can compare dates, layers, and visible changes.',
  'lang.label': 'Language',
  'lang.select': 'Select language',
}

const hi: Catalog = {
  'nav.overview': 'अवलोकन',
  'nav.farms': 'मेरे क्षेत्र',
  'nav.terminal': 'टर्मिनल',
  'nav.journal': 'फ़सल डायरी',
  'nav.alerts': 'चेतावनियाँ',
  'nav.reports': 'रिपोर्ट',
  'action.add': 'क्षेत्र जोड़ें',
  'action.addAnother': 'एक और क्षेत्र जोड़ें',
  'empty.title': 'अपना पहला क्षेत्र जोड़ें',
  'empty.body':
    'जिस क्षेत्र की दूर से समीक्षा करनी हो, उसकी सीमा जोड़ें। SEVA·GIS ताज़ा साफ़ Sentinel-2 उपग्रह दृश्य दिखाता है, जिससे आप तारीख़, परतें और दिखने वाले बदलाव तुलना कर सकें।',
  'lang.label': 'भाषा',
  'lang.select': 'भाषा चुनें',
}

const te: Catalog = {
  'nav.overview': 'అవలోకనం',
  'nav.farms': 'నా ప్రాంతాలు',
  'nav.terminal': 'టెర్మినల్',
  'nav.journal': 'పంట డైరీ',
  'nav.alerts': 'హెచ్చరికలు',
  'nav.reports': 'నివేదికలు',
  'action.add': 'ప్రాంతాన్ని జోడించండి',
  'action.addAnother': 'మరో ప్రాంతాన్ని జోడించండి',
  'empty.title': 'మీ మొదటి ప్రాంతాన్ని జోడించండి',
  'empty.body':
    'దూరం నుంచి సమీక్షించాలనుకునే ఏ ప్రాంతానికైనా సరిహద్దును జోడించండి. SEVA·GIS తాజా స్పష్టమైన Sentinel-2 ఉపగ్రహ దృశ్యాన్ని చూపుతుంది, దీనితో తేదీలు, పొరలు, కనిపించే మార్పులను పోల్చుకోవచ్చు.',
  'lang.label': 'భాష',
  'lang.select': 'భాషను ఎంచుకోండి',
}

const CATALOGS: Record<Lang, Catalog> = { en, hi, te }
const STORE_KEY = 'seva-lang'

export const LANGUAGE_OPTIONS: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'हिन्दी', native: 'Hindi' },
  { code: 'te', label: 'తెలుగు', native: 'Telugu' },
]

const isLang = (value: string | null): value is Lang => value === 'en' || value === 'hi' || value === 'te'

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
    return 'en'
  })

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORE_KEY, lang)
    } catch {
      // storage unavailable
    }
  }, [lang])

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key, fallback) => CATALOGS[lang][key] ?? en[key] ?? fallback ?? key,
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
