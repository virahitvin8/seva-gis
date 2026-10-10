/**
 * SEVA·GIS - Device File System Vault
 * 
 * Implements game/native-app style local storage on Laptop & Mobile:
 * 1. Origin Private File System (OPFS): High-speed sandboxed hierarchical directory tree
 *    (/seva-gis/accounts/<userId>/farms/*.json & *.geojson) stored directly on the device.
 * 2. File System Access API: Optional direct link to an actual laptop/desktop folder
 *    (e.g., Documents/SEVA_GIS_Data) visible in Windows Explorer / Finder.
 * 3. Multi-Account Isolation: Each user has their own dedicated folder. Switching accounts
 *    pulls directly from that user's folder with zero cross-contamination.
 * 4. Zero-Lag Guarantee: Non-blocking asynchronous streaming + debounced writes so map
 *    rendering and 60fps animations never stutter.
 */

export type VaultFarm = {
  id: string
  name: string
  location: string
  crop: string
  area: number
  lat: number
  lon: number
  status: string
  ndvi?: number
  moisture?: number
  rain?: number
  elevation?: number
  sample?: boolean
  analysis?: any
  polygon?: [number, number][]
  passes?: any[]
  [key: string]: any
}

export type VaultFileEntry = {
  name: string
  path: string
  size: number
  lastModified: number
  isGeoJson: boolean
}

export type VaultStatus = {
  isSupported: boolean
  isOpfsActive: boolean
  isOsLinked: boolean
  osDirName: string | null
  activeUserId: string | null
  currentFolderPath: string
  farmFilesCount: number
  totalBytes: number
  isPersisted: boolean
  files: VaultFileEntry[]
}

// Memory cache for active account files to ensure 0ms latency
let activeUserId: string | null = null
let linkedOsDirHandle: FileSystemDirectoryHandle | null = null
let isPersistedStorage = false

// Check and request persistent storage from the OS (so mobile browsers never evict the farm folders)
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    isPersistedStorage = granted
  }).catch(() => {})
}

// -------------------------------------------------------------
// IndexedDB persistence for Desktop OS Directory Handles
// -------------------------------------------------------------
function getHandlesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB not available'))
    const req = indexedDB.open('seva-fs-vault-handles', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('handles')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveStoredOsHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await getHandlesDb()
    const tx = db.transaction('handles', 'readwrite')
    tx.objectStore('handles').put(handle, 'linked_os_folder')
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
  } catch (err) {
    console.warn('[FS Vault] Could not store OS directory handle in IDB:', err)
  }
}

async function loadStoredOsHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await getHandlesDb()
    const tx = db.transaction('handles', 'readonly')
    const req = tx.objectStore('handles').get('linked_os_folder')
    const handle = await new Promise<FileSystemDirectoryHandle | null>((res, rej) => {
      req.onsuccess = () => res(req.result || null)
      req.onerror = () => rej(req.error)
    })
    if (handle) {
      // Verify permission
      const queryPerm = (handle as any).queryPermission
      if (queryPerm) {
        const state = await queryPerm.call(handle, { mode: 'readwrite' })
        if (state === 'granted') return handle
      } else {
        return handle
      }
    }
  } catch {
    // Ignore if not present or unsupported
  }
  return null
}

async function removeStoredOsHandle(): Promise<void> {
  try {
    const db = await getHandlesDb()
    const tx = db.transaction('handles', 'readwrite')
    tx.objectStore('handles').delete('linked_os_folder')
  } catch {}
}

// Restore linked directory if previously authorized
if (typeof window !== 'undefined') {
  loadStoredOsHandle().then(handle => {
    if (handle) linkedOsDirHandle = handle
  })
}

// -------------------------------------------------------------
// OPFS (Origin Private File System) Directory Hierarchy
// -------------------------------------------------------------
async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.getDirectory) {
    return null
  }
  try {
    return await navigator.storage.getDirectory()
  } catch (err) {
    console.warn('[FS Vault] OPFS not accessible:', err)
    return null
  }
}

