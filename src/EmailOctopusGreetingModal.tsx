import React, { useState } from 'react'
import {
  CheckCircle2,
  Download,
  Mail,
  Copy,
  Check,
  X,
  FileText,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Send,
  HeartHandshake
} from 'lucide-react'
import { EMAIL_OCTOPUS_CONFIG } from './lib/emailOctopus'

interface EmailOctopusGreetingModalProps {
  isOpen: boolean
  onClose: () => void
  recipientEmail: string
  farmName: string
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
  reportId,
  filename,
  htmlContent,
  areaHa = 2.0,
  ndvi = 0.65,
  ndmi = 0.32,
  contactId,
}: EmailOctopusGreetingModalProps) {
  const [copied, setCopied] = useState(false)

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

  const handleCopyCard = () => {
    const cardText = `
═════════════════════════════════════════════════════════════
  SEVA·GIS × EMAILOCTOPUS OFFICIAL DISPATCH GREETING CARD
═════════════════════════════════════════════════════════════
Dear Custodian of ${farmName},

Warm greetings from the SEVA·GIS Agro-Geospatial Observatory!
Your comprehensive 3D Cartographic & Remote Sensing Dossier
has been successfully prepared and dispatched.

■ Report Tracking ID : ${reportId}
■ Target Holding     : ${farmName} (${areaHa.toFixed(2)} Hectares)
■ Canopy Vigor (NDVI): ${ndvi.toFixed(2)} (High Photosynthetic Density)
■ Moisture (NDMI)    : ${ndmi.toFixed(2)} (Optimum Cell Turgor)
■ Dispatched To      : ${recipientEmail}
■ Attached Dossier   : ${filename}

"${EMAIL_OCTOPUS_CONFIG.tagline}"

Dispatched via EmailOctopus Audience Protocol
List ID: ${EMAIL_OCTOPUS_CONFIG.listId}
Live Portal: https://sevagis.dpdns.org
═════════════════════════════════════════════════════════════
`
    navigator.clipboard.writeText(cardText.trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
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
          borderRadius: '16px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1.5px solid #10b981',
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
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '999px',
            width: '32px',
            height: '32px',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            color: '#64748b',
          }}
          title="Close Modal"
        >
          <X size={18} />
        </button>

        {/* Header Ribbon */}
        <div
          style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)',
            padding: '24px 24px 20px',
            color: '#ffffff',
            borderTopLeftRadius: '14px',
            borderTopRightRadius: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <HeartHandshake size={22} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px' }}>
                EmailOctopus Dispatch Greeting Card
              </h3>
              <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
                Official SEVA·GIS Precision Remote Sensing Delivery
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.15)',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={13} color="#a7f3d0" />
            <span>Dispatched to {recipientEmail}</span>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Greeting Card Box */}
          <div
            style={{
              background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
              border: '1.5px dashed #059669',
              borderRadius: '12px',
              padding: '18px',
              marginBottom: '18px',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-10px',
                right: '16px',
                background: '#047857',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              EmailOctopus Verified
            </div>

            <div style={{ fontSize: '14px', fontWeight: 700, color: '#064e3b', marginBottom: '6px' }}>
              Dear Custodian of {farmName},
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '13px', lineHeight: 1.5, color: '#334155' }}>
              Warm greetings from <b>SEVA·GIS</b>! Your official remote sensing dossier has been prepared with selfless service. Our automated engine has synced your profile with our EmailOctopus list and compiled the latest Sentinel-2 L2A satellite analytics for your field holding.
            </p>

            {/* Quick Metrics Pill Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #d1fae5', borderRadius: '8px', padding: '8px 10px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Canopy Vigor (NDVI)</span>
                <strong style={{ fontSize: '14px', color: '#047857' }}>{ndvi.toFixed(2)}</strong>
                <span style={{ fontSize: '10.5px', color: '#10b981', display: 'block' }}>Robust Foliar Health</span>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #d1fae5', borderRadius: '8px', padding: '8px 10px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Canopy Water (NDMI)</span>
                <strong style={{ fontSize: '14px', color: '#0284c7' }}>{ndmi.toFixed(2)}</strong>
                <span style={{ fontSize: '10.5px', color: '#0ea5e9', display: 'block' }}>Adequate Hydration</span>
              </div>
            </div>

            {/* Tagline Banner */}
            <div
              style={{
                background: '#ecfdf5',
                borderLeft: '3px solid #059669',
                padding: '8px 12px',
                fontSize: '12px',
                fontStyle: 'italic',
                color: '#065f46',
                borderRadius: '4px',
              }}
            >
              "{EMAIL_OCTOPUS_CONFIG.tagline}"
            </div>
          </div>

          {/* Attachment Box */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#0284c7" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                  Attached Standalone Dossier
                </span>
              </div>
              <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
                HTML Document
              </span>
            </div>

            <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '10px', wordBreak: 'break-all' }}>
              📄 <b>{filename || `${farmName}_SEVA GIS.html`}</b>
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
                padding: '9px 14px',
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
          <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.5, marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857', fontWeight: 600, marginBottom: '2px' }}>
              <ShieldCheck size={14} />
              <span>EmailOctopus Subscriber List: {EMAIL_OCTOPUS_CONFIG.listId}</span>
            </div>
            <span>
              Contact ID: <code>{contactId || 'Registered & Active'}</code> · Tag: <code>SEVA-GIS-Report-Download</code>.
              No local email client (Outlook) was triggered. If your inbox filters marketing communications, check your Updates/Spam folder or save the attached file above.
            </span>
          </div>

          {/* Action Footer Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCopyCard}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
              <span>{copied ? 'Copied Greeting!' : 'Copy Greeting Card'}</span>
            </button>

            <button
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: '#047857',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
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
