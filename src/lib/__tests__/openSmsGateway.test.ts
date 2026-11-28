import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanPhoneNumber,
  generateAdvisoryMessage,
  getNativeSmsUri,
  getWhatsAppUri,
  getStoredOpenSmsConfig,
  probeOpenSmsGateway,
  type MessageTemplateType,
  type AdvisoryLanguage
} from '../openSmsGateway'
import type { FarmData } from '../seva'

const mockFarm: FarmData & { id: string; name: string; crop: string } = {
  id: 'farm-123',
  name: 'Kisan Paddy Field',
  crop: 'Paddy',
  lat: 14.435,
  lon: 78.850,
  area: 3.2,
  analysis: {
    ndvi: { mean: 0.78, min: 0.40, max: 0.89, std: 0.05 },
    ndmi: { mean: 0.31, min: 0.10, max: 0.50, std: 0.04 },
    elevMean: 240,
    slopeDeg: 1.2,
    stressPct: 3.5,
    scene: { datetime: '2026-10-16T05:30:00Z', cloud: 0.8 }
  } as any
}

test('cleanPhoneNumber formats 10-digit numbers with default +91', () => {
  assert.equal(cleanPhoneNumber('9876543210'), '+919876543210')
  assert.equal(cleanPhoneNumber('98765 43210'), '+919876543210')
  assert.equal(cleanPhoneNumber('09876543210'), '+919876543210')
  assert.equal(cleanPhoneNumber('+1 (555) 123-4567'), '+15551234567')
})

test('generateAdvisoryMessage generates English crop health message with live metrics', () => {
  const msg = generateAdvisoryMessage(mockFarm, 'crop_health', 'en')
  assert.ok(msg.includes('Kisan Paddy Field'))
  assert.ok(msg.includes('Paddy, 3.2 ha'))
  assert.ok(msg.includes('NDVI: 0.78'))
  assert.ok(msg.includes('NDMI: 0.31'))
  assert.ok(msg.includes('sevagis.dpdns.org'))
})

test('generateAdvisoryMessage generates Telugu (తెలుగు) crop health advisory', () => {
  const msg = generateAdvisoryMessage(mockFarm, 'crop_health', 'te')
  assert.ok(msg.includes('సేవ GIS రైతు హెల్త్ అలర్ట్'))
  assert.ok(msg.includes('Kisan Paddy Field'))
  assert.ok(msg.includes('NDVI ఆరోగ్యం: 0.78'))
})

test('generateAdvisoryMessage generates Hindi (हिन्दी) irrigation advisory', () => {
  const msg = generateAdvisoryMessage(mockFarm, 'irrigation', 'hi')
  assert.ok(msg.includes('सेवा GIS सिंचाई व जल प्रबंधन अलर्ट'))
  assert.ok(msg.includes('पत्तियों की नमी (NDMI): 0.31'))
})

test('getNativeSmsUri generates compliant sms protocol URI', () => {
  const uri = getNativeSmsUri('+919876543210', 'Hello Kisan')
  assert.ok(uri.startsWith('sms:919876543210?body='))
  assert.ok(uri.includes('Hello%20Kisan'))
})

test('getWhatsAppUri generates compliant WhatsApp Web/API link', () => {
  const uri = getWhatsAppUri('+91 98765 43210', 'Crop Alert')
  assert.ok(uri.startsWith('https://api.whatsapp.com/send?phone=919876543210&text='))
  assert.ok(uri.includes('Crop%20Alert'))
})

test('getStoredOpenSmsConfig returns fallback config without throwing', () => {
  const cfg = getStoredOpenSmsConfig()
  assert.ok(cfg.serverUrl.includes('9292'))
  assert.equal(cfg.apiKey, '')
})

test('sendViaOpenSmsGateway fails fast with clear fallback URIs instead of hanging 12s on HTTPS mixed content or timeout', async () => {
  const { sendViaOpenSmsGateway } = await import('../openSmsGateway')
  const originalFetch = globalThis.fetch
  const origSetTimeout = globalThis.setTimeout
  globalThis.fetch = ((url: any, init: any) => {
    if (String(url).startsWith('/api/')) {
      return Promise.resolve(new Response('Not Allowed', { status: 405 }))
    }
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('The operation was aborted')
        err.name = 'AbortError'
        reject(err)
      })
    })
  }) as typeof fetch
  globalThis.setTimeout = ((fn: any, ms?: number, ...args: any[]) => origSetTimeout(fn, Math.min(ms ?? 0, 25), ...args)) as typeof setTimeout

  try {
    let caught: any = null
    try {
      await sendViaOpenSmsGateway(
        { serverUrl: 'http://192.168.1.50:9292/sms/', apiKey: '', enabled: true },
        '9876543210',
        'NDVI crop alert'
      )
    } catch (e) {
      caught = e
    }
    assert.ok(caught, 'Expected gateway error when OpenSMS is unreachable')
    assert.ok(caught.fallbackSmsUri?.startsWith('sms:919876543210?body='), `got ${caught.fallbackSmsUri}`)
    assert.ok(caught.fallbackWhatsAppUri?.includes('api.whatsapp.com/send?phone=919876543210'), `got ${caught.fallbackWhatsAppUri}`)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.setTimeout = origSetTimeout
  }
})

test('api/send-report and api/opensms-proxy serverless handlers respond cleanly with CORS headers and without 405 on POST', async () => {
  const sendReportMod = await import('../../../api/send-report.js')
  const openSmsMod = await import('../../../api/opensms-proxy.js')

  const mockRes = () => {
    const out: any = { statusCode: 200, body: null, headers: {} as Record<string, string> }
    out.setHeader = (k: string, v: string) => { out.headers[k] = v }
    out.status = (code: number) => { out.statusCode = code; return out }
    out.json = (data: any) => { out.body = data; return out }
    out.end = () => out
    return out
  }

  const r1 = mockRes()
  await sendReportMod.default({
    method: 'POST',
    headers: { origin: 'https://sevagis.dpdns.org' },
    body: { email: 'farmer@example.com', farmName: 'Plot A', format: 'pdf', htmlContent: '<p>ok</p>' }
  }, r1)
  assert.equal(r1.statusCode, 200)
  assert.equal(r1.body.needsClientFallback, true)
  assert.equal(r1.headers['Access-Control-Allow-Origin'], 'https://sevagis.dpdns.org')

  const r2 = mockRes()
  await openSmsMod.default({
    method: 'POST',
    headers: { origin: 'https://localhost' },
    body: { serverUrl: 'http://192.168.1.25:9292/sms/', number: '+919876543210', text: 'Test' }
  }, r2)
  assert.equal(r2.statusCode, 502)
  assert.equal(r2.body.reason, 'private-lan-ip')
  assert.equal(r2.headers['Access-Control-Allow-Origin'], 'https://localhost')
})

test('probeOpenSmsGateway reports offline loopback clearly without throwing', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    throw new Error('ECONNREFUSED')
  }) as typeof fetch
  try {
    const probe = await probeOpenSmsGateway({ serverUrl: 'http://127.0.0.1:9292/sms/', apiKey: '', enabled: true }, 50)
    assert.equal(probe.reachable, false)
    assert.equal(probe.mode, 'unavailable')
    assert.ok(probe.hint.includes('Phone SMS App'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
