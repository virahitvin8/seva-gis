/**
 * SEVA·GIS SECURITY AUDIT & FORENSIC TELEMETRY ENGINE
 * ===================================================
 * Purpose: Real-time client IP, proxy/VPN de-cloaking, and device fingerprint logging.
 * Captures:
 *  - Real client IP (CF-Connecting-IP, X-Forwarded-For chain, X-Real-IP)
 *  - High-precision timestamp & geo headers (CF-IPCountry, CF-IPCity, etc.)
 *  - Client Hints: Device model, OS, Architecture (Sec-CH-UA-*)
 *  - Browser Telemetry: WebRTC local IP leak, WebGL GPU renderer, Screen resolution,
 *    Battery status, Timezone offset, Canvas fingerprint hash
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const AUDIT_LOG_FILE = path.join(__dirname, '..', 'security_access_audit.jsonl');

/**
 * Extracts true client IP address considering reverse proxies, CDNs, and VPNs.
 */
export function extractClientNetworkData(req) {
  const headers = req.headers || {};

  // Check headers in order of trust/authenticity
  const cloudflareIp = headers['cf-connecting-ip'];
  const trueClientIp = headers['true-client-ip'];
  const xRealIp = headers['x-real-ip'];
  const xForwardedFor = headers['x-forwarded-for'];
  
  let forwardedIps = [];
  if (xForwardedFor) {
    forwardedIps = xForwardedFor.split(',').map(s => s.trim());
  }

  // The leftmost IP in X-Forwarded-For is usually the client origin (unless forged)
  const clientIp = cloudflareIp || trueClientIp || xRealIp || forwardedIps[0] || req.socket.remoteAddress || 'unknown';

  return {
    primaryIp: clientIp,
    remoteAddress: req.socket.remoteAddress,
    xForwardedFor: xForwardedFor || null,
    allForwardedHops: forwardedIps,
    cfConnectingIp: cloudflareIp || null,
    cfCountry: headers['cf-ipcountry'] || null,
    cfRay: headers['cf-ray'] || null,
    userAgent: headers['user-agent'] || 'unknown',
    secChUa: headers['sec-ch-ua'] || null,
    secChUaMobile: headers['sec-ch-ua-mobile'] || null,
    secChUaPlatform: headers['sec-ch-ua-platform'] || null,
    acceptLanguage: headers['accept-language'] || null,
    referer: headers['referer'] || null,
    host: headers['host'] || null,
  };
}

/**
 * Writes structured audit entry to disk in JSON-Lines format.
 */
export function logSecurityEvent(eventType, metadata) {
  const record = {
    timestamp: new Date().toISOString(),
    epochMs: Date.now(),
    eventType,
    ...metadata,
  };

  const line = JSON.stringify(record) + '\n';
  try {
    fs.appendFileSync(AUDIT_LOG_FILE, line, 'utf-8');
  } catch (err) {
    console.error('[SECURITY-AUDIT] Failed to write log:', err);
  }

  // Console alert for quick terminal monitoring
  console.log(`[SEVA·GIS AUDIT] [${record.eventType}] IP: ${record.primaryIp || metadata?.network?.primaryIp} | Device: ${record.userAgent || metadata?.network?.userAgent}`);
}

/**
 * HTTP Middleware / Handler for Node.js http server.
 */
export function handleSecurityRoutes(req, res, urlPath) {
  // 1. Client Beacon Endpoint: Receives rich browser-side telemetry
  if (urlPath === '/api/security/telemetry-beacon' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 512 * 1024) req.destroy(); // 512KB max
    });

    req.on('end', () => {
      try {
        const browserPayload = JSON.parse(body || '{}');
        const network = extractClientNetworkData(req);

        logSecurityEvent('CLIENT_DEEP_TELEMETRY', {
          network,
          browser: browserPayload,
          suspectCorrelationAlert: checkSuspectCorrelations(network, browserPayload),
        });

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ status: 'telemetry_recorded', ok: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Malformed telemetry packet' }));
      }
    });
    return true; // route handled
  }

  // 2. Audit Dump Endpoint (Protected with basic query passcode)
  if (urlPath === '/api/security/audit-view' && req.method === 'GET') {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const key = parsedUrl.searchParams.get('key');

    // Default emergency key: akshit_ftcul_audit_2026
    if (key !== 'akshit_ftcul_audit_2026') {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access Denied: Invalid forensic security key.');
      return true;
    }

    fs.readFile(AUDIT_LOG_FILE, 'utf-8', (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ records: [], message: 'No logs recorded yet.' }));
        return;
      }
      const lines = data.trim().split('\n').filter(Boolean);
      const records = lines.map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ total: records.length, records }, null, 2));
    });
    return true; // route handled
  }

  // 3. Regular page visit logging (Passive logging for all routes)
  if (!urlPath.startsWith('/_') && !urlPath.includes('.png') && !urlPath.includes('.ico')) {
    const net = extractClientNetworkData(req);
    logSecurityEvent('PAGE_ACCESS', {
      path: urlPath,
      method: req.method,
      network: net,
    });
  }

  return false; // not an intercepted API route, proceed with standard serving
}

/**
 * Real-time correlation engine checking against known incident parameters
 */
function checkSuspectCorrelations(network, browser) {
  const flags = [];

  // Screen resolution correlation (matching evidence screenshots: ~610x1356 or ~670x1246 ratio)
  if (browser?.screen) {
    const { width, height, dpr } = browser.screen;
    const ratio = (height / width).toFixed(2);
    if (ratio === '2.22' || ratio === '1.86' || ratio === '2.00') {
      flags.push(`MATCH_ASPECT_RATIO: Screen ratio ${ratio} aligns with victim evidence screenshot resolutions`);
    }
  }

  // GPU correlation (detects mobile chipsets like Mali / Adreno commonly found on suspect phones)
  if (browser?.webgl?.renderer) {
    flags.push(`GPU_FINGERPRINT: ${browser.webgl.renderer}`);
  }

  // WebRTC leak detection
  if (browser?.webrtc?.candidateIps && browser.webrtc.candidateIps.length > 0) {
    flags.push(`WEBRTC_LEAKED_INTERNAL_IPS: ${browser.webrtc.candidateIps.join(', ')}`);
  }

  // Battery status (useful when testing in a physical room)
  if (browser?.battery) {
    flags.push(`BATTERY_METRIC: ${Math.round(browser.battery.level * 100)}% (charging: ${browser.battery.charging})`);
  }

  return flags;
}

