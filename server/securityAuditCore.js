import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const AUDIT_LOG_FILE = path.join(LOGS_DIR, 'security_breach_audit.jsonl');
const LOGINS_LOG_FILE = path.join(LOGS_DIR, 'security_logins.jsonl');
let inMemoryLogins = [];

// Ensure logs directory exists
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('[SecurityAudit] Could not create logs directory:', err);
}

// In-memory ring buffer (up to 2000 events)
const MAX_IN_MEMORY_LOGS = 2000;
let inMemoryLogs = [];

// Geolocation & VPN cache (IP -> Geo data)
const ipGeoCache = new Map();
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Load existing logs from disk on startup
try {
  if (fs.existsSync(AUDIT_LOG_FILE)) {
    const raw = fs.readFileSync(AUDIT_LOG_FILE, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    inMemoryLogs = lines
      .slice(-MAX_IN_MEMORY_LOGS)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    console.log(`[SecurityAudit] Loaded ${inMemoryLogs.length} previous forensic logs from disk.`);

try {
  if (fs.existsSync(LOGINS_LOG_FILE)) {
    const raw = fs.readFileSync(LOGINS_LOG_FILE, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    inMemoryLogins = lines
      .slice(-MAX_IN_MEMORY_LOGS)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    console.log(`[SecurityAudit] Loaded ${inMemoryLogins.length} login records from disk.`);
  }
} catch (err) {
  console.warn('[SecurityAudit] Failed to read initial login records from disk:', err);
}

  }
} catch (err) {
  console.warn('[SecurityAudit] Failed to read initial audit logs from disk:', err);
}

/**
 * Extract real client IP from request headers (Cloudflare, proxies, load balancers, direct socket)
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const list = String(forwarded).split(',').map(s => s.trim());
    if (list.length > 0 && list[0]) return cleanIp(list[0]);
  }
  const direct =
    req.headers['cf-connecting-ip'] ||
    req.headers['true-client-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-client-ip'] ||
    req.socket?.remoteAddress ||
    '127.0.0.1';
  return cleanIp(String(direct));
}

function cleanIp(ip) {
  // Strip IPv6-mapped IPv4 prefix (::ffff:192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '');
  }
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

/**
 * Check if IP is local, loopback or private
 */
export function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === 'localhost' || ip === '::1') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.16.')) return true;
  return false;
}

/**
 * Parse User Agent for device, OS, and browser
 */
export function parseUserAgent(uaString) {
  const ua = String(uaString || '').toLowerCase();
  let type = 'desktop';
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';

  // Check mobile / tablet
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    type = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|iemobile|kindle/i.test(ua)) {
    type = 'mobile';
  } else if (/bot|crawler|spider|curl|wget|python|postman|insomnia/i.test(ua)) {
    type = 'bot';
  }

  // OS detection
  if (/iphone|ipad|ipod/.test(ua)) {
    const match = ua.match(/os (\d+[._]\d+)/);
    os = match ? `iOS ${match[1].replace('_', '.')}` : 'iOS';
  } else if (/android/.test(ua)) {
    const match = ua.match(/android (\d+(\.\d+)?)/);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/windows nt 10\.0/.test(ua)) {
    os = 'Windows 10/11';
  } else if (/windows nt/.test(ua)) {
    os = 'Windows';
  } else if (/mac os x/.test(ua)) {
    const match = ua.match(/mac os x (\d+[._]\d+)/);
    os = match ? `macOS ${match[1].replace('_', '.')}` : 'macOS';
  } else if (/linux/.test(ua)) {
    os = 'Linux';
  } else if (/cros/.test(ua)) {
    os = 'ChromeOS';
  }

  // Browser detection
  if (/edg\//.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/chrome\/|crios\//.test(ua) && !/opr\/|opera/.test(ua)) {
    browser = 'Google Chrome';
  } else if (/firefox\/|fxios\//.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/safari/.test(ua) && !/chrome|crios/.test(ua)) {
    browser = 'Apple Safari';
  } else if (/opr\/|opera/.test(ua)) {
    browser = 'Opera';
  }

  return {
    type,
    os,
    browser,
    isMobile: type === 'mobile' || type === 'tablet',
  };
}

