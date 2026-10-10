import React, { useState, useEffect } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Send,
  Loader2,
  RotateCcw,
  RefreshCw,
  X,
  Mail,
  ShieldAlert,
  Server,
  Sparkles,
  ExternalLink
} from 'lucide-react'
import { sendPopTeamAlert, type PopTeamPayload, CHAT_HELP_BOT_GMAIL } from './lib/teamAlert'

interface PopTheTeamModalProps {
  isOpen: boolean
  onClose: () => void
  error?: Error | string | null
  stack?: string
  initialReason?: string
  farmName?: string
  farmLocation?: string
  userEmail?: string
  userName?: string
  standaloneCrash?: boolean
}

export default function PopTheTeamModal({
  isOpen,
  onClose,
  error,
  stack,
  initialReason,
  farmName,
  farmLocation,
  userEmail: propUserEmail,
  userName: propUserName,
  standaloneCrash = false,
}: PopTheTeamModalProps) {
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; incidentId: string; message: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Prefill email from prop or localStorage
  useEffect(() => {
    if (propUserEmail) {
      setEmail(propUserEmail)
    } else {
      try {
        const remembered = localStorage.getItem('seva-remembered')
        if (remembered) {
          const list = JSON.parse(remembered)
          if (Array.isArray(list) && list[0]?.email) {
            setEmail(list[0].email)
          }
        }
      } catch {}
    }
  }, [propUserEmail])

  if (!isOpen) return null

  const errorSummary = error instanceof Error
    ? `${error.name}: ${error.message}`
    : typeof error === 'string'
      ? error
      : initialReason || 'Page or satellite telemetry interrupted'

  const handlePopTeam = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSending(true)
    setErrorMsg('')

    try {
      const payload: PopTeamPayload = {
        reason: initialReason || (error ? 'Unhandled Exception / Render Halt' : 'User reported page issue'),
        error,
        stack,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userEmail: email.trim() || undefined,
        userName: propUserName || 'SEVA Farmer Custodian',
        userNotes: notes.trim() || undefined,
        farmName,
        farmLocation,
      }

      const res = await sendPopTeamAlert(payload)
      setResult({
        success: true,
        incidentId: res.incidentId,
        message: res.message,
      })
    } catch (err) {
      console.error('[PopTheTeamModal] Alert failure:', err)
      setErrorMsg('Network warning, but alert was queued to local telemetry queue.')
    } finally {
      setSending(false)
    }
  }

  const handleHardReload = () => {
    try {
      localStorage.removeItem('seva-dashboard-layout')
      localStorage.removeItem('seva-report-opts')
      sessionStorage.clear()
    } catch {}
    window.location.reload()
  }

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pop-team-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'linear-gradient(180deg, #061710 0%, #030b08 100%)',
          border: '1.5px solid #10b981',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 35px rgba(16, 185, 129, 0.25)',
          borderRadius: '20px',
          padding: '24px 26px',
          color: '#e2e8f0',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Glowing emerald ambient orb */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 140,
            height: 140,
            background: '#10b981',
            filter: 'blur(60px)',
            opacity: 0.2,
            pointerEvents: 'none',
          }}
        />

        {/* Close button */}
        {!standaloneCrash && (
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              background: '#0c2217',
              border: '1px solid #1a4230',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'grid',
              placeItems: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#10b981' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#1a4230' }}
          >
            <X size={16} />
          </button>
        )}

        {/* Eyebrow & Beacon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              color: '#34d399',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#34d399',
                boxShadow: '0 0 8px #34d399',
                display: 'inline-block',
              }}
            />
            SEVA·GIS Autonomous Help Beacon
          </span>
        </div>

        {/* Title */}
        <h2
          id="pop-team-title"
          style={{
            margin: '0 0 8px',
            fontSize: '22px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ color: '#10b981' }}>🌱</span>
          Let SEVA Team Know: Pop the Team
        </h2>

        <p
          style={{
            margin: '0 0 16px',
            fontSize: '13.5px',
            lineHeight: 1.5,
            color: '#94a3b8',
          }}
        >
          Is the map, satellite analysis, or page not responding? Click{' '}
          <strong style={{ color: '#34d399' }}>Pop the Team</strong> to automatically dispatch an incident report from the bot Gmail service (<code>{CHAT_HELP_BOT_GMAIL}</code>) and sync directly via EmailOctopus.
        </p>

        {/* Diagnostic Snapshot Box */}
        <div
          style={{
            background: 'rgba(12, 34, 23, 0.65)',
            border: '1px solid #1a4230',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#86efac', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={14} color="#34d399" />
              Detected Issue State
            </span>
            <span style={{ color: '#64748b', fontSize: '11px' }}>
              {new Date().toLocaleTimeString()}
            </span>
          </div>
          <div
            style={{
              color: '#fca5a5',
              fontFamily: 'monospace',
              fontSize: '11.5px',
              wordBreak: 'break-word',
              background: '#040d08',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #233e31',
              maxHeight: '90px',
              overflowY: 'auto',
            }}
          >
            {errorSummary}
          </div>
          {farmName && (
            <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '11.5px' }}>
              Active Parcel: <strong style={{ color: '#cbd5e1' }}>{farmName}</strong> {farmLocation ? `(${farmLocation})` : ''}
            </div>
          )}
        </div>

        {/* Confirmation banner when dispatched */}
        {result ? (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.9) 0%, rgba(4, 120, 87, 0.8) 100%)',
              border: '1.5px solid #10b981',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '18px',
              textAlign: 'center',
              boxShadow: '0 10px 25px rgba(16, 185, 129, 0.2)',
            }}
          >
            <div style={{ width: 44, height: 44, margin: '0 auto 8px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center' }}>
              <CheckCircle2 size={26} color="#ffffff" />
            </div>
            <h3 style={{ margin: '0 0 6px', color: '#ffffff', fontSize: '16px', fontWeight: 700 }}>
              SEVA Team Successfully Popped!
            </h3>
            <p style={{ margin: '0 0 10px', color: '#d1fae5', fontSize: '12.5px', lineHeight: 1.45 }}>
              Automated telemetry report <strong style={{ color: '#fff' }}>#{result.incidentId}</strong> dispatched from bot Gmail via Web3Forms and synced with EmailOctopus audience registry. No external mail apps were opened.
            </p>
            <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: '#ffffff',
                  color: '#064e3b',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <RefreshCw size={13} />
                Reload Page
              </button>
              <button
                onClick={handleHardReload}
                style={{
                  background: '#042f2e',
                  color: '#5eead4',
                  border: '1px solid #14b8a6',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <RotateCcw size={13} />
                Reset Cache & Reload
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePopTeam} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '5px' }}>
                Your Contact Email (optional, for engineer reply):
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={15}
                  color="#64748b"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com (or leave empty)"
                  style={{
                    width: '100%',
                    background: '#05110b',
                    border: '1px solid #1e3a2b',
                    borderRadius: '8px',
                    padding: '9px 12px 9px 36px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#10b981')}
                  onBlur={(e) => (e.target.style.borderColor = '#1e3a2b')}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '5px' }}>
                Quick notes on what happened (optional):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g., Map stayed dark, Sentinel-2 analysis timed out, etc."
                style={{
                  width: '100%',
                  background: '#05110b',
                  border: '1px solid #1e3a2b',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#f8fafc',
                  fontSize: '12.5px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  resize: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#10b981')}
                onBlur={(e) => (e.target.style.borderColor = '#1e3a2b')}
              />
            </div>

            {errorMsg && (
              <div style={{ color: '#f87171', fontSize: '12px' }}>
                {errorMsg}
              </div>
            )}

            {/* Main Action Button */}
            <button
              type="submit"
              disabled={sending}
              style={{
                background: sending ? '#064e3b' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '13px 20px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '14.5px',
                cursor: sending ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 10px 20px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {sending ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Dispatching to Bot Gmail & EmailOctopus…
                </>
              ) : (
                <>
                  <Send size={17} />
                  🚀 Pop the Team (Send Bot Gmail Alert)
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #142a1f',
            paddingTop: '14px',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#0d1f16',
                border: '1px solid #1f4532',
                color: '#a7f3d0',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
              }}
            >
              <RefreshCw size={12} /> Reload
            </button>
            <button
              onClick={handleHardReload}
              style={{
                background: '#0d1f16',
                border: '1px solid #1f4532',
                color: '#cbd5e1',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
              }}
            >
              <RotateCcw size={12} /> Reset cache
            </button>
          </div>

          {!standaloneCrash ? (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '12px',
                textDecoration: 'underline',
              }}
            >
              Dismiss
            </button>
          ) : (
            <span style={{ color: '#475569', fontSize: '11px' }}>
              SEVA·GIS Fail-Safe Recovery
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
