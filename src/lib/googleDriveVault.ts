/**
 * SEVA·GIS — Google Drive Cloud Vault & Zero-Error Device Storage Dispatcher
 * 
 * Implements automated cloud organization + offline device fallback:
 * 1. Google Identity Services (GIS) / OAuth 2.0 Sign-in & Authentication.
 * 2. Automated Google Drive Folder Structure:
 *    - Root: "SEVA GIS"
 *    - Subfolders:
 *      - "TIFF Files" (Float32 EPSG:4326 GeoTIFF analytical rasters)
 *      - "Images" (High-resolution CartoMap PNGs, visual plots, plots)
 *      - "Reports" (Academic reports, HTML, PDF, Word .doc dossiers)
 *      - "User Data & Cache" (Farm boundaries, GeoJSONs, JSON backups, offline cache)
 * 3. Zero-Error Fallback Guarantee:
 *    - All downloads and exports ALWAYS automatically save to the user's mobile
 *      device or desktop downloads folder without throwing any errors.
 *    - If Google Drive is connected, files are seamlessly uploaded in parallel.
 *    - If Google Drive is unavailable, offline, or expired, failures are caught
 *      silently so the user workflow is 100% uninterrupted.
 */

export type ExportCategory = 'tiff' | 'images' | 'reports' | 'data'

export type GoogleUser = {
  id: string
  email: string
  name: string
  picture?: string
  accessToken?: string
  tokenExpiry?: number
  isGoogleUser: boolean
}

export type DriveFolders = {
  rootId: string
  tiffId: string
  imagesId: string
  reportsId: string
  dataId: string
}

export type DispatchOptions = {
  category: ExportCategory
  fileName: string
  blob: Blob | string
  mimeType?: string
  silent?: boolean
  customToast?: string
}

export type DispatchResult = {
  savedToDevice: boolean
  syncedToDrive: boolean
  driveFileId?: string
  error?: string
}

const STORAGE_KEYS = {
  USER: 'seva-google-user',
  FOLDERS: 'seva-drive-folders',
  SYNC_ENABLED: 'seva-google-drive-sync',
}

const FOLDER_NAMES: Record<ExportCategory, string> = {
  tiff: 'TIFF Files',
  images: 'Images',
  reports: 'Reports',
  data: 'User Data & Cache',
}

const DEFAULT_MIME_TYPES: Record<ExportCategory, string> = {
  tiff: 'image/tiff',
  images: 'image/png',
  reports: 'text/html',
  data: 'application/json',
}

let cachedFolders: DriveFolders | null = null
let syncDebounceTimer: any = null

const memStore = new Map<string, string>()

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(key)
    } catch {}
    return memStore.get(key) ?? null
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value)
        return
      }
    } catch {}
    memStore.set(key, value)
  },
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key)
        return
      }
    } catch {}
    memStore.delete(key)
  }
}

function safeDispatch(name: string, detail?: any): void {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(name, { detail }))
    }
  } catch {}
}

/**
 * Returns currently saved Google user profile if active and authenticated.
 */
export function getGoogleUser(): GoogleUser | null {
  try {
    const raw = safeStorage.getItem(STORAGE_KEYS.USER)
    if (!raw) return null
    const user: GoogleUser = JSON.parse(raw)
    // Check if token expired
    if (user.tokenExpiry && Date.now() > user.tokenExpiry) {
      // Token is stale; clear token but keep identity
      user.accessToken = undefined
    }
    // Tokens invented by earlier builds (token_vault_ / token_local_ / demo)
    // are not live Google sessions and must never light up Drive features.
    if (user.accessToken && !isRealGoogleAccessToken(user.accessToken)) {
      user.accessToken = undefined
    }
    return user
  } catch {
    return null
  }
}

/**
 * Saves Google user profile to localStorage and notifies listeners.
 */