/**
 * Known Datacenter / Commercial VPN ASNs and Organizations
 */
const KNOWN_VPN_KEYWORDS = [
  'amazon', 'aws', 'google cloud', 'digitalocean', 'linode', 'ovh',
  'cloudflare', 'm247', 'datacamp', 'leaseweb', 'hetzner', 'choopa',
  'vultr', 'nordvpn', 'expressvpn', 'surfshark', 'mullvad', 'protonvpn',
  'tor exit', 'vpn', 'hosting', 'datacenter', 'shadowsocks', 'wireguard'
];

/**
 * Fetch IP Geolocation and check VPN / Proxy flags
 */
export async function lookupIpInfo(ip) {
  if (isPrivateIp(ip)) {
    return {
      country: 'Local Network',
      countryCode: 'LAN',
      region: 'Local Subnet',
      city: 'Local Area / Intranet',
      postal: '000000',
      lat: 17.3850,
      lon: 78.4867,
      isp: 'Local Development / Loopback Host',
      org: 'Private Local Machine',
      asn: 'AS-PRIVATE',
      isMobile: false,
      isVpnOrProxy: false,
      vpnIndicators: [],
      queryIp: ip,
    };
  }

  // Check cache
  const cached = ipGeoCache.get(ip);
  if (cached && Date.now() - cached.cachedAt < GEO_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,query`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        const vpnIndicators = [];
        if (data.proxy === true) vpnIndicators.push('Proxy / Anonymizer Flag Active');
        if (data.hosting === true) vpnIndicators.push('Datacenter / Cloud Server IP');

        const orgLower = `${data.isp || ''} ${data.org || ''} ${data.as || ''}`.toLowerCase();
        for (const kw of KNOWN_VPN_KEYWORDS) {
          if (orgLower.includes(kw)) {
            vpnIndicators.push(`Matched VPN/Cloud Infrastructure: ${kw.toUpperCase()}`);
            break;
          }
        }

        const isVpnOrProxy = data.proxy === true || data.hosting === true || vpnIndicators.length > 0;

        const result = {
          country: data.country || 'Unknown Country',
          countryCode: data.countryCode || '??',
          region: data.regionName || data.region || 'Unknown Region',
          city: data.city || 'Unknown City',
          postal: data.zip || '',
          lat: typeof data.lat === 'number' ? data.lat : null,
          lon: typeof data.lon === 'number' ? data.lon : null,
          timezone: data.timezone || 'UTC',
          isp: data.isp || 'Unknown ISP',
          org: data.org || 'Unknown Org',
          asn: data.as || 'Unknown ASN',
          isMobile: Boolean(data.mobile),
          isVpnOrProxy,
          vpnIndicators,
          queryIp: data.query || ip,
        };

        ipGeoCache.set(ip, { cachedAt: Date.now(), data: result });
        return result;
      }
    }
  } catch (err) {
    // Graceful fallback if external lookup fails
  }

  // Fallback if lookup failed
  const fallback = {
    country: 'Unresolved Geolocation',
    countryCode: '??',
    region: 'Network Route Available',
    city: 'Direct IP Route',
    postal: '',
    lat: null,
    lon: null,
    timezone: 'UTC',
    isp: 'Direct Route Carrier',
    org: 'Standard Carrier',
    asn: 'N/A',
    isMobile: false,
    isVpnOrProxy: false,
    vpnIndicators: [],
    queryIp: ip,
  };
  ipGeoCache.set(ip, { cachedAt: Date.now(), data: fallback });
  return fallback;
}

/**
 * Record a security access event into the audit trail
 */
export async function recordSecurityAccessEvent(req, extraClientData = {}) {
  const clientIp = getClientIp(req);
  const uaString = extraClientData.userAgent || req.headers['user-agent'] || '';
  const deviceInfo = parseUserAgent(uaString);

  // Check headers for proxy or VPN indicators
  const headerVpnIndicators = [];
  if (req.headers['via']) headerVpnIndicators.push(`Via Header: ${req.headers['via']}`);
  if (req.headers['x-forwarded-for'] && String(req.headers['x-forwarded-for']).includes(',')) {
    headerVpnIndicators.push('Multi-hop Forwarded Proxy Chain');
  }
  if (req.headers['proxy-connection']) headerVpnIndicators.push('Proxy-Connection Header Present');

  // Lookup Geo & Network info
  const geoInfo = await lookupIpInfo(clientIp);
  const combinedVpnIndicators = Array.from(new Set([...geoInfo.vpnIndicators, ...headerVpnIndicators]));
  const isVpnOrProxy = geoInfo.isVpnOrProxy || headerVpnIndicators.length > 0;

  const urlPath = extraClientData.fullUrl || req.url || '/';

  const record = {
    id: `sec-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    clientIp,
    method: req.method || 'GET',
    path: (req.url || '/').split('?')[0],
    fullUrl: urlPath,
    referrer: extraClientData.referrer || req.headers['referer'] || req.headers['origin'] || 'Direct / None',
    device: {
      type: extraClientData.isMobile !== undefined ? (extraClientData.isMobile ? 'mobile' : 'desktop') : deviceInfo.type,
      os: extraClientData.platform || deviceInfo.os,
      browser: deviceInfo.browser,
      isMobile: extraClientData.isMobile !== undefined ? Boolean(extraClientData.isMobile) : deviceInfo.isMobile,
    },
    network: {
      ...geoInfo,
      isVpnOrProxy,
      vpnIndicators: combinedVpnIndicators,
    },
    clientTelemetry: {
      webRtcIps: Array.isArray(extraClientData.webRtcIps) ? extraClientData.webRtcIps : [],
      screen: extraClientData.screen || null,
      timezone: extraClientData.timezone || geoInfo.timezone || null,
      language: extraClientData.language || req.headers['accept-language'] || null,
      connectionType: extraClientData.connectionType || null,
      downlinkMb: extraClientData.downlinkMb || null,
      rttMs: extraClientData.rttMs || null,
      hardwareConcurrency: extraClientData.hardwareConcurrency || null,
      deviceMemory: extraClientData.deviceMemory || null,
    },
  };

  // Add to in-memory buffer
  inMemoryLogs.push(record);
  if (inMemoryLogs.length > MAX_IN_MEMORY_LOGS) {
    inMemoryLogs.shift();
  }

  // Persist asynchronously to disk
  try {
    fs.appendFile(AUDIT_LOG_FILE, JSON.stringify(record) + '\n', 'utf8', (err) => {
      if (err) console.warn('[SecurityAudit] Error writing log to disk:', err.message);
    });
  } catch (err) {
    console.warn('[SecurityAudit] Disk write exception:', err);
  }

  return record;
}

