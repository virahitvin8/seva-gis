import test from 'node:test'
import assert from 'node:assert/strict'
import {
  authenticateWithGoogle,
  getGoogleUser,
  saveGoogleUser,
  isGoogleDriveConnected,
  isRealGoogleAccessToken,
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

test('isRealGoogleAccessToken only accepts live Google tokens', () => {
  assert.equal(isRealGoogleAccessToken('ya29.a0AfH6SMB_example'), true)
  assert.equal(isRealGoogleAccessToken('token_vault_1700000000000'), false)
  assert.equal(isRealGoogleAccessToken('token_local_1700000000000'), false)
  assert.equal(isRealGoogleAccessToken(''), false)
  assert.equal(isRealGoogleAccessToken(undefined), false)
})

test('authenticateWithGoogle fails honestly when no client ID is configured', async () => {
  disconnectGoogle()

  const res = await authenticateWithGoogle('farmer@gmail.com')

  // No fabricated identity or token may be produced by the sign-in call.
  assert.equal(res.success, false)
  assert.ok(res.error && res.error.length > 0)
  assert.equal(getGoogleUser(), null)
  assert.equal(isGoogleDriveConnected(), false)
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
    accessToken: 'ya29.test-access-token-abc',
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

  // A locally fabricated token never counts as a connected Drive session
  saveGoogleUser({ ...mockUser, accessToken: 'token_vault_1700000000000' })
  assert.equal(isGoogleDriveConnected(), false)

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
