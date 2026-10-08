import { INDICATORS, byId, renderLayer, verdict, type Grid } from './lib/indicators'
import { constructionSuitability, farmBBox, farmRing, indexStat, irrigationAdvice, loadDem, loadScene, type Analysis, type FarmData, type WeekRec } from './lib/seva'
import { areaHa } from './lib/geo'
import { rampColor } from './lib/raster'
import { contourLines } from './MapKit'
import { logoMark as logoUrl } from './assets/brand'

export type ReportFarm = FarmData & { id: string; name: string; location: string; crop: string; sample?: boolean; passes?: WeekRec[] }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const f = (v: number | undefined, d = 2) => (v === undefined || !Number.isFinite(v) ? 'n/a' : v.toFixed(d))
const nice = (x: number, steps: number[]) => steps.find(s => s >= x) ?? steps[steps.length - 1]
const dms = (v: number, pos: string, neg: string) => { const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d) * 60 - m) * 60; return `${d}° ${m}′ ${s.toFixed(1)}″ ${v >= 0 ? pos : neg}` }

/* Carbone-style template: {d.path} and {d.path:fmt} are merged with a JSON object */
function fill(tpl: string, d: unknown) {
  return tpl.replace(/\{d\.([\w.]+)(?::(\w+))?\}/g, (_, path: string, fmt?: string) => {
    let v: unknown = d
    for (const k of path.split('.')) v = (v as Record<string, unknown> | undefined)?.[k]
    if (typeof v === 'number' && !fmt && Number.isInteger(v)) return String(v)
    if (typeof v === 'number') return fmt === 'n1' ? v.toFixed(1) : fmt === 'n3' ? v.toFixed(3) : fmt === 'n0' ? v.toFixed(0) : v.toFixed(2)
    return esc(v)
  })
}

async function dataUrl(url: string) {
  try {
    const r = await fetch(url); if (!r.ok) throw new Error()
    const b = await r.blob()
    return await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b) })
  } catch { return url }
}

