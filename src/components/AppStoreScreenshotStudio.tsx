import React, { useState, useRef } from 'react'
import {
  Camera, Download, Sparkles, Layers, Sliders, X, Check,
  Smartphone, Tablet, Eye, Palette, Type, RefreshCw
} from 'lucide-react'
import type { FarmData } from '../lib/seva'

interface Props {
  farm: FarmData & { id: string; name: string; crop?: string }
  onClose: () => void
}

interface ThemeConfig {
  id: string
  name: string
  background: string
  titleColor: string
  subtitleColor: string
  accentColor: string
}

const THEMES: ThemeConfig[] = [
  {
    id: 'emerald-ag',
    name: 'Emerald Agronomy',
    background: 'linear-gradient(145deg, #064e3b 0%, #022c22 100%)',
    titleColor: '#ecfdf5',
    subtitleColor: '#a7f3d0',
    accentColor: '#10b981',
  },
  {
    id: 'midnight-obsidian',
    name: 'Midnight Obsidian',
    background: 'linear-gradient(145deg, #0f172a 0%, #020617 100%)',
    titleColor: '#f8fafc',
    subtitleColor: '#94a3b8',
    accentColor: '#38bdf8',
  },
  {
    id: 'solar-satellite',
    name: 'Solar Satellite',
    background: 'linear-gradient(145deg, #78350f 0%, #451a03 100%)',
    titleColor: '#fffbeb',
    subtitleColor: '#fde68a',
    accentColor: '#f59e0b',
  },
  {
    id: 'nebula-purple',
    name: 'Cosmic Nebula',
    background: 'linear-gradient(145deg, #4c1d95 0%, #2e1065 100%)',
    titleColor: '#faf5ff',
    subtitleColor: '#ddd6fe',
    accentColor: '#a855f7',
  },
]

const HEADLINE_PRESETS = [
  { title: 'Where Satellites Meet Soil', subtitle: 'Zero-backend planetary GIS for precision agronomy & hydrology' },
  { title: 'Autonomous Drone & UAV Studio', subtitle: 'Sub-meter 1.0m GSD orthomosaics & Fields2Cover swath robotics' },
  { title: 'PMFBY Crop Damage Claims', subtitle: 'Verified Sentinel-2 & SAR radar change detection dossiers' },
  { title: 'Universal GIS Interop Bridge', subtitle: 'Native 1-click execution for QGIS, ArcGIS, and Earth Engine' },
]

