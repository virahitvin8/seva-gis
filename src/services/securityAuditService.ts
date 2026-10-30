/**
 * SEVA.GIS Client Security Breach & Access Telemetry Service
 *
 * Captures real-time visitor connection metadata (IP addresses, VPN/Proxy indicators,
 * geolocation coordinates, WebRTC candidate leaks, device & browser environments)
 * whenever any link or page is opened in the web portal on mobile, tablet, or desktop.
 */

export interface SecurityAuditRecord {
  id: string;
  timestamp: string;
  clientIp: string;
  method: string;
  path: string;
  fullUrl: string;
  referrer: string;
  device: {
    type: 'mobile' | 'tablet' | 'desktop' | 'bot';
    os: string;
    browser: string;
    isMobile: boolean;
  };
  network: {
    country: string;
    countryCode: string;
    region: string;
    city: string;
    postal?: string;
    lat: number | null;
    lon: number | null;
    timezone?: string;
    isp: string;
    org: string;
    asn: string;
    isMobile: boolean;
    isVpnOrProxy: boolean;
    vpnIndicators: string[];
    queryIp?: string;
  };
  clientTelemetry?: {
    webRtcIps?: string[];
    screen?: string;
    timezone?: string;
    language?: string;
    connectionType?: string;
    downlinkMb?: number;
    rttMs?: number;
    hardwareConcurrency?: number;
    deviceMemory?: number;
  };
}

export interface SecurityAuditSummary {
  status: string;
  incidentActive: boolean;
  totalVisits: number;
  uniqueIpCount: number;
  vpnFlaggedCount: number;
  mobileCount: number;
  logFile?: string;
  records: SecurityAuditRecord[];
}

const LOCAL_STORAGE_KEY = 'seva_security_breach_records';
const LAST_TELEMETRY_KEY = 'seva_last_telemetry_ts';

/**
 * Gather WebRTC IP candidate leaks (detects actual interface/local IPs behind VPNs)
 */
export async function discoverWebRtcIps(timeoutMs = 1800): Promise<string[]> {
  const discovered = new Set<string>();

  try {
    const RTCPC =
      window.RTCPeerConnection ||
      (window as unknown as { webkitRTCPeerConnection?: typeof RTCPeerConnection }).webkitRTCPeerConnection;
    if (!RTCPC) return [];

    const pc = new RTCPC({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.createDataChannel('seva-audit-probe');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        try {
          pc.close();
        } catch {}
        resolve();
      }, timeoutMs);

      pc.onicecandidate = (event) => {
        if (!event || !event.candidate) {
          window.clearTimeout(timer);
          try {
            pc.close();
          } catch {}
          resolve();
          return;
        }

        const cand = event.candidate.candidate;
        // Regex match IPv4 or IPv6
        const match = cand.match(/([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/i);
        if (match && match[1]) {
          discovered.add(match[1]);
        }
      };
    });
  } catch (err) {
    // WebRTC candidate gathering is restricted in some strict sandboxes
  }

  return Array.from(discovered);
}

/**
 * Collect deep client device & network profile
 */
export async function collectClientSecurityData() {
  const isTouchDevice =
    'ontouchstart' in window || navigator.maxTouchPoints > 0 || (navigator as unknown as { msMaxTouchPoints: number }).msMaxTouchPoints > 0;
  const isMobileUa = /mobile|iphone|ipod|android|blackberry|iemobile|kindle/i.test(navigator.userAgent);
  const isMobile = isTouchDevice && isMobileUa;

  const conn = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number; rtt?: number } }).connection;

  let webRtcIps: string[] = [];
  try {
    webRtcIps = await discoverWebRtcIps(1600);
  } catch {}

  const telemetry = {
    fullUrl: window.location.href,
    referrer: document.referrer || 'Direct Link / Portal Bookmark',
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'Unknown Platform',
    isMobile,
    screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0} (DPR: ${window.devicePixelRatio ?? 1})`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    language: navigator.languages ? navigator.languages.join(', ') : navigator.language || 'en',
    connectionType: conn?.effectiveType || 'standard',
    downlinkMb: conn?.downlink,
    rttMs: conn?.rtt,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
    webRtcIps,
  };

  return telemetry;
}

/**
 * Automatically record and dispatch security audit telemetry for the current link opener
 */
export async function recordPortalAccessTelemetry(): Promise<SecurityAuditRecord | null> {
  try {
    // Avoid double posting in the exact same millisecond window
    const now = Date.now();
    const lastStr = sessionStorage.getItem(LAST_TELEMETRY_KEY);
    if (lastStr && now - parseInt(lastStr, 10) < 1000) {
      return null;
    }
    sessionStorage.setItem(LAST_TELEMETRY_KEY, String(now));

    const payload = await collectClientSecurityData();

    // Send to backend telemetry API
    const res = await fetch('/api/security/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.recorded) {
        saveRecordToLocalCache(data.recorded);
        return data.recorded as SecurityAuditRecord;
      }
    }
  } catch (err) {
    // If backend proxy unreachable, do direct public IP lookup fallback
    try {
      const ipRes = await fetch('https://ipapi.co/json/');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        const fallbackRecord: SecurityAuditRecord = {
          id: `sec-local-${Date.now()}`,
          timestamp: new Date().toISOString(),
          clientIp: ipData.ip || '127.0.0.1',
          method: 'GET',
          path: window.location.pathname,
          fullUrl: window.location.href,
          referrer: document.referrer || 'Direct Link',
          device: {
            type: /mobile|android|iphone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            os: navigator.platform || 'Unknown',
            browser: navigator.userAgent,
            isMobile: /mobile|android|iphone/i.test(navigator.userAgent),
          },
          network: {
            country: ipData.country_name || 'Unknown',
            countryCode: ipData.country_code || '??',
            region: ipData.region || 'Unknown',
            city: ipData.city || 'Unknown',
            postal: ipData.postal,
            lat: ipData.latitude || null,
            lon: ipData.longitude || null,
            timezone: ipData.timezone,
            isp: ipData.org || 'Standard ISP',
            org: ipData.org || '',
            asn: ipData.asn || '',
            isMobile: false,
            isVpnOrProxy: false,
            vpnIndicators: [],
          },
          clientTelemetry: {
            screen: `${window.screen?.width}x${window.screen?.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
          },
        };
        saveRecordToLocalCache(fallbackRecord);
        return fallbackRecord;
      }
    } catch {}
  }

  return null;
}

