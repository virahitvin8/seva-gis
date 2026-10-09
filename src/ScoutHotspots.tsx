import { useMemo } from 'react'
import { MapPin, Navigation, Compass, Download, Check } from 'lucide-react'
import type { FarmData } from './lib/seva'
import { generateScoutHotspots, useScoutState, toggleHotspotsOnMap, focusHotspotOnMap } from './lib/scoutStore'

type Props = {
  farm: FarmData & { id: string; name: string }
}

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—')

export default function ScoutHotspots({ farm }: Props) {
  const scoutState = useScoutState()
  const spots = useMemo(() => generateScoutHotspots(farm), [farm.lat, farm.lon])

  function exportScoutCsv() {
    const header = 'Spot_Number,Latitude,Longitude,Distance_m,Bearing,Signature,Inspection_Action,Priority\n'
    const rows = spots.map(s => `${s.id},${s.lat},${s.lon},${s.distM},"${s.bearing}","${s.signature}","${s.inspection}",${s.priority}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scout-targets-${farm.name.toLowerCase().replace(/\W+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportScoutGeoJson() {
    const fc = {
      type: 'FeatureCollection',
      features: spots.map(s => ({
        type: 'Feature',
        properties: {
          pin: s.id,
          priority: s.priority,
          signature: s.signature,
          action: s.inspection,
          distance_m: s.distM,
          bearing: s.bearing
        },
        geometry: {
          type: 'Point',
          coordinates: [s.lon, s.lat]
        }
      }))
    }
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scout-pins-${farm.name.toLowerCase().replace(/\W+/g, '-')}.geojson`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="ag-card" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg, #fff)', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: 6, borderRadius: 8, background: '#fee2e2', color: '#b91c1c' }}>
            <MapPin size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              &ldquo;Scout Here&rdquo; Hotspot Zones
            </h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Clusters translated into numbered walking waypoints with physical inspection actions
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={toggleHotspotsOnMap}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 12px',
              fontSize: 12,
              borderRadius: 6,
              border: scoutState.showOnMap ? '1px solid #dc2626' : '1px solid var(--border)',
              background: scoutState.showOnMap ? '#fef2f2' : '#fff',
              color: scoutState.showOnMap ? '#b91c1c' : '#334155',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: scoutState.showOnMap ? '0 1px 3px rgba(220,38,38,0.15)' : 'none',
            }}
            title="Toggle numbered hotspot waypoints on the main SEVA.GIS field map"
          >
            <MapPin size={13} /> {scoutState.showOnMap ? 'Marked on Map ✓' : 'Mark on Map'}
          </button>
          <button
            onClick={exportScoutCsv}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}
          >
            <Download size={13} /> CSV
          </button>
          <button
            onClick={exportScoutGeoJson}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}
          >
            <Download size={13} /> GeoJSON
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {spots.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderRadius: 8, border: scoutState.focusedSpotId === s.id ? '1px solid #dc2626' : '1px solid #f1f5f9', background: scoutState.focusedSpotId === s.id ? '#fff5f5' : '#f8fafc' }}>
            {/* Numbered Pin Badge */}
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: s.priority === 'High' ? '#dc2626' : '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
              #{s.id}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                <b style={{ fontSize: 13, color: '#0f172a' }}>
                  Spot #{s.id} · {s.signature}
                </b>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: s.priority === 'High' ? '#fee2e2' : '#fef3c7', color: s.priority === 'High' ? '#991b1b' : '#92400e', fontWeight: 700 }}>
                  {s.priority} Priority
                </span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                <span><Compass size={13} style={{ verticalAlign: -2 }} /> {s.distM} m {s.bearing} ({s.degree}°) from center</span>
                <span>GPS: {s.lat}°, {s.lon}°</span>
                <span>NDVI: <b>{s.ndvi}</b></span>
              </div>

              <p style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.4 }}>
                <b>Inspection instructions:</b> {s.inspection}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexDirection: 'column' }}>
              <button
                type="button"
                onClick={() => focusHotspotOnMap(s.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 8px',
                  fontSize: 11,
                  borderRadius: 6,
                  background: scoutState.focusedSpotId === s.id ? '#fee2e2' : '#fff',
                  border: scoutState.focusedSpotId === s.id ? '1px solid #dc2626' : '1px solid #cbd5e1',
                  color: '#b91c1c',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="Pin and highlight this waypoint on the SEVA.GIS field map"
              >
                <MapPin size={12} /> Pin on Map
              </button>
              <a
                href={`https://www.google.com/maps?q=${s.lat},${s.lon}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 8px',
                  fontSize: 11,
                  borderRadius: 6,
                  background: '#fff',
                  border: '1px solid #cbd5e1',
                  color: '#0284c7',
                  textDecoration: 'none',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                <Navigation size={12} /> Walk
              </a>
            </div>
          </div>
        ))}
      </div>

      <small style={{ display: 'block', marginTop: 10, color: 'var(--muted)', fontSize: 11 }}>
        Hotspots identify relative spatial outliers within your farm boundaries where vegetation vigor, chlorophyll absorption or water reflectance lags the field mean. Walk to the pins to inspect soil and crop foliage.
      </small>
    </section>
  )
}
