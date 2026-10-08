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

export function orderRing(ring: Ring): Ring {
  const c = centroid(ring)
  return [...ring].sort((a, b) => Math.atan2(a[1] - c.lat, a[0] - c.lon) - Math.atan2(b[1] - c.lat, b[0] - c.lon))
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
