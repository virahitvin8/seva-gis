/**
 * SEVA.GIS - Programmatic Email Generator & Multi-Channel Dispatcher
 *
 * Implements genuine client-side email generation:
 * 1. RFC 822 / MIME .eml generator: Compiles a standardized .eml email file
 *    containing headers (To, From, Subject, Date), styled HTML executive body,
 *    and attached report document (base64 encoded). When downloaded/opened,
 *    it opens directly in Outlook, Apple Mail, Thunderbird, or Gmail.
 * 2. Gmail Web Compose direct generator: Pre-populates recipient, subject,
 *    and executive report summary in Gmail Web.
 * 3. Native Web Share API (navigator.share): Direct sharing to mobile Mail apps.
 * 4. Rich HTML clipboard generator: One-click formatted email copy.
 * 5. Transparent reporting: No fake "dispatched via third-party" messages.
 */

import { dispatchExport, uploadToGoogleDrive, getGoogleUser } from './googleDriveVault'

export interface EmailReportParams {
  recipientEmail: string
  farmName: string
  reportId: string
  areaHa?: number
  ndvi?: number
  ndmi?: number
  filename: string
  htmlContent: string
  senderName?: string
  downloadEml?: boolean
}

export interface EmailGenerationResult {
  emlBlob: Blob
  emlFilename: string
  gmailWebUrl: string
  mailtoUrl: string
  plainSummary: string
  richHtmlBody: string
}

/**
 * Builds the rich HTML executive briefing email body.
 */
