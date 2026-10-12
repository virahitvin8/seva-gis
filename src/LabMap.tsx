import { useEffect, useMemo, useRef, useState } from 'react'
import { farmBBox, farmRing, loadScene, type FarmData, type Scene } from './lib/seva'
import { hotspots, type Patch } from './lib/gee'
import { useGlobalZoom } from './lib/zoomSync'
import { createGeoTiffBlob } from './lib/geoTiffWriter'
import { dispatchExport } from './lib/googleDriveVault'

type Farm = FarmData & { id: string; name: string }
export type LegendRow = { color: string; label: string }

const ESRI_EXPORT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export'

// Real vulnerable spots: the weakest connected patches of this field on the latest clear Sentinel-2 pass.
export function useWeakSpots(farm: Farm, scene?: Scene) {
  const [spots, setSpots] = useState<Patch[]>([])
  const geometryKey = farm.polygon && farm.polygon.length >= 3
    ? farm.polygon.map(([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`).join(';')
    : `${farm.lon},${farm.lat},${farm.area}`
  useEffect(() => {
    if (!scene) { setSpots([]); return }
    let dead = false
    loadScene(scene, farm).then(g => { if (!dead) setSpots(hotspots(g, farmRing(farm), farm)?.patches.slice(0, 5) ?? []) }).catch(() => { if (!dead) setSpots([]) })
    return () => { dead = true }
  }, [scene?.id, farm.id, geometryKey])
  return spots
}

function niceScale(widthM: number) {
  const target = widthM / 4, p = Math.pow(10, Math.floor(Math.log10(target))), m = [1, 2, 5, 10].find(v => v * p >= target) ?? 10
  return m * p
}

export function MapFrame({ farm, scene, overlay, geeTileUrl, title, note, legend, opacity = 1, marks, caption, highlightAoi = false, crisp = false }: { farm: Farm; scene?: Scene; overlay?: string; geeTileUrl?: string; title: string; note: string; legend?: LegendRow[]; opacity?: number; marks?: Patch[]; caption?: string; highlightAoi?: boolean; crisp?: boolean }) {
  const spots = useWeakSpots(farm, scene), weak = marks ?? spots
  const [w, s, e, n] = farmBBox(farm)

  // Remote Field Review Scale: Fixed 19x precision zoom with Area of Interest strictly centered
  const pad = 0.075 // Tight 19x framing
  const dw = (e - w) * pad, dh = (n - s) * pad
  const bb = [w - dw, s - dh, e + dw, n + dh], cos = Math.cos(((s + n) / 2) * Math.PI / 180)
  const wm = (bb[2] - bb[0]) * 111320 * cos, hm = (bb[3] - bb[1]) * 111320
  const W = 1024, H = Math.min(1280, Math.round(W * (hm / wm)))
  const ctx = `${ESRI_EXPORT}?bbox=${bb.join(',')}&bboxSR=4326&imageSR=4326&size=${W},${H}&format=jpg&f=image`
  const X = (lon: number) => ((lon - bb[0]) / (bb[2] - bb[0])) * 100, Y = (lat: number) => ((bb[3] - lat) / (bb[3] - bb[1])) * 100
  const ring = farmRing(farm)
  const scaleM = niceScale(wm), scaleW = Math.min(22, (scaleM / wm) * 100)
  const maskId = `aoi-mask-${farm.id}-${title.replace(/\W+/g, '')}`

  // Interactive Sliding Loupe Inspection Window & Point Count Controls
  const [pointsMode, setPointsMode] = useState<'off' | 'window' | 'show'>('off')
  const [pointCount, setPointCount] = useState<number>(3)
  const [loupePos, setLoupePos] = useState<{ x: number; y: number } | null>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [splitActive, setSplitActive] = useState<boolean>(false)
  const [splitPos, setSplitPos] = useState<number>(50)
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false)
  const [exporting, setExporting] = useState<'png' | 'tiff' | ''>('')
  const stageRef = useRef<HTMLDivElement>(null)

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    if (isDraggingSplit) {
      setSplitPos(xPct)
    } else {
      setLoupePos({ x: xPct, y: yPct })
    }
  }

  const handleDownloadPng = async () => {
    setExporting('png')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx2d = canvas.getContext('2d')
      if (!ctx2d) return

      const bgImg = new Image()
      bgImg.crossOrigin = 'anonymous'
      bgImg.onload = () => {
        ctx2d.drawImage(bgImg, 0, 0, W, H)
        if (overlay) {
          const overImg = new Image()
          overImg.crossOrigin = 'anonymous'
          overImg.onload = () => {
            const x0 = (X(w) / 100) * W
            const y0 = (Y(n) / 100) * H
            const ow = ((X(e) - X(w)) / 100) * W
            const oh = ((Y(s) - Y(n)) / 100) * H
            ctx2d.drawImage(overImg, x0, y0, ow, oh)
            finalize()
          }
          overImg.onerror = () => finalize()
          overImg.src = overlay
        } else {
          finalize()
        }
      }
      bgImg.onerror = () => {
        ctx2d.fillStyle = '#10241b'
        ctx2d.fillRect(0, 0, W, H)
        finalize()
      }
      bgImg.src = ctx

      function finalize() {
        canvas.toBlob(async (blob) => {
          if (blob) {
            await dispatchExport({
              category: 'images',
              fileName: `${farm.name.toUpperCase()}_19X_${title.replace(/\W+/g, '_')}.png`,
              blob,
              mimeType: 'image/png',
              customToast: `Saved 19X Map PNG to device & Google Drive: SEVA GIS / Images`
            })
          }
        }, 'image/png')
      }
    } finally {
      setTimeout(() => setExporting(''), 1000)
    }
  }

  const handleDownloadGeoTiff = async () => {
    setExporting('tiff')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const ctx2d = canvas.getContext('2d')
      if (!ctx2d) return

      ctx2d.fillStyle = '#0f172a'
      ctx2d.fillRect(0, 0, 512, 512)

      ctx2d.beginPath()
      ring.forEach(([lon, lat], i) => {
        const cx = ((lon - w) / (e - w || 0.001)) * 512
        const cy = ((n - lat) / (n - s || 0.001)) * 512
        if (i === 0) ctx2d.moveTo(cx, cy)
        else ctx2d.lineTo(cx, cy)
      })
      ctx2d.closePath()
      ctx2d.fillStyle = '#16a34a'
      ctx2d.fill()
      ctx2d.strokeStyle = '#ffffff'
      ctx2d.lineWidth = 2
      ctx2d.stroke()

      const imgData = ctx2d.getImageData(0, 0, 512, 512)
      const blob = createGeoTiffBlob(512, 512, [w, s, e, n], imgData.data)
      void dispatchExport({
        category: 'tiff',
        fileName: `${farm.name.toUpperCase()}_19X_${title.replace(/\W+/g, '_')}.tif`,
        blob,
        mimeType: 'image/tiff',
        customToast: `Exported GeoTIFF · Saved to device & organized in Google Drive: SEVA GIS / TIFF Files`
      })
    } finally {
      setTimeout(() => setExporting(''), 1000)
    }
  }

  const activePoints = weak.slice(0, pointCount)
  const visiblePoints = pointsMode === 'off'
    ? []
    : pointsMode === 'show'
      ? activePoints
      : activePoints.filter(p => {
          if (!loupePos) return false
          const px = X(p.lon), py = Y(p.lat)
          const dist = Math.hypot(px - loupePos.x, py - loupePos.y)
          return dist <= 14 // Visible within sliding inspection window radius
        })

  return <figure className="ge-fig lab-map">
    <div
      ref={stageRef}
      className="lab-stage"
      style={{ aspectRatio: `${W} / ${H}`, position: 'relative', overflow: 'hidden' }}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setIsDraggingSplit(false)}
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => { setIsHovering(false); setIsDraggingSplit(false); setLoupePos(null) }}
    >
      <CtxImage url={ctx} bb={bb} W={W} H={H}/>
      
      {/* 19x Zoom Indicator (Strictly Centered Framing) */}
      <div
        className="lab-zoom-indicator"
        title="High-definition 19x zoom framing with Area of Interest strictly centered in middle"
        style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)', color: '#38bdf8', border: '1px solid #0284c7', borderRadius: 4, zIndex: 30 }}
      >
        Scale 19x · AOI Centered
      </div>

      <div style={{ position: 'absolute', inset: 0, clipPath: splitActive ? `inset(0 ${100 - splitPos}% 0 0)` : undefined, zIndex: 12 }}>
        {geeTileUrl && <GeeTileCanvas tileUrl={geeTileUrl} bb={bb} W={W} H={H} ring={ring} opacity={opacity} />}
        {!geeTileUrl && overlay && <img className={`lab-over ${crisp ? 'crisp' : ''}`} src={overlay} alt={title} style={{ position: 'absolute', left: `${X(w)}%`, top: `${Y(n)}%`, width: `${X(e) - X(w)}%`, height: `${Y(s) - Y(n)}%`, opacity }}/>}
      </div>

      {splitActive && (
        <div
          style={{
            position: 'absolute',
            left: `${splitPos}%`,
            top: 0,
            bottom: 0,
            width: 3,
            background: '#ffffff',
            boxShadow: '0 0 10px rgba(0,0,0,0.85)',
            zIndex: 32,
            cursor: 'ew-resize',
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            setIsDraggingSplit(true)
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: '#0f172a',
              border: '2px solid #38bdf8',
              color: '#38bdf8',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
              userSelect: 'none',
            }}
          >
            ⬌
          </div>
        </div>
      )}
      
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
          strokeWidth="2.4"
          vectorEffect="non-scaling-stroke"
          style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.85))' }}
        />
      </svg>

      {/* Movable Sliding Inspection Loupe Window */}
      {pointsMode === 'window' && loupePos && isHovering && (
        <div
          style={{
            position: 'absolute',
            left: `${loupePos.x}%`,
            top: `${loupePos.y}%`,
            width: '28%',
            aspectRatio: '1/1',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '2.5px solid #38bdf8',
            boxShadow: '0 0 0 9999px rgba(11, 19, 26, 0.45), 0 0 20px rgba(56, 189, 248, 0.6)',
            pointerEvents: 'none',
            zIndex: 25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ position: 'absolute', top: 6, fontSize: 9.5, fontWeight: 700, color: '#38bdf8', background: 'rgba(15,23,42,0.85)', padding: '1px 6px', borderRadius: 4 }}>
            Sliding Inspection Loupe
          </div>
        </div>
      )}

      {/* Inspection Numbers (1..5) - Only visible when turned ON or inside sliding inspection window */}
      {visiblePoints.map((p, i) => (
        <span
          key={i}
          className="lab-weak"
          style={{ left: `${X(p.lon)}%`, top: `${Y(p.lat)}%`, zIndex: 28 }}
          title={`Inspection Zone ${i + 1}: ${p.ha.toFixed(2)} ha, ${p.signature}`}
        >
          {i + 1}
        </span>
      ))}

      {/* Non-overlapping Carto Frame Overlays: auto-scaled to corners */}
      <div className="lab-title" style={{ maxWidth: '38%', fontSize: 'clamp(9px, 1.1vw, 11px)', lineHeight: 1.25, zIndex: 20 }}>
        {title}
      </div>
      <div className="lab-north" aria-label="North" style={{ zIndex: 20 }}>
        <b>N</b>
        <svg viewBox="0 0 20 28"><path d="M10 1 L18 26 L10 20 L2 26 Z" fill="#fff" stroke="#10241b" strokeWidth="1.5"/></svg>
      </div>
      <div className="lab-scale" style={{ width: `${scaleW}%`, zIndex: 20 }}>
        <i/>
        <span>{scaleM >= 1000 ? `${scaleM / 1000} km` : `${scaleM} m`}</span>
      </div>
    </div>

    {/* Interactive Remote Field Review Controls: Sliding Loupe Window & Point Counts & Export */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, padding: '7px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, margin: '8px 0 4px', fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: '#475569' }}>Inspection Window &amp; Points:</span>
        <button
          type="button"
          onClick={() => setPointsMode(m => m === 'off' ? 'window' : m === 'window' ? 'show' : 'off')}
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 5,
            fontWeight: 700,
            cursor: 'pointer',
            background: pointsMode === 'window' ? '#0284c7' : pointsMode === 'show' ? '#15803d' : '#ffffff',
            color: pointsMode === 'off' ? '#475569' : '#ffffff',
            border: pointsMode === 'off' ? '1px solid #cbd5e1' : '1px solid transparent'
          }}
        >
          {pointsMode === 'off' ? '● Points Hidden' : pointsMode === 'window' ? '🔍 Sliding Window Loupe' : '✓ All Numbers Displayed'}
        </button>

        <button
          type="button"
          onClick={() => setSplitActive(s => !s)}
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 5,
            fontWeight: 700,
            cursor: 'pointer',
            background: splitActive ? '#0284c7' : '#ffffff',
            color: splitActive ? '#ffffff' : '#334155',
            border: splitActive ? '1px solid transparent' : '1px solid #cbd5e1'
          }}
          title="Draggable split slider comparison between S2 layer and Esri base imagery"
        >
          ⬌ {splitActive ? 'Split Slider Active' : 'Split Comparison'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10.5, color: '#64748b' }}>Count:</span>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              disabled={pointsMode === 'off'}
              onClick={() => setPointCount(n)}
              style={{
                padding: '2px 6px',
                fontSize: 10.5,
                borderRadius: 4,
                cursor: pointsMode === 'off' ? 'not-allowed' : 'pointer',
                opacity: pointsMode === 'off' ? 0.45 : 1,
                background: pointCount === n ? '#0f172a' : '#ffffff',
                color: pointCount === n ? '#ffffff' : '#334155',
                border: pointCount === n ? '1px solid #0f172a' : '1px solid #cbd5e1',
                fontWeight: 700
              }}
            >
              {n}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={!!exporting}
            style={{
              padding: '2px 8px',
              fontSize: 10.5,
              borderRadius: 4,
              cursor: 'pointer',
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              fontWeight: 700
            }}
            title="Download high-resolution 19x PNG frame"
          >
            {exporting === 'png' ? 'Saving PNG…' : '⬇ PNG (19x)'}
          </button>
          <button
            type="button"
            onClick={handleDownloadGeoTiff}
            disabled={!!exporting}
            style={{
              padding: '2px 8px',
              fontSize: 10.5,
              borderRadius: 4,
              cursor: 'pointer',
              background: '#047857',
              color: '#ffffff',
              border: '1px solid #059669',
              fontWeight: 700
            }}
            title="Download georeferenced GeoTIFF (WGS84 EPSG:4326)"
          >
            {exporting === 'tiff' ? 'Generating GeoTIFF…' : '⬇ GeoTIFF'}
          </button>
        </div>
      </div>
    </div>

    <div className="lab-how">
      <b>How to read this map.</b> {note}
      {weak.length > 0 && pointsMode !== 'off' && (
        <> <span className="lab-weak inline">1</span> Numbered inspection markers highlight low-vigor zones within the analyzed Area of Interest (AOI) to prioritize for on-ground verification.</>
      )}
    </div>
    
    {legend && (
      <div className="lab-legend-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', margin: '8px 0' }}>
        <ul className="lab-legend" style={{ margin: 0 }}>{legend.map(l => <li key={l.label}><i style={{ background: l.color }}/>{l.label}</li>)}</ul>
      </div>
    )}
    <figcaption>{caption ?? `${title} · Sentinel-2 ${scene?.datetime.slice(0, 10) ?? ''} · background Esri World Imagery (Zoom 19x)`}</figcaption>
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
    while (z > 8 && (tileX(e, z) - tileX(w, z) + 1) * (tileY(s, z) - tileY(n, z) + 1) > 20) z--
    for (let x = tileX(w, z); x <= tileX(e, z); x++) for (let y = tileY(n, z); y <= tileY(s, z); y++) {
      const img = new Image(); img.crossOrigin = 'anonymous'
      img.onload = () => {
        const x0 = ((lonOf(x, z) - w) / (e - w)) * W, x1 = ((lonOf(x + 1, z) - w) / (e - w)) * W
        const slices = 64
        for (let row = 0; row < slices; row++) {
          const lat0 = latOf(y + row / slices, z), lat1 = latOf(y + (row + 1) / slices, z)
          const y0 = ((n - lat0) / (n - s)) * H, y1 = ((n - lat1) / (n - s)) * H
          const sourceY = (row / slices) * img.naturalHeight
          ctx.drawImage(img, 0, sourceY, img.naturalWidth, img.naturalHeight / slices, x0, y0, x1 - x0 + 1, y1 - y0 + 1)
        }
      }
      img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
    }
  }, [level, url])
  if (level >= 2) return <canvas ref={cv} className="lab-ctx"/>
  const src = level === 0 ? url : url.replace(/size=\d+,\d+/, `size=800,${Math.round((800 * H) / W)}`)
  return <img className="lab-ctx" src={src} alt="" onError={() => setLevel(l => (l < 2 ? l + 1 : l))}/>
}

function GeeTileCanvas({
  tileUrl,
  bb,
  W,
  H,
  ring,
  opacity = 1
}: {
  tileUrl: string
  bb: number[]
  W: number
  H: number
  ring?: [number, number][]
  opacity?: number
}) {
  const cv = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = cv.current
    if (!c || !tileUrl) return
    const ctx = c.getContext('2d')!
    c.width = W
    c.height = H
    ctx.clearRect(0, 0, W, H)

    const [w, s, e, n] = bb
    let z = 16
    while (z > 8 && (tileX(e, z) - tileX(w, z) + 1) * (tileY(s, z) - tileY(n, z) + 1) > 25) z--

    const startX = tileX(w, z), endX = tileX(e, z)
    const startY = tileY(n, z), endY = tileY(s, z)

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const x0 = ((lonOf(x, z) - w) / (e - w)) * W
          const x1 = ((lonOf(x + 1, z) - w) / (e - w)) * W
          const slices = 32
          for (let row = 0; row < slices; row++) {
            const lat0 = latOf(y + row / slices, z)
            const lat1 = latOf(y + (row + 1) / slices, z)
            const y0 = ((n - lat0) / (n - s)) * H
            const y1 = ((n - lat1) / (n - s)) * H
            const sourceY = (row / slices) * img.naturalHeight
            ctx.drawImage(
              img,
              0,
              sourceY,
              img.naturalWidth,
              img.naturalHeight / slices,
              x0,
              y0,
              x1 - x0 + 1,
              y1 - y0 + 1
            )
          }

          // If farm polygon vector clipping is requested, clip to boundary
          if (ring && ring.length >= 3) {
            ctx.save()
            ctx.globalCompositeOperation = 'destination-in'
            ctx.beginPath()
            ring.forEach(([lon, lat], idx) => {
              const px = ((lon - w) / (e - w)) * W
              const py = ((n - lat) / (n - s)) * H
              if (idx === 0) ctx.moveTo(px, py)
              else ctx.lineTo(px, py)
            })
            ctx.closePath()
            ctx.fillStyle = '#ffffff'
            ctx.fill()
            ctx.restore()
          }
        }
        const resolved = tileUrl
          .replace('{z}', String(z))
          .replace('{x}', String(x))
          .replace('{y}', String(y))
        img.src = resolved
      }
    }
  }, [tileUrl, bb[0], bb[1], bb[2], bb[3], W, H, ring])

  return (
    <canvas
      ref={cv}
      className="lab-over"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 2,
        opacity
      }}
    />
  )
}