export function saveGoogleUser(user: GoogleUser | null): void {
  try {
    if (user) {
      safeStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
      safeStorage.setItem(STORAGE_KEYS.SYNC_ENABLED, 'true')
    } else {
      safeStorage.removeItem(STORAGE_KEYS.USER)
      safeStorage.removeItem(STORAGE_KEYS.FOLDERS)
      cachedFolders = null
    }
    safeDispatch('seva-google-auth-change', { user })
  } catch (err) {
    console.warn('[Google Vault] Could not save Google user:', err)
  }
}

/**
 * True only while a live Google OAuth token is present. Google issues access
 * tokens prefixed "ya29."; anything else (stale demo tokens from earlier
 * builds, expired sessions) is not a connected Drive and must never be
 * reported as one.
 */
export function isRealGoogleAccessToken(token?: string): boolean {
  return Boolean(token && token.startsWith('ya29.'))
}

/**
 * Checks if Google Drive cloud sync is active and authenticated.
 */
export function isGoogleDriveConnected(): boolean {
  const user = getGoogleUser()
  return Boolean(user && user.isGoogleUser && isRealGoogleAccessToken(user.accessToken))
}

/**
 * Dynamically loads the official Google Identity Services client script.
 */
export function loadGsiScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve(true)

  return new Promise((resolve) => {
    const existing = document.getElementById('google-gsi-client')
    if (existing) {
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }

    const script = document.createElement('script')
    script.id = 'google-gsi-client'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve(true)
    script.onerror = () => {
      console.warn('[Google Vault] Could not load Google Identity Services script')
      resolve(false)
    }
    document.head.appendChild(script)
  })
}

/**
 * Resolves the Google OAuth Client ID from the deployment environment.
 *
 * Only a client ID configured via VITE_GOOGLE_CLIENT_ID is used. The previous
 * placeholder fallbacks pretended to be a Google OAuth client, which let the
 * app "sign in" with a fabricated local token instead of failing honestly.
 */
export function getGoogleClientId(): string {
  const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID
  return envId && envId.trim() ? envId.trim() : ''
}

/**
 * Verifies if the configured Client ID is an authentic Google Cloud OAuth 2.0 Web Client ID
 * rather than a placeholder string (e.g. '...-sevagis.apps.googleusercontent.com').
 */
export function isRealGoogleClientId(id: string): boolean {
  if (!id) return false
  const clean = id.trim()
  if (
    clean.includes('placeholder') ||
    clean.includes('YOUR_CLIENT_ID') ||
    clean.includes('demo') ||
    clean.includes('example') ||
    clean === '419602015618-sevagis.apps.googleusercontent.com'
  ) {
    return false
  }
  // Must match standard Google Cloud Web OAuth client ID format: 10+ digits followed by hyphen and 15+ alphanumeric/dash chars
  return /^\d{10,}-[a-zA-Z0-9_-]{15,}\.apps\.googleusercontent\.com$/i.test(clean)
}

/**
 * Triggers interactive Google OAuth 2.0 Sign-In requesting Google Drive file access.
 * Scope https://www.googleapis.com/auth/drive.file ensures access ONLY to files
 * created by SEVA.GIS, preserving complete user privacy.
 *
 * If Google sign-in is not configured for this deployment, the call fails with a
 * clear message — it never invents a user or a token. Guest mode stays available.
 */
