import { useEffect, useState } from 'react'
import type { Scene, SceneOpts } from './lib/seva'
import { loadAnalysisIntent, getIntentProfile, type AnalysisIntent } from './lib/analysisIntent'

type Props = { opts: SceneOpts; onApply: (o: SceneOpts) => void; busy: boolean; scene?: Scene; intent?: AnalysisIntent }
const today = () => new Date().toISOString().slice(0, 10)
const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)

export default function SceneBar({ opts, onApply, busy, scene, intent }: Props) {
  const [o, setO] = useState<SceneOpts>({ date: ago(5), from: ago(30), to: today(), ...opts })
  const [currentIntent, setCurrentIntent] = useState<AnalysisIntent>(intent || loadAnalysisIntent)

  useEffect(() => {
    if (intent) setCurrentIntent(intent)
  }, [intent])

  useEffect(() => {
    const handle = (e: any) => { if (e.detail) setCurrentIntent(e.detail) }
    window.addEventListener('seva-analysis-intent-changed', handle)
    return () => window.removeEventListener('seva-analysis-intent-changed', handle)
  }, [])

  const intentProf = getIntentProfile(currentIntent)
  const mode = o.mode ?? 'latest', cloud = o.maxCloud ?? 30
  const bad = (mode === 'range' && !!o.from && !!o.to && o.from > o.to) || (mode === 'date' && !o.date)
  const set = (p: SceneOpts) => setO(x => ({ ...x, ...p }))

  return (
    <div className="scene-bar-wrap" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className="scene-bar" role="group" aria-label="Satellite picture settings">
        <div className="sb-seg" role="tablist">
          {([['latest', 'Latest'], ['date', 'Single date'], ['range', 'Date range']] as const).map(([k, t]) => (
            <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''} onClick={() => set({ mode: k })}>{t}</button>
          ))}
        </div>
        {mode === 'date' && <label className="sb-f">Date<input type="date" max={today()} value={o.date ?? ''} onChange={e => set({ date: e.target.value })}/></label>}
        {mode === 'range' && <><label className="sb-f">From<input type="date" max={today()} value={o.from ?? ''} onChange={e => set({ from: e.target.value })}/></label><label className="sb-f">To<input type="date" max={today()} value={o.to ?? ''} onChange={e => set({ to: e.target.value })}/></label></>}
        {mode !== 'date' && <label className="sb-f sb-cloud">Max cloud <b>{cloud}%</b><input type="range" min={5} max={100} step={5} value={cloud} onChange={e => set({ maxCloud: Number(e.target.value) })}/></label>}
        <button className="sb-apply" disabled={busy || bad} onClick={() => onApply(o)} title="Load Sentinel-2 imagery calibrated with Google Earth Engine pipeline"><i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-satellite-dish'}`}/> {busy ? 'Syncing GEE…' : 'Apply'}</button>
        <span className="sb-now">
          {scene ? (
            <>
              <span
                className="sb-quality-indicator"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  marginRight: 6,
                  background: scene.cloud < 15 ? 'rgba(34, 197, 94, 0.15)' : scene.cloud <= 35 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: scene.cloud < 15 ? '#16a34a' : scene.cloud <= 35 ? '#ca8a04' : '#dc2626'
                }}
                title="Satellite Pass Quality: Green = Clear (<15% cloud), Yellow = Moderate (15–35% cloud), Red = Cloud-obscured (>35% cloud)"
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                {scene.cloud < 15 ? 'Clear (<15%)' : scene.cloud <= 35 ? 'Usable (15–35%)' : 'Cloudy (>35%)'}
              </span>
              Preview <b>{new Date(scene.datetime).toLocaleDateString()}</b> · <b>{scene.cloud}%</b> cloud · <b className="sb-gee-tag">Google Earth Engine Calibrated</b>{(scene.ids?.length ?? 0) > 0 && ` · ${(scene.ids?.length ?? 0) + 1} tiles joined`}{scene.filled ? ` · ${scene.filled} gap-fill` : ''}
            </>
          ) : 'No picture yet'}
        </span>
      </div>
      <div className="sb-bands-guidance" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '5px 12px', fontSize: 11, background: 'rgba(15, 23, 42, 0.85)', borderTop: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
        <span style={{ fontWeight: 600, color: '#e2e8f0' }}>Guidance for {intentProf.label}:</span>
        {intentProf.recommendedBands.map(b => (
          <span key={b.name} style={{ background: 'rgba(255,255,255,0.07)', padding: '2px 7px', borderRadius: 4, color: '#cbd5e1', fontSize: 10.5 }} title={b.description}>
            {b.name} <code style={{ color: '#86efac', fontWeight: 600 }}>[{b.rgb.join('/')}]</code>
          </span>
        ))}
      </div>
    </div>
  )
}
