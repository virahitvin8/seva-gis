/**
 * EmailOctopus Integration for SEVA·GIS Report Delivery & Audience Sync
 *
 * All credentials come from the environment (.env, gitignored). The list ID
 * previously hardcoded here made unconfigured builds look subscribed to a live
 * list, so it is only used when VITE_EMAIL_OCTOPUS_LIST_ID is actually set.
 */

// Credentials must live in .env (gitignored). Never commit API keys.
const env = import.meta.env as Record<string, string | undefined>

export const EMAIL_OCTOPUS_CONFIG = {
  apiKey: env.VITE_EMAIL_OCTOPUS_API_KEY ?? '',
  listId: env.VITE_EMAIL_OCTOPUS_LIST_ID ?? '',
  tagline: 'Thank you for using SEVA·GIS! Visit again, see again — Earth intelligence in the spirit of selfless service.',
}

export interface SyncEmailOctopusParams {
  email: string
  farmName: string
  reportId?: string
  areaHa?: number
  ndvi?: number
  ndmi?: number
  filename?: string
  htmlContent?: string
}

export interface EmailOctopusResult {
  success: boolean
  id?: string
  message: string
  tagline: string
  filename?: string
  greetingCardHtml?: string
}

/**
 * Generate formatted standalone HTML EmailOctopus Greeting Card
 */
