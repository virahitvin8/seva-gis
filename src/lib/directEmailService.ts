/**
 * SEVA.GIS - Direct Automated Email Dispatch Service
 * Multi-transport delivery supporting:
 *   1. Open-source self-hosted & serverless backends:
 *      - stalwartlabs/mail-server (RFC 8620 JMAP submission)
 *      - hieunc229/mailflare pattern Cloudflare Email Worker
 *      - docker-mailserver (MIT) / mailcow-dockerized / eigen-is/eigen (MIT) SMTP
 *   2. Same-origin API (/api/send-report) & CORS-enabled live relay (https://seva-gis.vercel.app/api/send-report)
 *      so static hosts (GitHub Pages sevagis.dpdns.org) & Capacitor Android APKs never hit a dead HTTP 405
 *   3. Instant offline/zero-config RFC-822 .eml + Gmail Web + mailto: package fallback
 */

import { executeEmailPackageDelivery, type EmailGenerationResult } from './emailGenerator'

export type MailBackendPreset =
  | 'auto'
  | 'stalwart-jmap'
  | 'mailflare-worker'
  | 'docker-mailserver'
  | 'mailcow'
  | 'eigen'
  | 'gmail-smtp'
  | 'custom-smtp'

export interface MailServerPresetMeta {
  id: MailBackendPreset
  label: string
  repo: string
  license: string
  protocol: string
  defaultPort: number
  defaultHostHint: string
  description: string
}

export const MAIL_SERVER_PRESETS: Record<MailBackendPreset, MailServerPresetMeta> = {
  auto: {
    id: 'auto',
    label: 'Auto Relay (Vercel API + Self-Hosted)',
    repo: 'virahitvin8/seva-gis',
    license: 'Apache-2.0',
    protocol: 'HTTPS / CORS Relay',
    defaultPort: 587,
    defaultHostHint: 'https://seva-gis.vercel.app/api/send-report',
    description: 'Uses same-origin /api/send-report or live CORS relay on static hosts & Android APK.',
  },
  'stalwart-jmap': {
    id: 'stalwart-jmap',
    label: 'Stalwart Mail Server (JMAP RFC 8620)',
    repo: 'stalwartlabs/mail-server',
    license: 'AGPL-3.0 upstream container',
    protocol: 'JMAP / HTTPS + SMTP',
    defaultPort: 587,
    defaultHostHint: 'https://mail.yourdomain.com/.well-known/jmap',
    description: 'Single-binary Rust JMAP + SMTP server with low memory footprint.',
  },
  'mailflare-worker': {
    id: 'mailflare-worker',
    label: 'Mailflare / Cloudflare Worker (Zero-Server)',
    repo: 'hieunc229/mailflare',
    license: 'Apache-2.0 worker / AGPL-3.0 ref',
    protocol: 'HTTPS JSON Worker',
    defaultPort: 443,
    defaultHostHint: 'https://seva-gis-mail-worker.your-sub.workers.dev',
    description: 'Free Cloudflare Workers edge mail endpoint working directly from static GitHub Pages.',
  },
  'docker-mailserver': {
    id: 'docker-mailserver',
    label: 'docker-mailserver (SMTP + DKIM/SPF)',
    repo: 'docker-mailserver/docker-mailserver',
    license: 'MIT',
    protocol: 'SMTP STARTTLS / SSL',
    defaultPort: 587,
    defaultHostHint: 'mail.yourdomain.com',
    description: 'Minimalist Docker container mailserver with OpenDKIM, DMARC & Rspamd.',
  },
  mailcow: {
    id: 'mailcow',
    label: 'Mailcow Dockerized (Full Groupware)',
    repo: 'mailcow/mailcow-dockerized',
    license: 'GPL-3.0 upstream container',
    protocol: 'SMTP STARTTLS / SSL',
    defaultPort: 587,
    defaultHostHint: 'mail.yourdomain.com',
    description: 'Production Docker Compose suite with SOGo webmail, CalDAV & spam filtering.',
  },
  eigen: {
    id: 'eigen',
    label: 'Eigen Workspace (Bun + SQLite)',
    repo: 'eigen-is/eigen',
    license: 'MIT',
    protocol: 'SMTP / HTTP Webhook',
    defaultPort: 587,
    defaultHostHint: 'mail.yourdomain.com',
    description: 'Self-hosted open-source workspace (Mail, Docs, Sheets, Calendar, Chat).',
  },
  'gmail-smtp': {
    id: 'gmail-smtp',
    label: 'Gmail App Password SMTP',
    repo: 'RFC 5321 STARTTLS',
    license: 'Open Standard',
    protocol: 'SMTP 587 STARTTLS',
    defaultPort: 587,
    defaultHostHint: 'smtp.gmail.com',
    description: 'Google Account 16-char App Password direct SMTP delivery.',
  },
  'custom-smtp': {
    id: 'custom-smtp',
    label: 'Custom SMTP Relay',
    repo: 'RFC 5321',
    license: 'Open Standard',
    protocol: 'SMTP / TLS',
    defaultPort: 587,
    defaultHostHint: 'smtp.yourdomain.com',
    description: 'Any standards-compliant SMTP provider on port 587 or 465.',
  },
}

