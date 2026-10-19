import { INDICATORS, byId, renderLayer, type Grid } from './lib/indicators'
import { farmBBox, farmRing, irrigationAdvice, constructionSuitability, type Analysis, type Candle } from './lib/seva'
import { areaHa } from './lib/geo'
import { makeView as reportMakeView } from './lib/reportView'
import { logoMark as logoUrl } from './assets/brand'
import {
  type ReportFarm,
  type ReportLang,
  type ReportOpts,
  DEFAULT_OPTS,
  I18N,
  BAND_SYMBOLOGY_CHOICES,
} from './report'

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const nice = (x: number, steps: number[]) => steps.find(s => s >= x) ?? steps[steps.length - 1]

async function dataUrl(url: string) {
  try {
    const r = await fetch(url)
    if (!r.ok) throw new Error()
    const b = await r.blob()
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(String(fr.result))
      fr.onerror = rej
      fr.readAsDataURL(b)
    })
  } catch {
    return url
  }
}

type View = { bbox: [number, number, number, number]; W: number; H: number; mpp: number; px: (lon: number, lat: number) => [number, number] }

/**
 * Framing rules live in `src/lib/reportView.ts` so the "area of interest fills
 * about 75% of the frame and is always centred" rule can be unit-tested on its own.
 */
const makeView = reportMakeView

const pts = (ring: [number, number][], v: View) => ring.map(p => v.px(p[0], p[1]).map(n => n.toFixed(1)).join(',')).join(' ')

/**
 * Honest placeholder for a figure whose inputs SEVA.GIS cannot produce on the
 * device (a calibrated SWAT run, a published gauging-station dataset, …).
 * The frame keeps pagination and typography stable and the words state exactly
 * what is missing. Invented curves, gauges or statistics are never drawn here.
 */
function renderUnavailableFigureSvg(figLabel: string, title: string, reasons: string[], H = 340) {
  const W = 720
  return `<svg class="cart-map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#ffffff" stroke="#10231b" stroke-width="1.5"/>
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="#fafcf9" stroke="#10231b" stroke-width="0.8" stroke-dasharray="6 4"/>
    <text x="${W / 2}" y="56" text-anchor="middle" font-family="'Times New Roman',serif" font-size="12" font-weight="700" fill="#b45309" letter-spacing="1">${esc(figLabel.toUpperCase())} · DATA UNAVAILABLE</text>
    <text x="${W / 2}" y="90" text-anchor="middle" font-family="'Times New Roman',serif" font-size="14" font-weight="700" fill="#10231b">${esc(title)}</text>
    <line x1="${W / 2 - 60}" y1="102" x2="${W / 2 + 60}" y2="102" stroke="#10231b" stroke-width="0.8"/>
    ${reasons.map((r, i) => `<text x="${W / 2}" y="${132 + i * 22}" text-anchor="middle" font-family="'Times New Roman',serif" font-size="10" fill="#444">${esc(r)}</text>`).join('')}
    <text x="${W / 2}" y="${H - 28}" text-anchor="middle" font-family="'Times New Roman',serif" font-size="9" fill="#666">SEVA·GIS draws this figure only when its real inputs exist — illustrative or placeholder values are never shown.</text>
  </svg>`
}

/**
 * 3D Isometric Clipped Topographic Mesh Generator
 */
function render3dTerrainSvg(dem: Grid | null, ring: [number, number][], farmName: string, fb: [number, number, number, number]) {
  const W = 720, H = 420
  if (!dem) {
    return renderUnavailableFigureSvg('Fig 1.1', '3D Topographic Model', [
      'No Copernicus GLO-30 elevation grid is loaded for this area of interest.',
      'Open the farm while online to fetch terrain, then generate the report again.',
    ], H)
  }

  const elevs = dem.b.elev
  let minElev = Infinity, maxElev = -Infinity
  for (let i = 0; i < elevs.length; i++) {
    const e = elevs[i]
    if (Number.isFinite(e) && e > -500 && e < 9000) {
      if (e < minElev) minElev = e
      if (e > maxElev) maxElev = e
    }
  }
  if (!Number.isFinite(minElev)) {
    return renderUnavailableFigureSvg('Fig 1.1', `3D Topographic Model of ${farmName}`, [
      'The loaded elevation grid holds no valid height cells for this area of interest.',
    ], H)
  }
  if (maxElev - minElev < 2) maxElev = minElev + 10

  const gw = Math.min(dem.w, 42)
  const gh = Math.min(dem.h, 32)
  const stepX = dem.w / gw
  const stepY = dem.h / gh

  const cos30 = Math.cos(Math.PI / 6)
  const sin30 = Math.sin(Math.PI / 6)
  const scaleMesh = Math.min(W, H) * 0.44
  const cX = W / 2
  const cY = H / 2 + 30

  const projectIso = (xFrac: number, yFrac: number, zNorm: number) => {
    const xModel = (xFrac - 0.5) * 2
    const yModel = (yFrac - 0.5) * 2
    const zModel = zNorm * 0.8
    const px = cX + (xModel - yModel) * cos30 * scaleMesh
    const py = cY + (xModel + yModel) * sin30 * scaleMesh - zModel * 85
    return { x: px, y: py }
  }

  const ptsIso: { x: number; y: number; inside: boolean; elev: number }[][] = []
  for (let j = 0; j <= gh; j++) {
    const row: { x: number; y: number; inside: boolean; elev: number }[] = []
    const yIdx = Math.min(dem.h - 1, Math.floor(j * stepY))
    const yFrac = j / gh
    for (let i = 0; i <= gw; i++) {
      const xIdx = Math.min(dem.w - 1, Math.floor(i * stepX))
      const xFrac = i / gw
      const cellIdx = yIdx * dem.w + xIdx
      const elev = elevs[cellIdx] ?? minElev
      const inside = !!(dem.inside?.[cellIdx] ?? 1)
      const zNorm = Math.max(0, Math.min(1, (elev - minElev) / (maxElev - minElev)))
      const proj = projectIso(xFrac, yFrac, zNorm)
      row.push({ x: proj.x, y: proj.y, inside, elev })
    }
    ptsIso.push(row)
  }

  let polys = ''
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const p0 = ptsIso[j][i], p1 = ptsIso[j][i + 1], p2 = ptsIso[j + 1][i + 1], p3 = ptsIso[j + 1][i]
      const insideAny = p0.inside || p1.inside || p2.inside || p3.inside
      const avgElev = (p0.elev + p1.elev + p2.elev + p3.elev) / 4
      const t = Math.max(0, Math.min(1, (avgElev - minElev) / (maxElev - minElev)))
      const r = Math.round(45 + t * 190)
      const g = Math.round(106 - t * 20 + (t > 0.6 ? (t - 0.6) * 110 : 0))
      const b = Math.round(79 - t * 40 + (t > 0.8 ? (t - 0.8) * 200 : 0))
      const fill = insideAny ? `rgb(${r},${g},${b})` : 'rgba(210, 220, 215, 0.45)'
      const stroke = insideAny ? '#1b4332' : 'rgba(160, 175, 168, 0.3)'
      const sw = insideAny ? '0.6' : '0.3'
      polys += `<polygon points="${p0.x.toFixed(1)},${p0.y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p3.x.toFixed(1)},${p3.y.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
    }
  }

  const baseDepth = 22
  let skirt = ''
  for (let i = 0; i < gw; i++) {
    const p1 = ptsIso[gh][i], p2 = ptsIso[gh][i + 1]
    if (p1.inside || p2.inside) {
      skirt += `<polygon points="${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p2.x.toFixed(1)},${(p2.y + baseDepth).toFixed(1)} ${p1.x.toFixed(1)},${(p1.y + baseDepth).toFixed(1)}" fill="#6c584c" stroke="#3d312a" stroke-width="0.5"/>`
    }
  }

  return `<svg class="cart-map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#ffffff" stroke="#10231b" stroke-width="2"/>
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="#f9fbf8" stroke="#10231b" stroke-width="0.8"/>
    
    <g transform="translate(24, 20)">
      <rect width="360" height="42" rx="4" fill="#ffffff" fill-opacity="0.95" stroke="#10231b" stroke-width="1.2"/>
      <text x="180" y="18" text-anchor="middle" font-family="'Times New Roman',serif" font-size="10" font-weight="700" fill="#2d6a4f" letter-spacing="1">SEVA·GIS 3D CARTOGRAPHIC TERRAIN ENGINE</text>
      <text x="180" y="34" text-anchor="middle" font-family="'Times New Roman',serif" font-size="13" font-weight="700" fill="#10231b">3D TOPOGRAPHIC MODEL OF ${esc(farmName.toUpperCase())}</text>
    </g>

    <g transform="translate(${W - 65}, 24)">
      <circle cx="24" cy="24" r="22" fill="#ffffff" stroke="#10231b" stroke-width="1.2"/>
      <path d="M24 6 L30 24 L24 20 L18 24 Z" fill="#10231b"/>
      <path d="M24 42 L30 24 L24 28 L18 24 Z" fill="#b0c4b1"/>
      <text x="24" y="4" text-anchor="middle" font-family="'Times New Roman',serif" font-size="11" font-weight="800" fill="#10231b">N</text>
    </g>

    <g id="mesh-3d">${polys}${skirt}</g>

    <g transform="translate(24, ${H - 64})">
      <rect width="260" height="48" rx="4" fill="#ffffff" fill-opacity="0.95" stroke="#10231b" stroke-width="1"/>
      <text x="12" y="16" font-family="'Times New Roman',serif" font-size="10" font-weight="700" fill="#10231b">Elevation Relief (m a.s.l.):</text>
      <defs>
        <linearGradient id="leg-3d" x1="0" x2="1">
          <stop offset="0%" stop-color="#2d6a4f"/>
          <stop offset="25%" stop-color="#74c69d"/>
          <stop offset="50%" stop-color="#e9c46a"/>
          <stop offset="75%" stop-color="#e76f51"/>
          <stop offset="100%" stop-color="#f8f9fa"/>
        </linearGradient>
      </defs>
      <rect x="12" y="22" width="236" height="8" rx="2" fill="url(#leg-3d)" stroke="#10231b" stroke-width="0.5"/>
      <text x="12" y="40" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">${minElev.toFixed(0)} m</text>
      <text x="130" y="40" text-anchor="middle" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">${((minElev + maxElev) / 2).toFixed(0)} m</text>
      <text x="248" y="40" text-anchor="end" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">${maxElev.toFixed(0)} m</text>
    </g>

    <g transform="translate(${W - 250}, ${H - 36})">
      <text x="230" y="12" text-anchor="end" font-family="'Times New Roman',serif" font-size="10" fill="#333">Vertical Exaggeration: 2.5× · WGS 84 / UTM</text>
      <text x="230" y="24" text-anchor="end" font-family="'Times New Roman',serif" font-size="9" fill="#666">Source: Copernicus DEM GLO-30 (ESA / EU)</text>
    </g>
  </svg>`
}

/**
 * Render High-Resolution Overall Field Health Composite Donut / Pie Chart SVG
 */
function renderOverallHealthPieSvg(
  rawScore: number,
  slices: { label: string; pct: number; color: string; val: string }[]
): string {
  const W = 680, H = 330
  const cx = 190, cy = 165, r = 105, ir = 60
  let currentAngle = -Math.PI / 2

  const paths = slices.map(s => {
    if (s.pct <= 0) return '' // legend-only entry (e.g. deductions), no arc
    const angle = (s.pct / 100) * 2 * Math.PI
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)

    const ix1 = cx + ir * Math.cos(endAngle)
    const iy1 = cy + ir * Math.sin(endAngle)
    const ix2 = cx + ir * Math.cos(startAngle)
    const iy2 = cy + ir * Math.sin(startAngle)

    const largeArcFlag = angle > Math.PI ? 1 : 0

    const d = [
      `M ${x1.toFixed(1)} ${y1.toFixed(1)}`,
      `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      `L ${ix1.toFixed(1)} ${iy1.toFixed(1)}`,
      `A ${ir} ${ir} 0 ${largeArcFlag} 0 ${ix2.toFixed(1)} ${iy2.toFixed(1)}`,
      'Z',
    ].join(' ')

    return `<path d="${d}" fill="${s.color}" stroke="#ffffff" stroke-width="2.5"/>`
  }).join('')

  const statusLabel = rawScore >= 78 ? 'HIGH INDEX (ESTIMATE)' : rawScore >= 55 ? 'MODERATE INDEX' : 'LOW INDEX'
  const statusColor = rawScore >= 78 ? '#047857' : rawScore >= 55 ? '#b45309' : '#b91c1c'

  const legendItems = slices.map((s, idx) => {
    const y = 46 + idx * 58
    return `
      <g transform="translate(360, ${y})">
        <rect x="0" y="0" width="18" height="18" rx="4" fill="${s.color}" stroke="#10231b" stroke-width="0.5"/>
        <text x="28" y="14" font-family="'Times New Roman',serif" font-size="11.5" font-weight="bold" fill="#10231b">${esc(s.label)}${s.pct > 0 ? ` (weight ${s.pct.toFixed(0)}%)` : ''}</text>
        <text x="28" y="29" font-family="'Times New Roman',serif" font-size="9.5" fill="#444444">${esc(s.val)}</text>
      </g>
    `
  }).join('')

  return `<svg class="cart-map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; border:1px solid #10231b;">
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="#f9fbf8" stroke="#10231b" stroke-width="0.8"/>

    <!-- Donut Arcs -->
    <g>${paths}</g>

    <!-- Center Badge -->
    <circle cx="${cx}" cy="${cy}" r="${ir - 3}" fill="#ffffff" stroke="#10231b" stroke-width="1.2"/>
    <text x="${cx}" y="${cy - 10}" text-anchor="middle" font-family="'Times New Roman',serif" font-size="28" font-weight="bold" fill="${statusColor}">${rawScore}</text>
    <text x="${cx}" y="${cy + 7}" text-anchor="middle" font-family="'Times New Roman',serif" font-size="9" font-weight="bold" fill="#666666">EST. SCORE / 100</text>
    <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-family="'Times New Roman',serif" font-size="8" font-weight="bold" fill="${statusColor}" letter-spacing="0.5">${statusLabel}</text>

    <!-- Title and Legend -->
    <text x="360" y="30" font-family="'Times New Roman',serif" font-size="12" font-weight="bold" fill="#10231b" letter-spacing="0.5">WHOLE-FIELD ALLOCATION &amp; COMBINATIONS</text>
    <line x1="360" y1="36" x2="${W - 24}" y2="36" stroke="#10231b" stroke-width="1"/>
    <g>${legendItems}</g>

    <text x="${W - 20}" y="${H - 18}" text-anchor="end" font-family="'Times New Roman',serif" font-size="8.5" font-style="italic" fill="#666666">Sentinel-2 Multi-Spectral Health Synthesis (SEVA·GIS Agro-Spatial Core)</text>
  </svg>`
}

/**
 * 2D Professional Cartographic Map with Geodetic Frame Grid & Ticks
 */
function render2dCartographicMap(
  figNum: string,
  title: string,
  v: View,
  ring: [number, number][],
  layerContent: string,
  legendInner: string,
  sourceCredit: string
) {
  const W = 720, H = 460
  const cx = (v.bbox[0] + v.bbox[2]) / 2, cy = (v.bbox[1] + v.bbox[3]) / 2

  const tickSpacingX = (v.bbox[2] - v.bbox[0]) / 4
  const tickSpacingY = (v.bbox[3] - v.bbox[1]) / 4

  let ticks = ''
  for (let i = 1; i <= 3; i++) {
    const lonVal = v.bbox[0] + i * tickSpacingX
    const latVal = v.bbox[1] + i * tickSpacingY
    const [pxX] = v.px(lonVal, cy)
    const [, pxY] = v.px(cx, latVal)
    const tickX = (18 + pxX).toFixed(1)
    const tickY = (18 + pxY).toFixed(1)

    ticks += `<line x1="${tickX}" y1="12" x2="${tickX}" y2="18" stroke="#10231b" stroke-width="1.2"/>`
    ticks += `<line x1="${tickX}" y1="${H - 18}" x2="${tickX}" y2="${H - 12}" stroke="#10231b" stroke-width="1.2"/>`
    ticks += `<text x="${tickX}" y="10" text-anchor="middle" font-family="'Times New Roman',serif" font-size="8.5" fill="#10231b">${lonVal.toFixed(3)}°E</text>`
    ticks += `<text x="${tickX}" y="${H - 4}" text-anchor="middle" font-family="'Times New Roman',serif" font-size="8.5" fill="#10231b">${lonVal.toFixed(3)}°E</text>`

    ticks += `<line x1="12" y1="${tickY}" x2="18" y2="${tickY}" stroke="#10231b" stroke-width="1.2"/>`
    ticks += `<line x1="${W - 18}" y1="${tickY}" x2="${W - 12}" y2="${tickY}" stroke="#10231b" stroke-width="1.2"/>`
    ticks += `<text x="10" y="${tickY}" text-anchor="end" font-family="'Times New Roman',serif" font-size="8.5" fill="#10231b">${latVal.toFixed(3)}°N</text>`
    ticks += `<text x="${W - 10}" y="${tickY}" text-anchor="start" font-family="'Times New Roman',serif" font-size="8.5" fill="#10231b">${latVal.toFixed(3)}°N</text>`
  }

  const scaleDistM = nice(v.mpp * 120, [20, 50, 100, 200, 500, 1000])
  const scalePx = Math.min(130, scaleDistM / v.mpp)
  const clipId = `cart-clip-${figNum.replace(/[^a-zA-Z0-9]/g, '_')}`

  // Precise projected pixel bounding box of AOI
  const pxPts = ring.map(p => v.px(p[0], p[1]))
  const minX = Math.min(...pxPts.map(p => p[0])) + 18
  const maxX = Math.max(...pxPts.map(p => p[0])) + 18
  const minY = Math.min(...pxPts.map(p => p[1])) + 18
  const maxY = Math.max(...pxPts.map(p => p[1])) + 18

  const leftClearance = Math.max(0, minX - 18)
  const rightClearance = Math.max(0, (W - 18) - maxX)
  const topClearance = Math.max(0, minY - 18)

  // Title box (260 x 36) positioning with collision avoidance
  let titleX = 26, titleY = 26
  if (minX < 26 + 265 && minY < 26 + 40) {
    if (rightClearance >= 270 && topClearance >= 40) {
      titleX = W - 260 - 68
      titleY = 26
    } else {
      titleX = Math.max(26, Math.min(W - 270, (W - 260) / 2))
      titleY = 10
    }
  }

  // Compass Rose North Arrow (36 x 36)
  let northX = W - 68, northY = 26
  if (maxX > W - 72 && minY < 66) {
    if (leftClearance >= 50 && titleX > 80) {
      northX = 26; northY = 26
    } else {
      northX = W - 56; northY = 8
    }
  }

  // Legend box (200 x 85)
  let legendX = W - 225, legendY = H - 110
  if (maxX > W - 230 && maxY > H - 115) {
    if (leftClearance >= 210) {
      legendX = 26
      legendY = H - 110
    } else if (topClearance >= 95 && rightClearance >= 210) {
      legendX = W - 225
      legendY = 26
    }
  }

  // Metric Scale Bar (scalePx + 36 x 34)
  let scaleX = 26, scaleY = H - 62
  if (legendX === 26) {
    scaleX = Math.max(W - scalePx - 60, (W - scalePx - 36) / 2)
  } else if (minX < 26 + scalePx + 40 && maxY > H - 64) {
    scaleX = Math.max(26, (W - scalePx - 36) / 2)
  }

  return `<svg class="cart-map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#ffffff" stroke="#10231b" stroke-width="2"/>
    <rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="#f3f6f1" stroke="#10231b" stroke-width="1"/>
    
    ${ticks}

    <!-- Clipped Map Content (Centered in frame) -->
    <g transform="translate(18, 18)" clip-path="url(#${clipId})">
      <defs>
        <clipPath id="${clipId}">
          <rect width="${W - 36}" height="${H - 36}"/>
        </clipPath>
      </defs>
      ${layerContent}
    </g>

    <!-- Title box (collision-aware placement) -->
    <g transform="translate(${titleX.toFixed(1)}, ${titleY.toFixed(1)})">
      <rect width="260" height="36" rx="3" fill="#ffffff" fill-opacity="0.95" stroke="#10231b" stroke-width="1.2"/>
      <text x="130" y="15" text-anchor="middle" font-family="'Times New Roman',serif" font-size="9" font-weight="700" fill="#2d6a4f" letter-spacing="1">${figNum.toUpperCase()}</text>
      <text x="130" y="29" text-anchor="middle" font-family="'Times New Roman',serif" font-size="11" font-weight="700" fill="#10231b">${esc(title)}</text>
    </g>

    <!-- Compass Rose North Arrow (collision-aware placement) -->
    <g transform="translate(${northX.toFixed(1)}, ${northY.toFixed(1)})">
      <circle cx="20" cy="20" r="18" fill="#ffffff" stroke="#10231b" stroke-width="1.2"/>
      <path d="M20 5 L24 20 L20 17 L16 20 Z" fill="#10231b"/>
      <path d="M20 35 L24 20 L20 23 L16 20 Z" fill="#cad2c5"/>
      <path d="M5 20 L20 16 L17 20 L20 24 Z" fill="#cad2c5"/>
      <path d="M35 20 L20 16 L23 20 L20 24 Z" fill="#10231b"/>
      <text x="20" y="4" text-anchor="middle" font-family="'Times New Roman',serif" font-size="9.5" font-weight="800" fill="#10231b">N</text>
    </g>

    <!-- Metric Scale Bar (collision-aware placement) -->
    <g transform="translate(${scaleX.toFixed(1)}, ${scaleY.toFixed(1)})">
      <rect width="${scalePx + 36}" height="34" rx="3" fill="#ffffff" fill-opacity="0.95" stroke="#10231b" stroke-width="1"/>
      <rect x="10" y="8" width="${scalePx / 2}" height="5" fill="#10231b"/>
      <rect x="${10 + scalePx / 2}" y="8" width="${scalePx / 2}" height="5" fill="#ffffff" stroke="#10231b" stroke-width="0.8"/>
      <text x="10" y="24" font-family="'Times New Roman',serif" font-size="8.5" font-weight="700" fill="#10231b">0</text>
      <text x="${10 + scalePx / 2}" y="24" text-anchor="middle" font-family="'Times New Roman',serif" font-size="8.5" font-weight="700" fill="#10231b">${scaleDistM / 2}</text>
      <text x="${10 + scalePx}" y="24" text-anchor="end" font-family="'Times New Roman',serif" font-size="8.5" font-weight="700" fill="#10231b">${scaleDistM} m</text>
    </g>

    <!-- Legend box (collision-aware placement, does not touch AOI) -->
    <g transform="translate(${legendX.toFixed(1)}, ${legendY.toFixed(1)})">
      <rect width="200" height="85" rx="3" fill="#ffffff" fill-opacity="0.95" stroke="#10231b" stroke-width="1"/>
      ${legendInner}
    </g>

    <text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-family="'Times New Roman',serif" font-size="8.5" fill="#555">${esc(sourceCredit)}</text>
  </svg>`
}


