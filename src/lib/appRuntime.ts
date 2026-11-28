export type UIMode = 'lite' | 'pro'

/**
 * Detects whether SEVA.GIS is running inside the Capacitor Android APK wrapper
 * or an installed standalone mobile PWA shell, where Simplified Mode (SEVA Lite)
 * is enforced exclusively.
 */
export function detectAppRuntime(win?: {
  location?: { search?: string }
  navigator?: { userAgent?: string }
  matchMedia?: (q: string) => { matches: boolean }
  Capacitor?: { isNativePlatform?: () => boolean }
}): boolean {
  const target: any = win ?? (typeof window !== 'undefined' ? window : undefined)
  if (!target) return false
  try {
    if (target.Capacitor?.isNativePlatform?.()) return true
    const params = new URLSearchParams(target.location?.search || '')
    if (params.get('app') === '1' || params.get('mode') === 'app') return true
    if (params.get('mode') === 'web') return false
    const ua = String(target.navigator?.userAgent || '')
    if (/;\s*wv\)/i.test(ua) || /Capacitor/i.test(ua)) return true
    if (target.matchMedia?.('(display-mode: standalone)')?.matches) return true
  } catch {
    // fallback safely to web
  }
  return false
}

