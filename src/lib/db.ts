import Dexie, { type Table } from 'dexie'

export type User = { id: string; name: string; email: string; salt: string; hash: string; created: number }
export type KV = { id: string; userId: string; key: string; value: string; updated: number }

class SevaDB extends Dexie {
  users!: Table<User, string>
  kv!: Table<KV, string>
  constructor() {
    super('seva-gis')
    this.version(1).stores({ users: 'id, &email', kv: 'id, userId, key' })
  }
}
export const db = new SevaDB()

const SESSION = 'seva-session'
export const GUEST = 'guest'
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b as ArrayBuffer)].map(x => x.toString(16).padStart(2, '0')).join('')
const unhex = (s: string) => new Uint8Array(s.match(/../g)!.map(h => parseInt(h, 16)))

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 210000 }, key, 256))
}

export async function register(name: string, email: string, password: string) {
  email = email.trim().toLowerCase()
  if (await db.users.where('email').equals(email).count()) throw new Error('An account with this email already exists on this device. Try signing in.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const user: User = { id: crypto.randomUUID(), name: name.trim(), email, salt: hex(salt), hash: await derive(password, salt), created: Date.now() }
  await db.users.add(user)
  return user
}

export async function login(email: string, password: string) {
  const user = await db.users.where('email').equals(email.trim().toLowerCase()).first()
  if (!user || (await derive(password, unhex(user.salt))) !== user.hash) throw new Error('Email or password is not correct.')
  return user
}

export const sessionId = () => localStorage.getItem(SESSION)
export const setSession = (id: string | null) => { if (id) localStorage.setItem(SESSION, id); else localStorage.removeItem(SESSION) }

const SYSTEM_KEYS = new Set([
  SESSION,
  'seva-guide',
  'seva-lang',
  'seva-guest-name',
  'seva-remembered',
  'seva-bye',
  'seva-mitra-asked'
])
const isData = (k: string) => k.startsWith('seva-') && !SYSTEM_KEYS.has(k)
const dataKeys = () => Object.keys(localStorage).filter(isData)
let activeUser: string | null = null
const rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem

import {
  initAccountVault,
  loadFarmsFromFolder,
  scheduleSaveFarmsToFolder,
  deleteAccountFolder,
  saveFarmsToFolder
} from './fs-vault'

export async function openWorkspace(userId: string, meta?: { name?: string; email?: string }) {
  // Initialize the dedicated local folder vault for this account on the device (OPFS & OS directory)
  await initAccountVault(userId, meta)

  if ((await db.kv.count()) === 0 && dataKeys().length) {
    for (const k of dataKeys()) await db.kv.put({ id: `${userId}:${k}`, userId, key: k, value: localStorage.getItem(k)!, updated: Date.now() })
    activeUser = userId
    // Mirror to folder
    try {
      const farmsJson = localStorage.getItem('seva-farms')
      if (farmsJson) scheduleSaveFarmsToFolder(userId, JSON.parse(farmsJson))
    } catch {}
    return
  }

  dataKeys().forEach(k => rawRemove.call(localStorage, k))
  const rows = await db.kv.where('userId').equals(userId).toArray()

  let loadedFarmsFromKv = false
  for (const row of rows) {
    if (isData(row.key)) {
      rawSet.call(localStorage, row.key, row.value)
      if (row.key === 'seva-farms') loadedFarmsFromKv = true
    } else if (SYSTEM_KEYS.has(row.key)) {
      void db.kv.delete(row.id)
    }
  }

  // If IndexedDB had no farms for this account, check if they exist in the device's local folder!
  if (!loadedFarmsFromKv) {
    try {
      const folderFarms = await loadFarmsFromFolder(userId)
      if (folderFarms && folderFarms.length > 0) {
        const json = JSON.stringify(folderFarms)
        rawSet.call(localStorage, 'seva-farms', json)
        await db.kv.put({ id: `${userId}:seva-farms`, userId, key: 'seva-farms', value: json, updated: Date.now() })
      }
    } catch (e) {
      console.warn('[DB] Could not hydrate from device folder:', e)
    }
  } else {
    // Sync current farms to the device folder in background
    try {
      const farmsJson = localStorage.getItem('seva-farms')
      if (farmsJson) scheduleSaveFarmsToFolder(userId, JSON.parse(farmsJson))
    } catch {}
  }

  activeUser = userId
}

Storage.prototype.setItem = function (key: string, value: string) {
  rawSet.call(this, key, value)
  if (this === localStorage && activeUser && isData(key)) {
    void db.kv.put({ id: `${activeUser}:${key}`, userId: activeUser, key, value: String(value), updated: Date.now() })
    // If saving farms, auto-save as discrete files into the user's dedicated device folder
    if (key === 'seva-farms') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          scheduleSaveFarmsToFolder(activeUser, parsed)
        }
      } catch {}
    }
  }
}
Storage.prototype.removeItem = function (key: string) {
  rawRemove.call(this, key)
  if (this === localStorage && activeUser && isData(key)) void db.kv.delete(`${activeUser}:${key}`)
}

export const closeWorkspace = () => { activeUser = null; dataKeys().forEach(k => rawRemove.call(localStorage, k)) }
export const activeUserId = () => activeUser

export async function snapshot(userId: string) {
  const rows = await db.kv.where('userId').equals(userId).toArray()
  return { app: 'SEVA.GIS', version: 1, exported: new Date().toISOString(), data: Object.fromEntries(rows.map(r => [r.key, r.value])) }
}
export async function restore(userId: string, text: string) {
  const parsed = JSON.parse(text)
  if (parsed?.app !== 'SEVA.GIS' || typeof parsed.data !== 'object') throw new Error('This is not a SEVA.GIS backup file.')
  for (const [key, value] of Object.entries(parsed.data as Record<string, string>)) if (isData(key) && typeof value === 'string') {
    rawSet.call(localStorage, key, value)
    await db.kv.put({ id: `${userId}:${key}`, userId, key, value, updated: Date.now() })
    if (key === 'seva-farms') {
      try {
        const parsedFarms = JSON.parse(value)
        if (Array.isArray(parsedFarms)) scheduleSaveFarmsToFolder(userId, parsedFarms)
      } catch {}
    }
  }
}
export async function deleteAccount(userId: string) {
  await db.kv.where('userId').equals(userId).delete()
  await deleteAccountFolder(userId)
  if (userId !== GUEST) await db.users.delete(userId)
}

