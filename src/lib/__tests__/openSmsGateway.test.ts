import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanPhoneNumber,
  generateAdvisoryMessage,
  getNativeSmsUri,
  getWhatsAppUri,
  getStoredOpenSmsConfig,
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
})
