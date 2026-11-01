/**
 * SEVA.GIS - Direct Automated Email Dispatch Service
 * Handles instant automatic delivery of spatial reports to recipient email addresses.
 * Sends attachments directly to recipient inboxes via backend SMTP/API without manual downloads.
 */

export interface DirectEmailPayload {
  recipientEmail: string
  farmName: string
  reportId: string
  areaHa?: number
  ndvi?: number
  ndmi?: number
  format: 'pdf' | 'html' | 'doc' | 'json' | 'zip' | 'md'
  filename: string
  htmlContent: string
  senderName?: string
  smtpConfig?: {
    host?: string
    port?: number
    user?: string
    pass?: string
    secure?: boolean
  }
}

export interface DirectEmailResponse {
  success: boolean
  delivered: boolean
  recipient: string
  format: string
  transport?: string
  message: string
  error?: string
}

const STORAGE_KEY_USER_EMAIL = 'seva_dispatch_user_email'
const STORAGE_KEY_SMTP_CONFIG = 'seva_dispatch_smtp_config'

const memStore = new Map<string, string>()

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key)
        if (val !== null) return val
      }
    } catch {}
    return memStore.get(key) ?? null
  },
  setItem: (key: string, val: string): void => {
    memStore.set(key, val)
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, val)
    } catch {}
  },
}

export function getStoredUserEmail(): string {
  return safeStorage.getItem(STORAGE_KEY_USER_EMAIL) || safeStorage.getItem('seva-user-email') || ''
}

export function saveStoredUserEmail(email: string): void {
  const clean = email.trim()
  safeStorage.setItem(STORAGE_KEY_USER_EMAIL, clean)
  safeStorage.setItem('seva-user-email', clean)
}

export function getStoredSmtpConfig(): { host: string; port: number; user: string; pass: string; secure: boolean } {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY_SMTP_CONFIG)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    host: '',
    port: 587,
    user: '',
    pass: '',
    secure: false,
  }
}

export function saveStoredSmtpConfig(config: { host: string; port: number; user: string; pass: string; secure: boolean }): void {
  safeStorage.setItem(STORAGE_KEY_SMTP_CONFIG, JSON.stringify(config))
}

/**
 * Dispatch report directly and automatically to the recipient's email inbox.
 */
export async function sendReportDirectToEmail(payload: DirectEmailPayload): Promise<DirectEmailResponse> {
  const { recipientEmail, farmName, reportId, areaHa, ndvi, ndmi, format, filename, htmlContent, senderName } = payload

  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    throw new Error('Please enter a valid recipient email address (e.g. you@gmail.com).')
  }

  saveStoredUserEmail(recipientEmail)

  const storedSmtp = getStoredSmtpConfig()
  const smtpConfig = storedSmtp.host && storedSmtp.user ? storedSmtp : payload.smtpConfig

  const requestBody = {
    email: recipientEmail,
    recipientEmail,
    farmName,
    reportId,
    areaHa,
    ndvi,
    ndmi,
    format,
    filename,
    htmlContent,
    senderName: senderName || 'SEVA·GIS Earth Intelligence',
    subject: `[SEVA·GIS Report] Spatial Intelligence for ${farmName} (${format.toUpperCase()})`,
    smtpConfig,
  }

  try {
    const res = await fetch('/api/send-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || errData.message || `Server returned ${res.status}: Failed to send email`)
    }

    const data = await res.json()
    return {
      success: true,
      delivered: Boolean(data.delivered ?? true),
      recipient: recipientEmail,
      format: format.toUpperCase(),
      transport: data.transport || 'direct-smtp',
      message: data.message || `Report (${format.toUpperCase()}) successfully dispatched directly to ${recipientEmail}!`,
    }
  } catch (err: any) {
    console.error('[DirectEmailService] Error dispatching email:', err)
    throw err
  }
}
