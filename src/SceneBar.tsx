import { useState } from 'react'
import type { Scene, SceneOpts } from './lib/seva'

type Props = { opts: SceneOpts; onApply: (o: SceneOpts) => void; busy: boolean; scene?: Scene }
const today = () => new Date().toISOString().slice(0, 10)
const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)

export default function SceneBar({ opts, onApply, busy, scene }: Props) {
  const [o, setO] = useState<SceneOpts>({ date: ago(5), from: ago(30), to: today(), ...opts })
  const mode = o.mode ?? 'latest', cloud = o.maxCloud ?? 30
  const bad = (mode === 'range' && !!o.from && !!o.to && o.from > o.to) || (mode === 'date' && !o.date)
  const set = (p: SceneOpts) => setO(x => ({ ...x, ...p }))
  return <div className="scene-bar" role="group" aria-label="Satellite picture settings">
    <div className="sb-seg" role="tablist">
      {([['latest', 'Latest'], ['date', 'Single date'], ['range', 'Date range']] as const).map(([k, t]) => <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''} onClick={() => set({ mode: k })}>{t}</button>)}
    </div>
    {mode === 'date' && <label className="sb-f">Date<input type="date" max={today()} value={o.date ?? ''} onChange={e => set({ date: e.target.value })}/></label>}
    {mode === 'range' && <><label className="sb-f">From<input type="date" max={today()} value={o.from ?? ''} onChange={e => set({ from: e.target.value })}/></label><label className="sb-f">To<input type="date" max={today()} value={o.to ?? ''} onChange={e => set({ to: e.target.value })}/></label></>}
    {mode !== 'date' && <label className="sb-f sb-cloud">Max cloud <b>{cloud}%</b><input type="range" min={5} max={100} step={5} value={cloud} onChange={e => set({ maxCloud: Number(e.target.value) })}/></label>}
    <button className="sb-apply" disabled={busy || bad} onClick={() => onApply(o)}><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-satellite-dish'}`}/> {busy ? 'Working' : 'Apply'}</button>
    <span className="sb-now">{scene ? <>Showing <b>{new Date(scene.datetime).toLocaleDateString()}</b> · <b>{scene.cloud}%</b> cloud{(scene.ids?.length ?? 0) > 0 && ` · ${(scene.ids?.length ?? 0) + 1} tiles joined`}{scene.filled ? ` · ${scene.filled} gap-fill` : ''}</> : 'No picture yet'}</span>
  </div>
}
