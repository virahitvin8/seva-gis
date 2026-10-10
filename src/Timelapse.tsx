import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Pause, Play } from 'lucide-react'
import LogoLoader from './LogoLoader'
import { CHANGE_CLASSES, timelapse, type Timelapse as TL, type TimelapseMode } from './lib/gee'
import { searchScenes, type FarmData } from './lib/seva'

const MODES: [TimelapseMode, string, string][] = [
  ['rgb', 'True colour', 'The farm as a camera would see it.'],
  ['ndvi', 'Crop greenness (NDVI)', 'Red is bare or stressed, dark green is dense and healthy.'],
  ['change', 'Change vs first date', 'Shows where the crop got greener or weaker compared with the first picture.'],
]
const iso = (d: Date) => d.toISOString().slice(0, 10)
const NDVI_BAR = 'linear-gradient(90deg,#a50026,#fdae61,#fee08b,#a6d96a,#006837)'

export default function Timelapse({ farm }: { farm: FarmData & { id: string; name: string } }) {
  const today = new Date()
  const [from, setFrom] = useState(iso(new Date(today.getTime() - 120 * 86400000)))
  const [to, setTo] = useState(iso(today))
  const [cloud, setCloud] = useState(30)
  const [mode, setMode] = useState<TimelapseMode>('ndvi')
  const [busy, setBusy] = useState<string>('')
  const [error, setError] = useState('')
  const [tl, setTl] = useState<TL | null>(null)
  const [imgs, setImgs] = useState<HTMLImageElement[]>([])
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rec, setRec] = useState(false)
  const cv = useRef<HTMLCanvasElement>(null)

  useEffect(() => { setTl(null); setImgs([]); setError(''); setPlaying(false) }, [farm.id])

  const run = async () => {
    setError(''); setPlaying(false); setBusy('Searching Sentinel-2 passes…')
    try {
      if (from >= to) throw new Error('Pick a start date that is before the end date.')
      const scenes = await searchScenes(farm, from, to, cloud, 12)
      if (scenes.length < 2) throw new Error('Fewer than two clear pictures in that range. Widen the dates or raise the cloud limit.')
      const res = await timelapse(farm, scenes, mode, (d, t) => setBusy(`Building frames ${d} of ${t}…`))
      const loaded = await Promise.all(res.frames.map(fr => new Promise<HTMLImageElement>((ok, fail) => {
        const im = new Image()
        im.onload = () => ok(im)
        im.onerror = () => fail(new Error(`Could not load the ${fr.scene.datetime.slice(0, 10)} image.`))
        im.src = fr.url
      })))
      setTl(res); setImgs(loaded); setI(0); setPlaying(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not build the time-lapse.') }
    setBusy('')
  }

  const draw = (idx: number) => {
    const c = cv.current
    if (!c || !tl || !imgs[idx]) return
    const W = 720, H = Math.max(360, Math.round((W * tl.h) / tl.w))
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
    const x = c.getContext('2d')!, fr = tl.frames[idx], im = imgs[idx]
    x.fillStyle = '#16221a'; x.fillRect(0, 0, W, H)
    const k = Math.min((W - 24) / im.width, (H - 24) / im.height), dw = im.width * k, dh = im.height * k
    x.imageSmoothingEnabled = false
    x.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh)
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 0, W, 34)
    x.fillStyle = '#fff'; x.font = '600 16px system-ui,sans-serif'; x.textBaseline = 'middle'
    x.fillText(`${farm.name} · ${fr.scene.datetime.slice(0, 10)}`, 12, 17)
    x.textAlign = 'right'; x.font = '12px system-ui,sans-serif'
    x.fillText(`${idx + 1}/${tl.frames.length} · cloud ${fr.scene.cloud}% · Sentinel-2`, W - 12, 17)
    x.textAlign = 'left'
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, H - 26, W, 26)
    x.fillStyle = '#fff'; x.font = '11px system-ui,sans-serif'
    const label = tl.mode === 'change' ? `Mean NDVI change since first date: ${fr.delta >= 0 ? '+' : ''}${fr.delta.toFixed(3)}` : `Mean NDVI ${fr.ndvi.toFixed(2)}`
    x.fillText(label, 12, H - 13)
    if (tl.mode === 'ndvi') {
      const g = x.createLinearGradient(W - 172, 0, W - 12, 0)
      ;['#a50026', '#fdae61', '#fee08b', '#a6d96a', '#006837'].forEach((col, n) => g.addColorStop(n / 4, col))
      x.fillStyle = g; x.fillRect(W - 172, H - 19, 160, 8)
    } else if (tl.mode === 'change') {
      CHANGE_CLASSES.forEach((cl, n) => { x.fillStyle = cl.color; x.fillRect(W - 172 + n * 32, H - 19, 32, 8) })
    }
  }

  useEffect(() => { draw(i) }, [i, tl, imgs])
  useEffect(() => {
    if (!playing || !tl) return
    const t = setInterval(() => setI(p => (p + 1) % tl.frames.length), 700)
    return () => clearInterval(t)
  }, [playing, tl])

  const series = useMemo(() => tl?.frames.map(f => f.ndvi) ?? [], [tl])
  const first = tl?.frames[0], last = tl?.frames[tl.frames.length - 1]
  const net = last && first ? last.ndvi - first.ndvi : 0

  const record = async () => {
    const c = cv.current
    if (!c || !tl || typeof MediaRecorder === 'undefined') { setError('This browser cannot record video. Try Chrome or Edge.'); return }
    setRec(true); setPlaying(false)
    let stream: MediaStream | undefined
    let recorder: MediaRecorder | undefined
    let videoUrl = ''
    try {
      stream = c.captureStream(10)
      const mime = ['video/webm;codecs=vp9', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) ?? ''
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 3_000_000 } : undefined)
      const parts: Blob[] = []
      recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data) }
      const stopped = new Promise<void>(resolve => { recorder!.onstop = () => resolve() })
      recorder.start()
      for (let n = 0; n < tl.frames.length; n++) {
        setI(n)
        draw(n)
        await new Promise(resolve => setTimeout(resolve, 800))
      }
      recorder.stop()
      await stopped
      videoUrl = URL.createObjectURL(new Blob(parts, { type: 'video/webm' }))
      const a = document.createElement('a')
      a.href = videoUrl
      a.download = `${farm.name.replace(/\W+/g, '-')}-timelapse-${from}-${to}.webm`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(videoUrl), 1000)
    } catch (e) {
      setError(e instanceof Error ? `Could not record the time-lapse: ${e.message}` : 'Could not record the time-lapse.')
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      if (videoUrl) URL.revokeObjectURL(videoUrl)
    } finally {
      stream?.getTracks().forEach(track => track.stop())
      setRec(false)
    }
  }

  return <>
    <div className="tl-bar">
      <label>From<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}/></label>
      <label>To<input type="date" value={to} max={iso(today)} onChange={e => setTo(e.target.value)}/></label>
      <label className="tl-cloud">Max cloud {cloud}%<input type="range" min={5} max={80} step={5} value={cloud} onChange={e => setCloud(+e.target.value)}/></label>
      <div className="tl-modes" role="group" aria-label="What to show">{MODES.map(([id, label]) => <button key={id} className={mode === id ? 'on' : ''} onClick={() => setMode(id)}>{label}</button>)}</div>
      <button className="tl-go" onClick={run} disabled={!!busy}><Play size={14}/>Make time-lapse</button>
    </div>
    <p className="tl-help">{MODES.find(m => m[0] === mode)![2]} Pick any date range for this farm. Up to 12 clear Sentinel-2 passes are stitched into a short film, one frame per date, clipped to your boundary.</p>
    {busy && <div className="tl-busy"><LogoLoader inline size={44} text={busy}/></div>}
    {error && <div className="ag-empty">{error}</div>}
    {tl && <div className="tl-stage">
      <canvas ref={cv} className="tl-canvas"/>
      <div className="tl-ctrl">
        <button onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
        <input type="range" min={0} max={tl.frames.length - 1} value={i} onChange={e => { setPlaying(false); setI(+e.target.value) }} aria-label="Frame"/>
        <button onClick={record} disabled={rec} className="tl-dl"><Download size={14}/>{rec ? 'Recording…' : 'Download video'}</button>
      </div>
      <div className="ge-slider-ends"><span>{first!.scene.datetime.slice(0, 10)}</span><span>{last!.scene.datetime.slice(0, 10)}</span></div>
      {tl.mode === 'ndvi' && <><div className="sc-bar" style={{ height: 10, background: NDVI_BAR }}/><div className="ge-slider-ends"><span>0.0 bare / stressed</span><span>0.9 dense, healthy</span></div></>}
      {tl.mode === 'change' && <div className="tl-legend">{CHANGE_CLASSES.map(c => <span key={c.id}><i style={{ background: c.color }}/>{c.name}<em>{c.note}</em></span>)}</div>}
      <svg className="tl-spark" viewBox="0 0 200 40" preserveAspectRatio="none" aria-label="NDVI over time">
        <polyline fill="none" stroke="#2f7d4f" strokeWidth="2" points={series.map((v, n) => `${(n / (series.length - 1)) * 200},${38 - Math.max(0, Math.min(1, v / 0.9)) * 36}`).join(' ')}/>
      </svg>
      <div className={`wt-verdict ${net < -0.05 ? 'warn' : ''}`}><div>
        <b>{net > 0.05 ? 'The crop got greener over this period.' : net < -0.05 ? 'The crop got weaker over this period.' : 'Little overall change in this period.'}</b> Average NDVI went from {first!.ndvi.toFixed(2)} to {last!.ndvi.toFixed(2)} ({net >= 0 ? '+' : ''}{net.toFixed(2)}).
        <small className="ge-why"> Why: {net > 0.05 ? 'plants were growing, leaves were filling in.' : net < -0.05 ? 'this is normal after harvest or at ripening, but a sudden fall in a growing crop can mean water stress, pests or flooding.' : 'the crop stayed in about the same stage.'}</small>
      </div></div>
    </div>}
  </>
}