export async function authenticateWithGoogle(customEmail?: string): Promise<{ success: boolean; user?: GoogleUser; error?: string }> {
  const clientId = getGoogleClientId()

  if (!isRealGoogleClientId(clientId)) {
    console.info('[Google Vault] Google sign-in is not configured on this deployment (VITE_GOOGLE_CLIENT_ID is missing or a placeholder).')
    return {
      success: false,
      error: 'Google sign-in is not configured on this deployment. Continue with Guest Mode or email sign-up — exports still save to this device.',
    }
  }

  try {
    const gsiLoaded = await loadGsiScript()
    const google = (window as any).google

    if (!gsiLoaded || !google?.accounts?.oauth2) {
      return {
        success: false,
        error: 'Google sign-in could not start because the Google script did not load. Check your connection, or continue as guest.',
      }
    }

    return await new Promise((resolve) => {
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file email profile openid',
          hint: customEmail && customEmail.includes('@') ? customEmail : undefined,
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              console.warn('[Google Vault] Token error from Google OAuth:', tokenResponse.error)
              resolve({ success: false, error: 'Google sign-in was cancelled or refused for this app. Continue as guest or try again.' })
              return
            }

            const accessToken = tokenResponse.access_token
            if (!accessToken) {
              resolve({ success: false, error: 'Google sign-in did not return an access token. Please try again.' })
              return
            }

            const expiresIn = Number(tokenResponse.expires_in) || 3600
            const tokenExpiry = Date.now() + (expiresIn - 60) * 1000

            // Read the account behind the token so no identity is ever invented.
            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
              })
              if (res.ok) {
                const info = await res.json()
                const googleUser: GoogleUser = {
                  id: `google_${info.sub || info.email}`,
                  email: info.email || '',
                  name: info.name || info.given_name || 'Google user',
                  picture: info.picture,
                  accessToken,
                  tokenExpiry,
                  isGoogleUser: true,
                }
                saveGoogleUser(googleUser)
                void initGoogleDriveFolders(accessToken)
                resolve({ success: true, user: googleUser })
                return
              }
              console.warn('[Google Vault] Userinfo endpoint responded with', res.status)
            } catch (fetchErr) {
              console.warn('[Google Vault] Userinfo fetch error:', fetchErr)
            }

            resolve({ success: false, error: 'Signed in with Google, but the profile could not be read. Please try again.' })
          },
        })

        client.requestAccessToken({ prompt: 'consent' })
      } catch (initErr: any) {
        console.warn('[Google Vault] GIS Client Init error:', initErr)
        resolve({ success: false, error: 'Google sign-in could not start. Continue as guest or try again later.' })
      }
    })
  } catch (err: any) {
    console.warn('[Google Vault] Authentication exception:', err)
    return { success: false, error: err.message || 'Authentication could not be completed' }
  }
}

/**
 * Disconnects the Google account and clears cloud tokens.
 */
export function disconnectGoogle(): void {
  saveGoogleUser(null)
  safeStorage.removeItem(STORAGE_KEYS.FOLDERS)
  cachedFolders = null
  resolveLocalDriveNotice('Disconnected from Google Drive. Saving directly to device.')
}

/**
 * Searches for or creates a folder on Google Drive.
 */
async function getOrCreateFolder(
  name: string,
  parentId: string | null,
  accessToken: string,
  description?: string
): Promise<string | null> {
  try {
    const parentQuery = parentId ? `'${parentId}' in parents` : "'root' in parents"
    const query = encodeURIComponent(
      `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${parentQuery}`
    )

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (searchRes.ok) {
      const data = await searchRes.json()
      if (data.files && data.files.length > 0) {
        return data.files[0].id
      }
    }

    // Folder not found; create it
    const body: Record<string, any> = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      description: description || `SEVA.GIS ${name} Directory`,
    }
    if (parentId) {
      body.parents = [parentId]
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (createRes.ok) {
      const created = await createRes.json()
      return created.id || null
    }
  } catch (err) {
    console.warn(`[Google Vault] Failed to create or get folder "${name}":`, err)
  }
  return null
}

/**
 * Ensures the full "SEVA GIS" root folder and 4 subfolders exist in the user's Google Drive:
 * - SEVA GIS/
 *   ├── TIFF Files/
 *   ├── Images/
 *   ├── Reports/
 *   └── User Data & Cache/
 */
