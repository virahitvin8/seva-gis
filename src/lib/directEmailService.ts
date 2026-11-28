/**
 * SEVA.GIS - Direct Automated Email Dispatch Service
 * Handles instant automatic delivery via backend SMTP/Resend when available,
 * and seamlessly generates a ready-to-send RFC-822 .eml + Gmail Web + mailto: + Share
 * package on static hosts (GitHub Pages / offline Android APK) without throwing HTTP 405.
 */

import { executeEmailPackageDelivery, type EmailGenerationResult } from './emailGenerator'

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
  isClientFallback?: boolean
  recipient: string
  format: string
  transport?: string
  message: string
  packageData?: EmailGenerationResult
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

async function buildClientEmailFallback(payload: DirectEmailPayload, reasonNote: string): Promise<DirectEmailResponse> {
  const pkgResult = await executeEmailPackageDelivery({
    recipientEmail: payload.recipientEmail,
    farmName: payload.farmName,
    reportId: payload.reportId,
    areaHa: payload.areaHa,
    ndvi: payload.ndvi,
    ndmi: payload.ndmi,
    filename: payload.filename,
    htmlContent: payload.htmlContent,
    senderName: payload.senderName || 'SEVA·GIS',
    downloadEml: false,
  })

  return {
    success: true,
    delivered: false,
    isClientFallback: true,
    recipient: payload.recipientEmail,
    format: payload.format.toUpperCase(),
    transport: 'client-package',
    packageData: pkgResult.packageData,
    message: `${reasonNote} Prepared Gmail Web compose, Device Mail app & .eml bundle for ${payload.recipientEmail}.`,
  }
}

/**
 * Dispatch report directly and automatically to the recipient's email inbox,
 * with automatic static-host / offline fallback to .eml + Gmail + mailto: + Share.
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

    // Static CDNs (GitHub Pages / offline WebView / unconfigured Vercel) return 404/405/501
    if (res.status === 404 || res.status === 405 || res.status === 501) {
      return await buildClientEmailFallback(
        payload,
        `Server mail endpoint unavailable on this static/offline host (HTTP ${res.status}).`
      )
    }

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      if (data?.needsClientFallback) {
        return await buildClientEmailFallback(payload, data.message || 'Server SMTP unconfigured.')
      }
      throw new Error(data.error || data.message || `Server returned ${res.status}: Failed to send email`)
    }

    if (data.delivered === false || data.needsClientFallback) {
      return await buildClientEmailFallback(
        payload,
        data.message || 'Server SMTP credentials not configured.'
      )
    }

    return {
      success: true,
      delivered: true,
      recipient: recipientEmail,
      format: format.toUpperCase(),
      transport: data.transport || 'direct-smtp',
      message: data.message || `Report (${format.toUpperCase()}) successfully delivered to ${recipientEmail}!`,
    }
  } catch (err: any) {
    // Graceful network fallback (e.g. Android offline / blocked proxy)
    const msg = String(err?.message || '')
    if (
      err?.name === 'TypeError' ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('405') ||
      msg.includes('404')
    ) {
      return await buildClientEmailFallback(payload, 'Direct SMTP server unreachable.')
    }
    throw err
  }
}
