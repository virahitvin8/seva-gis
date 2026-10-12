import { useMemo, useState } from 'react'
import { ArrowDownToLine, Compass, RefreshCw, Ruler, Route, Layers } from 'lucide-react'
import {
  convertArea,
  decimalToSexagesimal,
  findNearest,
  getAreaOfPolygon,
  getBounds,
  getCenter,
  getCenterOfBounds,
  getDistance,
  getPathLength,
  getPreciseDistance,
  getRhumbLineBearing,
  getGreatCircleBearing,
  orderByDistance,
} from 'geolib'
import buffer from '@turf/buffer'
import { farmRing } from './lib/seva'
import { dirOf } from './lib/gee'
import { generateCoveragePath, findOptimalSwathAngle, calculateFarmLogistics } from './lib/pathplan'

type FarmLite = { id: string; name: string; lat: number; lon: number; area: number; polygon?: [number, number][] }
type Props = { farm: FarmLite; farms: FarmLite[] }
const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }) : '—')
const pt = (p: [number, number]) => ({ latitude: p[1], longitude: p[0] })
const km = (m: number) => (m >= 1000 ? `${f(m / 1000, 2)} km` : `${f(m, 0)} m`)
const toArea = (m2: number, u: string) => (u === 'ac' ? m2 / 4046.8564224 : convertArea(m2, u))

