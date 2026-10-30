import { useState } from 'react'
import { HelpCircle, X, Compass, Layers, FileText, BarChart3, MapPin, Info } from 'lucide-react'
import { useI18n } from './lib/i18n'

const JOURNEY_STEPS = [
  {
    step: '1',
    icon: MapPin,
    title: 'Define Area of Interest (AOI)',
    desc: 'Select a saved study area, draw a custom polygon boundary on the map, or upload GeoJSON / Shapefile boundaries. All analytics strictly clip to this perimeter.'
  },
  {
    step: '2',
    icon: Layers,
    title: 'Select Analysis Intent & Acquire Scenes',
    desc: 'Choose your analytical goal (agriculture, water, terrain, land cover). Stream Sentinel-2 L2A BOA reflectance and Copernicus GLO-30 DEM with automated cloud-mask validation.'
  },
  {
    step: '3',
    icon: Compass,
    title: 'Inspect Spectral & Terrain Layers',
    desc: 'Toggle between vegetative vigour (NDVI, EVI, NDRE), moisture signals (NDMI, NDWI), terrain hydrology (DEM, Slope, TWI), and calibrated true-colour composites.'
  },
  {
    step: '4',
    icon: BarChart3,
    title: 'Evaluate Zonal Metrics & Trends',
    desc: 'Inspect pixel distributions, mean z-scores, soil profiles, and Open-Meteo forecasts. Detailed cards disclose scientific formulas, source dates, and confidence limits.'
  },
  {
    step: '5',
    icon: FileText,
    title: 'Generate Reports & Geospatial Exports',
    desc: 'Export publication-grade academic PDF dossiers, georeferenced GeoTIFF rasters (EPSG:4326), full Word (.doc) summaries, CSV datasets, and split-view comparisons.'
  }
]

const GLOSSARY_TERMS: [string, string, string][] = [
  ['NDVI', 'Normalized Difference Vegetation Index', 'Measures chlorophyll absorption and photosynthetic vigour: (B8 - B4) / (B8 + B4). Range -1 to +1; healthy dense canopy typically exceeds 0.6.'],
  ['NDMI', 'Normalized Difference Moisture Index', 'Assesses canopy liquid water content using NIR and SWIR: (B8 - B11) / (B8 + B11). Negative or falling values indicate plant moisture deficit.'],
  ['NDRE', 'Normalized Difference Red Edge', 'Chlorophyll concentration proxy using the red-edge spectrum: (B8 - B5) / (B8 + B5). Sensitive to onset of nitrogen and water stress before visible yellowing.'],
  ['NDWI', 'Normalized Difference Water Index', 'Delineates open surface water bodies and flooded land: (B3 - B8) / (B3 + B8). Values > 0 indicate standing water or waterlogged soil.'],
  ['NDBI', 'Normalized Difference Built-Up Index', 'Highlights impervious surfaces, bare rock, and settlements: (B11 - B8) / (B11 + B8). Distinguishes urban/barren land from vegetation.'],
  ['SAVI', 'Soil-Adjusted Vegetation Index', 'Corrects for background soil reflectance in low-density canopies: ((B8 - B4) / (B8 + B4 + 0.5)) × 1.5.'],
  ['EVI', 'Enhanced Vegetation Index', 'Optimized canopy structural metric that decouples atmospheric aerosols and minimizes soil background influences.'],
  ['MSI', 'Moisture Stress Index', 'Canopy moisture stress indicator: B11 / B8. As water content decreases, MSI increases.'],
  ['DEM', 'Digital Elevation Model', 'Copernicus GLO-30 elevation in metres above sea level at 30 m spatial resolution.'],
  ['TWI', 'Topographic Wetness Index', 'Secondary terrain metric quantifying topographic control on hydrological accumulation: ln(a / tan β), where a is upslope contributing area.'],
  ['Slope (°)', 'Terrain Gradient', 'Calculated using Horn 1981 3×3 convolution kernel over the DEM elevation grid.'],
  ['ET0 / ETc', 'Evapotranspiration', 'Reference (ET0) and crop (ETc = Kc × ET0) water loss via the FAO-56 Penman-Monteith energy balance equation (mm/day).'],
  ['LULC', 'Land Use / Land Cover', '9-class land classification derived from Sentinel-2 / Dynamic World mode composites with class percentage breakdowns.'],
  ['Management Zones', 'Spatial Homogeneity Clusters', 'Iso-variance spatial clusters derived from multi-temporal vegetation response for targeted sampling or treatment.'],
  ['z-score', 'Standardized Anomaly', 'Pixel variance relative to the AOI mean: (value - μ) / σ. Pixels with z < -1.5 represent statistically significant local stress.']
]

export default function Guide() {
  const { t } = useI18n()
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('seva-guide') !== 'off'
    } catch {
      return true
    }
  })

  const close = () => {
    try {
      localStorage.setItem('seva-guide', 'off')
    } catch {}
    setOpen(false)
  }

  return (
    <section className="gd" aria-label="SEVA GIS Spatial Analysis Guide">
      {open ? (
        <div className="gd-card" style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line)' }}>
          <div className="gd-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Compass size={18} style={{ color: 'var(--green)' }} />
              <strong>{t('guide.workflowTitle', 'Spatial Analysis Workflow — 5 Structured Steps')}</strong>
            </div>
            <button
              aria-label="Hide guide"
              onClick={close}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>

          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {JOURNEY_STEPS.map((s) => {
              const Icon = s.icon
              return (
                <li
                  key={s.step}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--card-subtle, rgba(0,0,0,0.03))',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))'
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: 'var(--green-glow, rgba(31,107,58,0.15))',
                      color: 'var(--green, #2e7d32)',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      fontSize: 12,
                      flexShrink: 0
                    }}
                  >
                    {s.step}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Icon size={14} style={{ color: 'var(--green)' }} />
                      <strong style={{ fontSize: 13 }}>{s.title}</strong>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted, #666)', lineHeight: 1.4, display: 'block' }}>
                      {s.desc}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      ) : (
        <button
          className="gd-reopen"
          onClick={() => setOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
        >
          <HelpCircle size={14} />
          {t('guide.showGuide', 'Show 5-Step Analysis Guide')}
        </button>
      )}

      <details className="gd-words" style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={14} />
          {t('guide.glossaryTitle', 'Scientific Glossary & Mathematical Index Definitions')}
        </summary>
        <dl style={{ margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {GLOSSARY_TERMS.map(([abbr, name, formula]) => (
            <div
              key={abbr}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                background: 'var(--card-subtle, rgba(0,0,0,0.02))',
                borderLeft: '3px solid var(--green, #2e7d32)'
              }}
            >
              <dt style={{ fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span>{abbr}</span>
                <span style={{ fontWeight: 500, fontSize: 11.5, color: 'var(--muted, #666)' }}>({name})</span>
              </dt>
              <dd style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted, #555)', lineHeight: 1.45 }}>
                {formula}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  )
}