async function getOrCreateDir(
  parent: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle> {
  return await parent.getDirectoryHandle(name, { create: true })
}

/**
 * Traverses or creates the account folder:
 * root -> seva-gis -> accounts -> <userId>
 */
export async function getAccountFolder(userId: string): Promise<FileSystemDirectoryHandle | null> {
  const root = await getOpfsRoot()
  if (!root) return null
  try {
    const appDir = await getOrCreateDir(root, 'seva-gis')
    const accountsDir = await getOrCreateDir(appDir, 'accounts')
    const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, '_')
    return await getOrCreateDir(accountsDir, cleanId)
  } catch (e) {
    console.warn('[FS Vault] Error accessing account folder:', e)
    return null
  }
}

/**
 * Accesses or creates the account's farms folder:
 * root -> seva-gis -> accounts -> <userId> -> farms
 */
export async function getFarmsFolder(userId: string): Promise<FileSystemDirectoryHandle | null> {
  const acct = await getAccountFolder(userId)
  if (!acct) return null
  return await getOrCreateDir(acct, 'farms')
}

// -------------------------------------------------------------
// Low-level File Read/Write Operations (Web Stream & Blob Safe)
// -------------------------------------------------------------
async function writeTextFile(
  dir: FileSystemDirectoryHandle,
  filename: string,
  content: string
): Promise<void> {
  const fileHandle = await dir.getFileHandle(filename, { create: true })
  const writable = await (fileHandle as any).createWritable()
  await writable.write(content)
  await writable.close()
}

async function readTextFile(
  dir: FileSystemDirectoryHandle,
  filename: string
): Promise<string | null> {
  try {
    const fileHandle = await dir.getFileHandle(filename, { create: false })
    const file = await fileHandle.getFile()
    return await file.text()
  } catch {
    return null
  }
}

async function removeFile(
  dir: FileSystemDirectoryHandle,
  filename: string
): Promise<void> {
  try {
    await dir.removeEntry(filename)
  } catch {}
}

/**
 * Converts a Farm object into a standard GeoJSON Feature for external GIS tools.
 */
function farmToGeoJson(farm: VaultFarm): string {
  const coordinates = farm.polygon && farm.polygon.length >= 3
    ? [farm.polygon.map(pt => [pt[0], pt[1]])]
    : [[
        [farm.lon - 0.001, farm.lat - 0.001],
        [farm.lon + 0.001, farm.lat - 0.001],
        [farm.lon + 0.001, farm.lat + 0.001],
        [farm.lon - 0.001, farm.lat + 0.001],
        [farm.lon - 0.001, farm.lat - 0.001]
      ]]

  const feature = {
    type: 'Feature',
    id: farm.id,
    properties: {
      id: farm.id,
      name: farm.name,
      crop: farm.crop,
      areaHa: farm.area,
      status: farm.status,
      ndvi: farm.ndvi,
      moisture: farm.moisture,
      rain: farm.rain,
      elevation: farm.elevation,
      centerLat: farm.lat,
      centerLon: farm.lon,
      location: farm.location,
      lastUpdated: new Date().toISOString()
    },
    geometry: {
      type: 'Polygon',
      coordinates
    }
  }

  return JSON.stringify(feature, null, 2)
}

// -------------------------------------------------------------
// High-Level Farm Vault Operations
// -------------------------------------------------------------

/**
 * Initializes the vault folder for a specific user upon login/switch.
 */
export async function initAccountVault(
  userId: string,
  meta?: { name?: string; email?: string }
): Promise<void> {
  activeUserId = userId
  const acctDir = await getAccountFolder(userId)
  if (!acctDir) return

  // Ensure farms folder exists
  await getFarmsFolder(userId)

  // Write or update profile.json in the user's folder
  try {
    const existingProfile = await readTextFile(acctDir, 'profile.json')
    const profile = existingProfile ? JSON.parse(existingProfile) : {}
    const updated = {
      ...profile,
      userId,
      name: meta?.name || profile.name || 'User',
      email: meta?.email || profile.email || '',
      lastAccessed: new Date().toISOString()
    }
    await writeTextFile(acctDir, 'profile.json', JSON.stringify(updated, null, 2))
  } catch (err) {
    console.warn('[FS Vault] Could not update profile.json:', err)
  }

  // Also mirror to linked OS Directory if connected on laptop
  if (linkedOsDirHandle) {
    try {
      const osUserDir = await getOrCreateDir(linkedOsDirHandle, `account_${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}`)
      await getOrCreateDir(osUserDir, 'farms')
      await writeTextFile(osUserDir, 'account_info.json', JSON.stringify({ userId, ...meta, syncedAt: new Date().toISOString() }, null, 2))
    } catch {}
  }
}