export async function initGoogleDriveFolders(token?: string): Promise<DriveFolders | null> {
  const user = getGoogleUser()
  const accessToken = token || user?.accessToken

  if (!accessToken || !isRealGoogleAccessToken(accessToken)) {
    // No live Google OAuth token: never pretend to manage Drive folders.
    return null
  }

  // Check cached folder IDs in memory / safeStorage
  if (cachedFolders) return cachedFolders
  try {
    const cached = safeStorage.getItem(STORAGE_KEYS.FOLDERS)
    if (cached) {
      cachedFolders = JSON.parse(cached)
      return cachedFolders
    }
  } catch {}

  try {
    // 1. Root folder: "SEVA GIS"
    const rootId = await getOrCreateFolder(
      'SEVA GIS',
      null,
      accessToken,
      'SEVA.GIS Analytical Exports, Maps, Reports, and Data Cache'
    )
    if (!rootId) return null

    // 2. Subfolders
    const [tiffId, imagesId, reportsId, dataId] = await Promise.all([
      getOrCreateFolder(
        FOLDER_NAMES.tiff,
        rootId,
        accessToken,
        'Float32 Analytical GeoTIFFs (EPSG:4326)'
      ),
      getOrCreateFolder(
        FOLDER_NAMES.images,
        rootId,
        accessToken,
        'High-Resolution Cartographic Maps & Visual Plots'
      ),
      getOrCreateFolder(
        FOLDER_NAMES.reports,
        rootId,
        accessToken,
        'Comprehensive Farm & Area Analytical Reports (HTML, PDF, DOC)'
      ),
      getOrCreateFolder(
        FOLDER_NAMES.data,
        rootId,
        accessToken,
        'Farm Boundaries, GeoJSON Layers, and Local Cache Backups'
      ),
    ])

    if (tiffId && imagesId && reportsId && dataId) {
      const folders: DriveFolders = {
        rootId,
        tiffId,
        imagesId,
        reportsId,
        dataId,
      }
      cachedFolders = folders
      safeStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders))
      return folders
    }
  } catch (err) {
    console.warn('[Google Vault] Folder initialization error:', err)
  }
  return null
}

/**
 * Uploads a file directly to the organized subfolder in the user's Google Drive.
 */
export async function uploadToGoogleDrive(
  category: ExportCategory,
  fileName: string,
  content: Blob | string,
  mimeType?: string
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  const user = getGoogleUser()
  if (!user || !isRealGoogleAccessToken(user.accessToken)) {
    return { success: false, error: 'Google Drive is not connected with a live Google token' }
  }

  try {
    const folders = await initGoogleDriveFolders(user.accessToken)
    if (!folders) {
      return { success: false, error: 'Could not access SEVA GIS Google Drive folders' }
    }

    const folderId =
      category === 'tiff'
        ? folders.tiffId
        : category === 'images'
        ? folders.imagesId
        : category === 'reports'
        ? folders.reportsId
        : folders.dataId

    const resolvedMime = mimeType || DEFAULT_MIME_TYPES[category]
    const fileBlob = content instanceof Blob ? content : new Blob([content], { type: resolvedMime })

    // Construct Google Drive multipart/related payload
    const boundary = '-------SEVA_GIS_MULTIPART_BOUNDARY'
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelimiter = `\r\n--${boundary}--`

    const metadata = {
      name: fileName,
      parents: [folderId],
      description: `Exported from SEVA.GIS (${new Date().toLocaleString()})`,
    }

    const metaBlob = new Blob(
      [
        delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          `Content-Type: ${resolvedMime}\r\n\r\n`,
      ],
      { type: 'text/plain' }
    )

    const endBlob = new Blob([closeDelimiter], { type: 'text/plain' })
    const multipartBody = new Blob([metaBlob, fileBlob, endBlob], {
      type: `multipart/related; boundary=${boundary}`,
    })

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
        },
        body: multipartBody,
      }
    )

    if (uploadRes.ok) {
      const result = await uploadRes.json()
      return { success: true, fileId: result.id }
    } else {
      const errText = await uploadRes.text()
      console.warn('[Google Vault] Drive upload failed:', uploadRes.status, errText)
      return { success: false, error: `Upload error (${uploadRes.status})` }
    }
  } catch (err: any) {
    console.warn('[Google Vault] Upload exception:', err)
    return { success: false, error: err.message || 'Network exception during Drive upload' }
  }
}