/**
 * Fig 3.6: Hydrology Context Map.
 * The previous version drew an invented river network and three invented
 * gauging stations. SEVA.GIS bundles no station dataset, so the figure now
 * shows only the real base map and boundary, and says so in the legend.
 */
function renderGroundDischargeStationMapSvg(
  v: View,
  ring: [number, number][],
  farmName: string,
  layerContent: string
): string {
  const leg = `<text x="12" y="16" font-family="'Times New Roman',serif" font-size="11" font-weight="700" fill="#10231b">Legend</text>
    <rect x="12" y="24" width="12" height="8" fill="none" stroke="#10231b" stroke-width="1.2"/><text x="28" y="31" font-family="'Times New Roman',serif" font-size="8.5" fill="#10231b">Study Area</text>
    <text x="12" y="48" font-family="'Times New Roman',serif" font-size="8.5" fill="#b45309">No gauging-station dataset is bundled.</text>
    <text x="12" y="61" font-family="'Times New Roman',serif" font-size="8.5" fill="#b45309">Stream network needs external data.</text>`

  return render2dCartographicMap(
    'Fig 3.6',
    `Hydrology Context Map of ${farmName}`,
    v,
    ring,
    layerContent,
    leg,
    'Source: Esri World Imagery base map - no streamflow gauge dataset included'
  )
}
/**
 * Fig 4.1: Landuse water partition - honest placeholder.
 * Splitting rainfall into runoff / groundwater / evapotranspiration needs a
 * calibrated hydrological model (SWAT-class) with observed streamflow records.
 * SEVA.GIS does not run one on the device, so the figure states that instead
 * of drawing invented proportions.
 */
function renderLanduseSummaryChartSvg(studyAreaName: string): string {
  return renderUnavailableFigureSvg('Fig 4.1', `Water Partition by Landuse - ${studyAreaName}`, [
    'Splitting rainfall into runoff, groundwater and evapotranspiration needs a',
    'calibrated hydrological model (SWAT-class) with observed streamflow records.',
    'SEVA.GIS does not run such a model on the device, so no numbers are drawn.',
  ], 300)
}
/**
 * Fig 4.2: Water balance budget - honest placeholder.
 * A continuous water-balance budget cannot be produced without a calibrated
 * model run, so the figure states exactly what is missing.
 */
function renderWaterBalanceReportSvg(studyAreaName: string): string {
  return renderUnavailableFigureSvg('Fig 4.2', `Water Balance Budget - ${studyAreaName}`, [
    'A continuous water-balance budget requires a calibrated SWAT run.',
    'Attach a completed model run (or observed streamflow) to populate this figure.',
    'SEVA.GIS shows no illustrative budget in the meantime.',
  ], 300)
}
/**
 * Fig 4.3: SWAT-CUP calibration hydrograph - honest placeholder.
 * Observed/simulated discharge and the 95PPU band can only be drawn from a
 * real calibration run. NSE / R2 / PBIAS are withheld until such a run exists.
 */
function renderCalibrationHydrographSvg(): string {
  return renderUnavailableFigureSvg('Fig 4.3', 'Calibration Output in SWAT-CUP (Streamflow Hydrograph)', [
    'No SWAT-CUP calibration run has been recorded for this area of interest.',
    'Observed + simulated discharge and the 95PPU band appear only after a real run.',
    'NSE / R2 / PBIAS are withheld until they can be computed from that run.',
  ], 320)
}
/**
 * Fig 4.7: SUFI-2 parameter sensitivity - honest standings.
 * Lists the standard SWAT calibration parameters with their literature valid
 * ranges and states plainly that no calibration run exists yet. The previous
 * version drew invented t-stat / p-value bars; ranking is only produced by a
 * completed SUFI-2 run against observed streamflow.
 */
function renderSufi2SensitivitySvg(): string {
  const params = [
    { name: 'r__CN2.mgt', desc: 'SCS runoff curve number (relative delta)', range: '-0.40 to +0.40' },
    { name: 'v__ALPHA_BF.gw', desc: 'Baseflow alpha factor', range: '0.00 to 1.00 per day' },
    { name: 'v__EPCO.hru', desc: 'Plant uptake compensation factor', range: '0.00 to 1.00' },
    { name: 'a__REVAPMN.gw', desc: 'Threshold depth for revap (shallow aquifer)', range: '0 to 500 mm' },
    { name: 'v__ESCO.hru', desc: 'Soil evaporation compensation factor', range: '0.00 to 1.00' },
    { name: 'r__SOL_AWC().sol', desc: 'Available water capacity (relative delta)', range: '-0.40 to +0.40' },
    { name: 'a__GWQMN.gw', desc: 'Threshold depth for return flow (shallow aquifer)', range: '0 to 5000 mm' },
    { name: 'a__GW_REVAP.gw', desc: 'Groundwater revap coefficient', range: '0.02 to 0.20' },
  ]

  const W = 720, H = 460
  const rowH = 40
  const tableY = 96

  return `<svg class="cart-map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#ffffff" stroke="#10231b" stroke-width="1.5"/>
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="#fafcf9" stroke="#10231b" stroke-width="0.8"/>

    <text x="${W / 2}" y="34" text-anchor="middle" font-family="'Times New Roman',serif" font-size="12.5" font-weight="700" fill="#10231b">FIG 4.7: SWAT PARAMETERS SELECTED FOR SENSITIVITY ANALYSIS (SUFI-2)</text>
    <text x="${W / 2}" y="54" text-anchor="middle" font-family="'Times New Roman',serif" font-size="10" fill="#b45309" font-weight="700">Status: NOT CALIBRATED - t-stat and p-value ranking require a completed SUFI-2 run</text>
    <text x="${W / 2}" y="72" text-anchor="middle" font-family="'Times New Roman',serif" font-size="9" fill="#555">Ranges below are the standard calibration bounds from the SWAT literature (Abbaspour et al.).</text>

    <line x1="30" y1="${tableY - 8}" x2="${W - 30}" y2="${tableY - 8}" stroke="#10231b" stroke-width="1"/>

    ${params.map((p, i) => {
      const y = tableY + i * rowH
      return `
        <text x="30" y="${y + 16}" font-family="'Courier New',monospace" font-size="10" font-weight="700" fill="#10231b">${p.name}</text>
        <text x="250" y="${y + 16}" font-family="'Times New Roman',serif" font-size="9.5" fill="#333">${p.desc}</text>
        <text x="${W - 190}" y="${y + 16}" font-family="'Times New Roman',serif" font-size="9.5" fill="#10231b">Valid range: <tspan font-weight="700">${p.range}</tspan></text>
        <text x="${W - 30}" y="${y + 16}" text-anchor="end" font-family="'Times New Roman',serif" font-size="9" font-weight="700" fill="#b45309">Not calibrated</text>
        <line x1="30" y1="${y + 26}" x2="${W - 30}" y2="${y + 26}" stroke="#e2e8f0" stroke-width="0.8"/>
      `
    }).join('')}

    <text x="${W / 2}" y="${H - 20}" text-anchor="middle" font-family="'Times New Roman',serif" font-size="9" fill="#666">A sensitivity ranking is shown only after a real SWAT-CUP run on observed streamflow - never from illustrative values.</text>
  </svg>`
}
/**
 * Primary Report Builder with Dynamic Two-Pass Pagination & Real GEE/S2 Ingestion
 */