/**
 * Asynchronously saves all current farms for the user into the local folder.
 * Debounced to guarantee zero-lag and zero frame drops on the UI thread.
 */
let saveTimer: any = null
export function scheduleSaveFarmsToFolder(userId: string, farms: VaultFarm[]): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveFarmsToFolder(userId, farms).catch(err => {
      console.warn('[FS Vault] Background save failed:', err)
    })
  }, 250) // 250ms debounce ensures buttery smooth 60fps UI
}

export async function saveFarmsToFolder(userId: string, farms: VaultFarm[]): Promise<void> {
  const farmsDir = await getFarmsFolder(userId)
  if (!farmsDir) return

  const cleanFarms = (farms || []).filter(f => !f.sample)

  // 1. Write individual farm files (.json and .geojson)
  const currentFarmFileNames = new Set<string>()

  for (const farm of cleanFarms) {
    const cleanName = farm.name.trim().replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'farm'
    const jsonFileName = `farm_${cleanName}_${farm.id.slice(0, 8)}.json`
    const geoJsonFileName = `farm_${cleanName}_${farm.id.slice(0, 8)}.geojson`

    currentFarmFileNames.add(jsonFileName)
    currentFarmFileNames.add(geoJsonFileName)

    // Write full JSON
    await writeTextFile(farmsDir, jsonFileName, JSON.stringify(farm, null, 2))
    // Write standard GIS GeoJSON
    await writeTextFile(farmsDir, geoJsonFileName, farmToGeoJson(farm))
  }

  // 2. Write an index manifest in the folder for instant lookup
  const manifest = {
    userId,
    count: cleanFarms.length,
    updatedAt: new Date().toISOString(),
    farms: cleanFarms.map(f => ({
      id: f.id,
      name: f.name,
      crop: f.crop,
      area: f.area,
      lat: f.lat,
      lon: f.lon,
      status: f.status
    }))
  }
  await writeTextFile(farmsDir, 'farms_index.json', JSON.stringify(manifest, null, 2))
  currentFarmFileNames.add('farms_index.json')

  // 3. Clean up deleted farms from folder
  try {
    for await (const [name, handle] of (farmsDir as any).entries()) {
      if (handle.kind === 'file' && (name.endsWith('.json') || name.endsWith('.geojson'))) {
        if (!currentFarmFileNames.has(name) && name !== 'farms_index.json') {
          await removeFile(farmsDir, name)
        }
      }
    }
  } catch {}

  // 4. Mirror to Linked OS Directory on Laptop (if user linked a Windows/Mac folder)
  if (linkedOsDirHandle) {
    try {
      const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, '_')
      const osUserDir = await getOrCreateDir(linkedOsDirHandle, `account_${cleanId}`)
      const osFarmsDir = await getOrCreateDir(osUserDir, 'farms')
      for (const farm of cleanFarms) {
        const cleanName = farm.name.trim().replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'farm'
        await writeTextFile(osFarmsDir, `farm_${cleanName}_${farm.id.slice(0, 8)}.geojson`, farmToGeoJson(farm))
        await writeTextFile(osFarmsDir, `farm_${cleanName}_${farm.id.slice(0, 8)}.json`, JSON.stringify(farm, null, 2))
      }
      await writeTextFile(osFarmsDir, 'farms_index.json', JSON.stringify(manifest, null, 2))
    } catch (err) {
      console.warn('[FS Vault] Could not mirror to OS directory:', err)
    }
  }
}

/**
 * Pulls all farms directly from the user's dedicated local folder.
 * Used during account switching or initial boot.
 */
export async function loadFarmsFromFolder(userId: string): Promise<VaultFarm[] | null> {
  const farmsDir = await getFarmsFolder(userId)
  if (!farmsDir) return null

  try {
    const loadedFarms: VaultFarm[] = []
    for await (const [name, handle] of (farmsDir as any).entries()) {
      if (handle.kind === 'file' && name.startsWith('farm_') && name.endsWith('.json')) {
        const text = await readTextFile(farmsDir, name)
        if (text) {
          try {
            const parsed = JSON.parse(text)
            if (parsed && parsed.id && parsed.name) {
              loadedFarms.push(parsed)
            }
          } catch {}
        }
      }
    }

    if (loadedFarms.length > 0) {
      return loadedFarms
    }

    // Fallback: Check farms_index.json
    const indexText = await readTextFile(farmsDir, 'farms_index.json')
    if (indexText) {
      const index = JSON.parse(indexText)
      if (Array.isArray(index.farms)) return index.farms
    }
  } catch (err) {
    console.warn('[FS Vault] Error reading farms from folder:', err)
  }

  return null
}

