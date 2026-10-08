import { useMemo, useState } from 'react'
import { ArrowDownToLine, Compass, Crosshair, Ruler } from 'lucide-react'
import {
  computeDestinationPoint, convertArea, convertDistance, decimalToSexagesimal, findNearest, getAreaOfPolygon, getBounds, getBoundsOfDistance, getCenter, getCenterOfBounds,
  getDistance, getDistanceFromLine, getGreatCircleBearing, getPathLength, getPreciseDistance, getRhumbLineBearing, isPointInPolygon, isPointWithinRadius,
  isValidCoordinate, orderByDistance, sexagesimalToDecimal, toDecimal, wktToPolygon,
} from 'geolib'
import { farmRing } from './lib/seva'
import { dirOf } from './lib/gee'

type FarmLite = { id: string; name: string; lat: number; lon: number; area: number; polygon?: [number, number][] }
type Props = { farm: FarmLite; farms: FarmLite[] }
const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }) : '—')
const pt = (p: [number, number]) => ({ latitude: p[1], longitude: p[0] })
const km = (m: number) => (m >= 1000 ? `${f(m / 1000, 2)} km` : `${f(m, 0)} m`)
const AREA_UNITS: [string, string][] = [['ha', 'hectare'], ['ac', 'acre'], ['m2', 'm²'], ['km2', 'km²'], ['ft2', 'ft²'], ['yd2', 'yd²'], ['a', 'are']]
const DIST_UNITS: [string, string][] = [['m', 'metre'], ['km', 'km'], ['mi', 'mile'], ['ft', 'foot'], ['yd', 'yard']]
const toArea = (m2: number, u: string) => (u === 'ac' ? m2 / 4046.8564224 : convertArea(m2, u))
const fromArea = (v: number, u: string) => (u === 'ac' ? v * 4046.8564224 : v / convertArea(1, u))
const fromDist = (v: number, u: string) => v / convertDistance(1, u)

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a')
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