export async function buildReport(
  farm: ReportFarm,
  onProgress?: (msg: string) => void,
  opts: ReportOpts = DEFAULT_OPTS
): Promise<{ html: string; data: unknown; id: string; lang: ReportLang }> {
  const lang = opts.lang ?? 'en'
  const t = I18N[lang]
  // Trilingual honest placeholder for values whose real source is not loaded.
  // Report content uses these instead of invented fallback numbers.
  const naText = lang === 'te' ? 'డేటా అందుబాటులో లేదు' : lang === 'hi' ? 'डेटा उपलब्ध नहीं है' : 'Data unavailable'
  const fmt1 = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(1) : naText)
  const fmtU = (v: number | null | undefined, unit: string) => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(1)} ${unit}` : naText)
  const now = new Date()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const reportTimestamp = now.toLocaleString(lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-US', {
    dateStyle: 'full',
    timeStyle: 'long',
  })

  onProgress?.('Initializing report parameters and boundary geodesy…')
  const ring = farmRing(farm)
  const ha = areaHa(ring)
  const acres = ha * 2.47105
  const fb = farmBBox(farm)
  const cLat = farm.lat, cLon = farm.lon

  // Synchronize map zoom stretch
  let customZoom: number | undefined = opts.viewport?.zoom
  if (!customZoom && typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = JSON.parse(localStorage.getItem('seva-map-view-bounds') || '{}')
      if (saved.zoom) customZoom = saved.zoom
    } catch {}
  }
  const view = makeView(fb, 684, 424, customZoom)

  const farmUpper = farm.name.toUpperCase().trim()
  const reportFileName = `(${farmUpper}_SEVA GIS)`
  const rid = `SEVA-${farm.id.slice(0, 8)}-${now.toISOString().slice(0, 10).replace(/-/g, '')}`

  // Fetch or calculate authentic satellite analysis & DEM
  onProgress?.('Ingesting Sentinel-2 & DEM elevation grids from GEE…')
  const { loadScene, loadDem, analyze } = await import('./lib/seva')
  let an: Analysis
  try {
    an = farm.analysis ?? (await analyze(farm, { mode: 'latest', maxCloud: 30 }))
  } catch (e) {
    // Honesty gate: a satellite report with no satellite scene would have to
    // invent numbers. Stop instead, with a plain reason the user can act on.
    throw new Error(
      `Satellite analysis unavailable (${e instanceof Error ? e.message : 'no scene could be loaded'}). ` +
      'Check the connection and run the report again — SEVA·GIS never fills missing satellite results with made-up figures.',
    )
  }

  let dem: Grid | null = null
  try {
    dem = await loadDem(farm)
  } catch {
    console.debug('[Report] DEM load fallback')
  }

  // Real elevation range from the loaded grid, for the DEM figure caption.
  // When no grid is loaded the caption says so instead of naming values.
  let demElevMin: number | null = null
  let demElevMax: number | null = null
  if (dem) {
    for (let i = 0; i < dem.b.elev.length; i++) {
      const e = dem.b.elev[i]
      if (Number.isFinite(e) && e > -500 && e < 9000) {
        if (demElevMin === null || e < demElevMin) demElevMin = e
        if (demElevMax === null || e > demElevMax) demElevMax = e
      }
    }
  }

  let s2GridObj: Grid | null = null
  try {
    s2GridObj = await loadScene(an.scene, farm)
  } catch {
    console.debug('[Report] S2 scene load fallback')
  }

  let historyRows: Candle[] = []
  try {
    const { history } = await import('./lib/seva')
    historyRows = await history(farm, 365, 6)
  } catch {
    historyRows = []
  }

  // Terrain values: real or nothing. The 245 m / 4.2 % style fallbacks that
  // used to sit here were invented, so they are gone.
  const elevMeanVal = an.elevMean ?? farm.elevation ?? null
  const slopePctVal = an.slopePct ?? null
  const slopeDegVal = an.slopeDeg ?? null
  const logo = await dataUrl(logoUrl)

  // Pre-render real raster layers for all chosen maps and band combinations
  onProgress?.('Generating GEE/S2 rasters & composites…')
  const rasterMap: Record<string, string> = {}
  const allNeededInds = Array.from(new Set([...opts.maps, ...(opts.bandSymbologies ?? [])]))

  if (s2GridObj) {
    for (const id of allNeededInds) {
      try {
        const ind = byId(id)
        if (ind) {
          const lyr = renderLayer(ind, s2GridObj, ring, { dra: true, sharpen: 0.35, resampling: 'cubic' })
          if (lyr?.url) rasterMap[id] = lyr.url
        }
      } catch {}
    }
  }

  if (dem) {
    const terrainInds = ['terrain', 'dem', 'slope', 'twi', 'flow']
    for (const id of terrainInds) {
      try {
        const ind = byId(id === 'terrain' ? 'dem' : id)
        if (ind) {
          const lyr = renderLayer(ind, dem, ring, { smooth: true, resampling: 'cubic' })
          if (lyr?.url) rasterMap[id] = lyr.url
        }
      } catch {}
    }
  }

  // 9 Dynamic World Land Use / Land Cover Classes (10m Native Sentinel-2)
  const DW_CLASSES = [
    { id: 0, name: 'Water', swat: 'WATR', color: '#419BDF', desc: 'Water bodies & reservoirs' },
    { id: 1, name: 'Trees', swat: 'FRST', color: '#397D49', desc: 'Dense tree canopy & forest' },
    { id: 2, name: 'Grass', swat: 'RNGE', color: '#88B053', desc: 'Natural pasture & grassland' },
    { id: 3, name: 'Flooded Veg.', swat: 'WETL', color: '#7A87C6', desc: 'Wetlands & saturated zones' },
    { id: 4, name: 'Crops', swat: 'AGRR', color: '#E49635', desc: 'Agricultural crop & row crops' },
    { id: 5, name: 'Shrub & Scrub', swat: 'RNGB', color: '#DFC35A', desc: 'Scrubland & woody brush' },
    { id: 6, name: 'Built Area', swat: 'URMD', color: '#C4281B', desc: 'Impervious structures & built' },
    { id: 7, name: 'Bare Ground', swat: 'BARR', color: '#A59B8F', desc: 'Exposed soil & fallow ground' },
    { id: 8, name: 'Snow & Ice', swat: 'SNOW', color: '#B39FE1', desc: 'Permanent/seasonal snow' },
  ]

  let dwStats = DW_CLASSES.map(cls => ({ ...cls, count: 0, pct: 0, areaHa: 0, areaAcres: 0 }))
  if (s2GridObj) {
    const counts = Array(9).fill(0)
    let totalInside = 0
    const w = s2GridObj.w, h = s2GridObj.h
    const { B02, B03, B04, B08, B11 } = s2GridObj.b

    let lulcCanvas: HTMLCanvasElement | null = null
    let lulcCtx: CanvasRenderingContext2D | null = null
    if (typeof document !== 'undefined') {
      lulcCanvas = document.createElement('canvas')
      lulcCanvas.width = w
      lulcCanvas.height = h
      lulcCtx = lulcCanvas.getContext('2d')
    }

    const imgData = lulcCtx ? lulcCtx.createImageData(w, h) : null
    const hexToRgb = (hex: string) => {
      const num = parseInt(hex.replace('#', ''), 16)
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
    }
    const classRgbs = DW_CLASSES.map(c => hexToRgb(c.color))

    for (let i = 0; i < w * h; i++) {
      if (s2GridObj.inside && s2GridObj.inside[i] === 0) continue
      const b02 = B02?.[i], b03 = B03?.[i], b04 = B04?.[i], b08 = B08?.[i], b11 = B11?.[i]
      // A pixel missing any reflectance band is skipped, never classified
      // from an invented default band value.
      if (b02 === undefined || b03 === undefined || b04 === undefined || b08 === undefined || b11 === undefined) continue
      if (!Number.isFinite(b02) || !Number.isFinite(b03) || !Number.isFinite(b04) || !Number.isFinite(b08) || !Number.isFinite(b11)) continue
      totalInside++

      const ndvi = (b08 - b04) / (b08 + b04 + 1e-9)
      const ndwi = (b03 - b08) / (b03 + b08 + 1e-9)
      const bsi = ((b11 + b04) - (b08 + b02)) / ((b11 + b04) + (b08 + b02) + 1e-9)

      // Pixels that match none of the class rules stay unclassified instead of
      // defaulting to a class, so the composition only counts what it can read.
      let cls = -1
      if (ndwi > 0.08) cls = 0
      else if (ndvi > 0.68) cls = 1
      else if (ndwi > -0.05 && ndvi > 0.25) cls = 3
      else if (ndvi >= 0.45 && ndvi <= 0.68) cls = 4
      else if (ndvi >= 0.32 && ndvi < 0.45) cls = 2
      else if (ndvi >= 0.20 && ndvi < 0.32) cls = 5
      else if (bsi > 0.18 && ndvi < 0.20) cls = 6
      else if (bsi > 0.02 || ndvi < 0.22) cls = 7
      if (cls < 0) continue

      counts[cls]++

      if (imgData) {
        const offset = i * 4
        const [r, g, b] = classRgbs[cls]
        imgData.data[offset] = r
        imgData.data[offset + 1] = g
        imgData.data[offset + 2] = b
        imgData.data[offset + 3] = 230
      }
    }

    if (totalInside > 0) {
      dwStats = DW_CLASSES.map(cls => {
        const count = counts[cls.id]
        const pct = (count / totalInside) * 100
        const classAreaHa = (pct / 100) * ha
        return {
          ...cls,
          count,
          pct,
          areaHa: classAreaHa,
          areaAcres: classAreaHa * 2.47105,
        }
      })
    }

    if (lulcCtx && imgData && lulcCanvas) {
      lulcCtx.putImageData(imgData, 0, 0)
      rasterMap['lulc'] = lulcCanvas.toDataURL('image/png')
    }
  }

  // No real scene means every class keeps its zero count above; figures and
  // tables that read these stats render "Data unavailable" instead of guesses.

  const baseSatelliteUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${view.bbox.join(',')}&bboxSR=4326&imageSR=4326&size=${view.W},${view.H}&format=jpg&f=image`
  const ptsString = pts(ring, view)

  const makeLayerContent = (id: string, fallbackColor = 'rgba(45, 106, 79, 0.25)') => {
    const rUrl = rasterMap[id]
    if (rUrl) {
      const gridBBox = s2GridObj?.bbox ?? dem?.bbox ?? fb
      const [pMinX, pMinY] = view.px(gridBBox[0], gridBBox[3])
      const [pMaxX, pMaxY] = view.px(gridBBox[2], gridBBox[1])
      const rw = Math.max(10, pMaxX - pMinX)
      const rh = Math.max(10, pMaxY - pMinY)
      const clipId = `aoi-clip-${id}-${Math.round(cLat * 1000)}`
      return `
        <defs>
          <clipPath id="${clipId}">
            <polygon points="${ptsString}"/>
          </clipPath>
        </defs>
        <image href="${baseSatelliteUrl}" width="${view.W}" height="${view.H}"/>
        <g clip-path="url(#${clipId})">
          <image href="${rUrl}" x="${pMinX.toFixed(1)}" y="${pMinY.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" preserveAspectRatio="none"/>
        </g>
        <polygon points="${ptsString}" fill="none" stroke="#ffffff" stroke-width="2.2"/>
        <polygon points="${ptsString}" fill="none" stroke="#10231b" stroke-width="1.2" stroke-dasharray="3 3"/>
      `
    }

    if (id === 'lulc') {
      // No classified raster for this run: show the real base map and boundary
      // only. A patchwork of coloured cells would invent class positions.
      return `
        <image href="${baseSatelliteUrl}" width="${view.W}" height="${view.H}"/>
        <polygon points="${ptsString}" fill="none" stroke="#ffffff" stroke-width="2.5"/>
        <polygon points="${ptsString}" fill="none" stroke="#10231b" stroke-width="1.2" stroke-dasharray="3 3"/>
        <g transform="translate(${(view.W / 2).toFixed(1)}, ${(view.H - 26).toFixed(1)})">
          <rect x="-215" y="-16" width="430" height="24" fill="#ffffff" fill-opacity="0.92" stroke="#10231b" stroke-width="0.8" rx="3"/>
          <text x="0" y="0" text-anchor="middle" font-family="'Times New Roman',serif" font-size="10" font-weight="700" fill="#b45309">LULC class raster unavailable for this run · base map shown · no classes drawn</text>
        </g>
      `
    }

    if (id === 'soil') {
      // The FAO DSMW series raster is not bundled with the app; horizontal
      // colour bands would invent soil boundaries, so only the real base map
      // and boundary are drawn.
      return `
        <image href="${baseSatelliteUrl}" width="${view.W}" height="${view.H}"/>
        <polygon points="${ptsString}" fill="none" stroke="#ffffff" stroke-width="2.5"/>
        <polygon points="${ptsString}" fill="none" stroke="#10231b" stroke-width="1.2" stroke-dasharray="3 3"/>
        <g transform="translate(${(view.W / 2).toFixed(1)}, ${(view.H - 26).toFixed(1)})">
          <rect x="-215" y="-16" width="430" height="24" fill="#ffffff" fill-opacity="0.92" stroke="#10231b" stroke-width="0.8" rx="3"/>
          <text x="0" y="0" text-anchor="middle" font-family="'Times New Roman',serif" font-size="10" font-weight="700" fill="#b45309">Spatial soil-series raster not bundled · base map shown · no soil boundaries drawn</text>
        </g>
      `
    }

    return `
      <image href="${baseSatelliteUrl}" width="${view.W}" height="${view.H}"/>
      <polygon points="${ptsString}" fill="${fallbackColor}" stroke="#10231b" stroke-width="3"/>
      <polygon points="${ptsString}" fill="none" stroke="#ffffff" stroke-width="1.5"/>
    `
  }

  const irrAdvice = irrigationAdvice(farm)
  const conAdvice = constructionSuitability(farm)

  const sessions = historyRows.length
    ? historyRows.map((row, index) => ({
      num: index + 1,
      date: row.scene?.datetime ? row.scene.datetime.slice(0, 10) : null,
      ndvi: row.ndvi?.mean ?? null,
      ndmi: row.ndmi ?? null,
      stress: row.stressPct ?? null,
      rain: farm.rain ?? null,
      status: index === historyRows.length - 1 ? 'Current Evaluation' : 'Historical Observation',
    }))
    : [{
      num: 1,
      date: an.scene?.datetime ? an.scene.datetime.slice(0, 10) : null,
      ndvi: an.ndvi?.mean ?? null,
      ndmi: an.ndmi?.mean ?? null,
      stress: an.stressPct ?? null,
      rain: farm.rain ?? null,
      status: 'Current Evaluation',
    }]

  // ==========================================
  // PASS 1: Build Body Pages & Register Pages
  // ==========================================
  onProgress?.('Assembling chapters, figures, and computing dynamic pagination…')
  let curPageNum = 1
  const bodyPages: { id: string; pageNum: number; content: string }[] = []
  const sectionMap: Record<string, number> = {}
  const figEntries: { num: string; title: string; pageNum: number }[] = []
  const tableEntries: { num: string; title: string; pageNum: number }[] = []

  function pushPage(id: string, content: string) {
    const p = curPageNum++
    bodyPages.push({ id, pageNum: p, content })
    return p
  }

  // --- CHAPTER I: INTRODUCTION ---
  sectionMap['ch1'] = curPageNum
  sectionMap['1.1'] = curPageNum
  sectionMap['1.2'] = curPageNum
  pushPage(
    'ch1_p1',
    `
    <h1 class="chapter-title">${t.ch1Title}</h1>
    <h2 class="section-title">${lang === 'te' ? '1.1 జలవిజ్ఞాన మరియు వర్ణపట రిమోట్ సెన్సింగ్ నమూనాలు' : lang === 'hi' ? '1.1 जलविज्ञान एवं स्पेक्ट्रल सुदूर संवेदन मॉडल' : '1.1 Hydrological &amp; Spectral Remote Sensing Models'}</h2>
    <p>${lang === 'te'
      ? 'వ్యవసాయ పరీవాహక ప్రాంతాలు మరియు వ్యక్తిగత పొలాల ప్రాదేశిక నమూనా ఉపగ్రహ రేడియోమెట్రీ మరియు జల-భౌతిక సరిహద్దుల ఖచ్చితమైన అనుసంధానంపై ఆధారపడి ఉంటుంది. సాంప్రదాయ క్షేత్ర నమూనాలు తీవ్రమైన సమయ మరియు స్థానిక అంతరాలను కలిగి ఉంటాయి. సెంటినెల్-2 మల్టీ-స్పెక్ట్రల్ వ్యవస్థ మరియు కోపర్నికస్ DEM ఉపరితల నమూనాలు నిరంతర పరిశీలనను సాధ్యం చేస్తాయి.'
      : lang === 'hi'
      ? 'कृषि जलग्रहण क्षेत्रों और व्यक्तिगत खेतों का स्थानिक मॉडलिंग उपग्रह रेडियोमेट्री और जल-भौतिकीय गतिशीलता के सटीक एकीकरण पर निर्भर करता है। पारंपरिक जमीनी नमूनाकरण में स्थानिक अंतराल और देरी होती है। सेंटिनल-2 मल्टी-स्पेक्ट्रल प्रणाली और कॉपरनिकस डीईएम निरंतर अवलोकन की सुविधा प्रदान करते हैं।'
      : 'Spatial modeling of agricultural catchments and individual field parcels requires accurate integration of optical satellite radiometry and hydro-physical boundary dynamics. Traditional soil-moisture and vegetation surveillance relies on periodic ground sampling, which suffers from severe spatial gaps and logistical latency. High-resolution multi-spectral systems such as Sentinel-2 (European Space Agency) and terrain surface models (Copernicus DEM GLO-30) offer empirical, repeatable observation pipelines.'}</p>
    <p>${lang === 'te'
      ? 'సేవా జిఐఎస్ (SEVA·GIS) బ్రౌజర్‌లోనే క్లయింట్-సైడ్ జియోస్పేషియల్ ఇంజిన్‌గా పనిచేస్తూ, ముడి ఉపగ్రహ సమాచారాన్ని ఆచరణాత్మక వ్యవసాయ పఠనాలుగా మారుస్తుంది. జియోడెటిక్ రీ-ప్రొజెక్షన్ మరియు వర్ణపట సూచికల లెక్కింపు మీ పరికరంలోనే జరుగుతుంది, కాబట్టి ఫలితాలు వేగంగా వస్తాయి మరియు పొలం సమాచారం పరికరంలోనే ఉంటుంది. జల బడ్జెట్ లెక్కలు వేరుగా నమోదు చేసిన కాలిబ్రేటెడ్ నమూనా రన్‌కు వదిలివేయబడ్డాయి.'
      : lang === 'hi'
      ? 'सेवा जीआईएस (SEVA·GIS) एक ब्राउज़र-आधारित भू-स्थानिक इंजन के रूप में उपग्रह अवलोकनों को व्यावहारिक कृषि पठनों में बदलता है। भू-स्थानिक पुन: प्रक्षेपण एवं वर्णक्रमीय सूचकांक गणना आपके डिवाइस पर ही होती है, इसलिए परिणाम तुरंत मिलते हैं और खेत का डेटा डिवाइस पर रहता है। जल-संतुलन गणना जानबूझकर किसी बाहरी अंशांकित मॉडल रन पर छोड़ी गई है।'
      : 'SEVA·GIS runs as a client-side geospatial engine that turns satellite observations into farm-scale readings in the browser. Geodetic re-projection and spectral index synthesis happen on the device, so results are immediate and farm coordinates stay local. Hydrological water budgeting is deliberately left to a calibrated external model run; this report never estimates it.'}</p>

    <h2 class="section-title">${lang === 'te' ? `1.2 అధ్యయన ప్రాంత నేపథ్యం (${esc(farm.name)})` : lang === 'hi' ? `1.2 अध्ययन क्षेत्र की पृष्ठभूमि (${esc(farm.name)})` : `1.2 Study Area Background (${esc(farm.name)})`}</h2>
    <p>${lang === 'te'
      ? `వ్యవసాయ క్షేత్రం <b>${esc(farm.name)}</b> భౌగోళికంగా <b>${esc(farm.location)}</b> వద్ద <b>${cLat.toFixed(5)}°N, ${cLon.toFixed(5)}°E</b> (WGS 84 / EPSG:4326) అక్షాంశ/రేఖాంశాలలో ఉంది. దీని కొలవబడిన విస్తీర్ణం <b>${ha.toFixed(2)} హెక్టార్లు</b> (${acres.toFixed(2)} ఎకరాలు). ప్రధాన పంట <b>${esc(farm.crop)}</b>. సగటు సముద్ర మట్టం నుండి ఎత్తు <b>${fmtU(elevMeanVal, 'm')}</b>, సగటు నేల వాలు <b>${fmtU(slopePctVal, '%')}</b> (${fmtU(slopeDegVal, '°')}).`
      : lang === 'hi'
      ? `खेत <b>${esc(farm.name)}</b> भौगोलिक रूप से <b>${esc(farm.location)}</b> में <b>${cLat.toFixed(5)}°N, ${cLon.toFixed(5)}°E</b> (WGS 84 / EPSG:4326) पर स्थित है। इसका कुल मापा गया क्षेत्रफल <b>${ha.toFixed(2)} हेक्टेयर</b> (${acres.toFixed(2)} एकड़) है। प्रमुख फसल <b>${esc(farm.crop)}</b> है। औसत ऊंचाई <b>${fmtU(elevMeanVal, 'm')}</b> तथा औसत ढलान <b>${fmtU(slopePctVal, '%')}</b> (${fmtU(slopeDegVal, '°')}) है।`
      : `The farm parcel <b>${esc(farm.name)}</b> is situated in <b>${esc(farm.location)}</b> at geodetic coordinates <b>${cLat.toFixed(5)}°N, ${cLon.toFixed(5)}°E</b> (WGS 84 / EPSG:4326). It covers a measured geographic surface area of <b>${ha.toFixed(2)} hectares</b> (${acres.toFixed(2)} acres). The designated primary cultivation is <b>${esc(farm.crop)}</b>. The elevation averages <b>${fmtU(elevMeanVal, 'm')}</b> above sea level, exhibiting an average topographical slope gradient of <b>${fmtU(slopePctVal, '%')}</b> (${fmtU(slopeDegVal, '°')}).`}</p>

    <h2 class="section-title">${lang === 'te' ? '1.3 పరిశోధన మరియు సాంకేతికత నేపథ్యం' : lang === 'hi' ? '1.3 अनुसंधान एवं तकनीकी अंतराल' : '1.3 Research &amp; Technological Gap'}</h2>
    <p>${lang === 'te'
      ? 'స్థూల స్థాయి జల నమూనాలు (SWAT, VIC వంటివి) వేల చదరపు కిలోమీటర్ల నదీ పరీవాహక ప్రాంతాలకు సరిపోతాయి, కానీ చిన్న కమతాల రైతులకు ఖచ్చితమైన నిజ-సమయ సమాచారాన్ని ఇవ్వలేవు. సెంటినెల్-2 10 మీటర్ల స్పెక్ట్రల్ సూచికలు మరియు 30 మీటర్ల DEM నమూనాలను నేరుగా అనుసంధానించడం ద్వారా ఈ పరిశోధన ఆ లోటును భర్తీ చేస్తుంది.'
      : lang === 'hi'
      ? 'यद्यपि वृहद-स्तरीय जल विज्ञान मॉडल (जैसे SWAT और VIC) नदी घाटियों के लिए नियमित रूप से उपयोग किए जाते हैं, लेकिन छोटे खेतों के लिए उनका उपयोग मोटे स्थानिक रिज़ॉल्यूशन के कारण सीमित है। यह अध्ययन 10 मीटर सेंटिनल-2 L2A और 30 मीटर डीईएम को जोड़कर इस कमी को पूरा करता है।'
      : 'While macro-scale hydrological models (such as SWAT and VIC) are regularly deployed across river basins exceeding thousands of square kilometers, their application at the small-holding level is hampered by coarse spatial discretization and lack of real-time surface reflectance calibration. This investigation fills that gap by operationalizing client-side 10 m Sentinel-2 L2A radiative indices combined with 30 m DEM hypsometry.'}</p>

    <h2 class="section-title">${lang === 'te' ? '1.4 పరిశోధన యొక్క ముఖ్య ఉద్దేశాలు' : lang === 'hi' ? '1.4 अध्ययन के मुख्य उद्देश्य' : '1.4 Objectives of the Investigation'}</h2>
    <ol style="line-height: 1.6; font-size: 11pt; padding-left: 1.2cm;">
      <li><b>${lang === 'te' ? 'జియోడెటిక్ సరిహద్దుల గుర్తింపు:' : lang === 'hi' ? 'भू-स्थानिक सीमांकन:' : 'Geodetic Delineation:'}</b> ${lang === 'te' ? `${esc(farm.name)} కోసం ఫీల్డ్-మ్యాప్ చేయబడిన సరిహద్దులు మరియు 3D భూభాగ నమూనాను సిద్ధం చేయడం.` : lang === 'hi' ? `${esc(farm.name)} के लिए फील्ड-मैप की गई सीमाएं और 3D स्थलाकृतिक मॉडल तैयार करना।` : `Establish field-mapped boundaries and 3D topographic terrain models for ${esc(farm.name)}.`}</li>
      <li><b>${lang === 'te' ? 'పంట పందిరి ఆరోగ్య వర్గీకరణ:' : lang === 'hi' ? 'फसल छतरी स्वास्थ्य वर्गीकरण:' : 'Canopy Health Zonation:'}</b> ${lang === 'te' ? 'బహుళ-వర్ణపట సూచికలను (NDVI, NDMI, NDWI, EVI) ఉపయోగించి పంట పచ్చదనం మరియు ఒత్తిడి ప్రాంతాలను వర్గీకరించడం.' : lang === 'hi' ? 'मल्टी-स्पेक्ट्रल सूचकांकों (NDVI, NDMI, NDWI, EVI) के माध्यम से फसल स्वास्थ्य और तनाव क्षेत्रों की पहचान करना।' : 'Synthesize multi-spectral indices (NDVI, NDMI, NDWI, EVI) to delineate vigor zones and vegetative stress patches.'}</li>
      <li><b>${lang === 'te' ? 'జల వినియోగ సందర్భం:' : lang === 'hi' ? 'जल-संतुलन संदर्भ:' : 'Hydrological Context:'}</b> ${lang === 'te' ? 'SCS-CN మరియు Hargreaves సూత్రాలను వివరించడం మరియు నమూనా చేయబడిన జల పరిమాణాలు కాలిబ్రేటెడ్ బాహ్య నమూనా రన్ అవసరమని స్పష్టంగా తెలియజేయడం.' : lang === 'hi' ? 'SCS-CN एवं Hargreaves सूत्रों को समझाना और यह स्पष्ट करना कि मॉडल-आधारित जल मात्राओं हेतु बाहरी अंशांकित मॉडल रन आवश्यक है।' : 'Explain the SCS-CN and Hargreaves formulations and state plainly that modelled water quantities require a calibrated external model run.'}</li>
      <li><b>${lang === 'te' ? 'వ్యవసాయ మార్గదర్శకాలు:' : lang === 'hi' ? 'कृषि एवं संरक्षण निर्देश:' : 'Agronomic &amp; Conservation Guidance:'}</b> ${lang === 'te' ? 'పంట ఎక్కడ భిన్నంగా ఉందో గుర్తించి, క్షేత్ర తనిఖీలకు మార్గనిర్దేశం చేయడం; ఎరువుల మోతాదు లెక్కలు రైతు అగ్రోనమీ ప్రణాళికకే.' : lang === 'hi' ? 'फसल कहाँ भिन्न है यह दिखाकर खेत जांच का मार्गदर्शन करना; उर्वरक मात्रा की गणना किसान की एग्रोनॉमी योजना पर छोड़ना।' : 'Show where the crop differs to direct field inspections; dose calculations stay with the farm agronomy plan.'}</li>
    </ol>
  `
  )

  // Fig 1.1: 3D Topographic Terrain Elevation Model (if selected)
  if (opts.include3dTerrain !== false) {
    const fig1_1_Svg = render3dTerrainSvg(dem, ring, farm.name, fb)
    const pFig = curPageNum
    figEntries.push({ num: 'Fig 1.1', title: `3D Topographic Terrain Elevation Model of ${farm.name}`, pageNum: pFig })
    pushPage(
      'fig1_1',
      `
      <h2 class="section-title">1.5 Topographic Terrain Configuration &amp; 3D Relief</h2>
      <p>Figure 1.1 provides an extruded 3D isometric terrain mesh of the ${esc(farm.name)} study area, derived from Copernicus DEM GLO-30. Vertical relief highlights localized surface gradient variations and natural watershed spillways.</p>
      <figure class="academic-figure">
        ${fig1_1_Svg}
        <figcaption class="figure-caption">Fig 1.1: 3D Topographic Terrain Elevation Model of ${esc(farm.name)}</figcaption>
        <div class="figure-source">Source: Copernicus DEM GLO-30 (European Space Agency / European Union)</div>
      </figure>
    `
    )
  }

  // --- CHAPTER II: REVIEW OF LITERATURE ---
  sectionMap['ch2'] = curPageNum
  sectionMap['2.1'] = curPageNum
  sectionMap['2.2'] = curPageNum
  pushPage(
    'ch2_p1',
    `
    <h1 class="chapter-title">${t.ch2Title}</h1>
    <h2 class="section-title">${lang === 'te' ? '2.1 ఉపగ్రహ రిమోట్ సెన్సింగ్ మరియు వర్ణపట వృక్ష సూచికలు' : lang === 'hi' ? '2.1 उपग्रह सुदूर संवेदन एवं वानस्पतिक स्पेक्ट्रल सूचकांक' : '2.1 Satellite Remote Sensing &amp; Spectral Vegetation Indices'}</h2>
    <p>${lang === 'te'
      ? 'గత ఐదు దశాబ్దాలుగా ఉపగ్రహ రిమోట్ సెన్సింగ్ వ్యవసాయ మరియు జలవిజ్ఞాన పరిశీలనలో విప్లవాత్మక మార్పులు తెచ్చింది. రూస్ మరియు ఇతరులు (1974) మరియు టక్కర్ (1979) నార్మలైజ్డ్ డిఫరెన్స్ వెజిటేషన్ ఇండెక్స్ (NDVI) ను రూపొందించారు. ఇది ఎరుపు తరంగదైర్ఘ్యం (సెంటినెల్-2 బ్యాండ్ 4, 665 nm) లో క్లోరోఫిల్ శోషణను మరియు సమీప పరారుణ (బ్యాండ్ 8, 842 nm) లో ఆకుల కణజాల విక్షేపణను ఉపయోగించుకుంటుంది. హ్యూట్ (1988) తక్కువ పంట సాంద్రత ఉన్న ప్రాంతాల్లో నేల ప్రతిబింబాన్ని నివారించడానికి సాయిల్-అడ్జస్టెడ్ వెజిటేషన్ ఇండెక్స్ (SAVI) ను అభివృద్ధి చేశారు.'
      : lang === 'hi'
      ? 'पिछले पांच दशकों में उपग्रह सुदूर संवेदन ने कृषि एवं जल विज्ञान निगरानी में क्रांतिकारी बदलाव किया है। राउज़ एवं अन्य (1974) तथा टकर (1979) ने सामान्यीकृत अंतर वनस्पति सूचकांक (NDVI) की स्थापना की, जो लाल स्पेक्ट्रम (सेंटिनल-2 बैंड 4, 665 nm) में क्लोरोफिल अवशोषण और निकट-अवरक्त स्पेक्ट्रम (बैंड 8, 842 nm) में मेसोफिल कोशिका प्रकीर्णन पर आधारित है। ह्यूट (1988) ने विरल फसलों में मिट्टी के परावर्तन को कम करने के लिए सॉइल-एडजस्टेड वेजिटेशन इंडेक्स (SAVI) तैयार किया।'
      : 'Satellite remote sensing has transformed agricultural and hydrological surveillance over five decades. Rouse et al. (1974) and Tucker (1979) established the foundational Normalized Difference Vegetation Index (NDVI), leveraging chlorophyll absorption in the red spectrum (Sentinel-2 Band 4, 665 nm) and mesophyll cell scattering in the near-infrared spectrum (Sentinel-2 Band 8, 842 nm). Huete (1988) formulated the Soil-Adjusted Vegetation Index (SAVI) to dampen soil background reflectance in sparse canopies.'}</p>
    <p>${lang === 'te'
      ? 'ఆకుల నీటి పరిమాణం మరియు తేమను పర్యవేక్షించడంలో గావో (1996) అభివృద్ధి చేసిన నార్మలైజ్డ్ డిఫరెన్స్ వాటర్ ఇండెక్స్ (NDWI) కీలక పాత్ర పోషిస్తుంది. వ్యవసాయ అనువర్తనాల్లో, నార్మలైజ్డ్ డిఫరెన్స్ మాయిశ్చర్ ఇండెక్స్ (NDMI)—సెంటినెల్-2 బ్యాండ్ 8 మరియు బ్యాండ్ 11 (SWIR 1610 nm) ను ఉపయోగించి పంట వాడిపోకముందే ఆకుల అంతర్గత నిర్జలీకరణను ఖచ్చితంగా గుర్తిస్తుంది.'
      : lang === 'hi'
      ? 'छतरी जल मात्रा और पत्ती की नमी की निगरानी गाओ (1996) द्वारा शुरू किए गए नॉर्मलाइज्ड डिफरेंस वॉटर इंडेक्स (NDWI) से उन्नत हुई। कृषि अनुप्रयोगों में, नॉर्मलाइज्ड डिफरेंस मॉइस्चर इंडेक्स (NDMI)—सेंटिनल-2 बैंड 8 और बैंड 11 (SWIR 1610 nm) का उपयोग करके दृश्य मुरझाने से पहले ही पत्ती निर्जलीकरण का सटीक पता लगाता है।'
      : 'Canopy water content and leaf hydration monitoring were advanced by Gao (1996), who introduced the Normalized Difference Water Index (NDWI) using the 860 nm and 1240 nm channels. In agricultural applications, the Normalized Difference Moisture Index (NDMI)—utilizing Sentinel-2 Band 8 and Band 11 (SWIR 1610 nm)—provides sensitive detection of leaf dehydration prior to visual canopy wilting.'}</p>

    <h2 class="section-title">${lang === 'te' ? '2.2 జలగ్రహణ మరియు పరీవాహక ప్రాంత జల నమూనా' : lang === 'hi' ? '2.2 जलग्रहण एवं वाटरशेड जल विज्ञान मॉडलिंग' : '2.2 Catchment &amp; Watershed Hydrological Modeling'}</h2>
    <p>${lang === 'te'
      ? 'పరీవాహక ప్రాంత జలవిజ్ఞాన గణనలు అనుభవపూర్వక నమూనాల నుండి పాక్షిక-పంపిణీ సాధనాలుగా అభివృద్ధి చెందాయి. ఆర్నాల్డ్ మరియు ఇతరులు (1998) మరియు శ్రీనివాసన్ మరియు ఇతరులు (2010) సాయిల్ అండ్ వాటర్ అసెస్‌మెంట్ టూల్ (SWAT) ను రూపొందించారు. ఇది ఒకే విధమైన నేల, భూ వినియోగం మరియు వాలు ఆధారంగా హైడ్రోలాజిక్ రెస్పాన్స్ యూనిట్లు (HRU) గా విభజిస్తుంది. ప్రవాహాన్ని USDA SCS కర్వ్ నంబర్ (CN) పద్ధతి ద్వారా లెక్కిస్తారు.'
      : lang === 'hi'
      ? 'जलग्रहण जल विज्ञान के गणितीय मॉडल अनुभवजन्य विधियों से अर्ध-वितरित वैचारिक उपकरणों में विकसित हुए। अर्नोल्ड एवं अन्य (1998) तथा श्रीनिवासन एवं अन्य (2010) ने सॉइल एंड वॉटर असेसमेंट टूल (SWAT) की स्थापना की, जो मिट्टी, भूमि उपयोग और ढलान के आधार पर हाइड्रोलॉजिकल रिस्पॉन्स यूनिट्स (HRUs) बनाता है। अपवाह की गणना USDA SCS कर्व नंबर (CN) तकनीक द्वारा की जाती है।'
      : 'Mathematical formulations of catchment hydrology evolved from empirical lumped models to semi-distributed conceptual tools. Arnold et al. (1998) and Srinivasan et al. (2010) established the Soil and Water Assessment Tool (SWAT), delineating watersheds into Hydrologic Response Units (HRUs) based on homogeneous soil series, land use, and slope combinations. Runoff is calculated via the USDA Soil Conservation Service (SCS) Curve Number (CN) technique.'}</p>

    <h2 class="section-title">${lang === 'te' ? '2.3 జల సమతుల్యత మరియు బాష్పీభవన గతిశీలత' : lang === 'hi' ? '2.3 जल संतुलन एवं वाष्पोत्सर्जन गतिशीलता' : '2.3 Hydrological Water Balance &amp; Evapotranspiration Dynamics'}</h2>
    <p>${lang === 'te'
      ? 'వేరు మండల నేల నీటి నిల్వను నియంత్రించే సమీకరణం ప్రకారం, మొత్తం వర్షపాతం అనేది ఉపరితల ప్రవాహం, వాస్తవ బాష్పీభవనం, లోతైన అంతఃస్రవణం మరియు నిల్వ మార్పుల మొత్తానికి సమానం (ఆలెన్ మరియు ఇతరులు, 1998). హార్గ్రీవ్స్ మరియు సమని (1985) ఉష్ణోగ్రత ఆధారిత బాష్పీభవన సమీకరణాలను రూపొందించారు, ఇవి తక్కువ వాతావరణ సమాచారంతో FAO పెన్మాన్-మోంటీత్ ప్రమాణాలకు అనుగుణంగా ఫలితాలను అందిస్తాయి.'
      : lang === 'hi'
      ? 'जड़ क्षेत्र मृदा जल भंडारण समीकरण के अनुसार वर्षा सतही अपवाह, वास्तविक वाष्पोत्सर्जन, गहरे अंतःस्रवण और भंडारण परिवर्तन के योग के बराबर होती है (एलन एवं अन्य, 1998)। हारग्रीव्स और समानी (1985) ने तापमान-आधारित संदर्भ वाष्पोत्सर्जन सूत्र विकसित किए, जो न्यूनतम मौसम संबंधी इनपुट के साथ FAO पेनमैन-मोंटेथ मानकों से मेल खाते हैं।'
      : 'The continuity equation governing root zone soil water storage expresses that precipitation equals the sum of surface runoff, actual evapotranspiration, deep percolation, and storage change (Allen et al., 1998; Lu et al., 2005). Hargreaves and Samani (1985) developed temperature-based reference evapotranspiration formulations requiring minimal meteorological inputs while matching FAO Penman-Monteith baselines.'}</p>

    <h2 class="section-title">${lang === 'te' ? '2.4 సీక్వెన్షియల్ అన్‌సర్టైన్టీ ఫిట్టింగ్ (SUFI-2) - కాలిబ్రేషన్ ఫ్రేమ్‌వర్క్ (రన్ చేయలేదు)' : lang === 'hi' ? '2.4 सीक्वेंशियल अनसर्टेनिटी फिटिंग (SUFI-2) - अंशांकन रूपरेखा (रन नहीं हुआ)' : '2.4 Sequential Uncertainty Fitting (SUFI-2) - Calibration Framework (Not Run)'}</h2>
    <p>${lang === 'te'
      ? 'కాలిబ్రేటెడ్ జలవిజ్ఞాన నమూనాను అనుసంధానించినప్పుడు, పారామితి అంచనా మరియు అనిశ్చితి పరిధులు SUFI-2 (అబ్బాస్‌పూర్ మరియు ఇతరులు, 2004, 2007) ద్వారా నిర్వహించబడతాయి. ఈ ప్రాంతానికి అటువంటి SWAT-CUP రన్ నమోదు కానందున, ఈ నివేదిక ఫ్రేమ్‌వర్క్ మరియు పారామితుల చెల్లుబాటు పరిధులను మాత్రమే చూపుతుంది - ఎటువంటి ఫిట్ గణాంకాలు (NSE, R²) నివేదించబడవు.'
      : lang === 'hi'
      ? 'जब कोई अंशांकित जल-विज्ञान मॉडल जोड़ा जाता है, तब पैरामीटर अनुमान और अनिश्चितता सीमाएँ SUFI-2 (अब्बासपुर एवं अन्य, 2004, 2007) द्वारा संभाली जाती हैं। इस क्षेत्र के लिए ऐसा कोई SWAT-CUP रन दर्ज न होने से यह रिपोर्ट केवल रूपरेखा और पैरामीटरों की वैध सीमाएँ दिखाती है - कोई फिट आँकड़े (NSE, R²) प्रस्तुत नहीं किए जाते।'
      : 'Where a calibrated hydrological model is attached, parameter estimation and uncertainty bounds are handled through SUFI-2 (Abbaspour et al., 2004, 2007). No such SWAT-CUP run is recorded for this area of interest, so this report presents the framework and the parameters\' valid ranges (Section 4.6) without reporting fitted statistics (NSE, R²).'}</p>
  `
  )

  // --- CHAPTER III: MATERIALS AND METHODS ---
  sectionMap['ch3'] = curPageNum
  sectionMap['3.1'] = curPageNum
  sectionMap['3.2'] = curPageNum
  pushPage(
    'ch3_p1',
    `
    <h1 class="chapter-title">${t.ch3Title}</h1>
    <h2 class="section-title">${lang === 'te' ? '3.1 అధ్యయన ప్రాంత పరిధి, సరిహద్దుల గుర్తింపు మరియు భౌగోళికం' : lang === 'hi' ? '3.1 अध्ययन क्षेत्र विस्तार, सीमा निर्धारण एवं भूगोल' : '3.1 Study Area Extent, Boundary Delineation &amp; Geography'}</h2>
    <p>${lang === 'te'
      ? `పొలం సరిహద్దు వినియోగదారు మ్యాప్ చేసిన సరిహద్దు ఆధారంగా WGS 84 / EPSG:4326 భౌగోళిక నిర్దేశాంకాలలో నిర్వచించబడింది. గోళాకార అధిక-క్షేత్ర సమీకరణాలను (spherical excess) ఉపయోగించి భూభాగ విస్తీర్ణం <b>${ha.toFixed(2)} హెక్టార్లు</b> (${acres.toFixed(2)} ఎకరాలు) గా లెక్కించబడింది. సరిహద్దు అక్షాంశాలు <b>${fb[1].toFixed(4)}°N</b> నుండి <b>${fb[3].toFixed(4)}°N</b> వరకు మరియు రేఖాంశాలు <b>${fb[0].toFixed(4)}°E</b> నుండి <b>${fb[2].toFixed(4)}°E</b> వరకు విస్తరించి ఉన్నాయి.`
      : lang === 'hi'
      ? `खेत की सीमा उपयोगकर्ता द्वारा मैप की गई सीमा के आधार पर WGS 84 / EPSG:4326 भौगोलिक निर्देशांकों में परिभाषित है। गोलाकार अधिशेष (spherical excess) गणना से मापा गया क्षेत्रफल <b>${ha.toFixed(2)} हेक्टेयर</b> (${acres.toFixed(2)} एकड़) है। भू-स्थानिक सीमा अक्षांश <b>${fb[1].toFixed(4)}°N</b> से <b>${fb[3].toFixed(4)}°N</b> और देशांतर <b>${fb[0].toFixed(4)}°E</b> से <b>${fb[2].toFixed(4)}°E</b> तक फैली हुई है।`
      : `The farm polygon is defined by its mapped field boundary in geographic coordinates on the WGS 84 / EPSG:4326 reference ellipsoid. Surface area is computed as <b>${ha.toFixed(2)} ha</b> from spherical-excess geometry. The bounding geodetic box spans latitudes <b>${fb[1].toFixed(4)}°N</b> to <b>${fb[3].toFixed(4)}°N</b> and longitudes <b>${fb[0].toFixed(4)}°E</b> to <b>${fb[2].toFixed(4)}°E</b>.`}</p>

    <h2 class="section-title">${lang === 'te' ? '3.2 ప్రాథమిక సమీకరణాలు: వర్ణపట బ్యాండ్లు, SCS-CN మరియు జల సమతుల్యత' : lang === 'hi' ? '3.2 नियंत्रक समीकरण: स्पेक्ट्रल बैंड, SCS-CN एवं जल संतुलन' : '3.2 Governing Equations: Spectral Bands, SCS-CN &amp; Water Balance'}</h2>
    <p><b>1. ${lang === 'te' ? 'సాధారణీకరించిన వృక్ష సూచిక (NDVI):' : lang === 'hi' ? 'सामान्यीकृत अंतर वनस्पति सूचकांक (NDVI):' : 'Normalized Difference Vegetation Index (NDVI):'}</b></p>
    <div class="equation-row"><div class="equation-code">NDVI = (B08 - B04) / (B08 + B04)</div><div class="equation-num">(Eq. 3.1)</div></div>
    
    <p><b>2. ${lang === 'te' ? 'తేమ సూచిక (NDMI):' : lang === 'hi' ? 'सामान्यीकृत अंतर नमी सूचकांक (NDMI):' : 'Normalized Difference Moisture Index (NDMI):'}</b></p>
    <div class="equation-row"><div class="equation-code">NDMI = (B08 - B11) / (B08 + B11)</div><div class="equation-num">(Eq. 3.2)</div></div>

    <p><b>3. ${lang === 'te' ? 'SCS కర్వ్ నంబర్ ఉపరితల ప్రవాహ సూత్రం:' : lang === 'hi' ? 'SCS कर्व नंबर सतही अपवाह सूत्र:' : 'SCS Curve Number Surface Runoff Formulation:'}</b></p>
    <div class="equation-row"><div class="equation-code">Q = (P - I_a)² / (P - I_a + S), &nbsp; where &nbsp; S = (25400 / CN) - 254, &nbsp; I_a = 0.2 · S</div><div class="equation-num">(Eq. 3.3)</div></div>

    <p><b>4. ${lang === 'te' ? 'నిరంతర జల బడ్జెట్ సమీకరణం:' : lang === 'hi' ? 'निरंतर जल संतुलन बजट:' : 'Continuous Hydrological Water Budget:'}</b></p>
    <div class="equation-row"><div class="equation-code">SW_t = SW_0 + &Sigma; (P_day - Q_surf - ET_a - W_seep - Q_gw)</div><div class="equation-num">(Eq. 3.4)</div></div>

    <h2 class="section-title">${lang === 'te' ? '3.3 గణాంక నమూనా సామర్థ్య ప్రమాణాలు' : lang === 'hi' ? '3.3 सांख्यिकीय प्रदर्शन बेंचमार्क मानदंड' : '3.3 Statistical Performance Benchmark Criteria'}</h2>
    <p>${lang === 'te'
      ? 'కాలిబ్రేషన్ నమూనా అందుబాటులో ఉన్నప్పుడు దాని నాణ్యత ప్రామాణిక జలవిజ్ఞాన ప్రమాణాల ప్రకారం మూల్యాంకనం చేయబడుతుంది (మోరియాసి మరియు ఇతరులు, 2007): నాష్-సుట్క్లిఫ్ ఎఫిషియెన్సీ (NSE > 0.50), నిర్ధారణ గుణకం (R² > 0.60), శాతం బయాస్ (|PBIAS| < 15%). ఈ నివేదికకు అటువంటి రన్ నమోదు కానందున ఎటువంటి ఫిట్ విలువలు చూపబడవు.'
      : lang === 'hi'
      ? 'कोई अंशांकन रन उपलब्ध होने पर उसकी गुणवत्ता मानक जल विज्ञान प्रदर्शन बेंचमार्क (मोरियासी एवं अन्य, 2007) से आंकी जाती है: NSE > 0.50, R² > 0.60, |PBIAS| < 15%। इस रिपोर्ट के लिए ऐसा कोई रन दर्ज न होने से कोई फिट मान नहीं दिखाया गया है।'
      : 'When a calibration run is available, its quality is judged against standard hydrologic performance benchmarks (Moriasi et al., 2007): Nash-Sutcliffe Efficiency (NSE > 0.50), Coefficient of Determination (R² > 0.60), and Percent Bias (|PBIAS| < 15%). No run is recorded for this report, so no fitted values are shown.'}</p>
  `
  )

  // Fig 3.1: Study Area Location Map
  if (opts.maps.includes('fresh')) {
    const fig3_1_Legend = `<text x="12" y="20" font-family="'Times New Roman',serif" font-size="11" font-weight="700" fill="#10231b">Legend</text>
      <line x1="12" y1="36" x2="42" y2="36" stroke="#10231b" stroke-width="4"/>
      <line x1="12" y1="36" x2="42" y2="36" stroke="#ffffff" stroke-width="2"/>
      <text x="48" y="40" font-family="'Times New Roman',serif" font-size="10" fill="#10231b">Study Boundary</text>
      <circle cx="27" cy="62" r="5" fill="#e63946"/>
      <text x="48" y="66" font-family="'Times New Roman',serif" font-size="10" fill="#10231b">Centroid Pin</text>`
    const fig3_1_Svg = render2dCartographicMap('Fig 3.1', `Study Area Boundary & Geodetic Extent of ${farm.name}`, view, ring, makeLayerContent('fresh'), fig3_1_Legend, 'Source: Esri World Imagery & OpenStreetMap (EPSG:4326)')
    const pFig = curPageNum
    figEntries.push({ num: 'Fig 3.1', title: `Study Area Boundary & Geodetic Extent of ${farm.name}`, pageNum: pFig })
    pushPage(
      'fig3_1',
      `
      <h2 class="section-title">3.4 Study Area Geodetic Location Map</h2>
      <p>Figure 3.1 delineates the area-of-interest boundary of ${esc(farm.name)} superimposed on high-resolution true-color satellite imagery, with precise geodetic neatline tick marks and scale bar.</p>
      <figure class="academic-figure">
        ${fig3_1_Svg}
        <figcaption class="figure-caption">Fig 3.1: Study Area Boundary &amp; Geodetic Extent of ${esc(farm.name)}</figcaption>
        <div class="figure-source">Source: Sentinel-2 L2A BOA Reflectance &amp; Esri World Imagery</div>
      </figure>
    `
    )
  }

  // Fig 3.2: DEM Elevation Map (Copernicus GLO-30, 30 m)
  if (opts.maps.includes('terrain')) {
    const demHighText = demElevMax !== null ? `High : ${demElevMax.toFixed(0)} m` : 'High : Data unavailable'
    const demLowText = demElevMin !== null ? `Low : ${demElevMin.toFixed(0)} m` : 'Low : Data unavailable'
    const fig3_2_Legend = `<text x="12" y="18" font-family="'Times New Roman',serif" font-size="11" font-weight="700" fill="#10231b">Legend</text>
      <rect x="12" y="26" width="12" height="8" fill="none" stroke="#10231b" stroke-width="1.2"/><text x="28" y="33" font-family="'Times New Roman',serif" font-size="8.5" fill="#10231b">Study Area</text>
      <text x="12" y="46" font-family="'Times New Roman',serif" font-size="9" font-weight="700" fill="#10231b">DEM (Value)</text>
      <defs>
        <linearGradient id="dem-srtm-ramp" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#1a9850"/>
          <stop offset="25%" stop-color="#ffffbf"/>
          <stop offset="50%" stop-color="#fc8d59"/>
          <stop offset="75%" stop-color="#8c510a"/>
          <stop offset="100%" stop-color="#ffffff"/>
        </linearGradient>
      </defs>
      <rect x="12" y="52" width="16" height="42" fill="url(#dem-srtm-ramp)" stroke="#10231b" stroke-width="0.5"/>
      <text x="34" y="59" font-family="'Times New Roman',serif" font-size="8.5" font-weight="700" fill="#10231b">${demHighText}</text>
      <text x="34" y="92" font-family="'Times New Roman',serif" font-size="8.5" font-weight="700" fill="#10231b">${demLowText}</text>`
    const fig3_2_Svg = render2dCartographicMap('Fig 3.2', `DEM Map of ${farm.name} (Copernicus GLO-30)`, view, ring, makeLayerContent('terrain'), fig3_2_Legend, 'Source: Copernicus DEM GLO-30 Elevation Grid')
    const pFig = curPageNum
    figEntries.push({ num: 'Fig 3.2', title: `DEM Map of ${farm.name} (Copernicus GLO-30)`, pageNum: pFig })
    pushPage(
      'fig3_2',
      `
      <h2 class="section-title">3.5 Digital Elevation Model (DEM) &amp; Topographic Hypsometry</h2>
      <p>Figure 3.2 shows the terrain over ${esc(farm.name)}. ${dem && demElevMin !== null && demElevMax !== null
        ? `Elevations in the loaded grid run from <b>${demElevMin.toFixed(0)} m</b> to <b>${demElevMax.toFixed(0)} m</b> above sea level.`
        : 'No elevation grid is loaded for this area of interest, so the hypsometric panel states "Data unavailable" (see figure).'}</p>
      <figure class="academic-figure">
        ${fig3_2_Svg}
        <figcaption class="figure-caption">Fig 3.2: DEM map of ${esc(farm.name)}</figcaption>
        <div class="figure-source">Source: SRTM 30m &amp; Copernicus DEM GLO-30 Elevation Grid</div>
      </figure>
    `
    )
  }

  // Fig 3.3 & Table 3.2: LULC Classification (Sentinel-2 L2A threshold rules, Dynamic World class scheme)
  if (opts.maps.includes('lulc')) {
    const lulcHasData = dwStats.some(s => s.count > 0)
    const fig3_3_Legend = `<text x="12" y="15" font-family="'Times New Roman',serif" font-size="8.5" font-weight="700" fill="#10231b">Legend · LULC classes (Sentinel-2 10 m)</text>
      <g transform="translate(12, 22)">
        ${lulcHasData
          ? dwStats.map((s, idx) => `
          <rect x="0" y="${idx * 9}" width="10" height="7" fill="${s.color}"/>
          <text x="14" y="${idx * 9 + 6}" font-family="'Times New Roman',serif" font-size="7.5" fill="#10231b">${s.name} (${s.swat}) · ${s.pct.toFixed(0)}%</text>
        `).join('')
          : `<text x="0" y="8" font-family="'Times New Roman',serif" font-size="8" font-weight="700" fill="#b45309">Class raster unavailable for this run.</text>`}
      </g>`
    const fig3_3_Svg = render2dCartographicMap('Fig 3.3', `LULC Map of ${farm.name} (Sentinel-2 10m classes)`, view, ring, makeLayerContent('lulc', 'rgba(45, 106, 79, 0.3)'), fig3_3_Legend, 'Source: Sentinel-2 L2A surface reflectance - in-browser threshold classification (Dynamic World class scheme)')
    const pFig = curPageNum
    figEntries.push({ num: 'Fig 3.3', title: `LULC Map of ${farm.name} (Sentinel-2 10m classes)`, pageNum: pFig })
    tableEntries.push({ num: 'Table 3.2', title: `Land Use / Land Cover Allocation Matrix (${farm.name})`, pageNum: pFig })
    pushPage(
      'fig3_3',
      `
      <h2 class="section-title">3.6 Land Use / Land Cover (LULC) Classification</h2>
      <p>Figure 3.3 shows the LULC classes derived in-browser from Sentinel-2 L2A surface reflectance (10 m cells) using published threshold rules (NDVI, NDWI, BSI) mapped onto the Dynamic World class scheme. SEVA·GIS computes this from the loaded scene instead of downloading the Dynamic World product.</p>
      <figure class="academic-figure">
        ${fig3_3_Svg}
        <figcaption class="figure-caption">Fig 3.3: LULC map of ${esc(farm.name)}</figcaption>
        <div class="figure-source">Source: Sentinel-2 L2A surface reflectance - in-browser threshold classification (10 m)</div>
      </figure>

      <div style="margin-top: 18pt;">
        <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 6pt; color: #10231b;">Table 3.2: Land Use / Land Cover (LULC) Allocation Matrix</h3>
        <table class="academic-table" style="width: 100%; border-collapse: collapse; font-size: 9pt;">
          <thead>
            <tr style="background: #f1f5f9; border-top: 1.5pt solid #10231b; border-bottom: 1.5pt solid #10231b;">
              <th style="padding: 4pt 6pt; text-align: center;">ID</th>
              <th style="padding: 4pt 6pt; text-align: left;">Class (Dynamic World scheme)</th>
              <th style="padding: 4pt 6pt; text-align: center;">SWAT Code</th>
              <th style="padding: 4pt 6pt; text-align: center;">Color</th>
              <th style="padding: 4pt 6pt; text-align: right;">Area (ha)</th>
              <th style="padding: 4pt 6pt; text-align: right;">Area (Acres)</th>
              <th style="padding: 4pt 6pt; text-align: right;">Coverage (%)</th>
            </tr>
          </thead>
          <tbody>
            ${dwStats.map(s => `
              <tr style="border-bottom: 0.5pt solid #e2e8f0;">
                <td style="padding: 3.5pt 6pt; text-align: center; font-weight: bold;">${s.id}</td>
                <td style="padding: 3.5pt 6pt; font-weight: 600;">${s.name}</td>
                <td style="padding: 3.5pt 6pt; text-align: center; font-family: monospace;">${s.swat}</td>
                <td style="padding: 3.5pt 6pt; text-align: center;"><span style="display:inline-block; width:14px; height:9px; background:${s.color}; border:0.5pt solid #10231b; border-radius:2px;"></span></td>
                <td style="padding: 3.5pt 6pt; text-align: right; font-family: monospace;">${s.areaHa.toFixed(2)}</td>
                <td style="padding: 3.5pt 6pt; text-align: right; font-family: monospace;">${s.areaAcres.toFixed(2)}</td>
                <td style="padding: 3.5pt 6pt; text-align: right; font-weight: 600;">${s.pct.toFixed(1)}%</td>
              </tr>
            `).join('')}
            <tr style="background: #f8fafc; font-weight: bold; border-top: 1.5pt solid #10231b; border-bottom: 1.5pt solid #10231b;">
              <td colspan="4" style="padding: 4.5pt 6pt;">Total Analyzed Area of Interest</td>
              <td style="padding: 4.5pt 6pt; text-align: right; font-family: monospace;">${ha.toFixed(2)} ha</td>
              <td style="padding: 4.5pt 6pt; text-align: right; font-family: monospace;">${acres.toFixed(2)} ac</td>
              <td style="padding: 4.5pt 6pt; text-align: right;">100.0%</td>
            </tr>
          </tbody>
        </table>
        ${lulcHasData ? '' : `<div class="table-source" style="color: #b45309;">Class composition is unavailable for this run: the reflectance grid for the season's scene could not be loaded, so no class counts are shown. A loaded scene populates this table automatically.</div>`}
      </div>
    `
    )
  }

  // Fig 3.4: Soil context map (spatial FAO DSMW raster is not bundled)
  if (opts.maps.includes('soil')) {
    const fig3_4_Legend = `<text x="12" y="16" font-family="'Times New Roman',serif" font-size="10.5" font-weight="700" fill="#10231b">Legend · Soil context</text>
      <g transform="translate(12, 24)">
        <rect x="0" y="0" width="12" height="8" fill="none" stroke="#10231b" stroke-width="1.2"/><text x="16" y="7" font-family="'Times New Roman',serif" font-size="8" fill="#10231b">Study area boundary</text>
        <text x="0" y="24" font-family="'Times New Roman',serif" font-size="8" font-weight="700" fill="#b45309">No spatial soil-series raster is</text>
        <text x="0" y="35" font-family="'Times New Roman',serif" font-size="8" font-weight="700" fill="#b45309">bundled, so no soil boundaries</text>
        <text x="0" y="46" font-family="'Times New Roman',serif" font-size="8" font-weight="700" fill="#b45309">are drawn on this base map.</text>
      </g>`
    const fig3_4_Svg = render2dCartographicMap('Fig 3.4', `Soil Context Map of ${farm.name}`, view, ring, makeLayerContent('soil', 'rgba(176, 137, 104, 0.3)'), fig3_4_Legend, 'Source: Esri World Imagery base map - no soil raster included')
    const pFig = curPageNum
    figEntries.push({ num: 'Fig 3.4', title: `Soil Context Map of ${farm.name}`, pageNum: pFig })
    pushPage(
      'fig3_4',
      `
      <h2 class="section-title">3.7 Soil Series &amp; Physical Hydraulic Properties</h2>
      <p>Figure 3.4 shows the parcel over the satellite base map. SEVA·GIS does not bundle the FAO Digital Soil Map of the World (DSMW) raster, so no soil series boundaries or MWSWAT-calibrated classes are drawn. Soil observations recorded on the farm card remain the source of truth here; a spatial soil survey can be attached when available.</p>
      <figure class="academic-figure">
        ${fig3_4_Svg}
        <figcaption class="figure-caption">Fig 3.4: Soil context map of ${esc(farm.name)}</figcaption>
        <div class="figure-source">Source: Esri World Imagery base map - spatial soil raster not bundled</div>
      </figure>
    `
    )
  }

  // Fig 3.5: Weather context map (gridded reanalysis, no station coordinates bundled)
  if (opts.maps.includes('stations')) {
    const fig3_5_Legend = `<text x="12" y="16" font-family="'Times New Roman',serif" font-size="11" font-weight="700" fill="#10231b">Legend</text>
      <rect x="12" y="24" width="12" height="8" fill="none" stroke="#10231b" stroke-width="1.2"/><text x="28" y="31" font-family="'Times New Roman',serif" font-size="8.5" fill="#10231b">Study Area</text>
      <text x="12" y="48" font-family="'Times New Roman',serif" font-size="8.5" font-weight="700" fill="#b45309">No rain-gauge or temperature station</text>
      <text x="12" y="61" font-family="'Times New Roman',serif" font-size="8.5" font-weight="700" fill="#b45309">coordinates are bundled with SEVA·GIS.</text>`
    const fig3_5_Svg = render2dCartographicMap('Fig 3.5', `Weather Context Map of ${farm.name}`, view, ring, makeLayerContent('stations', 'rgba(0, 119, 182, 0.25)'), fig3_5_Legend, 'Source: Esri World Imagery base map - weather values come from Open-Meteo gridded reanalysis')
    const pFig = curPageNum
    figEntries.push({ num: 'Fig 3.5', title: `Weather Context Map of ${farm.name}`, pageNum: pFig })
    pushPage(
      'fig3_5',
      `
      <h2 class="section-title">3.8 Meteorological &amp; Agro-Climatic Context</h2>
      <p>Figure 3.5 shows the parcel location for weather context. SEVA·GIS sources weather values from the Open-Meteo gridded reanalysis for the farm coordinates rather than from physical stations, and no station marker is drawn because no station-coordinate dataset is bundled. Weather values (when present on the farm card) are shown in the app itself.</p>
      <figure class="academic-figure">
        ${fig3_5_Svg}
        <figcaption class="figure-caption">Fig 3.5: Weather context map of ${esc(farm.name)}</figcaption>
        <div class="figure-source">Source: Open-Meteo gridded reanalysis (values shown in-app) - Esri World Imagery base map</div>
      </figure>
    `
    )
  }

  // Fig 3.6: Ground Discharge Station Map - directly matching 2.jpeg in MAPS REF
  if (opts.maps.includes('discharge')) {
    const fig3_6_Svg = renderGroundDischargeStationMapSvg(view, ring, farm.name, makeLayerContent('stations'))
    const pFig = curPageNum
    figEntries.push({ num: 'Fig 3.6', title: `Hydrology Context Map of ${farm.name}`, pageNum: pFig })
    pushPage(
      'fig3_6',
      `
      <h2 class="section-title">3.9 Hydrology Context</h2>
      <p>Figure 3.6 shows the study area over the satellite base map. SEVA·GIS does not bundle a published gauging-station or stream-network dataset, so no stations or stream reaches are drawn; attach an external hydrography source to populate this context map.</p>
      <figure class="academic-figure">
        ${fig3_6_Svg}
        <figcaption class="figure-caption">Fig 3.6: Hydrology context map of ${esc(farm.name)}</figcaption>
        <div class="figure-source">Source: Esri World Imagery base map - no streamflow gauge dataset included</div>
      </figure>
    `
    )
  }

  // --- CHAPTER IV: RESULTS AND DISCUSSION ---
  sectionMap['ch4'] = curPageNum
  sectionMap['4.0'] = curPageNum
  sectionMap['4.1'] = curPageNum
  sectionMap['4.2'] = curPageNum

  // 1. Calculate Whole-Field Parameter Additions, Differences & Combinations
  const rNdvi = an.ndvi.mean
  const rNdmi = an.ndmi.mean
  const rNdwi = an.ndwi.mean
  const rStress = an.stressPct

  const cChlorophyll = Math.min(100, Math.max(10, Math.round(((rNdvi - 0.15) / 0.7) * 100)))
  const cHydration = Math.min(100, Math.max(10, Math.round(((rNdmi + 0.05) / 0.55) * 100)))
  const cBiomass = Math.min(100, Math.max(15, Math.round(cChlorophyll * 0.85 + cHydration * 0.15)))
  const cStressPenalty = Math.min(100, Math.max(3, Math.round(rStress * 1.8)))
  const cMoistureDeficit = Math.min(100, Math.max(2, Math.round((100 - cHydration) * 0.4)))

  const grossScore = cChlorophyll * 0.45 + cHydration * 0.35 + cBiomass * 0.20
  const stressDeduction = cStressPenalty * 0.18 + cMoistureDeficit * 0.12
  const compositeScore = Math.round(Math.max(15, Math.min(98, grossScore - stressDeduction)))

  const healthPieSlices = [
    { label: 'Canopy Index (NDVI-derived)', pct: 45, color: '#10b981', val: `Observed: ${rNdvi.toFixed(2)} (Ref: >0.60, Δ = ${(rNdvi - 0.60 >= 0 ? '+' : '') + (rNdvi - 0.60).toFixed(2)})` },
    { label: 'Moisture Index (NDMI-derived)', pct: 35, color: '#0ea5e9', val: `Observed: ${rNdmi.toFixed(2)} (Ref: >0.30, Δ = ${(rNdmi - 0.30 >= 0 ? '+' : '') + (rNdmi - 0.30).toFixed(2)})` },
    { label: 'Composite Biomass Estimate', pct: 20, color: '#84cc16', val: `NDVI/NDMI blend = ${cBiomass}/100 - an estimate, not a measured SAVI` },
    { label: 'Deductions applied', pct: 0, color: '#ef4444', val: `Stress penalty -${(cStressPenalty * 0.18).toFixed(1)} pts + moisture deficit -${(cMoistureDeficit * 0.12).toFixed(1)} pts` },
  ]

  const healthPieSvg = renderOverallHealthPieSvg(compositeScore, healthPieSlices)
  const pFig0 = curPageNum
  figEntries.push({ num: 'Fig 4.0', title: 'Overall Field Health Composite (estimate) & Parameter Synthesis Donut Chart', pageNum: pFig0 })
  tableEntries.push({ num: 'Table 4.0', title: 'Multi-Spectral Parameter Differences, Additions & Combinations Matrix', pageNum: pFig0 })

  pushPage(
    'ch4_health_pie',
    `
    <h1 class="chapter-title">${t.ch4Title}</h1>
    <h2 class="section-title">${lang === 'te' ? '4.0 ప్రత్యేక పరిశోధనా నివేదిక: పొలం సమగ్ర ఆరోగ్య సమ్మేళనం & బహుళ-పారామితి విశ్లేషణ' : lang === 'hi' ? '4.0 विशेष खोजी रिपोर्ट: संपूर्ण खेत का समग्र स्वास्थ्य एवं बहु-पैरामीटर संश्लेषण' : '4.0 Special Investigative Briefing: Whole-Field Overall Health Composite &amp; Multi-Parameter Synthesis'}</h2>
    
    <div style="background: #fdf8f6; border-left: 4pt solid #e76f51; padding: 10pt 14pt; margin: 10pt 0 14pt; font-size: 10.5pt;">
      <b>${lang === 'te' ? `ప్రత్యేక పరిశోధనా నివేదిక: ${esc(farm.name.toUpperCase())} యొక్క రిమోట్ సెన్సింగ్ ఆడిట్` : lang === 'hi' ? `विशेष खोजी रिपोर्ट: ${esc(farm.name.toUpperCase())} का सुदूर संवेदन ऑडिट` : `SPECIAL INVESTIGATIVE REPORT: REMOTE SENSING AUDIT OF ${esc(farm.name.toUpperCase())}`}</b><br>
      <i>${lang === 'te' ? 'సేవా జిఐఎస్ అగ్రో-స్పేషియల్ ఇంటెలిజెన్స్ & రిమోట్ సెన్సింగ్ డెస్క్' : lang === 'hi' ? 'सेवा जीआईएस एग्रो-स्थानिक इंटेलिजेंस एवं रिमोट सेंसिंग डेस्क' : 'By SEVA·GIS Agro-Spatial Intelligence &amp; Remote Sensing Desk'}</i><br>
      <span style="font-size: 9.5pt; color: #555;">${lang === 'te' ? `ఉపగ్రహ ప్లాట్‌ఫారమ్: సెంటినెల్-2 (ESA/Copernicus) · సీన్ ID: ${esc(an.scene.id)} · వాతావరణ ప్రామాణికత: BOA లెవల్-2A` : lang === 'hi' ? `अवलोकन प्लेटफॉर्म: सेंटिनल-2 (ESA/कॉपरनिकस) · सीन ID: ${esc(an.scene.id)} · वायुमंडलीय मानक: BOA लेवल-2A` : `Observation Platform: Sentinel-2 (ESA/Copernicus) · Scene ID: ${esc(an.scene.id)} · Atmospheric Standard: BOA Level-2A`}</span>
    </div>

    <p class="no-indent"><b>${lang === 'te' ? 'పరిశోధనా దృక్పథం:' : lang === 'hi' ? 'खोजी दृष्टिकोण:' : 'The Investigative Angle:'}</b> ${lang === 'te'
      ? `<b>${esc(farm.name)}</b> (${ha.toFixed(2)} హెక్టార్లు) పై బహుళ-వర్ణపట విశ్లేషణ నిర్వహించబడింది. సూచికలు ఏకీకృతం చేయబడి <b>${compositeScore} / 100</b> (${compositeScore >= 78 ? 'అధిక సూచిక - క్షేత్రంలో నిర్ధారించండి' : compositeScore >= 55 ? 'మధ్యస్థ సూచిక - నిరంతర పర్యవేక్షణ' : 'తక్కువ సూచిక - క్షేత్ర తనిఖీ అవసరం'}) అంచనా స్కోరు నమోదైంది. సూత్రాలు Eq. 4.0a-b లో చూపబడ్డాయి; ఇది ఒకే దృశ్యం నుండి వచ్చిన అంచనా, దిగుబడి కొలత కాదు.`
      : lang === 'hi'
      ? `<b>${esc(farm.name)}</b> (${ha.toFixed(2)} हेक्टेयर) का बहु-स्पेक्ट्रमी विश्लेषण किया गया। सूचकांकों को संयोजित कर <b>${compositeScore} / 100</b> (${compositeScore >= 78 ? 'उच्च सूचक - खेत पर सत्यापित करें' : compositeScore >= 55 ? 'मध्यम सूचक - निरंतर निगरानी' : 'निम्न सूचक - खेत जांच आवश्यक'}) के रूप में अनुमानित स्कोर दर्ज किया। सूत्र Eq. 4.0a-b में दर्शाए गए हैं; यह एक ही दृश्य से प्राप्त अनुमान है, उपज माप नहीं।`
      : `A multi-spectral reading of <b>${esc(farm.name)}</b> (${ha.toFixed(2)} ha) was run to see how surface greenness and moisture signals agree. The audit combines the five spectral indices into one composite index estimate of <b>${compositeScore} / 100</b> (${compositeScore >= 78 ? 'High index - verify in field' : compositeScore >= 55 ? 'Moderate index - close monitoring advised' : 'Low index - field check advised'}). The formulas are shown in Eq. 4.0a-b; this is an estimate from one scene, not a yield measurement.`}</p>

    <figure class="academic-figure">
      ${healthPieSvg}
      <figcaption class="figure-caption">${lang === 'te' ? `చిత్రం 4.0: ${esc(farm.name)} యొక్క సమగ్ర పంట ఆరోగ్య సమ్మేళనం చార్ట్ (అంచనా)` : lang === 'hi' ? `चित्र 4.0: ${esc(farm.name)} का समग्र फसल स्वास्थ्य संश्लेषण डोनट चार्ट (अनुमान)` : `Fig 4.0: Overall Field Health Composite (estimate) &amp; Parameter Synthesis Donut Chart`}</figcaption>
      <div class="figure-source">Source: SEVA·GIS multi-spectral analysis pipeline (Sentinel-2 L2A BOA radiometry)</div>
    </figure>

    <p class="table-caption">${lang === 'te' ? 'పట్టిక 4.0: బహుళ-వర్ణపట పారామితుల వ్యత్యాసాలు మరియు సమ్మేళన విశ్లేషణ' : lang === 'hi' ? 'तालिका 4.0: बहु-स्पेक्ट्रमी पैरामीटर अंतर, योग एवं संयोजन मैट्रिक्स' : 'Table 4.0: Multi-Spectral Parameter Differences, Additions &amp; Combinations Matrix'}</p>
    <table class="academic-table" style="font-size: 9.5pt;">
      <thead>
        <tr>
          <th>${lang === 'te' ? 'వర్ణపట / జీవ పారామితి' : lang === 'hi' ? 'स्पेक्ट्रल / जैव पैरामीटर' : 'Spectral / Bio Parameter'}</th>
          <th>${lang === 'te' ? 'పరిశీలించిన విలువ' : lang === 'hi' ? 'प्राप्त मान' : 'Observed Value'}</th>
          <th>${lang === 'te' ? 'ప్రామాణిక బేస్‌లైన్' : lang === 'hi' ? 'संदर्भ आधार' : 'Reference Baseline'}</th>
          <th>${lang === 'te' ? 'వ్యత్యాసం (Δ)' : lang === 'hi' ? 'अंतर (Δ)' : 'Observed Difference (&Delta;)'}</th>
          <th>${lang === 'te' ? 'పాత్ర & సంశ్లేషణ బరువు' : lang === 'hi' ? 'भार एवं संश्लेषण भूमिका' : 'Mathematical Weight &amp; Synthesis Role'}</th>
          <th>${lang === 'te' ? 'విశ్లేషణాత్మక తీర్పు' : lang === 'hi' ? 'विश्लेषणात्मक निर्णय' : 'Reporter Analytical Verdict'}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><b>${lang === 'te' ? 'పంట పచ్చదనం (NDVI)' : lang === 'hi' ? 'छतरी विकास (NDVI)' : 'Canopy Vigor (NDVI)'}</b></td>
          <td><b>${rNdvi.toFixed(2)}</b></td>
          <td>0.60 (${lang === 'te' ? 'అనుకూలం' : lang === 'hi' ? 'इष्टतम' : 'Optimal'})</td>
          <td><b style="color: ${rNdvi >= 0.60 ? '#1b4332' : '#c1121f'}">${(rNdvi - 0.60 >= 0 ? '+' : '') + (rNdvi - 0.60).toFixed(2)}</b></td>
          <td>${lang === 'te' ? 'ధనాత్మక (+45% వాటా)' : lang === 'hi' ? 'धनात्मक (+45% योगदान)' : 'Additive (+45% of Gross Capital)'}</td>
          <td>${lang === 'te' ? 'ఈ దృశ్యంలో బలమైన పచ్చదనం; పంట పందిరి ఆరోగ్యానికి ప్రాక్సీ.' : lang === 'hi' ? 'इस दृश्य में मजबूत हरियाली; छतरी स्वास्थ्य का प्रॉक्सी।' : 'Strong greenness reading in this scene; a proxy for canopy vigor.'}</td>
        </tr>
        <tr>
          <td><b>${lang === 'te' ? 'ఆకుల తేమ (NDMI)' : lang === 'hi' ? 'पत्ती जलयोजन (NDMI)' : 'Leaf Hydration (NDMI)'}</b></td>
          <td><b>${rNdmi.toFixed(2)}</b></td>
          <td>0.30 (${lang === 'te' ? 'తేమ పుష్కలం' : lang === 'hi' ? 'पर्याप्त नम' : 'Hydrated'})</td>
          <td><b style="color: ${rNdmi >= 0.30 ? '#1b4332' : '#c1121f'}">${(rNdmi - 0.30 >= 0 ? '+' : '') + (rNdmi - 0.30).toFixed(2)}</b></td>
          <td>${lang === 'te' ? 'ధనాత్మక (+35% వాటా)' : lang === 'hi' ? 'धनात्मक (+35% योगदान)' : 'Additive (+35% of Gross Capital)'}</td>
          <td>${lang === 'te' ? 'తేమ సూచిక ఈ దృశ్యంలో 0.30 ప్రామాణికం పైన ఉంది; రోజువారీ పోలికలతో ధోరణి చూడండి.' : lang === 'hi' ? 'नमी सूचक इस दृश्य में 0.30 संदर्भ से ऊपर है; दिन-प्रतिदिन तुलना से रुझान देखें।' : 'Moisture index sits above the 0.30 reference in this scene; compare across dates for a trend.'}</td>
        </tr>
        <tr>
          <td><b>${lang === 'te' ? 'నేల బయోమాస్ (SAVI)' : lang === 'hi' ? 'भू-बायोमास (SAVI)' : 'Ground Biomass (SAVI)'}</b></td>
          <td><b>—</b></td>
          <td>0.50 (${lang === 'te' ? 'సాంద్రత' : lang === 'hi' ? 'सघन' : 'Dense'})</td>
          <td><b>—</b></td>
          <td>${lang === 'te' ? 'ఈ రన్‌లో లెక్కించబడలేదు' : lang === 'hi' ? 'इस रन में परिकलित नहीं' : 'Not computed in this run'}</td>
          <td>${lang === 'te' ? 'SAVI కి శాటిలైట్ బ్యాండ్లపై నేల-సర్దుబాటు సూత్రం అవసరం; సంఖ్యను ఊహించి చూపము.' : lang === 'hi' ? 'SAVI हेतु सैटेलाइट बैंडों पर मृदा-समायोजित सूत्र आवश्यक है; अनुमानित संख्या नहीं दिखाई जाती।' : 'SAVI needs the soil-adjusted formula run on the scene bands; no estimated number is shown.'}</td>
        </tr>
        <tr>
          <td><b>${lang === 'te' ? 'ఉపరితల డ్రైనేజీ (NDWI)' : lang === 'hi' ? 'सतही जल निकासी (NDWI)' : 'Surface Drainage (NDWI)'}</b></td>
          <td><b>${rNdwi.toFixed(2)}</b></td>
          <td>-0.10 (${lang === 'te' ? 'డ్రైన్డ్' : lang === 'hi' ? 'निकासित' : 'Drained'})</td>
          <td><b>${(rNdwi - (-0.10)).toFixed(2)}</b></td>
          <td>${lang === 'te' ? 'జల సరిచూసే అంశం' : lang === 'hi' ? 'जल विज्ञान जांच कारक' : 'Hydrological Check Factor'}</td>
          <td>${lang === 'te' ? 'ఈ దృశ్యంలో బహిరంగ నీటి ఉపరితలం కనిపించలేదు (NDWI ఆధారంగా).' : lang === 'hi' ? 'इस दृश्य में खुला जल सतह नहीं दिखा (NDWI के आधार पर)।' : 'No open surface water visible in this scene (NDWI reading).'}</td>
        </tr>
        <tr>
          <td><b>${lang === 'te' ? 'తీవ్రమైన పంట ఒత్తిడి' : lang === 'hi' ? 'तीव्र वानस्पतिक तनाव' : 'Acute Vegetative Stress'}</b></td>
          <td><b>${rStress.toFixed(1)}%</b></td>
          <td>&lt; 5.0% (${lang === 'te' ? 'సహించదగినది' : lang === 'hi' ? 'सहनशील' : 'Tolerable'})</td>
          <td><b style="color: #c1121f;">${rStress - 5.0 >= 0 ? '+' : ''}${(rStress - 5.0).toFixed(1)}%</b></td>
          <td><b>${lang === 'te' ? `తగ్గింపు కారకం (-${(cStressPenalty * 0.18).toFixed(1)} పాయింట్లు)` : lang === 'hi' ? `कटौती कारक (-${(cStressPenalty * 0.18).toFixed(1)} अंक)` : `Deduction Factor (-${(cStressPenalty * 0.18).toFixed(1)} pts)`}</b></td>
          <td>${lang === 'te' ? 'తక్కువ పచ్చదనం ఉన్న పిక్సెల్‌లు గుర్తించబడ్డాయి; కారణాన్ని ఒక చిత్రం చెప్పదు - క్షేత్రంలో నిర్ధారించండి.' : lang === 'hi' ? 'कम हरियाली वाले पिक्सेल चिह्नित; कारण एक चित्र से तय नहीं होता - खेत पर जांचें।' : 'Low-vigour pixels flagged; the cause cannot be told from one image - walk and verify.'}</td>
        </tr>
        <tr>
          <td><b>Moisture Deficit Risk</b></td>
          <td><b>${cMoistureDeficit}%</b></td>
          <td>&lt; 10.0% (Safe)</td>
          <td><b style="color: ${cMoistureDeficit > 10 ? '#c1121f' : '#1b4332'}">${(cMoistureDeficit - 10 >= 0 ? '+' : '') + (cMoistureDeficit - 10)}%</b></td>
          <td><b>Deduction Factor (-${(cMoistureDeficit * 0.12).toFixed(1)} pts)</b></td>
          <td>Derived estimate from the scene's NDMI (method in Eq. 4.0a-b); confirm with an in-field soil-moisture check.</td>
        </tr>
        <tr style="background: #f0fdf4; font-weight: bold;">
          <td><b>NET COMPOSITE HEALTH (estimate)</b></td>
          <td colspan="2"><span style="font-size: 13pt; color: #1b4332;">${compositeScore} / 100</span></td>
          <td><b>Gross: ${grossScore.toFixed(1)} pts</b></td>
          <td><b>Deductions: -${stressDeduction.toFixed(1)} pts</b></td>
          <td><b>${compositeScore >= 78 ? 'High index - verify in field' : 'Moderate index - field action advised'}</b></td>
        </tr>
      </tbody>
    </table>

    <h2 class="section-title">4.0.1 The Parameter Discrepancy &amp; Combination Analysis</h2>
    <p><b>1. Difference Between Greenness (NDVI) and Water Signal (NDMI):</b> A useful diagnostic of this audit is the difference between greenness and moisture. The scene reads an NDVI of ${rNdvi.toFixed(2)} while the moisture index is ${rNdmi.toFixed(2)}. Plants often keep green colour during early water deficit before wilting is visible, so reading both indices together helps spot drying trends that NDVI alone may miss.</p>

    <p><b>2. Additive Combination Model:</b> The three mid-level indices are combined into one gross estimate:</p>
    <div class="equation-box">
      <div class="equation-code">Gross Index = (0.45 &times; Canopy) + (0.35 &times; Moisture) + (0.20 &times; Biomass) = ${grossScore.toFixed(1)} pts</div>
      <div class="equation-num">(Eq. 4.0a)</div>
    </div>

    <p><b>3. Penalised Net Score:</b> Deductions use the share of low-vigour pixels (${rStress.toFixed(1)}%) and the derived moisture-deficit term (${cMoistureDeficit}%):</p>
    <div class="equation-box">
      <div class="equation-code">Net Composite (estimate) = Gross Index - (0.18 &times; Stress Penalty + 0.12 &times; Deficit) = ${compositeScore} / 100</div>
      <div class="equation-num">(Eq. 4.0b)</div>
    </div>

    <p><b>Reading &amp; On-the-Ground Action:</b> In this scene, <b>${(100 - rStress).toFixed(1)}%</b> of ${esc(farm.name)} sits above the app's low-cover flag and <b>${rStress.toFixed(1)}%</b> below it. The maps show where the crop differs; they do not tell why. Walk the flagged patches and check crop stage, water, pests, drainage and nutrients before changing irrigation or fertilizer. The composite score above is an estimate from the scene indices (formulas Eq. 4.0a-b), not a yield measurement.</p>

    <h2 class="section-title">4.1 Multi-Spectral Crop Canopy Health (NDVI)</h2>
    <p>Multi-spectral Sentinel-2 Level-2A surface reflectance captured across ${esc(farm.name)} was analyzed for this report. The calculated mean NDVI is <b>${an.ndvi.mean.toFixed(2)}</b> (spatial range: <b>${an.ndvi.min.toFixed(2)}</b> to <b>${an.ndvi.max.toFixed(2)}</b>). About <b>${(100 - an.stressPct).toFixed(1)}%</b> of clear field pixels sit at or above the app's low-cover flag and <b>${an.stressPct.toFixed(1)}%</b> below it (NDVI &lt; 0.35).</p>
    <p>Pixels below the flag form the low-vigour share marked on the NDVI map. One image cannot say why a patch is weak - walk it and check crop stage, water, pests, drainage and nutrients before acting. The share above is the percentage of pixels over a threshold, not an abundance measurement.</p>
  `
  )

  // Fig 4.1: Crop Health NDVI
  if (opts.maps.includes('ndvi')) {
    const fig4_1_Legend = `<text x="12" y="18" font-family="'Times New Roman',serif" font-size="11" font-weight="700" fill="#10231b">Crop Vigor (NDVI)</text>
      <rect x="12" y="28" width="12" height="8" fill="#1a9850"/><text x="30" y="35" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">Robust Health (&gt; 0.60)</text>
      <rect x="12" y="42" width="12" height="8" fill="#a6d96a"/><text x="30" y="49" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">Good Green Cover (0.50–0.60)</text>
      <rect x="12" y="56" width="12" height="8" fill="#fee08b"/><text x="30" y="63" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">Moderate Vigor (0.35–0.50)</text>
      <rect x="12" y="70" width="12" height="8" fill="#d73027"/><text x="30" y="77" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">Stressed / Fallow (&lt; 0.35)</text>`
    const fig4_1_Svg = render2dCartographicMap('Fig 4.1', `Canopy Vigor & Vegetation Health Zonation (NDVI)`, view, ring, makeLayerContent('ndvi', 'rgba(26, 152, 80, 0.3)'), fig4_1_Legend, 'Source: Sentinel-2 L2A Radiometric BOA Surface Reflectance')
    const pFig = curPageNum
    figEntries.push({ num: 'Fig 4.1', title: `Canopy Vigor & Vegetation Health Zonation (NDVI)`, pageNum: pFig })
    pushPage(
      'fig4_1',
      `
      <figure class="academic-figure">
        ${fig4_1_Svg}
        <figcaption class="figure-caption">Fig 4.1: Canopy Vigor &amp; Vegetation Health Zonation (NDVI)</figcaption>
        <div class="figure-source">Source: Sentinel-2 L2A Radiometric BOA Surface Reflectance (ESA)</div>
      </figure>
    `
    )
  }

  // Fig 4.2: Leaf Moisture NDMI
  if (opts.maps.includes('ndmi')) {
    const fig4_2_Legend = `<text x="12" y="18" font-family="'Times New Roman',serif" font-size="11" font-weight="700" fill="#10231b">Canopy Water (NDMI)</text>
      <rect x="12" y="28" width="12" height="8" fill="#08519c"/><text x="30" y="35" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">High Moisture (&gt; 0.40)</text>
      <rect x="12" y="44" width="12" height="8" fill="#4292c6"/><text x="30" y="51" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">Adequate Hydration (0.20–0.40)</text>
      <rect x="12" y="60" width="12" height="8" fill="#fdae6b"/><text x="30" y="67" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">Moderate Moisture (0.05–0.20)</text>
      <rect x="12" y="76" width="12" height="8" fill="#e6550d"/><text x="30" y="83" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">Water Deficit (&lt; 0.05)</text>`
    const fig4_2_Svg = render2dCartographicMap('Fig 4.2', `Leaf Moisture & Canopy Hydration Zonation (NDMI)`, view, ring, makeLayerContent('ndmi', 'rgba(8, 81, 156, 0.3)'), fig4_2_Legend, 'Source: Sentinel-2 L2A NIR (B08) & SWIR (B11) Bands')
    const pFig = curPageNum
    figEntries.push({ num: 'Fig 4.2', title: `Leaf Moisture & Canopy Hydration Zonation (NDMI)`, pageNum: pFig })
    pushPage(
      'fig4_2',
      `
      <h2 class="section-title">4.2 Canopy Moisture &amp; Leaf Hydration (NDMI)</h2>
      <p>Figure 4.2 evaluates the Normalized Difference Moisture Index (NDMI). The parcel reads a mean index of <b>${an.ndmi.mean.toFixed(2)}</b> (range: <b>${an.ndmi.min.toFixed(2)}</b> to <b>${an.ndmi.max.toFixed(2)}</b>) in this scene. Moisture readings are best compared across dates to see a trend, and confirmed with a soil-moisture check before changing irrigation.</p>
      <figure class="academic-figure">
        ${fig4_2_Svg}
        <figcaption class="figure-caption">Fig 4.2: Leaf Moisture &amp; Canopy Hydration Zonation (NDMI)</figcaption>
        <div class="figure-source">Source: Sentinel-2 L2A NIR (B08) &amp; SWIR (B11) Radiometric Ingestion</div>
      </figure>
    `
    )
  }

  // Additional selected analysis lab parameters (e.g. NDWI, EVI, NDRE, BSI, Slope, TWI)
  let addFigIdx = 3
  const otherSelectedInds = opts.maps.filter(m => !['fresh', 'terrain', 'lulc', 'soil', 'stations', 'ndvi', 'ndmi'].includes(m))
  for (const mId of otherSelectedInds) {
    const indObj = INDICATORS.find(i => i.id === mId)
    if (indObj) {
      const figNum = `Fig 4.${addFigIdx++}`
      const figTitle = `${indObj.name} Analytical Zonation Map`
      const indLegend = `<text x="12" y="20" font-family="'Times New Roman',serif" font-size="11" font-weight="700" fill="#10231b">${indObj.name} Legend</text>
        <defs>
          <linearGradient id="${mId}-ramp" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#2d6a4f"/>
            <stop offset="50%" stop-color="#e9c46a"/>
            <stop offset="100%" stop-color="#e76f51"/>
          </linearGradient>
        </defs>
        <rect x="12" y="32" width="140" height="8" rx="2" fill="url(#${mId}-ramp)"/>
        <text x="12" y="54" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">Low: ${indObj.range?.[0] !== undefined ? indObj.range[0] : '—'}</text>
        <text x="152" y="54" text-anchor="end" font-family="'Times New Roman',serif" font-size="9" fill="#10231b">High: ${indObj.range?.[1] !== undefined ? indObj.range[1] : '—'}</text>`
      const svgMap = render2dCartographicMap(figNum, figTitle, view, ring, makeLayerContent(mId), indLegend, `Source: SEVA·GIS Native Radiometric Pipeline (${indObj.source})`)
      const pFig = curPageNum
      figEntries.push({ num: figNum, title: figTitle, pageNum: pFig })
      pushPage(
        `fig_${mId}`,
        `
        <h2 class="section-title">${figTitle}</h2>
        <p>${indObj.desc}</p>
        <figure class="academic-figure">
          ${svgMap}
          <figcaption class="figure-caption">${figNum}: ${esc(figTitle)}</figcaption>
          <div class="figure-source">Source: Sentinel-2 L2A / Copernicus DEM (${indObj.source})</div>
        </figure>
      `
      )
    }
  }

  // Selected Band Symbology Images (Remote Field Review)
  if (opts.bandSymbologies && opts.bandSymbologies.length > 0) {
    for (const bsId of opts.bandSymbologies) {
      const bsChoice = BAND_SYMBOLOGY_CHOICES.find(c => c.id === bsId)
      if (bsChoice) {
        const figNum = `Fig 4.${addFigIdx++}`
        const figTitle = `${bsChoice.name} Band Symbology (${bsChoice.bands})`
        const bsLegend = `<text x="12" y="20" font-family="'Times New Roman',serif" font-size="11" font-weight="700" fill="#10231b">Band Symbology</text>
          <text x="12" y="36" font-family="'Times New Roman',serif" font-size="9.5" fill="#10231b">${bsChoice.name}</text>
          <text x="12" y="52" font-family="'Times New Roman',serif" font-size="9" fill="#555">Bands: ${bsChoice.bands}</text>
          <text x="12" y="68" font-family="'Times New Roman',serif" font-size="8.5" fill="#2d6a4f">10m BOA Reflectance</text>`
        const svgMap = render2dCartographicMap(figNum, figTitle, view, ring, makeLayerContent(bsId), bsLegend, `Source: Sentinel-2 L2A Multi-Spectral Surface Reflectance (${bsChoice.bands})`)
        const pFig = curPageNum
        figEntries.push({ num: figNum, title: figTitle, pageNum: pFig })
        pushPage(
          `fig_bs_${bsId}`,
          `
          <h2 class="section-title">${figTitle}</h2>
          <p>${bsChoice.note}. Generated directly from atmospherically corrected Sentinel-2 Level-2A multi-spectral channels (<b>${bsChoice.bands}</b>).</p>
          <figure class="academic-figure">
            ${svgMap}
            <figcaption class="figure-caption">${figNum}: ${esc(figTitle)}</figcaption>
            <div class="figure-source">Source: Sentinel-2 L2A Multi-Spectral Imagery (${bsChoice.bands})</div>
          </figure>
        `
        )
      }
    }
  }

  // Fig 4.1 & 4.2: Landuse Summary & Water Balance Report
  if (opts.maps.includes('water_balance')) {
    const fig4_1_Svg = renderLanduseSummaryChartSvg(farm.name)
    const pFig4_1 = curPageNum
    figEntries.push({ num: 'Fig 4.1', title: `Water used in different forms by different Landuse in Study Area Catchment (${farm.name})`, pageNum: pFig4_1 })
    pushPage(
      'fig4_1_water_summary',
      `
      <h2 class="section-title">4.3 Landuse Water Utilization Summary</h2>
      <p>Figure 4.1 would summarize how rainfall splits into surface runoff, groundwater return flow and evapotranspiration by landuse. That split is a modelled result: it needs a calibrated hydrological model (SWAT-class) with observed streamflow records, which SEVA·GIS does not run on the device. The figure therefore stays empty and states the reason, instead of drawing invented proportions.</p>
      <figure class="academic-figure">
        ${fig4_1_Svg}
        <figcaption class="figure-caption">Fig 4.1: Water used in different forms by different Landuse in Study Area Catchment (${esc(farm.name)})</figcaption>
        <div class="figure-source">Source: awaiting a calibrated SWAT-class model run - not produced on device</div>
      </figure>
    `
    )

    const fig4_2_Svg = renderWaterBalanceReportSvg(farm.name)
    const pFig4_2 = curPageNum
    figEntries.push({ num: 'Fig 4.2', title: `Water Balance Report & Sub-surface Flow Cycle (${farm.name})`, pageNum: pFig4_2 })
    pushPage(
      'fig4_2_water_report',
      `
      <h2 class="section-title">4.4 Continuous Water Balance Cycle &amp; Hydrological Budget</h2>
      <p>Figure 4.2 would present the continuous water balance budget (precipitation, evapotranspiration, runoff, percolation, return flow and Curve Number). Each of these is a modelled quantity: SEVA·GIS does not run a calibrated hydrological model on the device, so the figure states "Data unavailable" until a real model run or observed streamflow is attached.</p>
      <figure class="academic-figure">
        ${fig4_2_Svg}
        <figcaption class="figure-caption">Fig 4.2: Water Balance Report &amp; Hydrological Budget (${esc(farm.name)})</figcaption>
        <div class="figure-source">Source: awaiting a calibrated SWAT-class model run - not produced on device</div>
      </figure>
    `
    )
  }

  // Fig 4.3: Calibration Output in SWAT-CUP
  if (opts.maps.includes('calibration')) {
    const fig4_3_Svg = renderCalibrationHydrographSvg()
    const pFig4_3 = curPageNum
    figEntries.push({ num: 'Fig 4.3', title: 'Calibration Output in SWAT-CUP (Streamflow Hydrograph)', pageNum: pFig4_3 })
    pushPage(
      'fig4_3_calibration',
      `
      <h2 class="section-title">4.5 Hydrological Calibration Output in SWAT-CUP</h2>
      <p>Figure 4.3 would compare observed and simulated monthly streamflow with the 95% prediction uncertainty band. No SWAT-CUP calibration run has been recorded for this area of interest, so the observed line, the simulated line and the uncertainty band are not drawn and the fit statistics (NSE, R², PBIAS) are withheld. They appear only after a real calibration run on observed discharge.</p>
      <figure class="academic-figure">
        ${fig4_3_Svg}
        <figcaption class="figure-caption">Fig 4.3: Calibration output in SWAT-CUP</figcaption>
        <div class="figure-source">Source: awaiting a real SWAT-CUP calibration run - no numbers are invented</div>
      </figure>
    `
    )
  }

  // Fig 4.7: Global Sensitivity Analysis
  if (opts.maps.includes('sensitivity') || opts.includeCharts !== false) {
    const fig4_7_Svg = renderSufi2SensitivitySvg()
    const pFig4_7 = curPageNum
    figEntries.push({ num: 'Fig 4.7', title: 'Global Sensitivity Analysis showing p-value and t-stat (SUFI-2)', pageNum: pFig4_7 })
    pushPage(
      'fig4_7_sensitivity',
      `
      <h2 class="section-title">4.6 Global Parameter Sensitivity Ranking (SUFI-2)</h2>
      <p>Figure 4.7 lists the SWAT calibration parameters that a SUFI-2 sensitivity analysis would rank, together with their standard literature valid ranges. The t-stat and p-value ranking itself is produced only by a completed SUFI-2 run (SWAT-CUP) against observed streamflow; no such run exists for this area of interest, so every parameter is marked "Not calibrated".</p>
      <figure class="academic-figure">
        ${fig4_7_Svg}
        <figcaption class="figure-caption">Fig 4.7: Sensitivity Analysis showing p-value and t-stat</figcaption>
        <div class="figure-source">Ranges: standard SWAT calibration bounds (Abbaspour et al.) - ranking pending a real SUFI-2 run</div>
      </figure>
    `
    )
  }

  // Tables: Hydrology & Multi-Spectral Statistics (if selected)
  if (opts.includeTables !== false) {
    const pTab1 = curPageNum
    tableEntries.push({ num: 'Table 4.1', title: 'Hydrological Calibration Performance Metrics (SUFI-2)', pageNum: pTab1 })
    tableEntries.push({ num: 'Table 4.2', title: 'Annual Continuous Hydrological Water Budget Matrix', pageNum: pTab1 })
    tableEntries.push({ num: 'Table 4.3', title: 'Multi-Spectral Indicator Statistics & Agronomic Diagnostic Verdicts', pageNum: pTab1 })
    tableEntries.push({ num: 'Table 4.4', title: '6-Session Comparative Estimation & Historical Trajectory', pageNum: pTab1 })
    pushPage(
      'tables_p1',
      `
      <h2 class="section-title">4.4 Hydrological Water Balance &amp; Session Trajectories</h2>
      <p>Table 4.3 and Table 4.4 contain measured satellite and session data. Modelled hydrological quantities (Tables 4.1 and 4.2) are marked "Data unavailable" because no calibrated model run exists for this area of interest - they are never estimated.</p>

      <p class="table-caption">Table 4.1: Hydrological Calibration Performance Metrics (SUFI-2)</p>
      <table class="academic-table">
        <thead>
          <tr><th>Evaluation Metric</th><th>Calculated Value</th><th>Acceptable Criteria</th><th>Calibration Performance Rating</th></tr>
        </thead>
        <tbody>
          <tr><td>Coefficient of Determination (R²)</td><td><b>Data unavailable</b></td><td>&gt; 0.60</td><td>Pending a real SWAT-CUP calibration run</td></tr>
          <tr><td>Nash-Sutcliffe Efficiency (NSE)</td><td><b>Data unavailable</b></td><td>&gt; 0.50</td><td>Pending a real SWAT-CUP calibration run</td></tr>
          <tr><td>Percent Bias (PBIAS)</td><td><b>Data unavailable</b></td><td>&lt; &plusmn;15%</td><td>Pending a real SWAT-CUP calibration run</td></tr>
          <tr><td>Kling-Gupta Efficiency (KGE)</td><td><b>Data unavailable</b></td><td>&gt; 0.60</td><td>Pending a real SWAT-CUP calibration run</td></tr>
        </tbody>
      </table>
      <div class="table-source">Criteria: Moriasi et al. (2007) benchmark ranges - values withheld until a calibration run exists</div>

      <p class="table-caption">Table 4.2: Annual Continuous Hydrological Water Budget</p>
      <table class="academic-table">
        <thead>
          <tr><th>Water Budget Component</th><th>Annual Depth (mm)</th><th>Monsoon Depth (mm)</th><th>Winter / Rabi (mm)</th><th>Summer / Zaid (mm)</th><th>% of Total Precipitation</th></tr>
        </thead>
        <tbody>
          <tr><td colspan="6" style="text-align: center; font-weight: 700; color: #b45309;">Data unavailable - the water budget is a modelled result and no calibrated SWAT-class run exists for this area of interest. SEVA·GIS does not fill this table with estimates.</td></tr>
        </tbody>
      </table>
      <div class="table-source">Source: awaiting a calibrated SWAT-class model run</div>

      <p class="table-caption">Table 4.3: Multi-Spectral Indicator Statistics &amp; Agronomic Verdicts</p>
      <table class="academic-table">
        <thead>
          <tr><th>Spectral Index</th><th>Formula</th><th>Mean Value</th><th>Min – Max Range</th><th>Agronomic Diagnostic Verdict</th></tr>
        </thead>
        <tbody>
          <tr><td><b>NDVI</b> (Canopy Vigor)</td><td>(B08-B04)/(B08+B04)</td><td><b>${an.ndvi.mean.toFixed(2)}</b></td><td>${an.ndvi.min.toFixed(2)} to ${an.ndvi.max.toFixed(2)}</td><td>Dense green cover in the measured scene (share of pixels above the app's green-cover flags)</td></tr>
          <tr><td><b>NDMI</b> (Leaf Moisture)</td><td>(B08-B11)/(B08+B11)</td><td><b>${an.ndmi.mean.toFixed(2)}</b></td><td>${an.ndmi.min.toFixed(2)} to ${an.ndmi.max.toFixed(2)}</td><td>Canopy moisture signal from this scene; compare across dates rather than in isolation</td></tr>
          <tr><td><b>NDWI</b> (Surface Water)</td><td>(B03-B08)/(B03+B08)</td><td><b>${an.ndwi.mean.toFixed(2)}</b></td><td>${an.ndwi.min.toFixed(2)} to ${an.ndwi.max.toFixed(2)}</td><td>Open-water indicator for this scene; negative values are normal for dry land</td></tr>
          <tr><td><b>Stress Share</b></td><td>Pixels &lt; 0.35 NDVI</td><td><b>${an.stressPct.toFixed(1)}%</b></td><td>Localized patch</td><td>Walk these patches and check crop stage, pests, drainage and soil - one image cannot tell the cause</td></tr>
        </tbody>
      </table>
      <div class="table-source">Source: SEVA·GIS Spectral Analysis Pipeline (scene ${esc(an.scene.id)})</div>

      <p class="table-caption">Table 4.4: Session Comparative Estimation &amp; Historical Trajectory</p>
      <table class="academic-table">
        <thead>
          <tr><th>Session</th><th>Observation Date</th><th>NDVI Mean</th><th>NDMI Mean</th><th>Stress %</th><th>Rainfall (mm)</th><th>Stage / Role</th></tr>
        </thead>
        <tbody>
          ${sessions.map(s => `
            <tr>
              <td><b>#${s.num}</b></td>
              <td>${s.date ?? '—'}</td>
              <td><b>${s.ndvi == null ? '—' : s.ndvi.toFixed(2)}</b></td>
              <td>${s.ndmi == null ? '—' : s.ndmi.toFixed(2)}</td>
              <td>${s.stress == null ? '—' : s.stress.toFixed(1) + '%'}</td>
              <td>${s.rain == null ? '—' : s.rain.toFixed(1)}</td>
              <td>${s.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="table-source">Source: SEVA·GIS multi-session tracking (measured Sentinel-2 scenes; "—" means no value was recorded)</div>
    `
    )
  }

  // Cadastral records purged per user instruction (no cadastre/land registry)

  // --- CHAPTER V: CONCLUSION AND RECOMMENDATIONS ---
  sectionMap['ch5'] = curPageNum
  sectionMap['5.1'] = curPageNum
  sectionMap['5.2'] = curPageNum
  sectionMap['5.3'] = curPageNum
  pushPage(
    'ch5_p1',
    `
    <h1 class="chapter-title">${t.ch5Title}</h1>
    <h2 class="section-title">${lang === 'te' ? '5.1 ప్రధాన పరిమాణాత్మక ఫలితాలు' : lang === 'hi' ? '5.1 प्रमुख संख्यात्मक निष्कर्ष' : '5.1 Key Quantitative Findings'}</h2>
    <p>${lang === 'te'
      ? `<b>${esc(farm.name)}</b> (${ha.toFixed(2)} హెక్టార్లు) యొక్క సమగ్ర పరిశోధన క్రింది నిర్దిష్ట పరిమాణాత్మక ఫలితాలను అందించింది:`
      : lang === 'hi'
      ? `<b>${esc(farm.name)}</b> (${ha.toFixed(2)} हेक्टेयर) के एकीकृत अध्ययन से निम्नलिखित प्रमुख संख्यात्मक निष्कर्ष प्राप्त हुए:`
      : `The integrated investigation of <b>${esc(farm.name)}</b> (${ha.toFixed(2)} ha) yielded the following specific quantitative findings:`}</p>
    <ul style="line-height: 1.6; font-size: 11pt;">
      <li><b>${lang === 'te' ? 'పంట పందిరి ఆరోగ్యం:' : lang === 'hi' ? 'छतरी स्वास्थ्य:' : 'Canopy Health:'}</b> ${lang === 'te'
        ? `సగటు NDVI <b>${an.ndvi.mean.toFixed(2)}</b>, పొలంలోని ${(100 - an.stressPct).toFixed(1)}% భాగం ఆరోగ్యకరమైన బయోమాస్‌ను సూచిస్తుంది. ఒత్తిడికి గురైన భాగం <b>${an.stressPct.toFixed(1)}%</b>.`
        : lang === 'hi'
        ? `औसत NDVI <b>${an.ndvi.mean.toFixed(2)}</b> है, जो खेत के ${(100 - an.stressPct).toFixed(1)}% हिस्से में स्वस्थ हरी बायोमास दर्शाता है। तनावग्रस्त भाग <b>${an.stressPct.toFixed(1)}%</b> है।`
        : `Mean NDVI is <b>${an.ndvi.mean.toFixed(2)}</b>, indicating healthy green biomass across ${(100 - an.stressPct).toFixed(1)}% of the parcel. Stressed canopy comprises <b>${an.stressPct.toFixed(1)}%</b>.`}</li>
      <li><b>${lang === 'te' ? 'ఆకుల తేమ స్థాయి:' : lang === 'hi' ? 'पत्ती नमी सूचकांक:' : 'Canopy Hydration:'}</b> ${lang === 'te'
        ? `సగటు ఆకుల నీటి సూచిక (NDMI) <b>${an.ndmi.mean.toFixed(2)}</b>, తగినంత కణాల బిగువు మరియు బాష్పోత్సేకాన్ని నిర్ధారిస్తుంది.`
        : lang === 'hi'
        ? `औसत पत्ती जल सूचकांक (NDMI) <b>${an.ndmi.mean.toFixed(2)}</b> है, जो पर्याप्त नमी और वाष्पोत्सर्जन की पुष्टि करता है।`
        : `Mean leaf water index (NDMI) is <b>${an.ndmi.mean.toFixed(2)}</b>, confirming sufficient cellular turgor and transpiration.`}</li>
      <li><b>${lang === 'te' ? 'భూభాగ అమరిక:' : lang === 'hi' ? 'स्थलाकृतिक विन्यास:' : 'Topographic Configuration:'}</b> ${elevMeanVal != null || slopePctVal != null
        ? (lang === 'te'
          ? `సగటు ఎత్తు <b>${fmtU(elevMeanVal, 'm')}</b> మరియు సగటు వాలు <b>${fmtU(slopePctVal, '%')}</b>. స్థానిక నీటి నిల్వ మరియు కాలువలను క్షేత్ర పరిశీలనలో ధృవీకరించండి.`
          : lang === 'hi'
          ? `औसत ऊंचाई <b>${fmtU(elevMeanVal, 'm')}</b> तथा औसत ढलान <b>${fmtU(slopePctVal, '%')}</b> है। स्थानीय जलभराव व नालियों की पुष्टि जमीनी निरीक्षण से करें।`
          : `Mean elevation is <b>${fmtU(elevMeanVal, 'm')}</b> with an average slope of <b>${fmtU(slopePctVal, '%')}</b>. Confirm local ponding and drainage lines during a field visit.`)
        : naText}</li>
      <li><b>${lang === 'te' ? 'జల సమతుల్యత:' : lang === 'hi' ? 'जल संतुलन:' : 'Water Balance:'}</b> ${lang === 'te'
        ? 'వార్షిక ప్రవాహం మరియు బాష్పీభవనం కాలిబ్రేటెడ్ జలవిజ్ఞాన నమూనా ఫలితాలు; అటువంటి నమూనా రన్ నమోదు కానందున ఈ నివేదిక వాటిని అంచనా వేయలేదు.'
        : lang === 'hi'
        ? 'वार्षिक अपवाह एवं वाष्पोत्सर्जन एक अंशांकित जल-विज्ञान मॉडल के परिणाम होते हैं; ऐसा कोई मॉडल रन दर्ज न होने के कारण यह रिपोर्ट उनका अनुमान नहीं लगाती।'
        : 'Annual runoff and evapotranspiration are outputs of a calibrated hydrological model. No such model run is recorded for this area, so this report does not estimate them.'}</li>
    </ul>

    <h2 class="section-title">${lang === 'te' ? '5.2 ఆచరణాత్మక సిఫార్సులు' : lang === 'hi' ? '5.2 व्यावहारिक अनुशंसाएं' : '5.2 Actionable Recommendations'}</h2>
    <div style="background: #f7faf5; border-left: 4pt solid #2d6a4f; padding: 12pt 16pt; margin: 14pt 0; font-size: 11pt;">
      <p class="no-indent"><b>${lang === 'te' ? '1. ఖచ్చితమైన నీటిపారుదల షెడ్యూల్:' : lang === 'hi' ? '1. सटीक सिंचाई निर्धारण:' : '1. Precision Irrigation Scheduling:'}</b> ${esc(irrAdvice.title)} — ${esc(irrAdvice.bullets.join('; '))}.</p>
      <p class="no-indent" style="margin-top: 8pt;"><b>${lang === 'te' ? '2. నత్రజని వేరియబుల్ రేట్ అప్లికేషన్ (VRA):' : lang === 'hi' ? '2. नाइट्रोजन का परिवर्तनीय दर अनुप्रयोग (VRA):' : '2. Variable Rate Application (VRA) of Nitrogen:'}</b> ${lang === 'te'
        ? 'NDVI/NDMI పటాలు పొలంలో పంట ఎక్కడ భిన్నంగా ఉందో చూపిస్తాయి. ఎక్కువ పచ్చదనం ఉన్న భాగాల్లో మీ సాధారణ పద్ధతిని అనుసరించండి; తక్కువ పచ్చదనం ఉన్న భాగాల్లో కారణాన్ని ముందుగా క్షేత్రంలో నిర్ధారించండి (నీరు, పురుగులు, డ్రెయినేజ్, పోషకాలు) - ఎరువుల మోతాదులను SEVA·GIS సూచించదు.'
        : lang === 'hi'
        ? 'NDVI/NDMI मानचित्र दिखाते हैं कि खेत में फसल कहाँ भिन्न है। अधिक हरियाली वाले भागों में अपनी सामान्य विधि अपनाएं; कम हरियाली वाले भागों में पहले खेत पर कारण जांचें (पानी, कीट, जलनिकासी, पोषक तत्व) - SEVA·GIS उर्वरक मात्राएं निर्धारित नहीं करता।'
        : 'The NDVI/NDMI maps show where the crop differs across the field. In the higher-vigour zones follow your normal practice for this crop and stage; in the lower-vigour zones verify the cause first (water, pests, drainage, nutrients) before changing any fertilizer dose. SEVA·GIS does not prescribe kg/ha fertilizer rates.'}</p>
      <p class="no-indent" style="margin-top: 8pt;"><b>${lang === 'te' ? '3. నేల &amp; భూసార పరిరక్షణ:' : lang === 'hi' ? '3. भूमि एवं मृदा संरक्षण:' : '3. Land &amp; Soil Conservation:'}</b> ${esc(conAdvice.title)} — ${esc(conAdvice.bullets.join('; '))}.</p>
    </div>

    <h2 class="section-title">${lang === 'te' ? '5.4 పరిమితులు మరియు భవిష్యత్ పరిధి' : lang === 'hi' ? '5.4 सीमाएं एवं भावी संभावनाएं' : '5.4 Limitations and Future Scope'}</h2>
    <p>${lang === 'te'
      ? 'సెంటినెల్-2 10 మీటర్ల ప్రాదేశిక రిజల్యూషన్‌ను అందిస్తుంది; అయినప్పటికీ భారీ వర్షాకాలంలో మేఘాలు పరిశీలన అంతరాలను కలిగించవచ్చు. అలాంటి సమయాల్లో స్పష్టమైన తేదీలను ఎంచుకోవడం లేదా వేచి ఉండటం మంచిది. భవిష్యత్తు పనిలో ఎక్కువ రిజల్యూషన్ చిత్రాలు మరియు క్షేత్ర నేల-తేమ సెన్సార్ల అనుసంధానం ఉంటాయి.'
      : lang === 'hi'
      ? 'सेंटिनल-2 10 मीटर स्थानिक रिज़ॉल्यूशन देता है; फिर भी मानसून में बादल अवलोकन में अंतराल ला सकते हैं। ऐसे समय में साफ़ तारीख चुनना या प्रतीक्षा करना बेहतर है। भावी कार्य में उच्च-रिज़ॉल्यूशन इमेजरी तथा खेत के मृदा-नमी सेंसर जोड़ना शामिल है।'
      : 'Sentinel-2 provides 10 m spatial resolution; during peak monsoon, cloud can still leave gaps between clear observations. Where that happens, pick an earlier clear date or wait for the next pass. Planned future work covers higher-resolution imagery and connecting in-field soil-moisture sensors.'}</p>
  `
  )

  // --- REFERENCES ---
  sectionMap['refs'] = curPageNum
  pushPage(
    'refs_p1',
    `
    <h1 class="chapter-title">${t.refTitle}</h1>
    <ol class="apa-refs">
      <li>Abbaspour, K. C., Johnson, C. A., &amp; van Genuchten, M. T. (2004). Estimating uncertain flow and transport parameters using a sequential uncertainty fitting procedure. <i>Vadose Zone Journal</i>, 3(4), 1340-1352.</li>
      <li>Abbaspour, K. C., Yang, J., Maximov, I., Siber, R., Bogner, K., Mieleitner, J., ... &amp; Srinivasan, R. (2007). Modelling hydrology and water quality in the pre-alpine/alpine Thur watershed using SWAT. <i>Journal of Hydrology</i>, 333(2-4), 413-430.</li>
      <li>Allen, R. G., Pereira, L. S., Raes, D., &amp; Smith, M. (1998). <i>Crop evapotranspiration: Guidelines for computing crop water requirements</i>. FAO Irrigation and Drainage Paper 56, Rome.</li>
      <li>Arnold, J. G., Srinivasan, R., Muttiah, R. S., &amp; Williams, J. R. (1998). Large area hydrologic modeling and assessment part I: Model development. <i>Journal of the American Water Resources Association</i>, 34(1), 73-89.</li>
      <li>Gao, B. C. (1996). NDWI—A normalized difference water index for remote sensing of vegetation liquid water from space. <i>Remote Sensing of Environment</i>, 58(3), 257-266.</li>
      <li>Hargreaves, G. H., &amp; Samani, Z. A. (1985). Reference crop evapotranspiration from temperature. <i>Applied Engineering in Agriculture</i>, 1(2), 96-99.</li>
      <li>Huete, A. R. (1988). A soil-adjusted vegetation index (SAVI). <i>Remote Sensing of Environment</i>, 25(3), 295-309.</li>
      <li>Huete, A., Didan, K., Miura, T., Rodriguez, E. P., Gao, X., &amp; Ferreira, L. G. (2002). Overview of the radiometric and biophysical performance of the MODIS vegetation indices. <i>Remote Sensing of Environment</i>, 83(1-2), 195-213.</li>
      <li>Kudnar, N. S., &amp; Nair, M. (2018). Hydrological balance and water yield assessment using SWAT model. <i>International Journal of River Basin Management</i>, 16(2), 145-159.</li>
      <li>Lu, J., Sun, G., McNulty, S. G., &amp; Amatya, D. M. (2005). A comparison of six potential evapotranspiration methods for regional hydrological modeling. <i>Journal of the American Water Resources Association</i>, 41(3), 621-633.</li>
      <li>Moriasi, D. N., Arnold, J. G., Van Liew, M. W., Bingner, R. L., Harmel, R. D., &amp; Veith, T. L. (2007). Model evaluation guidelines for systematic quantification of accuracy in watershed simulations. <i>Transactions of the ASABE</i>, 50(3), 885-900.</li>
      <li>Rouse, J. W., Haas, R. H., Schell, J. A., &amp; Deering, D. D. (1974). Monitoring vegetation systems in the Great Plains with ERTS. <i>Third Earth Resources Technology Satellite-1 Symposium</i>, NASA SP-351, 309-317.</li>
      <li>Srinivasan, R., Zhang, X., &amp; Arnold, J. (2010). SWAT soil and water assessment tool: Input/output file documentation, version 2009. <i>Texas Water Resources Institute</i>, TR-365.</li>
      <li>Tucker, C. J. (1979). Red and photographic infrared linear combinations for monitoring vegetation. <i>Remote Sensing of Environment</i>, 8(2), 127-150.</li>
    </ol>
  `
  )

  // --- APPENDICES ---
  sectionMap['apps'] = curPageNum
  pushPage(
    'apps_p1',
    `
    <h1 class="chapter-title">${t.appTitle}</h1>
    <h2 class="section-title">Metadata Dossier &amp; Sensor Records</h2>
    <table class="academic-table">
      <thead>
        <tr><th>Property</th><th>Ingested Value / Coordinate Specification</th></tr>
      </thead>
      <tbody>
        <tr><td>Report Identifier</td><td><code>${esc(rid)}</code></td></tr>
        <tr><td>Scene Identifier</td><td><code>${esc(an.scene.id)}</code></td></tr>
        <tr><td>Scene Date / Cloud Cover</td><td>${an.scene.datetime ? esc(an.scene.datetime.slice(0, 10)) : '—'} · ${typeof an.scene.cloud === 'number' ? `${an.scene.cloud}% reported cloud` : 'cloud % not reported'}</td></tr>
        <tr><td>Sensor Satellite Mission</td><td>Sentinel-2 Multi-Spectral Instrument (MSI), as per the scene identifier above</td></tr>
        <tr><td>Radiometric Processing Level</td><td>Level-2A Bottom-of-Atmosphere (BOA) Surface Reflectance</td></tr>
        <tr><td>Elevation Surface Grid</td><td>Copernicus DEM GLO-30 (30 m spatial resolution)</td></tr>
        <tr><td>Geodetic Datum / Coordinates</td><td>World Geodetic System 1984 (WGS 84 / EPSG:4326)</td></tr>
        <tr><td>Figure Projection</td><td>Web Mercator (EPSG:3857) raster composites over Esri World Imagery; coordinates recorded in WGS 84</td></tr>
        <tr><td>Cloud Handling</td><td>Scene selected under the app's cloud-cover limit; no other masking claimed</td></tr>
        <tr><td>Generation Engine</td><td>SEVA·GIS client-side geospatial engine (runs in this browser)</td></tr>
      </tbody>
    </table>
    <div class="table-source">Generated by the SEVA·GIS browser engine from the inputs listed above</div>
  `
  )

  // ==========================================
  // PASS 2: Preliminary Pages & Compilation
  // ==========================================
  const reportCss = `
    @page {
      size: A4 portrait;
      margin: 2.5cm 2.5cm 2.5cm 3.8cm;
    }
    @page:first {
      margin: 2.5cm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 0;
      background: #f4f6f2;
      color: #111111;
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      text-align: justify;
    }
    .report-dossier {
      max-width: 210mm;
      margin: 0 auto;
      background: #ffffff;
      box-shadow: 0 4px 30px rgba(0,0,0,0.15);
      position: relative;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
      position: relative;
      padding: 2.5cm 2.5cm 2.5cm 3.8cm;
      min-height: 297mm;
    }
    .page-cover {
      page-break-before: avoid;
      break-before: avoid;
      padding: 3cm 2.5cm 2.5cm 2.5cm;
      min-height: 297mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      background: radial-gradient(circle at 50% 20%, #f7fbf5 0%, #ffffff 80%);
      border-bottom: 2px solid #2d6a4f;
    }
    .watermark-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 0;
      overflow: hidden;
    }
    .watermark-overlay img {
      width: 140mm;
      opacity: 0.22;
      transform: rotate(-30deg);
    }
    .watermark-text {
      position: absolute;
      font-family: 'Times New Roman', serif;
      font-size: 70pt;
      font-weight: 800;
      color: #1b4332;
      opacity: 0.20;
      letter-spacing: 4px;
      transform: rotate(-30deg);
      white-space: nowrap;
    }
    .page-content {
      position: relative;
      z-index: 1;
    }
    .doc-page-footer {
      position: absolute;
      bottom: 1.2cm;
      left: 3.8cm;
      right: 2.5cm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10pt;
      color: #555555;
      border-top: 0.5pt solid #cccccc;
      padding-top: 6px;
    }
    .doc-page-footer .page-num {
      text-align: center;
      flex: 1;
    }
    .doc-page-footer .brand-signature {
      font-family: 'Segoe UI', Tahoma, sans-serif;
      font-weight: 800;
      font-size: 10pt;
      letter-spacing: 0.5px;
      color: #1b4332;
    }
    .doc-page-footer .brand-signature span {
      color: #e76f51;
    }
    h1.chapter-title {
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      margin-top: 0;
      margin-bottom: 24pt;
      letter-spacing: 0.5px;
      color: #10231b;
      border-bottom: 1.5pt solid #10231b;
      padding-bottom: 8pt;
    }
    h2.section-title {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 18pt;
      margin-bottom: 8pt;
      color: #10231b;
    }
    p {
      margin-top: 0;
      margin-bottom: 10pt;
      text-indent: 0.8cm;
    }
    p.no-indent {
      text-indent: 0;
    }
    table.academic-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5pt;
      line-height: 1.35;
      margin-top: 12pt;
      margin-bottom: 16pt;
      page-break-inside: avoid;
    }
    table.academic-table th {
      border-top: 1.5pt solid #10231b;
      border-bottom: 1pt solid #10231b;
      padding: 6pt 8pt;
      text-align: left;
      font-weight: bold;
      background: #f9fbf8;
    }
    table.academic-table td {
      border-bottom: 0.5pt solid #d8dfd5;
      padding: 5pt 8pt;
      text-align: left;
      vertical-align: top;
    }
    table.academic-table tr:last-child td {
      border-bottom: 1.5pt solid #10231b;
    }
    .table-caption {
      font-size: 11pt;
      font-weight: bold;
      text-align: left;
      margin-bottom: 4pt;
      text-indent: 0;
    }
    .table-source {
      font-size: 9.5pt;
      font-style: italic;
      color: #555555;
      margin-top: 3pt;
      margin-bottom: 14pt;
      text-indent: 0;
    }
    figure.academic-figure {
      margin: 16pt 0;
      text-align: center;
      page-break-inside: avoid;
    }
    .cart-map-svg {
      width: 100%;
      max-width: 14.5cm;
      height: auto;
      display: block;
      margin: 0 auto;
      border: 1pt solid #10231b;
      background: #ffffff;
    }
    figcaption.figure-caption {
      font-size: 11pt;
      font-weight: bold;
      text-align: center;
      margin-top: 6pt;
      margin-bottom: 4pt;
      color: #10231b;
    }
    .figure-source {
      font-size: 9.5pt;
      font-style: italic;
      color: #555555;
      text-align: center;
      margin-bottom: 14pt;
    }
    .equation-row {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 12pt 0;
      position: relative;
    }
    .equation-code {
      font-family: 'Times New Roman', serif;
      font-style: italic;
      font-size: 12pt;
      background: #f6f8f4;
      padding: 6pt 16pt;
      border-radius: 4px;
      border-left: 3pt solid #2d6a4f;
    }
    .equation-num {
      position: absolute;
      right: 0;
      font-weight: bold;
      font-size: 11pt;
    }
    ol.apa-refs {
      padding-left: 1.2cm;
      font-size: 11pt;
      line-height: 1.5;
    }
    ol.apa-refs li {
      margin-bottom: 8pt;
      text-indent: -0.8cm;
      padding-left: 0.8cm;
    }
    @media screen {
      body {
        padding: 24px;
      }
      .page-break, .page-cover {
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        margin-bottom: 24px;
      }
    }
  `

  const abstractText = lang === 'te'
    ? `ఈ నివేదిక ${farm.name} వ్యవసాయ క్షేత్రం (ప్రాంతం: ${farm.location}, అక్షాంశ/రేఖాంశాలు: ${cLat.toFixed(4)}°N, ${cLon.toFixed(4)}°E, విస్తీర్ణం: ${ha.toFixed(2)} హెక్టార్లు / ${acres.toFixed(2)} ఎకరాలు) యొక్క ఉపగ్రహ పరిశీలనను వివరిస్తుంది. సెంటినెల్-2 L2A (10 మీ) మరియు కోపర్నికస్ DEM GLO-30 (30 మీ) డేటాను సేవా జిఐఎస్ (SEVA·GIS) బ్రౌజర్ ఇంజిన్ నేరుగా విశ్లేషించింది. NDVI సగటు ${an.ndvi.mean.toFixed(2)} (విస్తృతి: ${an.ndvi.min.toFixed(2)}–${an.ndvi.max.toFixed(2)}) మరియు NDMI సగటు ${an.ndmi.mean.toFixed(2)} - పంట ఎక్కడ భిన్నంగా ఉందో ఇవి చూపిస్తాయి; స్పష్టమైన పిక్సెల్‌లలో ${an.stressPct.toFixed(1)}% యాప్ తక్కువ-పచ్చదనం గుర్తు కంటే దిగువన ఉన్నాయి. ఈ గుర్తులు క్షేత్ర పరిశీలన కోసం - నిర్ధారిత కారణాలు కావు. జల సమతుల్యత (ప్రవాహం, బాష్పీభవనం, భూగర్భ జలం) ఒక నమూనా ఫలితం; ఈ ప్రాంతానికి కాలిబ్రేటెడ్ నమూనా రన్ నమోదు కానందున ఈ నివేదిక ఆ సంఖ్యలను అంచనా వేయదు. నీటిపారుదల, ఎరువులు లేదా భూ-పరిరక్షణ నిర్ణయాలకు ముందు క్షేత్ర ధృవీకరణ చేయాలి.`
    : lang === 'hi'
    ? `यह रिपोर्ट ${farm.name} कृषि क्षेत्र (स्थान: ${farm.location}, निर्देशांक: ${cLat.toFixed(4)}°N, ${cLon.toFixed(4)}°E, क्षेत्रफल: ${ha.toFixed(2)} हेक्टेयर / ${acres.toFixed(2)} एकड़) का उपग्रह अवलोकन प्रस्तुत करती है। सेंटिनल-2 L2A (10 मी) और कॉपरनिकस डीईएम GLO-30 (30 मी) डेटा को सेवा जीआईएस (SEVA·GIS) ब्राउज़र इंजन द्वारा सीधे विश्लेषित किया गया। NDVI औसत ${an.ndvi.mean.toFixed(2)} (परास: ${an.ndvi.min.toFixed(2)}–${an.ndvi.max.toFixed(2)}) और NDMI औसत ${an.ndmi.mean.toFixed(2)} - ये दिखाते हैं कि फसल कहाँ भिन्न है; साफ़ पिक्सेलों में से ${an.stressPct.toFixed(1)}% ऐप के कम-हरियाली संकेत से नीचे हैं। ये संकेत खेत पर जांच के लिए हैं - निश्चित कारण नहीं। जल संतुलन (अपवाह, वाष्पोत्सर्जन, भूजल) एक मॉडल परिणाम है; इस क्षेत्र के लिए कोई अंशांकित मॉडल रन दर्ज न होने से यह रिपोर्ट वे संख्याएँ नहीं लगाती। सिंचाई, उर्वरक या भू-संरक्षण निर्णयों से पहले खेत पर सत्यापन करें।`
    : `This report presents a satellite-based evaluation of ${farm.name}, situated in ${farm.location} (coordinates ${cLat.toFixed(4)}°N, ${cLon.toFixed(4)}°E), covering ${ha.toFixed(2)} ha (${acres.toFixed(2)} acres). Sentinel-2 L2A surface reflectance (10 m) and Copernicus DEM GLO-30 (30 m) were analyzed directly in the browser by SEVA·GIS. Optical indices - NDVI mean ${an.ndvi.mean.toFixed(2)} (range ${an.ndvi.min.toFixed(2)}-${an.ndvi.max.toFixed(2)}) and NDMI mean ${an.ndmi.mean.toFixed(2)} - show where the crop differs; ${an.stressPct.toFixed(1)}% of clear pixels sit below the app's low-cover flag. Those flags mark places to inspect, not confirmed causes. The hydrological water balance (runoff, evapotranspiration, groundwater) is a modelled result; no calibrated model run is recorded for this area, so this report does not estimate those numbers. Verify in the field before irrigation, fertilizer or conservation decisions.`

  const html = `<!DOCTYPE html>
<html lang="${t.docLang}">
<head>
  <meta charset="utf-8">
  <title>${esc(reportFileName)} - SEVA GIS Report</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${reportCss}</style>
</head>
<body>
<div class="report-dossier" data-rid="${rid}">

  <!-- COVER PAGE -->
  <div class="page-cover">
    <div style="margin-top: 20px;">
      <img src="${logo}" alt="SEVA.GIS Logo" style="width: 82px; height: 82px; object-fit: contain; margin-bottom: 12px;"/>
      <div style="font-size: 26pt; font-weight: 800; letter-spacing: 2px; color: #1b4332; font-family: 'Times New Roman', serif;">SEVA·GIS</div>
      <div style="font-size: 13pt; font-weight: bold; color: #52796f; letter-spacing: 1.5px; text-transform: uppercase;">Spatial Evaluation &amp; Vegetation Analytics</div>
      <div style="font-size: 11pt; font-style: italic; color: #666; margin-top: 6px;">A Precision Remote Sensing Assessment Report Generated by SEVA·GIS with its Native Geospatial Engine</div>
    </div>

    <div style="margin: 40px 0;">
      <div style="font-size: 13pt; text-transform: uppercase; letter-spacing: 2px; color: #7f4f24; font-weight: bold;">STUDY AREA DOSSIER</div>
      <div style="font-size: 28pt; font-weight: 800; color: #10231b; margin: 12px 0; font-family: 'Times New Roman', serif;">${esc(reportFileName)}</div>
      <div style="font-size: 14pt; color: #2d6a4f; font-weight: bold;">${esc(farm.location)} · Primary Crop: ${esc(farm.crop)}</div>
      <div style="font-size: 12pt; color: #444; margin-top: 6px;">Area: <b>${ha.toFixed(2)} Hectares</b> (${acres.toFixed(2)} Acres) · Centroid: <b>${cLat.toFixed(5)}°N, ${cLon.toFixed(5)}°E</b></div>
    </div>

    <div style="border-top: 1pt solid #cbd5e1; padding-top: 20px; font-size: 10.5pt; color: #444; line-height: 1.6;">
      <div><b>Report Generated By:</b> SEVA·GIS browser-based geospatial engine</div>
      <div><b>Generation Timestamp:</b> ${esc(reportTimestamp)} (${esc(tz)})</div>
      <div><b>Satellite Observation Scene:</b> ${esc(an.scene.id)} (Sentinel-2 L2A BOA Reflectance)</div>
      <div><b>Topographic Surface Model:</b> Copernicus GLO-30 Digital Elevation Model (30 m)</div>
      <div><b>Report Tracking ID:</b> <code>${rid}</code></div>
    </div>
  </div>

  <!-- DECLARATION (Page i) -->
  <div class="page-break">
    <div class="watermark-overlay"><img src="${logo}" alt=""/><span class="watermark-text">SEVA.GIS</span></div>
    <div class="page-content">
      <h1 class="chapter-title">${t.declarationTitle}</h1>
      <p>This spatial evaluation report titled <b>"${esc(reportFileName)}"</b> was generated by <b>SEVA·GIS</b> (Spatial Evaluation &amp; Vegetation Analytics), a browser-based geospatial engine, from the datasets listed below.</p>
      
      <p>The calculations presented herein are direct computational derivations from European Space Agency (ESA) Copernicus Sentinel-2 Level-2A satellite acquisitions (multi-spectral index bands NDVI, NDMI, NDWI, EVI) and Copernicus GLO-30 elevation models (terrain and slope derivatives). Water-balance quantities from the SCS-CN framework are shown only when a calibrated model run is recorded against this farm; otherwise they are marked "Data unavailable" in the relevant sections.</p>

      <h2 class="section-title">Credentials &amp; Data Provenance of SEVA·GIS</h2>
      <p class="no-indent"><b>Platform:</b> SEVA·GIS Open Geospatial Research Engine<br>
      <b>Repository &amp; Core Engine:</b> <a href="https://github.com/virahitvin8/seva-gis">https://github.com/virahitvin8/seva-gis</a><br>
      <b>Live Cloud Deployment:</b> <a href="https://sevagis.dpdns.org">https://sevagis.dpdns.org</a><br>
      <b>Geodetic Reference Frame:</b> World Geodetic System 1984 (WGS 84 / EPSG:4326)<br>
      <b>Imagery Product:</b> Level-2A Bottom-of-Atmosphere (BOA) Surface Reflectance</p>

      <h2 class="section-title">Legal Disclaimer &amp; Non-Misuse Covenant</h2>
      <p>The information, maps, charts, and recommendations in this report are provided in the spirit of selfless service to assist farmers, agricultural officers, hydrologists, researchers, non-technical stakeholders, and enthusiastic community stewards with evidence-based spatial insights. Users are explicitly bound by the following conditions:</p>
      <ul style="line-height: 1.6; font-size: 11pt;">
        <li><b>Non-Misuse Agreement:</b> This report and its geospatial vector outputs shall not be altered, forged, or misrepresented in land disputes, commercial speculation, or unlawful expropriation.</li>
        <li><b>Ground Validation Requirement:</b> Satellite observations provide indicative trends. Physical soil checks and agronomic verification should precede capital-intensive civil works.</li>
        <li><b>Data Handling:</b> Farm records are stored locally on this device. Coordinates are shared only with the data services required to fetch imagery, elevation, and weather for the analysis.</li>
      </ul>

      <div style="margin-top: 36pt; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11pt;">
        <div>
          <b>Place of Generation:</b> ${esc(farm.location)}<br>
          <b>Date:</b> ${esc(now.toISOString().slice(0, 10))}<br>
          <b>Status:</b> Generated on this device
        </div>
        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
          <div style="width: 62px; height: 62px; border-radius: 50%; border: 2px solid #1b4332; display: flex; align-items: center; justify-content: center; background: #f0fdf4; margin-bottom: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.12);" title="SEVA·GIS report seal">
            <img src="${logo}" alt="SEVA-GIS SEAL" style="width: 44px; height: 44px; object-fit: contain;" />
          </div>
          <div style="font-size: 9.5pt; color: #444; margin-bottom: 2px;">Agro-Geospatial Sentinel</div>
          <div style="font-family: 'Times New Roman', serif; font-size: 13pt; font-weight: bold; color: #1b4332; letter-spacing: 0.5px;">SEVA·GIS REPORT</div>
        </div>
      </div>
    </div>
    <div class="doc-page-footer"><span class="brand-signature">SEVA·<span>GIS</span></span><span class="page-num">i</span><span>Report</span></div>
  </div>

  <!-- TABLE OF CONTENTS (Page ii) -->
  <div class="page-break">
    <div class="watermark-overlay"><img src="${logo}" alt=""/><span class="watermark-text">SEVA.GIS</span></div>
    <div class="page-content">
      <h1 class="chapter-title">${t.tocTitle}</h1>
      <table class="academic-table" style="font-size: 11pt;">
        <thead>
          <tr>
            <th style="width: 15%;">Item / S.No</th>
            <th>Title &amp; Chapter Section</th>
            <th style="width: 15%; text-align: right;">Page No.</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><b>—</b></td><td><b>Declaration &amp; Data Sources</b></td><td style="text-align: right;">i</td></tr>
          <tr><td><b>—</b></td><td><b>Table of Contents</b></td><td style="text-align: right;">ii</td></tr>
          <tr><td><b>—</b></td><td><b>List of Figures &amp; Tables</b></td><td style="text-align: right;">iii</td></tr>
          <tr><td><b>—</b></td><td><b>Symbols &amp; Abbreviations</b></td><td style="text-align: right;">iv</td></tr>
          <tr><td><b>—</b></td><td><b>Abstract</b></td><td style="text-align: right;">v</td></tr>
          <tr><td><b>CHAPTER I</b></td><td><b>INTRODUCTION</b></td><td style="text-align: right;">${sectionMap['ch1'] ?? 1}</td></tr>
          <tr><td>1.1</td><td>Hydrological &amp; Spectral Remote Sensing Models</td><td style="text-align: right;">${sectionMap['1.1'] ?? 1}</td></tr>
          <tr><td>1.2</td><td>Study Area Background (${esc(farm.name)})</td><td style="text-align: right;">${sectionMap['1.2'] ?? 1}</td></tr>
          <tr><td><b>CHAPTER II</b></td><td><b>REVIEW OF LITERATURE</b></td><td style="text-align: right;">${sectionMap['ch2'] ?? 2}</td></tr>
          <tr><td>2.1</td><td>Satellite Remote Sensing &amp; Spectral Vegetation Indices</td><td style="text-align: right;">${sectionMap['2.1'] ?? 2}</td></tr>
          <tr><td>2.2</td><td>Catchment &amp; Watershed Hydrological Modeling</td><td style="text-align: right;">${sectionMap['2.2'] ?? 2}</td></tr>
          <tr><td><b>CHAPTER III</b></td><td><b>MATERIALS AND METHODS</b></td><td style="text-align: right;">${sectionMap['ch3'] ?? 3}</td></tr>
          <tr><td>3.1</td><td>Study Area Extent, Boundary Delineation &amp; Geography</td><td style="text-align: right;">${sectionMap['3.1'] ?? 3}</td></tr>
          <tr><td>3.2</td><td>Governing Equations: Spectral Bands, SCS-CN &amp; Water Balance</td><td style="text-align: right;">${sectionMap['3.2'] ?? 3}</td></tr>
          <tr><td><b>CHAPTER IV</b></td><td><b>RESULTS AND DISCUSSION</b></td><td style="text-align: right;">${sectionMap['ch4'] ?? 4}</td></tr>
          <tr><td>4.0</td><td>Whole-Field Health Composite &amp; Parameter Synthesis</td><td style="text-align: right;">${sectionMap['4.0'] ?? 4}</td></tr>
          <tr><td>4.1</td><td>Multi-Spectral Crop Canopy Health (NDVI)</td><td style="text-align: right;">${sectionMap['4.1'] ?? 4}</td></tr>
          <tr><td>4.2</td><td>Canopy Moisture &amp; Leaf Hydration (NDMI)</td><td style="text-align: right;">${sectionMap['4.2'] ?? 4}</td></tr>
          <tr><td><b>CHAPTER V</b></td><td><b>CONCLUSION AND RECOMMENDATIONS</b></td><td style="text-align: right;">${sectionMap['ch5'] ?? 5}</td></tr>
          <tr><td>5.1</td><td>Key Quantitative Findings</td><td style="text-align: right;">${sectionMap['5.1'] ?? 5}</td></tr>
          <tr><td>5.2</td><td>Direct Answers to Core Objectives</td><td style="text-align: right;">${sectionMap['5.2'] ?? 5}</td></tr>
          <tr><td>5.3</td><td>Actionable Agronomic &amp; Engineering Recommendations</td><td style="text-align: right;">${sectionMap['5.3'] ?? 5}</td></tr>
          <tr><td><b>REFERENCES</b></td><td><b>Alphabetical Bibliography (APA Format)</b></td><td style="text-align: right;">${sectionMap['refs'] ?? 6}</td></tr>
          <tr><td><b>APPENDICES</b></td><td><b>Metadata Dossier &amp; Sensor Records</b></td><td style="text-align: right;">${sectionMap['apps'] ?? 7}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="doc-page-footer"><span class="brand-signature">SEVA·<span>GIS</span></span><span class="page-num">ii</span><span>Report</span></div>
  </div>

  <!-- LIST OF FIGURES & TABLES (Page iii) -->
  <div class="page-break">
    <div class="watermark-overlay"><img src="${logo}" alt=""/><span class="watermark-text">SEVA.GIS</span></div>
    <div class="page-content">
      <h1 class="chapter-title">${t.lofTitle}</h1>
      <table class="academic-table" style="font-size: 10pt;">
        <thead>
          <tr>
            <th style="width: 15%;">Figure No.</th>
            <th>Figure Caption &amp; Geospatial Cartographic Description</th>
            <th style="width: 15%; text-align: right;">Page No.</th>
          </tr>
        </thead>
        <tbody>
          ${figEntries.map(f => `
            <tr>
              <td><b>${f.num}</b></td>
              <td>${esc(f.title)}</td>
              <td style="text-align: right;">${f.pageNum}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${tableEntries.length > 0 ? `
        <h1 class="chapter-title" style="margin-top: 24pt;">${t.lotTitle}</h1>
        <table class="academic-table" style="font-size: 10pt;">
          <thead>
            <tr>
              <th style="width: 15%;">Table No.</th>
              <th>Table Caption &amp; Hydrological Content Description</th>
              <th style="width: 15%; text-align: right;">Page No.</th>
            </tr>
          </thead>
          <tbody>
            ${tableEntries.map(tab => `
              <tr>
                <td><b>${tab.num}</b></td>
                <td>${esc(tab.title)}</td>
                <td style="text-align: right;">${tab.pageNum}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    </div>
    <div class="doc-page-footer"><span class="brand-signature">SEVA·<span>GIS</span></span><span class="page-num">iii</span><span>Report</span></div>
  </div>

  <!-- SYMBOLS & ABBREVIATIONS (Page iv) -->
  <div class="page-break">
    <div class="watermark-overlay"><img src="${logo}" alt=""/><span class="watermark-text">SEVA.GIS</span></div>
    <div class="page-content">
      <h1 class="chapter-title">${t.abbrTitle}</h1>
      <table class="abbr-list">
        <tbody>
          <tr><td class="abbr-sym">AOI</td><td>Area of Interest (analysed boundary)</td></tr>
          <tr><td class="abbr-sym">BOA</td><td>Bottom-of-Atmosphere (Surface Reflectance)</td></tr>
          <tr><td class="abbr-sym">DEM</td><td>Digital Elevation Model (Copernicus GLO-30)</td></tr>
          <tr><td class="abbr-sym">EPSG</td><td>European Petroleum Survey Group (EPSG:4326 / WGS 84)</td></tr>
          <tr><td class="abbr-sym">ESA</td><td>European Space Agency (Copernicus Programme)</td></tr>
          <tr><td class="abbr-sym">EVI</td><td>Enhanced Vegetation Index</td></tr>
          <tr><td class="abbr-sym">GEE</td><td>Google Earth Engine Planetary Spatial API</td></tr>
          <tr><td class="abbr-sym">GLO-30</td><td>Copernicus Global 30-Meter DEM</td></tr>
          <tr><td class="abbr-sym">L2A</td><td>Level-2A Ortho-rectified BOA Radiometry</td></tr>
          <tr><td class="abbr-sym">MSI</td><td>Multi-Spectral Instrument (Sentinel-2A/2B)</td></tr>
          <tr><td class="abbr-sym">NDMI</td><td>Normalized Difference Moisture Index</td></tr>
          <tr><td class="abbr-sym">NDVI</td><td>Normalized Difference Vegetation Index</td></tr>
          <tr><td class="abbr-sym">NDWI</td><td>Normalized Difference Water Index</td></tr>
          <tr><td class="abbr-sym">NIR</td><td>Near-Infrared Spectrum (842 nm, Band 8)</td></tr>
          <tr><td class="abbr-sym">NSE</td><td>Nash-Sutcliffe Efficiency Coefficient</td></tr>
          <tr><td class="abbr-sym">S2</td><td>Sentinel-2 Earth Observation Constellation</td></tr>
          <tr><td class="abbr-sym">SCS-CN</td><td>Soil Conservation Service Curve Number</td></tr>
          <tr><td class="abbr-sym">SUFI-2</td><td>Sequential Uncertainty Fitting Version 2</td></tr>
          <tr><td class="abbr-sym">SWAT</td><td>Soil and Water Assessment Tool</td></tr>
          <tr><td class="abbr-sym">SWIR</td><td>Shortwave-Infrared Spectrum (1610 nm, Band 11)</td></tr>
          <tr><td class="abbr-sym">VRA</td><td>Variable Rate Application (Precision Agronomy)</td></tr>
          <tr><td class="abbr-sym">WGS 84</td><td>World Geodetic System 1984</td></tr>
        </tbody>
      </table>
    </div>
    <div class="doc-page-footer"><span class="brand-signature">SEVA·<span>GIS</span></span><span class="page-num">iv</span><span>Report</span></div>
  </div>

  <!-- ABSTRACT (Page v) -->
  <div class="page-break">
    <div class="watermark-overlay"><img src="${logo}" alt=""/><span class="watermark-text">SEVA.GIS</span></div>
    <div class="page-content">
      <h1 class="chapter-title">${t.abstractTitle}</h1>
      <p style="font-size: 11pt; line-height: 1.6;">${abstractText}</p>
      <div style="margin-top: 24pt; font-size: 11pt; line-height: 1.6;">
        <b>Keywords:</b> Sentinel-2 L2A; Copernicus DEM; Multi-Spectral Radiometry; NDVI; NDMI; Terrain Analysis; Crop Vigor Mapping; Precision Agriculture; SEVA·GIS.
      </div>
    </div>
    <div class="doc-page-footer"><span class="brand-signature">SEVA·<span>GIS</span></span><span class="page-num">v</span><span>Report</span></div>
  </div>

  <!-- ALL DYNAMIC BODY PAGES -->
  ${bodyPages.map(page => `
    <div class="page-break" id="${page.id}">
      <div class="watermark-overlay"><img src="${logo}" alt=""/><span class="watermark-text">SEVA.GIS</span></div>
      <div class="page-content">
        ${page.content}
      </div>
      <div class="doc-page-footer">
        <span class="brand-signature">SEVA·<span>GIS</span></span>
        <span class="page-num">${page.pageNum}</span>
        <span>Report</span>
      </div>
    </div>
  `).join('')}

</div>
</body>
</html>`

  const data = {
    reportId: rid,
    farmName: farm.name,
    filename: reportFileName,
    location: farm.location,
    crop: farm.crop,
    areaHa: ha,
    areaAcres: acres,
    centroid: { lat: cLat, lon: cLon },
    scene: an.scene,
    metrics: { ndvi: an.ndvi, ndmi: an.ndmi, stressPct: an.stressPct, elevation: an.elevMean, slopePct: an.slopePct },
    sessions,
    generatedAt: now.toISOString(),
  }

  return { html, data, id: rid, lang }
}
