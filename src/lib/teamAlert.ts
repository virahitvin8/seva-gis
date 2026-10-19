/**
 * SEVA·GIS Automated Team Alert Dispatcher ("Pop the Team")
 * Dispatches automated diagnostic incident alerts from the SEVA bot Gmail service
 * via Web3Forms (chat help section key), FormSubmit, and EmailOctopus.
 * 
 * Strictly avoids launching external OS mail clients (mailto: / Outlook).
 */

import { EMAIL_OCTOPUS_CONFIG } from './emailOctopus'

export const CHAT_HELP_BOT_GMAIL = 'akshitvinay4636@gmail.com'
export const WEB3FORMS_ACCESS_KEY = '9d66d425-b661-4b50-b09e-929f493eb635'

export interface PopTeamPayload {
  reason?: string
  error?: Error | string | null
  stack?: string
  url?: string
  userEmail?: string
  userName?: string
  userNotes?: string
  farmName?: string
  farmLocation?: string
  diagnostics?: Record<string, any>
}

export interface PopTeamResult {
  success: boolean
  incidentId: string
  dispatchedAt: string
  services: {
    web3forms: boolean
    formSubmit: boolean
    emailOctopus: boolean
  }
  message: string
}

/**
 * Gathers rich diagnostic environment snapshot
 */
