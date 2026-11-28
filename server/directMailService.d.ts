export interface DirectMailPayload {
  email?: string
  recipientEmail?: string
  farmName?: string
  reportId?: string
  format?: string
  filename?: string
  subject?: string
  htmlContent?: string
  attachmentBase64?: string
  areaHa?: number | null
  ndvi?: number | null
  ndmi?: number | null
  apiKey?: string
  listId?: string
  smtpConfig?: {
    host?: string
    port?: number
    user?: string
    pass?: string
    secure?: boolean
    allowSelfSigned?: boolean
  }
  mailServerConfig?: {
    backend?: string
    relayUrl?: string
    workerUrl?: string
    workerToken?: string
    jmapUrl?: string
    jmapUser?: string
    jmapPass?: string
  }
}

export interface DirectMailResult {
  success: boolean
  delivered: boolean
  needsClientFallback?: boolean
  transport: string
  host?: string
  id?: string
  message: string
}

export function sendViaJmapSubmission(opts: {
  jmapUrl: string
  username?: string
  pass: string
  from: string
  to: string
  subject: string
  html?: string
  text?: string
}): Promise<DirectMailResult>

export function sendViaMailWorker(opts: {
  workerUrl: string
  apiKey?: string
  from: string
  to: string
  subject: string
  html?: string
  text?: string
  filename?: string
  fileContentBase64?: string
  backendLabel?: string
}): Promise<DirectMailResult>

export function dispatchReportEmail(payload: DirectMailPayload): Promise<DirectMailResult>
