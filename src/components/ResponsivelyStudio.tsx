import React, { useState } from 'react'
import {
  Smartphone, Tablet, Monitor, Laptop, RotateCw, ZoomIn, ZoomOut,
  Maximize2, X, Check, RefreshCw, Layers, ShieldCheck, Sparkles, ExternalLink
} from 'lucide-react'
import type { FarmData } from '../lib/seva'

interface Props {
  farm: FarmData & { id: string; name: string; crop?: string }
  onClose: () => void
}

interface DevicePreset {
  id: string
  name: string
  category: 'mobile' | 'tablet' | 'laptop' | 'desktop'
  width: number
  height: number
  scale: number
  bezelRadius: number
  hasNotch?: boolean
}

const DEVICE_PRESETS: DevicePreset[] = [
  {
    id: 'iphone-16-pro',
    name: 'iPhone 16 Pro',
    category: 'mobile',
    width: 393,
    height: 852,
    scale: 0.65,
    bezelRadius: 44,
    hasNotch: true,
  },
  {
    id: 'pixel-8',
    name: 'Google Pixel 8',
    category: 'mobile',
    width: 412,
    height: 915,
    scale: 0.62,
    bezelRadius: 36,
  },
  {
    id: 'ipad-pro-11',
    name: 'iPad Pro 11"',
    category: 'tablet',
    width: 834,
    height: 1194,
    scale: 0.48,
    bezelRadius: 32,
  },
  {
    id: 'macbook-air-13',
    name: 'MacBook Air 13"',
    category: 'laptop',
    width: 1280,
    height: 832,
    scale: 0.42,
    bezelRadius: 18,
  },
  {
    id: 'desktop-hd',
    name: 'Cinema Display',
    category: 'desktop',
    width: 1920,
    height: 1080,
    scale: 0.32,
    bezelRadius: 10,
  },
]

