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
  const [showEmailField, setShowEmailField] = useState(false)
  const [notes, setNotes] = useState('')
  const [images, setImages] = useState<{ id: string; name: string; dataUrl: string }[]>([])
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

  const handleCaptureScreenshot = () => {
    try {
      const canvas = document.querySelector('.field-map canvas, .leaflet-pane canvas, .map-wrap canvas, canvas') as HTMLCanvasElement | null
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png')
        setImages(prev => [...prev, { id: 'map-' + Date.now(), name: 'Map-Snapshot.png', dataUrl }])
      } else {
        const c = document.createElement('canvas')
        c.width = 400
        c.height = 240
        const ctx = c.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#062017'
          ctx.fillRect(0, 0, 400, 240)
          ctx.fillStyle = '#10b981'
          ctx.font = 'bold 15px sans-serif'
          ctx.fillText('SEVA·GIS Diagnostic Snapshot', 20, 40)
          ctx.fillStyle = '#94a3b8'
          ctx.font = '12px sans-serif'
          ctx.fillText(`Recorded: ${new Date().toLocaleTimeString()}`, 20, 75)
          ctx.fillText(`Parcel: ${farmName || 'Active AOI'}`, 20, 105)
          ctx.fillText(`Issue: ${errorSummary.slice(0, 40)}`, 20, 135)
          setImages(prev => [...prev, { id: 'snap-' + Date.now(), name: 'Diagnostic-Snapshot.png', dataUrl: c.toDataURL('image/png') }])
        }
      }
    } catch (e) {
      console.warn('Screenshot error:', e)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !files.length) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        if (dataUrl) {
          setImages(prev => [...prev, { id: 'file-' + Date.now() + Math.random(), name: file.name, dataUrl }])
        }
      }
      reader.readAsDataURL(file)
    })
  }

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
        userName: propUserName || 'SEVA Member',
        userNotes: notes.trim() ? `${notes.trim()}${images.length ? ` (Attached ${images.length} image(s))` : ''}` : undefined,
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

  const handleDownloadReport = () => {
    const reportText = `SEVA·GIS AUTONOMOUS INCIDENT REPORT
Reference: POP-${Date.now().toString(36).toUpperCase()}
Timestamp: ${new Date().toISOString()}
Target: SEVA Engineering Team
Issue: ${errorSummary}
Farm/AOI: ${farmName || 'None'}
Location: ${farmLocation || 'Unknown'}
URL: ${typeof window !== 'undefined' ? window.location.href : ''}
User Notes: ${notes || 'None'}
Attached Images: ${images.length}
Stack Trace:
${stack || 'None'}`
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SEVA_GIS_Incident_${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm?fs=1&to=${encodeURIComponent(CHAT_HELP_BOT_GMAIL)}&su=${encodeURIComponent(`[SEVA·GIS ALERT] Incident: ${errorSummary.slice(0, 60)}`)}&body=${encodeURIComponent(`SEVA·GIS Team Incident Report\n\nIncident: ${errorSummary}\nParcel: ${farmName || 'AOI'}\nPage: ${typeof window !== 'undefined' ? window.location.href : ''}\nTime: ${new Date().toISOString()}\n\nUser Notes: ${notes || 'None'}\nAttached Images: ${images.length} image(s)\n\nStack:\n${stack ? stack.slice(0, 500) : 'None'}`)}`

  const mailtoUrl = `mailto:${CHAT_HELP_BOT_GMAIL}?subject=${encodeURIComponent(`[SEVA·GIS ALERT] Incident: ${errorSummary.slice(0, 60)}`)}&body=${encodeURIComponent(`SEVA·GIS Team Incident Report\n\nIncident: ${errorSummary}\nParcel: ${farmName || 'AOI'}\nPage: ${typeof window !== 'undefined' ? window.location.href : ''}\n\nUser Notes: ${notes || 'None'}`)}`

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
          <strong style={{ color: '#34d399' }}>Pop the Team</strong> to automatically alert the SEVA Engineering Team with live diagnostic telemetry and attached screenshots.
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
              SEVA Team Alert Dispatched!
            </h3>
            <p style={{ margin: '0 0 12px', color: '#d1fae5', fontSize: '12.5px', lineHeight: 1.45 }}>
              Automated telemetry report <strong style={{ color: '#fff' }}>#{result.incidentId}</strong> dispatched. To ensure 100% receipt or if you use personal email, choose an instant delivery option below:
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '14px' }}>
              <a
                href={gmailComposeUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: '#ea4335',
                  color: '#ffffff',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  textDecoration: 'none'
                }}
              >
                <ExternalLink size={12} /> Open in Gmail Web
              </a>
              <a
                href={mailtoUrl}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  textDecoration: 'none'
                }}
              >
                <Mail size={12} /> Mail App
              </a>
              <button
                type="button"
                onClick={handleDownloadReport}
                style={{
                  background: '#042f2e',
                  color: '#5eead4',
                  border: '1px solid #14b8a6',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                Download Report (.txt)
              </button>
            </div>
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
            {/* Image attachment section */}
            <div style={{ background: '#05140d', border: '1px dashed #1e4530', borderRadius: '10px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#86efac', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  📸 Attach Images ({images.length})
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={handleCaptureScreenshot}
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid #10b981',
                      color: '#a7f3d0',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    Capture Map
                  </button>
                  <label
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#e2e8f0',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      margin: 0,
                    }}
                  >
                    <span>+ Upload Image</span>
                    <input type="file" accept="image/*" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
              {images.length > 0 ? (
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {images.map(img => (
                    <div key={img.id} style={{ position: 'relative', flexShrink: 0, width: 68, height: 52, borderRadius: 6, overflow: 'hidden', border: '1px solid #10b981' }}>
                      <img src={img.dataUrl} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Click "Capture Map" to grab the current satellite view, or upload photos/screenshots of the issue.
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '5px' }}>
                Quick notes on what happened (optional):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g., Map stayed dark, Sentinel-2 analysis timed out, borewell not showing, etc."
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

            {showEmailField ? (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '5px' }}>
                  Contact Email (optional, for engineer reply):
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
                    placeholder="yourname@gmail.com"
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
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowEmailField(true)}
                style={{
                  alignSelf: 'flex-start',
                  background: 'none',
                  border: 'none',
                  color: '#6ee7b7',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  padding: '2px 0',
                  textDecoration: 'underline',
                }}
              >
                + Add contact email (optional)
              </button>
            )}

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
                  Dispatching Alert to SEVA Team…
                </>
              ) : (
                <>
                  <Send size={17} />
                  🚀 Pop the Team (Send Diagnostic Alert)
                </>
              )}
            </button>

            {/* Redundant one-click fallback for 100% receipt */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '11.5px', color: '#94a3b8' }}>
              <span>Can't wait?</span>
              <a href={gmailComposeUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <ExternalLink size={11} /> Open Directly in Gmail
              </a>
              <span>·</span>
              <button type="button" onClick={handleDownloadReport} style={{ background: 'none', border: 'none', color: '#6ee7b7', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
                Download .txt Report
              </button>
            </div>
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
