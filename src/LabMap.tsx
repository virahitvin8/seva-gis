import { useEffect, useMemo, useRef, useState } from 'react'
import { farmBBox, farmRing, loadScene, type FarmData, type Scene } from './lib/seva'
import { hotspots, type Patch } from './lib/gee'

type Farm = FarmData & { id: string; name: string }
export type LegendRow = { color: string; label: string }

const ESRI_EXPORT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export'

// Real vulnerable spots: the weakest connected patches of this field on the latest clear Sentinel-2 pass.
export function useWeakSpots(farm: Farm, scene?: Scene) {
  const [spots, setSpots] = useState<Patch[]>([])
  useEffect(() => {
    if (!scene) { setSpots([]); return }
    let dead = false
    loadScene(scene, farm).then(g => { if (!dead) setSpots(hotspots(g, farmRing(farm), farm)?.patches.slice(0, 5) ?? []) }).catch(() => { if (!dead) setSpots([]) })
    return () => { dead = true }
  }, [scene?.id, farm.id, farm.area, farm.polygon?.length])
  return spots
}

function niceScale(widthM: number) {
  const target = widthM / 4, p = Math.pow(10, Math.floor(Math.log10(target))), m = [1, 2, 5, 10].find(v => v * p >= target) ?? 10
  return m * p
}

export function MapFrame({ farm, scene, overlay, title, note, legend, opacity = 1, marks, caption, highlightAoi = false }: { farm: Farm; scene?: Scene; overlay?: string; title: string; note: string; legend?: LegendRow[]; opacity?: number; marks?: Patch[]; caption?: string; highlightAoi?: boolean }) {
  const spots = useWeakSpots(farm, scene), weak = marks ?? spots
  const [w, s, e, n] = farmBBox(farm)
  const pad = 0.45, dw = (e - w) * pad, dh = (n - s) * pad
  const bb = [w - dw, s - dh, e + dw, n + dh], cos = Math.cos(((s + n) / 2) * Math.PI / 180)
  const wm = (bb[2] - bb[0]) * 111320 * cos, hm = (bb[3] - bb[1]) * 111320
  const W = 2048, H = Math.min(2560, Math.round(W * (hm / wm)))
  const ctx = `${ESRI_EXPORT}?bbox=${bb.join(',')}&bboxSR=4326&imageSR=4326&size=${W},${H}&format=jpg&f=image`
  const X = (lon: number) => ((lon - bb[0]) / (bb[2] - bb[0])) * 100, Y = (lat: number) => ((bb[3] - lat) / (bb[3] - bb[1])) * 100
  const ring = farmRing(farm)
  const scaleM = niceScale(wm), scaleW = (scaleM / wm) * 100
  const maskId = `aoi-mask-${farm.id}-${title.replace(/\W+/g, '')}`

  return <figure className="ge-fig lab-map">
    <div className="lab-stage" style={{ aspectRatio: `${W} / ${H}` }}>
      <CtxImage url={ctx} bb={bb} W={W} H={H}/>
      {overlay && <img className="lab-over" src={overlay} alt={title} style={{ left: `${X(w)}%`, top: `${Y(n)}%`, width: `${X(e) - X(w)}%`, height: `${Y(s) - Y(n)}%`, opacity }}/>}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="lab-svg">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100" height="100" fill="white" />
            <polygon points={ring.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')} fill="black" />
          </mask>
        </defs>
        {highlightAoi && (
          <rect x="0" y="0" width="100" height="100" fill="#06120c" opacity="0.28" mask={`url(#${maskId})`} />
        )}
        <polygon
          points={ring.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
          style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.85))' }}
        />
      </svg>
      {weak.map((p, i) => <span key={i} className="lab-weak" style={{ left: `${X(p.lon)}%`, top: `${Y(p.lat)}%` }} title={`Weak spot ${i + 1}: ${p.ha.toFixed(2)} ha, ${p.signature}`}>{i + 1}</span>)}
      <div className="lab-title">{title}</div>
      <div className="lab-north" aria-label="North"><b>N</b><svg viewBox="0 0 20 28"><path d="M10 1 L18 26 L10 20 L2 26 Z" fill="#fff" stroke="#10241b" strokeWidth="1.5"/></svg></div>
      <div className="lab-scale" style={{ width: `${scaleW}%` }}><i/><span>{scaleM >= 1000 ? `${scaleM / 1000} km` : `${scaleM} m`}</span></div>
    </div>
    <div className="lab-how"><b>How to read this map.</b> {note}{weak.length > 0 && <> <span className="lab-weak inline">1</span> Numbered red dots mark vulnerable spots: the weakest patches of your farm, to walk and check first.</>}</div>
    {legend && <ul className="lab-legend">{legend.map(l => <li key={l.label}><i style={{ background: l.color }}/>{l.label}</li>)}</ul>}
    <figcaption>{caption ?? `${title} · Sentinel-2 ${scene?.datetime.slice(0, 10) ?? ''} · background Esri World Imagery`}</figcaption>
  </figure>
}

export function useLegendFromRows<T extends { color: string; name: string; pct?: number }>(rows: T[] | undefined): LegendRow[] | undefined {
  return useMemo(() => rows?.map(r => ({ color: r.color, label: r.pct !== undefined ? `${r.name} · ${r.pct.toFixed(0)}%` : r.name })), [rows])
}

const tileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z)
const tileY = (lat: number, z: number) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z) }
const lonOf = (x: number, z: number) => (x / 2 ** z) * 360 - 180
const latOf = (y: number, z: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

// Background imagery: Esri export first (at full, then smaller sizes); if that fails, stitch Esri tiles onto a canvas.
function CtxImage({ url, bb, W, H }: { url: string; bb: number[]; W: number; H: number }) {
  const [level, setLevel] = useState(0)
  const cv = useRef<HTMLCanvasElement>(null)
  useEffect(() => { setLevel(0) }, [url])
  useEffect(() => {
    if (level < 2) return
    const c = cv.current
    if (!c) return
    const ctx = c.getContext('2d')!
    c.width = W; c.height = H
    ctx.fillStyle = '#10241b'; ctx.fillRect(0, 0, W, H)
    const [w, s, e, n] = bb
    let z = 18
    while (z > 8 && (tileX(e, z) - tileX(w, z) + 1) * (tileY(s, z) - tileY(n, z) + 1) > 36) z--
    for (let x = tileX(w, z); x <= tileX(e, z); x++) for (let y = tileY(n, z); y <= tileY(s, z); y++) {
      const img = new Image(); img.crossOrigin = 'anonymous'
      img.onload = () => {
        const x0 = ((lonOf(x, z) - w) / (e - w)) * W, x1 = ((lonOf(x + 1, z) - w) / (e - w)) * W
        const y0 = ((n - latOf(y, z)) / (n - s)) * H, y1 = ((n - latOf(y + 1, z)) / (n - s)) * H
        ctx.drawImage(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1)
      }
      img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
    }
  }, [level, url])
  if (level >= 2) return <canvas ref={cv} className="lab-ctx"/>
  const src = level === 0 ? url : url.replace(/size=\d+,\d+/, `size=800,${Math.round((800 * H) / W)}`)
  return <img className="lab-ctx" src={src} alt="" onError={() => setLevel(l => l + 1)}/>
}