export default function ResponsivelyStudio({ farm, onClose }: Props) {
  const [selectedDevices, setSelectedDevices] = useState<string[]>([
    'iphone-16-pro',
    'ipad-pro-11',
    'macbook-air-13',
  ])
  const [isLandscape, setIsLandscape] = useState<boolean>(false)
  const [globalZoom, setGlobalZoom] = useState<number>(1.0)
  const [activeTab, setActiveTab] = useState<'map' | 'report' | 'telemetry'>('map')

  const toggleDevice = (id: string) => {
    if (selectedDevices.includes(id)) {
      if (selectedDevices.length > 1) {
        setSelectedDevices(selectedDevices.filter(d => d !== id))
      }
    } else {
      setSelectedDevices([...selectedDevices, id])
    }
  }

  const activePresets = DEVICE_PRESETS.filter(d => selectedDevices.includes(d.id))

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'rgba(11, 15, 25, 0.95)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Top Studio Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: '#0b1329',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 15px rgba(2, 132, 199, 0.4)'
          }}>
            <Monitor size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.3px', color: '#fff' }}>
                Responsively Studio
              </span>
              <span style={{ fontSize: 9.5, background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.4)' }}>
                responsively-app
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Simultaneous multi-device viewport inspection over {farm.name}
            </div>
          </div>
        </div>

        {/* Viewport Selectors */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DEVICE_PRESETS.map(preset => {
            const isChecked = selectedDevices.includes(preset.id)
            return (
              <button
                key={preset.id}
                onClick={() => toggleDevice(preset.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: isChecked ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
                  background: isChecked ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: isChecked ? '#e0f2fe' : '#94a3b8',
                  fontSize: 11.5,
                  fontWeight: isChecked ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {preset.category === 'mobile' && <Smartphone size={13} />}
                {preset.category === 'tablet' && <Tablet size={13} />}
                {preset.category === 'laptop' && <Laptop size={13} />}
                {preset.category === 'desktop' && <Monitor size={13} />}
                <span>{preset.name}</span>
              </button>
            )
          })}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Orientation toggle */}
          <button
            onClick={() => setIsLandscape(!isLandscape)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: isLandscape ? '#1e293b' : 'rgba(255, 255, 255, 0.05)',
              color: '#f8fafc',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RotateCw size={13} />
            <span>{isLandscape ? 'Landscape' : 'Portrait'}</span>
          </button>

          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255, 255, 255, 0.05)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <button
              onClick={() => setGlobalZoom(Math.max(0.6, globalZoom - 0.1))}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 2 }}
            >
              <ZoomOut size={13} />
            </button>
            <span style={{ fontSize: 11, minWidth: 38, textAlign: 'center', fontWeight: 600, color: '#38bdf8' }}>
              {Math.round(globalZoom * 100)}%
            </span>
            <button
              onClick={() => setGlobalZoom(Math.min(1.4, globalZoom + 0.1))}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 2 }}
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Close button */}
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

      {/* Main Viewport Stage */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px',
        display: 'flex',
        gap: '28px',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)'
      }}>
        {activePresets.map(device => {
          const w = isLandscape ? device.height : device.width
          const h = isLandscape ? device.width : device.height
          const scale = device.scale * globalZoom

          return (
            <div
              key={device.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
                userSelect: 'none'
              }}
            >
              {/* Device Header Tag */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 10,
                fontSize: 11.5,
                fontWeight: 700,
                color: '#cbd5e1'
              }}>
                <span>{device.name}</span>
                <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                  {w} × {h} px
                </span>
              </div>

              {/* Hardware Device Frame */}
              <div style={{
                width: w * scale,
                height: h * scale,
                borderRadius: device.bezelRadius * scale,
                background: '#020617',
                border: `${Math.max(3, 8 * scale)}px solid #334155`,
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), inset 0 0 0 1px rgba(255,255,255,0.1)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Dynamic Island / Notch */}
                {device.hasNotch && !isLandscape && (
                  <div style={{
                    position: 'absolute',
                    top: 8 * scale,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 90 * scale,
                    height: 22 * scale,
                    background: '#000',
                    borderRadius: 14 * scale,
                    zIndex: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 6 * scale
                  }}>
                    <div style={{ width: 8 * scale, height: 8 * scale, borderRadius: '50%', background: '#082f49' }} />
                  </div>
                )}

                {/* Simulated Screen Content */}
                <div style={{
                  width: w,
                  height: h,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  background: '#f8fafc',
                  color: '#0f172a',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {/* Mock Navigation Bar */}
                  <div style={{
                    background: '#183e30',
                    color: '#fff',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>SEVA·GIS</span>
                      <span style={{ fontSize: 9, background: '#c5dda0', color: '#183e30', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>LIVE</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#c4e0a0' }}>
                      {farm.name}
                    </div>
                  </div>

                  {/* Mock Satellite Map Canvas */}
                  <div style={{
                    height: Math.round(h * 0.42),
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #065f46 50%, #047857 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff'
                  }}>
                    {/* Grid Lines */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)',
                      backgroundSize: '24px 24px'
                    }} />

                    {/* Polygon representation */}
                    <div style={{
                      width: '65%',
                      height: '60%',
                      border: '2.5px solid #22c55e',
                      background: 'rgba(34, 197, 94, 0.25)',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 25px rgba(34, 197, 94, 0.4)',
                      zIndex: 5
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                          {farm.name}
                        </div>
                        <div style={{ fontSize: 10, color: '#bbf7d0', fontWeight: 600 }}>
                          {(farm.area || 1).toFixed(2)} Ha · NDVI {farm.analysis?.ndvi?.mean?.toFixed(2) ?? '0.74'}
                        </div>
                      </div>
                    </div>

                    {/* Telemetry pill */}
                    <div style={{
                      position: 'absolute',
                      bottom: 10,
                      left: 12,
                      background: 'rgba(15, 23, 42, 0.85)',
                      backdropFilter: 'blur(4px)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 9.5,
                      fontFamily: 'monospace',
                      color: '#93c5fd'
                    }}>
                      {farm.lat.toFixed(4)}°N, {farm.lon.toFixed(4)}°E
                    </div>
                  </div>

                  {/* Mock Telemetry Cards */}
                  <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10, background: '#f1f5f9' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700 }}>MEAN NDVI</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>
                          {farm.analysis?.ndvi?.mean?.toFixed(2) ?? '0.74'}
                        </div>
                        <div style={{ fontSize: 9, color: '#16a34a' }}>Healthy vegetative canopy</div>
                      </div>

                      <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700 }}>CANOPY WATER</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0284c7' }}>
                          {farm.analysis?.ndmi?.mean?.toFixed(2) ?? '0.24'}
                        </div>
                        <div style={{ fontSize: 9, color: '#0284c7' }}>Adequate hydration</div>
                      </div>
                    </div>

                    <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 11 }}>
                      <div style={{ fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Field Summary: {farm.name}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 10, lineHeight: 1.4 }}>
                        Crop: {farm.crop || 'Standing Crop'} | Area: {(farm.area || 1).toFixed(2)} Ha | Elevation: {farm.analysis?.elevMean?.toFixed(0) ?? '240'} m | Slope: {farm.analysis?.slopeDeg?.toFixed(1) ?? '1.2'}°
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
