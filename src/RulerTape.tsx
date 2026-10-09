import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import {
  Compass,
  Copy,
  Check,
  Crosshair,
  Maximize2,
  RefreshCw,
  RotateCcw,
  Ruler,
  X,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react'
import {
  getDistance,
  getGreatCircleBearing,
  getRhumbLineBearing,
  convertDistance,
} from 'geolib'
import { farmBBox, farmRing, type FarmData } from './lib/seva'
import { lengthM } from './lib/assets'

export type RulerMode = 'none' | 'line' | 'path' | 'east-height' | 'width' | 'height'

type Unit = 'm' | 'km' | 'ft' | 'yd' | 'in' | 'cm' | 'mi'

const UNITS: { id: Unit; label: string; abbr: string }[] = [
  { id: 'm', label: 'Metres', abbr: 'm' },
  { id: 'ft', label: 'Feet', abbr: 'ft' },
  { id: 'km', label: 'Kilometres', abbr: 'km' },
  { id: 'yd', label: 'Yards', abbr: 'yd' },
  { id: 'in', label: 'Inches', abbr: 'in' },
  { id: 'cm', label: 'Centimetres', abbr: 'cm' },
  { id: 'mi', label: 'Miles', abbr: 'mi' },
]

function formatDist(m: number, u: Unit): string {
  if (!Number.isFinite(m)) return '—'
  if (u === 'm') return `${m.toFixed(2)} m`
  if (u === 'km') return `${(m / 1000).toFixed(3)} km`
  if (u === 'ft') return `${(m * 3.28084).toFixed(2)} ft`
  if (u === 'yd') return `${(m * 1.09361).toFixed(2)} yd`
  if (u === 'in') return `${(m * 39.3701).toFixed(1)} in`
  if (u === 'cm') return `${(m * 100).toFixed(1)} cm`
  if (u === 'mi') return `${(m * 0.000621371).toFixed(3)} mi`
  return `${m.toFixed(2)} m`
}

function bearingToCardinal(deg: number): string {
  const d = ((deg % 360) + 360) % 360
  const dirs = ['North (N)', 'NNE', 'Northeast (NE)', 'ENE', 'East (E)', 'ESE', 'Southeast (SE)', 'SSE', 'South (S)', 'SSW', 'Southwest (SW)', 'WSW', 'West (W)', 'WNW', 'Northwest (NW)', 'NNW']
  const idx = Math.round(d / 22.5) % 16
  return `${d.toFixed(1)}° ${dirs[idx]}`
}

type Props = {
  map: L.Map | null
  farm: FarmData & { id: string; name?: string }
  open: boolean
  onClose: () => void
  onActiveChange?: (active: boolean) => void
}

export default function RulerTape({ map, farm, open, onClose, onActiveChange }: Props) {
  const [tab, setTab] = useState<'line' | 'path' | 'extents'>('line')
  const [unit, setUnit] = useState<Unit>('m')
  const [points, setPoints] = useState<[number, number][]>([]) // [lon, lat][]
  const [tempPoint, setTempPoint] = useState<[number, number] | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [measureTitle, setMeasureTitle] = useState('Free Metered Tape')

  const layersRef = useRef<L.LayerGroup | null>(null)
  const markersRef = useRef<L.Marker[]>([])

  // Notify parent of active measuring state
  useEffect(() => {
    onActiveChange?.(open && (drawing || points.length > 0))
  }, [open, drawing, points.length, onActiveChange])

  // Farm geometry analysis
  const ring = useMemo(() => farmRing(farm), [farm])
  const bbox = useMemo(() => farmBBox(farm), [farm]) // [minLon, minLat, maxLon, maxLat]

  const extents = useMemo(() => {
    const [w, s, e, n] = bbox
    const midLat = (s + n) / 2
    const midLon = (w + e) / 2

    // East side height (North-South span along Eastern edge)
    const eastBoundingHeightM = getDistance({ latitude: s, longitude: e }, { latitude: n, longitude: e })
    // Overall width (East-West span)
    const widthM = getDistance({ latitude: midLat, longitude: w }, { latitude: midLat, longitude: e })
    // Overall height (North-South span)
    const heightM = getDistance({ latitude: s, longitude: midLon }, { latitude: n, longitude: midLon })
    // West side height
    const westBoundingHeightM = getDistance({ latitude: s, longitude: w }, { latitude: n, longitude: w })
    // North side width
    const northWidthM = getDistance({ latitude: n, longitude: w }, { latitude: n, longitude: e })
    // South side width
    const southWidthM = getDistance({ latitude: s, longitude: w }, { latitude: s, longitude: e })

    // Find actual eastern boundary edge of polygon if available
    let eastEdge: { p1: [number, number]; p2: [number, number]; lenM: number; bearing: number } | null = null
    let maxAvgLon = -Infinity
    for (let i = 0; i < ring.length; i++) {
      const p1 = ring[i]
      const p2 = ring[(i + 1) % ring.length]
      const avgLon = (p1[0] + p2[0]) / 2
      if (avgLon > maxAvgLon) {
        maxAvgLon = avgLon
        const lenM = lengthM([p1, p2])
        const bearing = getGreatCircleBearing({ latitude: p1[1], longitude: p1[0] }, { latitude: p2[1], longitude: p2[0] })
        eastEdge = { p1, p2, lenM, bearing }
      }
    }

    return {
      eastBoundingHeightM,
      westBoundingHeightM,
      northWidthM,
      southWidthM,
      widthM,
      heightM,
      eastEdge,
      eastCoords: [[e, s], [e, n]] as [number, number][],
      westCoords: [[w, s], [w, n]] as [number, number][],
      northCoords: [[w, n], [e, n]] as [number, number][],
      southCoords: [[w, s], [e, s]] as [number, number][],
      widthCoords: [[w, midLat], [e, midLat]] as [number, number][],
      heightCoords: [[midLon, s], [midLon, n]] as [number, number][],
    }
  }, [bbox, ring])

  // Current line calculations
  const allPts = useMemo(() => {
    if (tempPoint && drawing && points.length > 0) {
      return [...points, tempPoint]
    }
    return points
  }, [points, tempPoint, drawing])

  const totalLengthM = useMemo(() => {
    if (allPts.length < 2) return 0
    return lengthM(allPts)
  }, [allPts])

  const segmentStats = useMemo(() => {
    if (allPts.length < 2) return null
    const p1 = allPts[0]
    const p2 = allPts[allPts.length - 1]

    const bearing = getGreatCircleBearing(
      { latitude: p1[1], longitude: p1[0] },
      { latitude: p2[1], longitude: p2[0] }
    )

    // Delta X (East-West width span in meters)
    const dxM = getDistance(
      { latitude: p1[1], longitude: p1[0] },
      { latitude: p1[1], longitude: p2[0] }
    )

    // Delta Y (North-South height span in meters)
    const dyM = getDistance(
      { latitude: p1[1], longitude: p1[0] },
      { latitude: p2[1], longitude: p1[0] }
    )

    return {
      bearing,
      dxM,
      dyM,
      startLat: p1[1],
      startLon: p1[0],
      endLat: p2[1],
      endLon: p2[0],
    }
  }, [allPts])

  // 1-Click quick actions
  function snapToEastHeight() {
    setPoints(extents.eastCoords)
    setTempPoint(null)
    setDrawing(false)
    setMeasureTitle('East Side Height (North–South)')
    if (map) {
      const [[e1, s1], [e2, n2]] = extents.eastCoords
      map.fitBounds(L.latLngBounds([s1, e1], [n2, e2]), { padding: [60, 60], maxZoom: 18 })
    }
  }

  function snapToEastBoundaryEdge() {
    if (extents.eastEdge) {
      setPoints([extents.eastEdge.p1, extents.eastEdge.p2])
      setTempPoint(null)
      setDrawing(false)
      setMeasureTitle('East Boundary Fence Line')
      if (map) {
        const [p1, p2] = [extents.eastEdge.p1, extents.eastEdge.p2]
        map.fitBounds(L.latLngBounds([p1[1], p1[0]], [p2[1], p2[0]]), { padding: [60, 60], maxZoom: 18 })
      }
    }
  }

  function snapToWidth() {
    setPoints(extents.widthCoords)
    setTempPoint(null)
    setDrawing(false)
    setMeasureTitle('Farm Width (East–West Span)')
    if (map) {
      const [[w1, lat1], [e1, lat2]] = extents.widthCoords
      map.fitBounds(L.latLngBounds([lat1, w1], [lat2, e1]), { padding: [60, 60], maxZoom: 18 })
    }
  }

  function snapToHeight() {
    setPoints(extents.heightCoords)
    setTempPoint(null)
    setDrawing(false)
    setMeasureTitle('Farm Height (North–South Span)')
    if (map) {
      const [[lon1, s1], [lon2, n1]] = extents.heightCoords
      map.fitBounds(L.latLngBounds([s1, lon1], [n1, lon2]), { padding: [60, 60], maxZoom: 18 })
    }
  }

  function snapToNorthWidth() {
    setPoints(extents.northCoords)
    setTempPoint(null)
    setDrawing(false)
    setMeasureTitle('North Boundary Width')
  }

  function snapToSouthWidth() {
    setPoints(extents.southCoords)
    setTempPoint(null)
    setDrawing(false)
    setMeasureTitle('South Boundary Width')
  }

  function clearMeasurement() {
    setPoints([])
    setTempPoint(null)
    setDrawing(false)
    setMeasureTitle('Free Metered Tape')
  }

  // Interactive Map Click & Cursor handlers
  useEffect(() => {
    if (!map || !open) return

    const container = map.getContainer()
    if (drawing) {
      container.style.cursor = 'crosshair'
    } else {
      container.style.cursor = ''
    }

    function handleClick(e: L.LeafletMouseEvent) {
      if (!open) return
      const { lat, lng } = e.latlng

      if (!drawing && points.length === 0) {
        // First click
        setPoints([[lng, lat]])
        setDrawing(true)
        setMeasureTitle('Free Metered Tape')
      } else if (drawing) {
        if (tab === 'line') {
          // Second click completes the line
          setPoints(pts => [...pts, [lng, lat]])
          setTempPoint(null)
          setDrawing(false)
        } else {
          // Path mode appends points
          setPoints(pts => [...pts, [lng, lat]])
        }
      }
    }

    function handleMouseMove(e: L.LeafletMouseEvent) {
      if (!open || !drawing || points.length === 0) return
      setTempPoint([e.latlng.lng, e.latlng.lat])
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDrawing(false)
        setTempPoint(null)
      }
    }

    map.on('click', handleClick)
    map.on('mousemove', handleMouseMove)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      map.off('click', handleClick)
      map.off('mousemove', handleMouseMove)
      window.removeEventListener('keydown', handleKeyDown)
      container.style.cursor = ''
    }
  }, [map, open, drawing, points.length, tab])

  // Render Metered Tape Layers on Leaflet Map
  useEffect(() => {
    if (!map) return

    if (!layersRef.current) {
      layersRef.current = L.layerGroup().addTo(map)
    }
    const layerGroup = layersRef.current
    layerGroup.clearLayers()
    markersRef.current = []

    if (!open || allPts.length < 1) return

    const latLngs = allPts.map(([lon, lat]) => [lat, lon] as L.LatLngTuple)

    if (latLngs.length >= 2) {
      // 1. Metered Tape Base Yellow Ribbon (8px with dark border)
      L.polyline(latLngs, {
        color: '#78350f',
        weight: 9,
        lineCap: 'square',
        lineJoin: 'miter',
        opacity: 0.95,
      }).addTo(layerGroup)

      L.polyline(latLngs, {
        color: '#facc15',
        weight: 7,
        lineCap: 'square',
        lineJoin: 'miter',
        opacity: 1,
      }).addTo(layerGroup)

      // 2. High-contrast Black Tick Marks along the tape (Simulating real surveyor metered tape ticks)
      L.polyline(latLngs, {
        color: '#0f172a',
        weight: 5,
        dashArray: '2 8',
        lineCap: 'butt',
        opacity: 0.9,
      }).addTo(layerGroup)

      // 3. Middle Callout Badge (Tape Measure Readout)
      const midIdx = Math.floor((allPts.length - 1) / 2)
      const pA = allPts[midIdx]
      const pB = allPts[midIdx + 1] || pA
      const midLat = (pA[1] + pB[1]) / 2
      const midLon = (pA[0] + pB[0]) / 2

      const distLabel = formatDist(totalLengthM, unit)
      const heading = segmentStats ? Math.round(segmentStats.bearing) : 0

      const tapeLabelIcon = L.divIcon({
        className: 'ge-tape-label-wrap',
        html: `
          <div class="ge-tape-pill">
            <span class="ge-tape-icon">📏</span>
            <strong>${distLabel}</strong>
            <span class="ge-tape-deg">${heading}°</span>
          </div>
        `,
        iconSize: [140, 28],
        iconAnchor: [70, 14],
      })

      L.marker([midLat, midLon], { icon: tapeLabelIcon, interactive: false }).addTo(layerGroup)
    }

    // 4. Start Point: Surveyor Tape Hook / Brass Ring
    const startPt = allPts[0]
    const hookIcon = L.divIcon({
      className: 'ge-tape-hook-wrap',
      html: `
        <div class="ge-tape-hook" title="Start Point (Hook)">
          <div class="hook-ring"></div>
          <span class="hook-tag">0.0 m</span>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
    const startMarker = L.marker([startPt[1], startPt[0]], {
      icon: hookIcon,
      draggable: !drawing && points.length > 1,
    }).addTo(layerGroup)

    startMarker.on('drag', (e: any) => {
      const { lat, lng } = e.target.getLatLng()
      setPoints(pts => {
        const next = [...pts]
        next[0] = [lng, lat]
        return next
      })
    })

    // 5. End Point: Surveyor Tape Reel Casing
    if (allPts.length >= 2) {
      const endPt = allPts[allPts.length - 1]
      const reelIcon = L.divIcon({
        className: 'ge-tape-reel-wrap',
        html: `
          <div class="ge-tape-reel" title="End Point (Tape Casing)">
            <span class="reel-badge">${formatDist(totalLengthM, unit)}</span>
            <div class="reel-body"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      const endMarker = L.marker([endPt[1], endPt[0]], {
        icon: reelIcon,
        draggable: !drawing && points.length > 1,
      }).addTo(layerGroup)

      endMarker.on('drag', (e: any) => {
        const { lat, lng } = e.target.getLatLng()
        setPoints(pts => {
          const next = [...pts]
          next[next.length - 1] = [lng, lat]
          return next
        })
      })
    }

    return () => {
      layerGroup.clearLayers()
    }
  }, [map, open, allPts, totalLengthM, unit, segmentStats, drawing, points.length])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      layersRef.current?.remove()
      layersRef.current = null
    }
  }, [])

  function copyResults() {
    if (!segmentStats) return
    const text = [
      `--- SEVA.GIS / Google Earth Ruler Measurement ---`,
      `Measurement: ${measureTitle}`,
      `Total Ground Length: ${formatDist(totalLengthM, unit)} (${formatDist(totalLengthM, 'ft')})`,
      `Heading / Direction: ${bearingToCardinal(segmentStats.bearing)}`,
      `East-West Width (ΔX): ${formatDist(segmentStats.dxM, unit)}`,
      `North-South Height (ΔY): ${formatDist(segmentStats.dyM, unit)}`,
      `Start Point: ${segmentStats.startLat.toFixed(5)}° N, ${segmentStats.startLon.toFixed(5)}° E`,
      `End Point: ${segmentStats.endLat.toFixed(5)}° N, ${segmentStats.endLon.toFixed(5)}° E`,
      `Points Count: ${allPts.length}`,
    ].join('\n')

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!open) return null

  return (
    <div className="ge-ruler-panel" role="dialog" aria-label="Google Earth Pro Metered Tape Ruler">
      {/* Google Earth Pro Classic Header */}
      <div className="ge-ruler-header">
        <div className="ge-ruler-title">
          <div className="ge-ruler-logo">
            <Ruler size={16} />
          </div>
          <div>
            <strong>Ruler · Metered Tape</strong>
            <small>Google Earth Pro Precision Cadastral Tool</small>
          </div>
        </div>
        <button className="ge-ruler-close" aria-label="Close Ruler" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Tabs: Line, Path, Farm Dimensions */}
      <div className="ge-ruler-tabs" role="tablist">
        <button
          className={tab === 'line' ? 'on' : ''}
          onClick={() => {
            setTab('line')
            if (points.length > 2) setPoints(points.slice(0, 2))
          }}
        >
          Line (2-Point)
        </button>
        <button
          className={tab === 'path' ? 'on' : ''}
          onClick={() => setTab('path')}
        >
          Path (Multi)
        </button>
        <button
          className={tab === 'extents' ? 'on' : ''}
          onClick={() => setTab('extents')}
        >
          Farm Dimensions ⚡
        </button>
      </div>

      {/* Quick Cadastral Extents / East Side Height Presets */}
      <div className="ge-ruler-presets">
        <span className="preset-label">1-CLICK TAPE MEASURE:</span>
        <div className="preset-btns">
          <button
            className={`preset-chip ${measureTitle.includes('East Side Height') ? 'active' : ''}`}
            onClick={snapToEastHeight}
            title="Snap tape to measure East Side Height (North–South span)"
          >
            📏 East Side Height: {formatDist(extents.eastBoundingHeightM, unit)}
          </button>
          <button
            className={`preset-chip ${measureTitle.includes('Farm Width') ? 'active' : ''}`}
            onClick={snapToWidth}
            title="Snap tape to measure overall East–West Width"
          >
            ↔ Width (E–W): {formatDist(extents.widthM, unit)}
          </button>
          <button
            className={`preset-chip ${measureTitle.includes('Farm Height') ? 'active' : ''}`}
            onClick={snapToHeight}
            title="Snap tape to measure overall North–South Height"
          >
            ↕ Height (N–S): {formatDist(extents.heightM, unit)}
          </button>
          {extents.eastEdge && (
            <button
              className={`preset-chip ${measureTitle.includes('East Boundary') ? 'active' : ''}`}
              onClick={snapToEastBoundaryEdge}
              title="Snap tape to the exact eastern fence line / boundary segment"
            >
              📐 East Fence Line: {formatDist(extents.eastEdge.lenM, unit)}
            </button>
          )}
          <button className="preset-chip" onClick={snapToNorthWidth}>
            North Width: {formatDist(extents.northWidthM, unit)}
          </button>
          <button className="preset-chip" onClick={snapToSouthWidth}>
            South Width: {formatDist(extents.southWidthM, unit)}
          </button>
        </div>
      </div>

      {/* Measurement Metrics Display */}
      <div className="ge-ruler-body">
        <div className="ge-ruler-unit-row">
          <span className="unit-label">Length Units:</span>
          <select
            className="ge-ruler-select"
            value={unit}
            onChange={e => setUnit(e.target.value as Unit)}
          >
            {UNITS.map(u => (
              <option key={u.id} value={u.id}>
                {u.label} ({u.abbr})
              </option>
            ))}
          </select>
        </div>

        {/* Primary Hero Readout */}
        <div className="ge-ruler-hero">
          <div className="hero-head">
            <span>{measureTitle.toUpperCase()}</span>
            {points.length > 0 && <span className="pts-count">{points.length} tape points</span>}
          </div>
          <div className="hero-val">
            <strong>{formatDist(totalLengthM, unit)}</strong>
            <small>~ {formatDist(totalLengthM, unit === 'ft' ? 'm' : 'ft')}</small>
          </div>
        </div>

        {/* Cadastral Details Grid */}
        <div className="ge-ruler-grid">
          <div className="ge-ruler-item">
            <span>Map Length</span>
            <b>{formatDist(totalLengthM, unit)}</b>
          </div>
          <div className="ge-ruler-item">
            <span>Ground Length</span>
            <b>{formatDist(totalLengthM, unit)}</b>
          </div>
          <div className="ge-ruler-item">
            <span>Heading</span>
            <b>{segmentStats ? bearingToCardinal(segmentStats.bearing) : '—'}</b>
          </div>
          <div className="ge-ruler-item highlight-e">
            <span>East–West Width (ΔX)</span>
            <b>{segmentStats ? formatDist(segmentStats.dxM, unit) : '—'}</b>
          </div>
          <div className="ge-ruler-item highlight-n">
            <span>North–South Height (ΔY)</span>
            <b>{segmentStats ? formatDist(segmentStats.dyM, unit) : '—'}</b>
          </div>
          <div className="ge-ruler-item">
            <span>Tape State</span>
            <b style={{ color: drawing ? '#d97706' : '#15803d' }}>
              {drawing ? 'Click on map to finish' : points.length > 0 ? 'Tape Locked · Draggable' : 'Click map to measure'}
            </b>
          </div>
        </div>

        {/* Instruction Note */}
        <div className="ge-ruler-hint">
          {drawing ? (
            <span className="drawing-hint">
              ⚡ <b>Tape active:</b> Click map to set end point, or drag yellow hook/reel pins. Press <b>Esc</b> to cancel.
            </span>
          ) : points.length > 0 ? (
            <span>
              💡 <b>Tip:</b> Drag either yellow end pin to adjust. Use buttons above to quickly snap to East side height or Width.
            </span>
          ) : (
            <span>
              👉 <b>Click anywhere on the map</b> to drop the tape hook and measure.
            </span>
          )}
        </div>

        {/* Action Buttons: Clear, Start Custom Tape, Copy */}
        <div className="ge-ruler-actions">
          <button
            className={`ge-action-btn ${drawing ? 'active' : ''}`}
            onClick={() => {
              if (drawing) {
                setDrawing(false)
                setTempPoint(null)
              } else {
                setPoints([])
                setDrawing(true)
                setMeasureTitle('Free Metered Tape')
              }
            }}
          >
            <Crosshair size={14} />
            {drawing ? 'Stop Drawing' : 'Draw Custom Tape'}
          </button>

          <button
            className="ge-action-btn outline"
            onClick={clearMeasurement}
            disabled={points.length === 0}
            title="Reset tape"
          >
            <RotateCcw size={14} />
            Clear
          </button>

          <button
            className="ge-action-btn outline"
            onClick={copyResults}
            disabled={points.length < 2}
            title="Copy survey measurements to clipboard"
          >
            {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
