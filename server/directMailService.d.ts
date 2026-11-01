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
  }
}

export interface DirectMailResult {
  success: boolean
  delivered: boolean
  transport: string
  host?: string
  id?: string
  message: string
}

export function dispatchReportEmail(payload: DirectMailPayload): Promise<DirectMailResult>
