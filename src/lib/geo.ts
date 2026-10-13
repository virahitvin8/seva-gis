export type Ring = [number, number][] // [lon, lat]

export function centroid(ring: Ring): { lat: number; lon: number } {
  const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length
  return { lat, lon }
}

export function areaHa(ring: Ring): number {
  if (ring.length < 3) return 0
  const { lat, lon } = centroid(ring)
  const kx = 111320 * Math.cos((lat * Math.PI) / 180), ky = 111320
  const pts = ring.map(p => [(p[0] - lon) * kx, (p[1] - lat) * ky])
  let sum = 0
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; sum += x1 * y2 - x2 * y1 }
  return Math.abs(sum) / 2 / 10000
}

export function perimeterM(ring: Ring): number {
  if (ring.length < 2) return 0
  const { lat } = centroid(ring)
  const kx = 111320 * Math.cos((lat * Math.PI) / 180), ky = 111320
  let total = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length]
    const dx = (x2 - x1) * kx
    const dy = (y2 - y1) * ky
    total += Math.hypot(dx, dy)
  }
  return total
}

export function parseCoordinate(input: string, axis: 'lat' | 'lon'): number | null {
  const text = input.trim().toUpperCase().replace(/−/g, '-')
  if (!text) return null
  const direction = text.match(/[NSEW]/)?.[0]
  if (direction && ((axis === 'lat' && !['N', 'S'].includes(direction)) || (axis === 'lon' && !['E', 'W'].includes(direction)))) return null
  const values = text.match(/[+-]?\d+(?:\.\d+)?/g)?.map(Number)
  if (!values?.length || values.length > 3 || values.some(value => !Number.isFinite(value))) return null
  const [degrees, minutes = 0, seconds = 0] = values
  if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return null
  const magnitude = Math.abs(degrees) + minutes / 60 + seconds / 3600
  const negative = direction ? direction === 'S' || direction === 'W' : degrees < 0
  const coordinate = negative ? -magnitude : magnitude
  const limit = axis === 'lat' ? 90 : 180
  return magnitude <= limit ? coordinate : null
}

export function orderRing(ring: Ring): Ring {
  const c = centroid(ring)
  return [...ring].sort((a, b) => Math.atan2(a[1] - c.lat, a[0] - c.lon) - Math.atan2(b[1] - c.lat, b[0] - c.lon))
}

export function ensureClosedRing(ring: Ring): Ring {
  if (ring.length === 0) return []
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] === last[0] && first[1] === last[1]) return [...ring]
  return [...ring, [first[0], first[1]]]
}

function ccw(p1: [number, number], p2: [number, number], p3: [number, number]): number {
  return (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0])
}

function segmentsIntersect(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number]
): boolean {
  const d1 = ccw(c, d, a)
  const d2 = ccw(c, d, b)
  const d3 = ccw(a, b, c)
  const d4 = ccw(a, b, d)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }
  return false
}

export interface GeometryValidationResult {
  valid: boolean
  error?: string
  closedRing: Ring
  areaHa: number
  perimeterM: number
  isSelfIntersecting: boolean
}

