import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  saveStoredUserEmail,
  getStoredUserEmail,
  saveStoredSmtpConfig,
  getStoredSmtpConfig,
  saveStoredMailServerConfig,
  getStoredMailServerConfig,
  resolveMailRelayEndpoints,
  MAIL_SERVER_PRESETS,
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

test('resolveMailRelayEndpoints includes self-hosted relay and cross-origin cloud relay on static origins', () => {
  const prevWin = (globalThis as any).window
  ;(globalThis as any).window = { location: { origin: 'https://sevagis.dpdns.org' } }
  try {
    const cfg = saveStoredMailServerConfig({
      backend: 'docker-mailserver',
      relayUrl: 'https://mail-bridge.example.org',
    })
    const endpoints = resolveMailRelayEndpoints(cfg)
    assert.ok(endpoints.includes('/api/send-report'))
    assert.ok(endpoints.includes('https://mail-bridge.example.org/api/send-report'))
    assert.ok(endpoints.includes('https://seva-gis.vercel.app/api/send-report'))
    assert.equal(MAIL_SERVER_PRESETS['stalwart-jmap'].repo, 'stalwartlabs/mail-server')
    assert.equal(MAIL_SERVER_PRESETS['mailflare-worker'].repo, 'hieunc229/mailflare')
    assert.equal(MAIL_SERVER_PRESETS.eigen.license, 'MIT')
  } finally {
    saveStoredMailServerConfig({ backend: 'auto', relayUrl: '' })
    ;(globalThis as any).window = prevWin
  }
})

test('sendReportDirectToEmail dispatches directly through Mailflare Cloudflare Worker URL bypassing 405 hosts', async () => {
  const originalFetch = globalThis.fetch
  const calledUrls: string[] = []
  globalThis.fetch = (async (url: any) => {
    calledUrls.push(String(url))
    return new Response(JSON.stringify({ delivered: true, transport: 'mailflare-worker', message: 'Sent via Worker' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
  try {
    const res = await sendReportDirectToEmail({
      recipientEmail: 'farmer@example.com',
      farmName: 'Kisan Plot',
      reportId: 'SEVA-WORKER-1',
      format: 'pdf',
      filename: 'Kisan_Plot.pdf',
      htmlContent: '<html><body>Report</body></html>',
      mailServerConfig: {
        backend: 'mailflare-worker',
        workerUrl: 'https://seva-gis-mail-worker.workers.dev',
      },
    })
    assert.equal(res.delivered, true)
    assert.equal(res.transport, 'mailflare-worker')
    assert.equal(calledUrls[0], 'https://seva-gis-mail-worker.workers.dev')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('server sendViaJmapSubmission and sendViaMailWorker speak RFC 8620 JMAP & Worker JSON cleanly', async () => {
  const { sendViaJmapSubmission, sendViaMailWorker } = await import('../../../server/directMailService.js')
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: any) => {
    const u = String(url)
    if (u.endsWith('/.well-known/jmap')) {
      return new Response(JSON.stringify({
        apiUrl: 'https://mail.example.org/jmap',
        primaryAccounts: { 'urn:ietf:params:jmap:submission': 'acc1' },
      }), { status: 200 })
    }
    if (u === 'https://mail.example.org/jmap') {
      return new Response(JSON.stringify({
        methodResponses: [
          ['Mailbox/get', { list: [{ id: 'mb-drafts', role: 'drafts' }] }, 'm0'],
          ['Identity/get', { list: [{ id: 'id-1', email: 'reports@example.org' }] }, 'i0'],
          ['EmailSubmission/set', { created: { sub0: { id: 'sub-42' } } }, 's0'],
        ],
      }), { status: 200 })
    }
    return new Response(JSON.stringify({ delivered: true, transport: 'mailflare-worker', id: 'w-1' }), { status: 200 })
  }) as typeof fetch

  try {
    const jmapRes = await sendViaJmapSubmission({
      jmapUrl: 'https://mail.example.org',
      username: 'reports@example.org',
      pass: 'token-123',
      from: 'SEVA.GIS <reports@example.org>',
      to: 'farmer@example.com',
      subject: 'Test JMAP',
      html: '<p>OK</p>',
    })
    assert.equal(jmapRes.delivered, true)
    assert.equal(jmapRes.transport, 'stalwart-jmap')
    assert.equal(jmapRes.id, 'sub-42')

    const workerRes = await sendViaMailWorker({
      workerUrl: 'https://worker.example.org/send',
      from: 'reports@example.org',
      to: 'farmer@example.com',
      subject: 'Test Worker',
      html: '<p>OK</p>',
    })
    assert.equal(workerRes.delivered, true)
    assert.equal(workerRes.transport, 'mailflare-worker')
  } finally {
    globalThis.fetch = originalFetch
  }
})
