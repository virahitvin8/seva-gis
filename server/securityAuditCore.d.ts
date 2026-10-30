export interface DeviceInfo {
  type: string;
  os: string;
  browser: string;
  isMobile: boolean;
}

export interface NetworkInfo {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  postal: string;
  lat: number | null;
  lon: number | null;
  timezone: string;
  isp: string;
  org: string;
  asn: string;
  isMobile: boolean;
  isVpnOrProxy: boolean;
  vpnIndicators: string[];
  queryIp: string;
}

export interface SecurityRecord {
  id: string;
  timestamp: string;
  clientIp: string;
  method: string;
  path: string;
  fullUrl: string;
  referrer: string;
  device: DeviceInfo;
  network: NetworkInfo;
  clientTelemetry: Record<string, any>;
}

export interface SecurityLoginRecord {
  id: string;
  timestamp: string;
  eventType: string;
  user: {
    id: string;
    name: string;
    email: string;
    provider: string;
  };
  clientIp: string;
  device: DeviceInfo;
  network: Partial<NetworkInfo>;
  clientTelemetry: Record<string, any>;
}

export interface SecurityAuditData {
  status: string;
  incidentActive: boolean;
  totalVisits: number;
  uniqueIpCount: number;
  vpnFlaggedCount: number;
  mobileCount: number;
  logFile: string;
  records: SecurityRecord[];
}

export interface SecurityLoginsData {
  status: string;
  totalLogins: number;
  logins: SecurityLoginRecord[];
}

export function getClientIp(req: any): string;
export function isPrivateIp(ip: string): boolean;
export function parseUserAgent(uaString: string): DeviceInfo;
export function lookupIpInfo(ip: string): Promise<NetworkInfo>;
export function recordSecurityAccessEvent(req: any, extraClientData?: any): Promise<SecurityRecord>;
export function recordSecurityLoginEvent(req: any, payload?: any): Promise<SecurityLoginRecord>;
export function getSecurityAuditData(): SecurityAuditData;
export function getSecurityLoginsData(): SecurityLoginsData;
export function generateSecurityAuditCsv(): string;
export function clearSecurityAuditLogs(): { status: string; clearedCount: number; timestamp: string };
