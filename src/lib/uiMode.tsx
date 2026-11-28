import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { detectAppRuntime, type UIMode } from './appRuntime'

export { detectAppRuntime, type UIMode }

const STORAGE_MODE_KEY = 'seva-ui-mode'

interface UIModeContextValue {
  mode: UIMode
  setMode: (next: UIMode) => void
  isApp: boolean
  canSwitchMode: boolean
}

const UIModeContext = createContext<UIModeContextValue>({
  mode: 'lite',
  setMode: () => {},
  isApp: false,
  canSwitchMode: true,
})

export function UIModeProvider({ children }: { children: ReactNode }) {
  const [isApp] = useState<boolean>(() => detectAppRuntime())
  const [mode, setModeState] = useState<UIMode>(() => {
    if (detectAppRuntime()) return 'lite'
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_MODE_KEY) : null
      if (saved === 'lite' || saved === 'pro') return saved
    } catch {}
    // Default web experience starts in clean Simplified mode unless user picks Advanced (Pro)
    return 'lite'
  })

  useEffect(() => {
    if (isApp && mode !== 'lite') setModeState('lite')
  }, [isApp, mode])

  const setMode = (next: UIMode) => {
    if (isApp) {
      setModeState('lite')
      return
    }
    setModeState(next)
    try {
      localStorage.setItem(STORAGE_MODE_KEY, next)
    } catch {}
  }

  return (
    <UIModeContext.Provider value={{ mode: isApp ? 'lite' : mode, setMode, isApp, canSwitchMode: !isApp }}>
      {children}
    </UIModeContext.Provider>
  )
}

export const useUIMode = () => useContext(UIModeContext)

