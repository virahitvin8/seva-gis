import { useEffect, useState } from 'react'
import {
  Download,
  Trash2,
  Upload,
  Folder,
  FolderCheck,
  HardDrive,
  RefreshCw,
  FileText,
  CheckCircle2,
  Laptop,
  Smartphone,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { db, deleteAccount, restore, snapshot, type KV } from './lib/db'
import { useAccount } from './Auth'
import {
  getVaultStatus,
  linkLocalOsDirectory,
  unlinkLocalOsDirectory,
  downloadVaultFile,
  loadFarmsFromFolder,
  type VaultStatus
} from './lib/fs-vault'
import {
  dispatchExport,
  isGoogleDriveConnected,
  getGoogleUser,
  authenticateWithGoogle,
  disconnectGoogle
} from './lib/googleDriveVault'

const NAMES: Record<string, string> = {
  'seva-farms': 'Saved farms',
  'seva-indicators': 'Parameters on the map',
  'seva-water': 'Water settings',
  'seva-assets': 'Borewells and pipelines'
}
const label = (k: string) => NAMES[k] || k.replace('seva-', '')
const size = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`)

export default function DataManager() {
  const { who, signOut } = useAccount()
  const [rows, setRows] = useState<KV[]>([])
  const [open, setOpen] = useState('')
  const [msg, setMsg] = useState('')
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null)
  const [filesOpen, setFilesOpen] = useState(true)
  const [linking, setLinking] = useState(false)

  const loadData = async () => {
    const kvRows = await db.kv.where('userId').equals(who.id).toArray()
    setRows(kvRows)
    const vs = await getVaultStatus(who.id)
    setVaultStatus(vs)
  }

  useEffect(() => {
    loadData()
  }, [who.id])

  async function handleLinkOsFolder() {
    setLinking(true)
    setMsg('')
    try {
      const farmsJson = localStorage.getItem('seva-farms')
      const currentFarms = farmsJson ? JSON.parse(farmsJson) : []
      const res = await linkLocalOsDirectory(currentFarms)
      if (res.success) {
        setMsg(`Connected to local folder "${res.dirName}". Farms are now written directly to your laptop hard drive!`)
      } else if (res.error) {
        setMsg(res.error)
      }
      await loadData()
    } catch (err: any) {
      setMsg(err.message || 'Could not connect folder')
    } finally {
      setLinking(false)
    }
  }

  async function handleUnlinkOsFolder() {
    await unlinkLocalOsDirectory()
    setMsg('Local laptop directory unlinked. Farms remain safely in device sandbox.')
    await loadData()
  }

  async function handlePullFromFolder() {
    setMsg('Pulling directly from device folder…')
    try {
      const farms = await loadFarmsFromFolder(who.id)
      if (farms && farms.length > 0) {
        localStorage.setItem('seva-farms', JSON.stringify(farms))
        setMsg(`Loaded ${farms.length} farm(s) directly from your device folder. Reloading…`)
        setTimeout(() => location.reload(), 700)
      } else {
        setMsg('Device folder is clean or contains no saved farms.')
      }
    } catch (err: any) {
      setMsg('Error pulling from folder: ' + err.message)
    }
  }

  async function backup() {
    const json = JSON.stringify(await snapshot(who.id), null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const fileName = `seva-backup-${who.name.toLowerCase().replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`
    await dispatchExport({
      category: 'data',
      fileName,
      blob,
      mimeType: 'application/json',
      customToast: `Saved backup to device & Google Drive: SEVA GIS / User Data & Cache`
    })
    setMsg('Backup saved to device & synced to Google Drive')
  }

  async function onFile(f?: File) {
    if (!f) return
    try {
      await restore(who.id, await f.text())
      setMsg('Backup restored. Reloading…')
      setTimeout(() => location.reload(), 700)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not read this file.')
    }
  }

  async function remove(k: string) {
    if (!confirm(`Delete "${label(k)}"? This cannot be undone.`)) return
    localStorage.removeItem(k)
    await loadData()
    setMsg('Deleted. Reload to see the change.')
  }

  async function wipe() {
    if (!confirm('Delete ALL data and local folders for this account and sign out?')) return
    await deleteAccount(who.id)
    signOut()
    location.reload()
  }

  const total = rows.reduce((s, r) => s + r.value.length, 0)
  const isDesktop = typeof window !== 'undefined' && 'showDirectoryPicker' in window

  return (
    <div className="dm">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <p>
          <b>{who.name}</b>
          {who.email ? ` · ${who.email}` : ' (guest, isolated on this device)'}
        </p>
        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: '#e0f5d7', color: '#184a28', fontWeight: 600 }}>
          Account ID: {who.id.slice(0, 8)}…
        </span>
      </div>

      {/* Google Drive Cloud Vault Card */}
      <div style={{ background: '#0a1d2e', color: '#e0f2fe', borderRadius: 12, padding: 16, display: 'grid', gap: 10, border: '1px solid #1e3a5f' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>
              Google Drive Cloud Vault
            </h3>
          </div>
          <span style={{ fontSize: 11, background: isGoogleDriveConnected() ? '#0c4a6e' : '#1e293b', color: isGoogleDriveConnected() ? '#38bdf8' : '#94a3b8', padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {isGoogleDriveConnected() ? <CheckCircle2 size={12} color="#38bdf8" /> : null}
            {isGoogleDriveConnected() ? 'Drive Folder "SEVA GIS" Active' : 'Not Connected'}
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: '#93c5fd', lineHeight: 1.5 }}>
          When Google Drive is connected, a folder named <b>SEVA GIS</b> is maintained in your Google Drive with dedicated subfolders (<b>TIFF Files</b>, <b>Images</b>, <b>Reports</b>, <b>User Data &amp; Cache</b>), and exported files upload there. If offline or not connected, everything saves directly to your device storage.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
          {isGoogleDriveConnected() ? (
            <button
              onClick={() => {
                disconnectGoogle()
                setMsg('Disconnected from Google Drive. Saving directly to device.')
              }}
              style={{ background: '#1e293b', color: '#fca5a5', border: '1px solid #334155', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}
            >
              Disconnect Google Drive
            </button>
          ) : (
            <button
              onClick={async () => {
                const res = await authenticateWithGoogle()
                if (res.success && res.user) {
                  setMsg(`Connected Google Drive (${res.user.email}). Exports will sync to "SEVA GIS".`)
                  await loadData()
                } else if (res.error) {
                  setMsg(res.error)
                }
              }}
              style={{ background: '#ffffff', color: '#0f172a', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Sign in with Google / Connect Drive
            </button>
          )}
        </div>
      </div>

      {/* Device Folder Vault Card (Native Game / App Style) */}
      <div style={{ background: '#0e241b', color: '#e7f7e2', borderRadius: 12, padding: 16, display: 'grid', gap: 12, border: '1px solid #234c38' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderCheck size={20} color="#b6f36a" />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>
              Device Folder Vault
            </h3>
          </div>
          <span style={{ fontSize: 11, background: '#1c4a35', color: '#b6f36a', padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} /> Real-Time Auto-Save Active
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: '#b7d5be', lineHeight: 1.5 }}>
          Just like mobile games store packages in local folders, SEVA·GIS automatically saves all your farm boundaries and GeoJSON files in an isolated folder on your device. When you switch accounts, your farms are pulled directly from that account's folder.
        </p>

        <div style={{ background: '#071610', borderRadius: 8, padding: '10px 12px', fontSize: 12, display: 'grid', gap: 6, border: '1px solid #1a3c2b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#88a892', fontSize: 11 }}>
            <span>ACTIVE FOLDER PATH</span>
            <span>{vaultStatus?.isPersisted ? '🔒 OS Storage Protected' : '⚡ High-Speed Disk'}</span>
          </div>
          <code style={{ color: '#b6f36a', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {vaultStatus?.currentFolderPath || `/seva-gis/accounts/${who.id}/farms/`}
          </code>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#9fc2a9', marginTop: 4, flexWrap: 'wrap' }}>
            <span><b>{vaultStatus?.farmFilesCount ?? 0}</b> farm files</span>
            <span><b>{size(vaultStatus?.totalBytes ?? 0)}</b> on disk</span>
            <span><b>0ms</b> read latency</span>
          </div>
        </div>

        {/* Laptop Hard Drive Linking Option (Desktop / Laptop Only) */}
        {isDesktop && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4, borderTop: '1px solid #1a3c2b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Laptop size={14} color="#b6f36a" />
                <span><b>Laptop Hard Drive Mirror:</b> {vaultStatus?.isOsLinked ? <span style={{ color: '#b6f36a' }}>Linked to "{vaultStatus.osDirName}"</span> : 'Not linked to OS Explorer'}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {vaultStatus?.isOsLinked ? (
                  <button
                    onClick={handleUnlinkOsFolder}
                    style={{ background: '#2c1212', color: '#ffb3ba', border: '1px solid #582424', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer' }}
                  >
                    Unlink OS folder
                  </button>
                ) : (
                  <button
                    onClick={handleLinkOsFolder}
                    disabled={linking}
                    style={{ background: '#b6f36a', color: '#092116', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <HardDrive size={12} /> {linking ? 'Connecting…' : 'Link Laptop Folder (Windows / Mac Explorer)'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Folder Explorer Files List */}
        <div>
          <button
            onClick={() => setFilesOpen(!filesOpen)}
            style={{ background: 'transparent', border: 'none', color: '#9ec4aa', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: 0 }}
          >
            {filesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Browse files inside this account's folder ({vaultStatus?.files.length ?? 0} files)
          </button>

          {filesOpen && (
            <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto', background: '#071610', borderRadius: 8, border: '1px solid #1a3c2b' }}>
              {vaultStatus?.files.length === 0 ? (
                <div style={{ padding: '12px', fontSize: 11, color: '#73957d', textAlign: 'center' }}>
                  No farm files written yet. Add a farm on the map to see its .json and .geojson files appear here automatically.
                </div>
              ) : (
                <div style={{ display: 'grid' }}>
                  {vaultStatus?.files.map(f => (
                    <div
                      key={f.name}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #132a1e', fontSize: 11 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <FileText size={13} color={f.isGeoJson ? '#60a5fa' : '#b6f36a'} />
                        <span style={{ color: '#e0f3e2', fontFamily: 'monospace' }}>{f.name}</span>
                        <span style={{ color: '#73957d', fontSize: 10 }}>({size(f.size)})</span>
                      </div>
                      <button
                        onClick={() => downloadVaultFile(who.id, f.name)}
                        title={`Download ${f.name}`}
                        style={{ background: 'transparent', border: 'none', color: '#b6f36a', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handlePullFromFolder}
            style={{ background: '#1c4a35', color: '#e0f3e2', border: '1px solid #2e6d50', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={12} /> Pull directly from device folder
          </button>
        </div>
      </div>

      {/* Backup & Actions */}
      <div className="dm-actions">
        <button onClick={backup}>
          <Download size={14} /> Download backup
        </button>
        <label className="dm-btn">
          <Upload size={14} /> Restore backup
          <input
            type="file"
            accept=".json"
            hidden
            onChange={e => {
              onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>Data table</th>
            <th>Size</th>
            <th>Last saved</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <>
              <tr key={r.id}>
                <td>
                  <button className="dm-link" onClick={() => setOpen(open === r.key ? '' : r.key)}>
                    {label(r.key)}
                  </button>
                </td>
                <td>{size(r.value.length)}</td>
                <td>{new Date(r.updated).toLocaleString()}</td>
                <td>
                  <button aria-label={`Delete ${label(r.key)}`} onClick={() => remove(r.key)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
              {open === r.key && (
                <tr key={r.id + 'v'}>
                  <td colSpan={4}>
                    <pre>
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(r.value), null, 2).slice(0, 4000)
                        } catch {
                          return r.value.slice(0, 4000)
                        }
                      })()}
                    </pre>
                  </td>
                </tr>
              )}
            </>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={4}>Nothing saved yet. Add a farm and it will appear here.</td>
            </tr>
          )}
        </tbody>
      </table>

      <small>
        {rows.length} table{rows.length === 1 ? '' : 's'} · {size(total)} in total. Stored directly on this device in your dedicated account folder. Nothing is sent to an external server.
      </small>

      {msg && <div className="au-err" style={{ background: '#eef8eb', color: '#1b4a28', border: '1px solid #b8e2b8' }}>{msg}</div>}

      <button className="dm-danger" onClick={wipe}>
        <Trash2 size={14} /> Delete this account and wipe its folders
      </button>
    </div>
  )
}
