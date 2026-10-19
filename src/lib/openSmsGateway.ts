/**
 * SEVA·GIS OpenSMS & WhatsApp Dispatch Gateway
 * Integrates OpenSMS (https://github.com/daslearning-org/OpenSMS)
 * Allows turning any Android phone into a free local SMS API gateway.
 * Also provides native device SMS protocol and direct WhatsApp chat dispatch.
 * 100% Free - Zero API key subscriptions, zero commercial SMS credits needed.
 */

import type { FarmData } from './seva'

export interface OpenSmsConfig {
  serverUrl: string
  apiKey: string
  enabled: boolean
}

export type MessageTemplateType = 'crop_health' | 'irrigation' | 'weather_alert' | 'pmfby_claim'
export type AdvisoryLanguage = 'en' | 'te' | 'hi'

export interface DispatchHistoryRecord {
  id: string
  timestamp: string
  recipientNumber: string
  channel: 'opensms' | 'nativesms' | 'whatsapp'
  templateType: MessageTemplateType
  language: AdvisoryLanguage
  farmName: string
  status: 'sent' | 'opened' | 'failed'
  messagePreview: string
  error?: string
}

const STORAGE_KEY_OPENSMS_CONFIG = 'sevagis_opensms_gateway_config'
const STORAGE_KEY_DISPATCH_HISTORY = 'sevagis_dispatch_history'

export function getStoredOpenSmsConfig(): OpenSmsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OPENSMS_CONFIG)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (err) {
    // ignore
  }
  return {
    serverUrl: 'http://127.0.0.1:9292/sms/',
    apiKey: '',
    enabled: false,
  }
}

export function saveStoredOpenSmsConfig(config: OpenSmsConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_OPENSMS_CONFIG, JSON.stringify(config))
  } catch (err) {
    // ignore
  }
}

export function getStoredDispatchHistory(): DispatchHistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISPATCH_HISTORY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (err) {
    // ignore
  }
  return []
}

export function saveDispatchRecord(record: DispatchHistoryRecord): void {
  try {
    const history = getStoredDispatchHistory()
    const updated = [record, ...history.slice(0, 49)] // keep last 50
    localStorage.setItem(STORAGE_KEY_DISPATCH_HISTORY, JSON.stringify(updated))
  } catch (err) {
    // ignore
  }
}

/**
 * Clean phone number to E.164 international standard
 * Defaults to +91 (India) if 10-digit number entered without country code
 */
export function cleanPhoneNumber(raw: string, defaultCountryCode = '+91'): string {
  if (!raw) return ''
  const trimmed = raw.trim().replace(/[^\d+]/g, '')
  if (!trimmed) return ''

  if (trimmed.startsWith('+')) {
    return trimmed
  }
  if (trimmed.startsWith('0')) {
    return defaultCountryCode + trimmed.slice(1)
  }
  if (trimmed.length === 10) {
    return defaultCountryCode + trimmed
  }
  return defaultCountryCode + trimmed
}

/**
 * Generate localized agronomic SMS & WhatsApp message
 */