type View = { bbox: [number, number, number, number]; W: number; H: number; mpp: number; px: (lon: number, lat: number) => [number, number] }
function makeView(fb: [number, number, number, number], W = 960, H = 660): View {
  const lat0 = (fb[1] + fb[3]) / 2, k = Math.cos((lat0 * Math.PI) / 180)
  const needW = (fb[2] - fb[0]) * 111320 * k * 1.7, needH = (fb[3] - fb[1]) * 111320 * 1.7
  const mpp = Math.max(needW / W, needH / H, 0.5)
  const dLat = (H * mpp) / 111320, dLon = (W * mpp) / (111320 * k)
  const cx = (fb[0] + fb[2]) / 2, cy = lat0
  const bbox: View['bbox'] = [cx - dLon / 2, cy - dLat / 2, cx + dLon / 2, cy + dLat / 2]
  return { bbox, W, H, mpp, px: (lon, lat) => [((lon - bbox[0]) / (bbox[2] - bbox[0])) * W, ((bbox[3] - lat) / (bbox[3] - bbox[1])) * H] }
}
const esri = (v: View) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${v.bbox.join(',')}&bboxSR=4326&imageSR=4326&size=${v.W},${v.H}&format=jpg&f=image`
const pts = (ring: [number, number][], v: View) => ring.map(p => v.px(p[0], p[1]).map(n => n.toFixed(1)).join(',')).join(' ')

const legendBox = (x: number, y: number, w: number, h: number, inner: string) => `<g transform="translate(${x} ${y})"><rect width="${w}" height="${h}" rx="8" fill="#fcfdf9" fill-opacity=".94" stroke="#10231b"/>${inner}</g>`
const gradientDef = (id: string, ramp: string[]) => `<linearGradient id="${id}" x1="0" x2="1">${ramp.map((c, i) => `<stop offset="${(i / (ramp.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join('')}</linearGradient>`
const outline = (ring: [number, number][], v: View) => `<polygon points="${pts(ring, v)}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="6" stroke-linejoin="round"/><polygon points="${pts(ring, v)}" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`

export type CartOpts = { title: boolean; north: boolean; scale: boolean; legend: boolean; coords: boolean }
export type ReportOpts = { maps: string[]; cart: CartOpts; contour: number }
export const MAP_CHOICES: { id: string; name: string; note: string }[] = [
  { id: 'fresh', name: 'Fresh satellite view', note: 'Esri World Imagery with your boundary' },
  { id: 'ndvi', name: 'Crop health (NDVI)', note: 'Sentinel-2, red = weak, green = strong' },
  { id: 'ndmi', name: 'Leaf water (NDMI)', note: 'Sentinel-2 moisture of the canopy' },
  { id: 'ndwi', name: 'Surface water (NDWI)', note: 'Open water and wet ground' },
  { id: 'evi', name: 'Dense canopy (EVI)', note: 'Better than NDVI for thick crops' },
  { id: 'ndre', name: 'Nitrogen stress (NDRE)', note: 'Red-edge early stress signal' },
  { id: 'bsi', name: 'Bare soil (BSI)', note: 'Fallow and exposed soil' },
  { id: 'terrain', name: 'Terrain map', note: 'Height colours, hillshade and contours' },
  { id: 'slope', name: 'Slope', note: 'Steepness from the 30 m terrain model' },
  { id: 'twi', name: 'Wetness index (TWI)', note: 'Where water collects' },
]
export const DEFAULT_OPTS: ReportOpts = { maps: ['fresh', 'ndvi', 'terrain'], cart: { title: true, north: true, scale: true, legend: true, coords: true }, contour: 0 }

const M = 58
type Spec = { id: string; num: number; label: string; name: string; credit: string; defs?: string; content: string; legend: { w: number; h: number; inner: string }; v: View }

const cel = (id: string, x: number, y: number, w: number, h: number, inner: string) => `<g class="cel" data-el="${id}" data-w="${w}" data-h="${h}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect class="hit" width="${w}" height="${h}" fill="transparent"/>${inner}</g>`

function frameCoords(v: View) {
  const span = Math.max(v.bbox[2] - v.bbox[0], v.bbox[3] - v.bbox[1]), gs = nice(span / 5, [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1]), dp = gs < 0.001 ? 4 : gs < 0.01 ? 3 : 2
  const xs: number[] = [0], ys: number[] = [0], lx: [number, string][] = [], ly: [number, string][] = []
  for (let x = Math.ceil(v.bbox[0] / gs) * gs; x < v.bbox[2]; x += gs) { const px = v.px(x, 0)[0]; xs.push(px); lx.push([px, `${x.toFixed(dp)}°E`]) }
  for (let y = Math.ceil(v.bbox[1] / gs) * gs; y < v.bbox[3]; y += gs) { const py = v.px(0, y)[1]; ys.push(py); ly.push([py, `${y.toFixed(dp)}°N`]) }
  xs.push(v.W); ys.push(v.H); xs.sort((a, b) => a - b); ys.sort((a, b) => a - b)
  let o = ''
  xs.slice(0, -1).forEach((x, i) => { const w = xs[i + 1] - x, fillc = i % 2 ? '#fff' : '#10231b'; o += `<rect x="${x}" y="-8" width="${w}" height="8" fill="${fillc}" stroke="#10231b" stroke-width=".8"/><rect x="${x}" y="${v.H}" width="${w}" height="8" fill="${fillc}" stroke="#10231b" stroke-width=".8"/>` })
  ys.slice(0, -1).forEach((y, i) => { const h = ys[i + 1] - y, fillc = i % 2 ? '#fff' : '#10231b'; o += `<rect x="-8" y="${y}" width="8" height="${h}" fill="${fillc}" stroke="#10231b" stroke-width=".8"/><rect x="${v.W}" y="${y}" width="8" height="${h}" fill="${fillc}" stroke="#10231b" stroke-width=".8"/>` })
  lx.forEach(([x, t]) => { o += `<line x1="${x}" x2="${x}" y1="-8" y2="-14" stroke="#10231b"/><line x1="${x}" x2="${x}" y1="${v.H + 8}" y2="${v.H + 14}" stroke="#10231b"/><text x="${x}" y="-18" font-size="11" text-anchor="middle" fill="#10231b">${t}</text><text x="${x}" y="${v.H + 26}" font-size="11" text-anchor="middle" fill="#10231b">${t}</text>` })
  ly.forEach(([y, t]) => { o += `<line y1="${y}" y2="${y}" x1="-8" x2="-14" stroke="#10231b"/><line y1="${y}" y2="${y}" x1="${v.W + 8}" x2="${v.W + 14}" stroke="#10231b"/><text transform="translate(-20 ${y}) rotate(-90)" font-size="11" text-anchor="middle" fill="#10231b">${t}</text><text transform="translate(${v.W + 24} ${y}) rotate(90)" font-size="11" text-anchor="middle" fill="#10231b">${t}</text>` })
  return o
}

function mapFigure(sp: Spec, o: CartOpts) {
  const v = sp.v, W = v.W, H = v.H, TW = W + 2 * M, TH = H + 2 * M
  const title = sp.name, tw = Math.max(230, title.length * 10 + 30)
  const m = nice(v.mpp * 170, [10, 20, 50, 100, 200, 500, 1000, 2000, 5000]), sw = m / v.mpp
  let els = ''
  if (o.title) els += cel('title', (W - tw) / 2, 14, tw, 46, `<rect width="${tw}" height="46" rx="4" fill="#fcfdf9" fill-opacity=".95" stroke="#10231b" stroke-width="1.5"/><text x="${tw / 2}" y="17" text-anchor="middle" font-size="9" font-weight="700" fill="#5b7a4a" letter-spacing="1.4">MAP ${sp.num} · ${esc(sp.label.toUpperCase())}</text><text x="${tw / 2}" y="37" text-anchor="middle" font-size="16" font-weight="800" fill="#10231b">${esc(title)}</text>`)
  if (o.north) els += cel('north', W - 58, 14, 44, 74, `<rect x="0" y="0" width="44" height="74" rx="10" fill="#fcfdf9" fill-opacity=".92" stroke="#10231b"/><g transform="translate(22 8)"><path d="M0 2 L12 50 L0 41 L-12 50Z" fill="#fcfdf9" stroke="#10231b" stroke-width="2" stroke-linejoin="round"/><path d="M0 2 L12 50 L0 41Z" fill="#10231b"/><text y="63" text-anchor="middle" font-size="13" font-weight="800" fill="#10231b">N</text></g>`)
  if (o.scale) els += cel('scale', 14, H - 58, sw + 16, 44, `<rect width="${sw + 16}" height="44" rx="6" fill="#fcfdf9" fill-opacity=".92" stroke="#10231b"/><g transform="translate(8 22)"><rect width="${sw / 2}" height="7" fill="#10231b"/><rect x="${sw / 2}" width="${sw / 2}" height="7" fill="#fff" stroke="#10231b"/><text y="-5" font-size="11" fill="#10231b" font-weight="700">0</text><text x="${sw / 2}" y="-5" font-size="11" text-anchor="middle" fill="#10231b" font-weight="700">${m / 2}</text><text x="${sw}" y="-5" font-size="11" text-anchor="end" fill="#10231b" font-weight="700">${m} m</text><text y="19" font-size="9.5" fill="#10231b">Scale bar</text></g>`)
  if (o.legend) els += cel('legend', W - sp.legend.w - 14, H - sp.legend.h - 14, sp.legend.w, sp.legend.h, legendBox(0, 0, sp.legend.w, sp.legend.h, sp.legend.inner))
  const frame = o.coords ? frameCoords(v) : ''
  const cx = (v.bbox[0] + v.bbox[2]) / 2, cy = (v.bbox[1] + v.bbox[3]) / 2
  const credit = `<text x="${TW / 2}" y="${TH - 22}" text-anchor="middle" font-size="11" fill="#10231b" font-weight="700">${esc(sp.name)} · Centre ${cy.toFixed(5)}°N ${cx.toFixed(5)}°E · WGS 84 (EPSG:4326)</text><text x="${TW / 2}" y="${TH - 8}" text-anchor="middle" font-size="10" fill="#5f6f60">${esc(sp.credit)}</text>`
  return `<svg class="cart" data-fig="${sp.id}" data-w="${W}" data-h="${H}" viewBox="0 0 ${TW} ${TH}" role="img" aria-label="${esc(sp.name)}" font-family="DM Sans,Arial,sans-serif" xmlns="http://www.w3.org/2000/svg"><defs>${sp.defs ?? ''}<clipPath id="mc-${sp.id}"><rect width="${W}" height="${H}"/></clipPath></defs><rect width="${TW}" height="${TH}" fill="#fff"/><g transform="translate(${M} ${M})"><g clip-path="url(#mc-${sp.id})">${sp.content}</g><rect width="${W}" height="${H}" fill="none" stroke="#10231b" stroke-width="1.5"/>${frame}${els}</g>${credit}</svg>`
}


const dimBase = (v: View, base: string, f2: string) => `<image href="${base}" width="${v.W}" height="${v.H}" style="filter:${f2}"/>`
function overlayImg(v: View, g: Grid, url: string, extra = '') {
  const [x0, y0] = v.px(g.bbox[0], g.bbox[3]), [x1, y1] = v.px(g.bbox[2], g.bbox[1])
  return `<image href="${url}" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" preserveAspectRatio="none" ${extra}/>`
}
const gradLegend = (name: string, unit: string, lo: number, hi: number, gid: string) => ({ w: 236, h: 82, inner: `<text x="12" y="22" font-size="12" font-weight="800" fill="#10231b">${esc(name)}</text><rect x="12" y="32" width="212" height="10" rx="3" fill="url(#${gid})"/><text x="12" y="57" font-size="10" fill="#10231b">${lo.toFixed(2)}</text><text x="118" y="57" font-size="10" text-anchor="middle" fill="#10231b">${((lo + hi) / 2).toFixed(2)}</text><text x="224" y="57" font-size="10" text-anchor="end" fill="#10231b">${hi.toFixed(2)}</text><text x="12" y="74" font-size="9.5" fill="#5f6f60">${esc(unit)}</text>` })

function buildSpecs(opts: ReportOpts, v: View, base: string, ring: [number, number][], g: Grid, dem: Grid | null, an: Analysis, step: number) {
  const out: Spec[] = [], date = an.scene.datetime.slice(0, 10)
  const s2 = `Sentinel-2 L2A ${date} (Copernicus, Microsoft Planetary Computer) · Imagery © Esri`
  let num = 0
  for (const id of opts.maps) {
    if (id === 'fresh') {
      out.push({ id, num: ++num, label: 'Satellite', name: 'Fresh satellite view', credit: 'Imagery © Esri, Maxar, Earthstar Geographics', v, content: `${dimBase(v, base, 'none')}${outline(ring, v)}`, legend: { w: 214, h: 58, inner: `<text x="12" y="22" font-size="12" font-weight="800" fill="#10231b">Legend</text><line x1="12" x2="40" y1="40" y2="40" stroke="#10231b" stroke-width="5"/><line x1="12" x2="40" y1="40" y2="40" stroke="#fff" stroke-width="2.5"/><text x="48" y="44" font-size="10.5" fill="#10231b">Farm boundary</text>` } })
      continue
    }
    if (id === 'terrain') {
      if (!dem) continue
      const dl = renderLayer(byId('dem'), dem, ring), hl = renderLayer(byId('hillshade'), dem, ring)
      const { lines } = contourLines(dem, step), idx = step * 5, seen = new Set<number>()
      const segs = lines.map(l => `<polyline points="${l.pts.map(p => v.px(p[1], p[0]).map(n => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#fff7d6" stroke-width="${l.level % idx === 0 ? 2 : 1}" stroke-opacity="${l.level % idx === 0 ? 1 : .75}"/>`).join('')
      const labs = lines.filter(l => l.level % idx === 0 && !seen.has(l.level) && seen.add(l.level)).map(l => { const [x, y] = v.px(l.pts[0][1], l.pts[0][0]); return `<text x="${x + 3}" y="${y - 3}" font-size="11" font-weight="700" fill="#fff" stroke="#000" stroke-width=".5">${Math.round(l.level * 10) / 10} m</text>` }).join('')
      const content = `${dimBase(v, base, 'brightness(.8)')}${overlayImg(v, dem, dl.url, 'opacity=".55"')}${overlayImg(v, dem, hl.url, 'style="mix-blend-mode:multiply" opacity=".8"')}<clipPath id="fc"><polygon points="${pts(ring, v)}"/></clipPath><g clip-path="url(#fc)">${segs}</g>${labs}${outline(ring, v)}`
      out.push({ id, num: ++num, label: 'Terrain', name: 'Terrain map', credit: 'Copernicus GLO-30 DEM · Imagery © Esri', v, defs: gradientDef('gd', byId('dem').ramp!), content, legend: { w: 270, h: 112, inner: `<text x="12" y="20" font-size="12" font-weight="800" fill="#10231b">Legend</text><rect x="12" y="30" width="150" height="9" rx="3" fill="url(#gd)"/><text x="12" y="53" font-size="10" fill="#10231b">Low ground</text><text x="162" y="53" font-size="10" text-anchor="end" fill="#10231b">High ground</text><line x1="12" x2="40" y1="70" y2="70" stroke="#c9a400" stroke-width="2"/><text x="48" y="74" font-size="10.5" fill="#10231b">Contour every ${step} m (bold ${step * 5} m)</text><rect x="12" y="82" width="28" height="10" fill="#777"/><text x="48" y="91" font-size="10.5" fill="#10231b">Hillshade: sun from north-west</text>` } })
      continue
    }
    const ind = byId(id), grid = ind.source === 'DEM' ? dem : g
    if (!grid || !ind.ramp) continue
    const lay = renderLayer(ind, grid, ring), [lo, hi] = lay.range ?? [0, 1], gid = `gr-${id}`
    if (id === 'ndvi') {
      const bands = [['#a50026', 'Bare or stressed', '< 0.2'], ['#f46d43', 'Weak', '0.2 – 0.35'], ['#fee08b', 'Moderate', '0.35 – 0.5'], ['#a6d96a', 'Good', '0.5 – 0.6'], ['#1a9850', 'Healthy', '> 0.6']]
      out.push({ id, num: ++num, label: 'Crop health', name: 'Crop health (NDVI)', credit: s2, v, defs: gradientDef(gid, ind.ramp), content: `${dimBase(v, base, 'grayscale(.85) brightness(.55)')}${overlayImg(v, g, lay.url)}${outline(ring, v)}`,
        legend: { w: 236, h: 190, inner: `<text x="12" y="22" font-size="12" font-weight="800" fill="#10231b">Crop health (NDVI)</text><rect x="12" y="32" width="212" height="10" rx="3" fill="url(#${gid})"/><text x="12" y="57" font-size="10" fill="#10231b">${lo}</text><text x="118" y="57" font-size="10" text-anchor="middle" fill="#10231b">${((lo + hi) / 2).toFixed(2)}</text><text x="224" y="57" font-size="10" text-anchor="end" fill="#10231b">${hi}+</text>${bands.map((b, i) => `<rect x="12" y="${68 + i * 21}" width="14" height="14" rx="3" fill="${b[0]}"/><text x="34" y="${79 + i * 21}" font-size="11" fill="#10231b">${b[1]} <tspan fill="#5a6e4d">${b[2]}</tspan></text>`).join('')}<text x="12" y="184" font-size="10.5" font-weight="700" fill="#10231b">Farm average ${f(an.ndvi.mean)}</text>` } })
      continue
    }
    out.push({ id, num: ++num, label: ind.group, name: ind.name, credit: grid === g ? s2 : 'Copernicus GLO-30 DEM · Imagery © Esri', v, defs: gradientDef(gid, ind.ramp), content: `${dimBase(v, base, 'grayscale(.85) brightness(.55)')}${overlayImg(v, grid, lay.url)}${outline(ring, v)}`, legend: gradLegend(ind.name, ind.unit ?? ind.desc.split(':')[0], lo, hi, gid) })
  }
  return out
}

const svgLine = (rows: WeekRec[]) => {
  if (rows.length < 2) return '<p class="muted">Not enough satellite passes saved yet. Press Refresh on a few different days and this chart fills in.</p>'
  const W = 760, H = 270, L = 46, R = 14, T = 16, B = 40, lo = -0.2, hi = 1
  const t0 = +new Date(rows[0].date), t1 = +new Date(rows[rows.length - 1].date) || t0 + 1
  const X = (d: string) => L + ((+new Date(d) - t0) / Math.max(1, t1 - t0)) * (W - L - R), Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const line = (k: 'ndvi' | 'ndmi', c: string) => `<polyline fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round" points="${rows.map(r => `${X(r.date).toFixed(1)},${Y(r[k]).toFixed(1)}`).join(' ')}"/>${rows.map(r => `<circle cx="${X(r.date).toFixed(1)}" cy="${Y(r[k]).toFixed(1)}" r="3.5" fill="${c}"/>`).join('')}`
  const ticks = [-0.2, 0, 0.2, 0.4, 0.6, 0.8, 1].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#d8e2d2"/><text x="${L - 6}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="#5f6f60">${v}</text>`).join('')
  const xs = [0, 1, 2, 3, 4].map(i => { const r = rows[Math.round((i / 4) * (rows.length - 1))]; return `<text x="${X(r.date)}" y="${H - 18}" font-size="10.5" text-anchor="middle" fill="#5f6f60">${r.week.slice(2)}</text>` }).join('')
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="NDVI and NDMI over time">${ticks}${xs}<rect x="${L}" y="${Y(0.3)}" width="${W - L - R}" height="${Y(-0.2) - Y(0.3)}" fill="#d73027" opacity=".07"/>${line('ndvi', '#1a9850')}${line('ndmi', '#2b83ba')}<text x="${L}" y="${H - 2}" font-size="11" fill="#5f6f60">Date (year-month-day). Red band = stressed zone (NDVI below 0.3)</text><g transform="translate(${W - 190} ${T})"><circle cx="6" cy="6" r="5" fill="#1a9850"/><text x="16" y="10" font-size="12" fill="#10231b">Crop health (NDVI)</text><circle cx="6" cy="26" r="5" fill="#2b83ba"/><text x="16" y="30" font-size="12" fill="#10231b">Leaf water (NDMI)</text></g></svg>`
}
const svgHist = (counts: number[], lo: number, hi: number) => {
  const W = 760, H = 230, L = 46, B = 34, T = 12, max = Math.max(...counts, 1), bw = (W - L - 10) / counts.length, ramp = byId('ndvi').ramp!
  const bars = counts.map((c, i) => { const mid = lo + ((i + 0.5) / counts.length) * (hi - lo), h = (c / max) * (H - T - B), col = rampColor(ramp, mid / 0.9).map(Math.round); return `<rect x="${L + i * bw + 1}" y="${H - B - h}" width="${bw - 2}" height="${h}" rx="2" fill="rgb(${col})"/>` }).join('')
  const xt = [0, 0.25, 0.5, 0.75, 1].map(t => `<text x="${L + t * (W - L - 10)}" y="${H - 16}" font-size="11" text-anchor="middle" fill="#5f6f60">${(lo + t * (hi - lo)).toFixed(2)}</text>`).join('')
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Histogram of NDVI values">${bars}<line x1="${L}" x2="${W - 10}" y1="${H - B}" y2="${H - B}" stroke="#10231b"/>${xt}<text x="${L}" y="${T + 8}" font-size="11" fill="#5f6f60">Number of 10 m pixels</text><text x="${W - 10}" y="${H - 2}" font-size="11" text-anchor="end" fill="#5f6f60">NDVI value (left = weak, right = strong)</text></svg>`
}
const svgDonut = (parts: { v: number; c: string; l: string }[]) => {
  const tot = parts.reduce((a, p) => a + p.v, 0) || 1; let a0 = -Math.PI / 2
  const arcs = parts.map(p => { const a1 = a0 + (p.v / tot) * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, r = 70, ri = 42, P = (a: number, rr: number) => `${(90 + rr * Math.cos(a)).toFixed(1)},${(90 + rr * Math.sin(a)).toFixed(1)}`; const d = p.v / tot > 0.999 ? `M90 ${90 - r} A${r} ${r} 0 1 1 89.9 ${90 - r} L89.9 ${90 - ri} A${ri} ${ri} 0 1 0 90 ${90 - ri}Z` : `M${P(a0, r)} A${r} ${r} 0 ${big} 1 ${P(a1, r)} L${P(a1, ri)} A${ri} ${ri} 0 ${big} 0 ${P(a0, ri)}Z`; a0 = a1; return `<path d="${d}" fill="${p.c}"/>` }).join('')
  return `<div class="donut"><svg viewBox="0 0 180 180" role="img" aria-label="Share of farm by crop health class">${arcs}</svg><ul>${parts.map(p => `<li><i style="background:${p.c}"></i><b>${((p.v / tot) * 100).toFixed(0)}%</b> ${esc(p.l)}</li>`).join('')}</ul></div>`
}

const REFS: [string, string, string][] = [
  ['Sentinel-2 L2A surface reflectance (ESA Copernicus programme), served through Microsoft Planetary Computer STAC and TiTiler APIs', 'https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a', 'Satellite colour bands at 10 to 20 m, every ~5 days. Free, no key.'],
  ['Copernicus DEM GLO-30 (ESA / Airbus), via Microsoft Planetary Computer', 'https://planetarycomputer.microsoft.com/dataset/cop-dem-glo-30', 'Height of the ground at 30 m. Used for slope, aspect, hillshade, contours, drainage.'],
  ['Open-Meteo weather forecast API (CC BY 4.0)', 'https://open-meteo.com/', 'Rain for the next 7 days and modelled soil moisture.'],
  ['SoilGrids, ISRIC World Soil Information (CC BY 4.0)', 'https://soilgrids.org/', 'Soil properties at 250 m, used for soil context.'],
  ['Esri World Imagery basemap (Maxar, Earthstar Geographics and the GIS user community)', 'https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9', 'The photo-like picture used in the fresh satellite view and as the map background.'],
  ['SpatioTemporal Asset Catalog (STAC) specification', 'https://stacspec.org/', 'How scenes are searched by place, date and cloud cover.'],
  ['Rouse, J.W. et al. (1974). Monitoring vegetation systems in the Great Plains with ERTS. NASA SP-351.', 'https://ntrs.nasa.gov/citations/19740022614', 'Original NDVI.'],
  ['Gao, B.-C. (1996). NDWI, a normalized difference water index for remote sensing of vegetation liquid water from space. Remote Sensing of Environment 58(3).', 'https://doi.org/10.1016/S0034-4257(96)00067-3', 'Leaf water index (NIR and SWIR). The app calls it NDMI.'],
  ['McFeeters, S.K. (1996). The use of the Normalized Difference Water Index (NDWI) in the delineation of open water features. Int. J. Remote Sensing 17(7).', 'https://doi.org/10.1080/01431169608948714', 'Open-water index (green and NIR).'],
  ['Huete, A.R. (1988). A soil-adjusted vegetation index (SAVI). Remote Sensing of Environment 25(3).', 'https://doi.org/10.1016/0034-4257(88)90106-X', 'SAVI.'],
  ['Huete, A. et al. (2002). Overview of the radiometric and biophysical performance of the MODIS vegetation indices. Remote Sensing of Environment 83.', 'https://doi.org/10.1016/S0034-4257(02)00096-2', 'EVI.'],
  ['Horn, B.K.P. (1981). Hill shading and the reflectance map. Proceedings of the IEEE 69(1).', 'https://doi.org/10.1109/PROC.1981.11918', 'Slope and hillshade method.'],
  ['Beven, K.J. and Kirkby, M.J. (1979). A physically based, variable contributing area model of basin hydrology. Hydrological Sciences Bulletin 24(1).', 'https://doi.org/10.1080/02626667909491834', 'Topographic wetness index (TWI).'],
  ['O\u2019Callaghan, J.F. and Mark, D.M. (1984). The extraction of drainage networks from digital elevation data. Computer Vision, Graphics and Image Processing 28.', 'https://doi.org/10.1016/S0734-189X(84)80011-0', 'D8 flow direction and drainage paths.'],
  ['Allen, R.G. et al. (1998). Crop evapotranspiration, FAO Irrigation and Drainage Paper 56.', 'https://www.fao.org/4/x0490e/x0490e00.htm', 'Background on crop water needs behind the irrigation advice.'],
  ['ReportGenerator by Daniel Palme (Apache-2.0): ideas for summary badges, coverage figures, risk hotspots and history charts', 'https://github.com/danielpalme/ReportGenerator', 'Inspiration only. No code copied.'],
  ['Carbone (carboneio): ideas for merging a template with a JSON data object', 'https://github.com/carboneio/carbone', 'Inspiration only. This report uses its own tiny {d.field} merge.'],
  ['GitHub topic: report-generation', 'https://github.com/topics/report-generation', 'Ideas for table of contents, print layout and embedded data.'],
]

export async function buildReport(farm: ReportFarm, onStep: (msg: string) => void = () => {}, opts: ReportOpts = DEFAULT_OPTS) {
  const an = farm.analysis
  if (!an) throw new Error('Press Refresh first so the satellite analysis is ready, then create the report.')
  const ring = farmRing(farm), fb = farmBBox(farm)
  onStep('Loading the satellite picture of your farm')
  const [g, dem] = await Promise.all([loadScene(an.scene, farm), loadDem(farm).catch(() => null)])
  const view = makeView(fb)

  onStep('Downloading the fresh satellite photo')
  const base = await dataUrl(esri(view))

  onStep('Drawing the three maps')
  const nd = byId('ndvi')
  let lo = Infinity, hi = -Infinity
  const demRange = dem ? (() => { for (let i = 0; i < dem.w * dem.h; i++) if (dem.ok[i] && dem.inside[i]) { lo = Math.min(lo, dem.b.elev[i]); hi = Math.max(hi, dem.b.elev[i]) } return Number.isFinite(lo) ? [lo, hi] : [0, 1] })() : [0, 1]
  const step = nice((demRange[1] - demRange[0]) / 8, [0.5, 1, 2, 5, 10, 20, 50, 100])
  const ha = farm.area || areaHa(ring)
  const specs = buildSpecs(opts, view, base, ring, g, dem, an, opts.contour || step)
  if (!specs.length) throw new Error('Pick at least one map in Advanced settings.')
  const figs = specs.map(sp => `<figure>${mapFigure(sp, opts.cart)}<figcaption><b>Map ${sp.num}: ${esc(sp.name)}.</b> ${esc(sp.credit)}. White line = your farm boundary (${ring.length} corner points). <span class="noprint hint">Double-click the map to move the title, north arrow, scale or legend.<button type="button" data-reset="${sp.id}">Reset layout</button></span></figcaption></figure>`).join('')

  onStep('Doing the maths')
  let total = 0, valid = 0, low = 0, mid = 0, high = 0
  const counts = new Array(24).fill(0)
  const cell: { n: number; low: number }[] = Array.from({ length: 9 }, () => ({ n: 0, low: 0 }))
  const sum: Record<string, number> = { B04: 0, B08: 0, B11: 0, B03: 0 }
  for (let i = 0; i < g.w * g.h; i++) {
    if (!g.inside[i]) continue
    total++
    if (!g.ok[i]) continue
    const v = nd.value!(g.b, i)
    if (!Number.isFinite(v) || v < -1 || v > 1) continue
    valid++
    for (const k of Object.keys(sum)) sum[k] += g.b[k][i]
    if (v < 0.3) low++; else if (v < 0.5) mid++; else high++
    counts[Math.min(23, Math.max(0, Math.floor(((v + 0.2) / 1.2) * 24)))]++
    const cx = Math.min(2, Math.floor(((i % g.w) / g.w) * 3)), cy = Math.min(2, Math.floor((Math.floor(i / g.w) / g.h) * 3))
    cell[cy * 3 + cx].n++; if (v < 0.3) cell[cy * 3 + cx].low++
  }
  const mB04 = sum.B04 / Math.max(1, valid), mB08 = sum.B08 / Math.max(1, valid), mB11 = sum.B11 / Math.max(1, valid), mB03 = sum.B03 / Math.max(1, valid)
  const ndviOfMeans = (mB08 - mB04) / (mB08 + mB04), ndmiOfMeans = (mB08 - mB11) / (mB08 + mB11)
  const coverage = total ? (valid / total) * 100 : 0
  const names = ['NW', 'N', 'NE', 'W', 'Centre', 'E', 'SW', 'S', 'SE']
  const cells = cell.map((c, i) => ({ name: names[i], pct: c.n ? (c.low / c.n) * 100 : 0, n: c.n }))
  const worst = [...cells].sort((a, b) => b.pct - a.pct)[0]
  const heat = `<div class="heat">${cells.map(c => { const col = rampColor(['#1a9850', '#fee08b', '#d73027'], Math.min(1, c.pct / 50)).map(Math.round); return `<div style="background:rgb(${col})"><b>${c.name}</b><span>${c.pct.toFixed(0)}% weak</span></div>` }).join('')}</div>`

  const rows = INDICATORS.filter(i => i.value && (i.source === 'S2' || (dem && ['dem', 'slope', 'twi', 'sink'].includes(i.id)))).map(i => {
    const s = indexStat(i.source === 'S2' ? g : dem!, i.id); if (!s) return ''
    const vd = verdict(i.id, s.mean)
    return `<tr><td><b>${esc(i.name)}</b><small>${esc(i.group)}</small></td><td>${esc(i.desc)}</td><td>${f(s.mean, 3)}</td><td>${f(s.min, 2)} to ${f(s.max, 2)}</td><td>${vd ? `<span class="pill ${vd.tone}">${esc(vd.word)}</span><small>${esc(vd.why)}</small>` : ''}</td></tr>`
  }).join('')

  let aspect = ''
  if (dem) {
    const sec = new Array(8).fill(0); let n = 0
    for (let i = 0; i < dem.w * dem.h; i++) if (dem.inside[i] && dem.ok[i] && dem.b.slope[i] > 1) { sec[Math.round(dem.b.aspect[i] / 45) % 8]++; n++ }
    const nm = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    aspect = n ? `<div class="bars">${sec.map((c, i) => `<div><span>${nm[i]}</span><i style="width:${(c / n) * 100}%"></i><b>${((c / n) * 100).toFixed(0)}%</b></div>`).join('')}</div>` : '<p class="muted">The ground is almost flat, so no slope direction stands out.</p>'
  }

  const irr = irrigationAdvice(farm), con = constructionSuitability(farm)
  const adviceHtml = ([['Irrigation advice', irr], ['Construction suitability', con]] as const).map(([t, a]) => `<div class="advice ${a.level}"><h4>${t}<span>${esc(a.chip)}</span></h4><p><b>${esc(a.title)}</b></p><ul>${a.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>${a.why ? `<p class="why"><b>Why?</b> ${esc(a.why)}</p>` : ''}</div>`).join('')

  const now = new Date(), tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const sceneDate = new Date(an.scene.datetime)
  const rid = `SEVA-${farm.id}-${now.toISOString().slice(0, 16).replace(/[-:T]/g, '')}`
  const c = { lat: farm.lat, lon: farm.lon }
  const sw = fb[2] - fb[0], sh = fb[3] - fb[1]
  const data = {
    reportId: rid, farm: { name: farm.name, place: farm.location, crop: farm.crop, areaHa: ha, areaAcres: ha * 2.47105, lat: c.lat, lon: c.lon, vertices: ring.length, widthM: sw * 111320 * Math.cos((c.lat * Math.PI) / 180), heightM: sh * 111320, elevation: farm.elevation ?? an.elevMean, boundary: ring },
    satellite: { scene: an.scene.id, acquired: an.scene.datetime, cloud: an.scene.cloud, pixels: valid, coverage }, analysis: { ndvi: an.ndvi, ndmi: an.ndmi, ndwi: an.ndwi, stressPct: an.stressPct, slopePct: an.slopePct, slopeDeg: an.slopeDeg, analysedAt: an.analysedAt },
    weather: { rain7d: farm.rain, soilMoisture: farm.moisture }, advice: { irrigation: irr, construction: con }, passes: farm.passes ?? [], generated: now.toISOString(), timezone: tz,
  }
  const verdictWord = an.ndvi.mean >= 0.6 ? 'healthy' : an.ndvi.mean >= 0.5 ? 'good' : an.ndvi.mean >= 0.35 ? 'moderate' : 'weak'
  const kpi = (l: string, v: string, s: string) => `<div class="kpi"><small>${l}</small><b>${v}</b><span>${s}</span></div>`
  const yes = (ok: boolean) => ok ? '<span class="pill good">yes</span>' : '<span class="pill info">no</span>'
  const dry = an.ndmi.mean < 0.1 || (farm.moisture !== undefined && farm.moisture < 15), rainy = (farm.rain ?? 0) >= 15

  const logo = await dataUrl(logoUrl)
  const cover = fill(`<header class="cover"><div class="brandbar"><img src="${logo}" alt="SEVA.GIS logo"/><div><b>SEVA<em>.GIS</em></b><span>Spatial Evaluation &amp; Vegetation Analytics</span></div></div><div class="eyebrow">FARM INTELLIGENCE REPORT</div><h1>{d.farm.name}</h1><p class="sub">{d.farm.place} · Crop: {d.farm.crop} · {d.farm.areaHa:n1} hectares</p><div class="kpis">`, data)
    + kpi('Crop health (NDVI)', f(an.ndvi.mean), verdictWord) + kpi('Stressed area', `${f(an.stressPct, 0)}%`, 'pixels with NDVI below 0.3') + kpi('Leaf water (NDMI)', f(an.ndmi.mean), 'higher means wetter leaves') + kpi('Slope', an.slopePct === undefined ? 'n/a' : `${an.slopePct.toFixed(1)}%`, 'average steepness')
    + fill(`</div><div class="locbox"><div><small>LOCATION</small><b>{d.farm.place}</b><span>{d.farm.lat:n3}° N, {d.farm.lon:n3}° E · {d.farm.areaHa:n1} ha</span></div><div><small>SATELLITE PICTURE</small><b>{d.satellite.acquired}</b><span>Sentinel-2 · cloud {d.satellite.cloud:n0}%</span></div><div><small>REPORT ID</small><b>{d.reportId}</b><span>Made with SEVA.GIS</span></div></div><p class="srcline"><b>Data sources:</b> Sentinel-2 L2A (ESA Copernicus via Microsoft Planetary Computer) · Copernicus DEM GLO-30 · Open-Meteo weather · SoilGrids (ISRIC) · Esri World Imagery · OpenStreetMap. Full links in section 8.</p></header>`, data)

  const toc = ['Summary in plain words', 'The three maps', 'Charts and numbers', 'How we worked it out (the maths)', 'Index table', 'Terrain', 'Advice and the reasons', 'Data sources and references', 'Limits', 'Credits', 'Record of this report']
  const section = (n: number, title: string, body: string) => `<section class="sec"><h2><span>${n}</span>${title}</h2>${body}</section>`
  const plain = (t: string) => `<div class="plain"><b>In plain words</b><p>${t}</p></div>`

  const body = [
    section(1, toc[0], plain(`We looked at <b>${esc(farm.name)}</b> from space on <b>${sceneDate.toUTCString()}</b>. The plants look <b>${verdictWord}</b> (score ${f(an.ndvi.mean)} out of about 0.9). About <b>${f(an.stressPct, 0)}%</b> of the farm looks weak. ${worst && worst.pct > 20 ? `The part to walk and check first is the <b>${worst.name}</b> side (${worst.pct.toFixed(0)}% weak).` : 'No single corner stands out as weak.'}`)
      + `<div class="grid2">${adviceHtml}</div>`),
    section(2, toc[1], `${plain('Each map shows your exact boundary in white. Satellite and index maps show what is on the ground, the terrain map shows height and slope. The grid of coordinates sits on the outer frame so it never covers the map.')}${figs}`),
    section(3, toc[2], `${plain('Charts turn many numbers into one picture. The histogram shows how many 10 m squares fall at each score. The donut shows how much of the farm is strong, middling or weak. The line shows how the farm changed on different dates.')}
      <h3>How the farm splits by crop health</h3>${svgDonut([{ v: high, c: '#1a9850', l: 'Healthy (NDVI 0.5 or more)' }, { v: mid, c: '#fee08b', l: 'Moderate (0.3 to 0.5)' }, { v: low, c: '#d73027', l: 'Stressed (below 0.3)' }])}
      <h3>Spread of NDVI values inside the boundary</h3>${svgHist(counts, -0.2, 1)}
      <h3>Where on the farm is weak? (3 by 3 grid, north at the top)</h3>${heat}
      <h3>Change over time</h3>${svgLine(farm.passes ?? [])}
      <div class="kpis small">${kpi('Lowest 10%', f(an.ndvi.p10), 'NDVI at the 10th percentile')}${kpi('Median', f(an.ndvi.p50), 'the middle value')}${kpi('Highest 10%', f(an.ndvi.p90), 'NDVI at the 90th percentile')}${kpi('Data coverage', `${coverage.toFixed(0)}%`, 'pixels that were clear')}</div>`),
    section(4, toc[3], `${plain('Each number comes from simple arithmetic on satellite colours. Below is the working with your real numbers, so you can check it with a calculator.')}
      <h3>a) Farm size</h3><p>The boundary has ${ring.length} corners. Using the shoelace formula on a flat local grid (1° latitude ≈ 111,320 m), the area is <b>${f(ha, 2)} ha</b> (${f(ha * 2.47105, 2)} acres). A Sentinel-2 pixel is 10 m × 10 m = 0.01 ha, so the farm covers about ${f(ha / 0.01, 0)} pixels. We used <b>${valid}</b> clear pixels inside the boundary at the grid resolution (${coverage.toFixed(0)}% coverage).</p>
      <h3>b) Crop health, NDVI</h3><p>Healthy leaves reflect near-infrared light (NIR, band B08) and absorb red light (B04). <code>NDVI = (NIR − Red) ÷ (NIR + Red)</code>.</p><p class="calc">Farm averages: NIR = ${f(mB08, 4)}, Red = ${f(mB04, 4)}<br>NDVI of the averages = (${f(mB08, 4)} − ${f(mB04, 4)}) ÷ (${f(mB08, 4)} + ${f(mB04, 4)}) = <b>${f(ndviOfMeans, 3)}</b><br>Average of every pixel's own NDVI = <b>${f(an.ndvi.mean, 3)}</b> (this is the number we report, because it treats each square equally)</p>
      <h3>c) Leaf water, NDMI</h3><p><code>NDMI = (NIR − SWIR1) ÷ (NIR + SWIR1)</code> with SWIR1 = band B11. Wet leaves absorb more SWIR light.</p><p class="calc">SWIR1 = ${f(mB11, 4)}<br>NDMI of the averages = (${f(mB08, 4)} − ${f(mB11, 4)}) ÷ (${f(mB08, 4)} + ${f(mB11, 4)}) = <b>${f(ndmiOfMeans, 3)}</b><br>Average of every pixel's NDMI = <b>${f(an.ndmi.mean, 3)}</b></p>
      <h3>d) Stressed share</h3><p><code>Stressed % = pixels with NDVI below 0.3 ÷ all clear pixels × 100</code></p><p class="calc">${low} ÷ ${valid} × 100 = <b>${valid ? ((low / valid) * 100).toFixed(1) : 'n/a'}%</b> (app value ${f(an.stressPct, 1)}%)</p>
      <h3>e) Slope</h3><p>Slope from the 30 m terrain model by the Horn (1981) method, then <code>slope % = tan(angle) × 100</code>.</p><p class="calc">${an.slopeDeg === undefined ? 'Slope not available.' : `Average angle ${f(an.slopeDeg, 2)}° → tan(${f(an.slopeDeg, 2)}°) × 100 = <b>${f(an.slopePct, 2)}%</b>. A slope of 8% means the ground rises 8 m over 100 m.`}</p>
      <h3>f) Advice rules checked on your farm</h3><table class="t"><tr><th>Question</th><th>Your value</th><th>Rule</th><th>Result</th></tr>
      <tr><td>Do the leaves look dry?</td><td>NDMI ${f(an.ndmi.mean)}; soil moisture ${farm.moisture ?? 'n/a'}%</td><td>NDMI below 0.1 or soil moisture below 15%</td><td>${yes(dry)}</td></tr>
      <tr><td>Is real rain coming?</td><td>${farm.rain === undefined ? 'n/a' : `${farm.rain.toFixed(1)} mm`} in 7 days</td><td>15 mm or more</td><td>${yes(rainy)}</td></tr>
      <tr><td>Is the farm stressed?</td><td>${f(an.stressPct, 0)}% weak</td><td>25% or more (needs-attention flag at above 20%)</td><td>${yes(an.stressPct >= 25)}</td></tr>
      <tr><td>Is the land steep?</td><td>${an.slopePct === undefined ? 'n/a' : `${an.slopePct.toFixed(1)}%`}</td><td>Above 8% takes care, above 15% is hard</td><td>${yes((an.slopePct ?? 0) > 8)}</td></tr></table>`),
    section(5, toc[4], `${plain('This table lists every index we can calculate. A bigger NDVI is better. A bigger NDMI means wetter leaves. The coloured word tells you what the number means.')}<div class="scroll"><table class="t idx"><tr><th>Index</th><th>What it measures and formula</th><th>Farm average</th><th>Lowest to highest</th><th>Meaning</th></tr>${rows}</table></div>`),
    section(6, toc[5], `${plain(`The ground height was measured by a satellite radar-based model. Water runs downhill, so slope and direction tell us where water drains, collects or erodes.`)}<div class="kpis small">${kpi('Elevation', `${f(farm.elevation ?? an.elevMean, 0)} m`, 'above sea level')}${kpi('Lowest to highest', dem ? `${demRange[0].toFixed(0)} to ${demRange[1].toFixed(0)} m` : 'n/a', 'inside the boundary')}${kpi('Average slope', an.slopePct === undefined ? 'n/a' : `${an.slopePct.toFixed(1)}%`, an.slopeDeg === undefined ? '' : `${an.slopeDeg.toFixed(1)}°`)}${kpi('Contour gap', `${step} m`, 'one line per step')}</div><h3>Which way the ground faces (share of sloping ground)</h3>${aspect || '<p class="muted">Terrain not available.</p>'}`),
    section(7, toc[6], `${plain('Advice is a helper, not an order. Every line has a reason under it. If you know your field better, you can ignore it.')}<div class="grid2">${adviceHtml}</div><p class="muted">Weather: rain next 7 days ${farm.rain === undefined ? 'not fetched' : farm.rain.toFixed(1) + ' mm'}; modelled surface soil moisture ${farm.moisture ?? 'n/a'}% (Open-Meteo).</p>`),
    section(8, toc[7], `${plain('A good report says where each fact came from. All data are free and need no key. Click any link to check the original.')}<ol class="refs">${REFS.map(r => `<li><a href="${r[1]}">${esc(r[0])}</a><br><small>${esc(r[2])}</small></li>`).join('')}</ol>
      <p><b>Scene used:</b> ${esc(an.scene.id)}, taken ${esc(an.scene.datetime)}, cloud cover ${an.scene.cloud}%. Clouds, shadows and bad pixels were removed with the Sentinel-2 Scene Classification (SCL) layer before any number was worked out.</p>`),
    section(9, toc[8], `<ul><li>A satellite shows <b>where</b> a crop is weaker, not <b>why</b>. It cannot name a pest or a disease.</li><li>10 m pixels mix soil, leaves and shade. Very small farms (under 1 ha) have only a few pixels.</li><li>Soil moisture and rain are weather-model estimates, not a sensor in your field.</li><li>Irrigation and construction notes are guides. They are not an engineering survey, a flood study or a legal document.</li><li>Clouds can hide the farm on some days, so numbers can change between passes.</li></ul>`),
    section(10, toc[9], `<p>Idea, design and code by <b>N. Akshit Vinay</b>. <a href="mailto:akshitvinay4636@gmail.com">akshitvinay4636@gmail.com</a> · <a href="https://www.linkedin.com/in/neelam-akshit-vinay-b18554322">LinkedIn</a> · <a href="https://github.com/virahitvin8">GitHub</a> · <a href="https://sevagis.dpdns.org">sevagis.dpdns.org</a></p><p>Open-source tools: React, Vite, Tailwind CSS, Leaflet, MapLibre GL JS, Motion, Dexie, geolib. Data credits are listed in section 8. SEVA.GIS is released under the MIT licence. No API keys or paid services are used.</p>`),
  ].join('')

  const record = fill(`<footer class="record"><h2>Record of this report</h2><table class="t rec">
    <tr><th>Report ID</th><td>{d.reportId}</td><th>Farm</th><td>{d.farm.name}</td></tr>
    <tr><th>Place</th><td>{d.farm.place}</td><th>Crop</th><td>{d.farm.crop}</td></tr>
    <tr><th>Centre latitude</th><td>{d.farm.lat:n3}° N</td><th>Centre longitude</th><td>{d.farm.lon:n3}° E</td></tr>
    <tr><th>Farm size</th><td>{d.farm.areaHa:n2} ha ({d.farm.areaAcres:n2} acres)</td><th>Width × height</th><td>{d.farm.widthM:n0} m × {d.farm.heightM:n0} m</td></tr>
    <tr><th>Satellite scene</th><td>{d.satellite.scene}</td><th>Cloud cover</th><td>{d.satellite.cloud:n0}%</td></tr>
    <tr><th>Boundary corners</th><td>{d.farm.vertices}</td><th>Clear pixels used</th><td>{d.satellite.pixels} ({d.satellite.coverage:n0}%)</td></tr></table>
    <table class="t rec"><tr><th>Time of recording (satellite)</th><td>${esc(sceneDate.toUTCString())}<br><small>${esc(sceneDate.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }))} (${esc(tz)})</small></td></tr>
    <tr><th>Analysis run</th><td>${esc(new Date(an.analysedAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }))}</td></tr>
    <tr><th>Report downloaded</th><td>${esc(now.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }))}<br><small>${esc(now.toUTCString())} · Time zone ${esc(tz)}</small></td></tr>
    <tr><th>Coordinates (DMS)</th><td>${dms(c.lat, 'N', 'S')}, ${dms(c.lon, 'E', 'W')}</td></tr>
    <tr><th>Bounding box</th><td>West ${fb[0].toFixed(5)}°, South ${fb[1].toFixed(5)}°, East ${fb[2].toFixed(5)}°, North ${fb[3].toFixed(5)}° (WGS 84)</td></tr>
    <tr><th>Made with</th><td>SEVA.GIS by N. Akshit Vinay · open data, no keys</td></tr></table></footer>`, data)

  const SCRIPT = `(function(){var RID=document.body.getAttribute('data-rid');function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
document.querySelectorAll('svg.cart').forEach(function(svg){var id=svg.getAttribute('data-fig'),W=+svg.getAttribute('data-w'),H=+svg.getAttribute('data-h'),key='seva-pos:'+RID+':'+id,pos={};try{pos=JSON.parse(ls(key)||'{}')}catch(e){}
function put(g,x,y){g.setAttribute('transform','translate('+x.toFixed(1)+' '+y.toFixed(1)+')')}
svg.querySelectorAll('.cel').forEach(function(g){g.setAttribute('data-x0',g.getAttribute('transform'));var p=pos[g.getAttribute('data-el')];if(p)put(g,p[0],p[1])});
svg.addEventListener('dblclick',function(){svg.classList.toggle('edit')});
var d=null;function pt(e,g){var m=g.parentNode.getScreenCTM().inverse(),q=svg.createSVGPoint();q.x=e.clientX;q.y=e.clientY;return q.matrixTransform(m)}
svg.addEventListener('pointerdown',function(e){if(!svg.classList.contains('edit'))return;var g=e.target.closest&&e.target.closest('.cel');if(!g)return;var q=pt(e,g),m=/translate\\(([-\\d.]+)[ ,]([-\\d.]+)\\)/.exec(g.getAttribute('transform'));d={g:g,dx:q.x-m[1],dy:q.y-m[2],w:+g.getAttribute('data-w'),h:+g.getAttribute('data-h')};svg.setPointerCapture(e.pointerId);e.preventDefault()});
svg.addEventListener('pointermove',function(e){if(!d)return;var q=pt(e,d.g),x=Math.max(0,Math.min(W-d.w,q.x-d.dx)),y=Math.max(0,Math.min(H-d.h,q.y-d.dy));put(d.g,x,y)});
function end(){if(!d)return;var m=/translate\\(([-\\d.]+)[ ,]([-\\d.]+)\\)/.exec(d.g.getAttribute('transform'));pos[d.g.getAttribute('data-el')]=[+m[1],+m[2]];ls(key,JSON.stringify(pos));d=null}
svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end)});
document.querySelectorAll('[data-reset]').forEach(function(b){b.addEventListener('click',function(){var id=b.getAttribute('data-reset');ls('seva-pos:'+RID+':'+id,'{}');var svg=document.querySelector('svg.cart[data-fig="'+id+'"]');svg.querySelectorAll('.cel').forEach(function(g){g.setAttribute('transform',g.getAttribute('data-x0'))})})})})();`
  const css = `.brandbar{display:flex;align-items:center;gap:14px;margin-bottom:22px}.brandbar img{width:58px;height:58px;object-fit:contain;filter:drop-shadow(0 0 8px #4dff9a66)}.brandbar b{display:block;font:800 26px Manrope,sans-serif;letter-spacing:-1px}.brandbar b em{font-style:normal;color:#ffb85c;font-weight:600}.brandbar span{font-size:12px;color:#9fd6b5;letter-spacing:.5px}.locbox{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:22px}.locbox>div{background:#ffffff14;border:1px solid #ffffff2a;border-radius:12px;padding:12px 14px;display:grid;gap:2px}.locbox small{font:700 10px 'JetBrains Mono',monospace;letter-spacing:1.5px;color:#8df5c0}.locbox b{font-size:15px}.locbox span{font-size:12px;color:#c4dccd}.srcline{margin:16px 0 0;font-size:12px;line-height:1.55;color:#c4dccd}.srcline b{color:#fff}.wm-mark{position:fixed;inset:0;z-index:0;pointer-events:none;display:grid;place-items:center;overflow:hidden}.wm-mark span{font:800 clamp(70px,16vw,180px) Manrope,sans-serif;color:#1f6b3a;opacity:.055;transform:rotate(-28deg);white-space:nowrap;letter-spacing:-4px}.wm-mark img{position:absolute;width:38vw;max-width:360px;opacity:.04;transform:rotate(-28deg)}.wrap{position:relative;z-index:1}.pagefoot{display:none}@media print{.wm-mark{position:fixed}.pagefoot{display:block;position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:10px;color:#6b7c70;border-top:1px solid #dfe7dd;padding-top:3px}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}}@media(max-width:640px){.locbox{grid-template-columns:1fr}}.cart{width:100%;height:auto;display:block}.cart.edit{touch-action:none;outline:3px dashed #e0245e}.cart.edit .cel{cursor:move}.cart.edit .cel .hit{stroke:#e0245e;stroke-dasharray:4 3;fill:#e0245e14}.hint{display:block;color:#5f6f60;font-size:12px;margin-top:4px}.hint button{margin-left:8px;font:inherit;font-size:12px;cursor:pointer}@media print{.noprint{display:none}.cart.edit{outline:0}}@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;background:#eef3ea;color:#10231b;font:16px/1.65 'DM Sans',Arial,sans-serif}.wrap{max-width:980px;margin:0 auto;background:#fff;box-shadow:0 10px 60px #0002}h1,h2,h3,h4{font-family:Manrope,'DM Sans',Arial,sans-serif;line-height:1.2}a{color:#1d6b46}.cover{background:radial-gradient(circle at 80% 0,#2c6b4a,#0d1d15 60%);color:#eaf6df;padding:56px 48px 40px}.eyebrow{font:700 12px 'JetBrains Mono',monospace;letter-spacing:2px;color:#b6f36a}.cover h1{font-size:46px;margin:12px 0 6px;letter-spacing:-1.5px}.sub{color:#bcd3c1;margin:0 0 26px}.meta{color:#9fb8a6;font-size:13px;margin:22px 0 0}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi{background:#ffffff14;border:1px solid #ffffff26;border-radius:14px;padding:14px}.kpi small{display:block;font-size:11.5px;opacity:.75}.kpi b{display:block;font:800 28px Manrope,sans-serif;margin:2px 0}.kpi span{font-size:12px;opacity:.75}.small .kpi{background:#f2f7ee;border-color:#dce7d5;color:#10231b}.nav{padding:22px 48px;background:#f6faf2;border-bottom:1px solid #e1ead9}.nav ol{columns:2;margin:6px 0 0;padding-left:20px;font-size:14px}.nav h3{margin:0;font-size:15px}.sec{padding:30px 48px;border-bottom:1px solid #e8efe2;break-inside:auto}.sec h2{font-size:26px;margin:0 0 14px;display:flex;gap:12px;align-items:center}.sec h2 span{width:34px;height:34px;border-radius:50%;background:#183e30;color:#b6f36a;display:grid;place-items:center;font-size:16px}.sec h3{font-size:17px;margin:22px 0 6px}.plain{background:#eef7e4;border-left:5px solid #7fbf3a;border-radius:10px;padding:10px 16px;margin:0 0 18px}.plain b{font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#4b7a1d}.plain p{margin:4px 0 0}figure{margin:20px 0;break-inside:avoid}figure svg{width:100%;height:auto;border-radius:12px;display:block;border:1px solid #cfdcc6}figcaption{font-size:13.5px;color:#4d5e50;margin-top:8px}.chart{width:100%;height:auto}.t{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}.t th,.t td{border:1px solid #dfe8d8;padding:8px 10px;text-align:left;vertical-align:top}.t th{background:#f0f6ea}.t small{display:block;color:#6b7b6c;font-size:12px}.idx td:nth-child(2){font-size:13px}.scroll{overflow-x:auto}.pill{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700;background:#e6edf2;color:#34505f}.pill.good{background:#dff3d5;color:#2c6a17}.pill.ok{background:#fbeccb;color:#8a5b00}.pill.bad{background:#f9d9d3;color:#9a2c1c}code{background:#f0f4ea;padding:2px 7px;border-radius:6px;font-size:14px}.calc{background:#10231b;color:#d7f5b0;border-radius:10px;padding:12px 16px;font:14px/1.7 'JetBrains Mono',monospace}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.advice{border:1px solid #dbe6d3;border-radius:14px;padding:14px 18px;background:#fafdf7}.advice h4{margin:0 0 6px;display:flex;justify-content:space-between;gap:8px}.advice h4 span{font-size:12px;background:#dff3d5;border-radius:99px;padding:2px 10px}.advice.warn h4 span{background:#fbeccb}.advice.bad h4 span{background:#f9d9d3}.why{font-size:13px;color:#5a6e4d}.muted{color:#6b7b6c}.donut{display:flex;align-items:center;gap:24px}.donut svg{width:170px;flex:none}.donut ul{list-style:none;padding:0;margin:0}.donut li{display:flex;gap:8px;align-items:center;margin:5px 0}.donut i{width:14px;height:14px;border-radius:4px}.heat{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;max-width:420px}.heat div{border-radius:8px;padding:14px 8px;text-align:center;color:#10231b}.heat b,.heat span{display:block}.heat span{font-size:12px}.bars div{display:grid;grid-template-columns:34px 1fr 48px;align-items:center;gap:8px;margin:4px 0;font-size:13px}.bars i{height:12px;background:linear-gradient(90deg,#7fbf3a,#1a9850);border-radius:6px;display:block;min-width:2px}.refs li{margin:8px 0}.record{padding:30px 48px 40px;background:#f6faf2}.rec th{white-space:nowrap;width:1%}.rec td{word-break:break-word}@media(max-width:700px){.kpis{grid-template-columns:1fr 1fr}.grid2{grid-template-columns:1fr}.cover,.sec,.nav,.record{padding-left:20px;padding-right:20px}.nav ol{columns:1}}@media print{body{background:#fff}.wrap{box-shadow:none;max-width:none}.sec h2,.t tr,figure,.advice{break-inside:avoid}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(farm.name)} · SEVA.GIS report ${rid}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Manrope:wght@700;800&family=JetBrains+Mono:wght@700&display=swap"><style>${css}</style></head><body data-rid="${rid}"><div class="wm-mark" aria-hidden="true"><img src="${logo}" alt=""/><span>SEVA.GIS</span></div><div class="pagefoot">SEVA.GIS · ${esc(farm.name)} · Report ${rid} · Sentinel-2, Open-Meteo, SoilGrids, Copernicus DEM, Esri</div><div class="wrap">${cover}<nav class="nav"><h3>Contents</h3><ol>${toc.map(t => `<li>${t}</li>`).join('')}</ol></nav>${body}${record}</div><script type="application/json" id="seva-report-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script><script>${SCRIPT}</script></body></html>`
  return { html, data, id: rid }
}
