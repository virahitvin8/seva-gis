import { useEffect, useState } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'
import { db, deleteAccount, restore, snapshot, type KV } from './lib/db'
import { useAccount } from './Auth'

const NAMES: Record<string, string> = { 'seva-farms': 'Saved farms', 'seva-indicators': 'Parameters on the map', 'seva-water': 'Water settings', 'seva-assets': 'Borewells and pipelines' }
const label = (k: string) => NAMES[k] || k.replace('seva-', '')
const size = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`)

export default function DataManager() {
  const { who, signOut } = useAccount()
  const [rows, setRows] = useState<KV[]>([])
  const [open, setOpen] = useState('')
  const [msg, setMsg] = useState('')
  const load = () => db.kv.where('userId').equals(who.id).toArray().then(setRows)
  useEffect(() => { load() }, [])

  async function backup() {
    const blob = new Blob([JSON.stringify(await snapshot(who.id), null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `seva-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  }
  async function onFile(f?: File) {
    if (!f) return
    try { await restore(who.id, await f.text()); setMsg('Backup restored. Reloading…'); setTimeout(() => location.reload(), 700) } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not read this file.') }
  }
  async function remove(k: string) { if (!confirm(`Delete "${label(k)}"? This cannot be undone.`)) return; localStorage.removeItem(k); await load(); setMsg('Deleted. Reload to see the change.') }
  async function wipe() { if (!confirm('Delete ALL data for this account and sign out?')) return; await deleteAccount(who.id); signOut(); location.reload() }
  const total = rows.reduce((s, r) => s + r.value.length, 0)

  return <div className="dm">
    <p><b>{who.name}</b>{who.email ? ` · ${who.email}` : ' (guest, data stays on this device)'}</p>
    <div className="dm-actions"><button onClick={backup}><Download size={14}/>Download backup</button><label className="dm-btn"><Upload size={14}/>Restore backup<input type="file" accept=".json" hidden onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }}/></label><button onClick={signOut}>Sign out</button></div>
    <table><thead><tr><th>Data table</th><th>Size</th><th>Last saved</th><th/></tr></thead><tbody>
      {rows.map(r => <><tr key={r.id}><td><button className="dm-link" onClick={() => setOpen(open === r.key ? '' : r.key)}>{label(r.key)}</button></td><td>{size(r.value.length)}</td><td>{new Date(r.updated).toLocaleString()}</td><td><button aria-label={`Delete ${label(r.key)}`} onClick={() => remove(r.key)}><Trash2 size={14}/></button></td></tr>
        {open === r.key && <tr key={r.id + 'v'}><td colSpan={4}><pre>{(() => { try { return JSON.stringify(JSON.parse(r.value), null, 2).slice(0, 4000) } catch { return r.value.slice(0, 4000) } })()}</pre></td></tr>}</>)}
      {!rows.length && <tr><td colSpan={4}>Nothing saved yet. Add a farm and it will appear here.</td></tr>}
    </tbody></table>
    <small>{rows.length} table{rows.length === 1 ? '' : 's'} · {size(total)} in total. Stored in your browser's IndexedDB through Dexie. Nothing is sent to a server.</small>
    {msg && <div className="au-err">{msg}</div>}
    <button className="dm-danger" onClick={wipe}><Trash2 size={14}/>Delete my account and data</button>
  </div>
}