export function generateAdvisoryMessage(
  farm: FarmData & { name: string; crop?: string },
  template: MessageTemplateType = 'crop_health',
  lang: AdvisoryLanguage = 'en'
): string {
  const farmName = farm.name || 'Field'
  const crop = farm.crop || 'Crop'
  const areaHa = farm.area ? farm.area.toFixed(1) : '—'
  // Metric slots show an em dash when the analysis has not produced the value.
  // The previous defaults (0.74 / 0.24 / 5) were invented readings.
  const ndvi = farm.analysis?.ndvi?.mean?.toFixed(2) ?? '—'
  const ndmi = farm.analysis?.ndmi?.mean?.toFixed(2) ?? '—'
  const stress = farm.analysis?.stressPct?.toFixed(0) ?? '—'
  const dateStr = farm.analysis?.scene?.datetime?.slice(0, 10) || '—'
  const rain = farm.rain !== undefined ? `${farm.rain.toFixed(0)} mm` : '—'
  const soil = farm.moisture !== undefined ? `${farm.moisture}%` : '—'

  // 1. Telugu (తెలుగు)
  if (lang === 'te') {
    switch (template) {
      case 'crop_health':
        return `🌾 సేవ GIS రైతు హెల్త్ అలర్ట్:
పొలం: ${farmName} (${crop}, ${areaHa} హెక్టార్లు)
తేదీ: ${dateStr}
ఉపగ్రహ NDVI ఆరోగ్యం: ${ndvi} (దట్టమైన పంటకు సూచన: ≥0.65)
తేమ (NDMI): ${ndmi} | ఒత్తిడి విస్తీర్ణం: ${stress}%
సూచన: తక్కువ NDVI ఉన్న ప్రాంతాలను గుర్తించి, ఏ నిర్ణయమైనా తీసుకునే ముందు క్షేత్రంలో స్వయంగా పరిశీలించండి.
పూర్తి వివరాలు: https://sevagis.dpdns.org/`

      case 'irrigation':
        return `💧 సేవ GIS నీటి యాజమాన్య సమాచారం:
పొలం: ${farmName} (${crop})
ఆకుల తేమ స్థాయి (NDMI): ${ndmi}
ప్రస్తుత నీటి ఎద్దడి: ${stress}% విస్తీర్ణం
సలహా: NDMI ఉపగ్రహ పఠనం మాత్రమే, నేల తేమ కొలత కాదు. నీరు పెట్టే ముందు క్షేత్రంలో నేల తేమను పరిశీలించండి.
SEVA·GIS: https://sevagis.dpdns.org/`

      case 'weather_alert':
        return `🌦️ సేవ GIS వాతావరణ & పిచికారీ సమాచారం:
పొలం: ${farmName} | ${dateStr}
వర్ష సూచన (7-రోజుల నమూనా): ${rain}
పై నేల తేమ (నమూనా): ${soil}
సూచన: పిచికారీకి ముందు SEVA·GIS లో ప్రస్తుత గాలి మరియు వర్ష స్థితిని చూడండి.
ఉచిత ఉపగ్రహ నివేదిక: https://sevagis.dpdns.org/`

      case 'pmfby_claim':
        return `🛡️ సేవ GIS పంట స్థితి నివేదిక (PMFBY సమర్పణ):
రైతు పొలం: ${farmName} (${areaHa} హెక్టార్లు)
అక్షాంశం/రేఖాంశం: ${farm.lat.toFixed(4)}°N, ${farm.lon.toFixed(4)}°E
NDVI ఆధారిత తక్కువ పచ్చదనం: ${stress}% ప్రాంతం (దృశ్య పఠనం; క్షేత్ర తనిఖీతో నిర్ధారించండి).
NDVI సగటు: ${ndvi}
బ్యాంక్/బీమా సమర్పణకు ఈ నివేదికను క్షేత్ర తనిఖీ పత్రాలతో కలిపి ఉపయోగించండి: https://sevagis.dpdns.org/`
    }
  }

  // 2. Hindi (हिन्दी)
  if (lang === 'hi') {
    switch (template) {
      case 'crop_health':
        return `🌾 सेवा GIS किसान फसल स्वास्थ्य अलर्ट:
खेत: ${farmName} (${crop}, ${areaHa} हेक्टेयर)
दिनांक: ${dateStr}
उपग्रह NDVI स्वास्थ्य: ${ndvi} (घनी फसल संदर्भ: ≥0.65)
कैनोपी नमी (NDMI): ${ndmi} | तनाव क्षेत्र: ${stress}%
सलाह: कम NDVI वाले क्षेत्रों की पहचान करें और कोई भी निर्णय लेने से पहले खेत में स्वयं जांच करें।
विस्तृत रिपोर्ट: https://sevagis.dpdns.org/`

      case 'irrigation':
        return `💧 सेवा GIS सिंचाई व जल प्रबंधन अलर्ट:
खेत: ${farmName} (${crop})
पत्तियों की नमी (NDMI): ${ndmi} | तनाव: ${stress}%
सिंचाई सुझाव: NDMI केवल उपग्रह पठन है, मिट्टी की नमी की माप नहीं। सिंचाई से पहले खेत में मिट्टी की नमी जांचें।
SEVA·GIS: https://sevagis.dpdns.org/`

      case 'weather_alert':
        return `🌦️ सेवा GIS मौसम व छिड़काव जानकारी:
खेत: ${farmName} | ${dateStr}
वर्षा अनुमान (7-दिन मॉडल): ${rain}
ऊपरी मिट्टी नमी (मॉडल): ${soil}
सलाह: छिड़काव से पहले SEVA·GIS में प्रचलित हवा और वर्षा की स्थिति देखें।
नि:शुल्क उपग्रह सेवा: https://sevagis.dpdns.org/`

      case 'pmfby_claim':
        return `🛡️ सेवा GIS फसल स्थिति रिपोर्ट (PMFBY):
खेत का नाम: ${farmName} (${areaHa} हेक्टेयर)
निर्देशांक: ${farm.lat.toFixed(4)}°N, ${farm.lon.toFixed(4)}°E
NDVI आधारित कम हरियाली: ${stress}% क्षेत्र (उपग्रह पठन; खेत जांच से पुष्टि करें)।
NDVI स्तर: ${ndvi}
बीमा/बैंक जमा हेतु खेत जांच रिकॉर्ड के साथ प्रयोग करें: https://sevagis.dpdns.org/`
    }
  }

  // 3. English (Default)
  switch (template) {
    case 'crop_health':
      return `🌾 SEVA.GIS Kisan Health Alert:
Field: ${farmName} (${crop}, ${areaHa} ha)
Date: ${dateStr}
Sentinel-2 NDVI: ${ndvi} (reference ≥0.65 for dense canopy)
Canopy Moisture — NDMI: ${ndmi} | Stress Area: ${stress}%
Advisory: Check the map for low NDVI pockets and inspect them in the field before any input decision — NDVI is a greenness reading, not a fertiliser prescription.
Full Live Dossier: https://sevagis.dpdns.org/`

    case 'irrigation':
      return `💧 SEVA.GIS Irrigation Scheduling:
Field: ${farmName} (${crop})
Canopy Water Index (NDMI): ${ndmi}
Low-greenness share: ${stress}% of clear pixels
Recommendation: NDMI is a satellite reading, not a soil-moisture measurement. Check the soil in the field before irrigating.
Report: https://sevagis.dpdns.org/`

    case 'weather_alert':
      return `🌦️ SEVA.GIS Weather & Spray Information:
Field: ${farmName} | ${dateStr}
Rain outlook (7-day model): ${rain}
Topsoil moisture (model): ${soil}
Advisory: Check the live wind and rain conditions in SEVA·GIS before spraying.
Report: https://sevagis.dpdns.org/`

    case 'pmfby_claim':
      return `🛡️ SEVA.GIS Crop Condition Report (PMFBY):
Plot: ${farmName} (~${areaHa} ha)
Centroid: ${farm.lat.toFixed(5)}°N, ${farm.lon.toFixed(5)}°E
NDVI-based low-greenness share: ${stress}% of clear pixels (scene reading; confirm with a field visit).
Observed Mean NDVI: ${ndvi}
Report link (use with your field inspection records): https://sevagis.dpdns.org/`
  }
}