export default function GeoTools({ farm, farms }: Props) {
  const ring = useMemo(() => farmRing(farm), [farm])
  const closed = useMemo(() => (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring : [...ring, ring[0]]), [ring])
  const poly = useMemo(() => ring.map(pt), [ring])
  const g = useMemo(() => {
    const area = getAreaOfPolygon(poly), perimeter = getPathLength(closed.map(pt))
    const b = getBounds(poly), c = getCenter(poly) || pt([farm.lon, farm.lat]), cb = getCenterOfBounds(poly)
    const nw = { latitude: b.maxLat, longitude: b.minLng }
    return {
      area, perimeter, center: c, centerBounds: cb, b, vertices: ring.length,
      width: getDistance(nw, { latitude: b.maxLat, longitude: b.maxLng }), height: getDistance(nw, { latitude: b.minLat, longitude: b.minLng }),
      compactness: (4 * Math.PI * area) / (perimeter * perimeter),
    }
  }, [poly, closed, farm.lat, farm.lon, ring.length])

  const others = farms.filter(x => x.id !== farm.id)
  const near = useMemo(() => {
    if (!others.length) return []
    const list = orderByDistance(g.center, others.map(o => ({ latitude: o.lat, longitude: o.lon, id: o.id }))) as { latitude: number; longitude: number; id: string; distance: number }[]
    return list.map(l => { const o = others.find(x => x.id === l.id)!; return { o, d: getPreciseDistance(g.center, l), bearing: getGreatCircleBearing(g.center, l), dir: dirOf(getRhumbLineBearing(g.center, l)) } })
  }, [others.map(o => o.id).join(), g.center.latitude, g.center.longitude])
  const nearestPt = others.length ? findNearest(g.center, others.map(o => ({ latitude: o.lat, longitude: o.lon }))) as { latitude: number; longitude: number } : null
  const nearest = nearestPt ? others.find(o => o.lat === nearestPt.latitude && o.lon === nearestPt.longitude) : null

  const [q, setQ] = useState({ lat: farm.lat.toFixed(5), lon: (farm.lon + 0.0003).toFixed(5), radius: '100' })
  const qp = { latitude: Number(q.lat), longitude: Number(q.lon) }
  const valid = q.lat.trim() !== '' && q.lon.trim() !== '' && isValidCoordinate(qp)
  const probe = useMemo(() => {
    if (!valid) return null
    let edge = Infinity
    for (let i = 0; i < closed.length - 1; i++) edge = Math.min(edge, getDistanceFromLine(qp, pt(closed[i]), pt(closed[i + 1])))
    const inside = isPointInPolygon(qp, poly)
    return { inside, edge, d: getDistance(g.center, qp), bearing: getRhumbLineBearing(g.center, qp), dir: dirOf(getRhumbLineBearing(g.center, qp)), within: isPointWithinRadius(qp, g.center, Number(q.radius) || 0) }
  }, [q.lat, q.lon, q.radius, valid, closed, poly, g.center])

  const [dest, setDest] = useState({ bearing: '90', dist: '250' })
  const dp = computeDestinationPoint(g.center, Number(dest.dist) || 0, Number(dest.bearing) || 0)
  const [buf, setBuf] = useState('200')
  const bb = getBoundsOfDistance(g.center, Number(buf) || 0)
  const [conv, setConv] = useState({ lat: farm.lat.toFixed(6), lon: farm.lon.toFixed(6), dms: '', area: String(g.area / 10000), areaU: 'ha', dist: '1', distU: 'km' })
  const latDms = decimalToSexagesimal(toDecimal(Number(conv.lat) || 0)), lonDms = decimalToSexagesimal(toDecimal(Number(conv.lon) || 0))
  let dmsOut = ''
  try { dmsOut = conv.dms.trim() ? String(sexagesimalToDecimal(conv.dms.trim())) : '' } catch { dmsOut = 'Use the form 14° 26′ 6″ N' }
  const m2 = fromArea(Number(conv.area) || 0, conv.areaU), m = fromDist(Number(conv.dist) || 0, conv.distU)
  const [wkt, setWkt] = useState('POLYGON((80.01 14.43, 80.02 14.43, 80.02 14.44, 80.01 14.44, 80.01 14.43))')
  const wktRes = useMemo(() => { try { const p = wktToPolygon(wkt); return p.length >= 3 ? { n: p.length, area: getAreaOfPolygon(p), c: getCenter(p) } : null } catch { return null } }, [wkt])

  const ringWkt = `POLYGON((${closed.map(p => `${p[0].toFixed(6)} ${p[1].toFixed(6)}`).join(', ')}))`
  const geojson = { type: 'Feature', properties: { name: farm.name, area_ha: +(g.area / 10000).toFixed(3), perimeter_m: +g.perimeter.toFixed(1) }, geometry: { type: 'Polygon', coordinates: [closed] } }
  const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>${farm.name.replace(/[<&>]/g, '')}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${closed.map(p => `${p[0]},${p[1]},0`).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`
  const slug = farm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const drift = farm.area ? ((g.area / 10000 - farm.area) / farm.area) * 100 : NaN

  return <section className="ag-wrap gt-wrap">
    <div className="intelligence-heading"><h2>Geo toolkit <span>geolib · measure, locate, convert, export</span></h2>
      <div className="gt-exports"><button onClick={() => download(`${slug}.geojson`, JSON.stringify(geojson, null, 2), 'application/geo+json')}><ArrowDownToLine size={14}/>GeoJSON</button><button onClick={() => download(`${slug}.kml`, kml, 'application/vnd.google-earth.kml+xml')}><ArrowDownToLine size={14}/>KML</button><button onClick={() => download(`${slug}.wkt`, ringWkt, 'text/plain')}><ArrowDownToLine size={14}/>WKT</button></div></div>
    <div className="ag-cols">
      <section className="ag-card"><div className="ag-head"><Ruler size={17}/><h3>Farm geometry</h3><small>{g.vertices} boundary points</small></div>
        <div className="ag-grid">
          <div className="ag-item neutral"><span>Geodesic area</span><b>{f(g.area / 10000, 2)} ha</b><small>{f(toArea(g.area, 'ac'), 2)} acres · {f(g.area, 0)} m²{Number.isFinite(drift) && Math.abs(drift) > 3 ? ` · differs ${f(drift, 0)}% from the saved ${farm.area} ha` : ''}</small></div>
          <div className="ag-item neutral"><span>Perimeter</span><b>{km(g.perimeter)}</b><small>fence or bund length</small></div>
          <div className="ag-item neutral"><span>Bounding box</span><b>{km(g.width)} × {km(g.height)}</b><small>east-west × north-south</small></div>
          <div className={`ag-item ${g.compactness > 0.6 ? 'good' : g.compactness > 0.35 ? 'warn' : 'bad'}`}><span>Compactness</span><b>{f(g.compactness, 2)}</b><small>1 = circle, 0.78 = square, low = long or irregular</small></div>
          <div className="ag-item neutral"><span>Centroid</span><b>{f(g.center.latitude, 5)}°, {f(g.center.longitude, 5)}°</b><small>{decimalToSexagesimal(g.center.latitude)} · {decimalToSexagesimal(g.center.longitude)}</small></div>
          <div className="ag-item neutral"><span>Centre of bounds</span><b>{f(g.centerBounds.latitude, 5)}°, {f(g.centerBounds.longitude, 5)}°</b><small>differs from centroid on irregular plots</small></div>
        </div>
        <div className="sc-box compact gt-guide"><div className="sc-title"><b>Compactness</b><span>4π·area / perimeter²</span></div><div className="sc-bar">{['#d73027', '#fdae61', '#a6d96a', '#1a9850'].map(c => <i key={c} style={{ background: c, flex: 1 }}/>)}</div>
          <ul>{[['#d73027', 'Strip or irregular', '< 0.35'], ['#fdae61', 'Elongated', '0.35 to 0.6'], ['#1a9850', 'Compact', '≥ 0.6']].map(r => <li key={r[1]}><i style={{ background: r[0] }}/><span>{r[1]}</span><code>{r[2]}</code></li>)}</ul></div>
      </section>

      <section className="ag-card"><div className="ag-head"><Compass size={17}/><h3>Nearby farms</h3><small>Vincenty distance · great-circle bearing</small></div>
        {near.length ? <table className="gt-table"><thead><tr><th>Farm</th><th>Distance</th><th>Bearing</th><th>Direction</th></tr></thead>
          <tbody>{near.map(n => <tr key={n.o.id} className={nearest?.id === n.o.id ? 'on' : ''}><td>{n.o.name}{nearest?.id === n.o.id && <em> nearest</em>}</td><td>{km(n.d)}</td><td>{f(n.bearing, 0)}°</td><td>{n.dir}</td></tr>)}</tbody></table> : <div className="ag-empty">Add a second farm to see distances between your farms.</div>}
        <small className="ag-note">Bearing is measured clockwise from true north: 0° N, 90° E, 180° S, 270° W.</small>
      </section>

      <section className="ag-card"><div className="ag-head"><Crosshair size={17}/><h3>Point checker</h3><small>is it inside my boundary?</small></div>
        <div className="gt-form"><label>Latitude<input value={q.lat} onChange={e => setQ({ ...q, lat: e.target.value })}/></label><label>Longitude<input value={q.lon} onChange={e => setQ({ ...q, lon: e.target.value })}/></label><label>Radius (m)<input value={q.radius} onChange={e => setQ({ ...q, radius: e.target.value })}/></label></div>
        {!valid ? <div className="ag-empty">Enter a valid latitude (−90 to 90) and longitude (−180 to 180).</div> : probe && <div className="ag-grid">
          <div className={`ag-item ${probe.inside ? 'good' : 'warn'}`}><span>Inside the farm</span><b>{probe.inside ? 'Yes' : 'No'}</b><small>{probe.inside ? `${f(probe.edge, 0)} m from the nearest boundary` : `${f(probe.edge, 0)} m outside the boundary`}</small></div>
          <div className="ag-item neutral"><span>From the centroid</span><b>{km(probe.d)}</b><small>{f(probe.bearing, 0)}° {probe.dir}</small></div>
          <div className={`ag-item ${probe.within ? 'good' : 'neutral'}`}><span>Within {q.radius || 0} m of centroid</span><b>{probe.within ? 'Yes' : 'No'}</b><small>useful to check wells or pumps</small></div>
        </div>}
      </section>

      <section className="ag-card"><div className="ag-head"><Compass size={17}/><h3>Offset &amp; buffer</h3><small>destination point and search box</small></div>
        <details className="gt-how"><summary>How do I use this?</summary><p><b>Offset</b> answers "where do I end up if I walk from the farm centre?". Type a compass bearing (0 = north, 90 = east, 180 = south, 270 = west) and a distance in metres. You get the exact latitude and longitude, useful for placing a well, a sample point or a boundary stone.</p><p><b>Buffer</b> draws a safety box around the farm centre. Type a radius in metres to see how much land it covers and its corner coordinates. In the Analysis lab, the numbered red spots show a distance and bearing from the farm centre, so you can type those two numbers here to get their coordinates.</p></details>
        <div className="gt-form"><label>Bearing °<input value={dest.bearing} onChange={e => setDest({ ...dest, bearing: e.target.value })}/></label><label>Distance m<input value={dest.dist} onChange={e => setDest({ ...dest, dist: e.target.value })}/></label></div>
        <div className="ag-grid"><div className="ag-item neutral"><span>Point {dest.dist || 0} m at {dest.bearing || 0}° from the centroid</span><b>{f(dp.latitude, 6)}°, {f(dp.longitude, 6)}°</b><small>{dirOf(Number(dest.bearing) || 0)} of the farm centre</small></div></div>
        <div className="gt-form"><label>Buffer radius m<input value={buf} onChange={e => setBuf(e.target.value)}/></label></div>
        <div className="ag-grid"><div className="ag-item neutral"><span>Box around the centroid</span><b>{f(bb[0].latitude, 5)}, {f(bb[0].longitude, 5)}</b><small>to {f(bb[1].latitude, 5)}, {f(bb[1].longitude, 5)} · covers {f(Math.PI * (Number(buf) || 0) ** 2 / 10000, 2)} ha as a circle</small></div></div>
      </section>

      <section className="ag-card"><div className="ag-head"><Ruler size={17}/><h3>Converters</h3><small>coordinates, area, distance</small></div>
        <div className="gt-form"><label>Latitude<input value={conv.lat} onChange={e => setConv({ ...conv, lat: e.target.value })}/></label><label>Longitude<input value={conv.lon} onChange={e => setConv({ ...conv, lon: e.target.value })}/></label></div>
        <div className="ag-grid"><div className="ag-item neutral"><span>Degrees, minutes, seconds</span><b>{latDms} N/S</b><small>{lonDms} E/W</small></div></div>
        <div className="gt-form"><label>DMS to decimal<input placeholder={'14° 26′ 6″ N'} value={conv.dms} onChange={e => setConv({ ...conv, dms: e.target.value })}/></label>{dmsOut && <b className="gt-out">{dmsOut}</b>}</div>
        <div className="gt-form"><label>Area<input value={conv.area} onChange={e => setConv({ ...conv, area: e.target.value })}/></label><label>unit<select value={conv.areaU} onChange={e => setConv({ ...conv, areaU: e.target.value })}>{AREA_UNITS.map(u => <option key={u[0]} value={u[0]}>{u[1]}</option>)}</select></label></div>
        <div className="gt-chips">{AREA_UNITS.filter(u => u[0] !== conv.areaU).map(u => <span key={u[0]}>{f(toArea(m2, u[0]), toArea(m2, u[0]) < 10 ? 3 : 1)} {u[1]}</span>)}</div>
        <div className="gt-form"><label>Distance<input value={conv.dist} onChange={e => setConv({ ...conv, dist: e.target.value })}/></label><label>unit<select value={conv.distU} onChange={e => setConv({ ...conv, distU: e.target.value })}>{DIST_UNITS.map(u => <option key={u[0]} value={u[0]}>{u[1]}</option>)}</select></label></div>
        <div className="gt-chips">{DIST_UNITS.filter(u => u[0] !== conv.distU).map(u => <span key={u[0]}>{f(convertDistance(m, u[0]), 2)} {u[1]}</span>)}</div>
      </section>

      <section className="ag-card"><div className="ag-head"><Ruler size={17}/><h3>WKT reader</h3><small>paste a polygon from QGIS or PostGIS</small></div>
        <details className="gt-how"><summary>What is WKT and how do I use it?</summary><p>WKT (Well-Known Text) is a plain-text way to write a shape, for example <code>POLYGON((78.1 14.4, 78.2 14.4, 78.2 14.5, 78.1 14.5, 78.1 14.4))</code>. Each pair is longitude then latitude. GIS programs like QGIS, PostGIS and Google Earth Engine can copy shapes this way.</p><p>Paste it in the box below and SEVA.GIS shows its area and centre. To make it a farm, open <b>Add farm</b> then <b>Upload file</b> and choose a .wkt or .txt file containing the same text. The Analysis lab then maps exactly that shape.</p></details>
        <textarea className="gt-wkt" value={wkt} onChange={e => setWkt(e.target.value)} rows={3} spellCheck={false}/>
        {wktRes ? <div className="ag-grid"><div className="ag-item good"><span>Parsed polygon</span><b>{f(wktRes.area / 10000, 2)} ha</b><small>{wktRes.n} points · centre {f(wktRes.c ? Number(wktRes.c.latitude) : NaN, 5)}°, {f(wktRes.c ? Number(wktRes.c.longitude) : NaN, 5)}°. Use Add farm → upload to analyse it.</small></div></div> : <div className="ag-empty">Not a valid POLYGON((lon lat, …)) yet.</div>}
      </section>
    </div>
    <small className="ag-note">Distances and areas are geodesic (curved Earth), so they match a GPS walk-around, not a flat map ruler. Powered by the geolib library (MIT).</small>
  </section>
}
