const SRC = {
  s2: 'Sentinel-2 L2A satellite images (ESA Copernicus) via Microsoft Planetary Computer. 10 m pixels, a new picture every ~5 days.',
  weather: 'Open-Meteo weather service (live forecast and archive).',
  soil: 'SoilGrids (ISRIC) 250 m soil maps. A regional estimate, not a lab test of your soil.',
  dem: 'Copernicus DEM GLO-30 terrain, 30 m.',
  esri: 'Esri World Imagery, sharp photo-style picture of the ground. The photo date can be older than today.',
  osm: 'OpenStreetMap contributors via Overpass API. Community-drawn map data that may be incomplete.',
  local: 'Calculated on your device from the shape you drew. No outside data used.',
  model: 'Calculated from the real data above using standard farming formulas (FAO). An estimate.',
} as const

export type SourceKey = keyof typeof SRC

export default function SourceNote({ of }: { of: SourceKey[] }) {
  return <p className="src-note"><b>Source:</b> {of.map(k => SRC[k]).join(' ')}</p>
}