/**
 * Get current audit logs and summarized stats
 */
export function getSecurityAuditData() {
  const records = [...inMemoryLogs].reverse(); // newest first
  const uniqueIps = new Set(records.map(r => r.clientIp));
  const vpnCount = records.filter(r => r.network.isVpnOrProxy).length;
  const mobileCount = records.filter(r => r.device.isMobile).length;

  return {
    status: 'ACTIVE_AUDITING',
    incidentActive: true,
    totalVisits: records.length,
    uniqueIpCount: uniqueIps.size,
    vpnFlaggedCount: vpnCount,
    mobileCount,
    logFile: AUDIT_LOG_FILE,
    records,
  };
}

/**
 * Generate CSV forensic dossier for legal/security submission
 */
export function generateSecurityAuditCsv() {
  const headers = [
    'Event ID',
    'Timestamp (UTC)',
    'Client IP',
    'VPN / Proxy Flag',
    'VPN Indicators',
    'Country',
    'Region/State',
    'City',
    'Latitude',
    'Longitude',
    'ISP / Carrier',
    'Organization / ASN',
    'Device Type',
    'OS',
    'Browser',
    'Target Link / Path',
    'Referrer Link',
    'WebRTC Leaked IPs',
    'Timezone',
    'Screen Resolution',
  ];

  const rows = inMemoryLogs.map(r => [
    r.id,
    r.timestamp,
    r.clientIp,
    r.network.isVpnOrProxy ? 'YES (SUSPECT)' : 'NO (DIRECT)',
    `"${(r.network.vpnIndicators || []).join('; ').replace(/"/g, '""')}"`,
    `"${(r.network.country || '').replace(/"/g, '""')}"`,
    `"${(r.network.region || '').replace(/"/g, '""')}"`,
    `"${(r.network.city || '').replace(/"/g, '""')}"`,
    r.network.lat ?? '',
    r.network.lon ?? '',
    `"${(r.network.isp || '').replace(/"/g, '""')}"`,
    `"${(r.network.asn || '').replace(/"/g, '""')}"`,
    r.device.type,
    `"${(r.device.os || '').replace(/"/g, '""')}"`,
    `"${(r.device.browser || '').replace(/"/g, '""')}"`,
    `"${(r.fullUrl || r.path || '').replace(/"/g, '""')}"`,
    `"${(r.referrer || '').replace(/"/g, '""')}"`,
    `"${(r.clientTelemetry?.webRtcIps || []).join(', ')}"`,
    r.clientTelemetry?.timezone || '',
    r.clientTelemetry?.screen || '',
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
}

/**
 * Clear in-memory and disk logs
 */
export function clearSecurityAuditLogs() {
  inMemoryLogs = [];
  try {
    fs.writeFileSync(AUDIT_LOG_FILE, '', 'utf8');
  } catch (err) {
    console.warn('[SecurityAudit] Failed to truncate audit log file:', err);
  }
}



/**
 * Record a user authentication/login event (especially from mobile devices)
 */
export async function recordSecurityLoginEvent(req, payload = {}) {
  const clientIp = getClientIp(req);
  const uaString = payload.userAgent || req.headers['user-agent'] || '';
  const deviceInfo = parseUserAgent(uaString);
  const geoInfo = await lookupIpInfo(clientIp);

  const user = payload.user || {
    id: 'guest',
    name: 'Guest User',
    email: '',
    provider: 'guest',
  };

  const isMobile = payload.isMobile !== undefined ? Boolean(payload.isMobile) : deviceInfo.isMobile;

  const loginRecord = {
    id: `login-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    eventType: 'USER_LOGIN',
    user: {
      id: user.id || 'unknown',
      name: user.name || 'Anonymous User',
      email: user.email || '',
      provider: user.provider || 'direct',
    },
    clientIp,
    device: {
      type: isMobile ? 'mobile' : deviceInfo.type,
      os: payload.platform || deviceInfo.os,
      browser: deviceInfo.browser,
      isMobile,
    },
    network: {
      country: geoInfo.country,
      region: geoInfo.region,
      city: geoInfo.city,
      lat: geoInfo.lat,
      lon: geoInfo.lon,
      isp: geoInfo.isp,
      isVpnOrProxy: geoInfo.isVpnOrProxy,
      vpnIndicators: geoInfo.vpnIndicators || [],
    },
    clientTelemetry: {
      screen: payload.screen || null,
      timezone: payload.timezone || geoInfo.timezone || null,
      language: payload.language || null,
      webRtcIps: Array.isArray(payload.webRtcIps) ? payload.webRtcIps : [],
    },
  };

  inMemoryLogins.push(loginRecord);
  if (inMemoryLogins.length > MAX_IN_MEMORY_LOGS) inMemoryLogins.shift();

  // Also include in the general audit trail
  inMemoryLogs.push({
    ...loginRecord,
    method: 'POST',
    path: '/api/auth/login',
    fullUrl: payload.fullUrl || '/#login',
    referrer: payload.referrer || 'Mobile Auth Session',
  });
  if (inMemoryLogs.length > MAX_IN_MEMORY_LOGS) inMemoryLogs.shift();

  try {
    fs.appendFile(LOGINS_LOG_FILE, JSON.stringify(loginRecord) + '\n', 'utf8', () => {});
    fs.appendFile(AUDIT_LOG_FILE, JSON.stringify(loginRecord) + '\n', 'utf8', () => {});
  } catch (err) {
    console.warn('[SecurityAudit] Failed to write login to disk:', err);
  }

  return loginRecord;
}

/**
 * Retrieve recorded login history
 */
export function getSecurityLoginsData() {
  return {
    status: 'ok',
    totalLogins: inMemoryLogins.length,
    logins: [...inMemoryLogins].reverse(),
  };
}