export const DEFAULT_CROSS_ORIGIN_MAIL_RELAY = 'https://seva-gis.vercel.app/api/send-report'

export interface MailServerConfig {
  backend: MailBackendPreset
  relayUrl: string
  workerUrl: string
  workerToken: string
  jmapUrl: string
  jmapUser: string
  jmapPass: string
}

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
    allowSelfSigned?: boolean
  }
  mailServerConfig?: Partial<MailServerConfig>
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
const STORAGE_KEY_MAIL_SERVER_CONFIG = 'seva_dispatch_mail_server_config'

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

export function getStoredMailServerConfig(): MailServerConfig {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY_MAIL_SERVER_CONFIG)
    if (raw) {
      const parsed = JSON.parse(raw)
      const backend: MailBackendPreset = parsed.backend && parsed.backend in MAIL_SERVER_PRESETS ? parsed.backend : 'auto'
      return {
        backend,
        relayUrl: String(parsed.relayUrl || ''),
        workerUrl: String(parsed.workerUrl || ''),
        workerToken: String(parsed.workerToken || ''),
        jmapUrl: String(parsed.jmapUrl || ''),
        jmapUser: String(parsed.jmapUser || ''),
        jmapPass: String(parsed.jmapPass || ''),
      }
    }
  } catch {}
  return {
    backend: 'auto',
    relayUrl: '',
    workerUrl: '',
    workerToken: '',
    jmapUrl: '',
    jmapUser: '',
    jmapPass: '',
  }
}

export function saveStoredMailServerConfig(config: Partial<MailServerConfig>): MailServerConfig {
  const merged = { ...getStoredMailServerConfig(), ...config }
  safeStorage.setItem(STORAGE_KEY_MAIL_SERVER_CONFIG, JSON.stringify(merged))
  return merged
}

export function resolveMailRelayEndpoints(mailServerConfig: MailServerConfig): string[] {
  const urls: string[] = []
  const pushUnique = (u: string) => {
    const clean = String(u || '').trim()
    if (clean && !urls.includes(clean)) urls.push(clean)
  }

  // Same-origin endpoint works on Node server.js, Docker nginx, Vite dev, and Vercel
  pushUnique('/api/send-report')

  // Custom self-hosted / user-supplied relay URL
  if (mailServerConfig.relayUrl) {
    const cleanRelay = mailServerConfig.relayUrl.trim().replace(/\/+$/, '')
    pushUnique(cleanRelay.endsWith('/api/send-report') ? cleanRelay : `${cleanRelay}/api/send-report`)
  }

  // Optional build-time backend base
  const envBase = (import.meta as any)?.env?.VITE_API_BASE
  if (envBase && typeof envBase === 'string' && envBase.trim()) {
    pushUnique(`${envBase.trim().replace(/\/+$/, '')}/api/send-report`)
  }

  // Automatic Vercel CORS-enabled cloud relay fallback for static GitHub Pages (sevagis.dpdns.org) & Android APK
  if (typeof window !== 'undefined' && window.location?.origin !== 'https://seva-gis.vercel.app') {
    pushUnique(DEFAULT_CROSS_ORIGIN_MAIL_RELAY)
  }

  return urls
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
    message: `${reasonNote} Open Gmail Web, Phone Mail App, or download the .eml file for ${payload.recipientEmail}.`,
  }
}