/**
 * Deletes the entire account folder from the device when the user deletes their account.
 */
export async function deleteAccountFolder(userId: string): Promise<void> {
  const root = await getOpfsRoot()
  if (!root) return
  try {
    const appDir = await root.getDirectoryHandle('seva-gis', { create: false })
    const accountsDir = await appDir.getDirectoryHandle('accounts', { create: false })
    const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, '_')
    await (accountsDir as any).removeEntry(cleanId, { recursive: true })
  } catch {}
}

/**
 * Retrieves detailed folder status and listing for the UI (Data Manager modal).
 */
export async function getVaultStatus(userId: string): Promise<VaultStatus> {
  const isSupported = typeof navigator !== 'undefined' && !!navigator.storage && !!navigator.storage.getDirectory
  const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const folderPath = `/seva-gis/accounts/${cleanId}/farms/`

  const files: VaultFileEntry[] = []
  let totalBytes = 0
  let farmCount = 0

  const farmsDir = await getFarmsFolder(userId)
  if (farmsDir) {
    try {
      for await (const [name, handle] of (farmsDir as any).entries()) {
        if (handle.kind === 'file') {
          const file = await handle.getFile()
          totalBytes += file.size
          const isGeoJson = name.endsWith('.geojson')
          if (name.startsWith('farm_') && name.endsWith('.json')) farmCount++
          files.push({
            name,
            path: `${folderPath}${name}`,
            size: file.size,
            lastModified: file.lastModified,
            isGeoJson
          })
        }
      }
    } catch {}
  }

  // Sort files: JSON and GeoJSON together
  files.sort((a, b) => a.name.localeCompare(b.name))

  return {
    isSupported,
    isOpfsActive: !!farmsDir,
    isOsLinked: !!linkedOsDirHandle,
    osDirName: linkedOsDirHandle ? linkedOsDirHandle.name : null,
    activeUserId: userId,
    currentFolderPath: folderPath,
    farmFilesCount: farmCount,
    totalBytes,
    isPersisted: isPersistedStorage,
    files
  }
}

// -------------------------------------------------------------
// Laptop / Desktop: Link Real OS Folder (File System Access API)
// -------------------------------------------------------------

export async function linkLocalOsDirectory(activeFarms: VaultFarm[]): Promise<{ success: boolean; dirName?: string; error?: string }> {
  if (typeof window === 'undefined' || !(window as any).showDirectoryPicker) {
    return { success: false, error: 'Direct OS folder access is supported on Desktop browsers (Chrome, Edge, Opera).' }
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      id: 'seva_gis_local_vault',
      mode: 'readwrite',
      startIn: 'documents'
    })

    if (!handle) return { success: false, error: 'No directory was selected.' }

    linkedOsDirHandle = handle
    await saveStoredOsHandle(handle)

    // If an active user exists, sync their farms right away into the newly linked OS folder
    if (activeUserId && activeFarms.length) {
      await saveFarmsToFolder(activeUserId, activeFarms)
    }

    return { success: true, dirName: handle.name }
  } catch (err: any) {
    if (err.name === 'AbortError') return { success: false, error: 'Folder selection was cancelled.' }
    return { success: false, error: err.message || 'Could not connect directory.' }
  }
}

export async function unlinkLocalOsDirectory(): Promise<void> {
  linkedOsDirHandle = null
  await removeStoredOsHandle()
}

/**
 * Downloads a farm directly from the vault to the user's machine as a single file.
 */
export async function downloadVaultFile(userId: string, filename: string): Promise<void> {
  const farmsDir = await getFarmsFolder(userId)
  if (!farmsDir) return
  const text = await readTextFile(farmsDir, filename)
  if (!text) return

  const mime = filename.endsWith('.geojson') ? 'application/geo+json' : 'application/json'
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
