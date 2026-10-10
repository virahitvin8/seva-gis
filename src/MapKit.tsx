import LogoLoader from './LogoLoader'
import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { farmBBox, farmRing, loadDem, type FarmData } from './lib/seva'
import { paintClipped } from './lib/raster'
import { gradientCss, type Grid } from './lib/indicators'

export type Kit = { hill: boolean; contour: boolean; aspect: boolean; dem: boolean; grid: boolean; legend: boolean }
// Keep the satellite view unobstructed on first load. Terrain and graticule layers
// remain available as opt-in overlays from the map tools.
export const KIT_DEFAULT: Kit = { hill: false, contour: false, aspect: false, dem: false, grid: false, legend: false }
type Farm = FarmData & { id: string }

const ASPECT = ['#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
const ASPECT_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const DEM_RAMP = ['#2b8a5e', '#7fbf6b', '#e8dc8a', '#c8a15a', '#8c6a43', '#e4e4e4']
const nice = (x: number, steps: number[]) => steps.find(s => s >= x) ?? steps[steps.length - 1]

function ramp(stops: string[], t: number): [number, number, number] {
  const k = Math.min(Math.max(t, 0), 1) * (stops.length - 1), i = Math.min(Math.floor(k), stops.length - 2), f = k - i
  const a = stops[i], b = stops[i + 1], c = (s: string, o: number) => parseInt(s.slice(o, o + 2), 16)
  return [1, 3, 5].map(o => Math.round(c(a, o) + (c(b, o) - c(a, o)) * f)) as [number, number, number]
}

export function contourLines(g: Grid, step: number) {
  const { w, h, bbox: [west, south, east, north], b: { elev }, ok } = g
  const lines: { level: number; pts: [number, number][] }[] = []
  const px = (x: number) => west + (x / (w - 1)) * (east - west), py = (y: number) => north - (y / (h - 1)) * (north - south)
  const v = (x: number, y: number) => elev[y * w + x]
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < w * h; i++) if (ok[i]) { lo = Math.min(lo, elev[i]); hi = Math.max(hi, elev[i]) }
  for (let lv = Math.ceil(lo / step) * step; lv <= hi; lv += step) {
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
      const c = [v(x, y), v(x + 1, y), v(x + 1, y + 1), v(x, y + 1)]
      const pts: [number, number][] = []
      const edge = (a: number, bb: number, ax: number, ay: number, bx: number, by: number) => {
        if ((c[a] < lv) !== (c[bb] < lv)) { const t = (lv - c[a]) / (c[bb] - c[a]); pts.push([py(ay + (by - ay) * t), px(ax + (bx - ax) * t)]) }
      }
      edge(0, 1, x, y, x + 1, y); edge(1, 2, x + 1, y, x + 1, y + 1); edge(3, 2, x, y + 1, x + 1, y + 1); edge(0, 3, x, y, x, y + 1)
      if (pts.length === 2) lines.push({ level: lv, pts })
      else if (pts.length === 4) { lines.push({ level: lv, pts: [pts[0], pts[1]] }, { level: lv, pts: [pts[2], pts[3]] }) }
    }
  }
  return { lines, lo, hi }
}

