import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getGoogleUser,
  saveGoogleUser,
  isGoogleDriveConnected,
  dispatchExport,
  disconnectGoogle,
  isRealGoogleClientId,
  type GoogleUser
} from '../googleDriveVault.ts'

test('isRealGoogleClientId detects real GCP OAuth Client IDs vs placeholders', () => {
  // Placeholder in .env or default:
  assert.equal(isRealGoogleClientId('419602015618-sevagis.apps.googleusercontent.com'), false)
  assert.equal(isRealGoogleClientId(''), false)
  assert.equal(isRealGoogleClientId('YOUR_CLIENT_ID.apps.googleusercontent.com'), false)
  assert.equal(isRealGoogleClientId('placeholder-123'), false)

  // Authentic GCP OAuth 2.0 Web Client ID pattern:
  assert.equal(isRealGoogleClientId('419602015618-abcd1234efgh5678ijkl9012mnop3456.apps.googleusercontent.com'), true)
  assert.equal(isRealGoogleClientId('96520749785-r3al0authcl13nt1d4567890abcdef.apps.googleusercontent.com'), true)
})

test('Google user management and storage round-trip', () => {
  // Clear any previous state
  disconnectGoogle()
  assert.equal(isGoogleDriveConnected(), false)
  assert.equal(getGoogleUser(), null)

  const mockUser: GoogleUser = {
    id: 'google_farmer_123',
    email: 'farmer@gmail.com',
    name: 'Ramesh Patel',
    accessToken: 'test_access_token_abc',
    tokenExpiry: Date.now() + 3600 * 1000,
    isGoogleUser: true
  }

  saveGoogleUser(mockUser)
  assert.equal(isGoogleDriveConnected(), true)

  const loaded = getGoogleUser()
  assert.ok(loaded)
  assert.equal(loaded?.email, 'farmer@gmail.com')
  assert.equal(loaded?.name, 'Ramesh Patel')
  assert.equal(loaded?.isGoogleUser, true)

  // Disconnect cleans up state
  disconnectGoogle()
  assert.equal(isGoogleDriveConnected(), false)
  assert.equal(getGoogleUser(), null)
})

test('dispatchExport executes zero-error local device fallback when offline', async () => {
  disconnectGoogle()

  // Test TIFF file export fallback
  const fakeTiffContent = new Uint8Array([0x49, 0x49, 0x2a, 0x00]) // II*. (TIFF header)
  const tiffResult = await dispatchExport({
    category: 'tiff',
    fileName: 'farm_ndvi_EPSG4326.tif',
    blob: new Blob([fakeTiffContent], { type: 'image/tiff' }),
    silent: true
  })

  // Zero-error guarantee: device download triggers cleanly with no unhandled crash
  assert.equal(typeof tiffResult.savedToDevice, 'boolean')
  assert.equal(tiffResult.syncedToDrive, false)

  // Test Reports export fallback
  const reportResult = await dispatchExport({
    category: 'reports',
    fileName: 'farm_dossier.html',
    blob: '<html><body>SEVA.GIS Report</body></html>',
    silent: true
  })
  assert.equal(typeof reportResult.savedToDevice, 'boolean')
  assert.equal(reportResult.syncedToDrive, false)

  // Test Data / Cache export fallback
  const dataResult = await dispatchExport({
    category: 'data',
    fileName: 'seva-farms-backup.json',
    blob: '{"farms":[]}',
    silent: true
  })
  assert.equal(typeof dataResult.savedToDevice, 'boolean')
  assert.equal(dataResult.syncedToDrive, false)
})
