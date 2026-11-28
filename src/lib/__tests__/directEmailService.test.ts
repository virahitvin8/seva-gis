import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  saveStoredUserEmail,
  getStoredUserEmail,
  saveStoredSmtpConfig,
  getStoredSmtpConfig,
  sendReportDirectToEmail,
} from '../directEmailService'

test('saveStoredUserEmail and getStoredUserEmail round-trip cleanly', () => {
  saveStoredUserEmail('akshitvinay4636@gmail.com')
  const email = getStoredUserEmail()
  assert.equal(email, 'akshitvinay4636@gmail.com')
})

test('saveStoredSmtpConfig and getStoredSmtpConfig persist SMTP settings', () => {
  saveStoredSmtpConfig({
    host: 'smtp.gmail.com',
    port: 587,
    user: 'notifications@sevagis.dpdns.org',
    pass: 'secret-app-token',
    secure: false,
  })
  const cfg = getStoredSmtpConfig()
  assert.equal(cfg.host, 'smtp.gmail.com')
  assert.equal(cfg.port, 587)
  assert.equal(cfg.user, 'notifications@sevagis.dpdns.org')
})

test('sendReportDirectToEmail rejects invalid email format without @', async () => {
  await assert.rejects(
    async () => {
      await sendReportDirectToEmail({
        recipientEmail: 'invalid-email',
        farmName: 'Test Plot',
        reportId: 'SEVA-101',
        format: 'pdf',
        filename: 'Test.pdf',
        htmlContent: '<html></html>',
      })
    },
      {
      message: /valid recipient email/i,
    }
  )
})

test('sendReportDirectToEmail falls back cleanly to client package when server returns HTTP 405', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('Method Not Allowed', { status: 405 })) as typeof fetch
  try {
    const res = await sendReportDirectToEmail({
      recipientEmail: 'farmer@example.com',
      farmName: 'Kisan Plot',
      reportId: 'SEVA-405',
      format: 'pdf',
      filename: 'Kisan_Plot.pdf',
      htmlContent: '<html><body>Report</body></html>',
    })
    assert.equal(res.success, true)
    assert.equal(res.delivered, false)
    assert.equal(res.isClientFallback, true)
    assert.equal(res.transport, 'client-package')
    assert.ok(res.packageData?.gmailWebUrl.includes('mail.google.com'))
    assert.ok(res.packageData?.mailtoUrl.startsWith('mailto:farmer%40example.com'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