export default function MapKit({ map, farm, kit, farmOnly }: { map: L.Map | null; farm: Farm; kit: Kit; farmOnly: boolean }) {
  const [grid, setGrid] = useState<Grid | null>(null)
  const groups = useRef<L.LayerGroup[]>([])
  const need = kit.hill || kit.contour || kit.aspect || kit.dem
  const geo = `${farm.id}:${farm.lat}:${farm.lon}:${farm.area}:${farm.polygon?.length ?? 0}`
  const ring = useMemo(() => farmRing(farm), [geo])

  useEffect(() => {
    setGrid(null)
    if (!need) return
    let dead = false
    loadDem(farm).then(g => { if (!dead) setGrid(g) }).catch(() => {})
    return () => { dead = true }
  }, [geo, need])

  const info = useMemo(() => {
    if (!grid) return null
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < grid.w * grid.h; i++) if (grid.ok[i] && grid.inside[i]) { lo = Math.min(lo, grid.b.elev[i]); hi = Math.max(hi, grid.b.elev[i]) }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1 }
    return { lo, hi, step: nice((hi - lo) / 8, [0.5, 1, 2, 5, 10, 20, 50, 100]) }
  }, [grid])

  useEffect(() => {
    if (!map) return
    const mk = (name: string, z: number, blend?: string) => { const p = map.getPane(name) ?? map.createPane(name); p.style.zIndex = String(z); p.style.pointerEvents = 'none'; if (blend) p.style.mixBlendMode = blend; return name }
    const aspectPane = mk('kit-aspect', 270), hillPane = mk('kit-hill', 450, 'multiply'), linePane = mk('kit-lines', 460)
    const bounds = L.latLngBounds([farmBBox(farm)[1], farmBBox(farm)[0]], [farmBBox(farm)[3], farmBBox(farm)[2]])
    const out: L.LayerGroup[] = []
    const add = (...layers: L.Layer[]) => { const g = L.layerGroup(layers).addTo(map); out.push(g) }

    if (grid && info) {
      const [w, s, e, n] = grid.bbox, gb = L.latLngBounds([s, w], [n, e])
      if (kit.dem) add(L.imageOverlay(paintClipped(grid.w, grid.h, grid.bbox, ring, i => grid.ok[i] ? ramp(DEM_RAMP, (grid.b.elev[i] - info.lo) / Math.max(1, info.hi - info.lo)) : null), gb, { pane: aspectPane, opacity: 0.85 }))
      if (kit.aspect) add(L.imageOverlay(paintClipped(grid.w, grid.h, grid.bbox, ring, i => grid.ok[i] && grid.b.slope[i] > 1 ? (ASPECT[Math.round(grid.b.aspect[i] / 45) % 8].match(/\w\w/g)!.map(x => parseInt(x, 16)) as [number, number, number]) : null), gb, { pane: aspectPane, opacity: 0.75 }))
      if (kit.hill) add(L.imageOverlay(paintClipped(grid.w, grid.h, grid.bbox, ring, i => { if (!grid.ok[i]) return null; const c = Math.round(Math.min(255, grid.b.hill[i] * 1.414)); return [c, c, c] }), gb, { pane: hillPane, opacity: 0.85 }))
      if (kit.contour) {
        const { lines } = contourLines(grid, info.step)
        const idx = info.step * 5
        const layers: L.Layer[] = lines.map(l => L.polyline(l.pts, { pane: linePane, color: '#fff7d6', weight: l.level % idx === 0 ? 1.8 : 0.9, opacity: l.level % idx === 0 ? 0.95 : 0.7, interactive: false }))
        const seen = new Set<number>()
        for (const l of lines) if (l.level % idx === 0 && !seen.has(l.level)) { seen.add(l.level); layers.push(L.marker(l.pts[0], { pane: linePane, interactive: false, icon: L.divIcon({ className: 'kit-clabel', html: `${Math.round(l.level * 10) / 10} m`, iconSize: [0, 0] }) })) }
        add(...layers)
      }
    }

    if (kit.grid) {
      const [w, s, e, n] = farmBBox(farm)
      const span = Math.max(e - w, n - s), step = nice(span / 4, [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1])
      const x0 = Math.floor((w - span) / step) * step, x1 = Math.ceil((e + span) / step) * step, y0 = Math.floor((s - span) / step) * step, y1 = Math.ceil((n + span) / step) * step
      const ls: L.Layer[] = [], opt = { pane: linePane, color: '#ffffff', weight: 0.8, opacity: 0.55, dashArray: '2 5', interactive: false }
      const dp = step < 0.001 ? 4 : step < 0.01 ? 3 : 2
      for (let x = x0; x <= x1; x += step) { ls.push(L.polyline([[y0, x], [y1, x]], opt)); ls.push(L.marker([s - (n - s) * 0.04, x], { pane: linePane, interactive: false, icon: L.divIcon({ className: 'kit-glabel', html: `${x.toFixed(dp)}°E`, iconSize: [0, 0] }) })) }
      for (let y = y0; y <= y1; y += step) { ls.push(L.polyline([[y, x0], [y, x1]], opt)); ls.push(L.marker([y, w - (e - w) * 0.04], { pane: linePane, interactive: false, icon: L.divIcon({ className: 'kit-glabel r', html: `${y.toFixed(dp)}°N`, iconSize: [0, 0] }) })) }
      add(...ls)
    }
    void bounds
    groups.current = out
    return () => out.forEach(g => g.remove())
  }, [map, grid, info, kit.hill, kit.contour, kit.aspect, kit.dem, kit.grid, geo])

  useEffect(() => {
    if (!map) return
    const pane = map.getPane('mapPane')!
    const apply = () => { pane.style.clipPath = farmOnly ? `polygon(${ring.map(([lon, lat]) => { const p = map.latLngToLayerPoint([lat, lon]); return `${p.x}px ${p.y}px` }).join(',')})` : '' }
    const fb = farmBBox(farm)
    map.fitBounds(L.latLngBounds([fb[1], fb[0]], [fb[3], fb[2]]), { padding: farmOnly ? [24, 24] : [70, 70], maxZoom: 18, animate: false })
    if (!farmOnly) { apply(); return }
    const fit = L.latLngBounds([fb[1], fb[0]], [fb[3], fb[2]])
    map.setMaxBounds(fit.pad(0.08)); map.options.maxBoundsViscosity = 1
    map.setMinZoom(map.getBoundsZoom(fit.pad(0.08)) - 0.5); map.setMaxZoom(22)
    apply(); map.on('zoomend viewreset resize', apply)
    return () => { map.off('zoomend viewreset resize', apply); pane.style.clipPath = ''; map.setMaxBounds(undefined as unknown as L.LatLngBounds); map.setMinZoom(0) }
  }, [map, farmOnly, ring])

  useEffect(() => {
    if (!map) return
    const c = L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map)
    return () => { c.remove() }
  }, [map])

  return <>
    <div className="kit-frame" aria-hidden="true"/>
    <div className="kit-north" aria-label="North is up"><svg viewBox="0 0 40 52" width="34" height="44"><path d="M20 2 L32 44 L20 36 L8 44Z" fill="#f4ffd0" stroke="#10231b" strokeWidth="2" strokeLinejoin="round"/><path d="M20 2 L32 44 L20 36Z" fill="#10231b"/></svg><b>N</b></div>
    {kit.legend && need && <div className="kit-legend" aria-label="Map layer legend">
      <strong>Map layers</strong>
      {kit.dem && info && <div><span>Height above sea level</span><i style={{ background: gradientCss(DEM_RAMP) }}/><small><em>{Math.round(info.lo)} m</em><em>{Math.round(info.hi)} m</em></small></div>}
      {kit.aspect && <div><span>Which way the slope faces</span><div className="kit-asp">{ASPECT.map((c, i) => <b key={c} style={{ background: c }}>{ASPECT_NAMES[i]}</b>)}</div></div>}
      {kit.hill && <div><span>Hillshade</span><small>Light from the north-west. Dark = slopes away from the sun.</small></div>}
      {kit.contour && info && <div><span>Contour lines</span><small>One line every {info.step} m of height. Bold lines every {info.step * 5} m.</small></div>}
      {!grid && <LogoLoader inline size={28} text="Loading terrain…"/>}
    </div>}
  </>
}
