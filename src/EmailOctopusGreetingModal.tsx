import React from 'react'
import {
  CheckCircle2,
  Download,
  Mail,
  X,
  FileText,
  Sparkles,
  ShieldCheck,
  HeartHandshake
} from 'lucide-react'
import { EMAIL_OCTOPUS_CONFIG } from './lib/emailOctopus'

interface EmailOctopusGreetingModalProps {
  isOpen: boolean
  onClose: () => void
  recipientEmail: string
  farmName: string
  custodianName?: string
  reportId: string
  filename: string
  htmlContent: string
  areaHa?: number
  ndvi?: number
  ndmi?: number
  contactId?: string
}

export default function EmailOctopusGreetingModal({
  isOpen,
  onClose,
  recipientEmail,
  farmName,
  custodianName,
  reportId,
  filename,
  htmlContent,
  areaHa = 2.0,
  ndvi = 0.65,
  ndmi = 0.32,
  contactId,
}: EmailOctopusGreetingModalProps) {
  if (!isOpen) return null

  const handleDownloadAttachment = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `${farmName}_SEVA_GIS_Report.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const nameDisplay = custodianName && custodianName !== 'Guest' ? custodianName : 'Agro-Geospatial Custodian'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(16, 185, 129, 0.2)',
          border: '2px solid #059669',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            color: '#ffffff',
            zIndex: 10,
          }}
          title="Close Modal"
        >
          <X size={18} />
        </button>

        {/* Header Ribbon */}
        <div
          style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 55%, #10b981 100%)',
            padding: '26px 24px 22px',
            color: '#ffffff',
            borderTopLeftRadius: '18px',
            borderTopRightRadius: '18px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.22)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <HeartHandshake size={24} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                EmailOctopus Dispatch Greeting
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', opacity: 0.95 }}>
                Official SEVA·GIS Multi-Spectral Agro-Geospatial Delivery
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: 600,
              marginTop: '4px',
            }}
          >
            <CheckCircle2 size={13} color="#a7f3d0" />
            <span>Dispatched successfully to {recipientEmail}</span>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '22px 24px' }}>
          {/* Greeting Card Certificate Box */}
          <div
            style={{
              background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
              border: '1.5px solid #10b981',
              borderRadius: '14px',
              padding: '20px',
              marginBottom: '18px',
              position: 'relative',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.08)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-11px',
                right: '18px',
                background: '#047857',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '999px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              EmailOctopus Verified
            </div>

            <div style={{ fontSize: '15px', fontWeight: 800, color: '#064e3b', marginBottom: '6px' }}>
              Dear Custodian {nameDisplay},
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '13px', lineHeight: 1.55, color: '#334155' }}>
              Warm greetings from <b>SEVA·GIS</b>! Your official spatial evaluation dossier for study area <b>{farmName}</b> has been generated with selfless service. Our automated cloud dispatch has synchronized your profile with our EmailOctopus list and delivered the calibrated Sentinel-2 BOA satellite and hydrological telemetry.
            </p>

            {/* Quick Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #d1fae5', borderRadius: '8px', padding: '8px 10px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Canopy Vigor (NDVI)</span>
                <strong style={{ fontSize: '15px', color: '#047857' }}>{ndvi.toFixed(2)}</strong>
                <span style={{ fontSize: '10.5px', color: '#10b981', display: 'block' }}>Robust Foliar Health</span>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #d1fae5', borderRadius: '8px', padding: '8px 10px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Canopy Water (NDMI)</span>
                <strong style={{ fontSize: '15px', color: '#0284c7' }}>{ndmi.toFixed(2)}</strong>
                <span style={{ fontSize: '10.5px', color: '#0ea5e9', display: 'block' }}>Adequate Cell Turgor</span>
              </div>
            </div>

            {/* Tagline Banner */}
            <div
              style={{
                background: '#ecfdf5',
                borderLeft: '3.5px solid #059669',
                padding: '9px 12px',
                fontSize: '12px',
                fontStyle: 'italic',
                color: '#065f46',
                borderRadius: '4px',
              }}
            >
              "{EMAIL_OCTOPUS_CONFIG.tagline}"
            </div>
          </div>

          {/* Attachment Download Box */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#0284c7" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                  Attached Standalone Dossier
                </span>
              </div>
              <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
                HTML Document
              </span>
            </div>

            <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '10px', wordBreak: 'break-all' }}>
              📄 <b>{filename || `${farmName}_SEVA_GIS_Report.html`}</b>
            </div>

            <button
              onClick={handleDownloadAttachment}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0369a1')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0284c7')}
            >
              <Download size={15} />
              <span>Download Dispatched Dossier Attachment</span>
            </button>
          </div>

          {/* Verification Protocol Details */}
          <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.5, marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857', fontWeight: 600, marginBottom: '2px' }}>
              <ShieldCheck size={14} />
              <span>EmailOctopus Subscriber List: {EMAIL_OCTOPUS_CONFIG.listId}</span>
            </div>
            <span>
              Contact ID: <code>{contactId || 'Registered & Active'}</code> · Tag: <code>SEVA-GIS-Report-Download</code>.
              Your official copy is in transit. If your inbox filters marketing communications, check your Updates folder or save the attached file directly above.
            </span>
          </div>

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 24px',
                borderRadius: '8px',
                border: 'none',
                background: '#047857',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(4, 120, 87, 0.25)',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
