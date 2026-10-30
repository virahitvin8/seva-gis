import React from 'react'
import { Layers, MapPinned, Plus, Maximize2, Minimize2, Sprout, Bell } from 'lucide-react'
import { useI18n } from '../lib/i18n'

interface MobileBottomNavProps {
  currentNav: string
  onNavChange: (nav: string) => void
  onQuickAdd: () => void
  isMapFocused: boolean
  onToggleMapFocus: () => void
  unreadAlertsCount?: number
}

export default function MobileBottomNav({
  currentNav,
  onNavChange,
  onQuickAdd,
  isMapFocused,
  onToggleMapFocus,
  unreadAlertsCount = 0
}: MobileBottomNavProps) {
  const { t } = useI18n()

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12)
      } catch {
        // Haptic unavailable
      }
    }
  }

  const handleNavClick = (navId: string) => {
    triggerHaptic()
    onNavChange(navId)
  }

  const handleCenterClick = () => {
    triggerHaptic()
    onQuickAdd()
  }

  const handleMapToggle = () => {
    triggerHaptic()
    onToggleMapFocus()
  }

  return (
    <nav className="mobile-dock-container" aria-label="Mobile primary navigation">
      <div className="mobile-dock-surface">
        {/* 1. Overview */}
        <button
          type="button"
          className={`mobile-dock-item ${currentNav === 'Overview' && !isMapFocused ? 'active' : ''}`}
          onClick={() => handleNavClick('Overview')}
          aria-label={t('nav.overview')}
        >
          <div className="mobile-dock-icon">
            <Layers size={20} strokeWidth={currentNav === 'Overview' && !isMapFocused ? 2.5 : 2} />
          </div>
          <span className="mobile-dock-label">{t('nav.overview')}</span>
        </button>

        {/* 2. My Farms / Fields */}
        <button
          type="button"
          className={`mobile-dock-item ${currentNav === 'My farms' && !isMapFocused ? 'active' : ''}`}
          onClick={() => handleNavClick('My farms')}
          aria-label={t('nav.farms')}
        >
          <div className="mobile-dock-icon">
            <MapPinned size={20} strokeWidth={currentNav === 'My farms' && !isMapFocused ? 2.5 : 2} />
          </div>
          <span className="mobile-dock-label">{t('nav.farms')}</span>
        </button>

        {/* 3. Center Hero Quick Action (Blinkit / HP tactile elevated button) */}
        <div className="mobile-dock-center-wrapper">
          <button
            type="button"
            className="mobile-dock-hero-btn"
            onClick={handleCenterClick}
            aria-label={t('action.add')}
            title="Quick Add Farm or GPS Detect"
          >
            <div className="mobile-dock-hero-inner">
              <Plus size={24} strokeWidth={2.8} />
            </div>
            <span className="mobile-dock-hero-ripple" />
          </button>
        </div>

        {/* 4. Satellite Map Focus */}
        <button
          type="button"
          className={`mobile-dock-item ${isMapFocused ? 'active' : ''}`}
          onClick={handleMapToggle}
          aria-label={isMapFocused ? t('map.exitFocus') : t('map.focus')}
        >
          <div className="mobile-dock-icon">
            {isMapFocused ? <Minimize2 size={20} strokeWidth={2.5} /> : <Maximize2 size={20} strokeWidth={2} />}
          </div>
          <span className="mobile-dock-label">
            {isMapFocused ? t('map.exitFocus') : t('map.focus')}
          </span>
        </button>

        {/* 5. Crop Care / Journal */}
        <button
          type="button"
          className={`mobile-dock-item ${currentNav === 'Crop journal' && !isMapFocused ? 'active' : ''}`}
          onClick={() => handleNavClick('Crop journal')}
          aria-label={t('nav.journal')}
        >
          <div className="mobile-dock-icon" style={{ position: 'relative' }}>
            <Sprout size={20} strokeWidth={currentNav === 'Crop journal' && !isMapFocused ? 2.5 : 2} />
            {unreadAlertsCount > 0 && (
              <span className="mobile-dock-badge">{unreadAlertsCount}</span>
            )}
          </div>
          <span className="mobile-dock-label">{t('nav.journal')}</span>
        </button>
      </div>
    </nav>
  )
}
