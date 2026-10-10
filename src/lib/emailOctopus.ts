/**
 * EmailOctopus Integration for SEVA·GIS Report Delivery & Audience Sync
 * List ID: 15e4d8e2-c4b5-11f1-8441-836e7cd382aa
 */

export const EMAIL_OCTOPUS_CONFIG = {
  apiKey: 'eo_5f948784821e2b4da262a423736cfe098e358a89fa382f7885f401126a997e58',
  listId: '15e4d8e2-c4b5-11f1-8441-836e7cd382aa',
  tagline: 'Thank you for using SEVA·GIS! Visit again, see again — Earth intelligence in the spirit of selfless service.',
}

export interface SyncEmailOctopusParams {
  email: string
  farmName: string
  reportId?: string
  areaHa?: number
  ndvi?: number
  filename?: string
  htmlContent?: string
}

export interface EmailOctopusResult {
  success: boolean
  id?: string
  message: string
  tagline: string
}

/**
 * Synchronizes user email with EmailOctopus and triggers report delivery
 */
export async function syncAndSendViaEmailOctopus(params: SyncEmailOctopusParams): Promise<EmailOctopusResult> {
  const { email, farmName, reportId, areaHa, ndvi, filename, htmlContent } = params
  const tagline = EMAIL_OCTOPUS_CONFIG.tagline

  if (!email || !email.includes('@')) {
    return {
      success: false,
      message: 'Please provide a valid email address.',
      tagline,
    }
  }

  // 1. Send via server endpoint (handles EmailOctopus API call + server-side email dispatch)
  try {
    const srvRes = await fetch('/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        farmName,
        reportId: reportId || `SEVA-${Date.now()}`,
        tagline,
        filename: filename || `(${farmName}_SEVA GIS).html`,
        htmlContent,
        apiKey: EMAIL_OCTOPUS_CONFIG.apiKey,
        listId: EMAIL_OCTOPUS_CONFIG.listId,
        metrics: {
          areaHa: areaHa ?? 0,
          ndvi: ndvi ?? 0,
        },
      }),
    }).catch(() => null)

    if (srvRes && srvRes.ok) {
      const data = await srvRes.json()
      return {
        success: true,
        id: data.contactId,
        message: data.message || `Dossier successfully dispatched to ${email}!`,
        tagline,
      }
    }
  } catch (srvErr) {
    console.info('[EmailOctopus] Server route unavailable, trying direct browser API:', srvErr)
  }

  // 2. Direct browser fallback to EmailOctopus API v1.6
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
    )

    const eoJson = await eoRes.json()
    if (eoRes.ok && eoJson?.id) {
      return {
        success: true,
        id: eoJson.id,
        message: `Report registered with EmailOctopus for ${email}!`,
        tagline,
      }
    }

    if (eoJson?.error?.code === 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
      return {
        success: true,
        message: `Existing EmailOctopus subscriber updated for ${email}!`,
        tagline,
      }
    }
  } catch (eoErr) {
    console.warn('[EmailOctopus] Direct sync call encountered network barrier:', eoErr)
  }

  // 3. Client mailto fallback with complete formatted dossier body & tagline
  const subject = encodeURIComponent(`SEVA·GIS Assessment Report: ${farmName}`)
  const body = encodeURIComponent(
    `Hello,\n\nPlease find the official SEVA·GIS Precision Remote Sensing & Hydrological Assessment Report for ${farmName}.\n\nReport ID: ${reportId}\nArea: ${areaHa?.toFixed(2) ?? '—'} ha\nNDVI: ${ndvi?.toFixed(2) ?? '—'}\n\n${tagline}\n\nGenerated via SEVA·GIS: https://sevagis.dpdns.org`
  )
  window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank')

  return {
    success: true,
    message: `Email client opened for ${email}!`,
    tagline,
  }
}
