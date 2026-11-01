import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRemoteScoutSession,
  checkScoutBeaconStatus,
  submitGroundBeaconPayload,
  generateWhatsAppScoutInvite,
  generateSmsScoutInvite,
  type GroundScoutPayload,
} from '../scoutBeaconService';

test('createRemoteScoutSession creates a valid session with shareable URL', async () => {
  const result = await createRemoteScoutSession('Guntur Mirchi Yard', 'Stand by borewell');
  assert.ok(result.sessionId.startsWith('scout_'), 'Session ID should start with scout_');
  assert.ok(result.shareUrl.includes('?scoutSession=' + result.sessionId), 'Share URL should contain scoutSession query param');
  assert.equal(result.session.status, 'waiting');
  assert.equal(result.session.label, 'Guntur Mirchi Yard');
  assert.equal(result.session.requesterNote, 'Stand by borewell');
});

test('generateWhatsAppScoutInvite formats valid WhatsApp sharing URL', () => {
  const shareUrl = 'https://sevagis.dpdns.org/?scoutSession=scout_12345';
  const waUrl = generateWhatsAppScoutInvite(shareUrl, 'Plot 42');
  assert.ok(waUrl.startsWith('https://wa.me/?text='), 'Should start with wa.me text endpoint');
  assert.ok(waUrl.includes(encodeURIComponent(shareUrl)), 'Should encode the share URL');
  assert.ok(waUrl.includes(encodeURIComponent('Plot 42')), 'Should include plot name');
});

test('generateSmsScoutInvite formats standard sms protocol URI', () => {
  const shareUrl = 'https://sevagis.dpdns.org/?scoutSession=scout_12345';
  const smsUri = generateSmsScoutInvite('+91 98765 43210', shareUrl, 'My Farm');
  assert.ok(smsUri.startsWith('sms:+919876543210?body='), 'Should format phone and body param');
  assert.ok(smsUri.includes(encodeURIComponent(shareUrl)), 'Should encode share URL in SMS');
});

test('submitGroundBeaconPayload updates session with GPS coordinates and DIGIPIN', async () => {
  const session = await createRemoteScoutSession('Warangal Cotton Field');
  const payload: GroundScoutPayload = {
    sessionId: session.sessionId,
    latitude: 17.9689,
    longitude: 79.5941,
    accuracy: 1.6,
    altitude: 275,
    heading: 45,
    digipin: '',
    scoutName: 'Ramesh Ground Scout',
    notes: 'Standing on north-east bund',
    photoBase64: 'data:image/jpeg;base64,placeholder',
  };

  const submitRes = await submitGroundBeaconPayload(payload);
  assert.equal(submitRes.success, true);

  const status = await checkScoutBeaconStatus(session.sessionId);
  assert.ok(status, 'Status should be retrievable');
  assert.equal(status?.status, 'completed');
  assert.equal(status?.data?.latitude, 17.9689);
  assert.equal(status?.data?.longitude, 79.5941);
  assert.equal(status?.data?.scoutName, 'Ramesh Ground Scout');
  assert.ok(status?.data?.digipin && status?.data?.digipin.length >= 8, 'Should auto-calculate DIGIPIN');
});

test('submitGroundBeaconPayload rejects invalid coordinates', async () => {
  const res = await submitGroundBeaconPayload({
    sessionId: '',
    latitude: NaN,
    longitude: NaN,
    accuracy: null,
    altitude: null,
    heading: null,
    digipin: '',
  });
  assert.equal(res.success, false);
});
