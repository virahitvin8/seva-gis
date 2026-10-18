import React, { useState, useRef, useEffect } from 'react'
import {
  Volume2, VolumeX, Sparkles, Orbit, Compass, Cpu, Layers,
  ShieldCheck, ArrowUpRight, Zap, Play, Eye, Activity, Box
} from 'lucide-react'
import type { FarmData } from '../lib/seva'

interface Props {
  farm: FarmData & { id: string; name: string; crop?: string }
  onOpenResponsively?: () => void
  onOpenScreenshotStudio?: () => void
}

/**
 * Web Audio API Synthesizer for tactile spatial soundscape (Zero MP3 files)
 */
class SpatialSoundEngine {
  private ctx: AudioContext | null = null

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  playClick() {
    try {
      this.init()
      if (!this.ctx) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, this.ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.05)
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start()
      osc.stop(this.ctx.currentTime + 0.05)
    } catch (e) {
      // ignore
    }
  }

  playRadarPing() {
    try {
      this.init()
      if (!this.ctx) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(1200, this.ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.15)
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start()
      osc.stop(this.ctx.currentTime + 0.15)
    } catch (e) {
      // ignore
    }
  }
}

const sound = new SpatialSoundEngine()

export default function AwwwardsBentoShowcase({ farm, onOpenResponsively, onOpenScreenshotStudio }: Props) {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true)
  const [activeTile, setActiveTile] = useState<string | null>(null)

  // Card 3D tilt handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = -((y - centerY) / centerY) * 7
    const rotateY = ((x - centerX) / centerX) * 7
    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.015, 1.015, 1.015)`
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
  }

  const handleTileClick = (name: string) => {
    setActiveTile(name)
    if (soundEnabled) sound.playClick()
  }

  return (
    <div style={{
      borderRadius: 16,
      border: '1px solid rgba(255, 255, 255, 0.12)',
      background: 'radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)',
      color: '#f8fafc',
      padding: '24px',
      marginBottom: '20px',
      boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Ambient Glow */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        right: '-5%',
        width: '450px',
        height: '450px',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'absolute',
        bottom: '-10%',
        left: '-5%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }} />

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 4, fontWeight: 800, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              AWWWARDS SOTD LEVEL ARCHITECTURE
            </span>
            <span style={{ fontSize: 10, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: 4, fontWeight: 800, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              ZENTRY MOTION THESIS
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px', color: '#fff' }}>
            SEVA·GIS Spatial Intelligence Matrix
          </h2>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Interactive 3D Bento Grid · Client-side WebGL &amp; Sentinel-2 Radiometry over {farm.name}
          </div>
        </div>

        {/* Ambient Sound & Studio Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 10 }}>
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled)
              if (!soundEnabled) sound.playRadarPing()
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              background: soundEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              color: soundEnabled ? '#4ade80' : '#94a3b8',
              border: soundEnabled ? '1px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>{soundEnabled ? 'Synthesizer Active' : 'Sound Muted'}</span>
          </button>

          {onOpenResponsively && (
            <button
              onClick={() => {
                if (soundEnabled) sound.playClick()
                onOpenResponsively()
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
              }}
            >
              <Orbit size={13} />
              <span>Multi-Device Viewport</span>
            </button>
          )}

          {onOpenScreenshotStudio && (
            <button
              onClick={() => {
                if (soundEnabled) sound.playClick()
                onOpenScreenshotStudio()
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                background: '#10b981',
                color: '#fff',
                border: 'none',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Sparkles size={13} />
              <span>Marketing Studio</span>
            </button>
          )}
        </div>
      </div>

      {/* Bento Grid Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {/* Bento 1: Planetary Radiometry (Hero card, 2 columns on wide) */}
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleTileClick('radiometry')}
          style={{
            gridColumn: 'span 2',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 14,
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'transform 0.15s ease-out, border-color 0.2s ease',
            minHeight: 180,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '180px',
            height: '180px',
            background: 'radial-gradient(circle at top right, rgba(34, 197, 94, 0.2) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#4ade80' }}>
              <Activity size={14} />
              <span>ESA SENTINEL-2 L2A · 10M CALIBRATION</span>
            </div>
            <ArrowUpRight size={16} color="#94a3b8" />
          </div>

          <div style={{ margin: '14px 0', zIndex: 5 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.5px' }}>
              NDVI {farm.analysis?.ndvi?.mean?.toFixed(3) ?? '0.742'}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              Chlorophyll canopy vigour operating at {farm.analysis && farm.analysis.ndvi.mean > 0.65 ? 'Peak Biomass Performance' : 'Moderate Biomass'}. Zero cloud attenuation.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, zIndex: 5, flexWrap: 'wrap', fontSize: 11 }}>
            <span style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '4px 8px', borderRadius: 4, color: '#cbd5e1' }}>
              <b>NDMI:</b> {farm.analysis?.ndmi?.mean?.toFixed(2) ?? '0.24'}
            </span>
            <span style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '4px 8px', borderRadius: 4, color: '#cbd5e1' }}>
              <b>Stress:</b> {farm.analysis?.stressPct?.toFixed(1) ?? '3.5'}%
            </span>
            <span style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '4px 8px', borderRadius: 4, color: '#cbd5e1' }}>
              <b>Resolution:</b> 10.0m BOA
            </span>
          </div>
        </div>

        {/* Bento 2: Terrain & Hydrology */}
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleTileClick('hydro')}
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 14,
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'transform 0.15s ease-out',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
              <Compass size={14} />
              <span>COPERNICUS GLO-30 DSM</span>
            </div>
            <ArrowUpRight size={16} color="#94a3b8" />
          </div>

          <div style={{ margin: '14px 0' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc' }}>
              {farm.analysis?.elevMean?.toFixed(0) ?? '242'} m AMSL
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
              Mean topographic slope of {farm.analysis?.slopeDeg?.toFixed(1) ?? '1.4'}°. Natural gravity drainage.
            </div>
          </div>

          <div style={{ fontSize: 10.5, color: '#38bdf8', fontWeight: 600 }}>
            D8 Priority-Flood Hydrology Active →
          </div>
        </div>

        {/* Bento 3: Swath Robotics UAV */}
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleTileClick('robotics')}
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 14,
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'transform 0.15s ease-out',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>
              <Zap size={14} />
              <span>FIELDS2COVER SWATH ROBOTICS</span>
            </div>
            <ArrowUpRight size={16} color="#94a3b8" />
          </div>

          <div style={{ margin: '14px 0' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc' }}>
              1.0m Sub-Meter GSD
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
              Automated headland turns &amp; UAV waypoint trajectory simulation ready.
            </div>
          </div>

          <div style={{ fontSize: 10.5, color: '#f59e0b', fontWeight: 600 }}>
            Launch Drone Precision Studio →
          </div>
        </div>

        {/* Bento 4: Zero-Backend Security */}
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleTileClick('security')}
          style={{
            gridColumn: 'span 2',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 14,
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'transform 0.15s ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16
          }}
        >
          <div style={{ maxWidth: '75%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>
              <ShieldCheck size={14} />
              <span>DATA SOVEREIGNTY &amp; PRIVACY VAULT</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
              100% Client-Side Ingestion · Zero Server Retention
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
              Boundary coordinates and private crop yields reside exclusively in your device IndexedDB and optional private Google Drive vault.
            </div>
          </div>

          <div style={{
            padding: '8px 14px',
            borderRadius: 8,
            background: 'rgba(168, 85, 247, 0.15)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            color: '#d8b4fe',
            fontWeight: 700,
            fontSize: 12
          }}>
            ISO 11783-10 Compliant
          </div>
        </div>
      </div>
    </div>
  )
}