/**
 * Save record into client-side offline storage
 */
function saveRecordToLocalCache(record: SecurityAuditRecord) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: SecurityAuditRecord[] = raw ? JSON.parse(raw) : [];
    // Prepend new record, cap at 500
    list.unshift(record);
    if (list.length > 500) list.pop();
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Fetch all security audit records and aggregated metrics
 */
export async function fetchSecurityAuditSummary(): Promise<SecurityAuditSummary> {
  try {
    const res = await fetch('/api/security/audit', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.records)) {
        return data as SecurityAuditSummary;
      }
    }
  } catch (err) {
    // Network fallback to local cache
  }

  // Load from local storage if server unreachable
  const localList: SecurityAuditRecord[] = (() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();

  const uniqueIps = new Set(localList.map((r) => r.clientIp));
  const vpnCount = localList.filter((r) => r.network.isVpnOrProxy).length;
  const mobileCount = localList.filter((r) => r.device.isMobile).length;

  return {
    status: 'LOCAL_FALLBACK_ACTIVE',
    incidentActive: true,
    totalVisits: localList.length,
    uniqueIpCount: uniqueIps.size,
    vpnFlaggedCount: vpnCount,
    mobileCount,
    records: localList,
  };
}

/**
 * Clear security breach audit logs
 */
export async function clearSecurityLogs(): Promise<boolean> {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    await fetch('/api/security/clear', { method: 'POST' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Download forensic audit CSV file
 */
export function triggerCsvExport() {
  window.open('/api/security/export?format=csv', '_blank');
}

/**
 * Download forensic audit JSON file
 */
export function triggerJsonExport() {
  window.open('/api/security/export?format=json', '_blank');
}



export interface UserLoginRecord {
  id: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
    email: string;
    provider: string;
  };
  clientIp?: string;
  device?: {
    type: string;
    os: string;
    browser: string;
    isMobile: boolean;
  };
  network?: {
    country: string;
    region: string;
    city: string;
    isp: string;
    isVpnOrProxy: boolean;
  };
}

const LOCAL_LOGIN_KEY = 'seva_mobile_logins';

/**
 * Record user sign-in / login event (especially on mobile devices)
 */
export async function recordUserLogin(user: { id?: string; name?: string; email?: string; provider?: string }): Promise<UserLoginRecord> {
  try {
    const telemetry = await collectClientSecurityData();
    const payload = {
      user: {
        id: user.id || 'guest',
        name: user.name || 'Guest User',
        email: user.email || '',
        provider: user.provider || 'direct',
      },
      ...telemetry,
    };

    const res = await fetch('/api/security/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let recordedLogin: any = null;
    if (res.ok) {
      const data = await res.json();
      recordedLogin = data?.login;
    }

    const fallbackRecord: UserLoginRecord = recordedLogin || {
      id: `login-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: {
        id: user.id || 'guest',
        name: user.name || 'Guest User',
        email: user.email || '',
        provider: user.provider || 'direct',
      },
      device: {
        type: telemetry.isMobile ? 'mobile' : 'desktop',
        os: telemetry.platform,
        browser: telemetry.userAgent,
        isMobile: telemetry.isMobile,
      },
    };

    saveLoginToLocalCache(fallbackRecord);
    return fallbackRecord;
  } catch {
    const localRecord: UserLoginRecord = {
      id: `login-offline-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: {
        id: user.id || 'guest',
        name: user.name || 'Guest User',
        email: user.email || '',
        provider: user.provider || 'direct',
      },
      device: {
        type: /mobile|android|iphone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        os: navigator.platform,
        browser: navigator.userAgent,
        isMobile: /mobile|android|iphone/i.test(navigator.userAgent),
      },
    };
    saveLoginToLocalCache(localRecord);
    return localRecord;
  }
}

function saveLoginToLocalCache(record: UserLoginRecord) {
  try {
    const raw = localStorage.getItem(LOCAL_LOGIN_KEY);
    const list: UserLoginRecord[] = raw ? JSON.parse(raw) : [];
    list.unshift(record);
    if (list.length > 100) list.pop();
    localStorage.setItem(LOCAL_LOGIN_KEY, JSON.stringify(list));
  } catch {}
}

export async function fetchLoginHistory(): Promise<UserLoginRecord[]> {
  try {
    const res = await fetch('/api/security/logins', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.logins) && data.logins.length > 0) {
        return data.logins;
      }
    }
  } catch {}

  try {
    const raw = localStorage.getItem(LOCAL_LOGIN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