/**
 * Send SMS via OpenSMS Android API Gateway
 * Endpoint: POST http://<android-ip>:9292/sms/
 * Body: {"number": "+123...", "text": "..."}
 */
export async function sendViaOpenSmsGateway(
  config: OpenSmsConfig,
  number: string,
  text: string
): Promise<{ success: boolean; message: string }> {
  if (!config.serverUrl) {
    throw new Error('OpenSMS server URL is not configured. Please enter your Android device IP and port 9292.')
  }

  const cleanNum = cleanPhoneNumber(number)
  if (!cleanNum || cleanNum.length < 8) {
    throw new Error('Please enter a valid mobile number with country code (e.g. +91 9876543210).')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiKey && config.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`
  }

  const payload = {
    number: cleanNum,
    text: text,
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)

  try {
    const res = await fetch(config.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      let dataText = 'SMS successfully dispatched via OpenSMS Android gateway!'
      try {
        const json = await res.json()
        if (json.message) dataText = json.message
      } catch (e) {
        // text ok
      }
      return { success: true, message: dataText }
    } else {
      const errText = await res.text().catch(() => '')
      throw new Error(`OpenSMS server responded with HTTP ${res.status}: ${errText || res.statusText}`)
    }
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error('Connection to OpenSMS timed out after 12 seconds. Ensure your Android phone and PC are on the same Wi-Fi network and OpenSMS server is running.')
    }
    // Mixed content / CORS error handling
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error('Failed to connect to OpenSMS gateway. Note: If accessing SEVA·GIS over HTTPS, modern browsers block HTTP LAN requests due to Mixed Content policy. You can use the "Direct Device SMS" or "WhatsApp" buttons, or run OpenSMS behind a secure tunnel (e.g. ngrok / Tailscale / Cloudflare Tunnel).')
    }
    throw err
  }
}

/**
 * Format Native Device SMS Link
 * Directly triggers Android / iOS native messaging app
 */
export function getNativeSmsUri(number: string, text: string): string {
  const clean = cleanPhoneNumber(number).replace(/\+/g, '')
  // Android and iOS compatibility:
  return `sms:${clean}?body=${encodeURIComponent(text)}`
}

/**
 * Format Direct WhatsApp Link
 * Directly triggers WhatsApp Web or mobile app to specific contact
 */
export function getWhatsAppUri(number: string, text: string): string {
  const clean = cleanPhoneNumber(number).replace(/[^\d]/g, '')
  if (clean) {
    return `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(text)}`
  }
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
}
