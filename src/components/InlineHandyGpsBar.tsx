import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Compass, Crosshair, Download, Flag, Footprints, LocateFixed, MapPin, Navigation,
  Pause, Play, Plus, RotateCcw, Save, Target, Trash2, ChevronDown, ChevronUp, Copy, Check,
} from 'lucide-react'
import {
  CoordinateAverager,
  bearingDeg,
  compassCardinal16,
  computeOrthometricAltitudeM,
  computeTrackStats,
  estimateMagneticDeclinationDeg,
  exportWaypointsAndTrackGpx,
  exportWaypointsAndTrackKml,
  exportWaypointsCsv,
  geodesicDistanceM,
  projectWaypoint,
  toDdm,
  toMgrs,
  toUtm,
  type FieldWaypoint,
  type TrackPoint,
} from '../lib/geodesyField'
import { encodeDigipin, toDms } from '../lib/digipin'
import { areaHa } from '../lib/geo'
import { useI18n } from '../lib/i18n'

const PUSHPIN_GALLERY = [
  { file: 'castshadow-green.png', label: 'Green Flag' },
  { file: 'castshadow-orange.png', label: 'Orange Flag' },
  { file: 'castshadow-blue.png', label: 'Blue Water' },
  { file: 'castshadow-red.png', label: 'Red Alert' },
  { file: 'castshadow-purple.png', label: 'Soil Sample' },
  { file: 'castshadow-teal.png', label: 'Survey Benchmark' },
  { file: 'plain-yellow.png', label: 'Yellow Marker' },
  { file: 'plain-green.png', label: 'Plain Green' },
  { file: 'plain-blue.png', label: 'Plain Blue' },
  { file: 'plain-red.png', label: 'Plain Red' },
  { file: 'push-pin-red.png', label: 'Pushpin Red' },
  { file: 'push-pin-yellow.png', label: 'Pushpin Yellow' },
]

export interface InlineHandyGpsBarProps {
  farm: {
    id: string
    name: string
    lat: number
    lon: number
    crop?: string
    area?: number
    polygon?: [number, number][]
  }
  onSaveWalkedBoundary?: (ring: [number, number][], name: string, measuredHa: number) => void
  onWaypointsChange?: (waypoints: FieldWaypoint[]) => void
  defaultExpanded?: boolean
}