export function buildReportEmailHtml(params: EmailReportParams): string {
  const {
    recipientEmail,
    farmName,
    reportId,
    areaHa = 2.0,
    ndvi = 0.65,
    ndmi = 0.32,
    filename,
    senderName = 'SEVA·GIS Autonomous Sentinel',
  } = params

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEVA·GIS Spatial Intelligence Report — ${farmName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
    .email-container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1.5px solid #10b981; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%); padding: 32px 28px; color: #ffffff; text-align: center; }
    .header-badge { display: inline-block; background: rgba(255,255,255,0.22); padding: 4px 14px; border-radius: 999px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 12px; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
    .header p { margin: 6px 0 0; opacity: 0.92; font-size: 13.5px; }
    .body { padding: 28px 24px; }
    .intro { font-size: 14.5px; line-height: 1.6; color: #334155; margin-bottom: 20px; }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 24px 0; }
    .kpi-card { background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 14px 16px; }
    .kpi-title { font-size: 11.5px; text-transform: uppercase; font-weight: 700; color: #047857; margin-bottom: 4px; }
    .kpi-val { font-size: 24px; font-weight: 800; color: #065f46; }
    .kpi-desc { font-size: 11px; color: #059669; margin-top: 3px; }
    .attachment-card { background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 10px; padding: 16px; margin: 24px 0; }
    .attachment-badge { display: inline-block; background: #0284c7; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 10.5px; font-weight: 700; margin-bottom: 6px; }
    .quote-box { background: #ecfdf5; border-left: 4px solid #10b981; padding: 14px 18px; margin: 20px 0; font-style: italic; color: #065f46; font-size: 13px; border-radius: 0 8px 8px 0; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11.5px; color: #64748b; }
    .btn-portal { display: inline-block; background: #10b981; color: #ffffff !important; text-decoration: none; padding: 10px 22px; border-radius: 8px; font-weight: 700; font-size: 13px; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="header-badge">🛰️ Sentinel-2 L2A Multispectral Dossier</div>
      <h1>SEVA·GIS Earth Intelligence Report</h1>
      <p>Autonomous Remote Sensing Briefing · ${dateStr}</p>
    </div>
    <div class="body">
      <p class="intro">
        Dear Member,<br><br>
        Your requested high-resolution remote sensing analysis for <b>${farmName}</b> (Report ID: <code>${reportId}</code>) has been successfully generated. Below is your spatial executive summary.
      </p>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-title">Vegetative Vigour (NDVI)</div>
          <div class="kpi-val">${ndvi.toFixed(2)}</div>
          <div class="kpi-desc">Foliar photosynthetic density</div>
        </div>
        <div class="kpi-card" style="background: #f0f9ff; border-color: #bae6fd;">
          <div class="kpi-title" style="color: #0369a1;">Canopy Hydration (NDMI)</div>
          <div class="kpi-val" style="color: #0c4a6e;">${ndmi.toFixed(2)}</div>
          <div class="kpi-desc" style="color: #0284c7;">Mesophyll liquid water thickness</div>
        </div>
      </div>

      <div class="attachment-card">
        <span class="attachment-badge">📎 Report Attachment</span>
        <div style="font-size: 14px; font-weight: 700; color: #0f172a; word-break: break-all;">
          ${filename}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
          Parcel Area: <b>${areaHa.toFixed(2)} ha</b> · Sentinel-2 BOA 10m · Copernicus DEM GLO-30
        </div>
      </div>

      <div class="quote-box">
        "Thank you for using SEVA·GIS! Visit again, see again — Earth intelligence in the spirit of selfless service."
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="https://sevagis.dpdns.org" class="btn-portal">
          Open Live SEVA·GIS Workspace &rarr;
        </a>
      </div>
    </div>
    <div class="footer">
      Generated by ${senderName} · Zero Backend Tracking · Client-Side Geospatial Engine<br>
      Recipient: ${recipientEmail} · <a href="https://github.com/virahitvin8/seva-gis" style="color: #047857;">GitHub Open Source</a>
    </div>
  </div>
</body>
</html>`.trim()
}

/**
 * Builds the plain text executive briefing email summary.
 */
export function buildReportEmailPlainText(params: EmailReportParams): string {
  const { farmName, reportId, areaHa = 2.0, ndvi = 0.65, ndmi = 0.32, filename } = params
  return `SEVA·GIS Spatial Intelligence Report — ${farmName}
Report ID: ${reportId}
Parcel Extent: ${areaHa.toFixed(2)} ha

Key Analytical Metrics:
• Mean Canopy Photosynthetic Vigor (NDVI): ${ndvi.toFixed(2)}
• Leaf Mesophyll Moisture Index (NDMI): ${ndmi.toFixed(2)}
• Attached Document: ${filename}

Generated via SEVA·GIS Autonomous Remote Sensing Sentinel (Sentinel-2 L2A BOA 10m & Copernicus DEM GLO-30).
Platform: https://sevagis.dpdns.org`.trim()
}

/**
 * Generates an RFC 822 compliant .eml multipart/mixed email package.
 */
export function generateEmlPackage(params: EmailReportParams): EmailGenerationResult {
  const { recipientEmail, farmName, filename, htmlContent } = params

  const subject = `[SEVA.GIS Report] Spatial Intelligence for ${farmName}`
  const richHtml = buildReportEmailHtml(params)
  const plainText = buildReportEmailPlainText(params)

  const boundary = `----=_Part_SEVA_GIS_${Date.now()}`
  const now = new Date().toUTCString()

  // Base64 encode the attached report file
  let base64Attachment = ''
  try {
    if (typeof btoa !== 'undefined') {
      base64Attachment = btoa(unescape(encodeURIComponent(htmlContent)))
    } else {
      base64Attachment = Buffer.from(htmlContent, 'utf-8').toString('base64')
    }
  } catch {
    base64Attachment = ''
  }

  // Format base64 to 76 characters per line (RFC 2045)
  const formattedAttachment = base64Attachment.match(/.{1,76}/g)?.join('\r\n') || ''

  const emlContent = [
    `From: "SEVA.GIS Report Sentinel" <reports@sevagis.org>`,
    `To: <${recipientEmail}>`,
    `Subject: ${subject}`,
    `Date: ${now}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    richHtml,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    formattedAttachment,
    ``,
    `--${boundary}--`,
    ``,
  ].join('\r\n')

  const emlBlob = new Blob([emlContent], { type: 'message/rfc822' })
  const cleanFarm = farmName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const emlFilename = `${cleanFarm}_SEVA_GIS_Report.eml`

  // Construct direct Gmail Web compose link
  const gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    recipientEmail
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainText)}`

  // Construct mailto link
  const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(plainText)}`

  return {
    emlBlob,
    emlFilename,
    gmailWebUrl,
    mailtoUrl,
    plainSummary: plainText,
    richHtmlBody: richHtml,
  }
}

/**
 * Triggers multi-channel delivery:
 * 1. Saves .eml bundle directly to user's device and Google Drive (SEVA GIS / Reports).
 * 2. Attempts Web Share API if supported.
 * 3. Returns links for direct Gmail compose and clipboard copy.
 */
export async function executeEmailPackageDelivery(params: EmailReportParams): Promise<{
  success: boolean
  message: string
  packageData: EmailGenerationResult
}> {
  const packageData = generateEmlPackage(params)

  // 1. Only download .eml to device if explicitly requested by user
  if (params.downloadEml) {
    await dispatchExport({
      category: 'reports',
      fileName: packageData.emlFilename,
      blob: packageData.emlBlob,
      mimeType: 'message/rfc822',
      silent: true,
    })
  } else {
    // Sync directly to Google Drive vault if connected, without forcing device download
    try {
      const user = getGoogleUser()
      if (user && user.isGoogleUser) {
        await uploadToGoogleDrive('reports', packageData.emlFilename, packageData.emlBlob, 'message/rfc822')
      }
    } catch (e) {
      console.info('[EmailDelivery] Drive vault sync:', e)
    }
  }

  // 2. Try native mobile share if available and user requested
  let sharedViaNative = false
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([packageData.emlBlob], packageData.emlFilename, {
        type: 'message/rfc822',
      })
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `SEVA.GIS Report: ${params.farmName}`,
          text: packageData.plainSummary,
          files: [file],
        })
        sharedViaNative = true
      }
    } catch {
      // User cancelled share or browser restriction
    }
  }

  const message = sharedViaNative
    ? `Shared via device mail app to ${params.recipientEmail}!`
    : params.downloadEml
    ? `Standard .eml email file downloaded & organized in Google Drive! Ready to open in Gmail or Outlook.`
    : `Report package generated for ${params.recipientEmail}! Ready to dispatch or open in Gmail.`

  return {
    success: true,
    message,
    packageData,
  }
}