export function validateAoiGeometry(rawRing: Ring): GeometryValidationResult {
  if (!Array.isArray(rawRing) || rawRing.length < 3) {
    return {
      valid: false,
      error: 'Area of interest requires at least 3 distinct boundary vertices.',
      closedRing: [],
      areaHa: 0,
      perimeterM: 0,
      isSelfIntersecting: false,
    }
  }

  // Check coordinates within valid WGS84 range
  for (const pt of rawRing) {
    if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1]) || Math.abs(pt[0]) > 180 || Math.abs(pt[1]) > 90) {
      return {
        valid: false,
        error: 'Coordinates must be valid WGS84 values (longitude between -180 and 180, latitude between -90 and 90).',
        closedRing: [],
        areaHa: 0,
        perimeterM: 0,
        isSelfIntersecting: false,
      }
    }
  }

  // Deduplicate consecutive identical points
  const deduped: Ring = []
  for (let i = 0; i < rawRing.length; i++) {
    const cur = rawRing[i]
    const prev = deduped[deduped.length - 1]
    if (!prev || prev[0] !== cur[0] || prev[1] !== cur[1]) {
      deduped.push(cur)
    }
  }

  // If last point equals first point, remove for vertex count and edge intersection tests
  const openRing = (deduped.length > 1 && deduped[0][0] === deduped[deduped.length - 1][0] && deduped[0][1] === deduped[deduped.length - 1][1])
    ? deduped.slice(0, -1)
    : deduped

  if (openRing.length < 3) {
    return {
      valid: false,
      error: 'Area of interest must contain at least 3 distinct non-coincident vertices.',
      closedRing: [],
      areaHa: 0,
      perimeterM: 0,
      isSelfIntersecting: false,
    }
  }

  // Check self-intersection among non-adjacent edges
  const n = openRing.length
  let selfIntersecting = false
  for (let i = 0; i < n; i++) {
    const a = openRing[i]
    const b = openRing[(i + 1) % n]
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      const c = openRing[j]
      const d = openRing[(j + 1) % n]
      if (segmentsIntersect(a, b, c, d)) {
        selfIntersecting = true
        break
      }
    }
    if (selfIntersecting) break
  }

  if (selfIntersecting) {
    return {
      valid: false,
      error: 'Area of interest boundary contains self-intersecting polygon edges. Redraw or order vertices to form a simple polygon.',
      closedRing: ensureClosedRing(openRing),
      areaHa: areaHa(openRing),
      perimeterM: perimeterM(openRing),
      isSelfIntersecting: true,
    }
  }

  const aHa = areaHa(openRing)
  if (aHa <= 0) {
    return {
      valid: false,
      error: 'Degenerate polygon with zero area. Vertices may be collinear.',
      closedRing: ensureClosedRing(openRing),
      areaHa: 0,
      perimeterM: perimeterM(openRing),
      isSelfIntersecting: false,
    }
  }

  if (aHa > 250_000) {
    return {
      valid: false,
      error: `Selected area (${aHa.toFixed(0)} ha) exceeds the 250,000 ha client processing limit. Please select a focused area of interest.`,
      closedRing: ensureClosedRing(openRing),
      areaHa: aHa,
      perimeterM: perimeterM(openRing),
      isSelfIntersecting: false,
    }
  }

  return {
    valid: true,
    closedRing: ensureClosedRing(openRing),
    areaHa: aHa,
    perimeterM: perimeterM(openRing),
    isSelfIntersecting: false,
  }
}

const valid = (p: number[]) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90
const clean = (pts: number[][]): Ring => {
  const ring = pts.filter(valid).map(p => [p[0], p[1]] as [number, number])
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop()
  return ring
}

function fromGeoJson(data: any): Ring {
  const rings: Ring[] = [], points: number[][] = []
  const walk = (g: any) => {
    if (!g) return
    if (g.type === 'FeatureCollection') g.features.forEach(walk)
    else if (g.type === 'Feature') walk(g.geometry)
    else if (g.type === 'GeometryCollection') g.geometries.forEach(walk)
    else if (g.type === 'Polygon') rings.push(clean(g.coordinates[0]))
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((p: number[][][]) => rings.push(clean(p[0])))
    else if (g.type === 'LineString') rings.push(clean(g.coordinates))
    else if (g.type === 'Point') points.push(g.coordinates)
    else if (g.type === 'MultiPoint') points.push(...g.coordinates)
  }
  walk(data)
  if (rings.length) return rings.sort((a, b) => areaHa(b) - areaHa(a))[0]
  return clean(points)
}

function fromXml(text: string, tags: string[]): Ring {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('This file is not valid XML.')
  const polys = Array.from(doc.getElementsByTagName('Polygon'))
  const parse = (s: string) => s.trim().split(/\s+/).map(t => t.split(',').map(Number))
  if (polys.length) {
    const rings = polys.map(p => clean(parse(p.getElementsByTagName('coordinates')[0]?.textContent || '')))
    return rings.sort((a, b) => areaHa(b) - areaHa(a))[0]
  }
  const gpx: number[][] = []
  for (const t of tags) Array.from(doc.getElementsByTagName(t)).forEach(n => gpx.push([Number(n.getAttribute('lon')), Number(n.getAttribute('lat'))]))
  if (gpx.length) return clean(gpx)
  const all: number[][] = []
  Array.from(doc.getElementsByTagName('coordinates')).forEach(n => all.push(...parse(n.textContent || '')))
  return clean(all)
}