/**
 * Dispatch report directly to the recipient inbox across Worker, Stalwart JMAP,
 * same-origin API, CORS cloud relay (fixing static-host HTTP 405), and SMTP,
 * falling back cleanly to ready-to-send Gmail Web / mailto: / .eml bundle.
 */
export async function sendReportDirectToEmail(payload: DirectEmailPayload): Promise<DirectEmailResponse> {
  const { recipientEmail, farmName, reportId, areaHa, ndvi, ndmi, format, filename, htmlContent, senderName } = payload

  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    throw new Error('Please enter a valid recipient email address (e.g. you@gmail.com).')
  }

  saveStoredUserEmail(recipientEmail)

  const storedSmtp = getStoredSmtpConfig()
  const smtpConfig = storedSmtp.host && storedSmtp.user ? storedSmtp : payload.smtpConfig
  const mailServerConfig: MailServerConfig = {
    ...getStoredMailServerConfig(),
    ...(payload.mailServerConfig || {}),
  }

  const subject = `[SEVA·GIS Report] Spatial Intelligence for ${farmName} (${format.toUpperCase()})`
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
    subject,
    smtpConfig,
    mailServerConfig,
  }

  // 1. Direct Zero-Server Mailflare / Cloudflare Worker or Eigen Webhook URL (bypasses static-host 405 completely)
  if (mailServerConfig.workerUrl && /^https?:\/\//i.test(mailServerConfig.workerUrl)) {
    try {
      const wHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (mailServerConfig.workerToken) {
        wHeaders['Authorization'] = `Bearer ${mailServerConfig.workerToken}`
      }
      const wRes = await fetch(mailServerConfig.workerUrl.trim(), {
        method: 'POST',
        headers: wHeaders,
        body: JSON.stringify({
          to: recipientEmail,
          email: recipientEmail,
          farmName,
          subject,
          html: htmlContent,
          htmlContent,
        }),
      })
      const wData = await wRes.json().catch(() => ({}))
      if (wRes.ok && wData.delivered) {
        return {
          success: true,
          delivered: true,
          recipient: recipientEmail,
          format: format.toUpperCase(),
          transport: wData.transport || mailServerConfig.backend || 'mailflare-worker',
          message: wData.message || `Report delivered to ${recipientEmail} via Cloudflare Mail Worker!`,
        }
      }
    } catch {
      // Continue cleanly to API / CORS relay / client fallback
    }
  }

  // 2. Try same-origin /api/send-report, custom relay, and CORS-enabled Vercel cloud relay
  const endpoints = resolveMailRelayEndpoints(mailServerConfig)
  let fallbackReason = 'Mail relay unconfigured on this host.'

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SEVA-Mail-Backend': mailServerConfig.backend || 'auto',
        },
        body: JSON.stringify(requestBody),
      })

      if (res.status === 404 || res.status === 405 || res.status === 501) {
        fallbackReason = 'Direct server endpoint requires configuring Stalwart JMAP, Mailflare Worker, Docker-Mailserver, Mailcow, Eigen, or SMTP in Gateway Settings.'
        continue
      }

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data?.needsClientFallback) {
          fallbackReason = data.message || 'Server mail transport unconfigured.'
          break
        }
        throw new Error(data.error || data.message || `Server returned ${res.status}: Failed to send email`)
      }

      if (data.delivered === false || data.needsClientFallback) {
        fallbackReason = data.message || 'Server SMTP / JMAP / Mailflare credentials not configured.'
        break
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
      const msg = String(err?.message || '')
      if (err?.name === 'TypeError' || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        fallbackReason = 'Mail relay unreachable offline.'
        continue
      }
      throw err
    }
  }

  return await buildClientEmailFallback(payload, fallbackReason)
}