export function loadFarmWaypoints(farmId: string): FieldWaypoint[] {
  if (!farmId || typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`seva-gps-waypoints-${farmId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveFarmWaypoints(farmId: string, wps: FieldWaypoint[]) {
  if (!farmId || typeof window === 'undefined') return
  try {
    localStorage.setItem(`seva-gps-waypoints-${farmId}`, JSON.stringify(wps))
    window.dispatchEvent(new CustomEvent('seva-waypoints-updated', { detail: { farmId, waypoints: wps } }))
  } catch {}
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function InlineHandyGpsBar({
  farm,
  onSaveWalkedBoundary,
  onWaypointsChange,
  defaultExpanded = false,
}: InlineHandyGpsBarProps) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [watching, setWatching] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [liveFix, setLiveFix] = useState<{
    lat: number
    lon: number
    accuracyM: number
    altitudeM: number | null
    headingDeg: number | null
    speedMs: number | null
    timestamp: number
  } | null>(null)

  const [waypoints, setWaypoints] = useState<FieldWaypoint[]>(() => loadFarmWaypoints(farm.id))
  const [pinName, setPinName] = useState('')
  const [pinType, setPinType] = useState('corner')
  const [pinSprite, setPinSprite] = useState('castshadow-green.png')

  // Walking boundary track points
  const [walking, setWalking] = useState(false)
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([])

  // Averaging & Target Projection
  const averagerRef = useRef(new CoordinateAverager(60))
  const [averaging, setAveraging] = useState(false)
  const [avgInfo, setAvgInfo] = useState<{ count: number; lat: number; lon: number; cep95M: number } | null>(null)
  const [projDistM, setProjDistM] = useState('50')
  const [projBearingDeg, setProjBearingDeg] = useState('90')
  const [copiedFmt, setCopiedFmt] = useState<string | null>(null)

  const watchIdRef = useRef<number | null>(null)

  // Reload waypoints when selected farm changes
  useEffect(() => {
    const loaded = loadFarmWaypoints(farm.id)
    setWaypoints(loaded)
    onWaypointsChange?.(loaded)
  }, [farm.id])

  // Watch live GNSS when enabled or walking
  useEffect(() => {
    if (!watching && !walking && !averaging) {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      return
    }
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsError('Device GPS unavailable in this browser.')
      return
    }
    setGpsError('')
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lon: Number(pos.coords.longitude.toFixed(6)),
          accuracyM: Math.round((pos.coords.accuracy || 10) * 10) / 10,
          altitudeM: pos.coords.altitude != null ? Math.round(pos.coords.altitude * 10) / 10 : null,
          headingDeg: pos.coords.heading != null && Number.isFinite(pos.coords.heading) ? Math.round(pos.coords.heading) : null,
          speedMs: pos.coords.speed != null && Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
          timestamp: Date.now(),
        }
        setLiveFix(fix)
        if (averaging) {
          const res = averagerRef.current.addSample({
            lat: fix.lat,
            lon: fix.lon,
            accuracyM: fix.accuracyM,
            altitudeM: fix.altitudeM,
            timestamp: fix.timestamp,
          })
          if (res) {
            setAvgInfo({ count: averagerRef.current.getCount(), lat: res.lat, lon: res.lon, cep95M: res.estimatedCep95M })
          }
        }
        if (walking) {
          setTrackPoints((prev) => {
            const last = prev[prev.length - 1]
            if (last && geodesicDistanceM(last.lat, last.lon, fix.lat, fix.lon) < 2.5) {
              return prev
            }
            return [
              ...prev,
              {
                lat: fix.lat,
                lon: fix.lon,
                altM: fix.altitudeM,
                accuracyM: fix.accuracyM,
                timestamp: fix.timestamp,
              },
            ]
          })
        }
      },
      (err) => {
        setGpsError(err.message || 'Waiting for clear sky GPS signal.')
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 }
    )
    watchIdRef.current = id
    return () => {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(id)
      }
    }
  }, [watching, walking, averaging])

  const activeLat = liveFix?.lat ?? farm.lat
  const activeLon = liveFix?.lon ?? farm.lon
  const digipin = useMemo(() => {
    try { return encodeDigipin(activeLat, activeLon) } catch { return '—' }
  }, [activeLat, activeLon])
  const utm = useMemo(() => toUtm(activeLat, activeLon), [activeLat, activeLon])
  const mgrs = useMemo(() => toMgrs(activeLat, activeLon, 5), [activeLat, activeLon])
  const declination = useMemo(() => estimateMagneticDeclinationDeg(activeLat, activeLon), [activeLat, activeLon])
  const orthoAltM = useMemo(
    () => (liveFix?.altitudeM != null ? computeOrthometricAltitudeM(liveFix.lat, liveFix.lon, liveFix.altitudeM) : null),
    [liveFix]
  )

  const trackStats = useMemo(() => computeTrackStats(trackPoints), [trackPoints])
  const walkedAreaHa = useMemo(() => {
    if (trackPoints.length < 3) return 0
    return areaHa(trackPoints.map(p => [p.lon, p.lat] as [number, number]))
  }, [trackPoints])

  const handleCopy = (label: string, text: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedFmt(label)
    setTimeout(() => setCopiedFmt(null), 1800)
  }

  const addWaypointAt = (lat: number, lon: number, customLabel?: string) => {
    const nextNum = waypoints.length + 1
    const wp: FieldWaypoint = {
      id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: (customLabel || pinName).trim() || `Point ${nextNum}`,
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      altM: orthoAltM?.mslM ?? liveFix?.altitudeM ?? null,
      type: pinType,
      symbol: pinSprite,
      farmId: farm.id,
      crop: farm.crop,
      createdAt: new Date().toISOString(),
    }
    const updated = [...waypoints, wp]
    setWaypoints(updated)
    saveFarmWaypoints(farm.id, updated)
    onWaypointsChange?.(updated)
    setPinName('')
  }

  const removeWaypoint = (id: string) => {
    const updated = waypoints.filter(w => w.id !== id)
    setWaypoints(updated)
    saveFarmWaypoints(farm.id, updated)
    onWaypointsChange?.(updated)
  }

  const handleProjectPoint = () => {
    const dist = Math.max(1, Number(projDistM) || 0)
    const brg = Number(projBearingDeg) || 0
    const projected = projectWaypoint(activeLat, activeLon, dist, brg)
    addWaypointAt(projected.lat, projected.lon, pinName.trim() || `Proj ${dist}m @ ${brg}°`)
  }

  const handleAddManualWalkPoint = () => {
    setTrackPoints(prev => [
      ...prev,
      {
        lat: activeLat,
        lon: activeLon,
        altM: orthoAltM?.mslM ?? liveFix?.altitudeM ?? null,
        accuracyM: liveFix?.accuracyM ?? 5,
        timestamp: Date.now(),
      },
    ])
  }

  const handleSaveWalkBoundary = () => {
    if (trackPoints.length < 3 || !onSaveWalkedBoundary) return
    const ring: [number, number][] = trackPoints.map(p => [p.lon, p.lat])
    const ha = areaHa(ring)
    onSaveWalkedBoundary(ring, `${farm.name || 'GPS'} Walk Boundary`, ha)
    setWalking(false)
  }

  return (
    <section
      className="inline-handy-gps"
      aria-label="Field Handy GPS & Pushpins Console"
      style={{
        margin: '10px 0 14px',
        borderRadius: 14,
        background: '#ffffff',
        border: '1.5px solid #cbd5e1',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
        color: '#0f172a',
        overflow: 'hidden',
      }}
    >
      {/* Compact Always-Visible Inline Ribbon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          padding: '10px 14px',
          background: 'linear-gradient(90deg, #f8fafc 0%, #f0fdf4 100%)',
          borderBottom: expanded ? '1px solid #e2e8f0' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 800,
              background: liveFix ? '#dcfce7' : '#e0f2fe',
              color: liveFix ? '#166534' : '#0369a1',
              border: `1px solid ${liveFix ? '#86efac' : '#7dd3fc'}`,
            }}
          >
            <LocateFixed size={13} />
            {liveFix ? `Live GPS ±${liveFix.accuracyM}m` : 'Field GPS Ready'}
          </span>

          <code style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
            {activeLat.toFixed(5)}°, {activeLon.toFixed(5)}°
          </code>

          <span style={{ fontSize: 11.5, color: '#475569', fontWeight: 600 }}>
            DIGIPIN: <strong style={{ color: '#0284c7' }}>{digipin}</strong> · UTM {utm.zoneNumber}{utm.hemisphere}
          </span>

          <span style={{ fontSize: 11.5, color: '#059669', fontWeight: 700 }}>
            📌 {waypoints.length} pins
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setWatching(w => !w)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: watching ? '#dc2626' : '#059669', color: '#fff', border: 'none',
            }}
          >
            <Crosshair size={13} />
            <span>{watching ? 'Stop GPS' : 'Track Standing GPS'}</span>
          </button>

          <button
            type="button"
            onClick={() => addWaypointAt(activeLat, activeLon)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: '#fff', color: '#0f172a', border: '1.5px solid #059669',
            }}
          >
            <img src={`/images/field-kit/pushpins/${pinSprite}`} alt="" width={14} height={14} />
            <span>Drop Pin Here</span>
          </button>

          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1',
            }}
          >
            <span>{expanded ? 'Hide Handy GPS' : 'All Handy GPS Tools'}</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded Inline Handy GPS Workbench */}
      {expanded && (
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14, background: '#fff' }}>
          {gpsError && (
            <div style={{ gridColumn: '1 / -1', padding: '8px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12, fontWeight: 600 }}>
              {gpsError}
            </div>
          )}

          {/* Panel 1: Precision Coordinates & Geodesy */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Compass size={15} color="#0284c7" />
              <strong style={{ fontSize: 13 }}>{t('field.tools.title')}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, fontFamily: 'monospace' }}>
              {[
                ['DD', `${activeLat.toFixed(6)}, ${activeLon.toFixed(6)}`],
                ['DMS', `${toDms(activeLat, true)} ${toDms(activeLon, false)}`],
                ['DDM', `${toDdm(activeLat, true)} ${toDdm(activeLon, false)}`],
                ['UTM', `${utm.zoneNumber}${utm.hemisphere} E:${Math.round(utm.easting)} N:${Math.round(utm.northing)}`],
                ['MGRS', mgrs],
                ['DIGIPIN', digipin],
              ].map(([k, val]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <span><b style={{ color: '#0369a1' }}>{k}:</b> {val}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(k, val)}
                    aria-label={`Copy ${k}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}
                  >
                    {copiedFmt === k ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#475569', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <span>MSL (EGM2008): <b>{orthoAltM != null ? `${orthoAltM.mslM.toFixed(1)} m` : 'Waiting GPS'}</b></span>
              <span>Declination: <b>{declination.toFixed(2)}°</b></span>
            </div>

            {/* Averaging + Projection */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (!averaging) averagerRef.current.reset()
                    setAveraging(a => !a)
                  }}
                  style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: averaging ? '#f59e0b' : '#0f172a', color: '#fff', border: 'none' }}
                >
                  {averaging ? `Stop Averaging (${avgInfo?.count ?? 0})` : 'GPS Averaging (CEP95)'}
                </button>
                {avgInfo && (
                  <button
                    type="button"
                    onClick={() => addWaypointAt(avgInfo.lat, avgInfo.lon, `Avg-${avgInfo.count}pts`)}
                    style={{ padding: '5px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}
                  >
                    Save ±{avgInfo.cep95M.toFixed(1)}m
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Target size={13} color="#0284c7" />
                <input type="number" min="1" value={projDistM} onChange={e => setProjDistM(e.target.value)} style={{ width: 58, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11.5 }} aria-label="Distance in meters" />
                <span style={{ fontSize: 11 }}>m @</span>
                <input type="number" min="0" max="360" value={projBearingDeg} onChange={e => setProjBearingDeg(e.target.value)} style={{ width: 52, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11.5 }} aria-label="Bearing degrees" />
                <span style={{ fontSize: 11 }}>° ({compassCardinal16(Number(projBearingDeg) || 0)})</span>
                <button type="button" onClick={handleProjectPoint} style={{ padding: '4px 9px', borderRadius: 6, background: '#0284c7', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  Project Pin
                </button>
              </div>
            </div>
          </div>

          {/* Panel 2: NASA WorldWind Flag & Pushpin Marker Dropper */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <MapPin size={15} color="#059669" />
              <strong style={{ fontSize: 13 }}>Mark Field Pins &amp; Flags ({waypoints.length})</strong>
            </div>

            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
              {PUSHPIN_GALLERY.map(p => (
                <button
                  key={p.file}
                  type="button"
                  onClick={() => setPinSprite(p.file)}
                  title={p.label}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    background: pinSprite === p.file ? '#dcfce7' : '#fff',
                    border: pinSprite === p.file ? '2px solid #059669' : '1px solid #cbd5e1',
                  }}
                >
                  <img src={`/images/field-kit/pushpins/${p.file}`} alt={p.label} width={18} height={18} />
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <input
                type="text"
                value={pinName}
                onChange={e => setPinName(e.target.value)}
                placeholder="Pin name (e.g. Borewell 1)"
                style={{ flex: 1, minWidth: 130, padding: '6px 9px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 12, background: '#fff' }}
              />
              <select
                value={pinType}
                onChange={e => setPinType(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 11.5, background: '#fff' }}
              >
                <option value="corner">Boundary Corner</option>
                <option value="water">Water / Borewell</option>
                <option value="soil">Soil Spot</option>
                <option value="hazard">Pest / Damage</option>
              </select>
              <button
                type="button"
                onClick={() => addWaypointAt(activeLat, activeLon)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 11px', borderRadius: 7, background: '#059669', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={13} /> Mark
              </button>
            </div>

            <div style={{ maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {waypoints.length === 0 ? (
                <div style={{ fontSize: 11.5, color: '#64748b', padding: '8px 0' }}>
                  No pins dropped for {farm.name} yet. Tap Mark above while standing at your field spot.
                </div>
              ) : (
                waypoints.map(wp => {
                  const dist = geodesicDistanceM(activeLat, activeLon, wp.lat, wp.lon)
                  const brg = bearingDeg(activeLat, activeLon, wp.lat, wp.lon)
                  return (
                    <div key={wp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 8px', borderRadius: 7, background: '#fff', border: '1px solid #e2e8f0', fontSize: 11.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <img src={`/images/field-kit/pushpins/${wp.symbol || 'castshadow-green.png'}`} alt="" width={16} height={16} />
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ display: 'block', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wp.label}</strong>
                          <small style={{ color: '#64748b', fontFamily: 'monospace' }}>
                            {wp.lat.toFixed(5)}°, {wp.lon.toFixed(5)}° · {Math.round(dist)}m {compassCardinal16(brg)}
                          </small>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeWaypoint(wp.id)} aria-label={`Remove ${wp.label}`} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 3 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Panel 3: Walk Boundary & GPX / KML / CSV Export */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Footprints size={15} color="#f59e0b" />
                <strong style={{ fontSize: 13 }}>Walk Field Boundary &amp; Export Track</strong>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => { setWalking(w => !w); setWatching(true) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: walking ? '#f59e0b' : '#0f172a', color: '#fff', border: 'none' }}
                >
                  {walking ? <Pause size={13} /> : <Play size={13} />}
                  <span>{walking ? 'Pause Walk' : 'Walk Boundary'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddManualWalkPoint}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1' }}
                >
                  <Flag size={13} color="#059669" /> Add Corner ({trackPoints.length})
                </button>
                {trackPoints.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTrackPoints([])}
                    aria-label="Reset walked points"
                    style={{ padding: '6px 9px', borderRadius: 7, fontSize: 12, background: '#fff', color: '#64748b', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>

              <div style={{ padding: 9, borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0', fontSize: 11.5, marginBottom: 10 }}>
                <div>Corners recorded: <b>{trackPoints.length}</b> · Path length: <b>{trackStats.distanceM.toFixed(0)} m</b></div>
                <div>Enclosed polygon area: <b>{walkedAreaHa.toFixed(2)} ha ({(walkedAreaHa * 2.471).toFixed(2)} ac)</b></div>
              </div>

              {onSaveWalkedBoundary && trackPoints.length >= 3 && (
                <button
                  type="button"
                  onClick={handleSaveWalkBoundary}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: '#059669', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}
                >
                  <Save size={14} /> Save Walked Boundary ({walkedAreaHa.toFixed(2)} ha)
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => downloadBlob(`${farm.name.replace(/\W+/g, '_')}.gpx`, exportWaypointsAndTrackGpx(farm.name, waypoints, trackPoints), 'application/gpx+xml')}
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 8px', borderRadius: 7, background: '#fff', border: '1px solid #cbd5e1', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}
              >
                <Download size={12} /> GPX
              </button>
              <button
                type="button"
                onClick={() => downloadBlob(`${farm.name.replace(/\W+/g, '_')}.kml`, exportWaypointsAndTrackKml(farm.name, waypoints, trackPoints), 'application/vnd.google-earth.kml+xml')}
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 8px', borderRadius: 7, background: '#fff', border: '1px solid #cbd5e1', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}
              >
                <Navigation size={12} /> KML
              </button>
              <button
                type="button"
                onClick={() => downloadBlob(`${farm.name.replace(/\W+/g, '_')}_pins.csv`, exportWaypointsCsv(waypoints), 'text/csv')}
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 8px', borderRadius: 7, background: '#fff', border: '1px solid #cbd5e1', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}
              >
                <Download size={12} /> CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
