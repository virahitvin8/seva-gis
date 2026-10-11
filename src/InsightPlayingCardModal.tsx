import React, { useState } from 'react'
import { X, Sparkles, RefreshCw, Info, ExternalLink, HelpCircle, Layers } from 'lucide-react'

export interface InsightCardData {
  title: string
  acronym?: string
  value: string
  status: 'good' | 'warn' | 'bad' | 'neutral'
  category: 'Spectral Index' | 'Weather & Atmosphere' | 'Soil Water' | 'Soil Property' | 'Terrain' | 'Hydrology'
  formula?: string
  thresholds?: string
  meaning: string
  actionRecommendation?: string
  highImpact?: string
  lowImpact?: string
}

export default function InsightPlayingCardModal({
  card,
  onClose
}: {
  card: InsightCardData | null
  onClose: () => void
}) {
  const [flipped, setFlipped] = useState(false)

  if (!card) return null

  const getSuitIcon = () => {
    switch (card.category) {
      case 'Spectral Index': return '🛰️'
      case 'Weather & Atmosphere': return '☀️'
      case 'Soil Water': return '💧'
      case 'Soil Property': return '🌱'
      case 'Terrain': return '⛰️'
      case 'Hydrology': return '🌊'
      default: return '🔬'
    }
  }

  const getThemeColor = () => {
    switch (card.status) {
      case 'good': return '#16a34a'
      case 'warn': return '#d97706'
      case 'bad': return '#dc2626'
      default: return '#2563eb'
    }
  }

  const color = getThemeColor()

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          perspective: '1200px',
          width: '380px',
          maxWidth: '92vw',
          height: '520px',
          maxHeight: '85vh',
          cursor: 'pointer',
        }}
        onClick={e => {
          e.stopPropagation()
          setFlipped(f => !f)
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            textAlign: 'center',
            transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* FRONT OF PLAYING CARD */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: '24px',
              border: `3px solid ${color}`,
              boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 25px ${color}33`,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
              userSelect: 'none',
            }}
          >
            {/* Playing Card Top Corners */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
              <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                <span style={{ fontSize: '20px', display: 'block' }}>{getSuitIcon()}</span>
                <span style={{ fontSize: '13px', fontWeight: 900, color, letterSpacing: '0.5px' }}>
                  {card.acronym || card.title.slice(0, 4).toUpperCase()}
                </span>
              </div>
              <div style={{ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: '12px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, color }}>
                {card.category}
              </div>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onClose()
                }}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  cursor: 'pointer'
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Playing Card Center Graphic & Value */}
            <div style={{ margin: 'auto 0', padding: '10px 0' }}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${color}22 0%, ${color}05 70%)`,
                  border: `2px dashed ${color}66`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                  fontSize: '34px',
                }}
              >
                {getSuitIcon()}
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                {card.title}
              </h3>

              <div style={{ fontSize: '32px', fontWeight: 900, color, letterSpacing: '-0.5px', marginBottom: '8px' }}>
                {card.value}
              </div>

              {card.formula && (
                <div style={{ display: 'inline-block', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontFamily: 'monospace', color: '#475569', marginBottom: '10px' }}>
                  {card.formula}
                </div>
              )}

              <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45, margin: 0, padding: '0 8px' }}>
                {card.meaning}
              </p>
            </div>

            {/* Playing Card Bottom & Flip Prompt */}
            <div style={{ width: '100%', borderTop: '1px dashed #cbd5e1', paddingTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                  <Sparkles size={12} color={color} />
                  <span>Click to Flip for Actions</span>
                </span>
                <span style={{ fontSize: '12px' }}>{getSuitIcon()}</span>
              </div>
            </div>
          </div>

          {/* BACK OF PLAYING CARD */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: '24px',
              border: `3px solid ${color}`,
              boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 25px ${color}44`,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
              color: '#f8fafc',
              textAlign: 'left',
              userSelect: 'none',
            }}
          >
            {/* Back Card Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', fontWeight: 700 }}>
                  Agro-Geospatial Directive
                </span>
                <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '2px 0 0', color: '#f8fafc' }}>
                  {card.title} Breakdown
                </h4>
              </div>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onClose()
                }}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Back Card Insights */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: 'auto 0', fontSize: '12px', lineHeight: 1.45 }}>
              {card.thresholds && (
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <b style={{ color: '#38bdf8', display: 'block', marginBottom: '3px' }}>Threshold Range:</b>
                  <span style={{ color: '#cbd5e1' }}>{card.thresholds}</span>
                </div>
              )}

              {card.highImpact && (
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <b style={{ color: '#4ade80', display: 'block', marginBottom: '3px' }}>What happens if Higher?</b>
                  <span style={{ color: '#cbd5e1' }}>{card.highImpact}</span>
                </div>
              )}

              {card.lowImpact && (
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <b style={{ color: '#f87171', display: 'block', marginBottom: '3px' }}>What happens if Lower?</b>
                  <span style={{ color: '#cbd5e1' }}>{card.lowImpact}</span>
                </div>
              )}

              {card.actionRecommendation && (
                <div style={{ background: `${color}25`, borderRadius: '10px', padding: '10px 12px', border: `1px solid ${color}66` }}>
                  <b style={{ color, display: 'block', marginBottom: '3px' }}>Action for Area of Interest:</b>
                  <span style={{ color: '#f8fafc' }}>{card.actionRecommendation}</span>
                </div>
              )}
            </div>

            {/* Flip Back Button */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Tap anywhere to flip back</span>
              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>SEVA·GIS Agro-Lab</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