export function generateEmailOctopusGreetingCardHtml(params: {
  email: string
  farmName: string
  reportId: string
  areaHa?: number
  ndvi?: number
  ndmi?: number
  filename?: string
}): string {
  const { email, farmName, reportId, areaHa, ndvi, ndmi, filename } = params
  const tagline = EMAIL_OCTOPUS_CONFIG.tagline

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SEVA·GIS × EmailOctopus Greeting Card</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1.5px solid #10b981; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%); padding: 32px 24px; color: #ffffff; text-align: center; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }
    .body { padding: 28px 24px; }
    .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
    .metric-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px; }
    .tagline-box { background: #ecfdf5; border-left: 4px solid #059669; padding: 12px 16px; font-style: italic; color: #065f46; margin: 20px 0; border-radius: 4px; }
    .attachment-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-top: 20px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 11.5px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">● SEVA·GIS Report Package</div>
      <h1 style="margin: 0; font-size: 24px;">SEVA·GIS Earth Intelligence Greeting</h1>
      <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Agro-geospatial remote sensing reports</p>
    </div>
    <div class="body">
      <h2 style="font-size: 18px; color: #064e3b; margin-top: 0;">Dear Member,</h2>
      <p style="margin: 4px 0 0; font-size: 13px; color: #047857;">Selected area of interest: ${farmName}</p>
      <p style="line-height: 1.6; font-size: 14px; color: #334155;">
        Warm greetings from SEVA·GIS. Your report package for the selected area of interest has been
        prepared from the loaded Sentinel-2 L2A scene. Review the readings below and keep the attached
        dossier for your records.
      </p>

      <div class="metric-grid">
        <div class="metric-box">
          <div style="font-size: 12px; color: #64748b;">Canopy Greenness (NDVI)</div>
          <div style="font-size: 20px; font-weight: bold; color: #047857;">${ndvi !== undefined ? ndvi.toFixed(2) : '—'}</div>
          <div style="font-size: 11px; color: #10b981;">Scene reading</div>
        </div>
        <div class="metric-box">
          <div style="font-size: 12px; color: #64748b;">Moisture Reading (NDMI)</div>
          <div style="font-size: 20px; font-weight: bold; color: #0284c7;">${ndmi !== undefined ? ndmi.toFixed(2) : '—'}</div>
          <div style="font-size: 11px; color: #0ea5e9;">From bands B08 &amp; B11</div>
        </div>
      </div>

      <div class="tagline-box">
        "${tagline}"
      </div>

      <div class="attachment-box">
        <div style="font-weight: 600; font-size: 13.5px; color: #0f172a; margin-bottom: 4px;">
          📎 Attached Dossier Document:
        </div>
        <div style="font-size: 13px; color: #475569; word-break: break-all;">
          <b>${filename || `${farmName}_SEVA_GIS_Report.html`}</b>
        </div>
        <div style="font-size: 11.5px; color: #94a3b8; margin-top: 4px;">
          Report ID: ${reportId} · Area: ${areaHa !== undefined ? `${areaHa.toFixed(2)} ha` : 'not measured'}
        </div>
      </div>
    </div>
    <div class="footer">
      Generated in SEVA·GIS · Precision agriculture reports<br>
      Live Cloud Platform: <a href="https://sevagis.dpdns.org" style="color: #047857;">https://sevagis.dpdns.org</a>
    </div>
  </div>
</body>
</html>
`.trim()
}

/**
 * Synchronizes user email with EmailOctopus and packages report delivery.
 * IMPORTANT: Strictly avoids launching mailto: / Outlook or any external OS popup.
 */
export async function syncAndSendViaEmailOctopus(params: SyncEmailOctopusParams): Promise<EmailOctopusResult> {
  const { email, farmName, reportId, areaHa, ndvi, ndmi, filename, htmlContent } = params
  const tagline = EMAIL_OCTOPUS_CONFIG.tagline
  const resolvedReportId = reportId || 'not generated'
  const resolvedFilename = filename || `${farmName}_SEVA_GIS_Report.html`

  if (!email || !email.includes('@')) {
    return {
      success: false,
      message: 'Please provide a valid recipient email address.',
      tagline,
      filename: resolvedFilename,
    }
  }

  const greetingCardHtml = generateEmailOctopusGreetingCardHtml({
    email,
    farmName,
    reportId: resolvedReportId,
    areaHa,
    ndvi,
    ndmi,
    filename: resolvedFilename,
  })

  // 1. Send via local server endpoint (handles EmailOctopus API + server-side dispatch)
  try {
    const srvRes = await fetch('/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        farmName,
        reportId: resolvedReportId,
        tagline,
        filename: resolvedFilename,
        htmlContent,
        greetingCardHtml,
        apiKey: EMAIL_OCTOPUS_CONFIG.apiKey,
        listId: EMAIL_OCTOPUS_CONFIG.listId,
        metrics: {
          areaHa: areaHa ?? null,
          ndvi: ndvi ?? null,
          ndmi: ndmi ?? null,
        },
      }),
    }).catch(() => null)

    if (srvRes && srvRes.ok) {
      const data = await srvRes.json()
      return {
        success: true,
        id: data.contactId || data.id,
        message: data.message || `Dossier and EmailOctopus greeting card dispatched to ${email}!`,
        tagline,
        filename: resolvedFilename,
        greetingCardHtml,
      }
    }
  } catch (srvErr) {
    console.info('[EmailOctopus] Server route notice:', srvErr)
  }

  // 2. Direct browser sync to EmailOctopus API v1.6 — only when a list is configured
  if (EMAIL_OCTOPUS_CONFIG.apiKey && EMAIL_OCTOPUS_CONFIG.listId) {
    try {
      const eoRes = await fetch(
        `https://emailoctopus.com/api/1.6/lists/${EMAIL_OCTOPUS_CONFIG.listId}/contacts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: EMAIL_OCTOPUS_CONFIG.apiKey,
            email_address: email,
            fields: {
              FirstName: farmName || 'SEVA Farmer',
            },
            tags: ['SEVA-GIS-Report-Download'],
            status: 'SUBSCRIBED',
          }),
        }
      ).catch(() => null)

      if (eoRes) {
        const eoJson = await eoRes.json().catch(() => null)
        if (eoRes.ok && eoJson?.id) {
          return {
            success: true,
            id: eoJson.id,
            message: `Dossier and EmailOctopus greeting card registered for ${email}!`,
            tagline,
            filename: resolvedFilename,
            greetingCardHtml,
          }
        }

        if (eoJson?.error?.code === 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
          return {
            success: true,
            message: `Email address already present on the configured EmailOctopus list.`,
            tagline,
            filename: resolvedFilename,
            greetingCardHtml,
          }
        }
      }
    } catch (eoErr) {
      console.warn('[EmailOctopus] Direct sync notice:', eoErr)
    }
  }

  // 3. No channel confirmed delivery. Report that honestly — the package itself
  // is still ready in the report panel for download or manual sending.
  return {
    success: false,
    message: EMAIL_OCTOPUS_CONFIG.apiKey && EMAIL_OCTOPUS_CONFIG.listId
      ? `Email dispatch could not be confirmed for ${email}. Use "Download Dossier" to save the package.`
      : 'Email delivery is not configured on this deployment. The report package is ready to download from the report panel.',
    tagline,
    filename: resolvedFilename,
    greetingCardHtml,
  }
}
