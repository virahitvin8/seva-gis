import { useMemo, useState } from 'react'
import { Mail, MessageSquare, Share2, Check, Copy, ExternalLink, Download, Send } from 'lucide-react'
import type { FarmData } from './lib/seva'
import FarmerSmsWhatsAppDispatch from './components/FarmerSmsWhatsAppDispatch'
import { sendReportDirectToEmail, type DirectEmailResponse } from './lib/directEmailService'

type Props = {
  farm: FarmData & { id: string; name: string; crop?: string; status?: string }
  farms: (FarmData & { id: string; name: string; crop?: string; status?: string })[]
  onImportBackup?: (farms: any[]) => void
}

export default function ProGisExport({ farm }: Props) {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [mailResult, setMailResult] = useState<DirectEmailResponse | null>(null)
  const [mailError, setMailError] = useState('')
  const [copiedSummary, setCopiedSummary] = useState(false)

  const summaryHtml = useMemo(() => {
    const ndvi = farm.analysis?.ndvi?.mean !== undefined ? farm.analysis.ndvi.mean.toFixed(2) : 'Unavailable'
    const ndmi = farm.analysis?.ndmi?.mean !== undefined ? farm.analysis.ndmi.mean.toFixed(2) : 'Unavailable'
    const sceneDate = farm.analysis?.scene?.datetime?.slice(0, 10) || 'Latest available'
    return `
      <div style="font-family:system-ui,sans-serif;max-width:600px;color:#0f172a">
        <h2 style="color:#059669;margin-bottom:6px">SEVA·GIS Field Condition Summary — ${farm.name}</h2>
        <p style="color:#475569;margin-top:0">Location: ${farm.lat.toFixed(5)}°, ${farm.lon.toFixed(5)}° · Area: ${(farm.area || 0).toFixed(2)} ha · Sentinel-2 Date: ${sceneDate}</p>
        <table style="border-collapse:collapse;width:100%;margin-top:12px">
          <tr><td style="padding:8px;border:1px solid #cbd5e1"><b>Vegetation Vigor (NDVI)</b></td><td style="padding:8px;border:1px solid #cbd5e1">${ndvi}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1"><b>Canopy Moisture (NDMI)</b></td><td style="padding:8px;border:1px solid #cbd5e1">${ndmi}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1"><b>Status</b></td><td style="padding:8px;border:1px solid #cbd5e1">${farm.status || 'Observed'}</td></tr>
        </table>
      </div>
    `
  }, [farm])

  const whatsappSummaryText = useMemo(() => {
    const ndvi = farm.analysis?.ndvi?.mean !== undefined ? farm.analysis.ndvi.mean.toFixed(2) : 'Unavailable'
    const ndmi = farm.analysis?.ndmi?.mean !== undefined ? farm.analysis.ndmi.mean.toFixed(2) : 'Unavailable'
    return `*SEVA·GIS Field Update — ${farm.name}*\nArea: ${(farm.area || 0).toFixed(2)} ha\nLocation: ${farm.lat.toFixed(5)}°, ${farm.lon.toFixed(5)}°\nVegetation (NDVI): ${ndvi}\nCanopy Moisture (NDMI): ${ndmi}\nStatus: ${farm.status || 'Observed'}\nhttps://sevagis.dpdns.org`
  }, [farm])

  async function handleDirectEmailSend(e: React.FormEvent) {
    e.preventDefault()
    setMailError('')
    setMailResult(null)
    setSendingEmail(true)
    try {
      const res = await sendReportDirectToEmail({
        recipientEmail: recipientEmail.trim(),
        farmName: farm.name,
        reportId: `seva-${farm.id}-${Date.now()}`,
        areaHa: farm.area || 0,
        ndvi: farm.analysis?.ndvi?.mean ?? 0,
        ndmi: farm.analysis?.ndmi?.mean ?? 0,
        format: 'pdf',
        filename: `${(farm.name || 'field').replace(/\W+/g, '_')}_summary.html`,
        htmlContent: summaryHtml,
      })
      setMailResult(res)
    } catch (err: any) {
      setMailError(err?.message || 'Unable to prepare email dispatch.')
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <section className="ag-card" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg, #fff)', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: 7, borderRadius: 8, background: '#ecfdf5', color: '#059669' }}>
            <MessageSquare size={19} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Farmer Advisory Dispatch · SMS, WhatsApp &amp; Email
            </h3>
            <span style={{ fontSize: 11.5, color: '#475569' }}>
              Share live field alerts and summaries directly with farmers or field staff
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappSummaryText)}`, '_blank', 'noopener,noreferrer')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
          >
            <Share2 size={15} /> Share to WhatsApp
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(whatsappSummaryText)
              setCopiedSummary(true)
              setTimeout(() => setCopiedSummary(false), 2000)
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
          >
            {copiedSummary ? <Check size={14} color="#059669" /> : <Copy size={14} />}
            <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
          </button>
        </div>
      </div>

      <div id="farmer-sms-dispatch-section" style={{ marginBottom: 16 }}>
        <FarmerSmsWhatsAppDispatch farm={farm} />
      </div>

      <div id="direct-mail-dispatch-section" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Mail size={16} color="#0284c7" />
          <b style={{ fontSize: 13.5, color: '#0f172a' }}>Direct Mail Dispatch</b>
          <span style={{ fontSize: 11, color: '#64748b' }}>Vercel Relay · SMTP · Gmail Web · .eml bundle</span>
        </div>
        <form onSubmit={handleDirectEmailSend} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="email"
            required
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="Recipient email (e.g. farmer@gmail.com)"
            style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', fontSize: 13 }}
          />
          <button
            type="submit"
            disabled={sendingEmail}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, background: '#0284c7', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: sendingEmail ? 'wait' : 'pointer' }}
          >
            <Send size={14} />
            <span>{sendingEmail ? 'Sending…' : 'Send Email Summary'}</span>
          </button>
        </form>

        {mailError && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626', fontWeight: 600 }} role="alert">{mailError}</div>
        )}

        {mailResult && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#ffffff', border: '1px solid #bae6fd', fontSize: 12, color: '#0f172a' }}>
            <div style={{ fontWeight: 700, color: mailResult.delivered ? '#15803d' : '#0369a1', marginBottom: 6 }}>
              {mailResult.message}
            </div>
            {mailResult.packageData && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a
                  href={mailResult.packageData.gmailWebUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' }}
                >
                  <ExternalLink size={13} /> Open in Gmail Web
                </a>
                <a
                  href={mailResult.packageData.mailtoUrl}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', fontWeight: 600, textDecoration: 'none' }}
                >
                  <Mail size={13} /> Phone Mail App
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const url = URL.createObjectURL(mailResult.packageData!.emlBlob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = mailResult.packageData!.emlFilename
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Download size={13} /> Download .eml
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