function fromCsv(text: string): Ring {
  const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean).map(r => r.split(/[,;\t]/).map(c => c.trim().replace(/^"|"$/g, '')))
  if (!rows.length) return []
  const head = rows[0].map(h => h.toLowerCase())
  const find = (names: string[]) => head.findIndex(h => names.includes(h))
  let li = find(['lat', 'latitude', 'y']), oi = find(['lon', 'lng', 'long', 'longitude', 'x'])
  let body = rows.slice(1)
  if (li < 0 || oi < 0) {
    body = rows
    const wkt = text.match(/POLYGON\s*\(\(([^)]+)\)\)/i)
    if (wkt) return clean(wkt[1].split(',').map(p => p.trim().split(/\s+/).map(Number)))
    li = 0; oi = 1
    if (rows[0].length >= 2 && Math.abs(Number(rows[0][0])) > 90) { li = 1; oi = 0 }
  }
  return clean(body.map(r => [Number(r[oi]), Number(r[li])]))
}

export async function parseBoundary(file: File): Promise<Ring> {
  const name = file.name.toLowerCase()
  if (file.size > 25_000_000) throw new Error('File is larger than 25 MB. Simplify the boundary and try again.')
  let ring: Ring
  if (/\.(zip|shp)$/.test(name)) {
    const { parseZip, parseShp } = await import('shpjs')
    const buf = await file.arrayBuffer()
    let data: any
    try { data = name.endsWith('.zip') ? await parseZip(buf) : { type: 'GeometryCollection', geometries: parseShp(buf) } }
    catch { throw new Error('This zip could not be read as a shapefile. Zip the .shp, .dbf, .shx and .prj files together, with no sub-folders.') }
    ring = fromGeoJson(Array.isArray(data) ? { type: 'FeatureCollection', features: data.flatMap((d: any) => d.features ?? []) } : data)
    if (ring.some(p => Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)) throw new Error('This shapefile is not in latitude/longitude. Add its .prj file to the zip, or re-export it in WGS 84 (EPSG:4326).')
  } else if (/\.(dbf|gdb|shx|prj)$/.test(name)) throw new Error('Upload the whole shapefile as one .zip (with .shp, .dbf, .shx and .prj inside), or the .shp file alone.')
  else {
    const text = await file.text()
    if (/\.(geojson|json)$/.test(name)) ring = fromGeoJson(JSON.parse(text))
    else if (/\.kml$/.test(name)) ring = fromXml(text, [])
    else if (/\.gpx$/.test(name)) ring = fromXml(text, ['trkpt', 'rtept', 'wpt'])
    else if (/\.(csv|txt|tsv|wkt)$/.test(name)) ring = fromCsv(text)
    else throw new Error('Unsupported file type. Use a shapefile .zip, GeoJSON, KML, GPX, CSV or WKT.')
  }
  if (!ring.length) throw new Error('No coordinates were found in this file.')
  return ring
}

export function createCircleRing(centerLon: number, centerLat: number, radiusMeters: number, steps = 36): Ring {
  const points: Ring = []
  const radLat = (centerLat * Math.PI) / 180
  const metersPerDegLat = 111320
  const metersPerDegLon = 111320 * Math.cos(radLat)
  for (let i = 0; i < steps; i++) {
    const angle = (i * 2 * Math.PI) / steps
    const dx = radiusMeters * Math.sin(angle)
    const dy = radiusMeters * Math.cos(angle)
    const lon = centerLon + dx / metersPerDegLon
    const lat = centerLat + dy / metersPerDegLat
    points.push([Number(lon.toFixed(7)), Number(lat.toFixed(7))])
  }
  return points
}

export function createRectangleRing(centerLon: number, centerLat: number, widthMeters: number, heightMeters: number): Ring {
  const radLat = (centerLat * Math.PI) / 180
  const metersPerDegLat = 111320
  const metersPerDegLon = 111320 * Math.cos(radLat)
  const halfW = widthMeters / 2
  const halfH = heightMeters / 2
  const dLon = halfW / metersPerDegLon
  const dLat = halfH / metersPerDegLat

  return [
    [Number((centerLon - dLon).toFixed(7)), Number((centerLat - dLat).toFixed(7))],
    [Number((centerLon + dLon).toFixed(7)), Number((centerLat - dLat).toFixed(7))],
    [Number((centerLon + dLon).toFixed(7)), Number((centerLat + dLat).toFixed(7))],
    [Number((centerLon - dLon).toFixed(7)), Number((centerLat + dLat).toFixed(7))],
  ]
}

export function createBboxRing(minLon: number, minLat: number, maxLon: number, maxLat: number): Ring {
  return [
    [Number(minLon.toFixed(7)), Number(minLat.toFixed(7))],
    [Number(maxLon.toFixed(7)), Number(minLat.toFixed(7))],
    [Number(maxLon.toFixed(7)), Number(maxLat.toFixed(7))],
    [Number(minLon.toFixed(7)), Number(maxLat.toFixed(7))],
  ]
}