function BoxRefresh({ title, onRefresh }: { title: string; onRefresh?: () => void }) {
  const [spinning, setSpinning] = useState(false)
  return (
    <button
      className={`box-refresh-btn ${spinning ? 'spinning' : ''}`}
      title={`Refresh ${title}`}
      onClick={() => {
        setSpinning(true)
        setTimeout(() => setSpinning(false), 700)
        onRefresh?.()
      }}
    >
      <RefreshCw size={13} />
    </button>
  )
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a')
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

export default function GeoTools({ farm, farms }: Props) {
  const [calcKey, setCalcKey] = useState(0)
  const ring = useMemo(() => farmRing(farm), [farm])
  const closed = useMemo(() => (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring : [...ring, ring[0]]), [ring])
  const poly = useMemo(() => ring.map(pt), [ring])
  const g = useMemo(() => {
    const area = getAreaOfPolygon(poly), perimeter = getPathLength(closed.map(pt))
    const b = getBounds(poly), c = getCenter(poly) || pt([farm.lon, farm.lat]), cb = getCenterOfBounds(poly)
    const nw = { latitude: b.maxLat, longitude: b.minLng }
    const ne = { latitude: b.maxLat, longitude: b.minLng }
    const se = { latitude: b.minLat, longitude: b.maxLng }
    const sw = { latitude: b.minLat, longitude: b.minLng }
    return {
      area, perimeter, center: c, centerBounds: cb, b, vertices: ring.length,
      width: getDistance(nw, ne), height: getDistance(nw, sw),
      eastHeight: getDistance(ne, se), westHeight: getDistance(nw, sw),
      compactness: (4 * Math.PI * area) / (perimeter * perimeter),
    }
  }, [poly, closed, farm.lat, farm.lon, ring.length, calcKey])

  const others = farms.filter(x => x.id !== farm.id)
  const near = useMemo(() => {
    if (!others.length) return []
    const list = orderByDistance(g.center, others.map(o => ({ latitude: o.lat, longitude: o.lon, id: o.id }))) as { latitude: number; longitude: number; id: string; distance: number }[]
    return list.map(l => { const o = others.find(x => x.id === l.id)!; return { o, d: getPreciseDistance(g.center, l), bearing: getGreatCircleBearing(g.center, l), dir: dirOf(getRhumbLineBearing(g.center, l)) } })
  }, [others.map(o => o.id).join(), g.center.latitude, g.center.longitude, calcKey])
  const nearestPt = others.length ? findNearest(g.center, others.map(o => ({ latitude: o.lat, longitude: o.lon }))) as { latitude: number; longitude: number } : null
  const nearest = nearestPt ? others.find(o => o.lat === nearestPt.latitude && o.lon === nearestPt.longitude) : null

  // Geodesic Buffer Zone Tool (turf/buffer)
  const [bufferDistance, setBufferDistance] = useState('100')
  const [bufferUnit, setBufferUnit] = useState<'m' | 'km'>('m')
  const bufferResult = useMemo(() => {
    const val = parseFloat(bufferDistance)
    if (!Number.isFinite(val) || val <= 0) return null
    try {
      const distMeters = bufferUnit === 'km' ? val * 1000 : val
      const polyFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
        type: 'Feature',
        properties: { name: farm.name },
        geometry: { type: 'Polygon', coordinates: [closed] }
      }
      const bufFeature = buffer(polyFeature, distMeters, { units: 'meters' })
      if (!bufFeature || !bufFeature.geometry) return null
      const bufCoords = bufFeature.geometry.coordinates[0] as [number, number][]
      const bufPoly = bufCoords.map(pt)
      const bufAreaM2 = getAreaOfPolygon(bufPoly)
      const bufPerimeterM = getPathLength(bufCoords.map(pt))
      return {
        distMeters,
        areaHa: bufAreaM2 / 10000,
        areaAcres: bufAreaM2 / 4046.8564224,
        deltaHa: (bufAreaM2 - g.area) / 10000,
        perimeterM: bufPerimeterM,
        geojson: bufFeature
      }
    } catch (e) {
      console.warn('[GeoTools] Buffer calculation error:', e)
      return null
    }
  }, [closed, bufferDistance, bufferUnit, g.area])

  // Coverage Path Planning (Fields2Cover)
  const [swathWidth, setSwathWidth] = useState('6')
  const [swathAngleMode, setSwathAngleMode] = useState<'auto' | 'custom'>('auto')
  const [customAngle, setCustomAngle] = useState('')
  const [swathSpeed, setSwathSpeed] = useState('8')

  const optAngle = useMemo(() => findOptimalSwathAngle(closed), [closed])
  const activeAngle = swathAngleMode === 'auto' ? optAngle : Number(customAngle) || 0

  const swathPlan = useMemo(() => {
    const width = Math.max(1, Math.min(36, Number(swathWidth) || 6))
    const speed = Math.max(2, Math.min(30, Number(swathSpeed) || 8))
    return generateCoveragePath(closed, width, activeAngle, speed, Math.max(8, width * 1.5))
  }, [closed, swathWidth, activeAngle, swathSpeed, calcKey])

  // Logistics & Isochrones (openrouteservice)
  const logistics = useMemo(() => {
    const areaHa = g.area / 10000
    return calculateFarmLogistics([farm.lon, farm.lat], areaHa)
  }, [farm.lon, farm.lat, g.area, calcKey])


  const ringWkt = `POLYGON((${closed.map(p => `${p[0].toFixed(6)} ${p[1].toFixed(6)}`).join(', ')}))`
  const geojson = { type: 'Feature', properties: { name: farm.name, area_ha: +(g.area / 10000).toFixed(3), perimeter_m: +g.perimeter.toFixed(1) }, geometry: { type: 'Polygon', coordinates: [closed] } }
  const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>${farm.name.replace(/[<&>]/g, '')}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${closed.map(p => `${p[0]},${p[1]},0`).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`
  const slug = farm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const drift = farm.area ? ((g.area / 10000 - farm.area) / farm.area) * 100 : NaN

  return <section className="ag-wrap gt-wrap">
    <div className="intelligence-heading"><h2>Geo toolkit <span>geolib · measure, locate, convert, export</span></h2>
      <div className="gt-exports"><button onClick={() => download(`${slug}.geojson`, JSON.stringify(geojson, null, 2), 'application/geo+json')}><ArrowDownToLine size={14}/>GeoJSON</button><button onClick={() => download(`${slug}.kml`, kml, 'application/vnd.google-earth.kml+xml')}><ArrowDownToLine size={14}/>KML</button><button onClick={() => download(`${slug}.wkt`, ringWkt, 'text/plain')}><ArrowDownToLine size={14}/>WKT</button></div></div>
    <div className="ag-cols">
      <section className="ag-card"><div className="ag-head"><Ruler size={17}/><h3>Farm geometry</h3><small>{g.vertices} boundary points</small><BoxRefresh title="Farm geometry" onRefresh={() => setCalcKey(k => k + 1)}/></div>
        <div className="ag-grid">
          <div className="ag-item neutral"><span>Geodesic area</span><b>{f(g.area / 10000, 2)} ha</b><small>{f(toArea(g.area, 'ac'), 2)} acres · {f(g.area, 0)} m²{Number.isFinite(drift) && Math.abs(drift) > 3 ? ` · differs ${f(drift, 0)}% from the saved ${farm.area} ha` : ''}</small></div>
          <div className="ag-item neutral"><span>Perimeter</span><b>{km(g.perimeter)}</b><small>fence or bund length</small></div>
          <div className="ag-item neutral" style={{ background: '#fefce8', borderColor: '#fde047' }}><span>East side height</span><b style={{ color: '#854d0e' }}>{km(g.eastHeight)}</b><small>metered tape North–South along East</small></div>
          <div className="ag-item neutral" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}><span>Farm width</span><b style={{ color: '#1e40af' }}>{km(g.width)}</b><small>metered tape East–West span</small></div>
          <div className="ag-item neutral"><span>Bounding box</span><b>{km(g.width)} × {km(g.height)}</b><small>east-west × north-south</small></div>
          <div className={`ag-item ${g.compactness > 0.6 ? 'good' : g.compactness > 0.35 ? 'warn' : 'bad'}`}><span>Compactness</span><b>{f(g.compactness, 2)}</b><small>1 = circle, 0.78 = square, low = long or irregular</small></div>
          <div className="ag-item neutral"><span>Centroid</span><b>{f(g.center.latitude, 5)}°, {f(g.center.longitude, 5)}°</b><small>{decimalToSexagesimal(g.center.latitude)} · {decimalToSexagesimal(g.center.longitude)}</small></div>
          <div className="ag-item neutral"><span>Centre of bounds</span><b>{f(g.centerBounds.latitude, 5)}°, {f(g.centerBounds.longitude, 5)}°</b><small>differs from centroid on irregular plots</small></div>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button
            className="gt-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid #eab308', borderRadius: 8, background: '#fef9c3', color: '#854d0e', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' })
              setTimeout(() => {
                const btn = document.querySelector<HTMLButtonElement>('.ix-add[title*="Metered Tape"]')
                if (btn && !btn.classList.contains('on')) btn.click()
              }, 400)
            }}
          >
            <Ruler size={14}/>Open Google Earth Metered Tape on Map ↗
          </button>
        </div>
        <div className="sc-box compact gt-guide"><div className="sc-title"><b>Compactness</b><span>4π·area / perimeter²</span></div><div className="sc-bar">{['#d73027', '#fdae61', '#a6d96a', '#1a9850'].map(c => <i key={c} style={{ background: c, flex: 1 }}/>)}</div>
          <ul>{[['#d73027', 'Strip or irregular', '< 0.35'], ['#fdae61', 'Elongated', '0.35 to 0.6'], ['#1a9850', 'Compact', '≥ 0.6']].map(r => <li key={r[1]}><i style={{ background: r[0] }}/><span>{r[1]}</span><code>{r[2]}</code></li>)}</ul></div>
      </section>

      {/* Fields2Cover Coverage Path Planning */}
      <section className="ag-card"><div className="ag-head"><Route size={17}/><h3>Machinery swath planner</h3><small>Fields2Cover · Boustrophedon path planning</small><BoxRefresh title="Machinery swath planner" onRefresh={() => setCalcKey(k => k + 1)}/></div>
        <details className="gt-how"><summary>What is Coverage Path Planning?</summary>
          <p>Implements the <b>Fields2Cover</b> agricultural robotics algorithm. Generates parallel swath tracks inside your field with headland margins. Aligning swaths with the longest boundary edge (<b>{optAngle}°</b>) minimizes tractor turns, saving up to 18% machinery fuel and avoiding soil compaction.</p>
        </details>
        <div className="gt-form">
          <label>Implement width (m)<input type="number" min="1" max="36" value={swathWidth} onChange={e => setSwathWidth(e.target.value)}/></label>
          <label>Tractor speed (km/h)<input type="number" min="2" max="30" value={swathSpeed} onChange={e => setSwathSpeed(e.target.value)}/></label>
          <label>Swath angle
            <select value={swathAngleMode} onChange={e => setSwathAngleMode(e.target.value as 'auto' | 'custom')}>
              <option value="auto">Auto-optimal ({optAngle}°)</option>
              <option value="custom">Custom angle</option>
            </select>
          </label>
          {swathAngleMode === 'custom' && (
            <label>Angle °<input type="number" min="0" max="180" placeholder="0 - 180" value={customAngle} onChange={e => setCustomAngle(e.target.value)}/></label>
          )}
        </div>
        <div className="ag-grid">
          <div className="ag-item neutral"><span>Swath passes</span><b>{swathPlan.count} rows</b><small>{f(Number(swathWidth) || 6, 1)} m boom implement</small></div>
          <div className="ag-item neutral"><span>Field working track</span><b>{km(swathPlan.swathDistanceM)}</b><small>working in crop</small></div>
          <div className="ag-item neutral"><span>Headland turns</span><b>{km(swathPlan.turningDistanceM)}</b><small>turns outside crop rows</small></div>
          <div className={`ag-item ${swathPlan.efficiencyPct >= 75 ? 'good' : swathPlan.efficiencyPct >= 60 ? 'warn' : 'bad'}`}><span>Field efficiency</span><b>{f(swathPlan.efficiencyPct, 1)}%</b><small>in-work time vs headland turning</small></div>
          <div className="ag-item neutral"><span>Est. field time</span><b>{Math.floor(swathPlan.workingTimeMin / 60)}h {Math.round(swathPlan.workingTimeMin % 60)}m</b><small>at {swathPlan.fieldSpeedKmh} km/h field speed</small></div>
          <div className="ag-item neutral"><span>Optimal angle</span><b>{optAngle}°</b><small>aligned with longest field edge</small></div>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button className="gt-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            onClick={() => download(`${slug}-tractor-swaths.geojson`, JSON.stringify(swathPlan.geojson, null, 2), 'application/geo+json')}>
            <ArrowDownToLine size={14}/>Download Swaths (GeoJSON)
          </button>
        </div>
      </section>

      {/* openrouteservice Agricultural Logistics */}
      <section className="ag-card"><div className="ag-head"><Compass size={17}/><h3>Farm logistics &amp; reachability</h3><small>openrouteservice · transit isochrones</small><BoxRefresh title="Farm logistics" onRefresh={() => setCalcKey(k => k + 1)}/></div>
        <details className="gt-how"><summary>How are reachability isochrones calculated?</summary>
          <p>Models rural machinery transit and grain hauling based on <b>openrouteservice</b> isochrone specifications. Includes unpaved rural road detour factors (0.75× for tractors, 0.80× for haul trucks) to evaluate transfer times to grain silos and collection depots.</p>
        </details>
        <div className="ag-grid">
          <div className="ag-item neutral"><span>Tractor 10-min reach</span><b>{logistics.tractorRadiusKm.t10} km</b><small>at 25 km/h transit speed</small></div>
          <div className="ag-item neutral"><span>Tractor 20-min reach</span><b>{logistics.tractorRadiusKm.t20} km</b><small>local implement transport</small></div>
          <div className="ag-item neutral"><span>Tractor 30-min reach</span><b>{logistics.tractorRadiusKm.t30} km</b><small>max economic field radius</small></div>
          <div className="ag-item neutral"><span>Truck 15-min haul</span><b>{logistics.truckRadiusKm.t15} km</b><small>at 45 km/h road speed</small></div>
          <div className="ag-item neutral"><span>Truck 30-min haul</span><b>{logistics.truckRadiusKm.t30} km</b><small>regional mandi / silo reach</small></div>
          <div className="ag-item neutral"><span>Est. harvest yield</span><b>~{logistics.haulingCapacityTons} tons</b><small>at 4.5 t/ha base harvest</small></div>
        </div>
      </section>

            {/* Geodesic Buffer Zone Tool (turf/buffer) */}
      <section className="ag-card"><div className="ag-head"><Layers size={17}/><h3>Geodesic buffer zone</h3><small>Turf.js · perimeter expansion</small><BoxRefresh title="Geodesic buffer" onRefresh={() => setCalcKey(k => k + 1)}/></div>
        <details className="gt-how"><summary>How is the geodesic buffer calculated?</summary>
          <p>Expands the area of interest boundary outward on the WGS84 ellipsoid by an exact distance in metres or kilometres. Useful for spray drift buffers, hydrological catchment margins, and riparian setback zones.</p>
        </details>
        <div className="gt-form" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 120 }}>Buffer distance
            <input type="number" min="1" max="10000" value={bufferDistance} onChange={e => setBufferDistance(e.target.value)}/>
          </label>
          <label style={{ width: 100 }}>Unit
            <select value={bufferUnit} onChange={e => setBufferUnit(e.target.value as 'm' | 'km')}>
              <option value="m">Metres (m)</option>
              <option value="km">Kilometres (km)</option>
            </select>
          </label>
        </div>
        {bufferResult ? (
          <div className="ag-grid">
            <div className="ag-item neutral"><span>Total buffered area</span><b>{f(bufferResult.areaHa, 2)} ha</b><small>{f(bufferResult.areaAcres, 2)} acres</small></div>
            <div className="ag-item neutral"><span>Expansion (+Δ)</span><b>+{f(bufferResult.deltaHa, 2)} ha</b><small>+{((bufferResult.deltaHa / Math.max(0.01, g.area / 10000)) * 100).toFixed(0)}% area increase</small></div>
            <div className="ag-item neutral"><span>New perimeter</span><b>{km(bufferResult.perimeterM)}</b><small>expanded outer boundary</small></div>
            <div className="ag-item neutral"><span>Buffer offset</span><b>{bufferDistance} {bufferUnit}</b><small>geodesic radial margin</small></div>
          </div>
        ) : (
          <div className="ag-empty">Enter a valid positive distance to calculate the buffer zone.</div>
        )}
        {bufferResult && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button className="gt-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              onClick={() => download(`${slug}-buffer-${bufferDistance}${bufferUnit}.geojson`, JSON.stringify(bufferResult.geojson, null, 2), 'application/geo+json')}>
              <ArrowDownToLine size={14}/>Download Buffered Polygon (GeoJSON)
            </button>
          </div>
        )}
      </section>

      <section className="ag-card"><div className="ag-head"><Compass size={17}/><h3>Nearby farms</h3><small>Vincenty distance · great-circle bearing</small><BoxRefresh title="Nearby farms" onRefresh={() => setCalcKey(k => k + 1)}/></div>
        {near.length ? <table className="gt-table"><thead><tr><th>Farm</th><th>Distance</th><th>Bearing</th><th>Direction</th></tr></thead>
          <tbody>{near.map(n => <tr key={n.o.id} className={nearest?.id === n.o.id ? 'on' : ''}><td>{n.o.name}{nearest?.id === n.o.id && <em> nearest</em>}</td><td>{km(n.d)}</td><td>{f(n.bearing, 0)}°</td><td>{n.dir}</td></tr>)}</tbody></table> : <div className="ag-empty">Add a second farm to see distances between your farms.</div>}
        <small className="ag-note">Bearing is measured clockwise from true north: 0° N, 90° E, 180° S, 270° W.</small>
      </section>

                            </div>
    <small className="ag-note">Distances and areas are geodesic (curved Earth), so they match a GPS walk-around, not a flat map ruler. Powered by the geolib library (MIT).</small>
  </section>
}