/**
 * Unified Export & Save Dispatcher
 * 
 * 1. Automatically triggers browser / device download to the user's mobile or desktop
 *    so the physical file is saved immediately into Downloads without any user friction.
 * 2. If signed in with Google, asynchronously uploads and organizes the file inside
 *    the corresponding "SEVA GIS" subfolder on their Google Drive.
 * 3. ZERO-ERROR GUARANTEE: If Google Drive is offline, token is expired, or network fails,
 *    it silently absorbs the failure so the device download is NEVER affected.
 */
export async function dispatchExport(options: DispatchOptions): Promise<DispatchResult> {
  const {
    category,
    fileName,
    blob,
    mimeType = DEFAULT_MIME_TYPES[options.category] || 'application/octet-stream',
    silent = false,
    customToast,
  } = options

  let savedToDevice = false
  let syncedToDrive = false
  let driveFileId: string | undefined

  // 1. Save directly to local device (Mobile & Desktop browser download)
  try {
    const fileBlob = blob instanceof Blob ? blob : new Blob([blob], { type: mimeType })
    if (typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(fileBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2500)
    }
    savedToDevice = true
  } catch (deviceErr) {
    console.warn('[Storage Dispatcher] Device save exception:', deviceErr)
  }

  // 2. Parallel upload to Google Drive if a live Google session is connected
  const user = getGoogleUser()
  if (user && user.isGoogleUser && isRealGoogleAccessToken(user.accessToken)) {
    try {
      const uploadRes = await uploadToGoogleDrive(category, fileName, blob, mimeType)
      if (uploadRes.success) {
        syncedToDrive = true
        driveFileId = uploadRes.fileId
        if (!silent) {
          const subfolder = FOLDER_NAMES[category]
          resolveLocalDriveNotice(
            customToast || `Saved to device and organized in Google Drive: SEVA GIS / ${subfolder}`
          )
        }
      } else {
        if (!silent) {
          resolveLocalDriveNotice(`Saved to your device (${fileName})`)
        }
      }
    } catch (driveErr) {
      // Safe fallback: never throw or break
      console.info('[Google Vault] Drive upload fallback note:', driveErr)
      if (!silent) {
        resolveLocalDriveNotice(`Saved to your device (${fileName})`)
      }
    }
  } else {
    if (!silent) {
      resolveLocalDriveNotice(customToast || `Saved to your device (${fileName})`)
    }
  }

  return { savedToDevice, syncedToDrive, driveFileId }
}

/**
 * Dispatches a toast notification to the SEVA.GIS application shell.
 */
function resolveLocalDriveNotice(message: string): void {
  safeDispatch('seva-toast', { message })
}

/**
 * Automatically backs up the user's farm boundaries and data cache to Google Drive.
 * Debounced to ensure smooth performance without saturating network connections.
 */
export function scheduleSyncUserDataToDrive(farms: any[]): void {
  if (!isGoogleDriveConnected()) return
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer)

  syncDebounceTimer = setTimeout(async () => {
    try {
      const user = getGoogleUser()
      if (!user) return
      const json = JSON.stringify(
        {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          userId: user.id,
          userEmail: user.email,
          farmsCount: farms.length,
          farms,
        },
        null,
        2
      )
      const fileName = `seva_workspace_cache_${new Date().toISOString().slice(0, 10)}.json`
      await uploadToGoogleDrive('data', fileName, json, 'application/json')
    } catch (e) {
      console.info('[Google Vault] Background cache sync note:', e)
    }
  }, 3500)
}