export default function AppStoreScreenshotStudio({ farm, onClose }: Props) {
  const [headline, setHeadline] = useState(HEADLINE_PRESETS[0].title)
  const [subtitle, setSubtitle] = useState(HEADLINE_PRESETS[0].subtitle)
  const [activeTheme, setActiveTheme] = useState<ThemeConfig>(THEMES[0])
  const [deviceType, setDeviceType] = useState<'iphone' | 'ipad'>('iphone')
  const [isIsometric, setIsIsometric] = useState<boolean>(true)
  const [downloading, setDownloading] = useState<boolean>(false)

  const captureRef = useRef<HTMLDivElement>(null)

  // Download screenshot as canvas / PNG
  const handleExportPng = () => {
    setDownloading(true)
    setTimeout(() => {
      // In-browser trigger
      const canvas = document.createElement('canvas')
      canvas.width = 1242
      canvas.height = 2208
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Draw background gradient
        const grad = ctx.createLinearGradient(0, 0, 1242, 2208)
        if (activeTheme.id === 'emerald-ag') {
          grad.addColorStop(0, '#064e3b')
          grad.addColorStop(1, '#022c22')
        } else if (activeTheme.id === 'midnight-obsidian') {
          grad.addColorStop(0, '#0f172a')
          grad.addColorStop(1, '#020617')
        } else if (activeTheme.id === 'solar-satellite') {
          grad.addColorStop(0, '#78350f')
          grad.addColorStop(1, '#451a03')
        } else {
          grad.addColorStop(0, '#4c1d95')
          grad.addColorStop(1, '#2e1065')
        }
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, 1242, 2208)

        // Draw Title Text
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 64px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(headline, 621, 220)

        // Draw Subtitle
        ctx.fillStyle = activeTheme.subtitleColor
        ctx.font = '500 32px system-ui, sans-serif'
        ctx.fillText(subtitle, 621, 300)

        // Draw Frame outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.lineWidth = 12
        ctx.strokeRect(180, 420, 882, 1600)

        // Download
        const a = document.createElement('a')
        a.download = `SEVA_GIS_Showcase_${activeTheme.id}.png`
        a.href = canvas.toDataURL('image/png')
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
      setDownloading(false)
    }, 600)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'rgba(5, 10, 20, 0.95)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: '#091024',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #10b981 0%, #065f46 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
          }}>
            <Camera size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
                App Store &amp; Launch Showcase Studio
              </span>
              <span style={{ fontSize: 9.5, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                app-store-screenshots
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Generate high-conversion marketing mockups &amp; GitHub launch banners
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleExportPng}
            disabled={downloading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 16px',
              borderRadius: 8,
              background: '#10b981',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: 12.5,
              cursor: downloading ? 'wait' : 'pointer',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
            }}
          >
            {downloading ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
            <span>Export Marketing PNG</span>
          </button>

          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Workspace: Sidebar Controls + Live Stage */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Controls Sidebar */}
        <div style={{
          width: 320,
          background: '#0d1527',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          {/* Headline Presets */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
              Headline Presets
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {HEADLINE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => { setHeadline(preset.title); setSubtitle(preset.subtitle) }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: headline === preset.title ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: headline === preset.title ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    color: headline === preset.title ? '#ecfdf5' : '#94a3b8',
                    textAlign: 'left',
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{preset.title}</div>
                  <div style={{ fontSize: 9.5, opacity: 0.8 }}>{preset.subtitle.slice(0, 50)}...</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Copy */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
              Main Heading
            </label>
            <input
              type="text"
              value={headline}
              onChange={e => setHeadline(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #334155', background: '#020617', color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
              Sub-Heading Description
            </label>
            <textarea
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #334155', background: '#020617', color: '#fff', fontSize: 12, boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>

          {/* Theme Palette */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
              Color Theme
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setActiveTheme(theme)}
                  style={{
                    padding: '8px',
                    borderRadius: 6,
                    border: activeTheme.id === theme.id ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: theme.background,
                    color: '#fff',
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          {/* Frame & Isometric Toggle */}
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
              Device &amp; 3D Angle
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setDeviceType(deviceType === 'iphone' ? 'ipad' : 'iphone')}
                style={{ flex: 1, padding: '7px', borderRadius: 6, background: '#1e293b', color: '#fff', border: '1px solid #334155', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                {deviceType === 'iphone' ? '📱 iPhone 16 Pro' : '📟 iPad Pro'}
              </button>

              <button
                onClick={() => setIsIsometric(!isIsometric)}
                style={{ flex: 1, padding: '7px', borderRadius: 6, background: isIsometric ? 'rgba(16, 185, 129, 0.2)' : '#1e293b', color: isIsometric ? '#6ee7b7' : '#fff', border: isIsometric ? '1px solid #10b981' : '1px solid #334155', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                {isIsometric ? '📐 Isometric 3D' : '📏 Flat 2D'}
              </button>
            </div>
          </div>
        </div>

        {/* Live Marketing Canvas Preview Stage */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          background: '#040813'
        }}>
          {/* Export Frame Container */}
          <div
            ref={captureRef}
            style={{
              width: 520,
              height: 720,
              background: activeTheme.background,
              borderRadius: 24,
              padding: '36px 30px',
              boxShadow: '0 30px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Ambient Nebula Light */}
            <div style={{
              position: 'absolute',
              top: '-20%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '120%',
              height: '50%',
              background: `radial-gradient(ellipse at center, ${activeTheme.accentColor}33, transparent 70%)`,
              filter: 'blur(40px)',
              pointerEvents: 'none'
            }} />

            {/* Typography */}
            <div style={{ textAlign: 'center', zIndex: 10, marginBottom: 28, maxWidth: '90%' }}>
              <div style={{
                fontSize: 24,
                fontWeight: 900,
                color: activeTheme.titleColor,
                lineHeight: 1.25,
                letterSpacing: '-0.5px',
                marginBottom: 8,
                textShadow: '0 2px 10px rgba(0,0,0,0.5)'
              }}>
                {headline}
              </div>
              <div style={{
                fontSize: 12,
                color: activeTheme.subtitleColor,
                lineHeight: 1.45,
                fontWeight: 500
              }}>
                {subtitle}
              </div>
            </div>

            {/* Mock Hardware Device with 3D Tilt */}
            <div style={{
              flex: 1,
              width: deviceType === 'iphone' ? 240 : 380,
              borderRadius: deviceType === 'iphone' ? 36 : 24,
              background: '#020617',
              border: '6px solid #334155',
              boxShadow: isIsometric
                ? '20px 30px 50px rgba(0, 0, 0, 0.7), -5px -5px 20px rgba(255, 255, 255, 0.05)'
                : '0 20px 40px rgba(0, 0, 0, 0.6)',
              transform: isIsometric
                ? 'perspective(900px) rotateX(12deg) rotateY(-8deg) rotateZ(2deg)'
                : 'none',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              {/* Dynamic Island */}
              <div style={{
                position: 'absolute',
                top: 6,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 60,
                height: 14,
                background: '#000',
                borderRadius: 8,
                zIndex: 20
              }} />

              {/* Screen Mockup */}
              <div style={{ flex: 1, background: '#1e3a8a', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, #065f46 0%, #047857 50%, #1e3a8a 100%)'
                }} />

                {/* Vector polygon simulation */}
                <div style={{
                  position: 'absolute',
                  top: '25%',
                  left: '15%',
                  right: '15%',
                  bottom: '25%',
                  border: '2px solid #22c55e',
                  background: 'rgba(34, 197, 94, 0.3)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)'
                }}>
                  <div style={{ textAlign: 'center', color: '#fff' }}>
                    <div style={{ fontSize: 11, fontWeight: 800 }}>{farm.name}</div>
                    <div style={{ fontSize: 8.5, color: '#bbf7d0' }}>NDVI 0.78 · 10m S2</div>
                  </div>
                </div>

                {/* Telemetry ribbon */}
                <div style={{
                  position: 'absolute',
                  bottom: 8,
                  left: 10,
                  right: 10,
                  background: 'rgba(0,0,0,0.7)',
                  borderRadius: 6,
                  padding: '5px 8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 8,
                  color: '#93c5fd',
                  fontFamily: 'monospace'
                }}>
                  <span>S2 L2A BOA</span>
                  <span>Copernicus GLO-30</span>
                </div>
              </div>
            </div>

            {/* Bottom Brand Pill */}
            <div style={{
              marginTop: 18,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '1px',
              color: 'rgba(255, 255, 255, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <span>SEVA·GIS</span>
              <span>•</span>
              <span>https://sevagis.dpdns.org</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
