import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUserAgent,
  isPrivateIp,
  getClientIp,
  recordSecurityAccessEvent,
  recordSecurityLoginEvent,
  getSecurityAuditData,
  getSecurityLoginsData,
  generateSecurityAuditCsv,
  clearSecurityAuditLogs,
} from '../../../server/securityAuditCore.js';

test('parseUserAgent accurately classifies mobile vs desktop and OS', () => {
  // Mobile iPhone
  const iphoneUa =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const iphoneRes = parseUserAgent(iphoneUa);
  assert.equal(iphoneRes.type, 'mobile');
  assert.equal(iphoneRes.isMobile, true);
  assert.equal(iphoneRes.os, 'iOS 17.4');
  assert.equal(iphoneRes.browser, 'Apple Safari');

  // Mobile Android
  const androidUa =
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
  const androidRes = parseUserAgent(androidUa);
  assert.equal(androidRes.type, 'mobile');
  assert.equal(androidRes.isMobile, true);
  assert.equal(androidRes.os, 'Android 14');
  assert.equal(androidRes.browser, 'Google Chrome');

  // Desktop Windows
  const winUa =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const winRes = parseUserAgent(winUa);
  assert.equal(winRes.type, 'desktop');
  assert.equal(winRes.isMobile, false);
  assert.equal(winRes.os, 'Windows 10/11');
  assert.equal(winRes.browser, 'Google Chrome');
});

test('isPrivateIp accurately isolates LAN/loopback from public routable IPs', () => {
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('::1'), true);
  assert.equal(isPrivateIp('localhost'), true);
  assert.equal(isPrivateIp('192.168.1.100'), true);
  assert.equal(isPrivateIp('10.0.4.1'), true);

  assert.equal(isPrivateIp('8.8.8.8'), false);
  assert.equal(isPrivateIp('49.204.0.1'), false);
  assert.equal(isPrivateIp('142.250.190.46'), false);
});

test('getClientIp prioritizes Cloudflare and reverse-proxy headers over direct socket', () => {
  const reqWithCf = {
    headers: {
      'cf-connecting-ip': '203.0.113.195',
      'x-forwarded-for': '198.51.100.1, 10.0.0.1',
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
  const ip = getClientIp(reqWithCf);
  assert.equal(ip, '198.51.100.1');

  const reqDirect = {
    headers: {},
    socket: { remoteAddress: '::ffff:198.51.100.22' },
  };
  assert.equal(getClientIp(reqDirect), '198.51.100.22');
});

test('recordSecurityAccessEvent records forensic payload and aggregates in audit ledger', async () => {
  clearSecurityAuditLogs();

  const mockReq = {
    method: 'GET',
    url: '/?ref=telegram_field_alert#farm=ashoknagar',
    headers: {
      'x-forwarded-for': '49.204.0.1',
      'user-agent':
        'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
      referer: 'https://web.telegram.org/',
    },
  };

  const clientTelemetry = {
    fullUrl: 'https://sevagis.dpdns.org/?ref=telegram_field_alert#farm=ashoknagar',
    referrer: 'https://web.telegram.org/',
    screen: '1080x2400 (DPR: 2.75)',
    timezone: 'Asia/Kolkata',
    webRtcIps: ['192.168.29.14'],
  };

  const record = await recordSecurityAccessEvent(mockReq, clientTelemetry);

  assert.ok(record.id.startsWith('sec-'));
  assert.equal(record.clientIp, '49.204.0.1');
  assert.equal(record.device.type, 'mobile');
  assert.equal(record.device.isMobile, true);
  assert.equal(record.clientTelemetry.screen, '1080x2400 (DPR: 2.75)');
  assert.deepEqual(record.clientTelemetry.webRtcIps, ['192.168.29.14']);

  const auditData = getSecurityAuditData();
  assert.ok(auditData.totalVisits >= 1);
  assert.ok(auditData.uniqueIpCount >= 1);
  assert.ok(auditData.mobileCount >= 1);

  const csv = generateSecurityAuditCsv();
  assert.ok(csv.includes('Event ID,Timestamp (UTC),Client IP,VPN / Proxy Flag'));
  assert.ok(csv.includes('49.204.0.1'));
  assert.ok(csv.includes('192.168.29.14'));
});

test('recordSecurityLoginEvent records mobile user sign-in event with device & network metadata', async () => {
  const mockReq = {
    method: 'POST',
    url: '/api/security/login',
    headers: {
      'x-forwarded-for': '49.204.0.1',
      'user-agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    },
  };

  const payload = {
    user: {
      id: 'usr-mobile-01',
      name: 'Dr. Ramesh (Agronomist)',
      email: 'ramesh.agri@gmail.com',
      provider: 'google',
    },
    platform: 'iPhone',
    isMobile: true,
    screen: '393x852 (DPR: 3)',
    timezone: 'Asia/Kolkata',
    webRtcIps: ['10.0.0.88'],
  };

  const loginRec = await recordSecurityLoginEvent(mockReq, payload);

  assert.ok(loginRec.id.startsWith('login-'));
  assert.equal(loginRec.eventType, 'USER_LOGIN');
  assert.equal(loginRec.user.name, 'Dr. Ramesh (Agronomist)');
  assert.equal(loginRec.user.email, 'ramesh.agri@gmail.com');
  assert.equal(loginRec.device.isMobile, true);
  assert.equal(loginRec.device.os, 'iPhone');
  assert.equal(loginRec.clientIp, '49.204.0.1');

  const loginsSummary = getSecurityLoginsData();
  assert.ok(loginsSummary.totalLogins >= 1);
  const found = loginsSummary.logins.find(l => l.id === loginRec.id);
  assert.ok(found);
  assert.equal(found.user.email, 'ramesh.agri@gmail.com');
});
