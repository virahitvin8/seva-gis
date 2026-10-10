import { useEffect, useMemo, useState } from 'react'
import {
  Users, AlertTriangle, CheckCircle2, Droplets, Sun, Wind,
  ThermometerSnowflake, ThermometerSun, Upload, FileText, ArrowUpDown
} from 'lucide-react'
import type { FarmData } from './lib/seva'
import { fetchWeather, type Weather } from './lib/agro'

type Props = {
  farms: (FarmData & { id: string; name: string; crop?: string })[]
  selectedId: string
  onSelect: (id: string) => void
  onAddBatch?: (newFarms: { name: string; crop: string; lat: number; lon: number; area: number }[]) => void
}

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—')

export default function VillageView({ farms, selectedId, onSelect, onAddBatch }: Props) {
  const [sortField, setSortField] = useState<'name' | 'health' | 'area'>('health')
  const [csvText, setCsvText] = useState('')
  const [batchModal, setBatchModal] = useState(false)

  const activeFarm = farms.find(f => f.id === selectedId) || farms[0]
  const [weatherData, setWeatherData] = useState<Weather | null>(null)

  useEffect(() => {
    if (!activeFarm) return
    let dead = false
    fetchWeather(activeFarm.lat, activeFarm.lon)
      .then(w => { if (!dead) setWeatherData(w) })
      .catch(() => {})
    return () => { dead = true }
  }, [activeFarm?.id, activeFarm?.lat, activeFarm?.lon])

  // Prioritize farms needing immediate intervention
  const rankedFarms = useMemo(() => {
    return farms.map(f => {
      const ndvi = f.analysis?.ndvi.mean ?? 0.6
      const stressPct = f.analysis?.stressPct ?? 15
      const healthScore = Math.min(100, Math.max(10, Math.round(ndvi * 100 - stressPct * 0.5)))
      const needsWater = (f.analysis?.ndmi.mean ?? 0.2) < 0.15 || stressPct > 25
      const priority: 'High' | 'Moderate' | 'Normal' = healthScore < 50 ? 'High' : healthScore < 70 ? 'Moderate' : 'Normal'
      return {
        ...f,
        healthScore,
        needsWater,
        priority,
      }
    }).sort((a, b) => {
      if (sortField === 'health') return a.healthScore - b.healthScore // poorest health first
      if (sortField === 'area') return (b.area || 0) - (a.area || 0)
      return a.name.localeCompare(b.name)
    })
  }, [farms, sortField])

  // Authentic live agro-weather alerts from Open-Meteo
  const weatherAlerts = useMemo(() => {
    if (!weatherData) {
      return [
        {
          id: 'status',
          type: 'Atmospheric Sensor Sync',
          icon: Sun,
          tone: 'good' as const,
          detail: 'Retrieving live Open-Meteo meteorological vectors for active farm coordinates…',
        }
      ]
    }

    const alerts = []
    const isHot = weatherData.tmaxNext7 >= 35
    const isCold = weatherData.tminNext7 <= 8

    alerts.push({
      id: 'temp',
      type: isHot ? 'Heat Stress Advisory' : isCold ? 'Cold Temperature Advisory' : 'Thermal Growth Window',
      icon: isHot ? ThermometerSun : isCold ? ThermometerSnowflake : Sun,
      tone: isHot || isCold ? ('warn' as const) : ('good' as const),
      detail: isHot
        ? `7-day peak temperature forecast reaches ${weatherData.tmaxNext7.toFixed(1)}°C (Today: ${weatherData.tmaxToday.toFixed(1)}°C). High transpiration demand; maintain evening root-zone irrigation to prevent floral abortion.`
        : isCold
        ? `7-day minimum forecast drops to ${weatherData.tminNext7.toFixed(1)}°C (Today min: ${weatherData.tminToday.toFixed(1)}°C). Monitor frost-sensitive crop stages.`
        : `7-day temperature range ${weatherData.tminNext7.toFixed(1)}°C to ${weatherData.tmaxNext7.toFixed(1)}°C is within optimal photosynthetic range. Today mean: ${weatherData.temp.toFixed(1)}°C.`,
    })

    const goodSpray = weatherData.wind < 12 && weatherData.rainNext7 < 2
    alerts.push({
      id: 'spray',
      type: goodSpray ? 'Optimal Spray Window' : 'Caution: Marginal Spray Conditions',
      icon: Wind,
      tone: goodSpray ? ('good' as const) : ('warn' as const),
      detail: goodSpray
        ? `Favorable morning spraying window: wind velocity ${weatherData.wind.toFixed(1)} km/h (< 12 km/h limit), relative humidity ${weatherData.rh.toFixed(0)}%, rain next 7 days: ${weatherData.rainNext7.toFixed(1)} mm.`
        : `Caution for spraying: wind velocity ${weatherData.wind.toFixed(1)} km/h, relative humidity ${weatherData.rh.toFixed(0)}%, forecast rain ${weatherData.rainNext7.toFixed(1)} mm. Drift or washoff risk elevated.`,
    })

    alerts.push({
      id: 'gdd',
      type: 'Growing Degree Days (GDD)',
      icon: Sun,
      tone: 'good' as const,
      detail: `Accumulated thermal sum: ${weatherData.gdd30.toFixed(0)} GDD over past 30 days (+${weatherData.gddNext7.toFixed(0)} GDD forecast next 7 days, Base 10°C). Solar radiation today: ${(weatherData.radToday || 18).toFixed(1)} MJ/m².`,
    })

    return alerts
  }, [weatherData])

  function handleBatchCsvSubmit() {
    if (!csvText.trim()) return
    const lines = csvText.trim().split(/\r?\n/).filter(Boolean)
    const newItems: { name: string; crop: string; lat: number; lon: number; area: number }[] = []

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/[,;\t]/).map(p => p.trim().replace(/^"|"$/g, ''))
      if (parts.length >= 3) {
        const name = parts[0] || `Field ${i + 1}`
        const lat = parseFloat(parts[1])
        const lon = parseFloat(parts[2])
        const crop = parts[3] || 'Crop'
        const area = parseFloat(parts[4]) || 2.0
        if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          newItems.push({ name, crop, lat, lon, area })
        }
      }
    }

    if (newItems.length && onAddBatch) {
      onAddBatch(newItems)
      setCsvText('')
      setBatchModal(false)
      alert(`Successfully added ${newItems.length} fields to your village workspace!`)
    } else {
      alert('Could not parse coordinates. Format: Name, Latitude, Longitude, Crop, Area')
    }
  }

  return (
    <section className="ag-wrap" style={{ marginTop: 24, marginBottom: 24 }}>
      <div className="intelligence-heading">
        <h2>
          Co-operative &amp; Village View <span>multi-field priority audit · district batch analysis · agro-weather alerts</span>
        </h2>
        <button
          onClick={() => setBatchModal(!batchModal)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: '#0284c7', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          <Upload size={14} /> Batch CSV Import
        </button>
      </div>

      {/* Batch CSV Input Modal / Dropdown */}
      {batchModal && (
        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #cbd5e1', marginBottom: 16 }}>
          <b style={{ fontSize: 13, color: '#0f172a' }}>Batch CSV Import for FPOs &amp; Extension Officers</b>
          <p style={{ margin: '4px 0 10px', fontSize: 12, color: 'var(--muted)' }}>
            Paste comma-separated rows: <code>Farm Name, Latitude, Longitude, Crop, Area_ha</code>
          </p>
          <textarea
            rows={4}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder={"Raju North Plot, 14.4325, 78.1254, Paddy, 2.5\nSuresh Field 2, 14.4380, 78.1310, Cotton, 4.0\nVillage Panchayat Common, 14.4290, 78.1180, Wheat, 6.2"}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12 }}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button
              onClick={handleBatchCsvSubmit}
              style={{ padding: '6px 14px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              Process &amp; Ingest Fields
            </button>
            <button
              onClick={() => setBatchModal(false)}
              style={{ padding: '6px 12px', borderRadius: 6, background: '#fff', border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Agro-Weather & Hazard Alerts Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
        {weatherAlerts.map(a => {
          const Icon = a.icon
          return (
            <div key={a.id} style={{ padding: 12, borderRadius: 10, border: `1px solid ${a.tone === 'warn' ? '#fde68a' : '#bbf7d0'}`, background: a.tone === 'warn' ? '#fffbeb' : '#f0fdf4' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Icon size={16} color={a.tone === 'warn' ? '#d97706' : '#16a34a'} />
                <b style={{ fontSize: 13, color: a.tone === 'warn' ? '#92400e' : '#166534' }}>{a.type}</b>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.4 }}>{a.detail}</p>
            </div>
          )
        })}
      </div>

      {/* Multi-Field Priority Audit Table */}
      <div className="ag-card" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg, #fff)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <b style={{ fontSize: 14 }}>Village Field Health &amp; Intervention Priority ({farms.length} plots)</b>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--muted)' }}>Sort by:</span>
            <button onClick={() => setSortField('health')} style={{ border: 'none', background: sortField === 'health' ? '#e2e8f0' : 'transparent', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>Health (Poorest First)</button>
            <button onClick={() => setSortField('area')} style={{ border: 'none', background: sortField === 'area' ? '#e2e8f0' : 'transparent', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>Area</button>
            <button onClick={() => setSortField('name')} style={{ border: 'none', background: sortField === 'name' ? '#e2e8f0' : 'transparent', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>Name</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="gt-table" style={{ width: '100%', fontSize: 12 }}>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Farm Name</th>
                <th>Crop</th>
                <th>Area</th>
                <th>Health Score</th>
                <th>NDVI Vigour</th>
                <th>NDMI Moisture</th>
                <th>Irrigate Today?</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rankedFarms.map(rf => (
                <tr key={rf.id} style={{ background: rf.id === selectedId ? '#f0fdf4' : 'transparent' }}>
                  <td>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: rf.priority === 'High' ? '#fee2e2' : rf.priority === 'Moderate' ? '#fef3c7' : '#dcfce7', color: rf.priority === 'High' ? '#991b1b' : rf.priority === 'Moderate' ? '#92400e' : '#15803d' }}>
                      {rf.priority}
                    </span>
                  </td>
                  <td><b>{rf.name}</b></td>
                  <td>{rf.crop || 'Crop'}</td>
                  <td>{f(rf.area, 1)} ha</td>
                  <td><b>{rf.healthScore}/100</b></td>
                  <td>{rf.analysis?.ndvi.mean.toFixed(2) ?? '—'}</td>
                  <td>{rf.analysis?.ndmi.mean.toFixed(2) ?? '—'}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: rf.needsWater ? '#dc2626' : '#16a34a' }}>
                      {rf.needsWater ? 'YES (Deficit)' : 'No (Adequate)'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => onSelect(rf.id)}
                      style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