export function getSystemDiagnosticSnapshot() {
  if (typeof window === 'undefined') return {}

  const nav = window.navigator as any
  const perf = window.performance as any

  return {
    url: window.location.href,
    userAgent: nav.userAgent,
    language: nav.language,
    online: nav.onLine,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${window.screen?.width}x${window.screen?.height}`,
    pixelRatio: window.devicePixelRatio,
    memory: (perf?.memory) ? {
      jsHeapSizeLimit: Math.round(perf.memory.jsHeapSizeLimit / 1048576) + 'MB',
      totalJSHeapSize: Math.round(perf.memory.totalJSHeapSize / 1048576) + 'MB',
      usedJSHeapSize: Math.round(perf.memory.usedJSHeapSize / 1048576) + 'MB',
    } : 'unavailable',
    connection: (nav?.connection) ? {
      effectiveType: nav.connection.effectiveType,
      downlink: nav.connection.downlink,
      rtt: nav.connection.rtt,
      saveData: nav.connection.saveData,
    } : 'unavailable',
    timestamp: new Date().toISOString(),
  }
}

/**
 * Autonomous background dispatcher when user clicks "Pop the Team"
 */
export async function sendPopTeamAlert(payload: PopTeamPayload): Promise<PopTeamResult> {
  const incidentId = `POP-${Date.now().toString(36).toUpperCase()}`
  const nowIso = new Date().toISOString()
  const snapshot = getSystemDiagnosticSnapshot()

  const errStr = payload.error instanceof Error
    ? `${payload.error.name}: ${payload.error.message}`
    : typeof payload.error === 'string'
      ? payload.error
      : 'General page dysfunction or lag reported by user'

  const stackStr = payload.stack || (payload.error instanceof Error ? payload.error.stack : '')

  const senderEmail = payload.userEmail?.trim() || CHAT_HELP_BOT_GMAIL
  const senderName = payload.userName?.trim() || 'SEVA·GIS Member'
  const reasonText = payload.reason || 'Page is not working / feature unresponsive'

  // Build structured Markdown diagnostic message for SEVA engineering team
  const messageBody = [
    `🚨 [SEVA·GIS INCIDENT ALERT: POP THE TEAM] 🚨`,
    `Incident Reference: ${incidentId}`,
    `Recorded At: ${nowIso}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📌 USER & CONTEXT`,
    `• Reporter: ${senderName} (${senderEmail})`,
    `• Page URL: ${payload.url || snapshot.url || window.location.href}`,
    `• Primary Concern / Reason: ${reasonText}`,
    payload.userNotes ? `• User's Notes: "${payload.userNotes}"` : null,
    payload.farmName ? `• Active Farm: ${payload.farmName} (${payload.farmLocation || 'coords'})` : null,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⚠️ ERROR & EXCEPTION TRACE`,
    `• Error Summary: ${errStr}`,
    stackStr ? `• Stack Trace:\n${stackStr.slice(0, 1500)}` : '• Stack Trace: [None recorded - page frozen/render stall]',
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🖥️ CLIENT TELEMETRY SNAPSHOT`,
    `• Viewport: ${snapshot.viewport}`,
    `• Screen: ${snapshot.screen} (DPR ${snapshot.pixelRatio})`,
    `• Network Status: ${snapshot.online ? 'Online' : 'Offline'}`,
    typeof snapshot.connection === 'object' ? `• Connection Quality: ${JSON.stringify(snapshot.connection)}` : null,
    typeof snapshot.memory === 'object' ? `• JS Heap: ${JSON.stringify(snapshot.memory)}` : null,
    `• User Agent: ${snapshot.userAgent}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Sent by the SEVA·GIS in-app incident reporter.`,
  ].filter(Boolean).join('\n')

  const results = {
    web3forms: false,
    formSubmit: false,
    emailOctopus: false,
  }

  // 1. Dispatch via Web3Forms (Chat Help Section Key)
  try {
    const w3Res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `[SEVA·GIS ALERT] Incident ${incidentId}: ${reasonText}`,
        from_name: 'SEVA·GIS Incident Bot',
        type: 'complaint',
        name: `SEVA Bot (${senderName})`,
        email: senderEmail,
        replyto: senderEmail,
        message: messageBody,
      }),
    }).catch(() => null)

    if (w3Res && w3Res.ok) {
      const w3Data = await w3Res.json().catch(() => ({}))
      if (w3Data.success) {
        results.web3forms = true
      }
    }
  } catch (w3Err) {
    console.warn('[PopTheTeam] Web3Forms dispatch warning:', w3Err)
  }

  // 2. Dispatch via FormSubmit AJAX fallback to bot Gmail
  try {
    const fsRes = await fetch(`https://formsubmit.co/ajax/${CHAT_HELP_BOT_GMAIL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        _subject: `[SEVA·GIS ALERT] Incident ${incidentId}: ${reasonText}`,
        _template: 'table',
        _captcha: 'false',
        type: 'incident_pop_team',
        incident_id: incidentId,
        name: senderName,
        email: senderEmail,
        message: messageBody,
      }),
    }).catch(() => null)

    if (fsRes && fsRes.ok) {
      const fsData = await fsRes.json().catch(() => ({}))
      if (fsData.success === true || fsData.success === 'true') {
        results.formSubmit = true
      }
    }
  } catch (fsErr) {
    console.warn('[PopTheTeam] FormSubmit dispatch warning:', fsErr)
  }

  // 2b. Guaranteed background hidden iframe FormSubmit (immune to browser CORS or anti-bot fetch restrictions)
  try {
    if (typeof document !== 'undefined') {
      const frameName = 'fs-pop-' + Date.now()
      const iframe = document.createElement('iframe')
      iframe.name = frameName
      iframe.style.display = 'none'

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = `https://formsubmit.co/${CHAT_HELP_BOT_GMAIL}`
      form.target = frameName
      form.style.display = 'none'

      const fields: Record<string, string> = {
        _subject: `[SEVA·GIS ALERT] Incident ${incidentId}: ${reasonText}`,
        _template: 'table',
        _captcha: 'false',
        type: 'pop_the_team_incident',
        incident_id: incidentId,
        name: senderName,
        email: senderEmail,
        message: messageBody,
      }

      Object.entries(fields).forEach(([k, v]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = k
        input.value = v
        form.appendChild(input)
      })

      document.body.appendChild(iframe)
      document.body.appendChild(form)
      form.submit()
      results.formSubmit = true

      setTimeout(() => {
        try {
          iframe.remove()
          form.remove()
        } catch {}
      }, 15000)
    }
  } catch (domErr) {
    console.warn('[PopTheTeam] Hidden form submit note:', domErr)
  }

  // 3. Dispatch & Sync with EmailOctopus ("eight octopus") — only when configured
  if (EMAIL_OCTOPUS_CONFIG.apiKey && EMAIL_OCTOPUS_CONFIG.listId) {
    try {
      const eoTargetEmail = senderEmail.includes('@') ? senderEmail : CHAT_HELP_BOT_GMAIL
      const eoRes = await fetch(
        `https://emailoctopus.com/api/1.6/lists/${EMAIL_OCTOPUS_CONFIG.listId}/contacts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: EMAIL_OCTOPUS_CONFIG.apiKey,
            email_address: eoTargetEmail,
            fields: {
              FirstName: senderName.slice(0, 30),
              LastName: `PopTeam-${incidentId}`,
            },
            tags: ['SEVA-INCIDENT-POP-TEAM', 'PAGE-NOT-WORKING'],
            status: 'SUBSCRIBED',
          }),
        }
      ).catch(() => null)

      if (eoRes) {
        const eoJson = await eoRes.json().catch(() => null)
        if (eoRes.ok || eoJson?.error?.code === 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
          results.emailOctopus = true
        }
      }
    } catch (eoErr) {
      console.warn('[PopTheTeam] EmailOctopus sync warning:', eoErr)
    }
  }

  // 4. Try local server route /api/send-report or /api/pop-team if available
  try {
    await fetch('/api/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'incident_pop_team',
        incidentId,
        senderEmail,
        message: messageBody,
      }),
    }).catch(() => null)
  } catch {}

  const confirmed = results.web3forms
  const attempted = confirmed || results.formSubmit || results.emailOctopus

  return {
    success: attempted,
    incidentId,
    dispatchedAt: nowIso,
    services: results,
    message: confirmed
      ? `SEVA team notified. Incident report #${incidentId} was delivered to the team inbox.`
      : attempted
        ? `Incident report #${incidentId} was submitted, but delivery could not be confirmed from the browser. If the problem continues, email ${CHAT_HELP_BOT_GMAIL} directly.`
        : `Incident report #${incidentId} could not be submitted from this browser. Please email ${CHAT_HELP_BOT_GMAIL} directly.`,
  }
}
