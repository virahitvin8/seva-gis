import { INDICATORS, MEANING, bandRange, byId } from './lib/indicators'

export function ScaleBox({ id, compact }: { id: string; compact?: boolean }) {
  const bands = MEANING[id]
  if (!bands) return null
  const ind = byId(id)
  return <div className={`sc-box ${compact ? 'compact' : ''}`}>
    <div className="sc-title"><b>{ind.name}</b><span>{ind.unit ? `in ${ind.unit}` : 'index score · not a percent'}</span></div>
    <div className="sc-bar">{bands.map((b, i) => <i key={b.label} style={{ background: b.color, flex: 1 }} title={`${b.label}: ${bandRange(id, i)}`}/>)}</div>
    <ul>{bands.map((b, i) => <li key={b.label}><i style={{ background: b.color }}/><span>{b.label}</span><code>{bandRange(id, i)}</code></li>)}</ul>
  </div>
}

type Row = [string, string, string]
const GUIDES: { title: string; unit: string; rows: Row[] }[] = [
  { title: 'Area with little green cover', unit: '% of clear pixels below the app’s 0.30 NDVI flag', rows: [['#1a9850', 'Few patches', '< 10 %'], ['#fee08b', 'Some patches', '10 to 25 %'], ['#d73027', 'Review more of the field', '≥ 25 %']] },
  { title: 'Surface soil moisture', unit: '% estimate for top 1 cm · broad-area model', rows: [['#d73027', 'Low estimate', '< 12 %'], ['#fee08b', 'Middle-low estimate', '12 to 20 %'], ['#80cdc1', 'Middle-high estimate', '20 to 35 %'], ['#01665e', 'High estimate', '≥ 35 %']] },
  { title: 'Rain, next 7 days', unit: 'mm', rows: [['#dfc27d', 'Little', '< 5 mm'], ['#80cdc1', 'Light', '5 to 15 mm'], ['#35978f', 'Meaningful', '15 to 40 mm'], ['#01665e', 'Heavy', '≥ 40 mm']] },
  { title: 'Terrain slope', unit: 'degrees', rows: MEANING.slope.map((b, i): Row => [b.color, b.label, bandRange('slope', i)]) },
]

export const SCIENTIFIC_TERMS: { id: string; name: string; formula: string; range: string; whatItMeans: string; whenToUse: string; limits: string }[] = [
  {
    id: 'ndvi',
    name: 'NDVI (Normalized Difference Vegetation Index)',
    formula: '(NIR - Red) / (NIR + Red)  ·  (B08 - B04) / (B08 + B04)',
    range: '-1.00 to +1.00 (dense crops: 0.50 to 0.85; bare soil: 0.10 to 0.25)',
    whatItMeans: 'Measures chlorophyll absorption in red light vs cellular scattering in near-infrared. Higher scores denote greater green foliage vigor and biomass.',
    whenToUse: 'Primary metric for tracking crop emergence, vegetative growth, in-season vigor anomalies, and harvest timing.',
    limits: 'Saturates in very dense closed canopies (> 3 LAI); sensitive to topsoil color in sparse seedling stages.'
  },
  {
    id: 'evi',
    name: 'EVI (Enhanced Vegetation Index)',
    formula: '2.5 × (NIR - Red) / (NIR + 6×Red - 7.5×Blue + 1)',
    range: '-1.00 to +1.00 (healthy crop canopy: 0.40 to 0.80)',
    whatItMeans: 'Atmospherically-corrected vegetation metric that adjusts for residual smoke, haze, and soil background brightness.',
    whenToUse: 'Use instead of NDVI in humid, hazy weather or when dense canopies cause NDVI saturation.',
    limits: 'Requires the Blue band (B02) which is more prone to atmospheric Rayleigh scatter.'
  },
  {
    id: 'msi',
    name: 'MSI (Moisture Stress Index)',
    formula: 'SWIR1 / NIR  ·  B11 / B08',
    range: '0.40 to 3.00 (low stress / wet leaves: < 0.8; high moisture stress: > 1.4)',
    whatItMeans: 'Measures leaf cellular water absorption in shortwave infrared (1610 nm) relative to near-infrared reflection. Higher values mean drier leaf tissue.',
    whenToUse: 'Detects crop water deficit days before visible wilting or foliage discoloration occurs.',
    limits: 'Can reflect bare dry soil background if crop cover is below 40%.'
  },
  {
    id: 'ndmi',
    name: 'NDMI (Normalized Difference Moisture Index)',
    formula: '(NIR - SWIR1) / (NIR + SWIR1)  ·  (B08 - B11) / (B08 + B11)',
    range: '-1.00 to +1.00 (well-hydrated canopy: 0.20 to 0.60; water stressed: < 0.10)',
    whatItMeans: 'Tracks liquid water depth contained inside plant leaf spongy mesophyll tissue across the canopy.',
    whenToUse: 'Used in irrigation scheduling and drought severity grading across agricultural seasons.',
    limits: 'Reflects total liquid water thickness; does not measure root-zone moisture below the canopy.'
  },
  {
    id: 'ndwi',
    name: 'NDWI (Normalized Difference Water Index)',
    formula: '(Green - NIR) / (Green + NIR)  ·  (B03 - B08) / (B03 + B08)',
    range: '-1.00 to +1.00 (open water bodies: > 0.00; vegetation/soil: negative)',
    whatItMeans: 'Highlights open water surfaces by maximizing green reflectance and eliminating near-infrared reflectance.',
    whenToUse: 'Delineates farm ponds, irrigation channels, flooded furrows, and post-monsoon waterlogging.',
    limits: 'Can misclassify wet dark asphalt or deep cloud shadows if not masked.'
  },
  {
    id: 'stress_pct',
    name: 'Stress Percentage (%)',
    formula: '(Pixels with NDVI < 0.30 & clear sky) / (Total clear AOI pixels) × 100',
    range: '0% to 100% (< 10% few weak patches; > 25% requires ground inspection)',
    whatItMeans: 'Proportion of clear parcel area showing sub-threshold vegetative vigor or anomalous bare ground.',
    whenToUse: 'Quick spatial screening for localized pest damage, failed germination, or clogged irrigation nozzles.',
    limits: 'Does not identify biological cause (could be rock outcropping, access track, or early harvest).'
  },
  {
    id: 'canopy_cover',
    name: 'Canopy Cover / FVC (Fractional Vegetation Cover)',
    formula: 'Estimated fractional area of vertical ground obscured by photosynthetic foliage',
    range: '0% to 100% (seedling: 5-20%; mid-season: 60-95%)',
    whatItMeans: 'Physical fraction of the parcel ground surface shielded from direct solar radiation by green leaves.',
    whenToUse: 'Estimating soil evaporation reduction, herbicide spray interception, and canopy light interception.',
    limits: 'Derived from linear index unmixing; accurate to ± 8% across moderate crop densities.'
  }
]

export function NumbersGuide({ ids = ['ndvi', 'ndmi'] }: { ids?: string[] }) {
  return <details className="sc-guide"><summary>What these readings suggest for remote review (NDVI, EVI, SAVI, NDMI, etc.)</summary>
    <div className="sc-grid">
      {ids.map(id => <ScaleBox key={id} id={id}/>)}
      {GUIDES.map(g => <div className="sc-box" key={g.title}><div className="sc-title"><b>{g.title}</b><span>{g.unit}</span></div><div className="sc-bar">{g.rows.map(r => <i key={r[1]} style={{ background: r[0], flex: 1 }}/>)}</div><ul>{g.rows.map(r => <li key={r[1]}><i style={{ background: r[0] }}/><span>{r[1]}</span><code>{r[2]}</code></li>)}</ul></div>)}
    </div>
    
    <div className="sc-glossary" style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
      <h4 style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
        Scientific Terminology &amp; Physical Formulas at a Glance
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
        {SCIENTIFIC_TERMS.map(t => (
          <div key={t.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, fontSize: 11 }}>
            <strong style={{ color: '#0f172a', display: 'block', fontSize: 11.5 }}>{t.name}</strong>
            <code style={{ display: 'block', fontSize: 10, color: '#0284c7', margin: '4px 0', background: '#e0f2fe', padding: '2px 6px', borderRadius: 4, width: 'fit-content' }}>
              {t.formula}
            </code>
            <p style={{ margin: '4px 0', color: '#334155', lineHeight: 1.4 }}>{t.whatItMeans}</p>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
              <b>Range:</b> {t.range}
            </div>
            <div style={{ fontSize: 10, color: '#059669', marginTop: 2 }}>
              <b>When to use:</b> {t.whenToUse}
            </div>
            <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>
              <b>Limitation:</b> {t.limits}
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="sc-data-disclosures" style={{ marginTop: 14, padding: '10px 12px', background: '#f1f5f9', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 10.5, color: '#475569', lineHeight: 1.5 }}>
      <strong style={{ color: '#0f172a', display: 'block', marginBottom: 4 }}>Data Source &amp; Measurement Provenance:</strong>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li><b>Satellite Imagery:</b> European Space Agency (ESA) Sentinel-2 L2A Bottom-Of-Atmosphere (BOA) surface reflectance (10 m visible/NIR, 20 m red-edge/SWIR), served via Microsoft Planetary Computer STAC / COG &amp; Google Earth Engine. Cloud/shadow masking applied via Scene Classification Layer (SCL).</li>
        <li><b>Elevation &amp; Terrain:</b> Copernicus DEM GLO-30 (30-metre global digital surface model), distributed by the European Space Agency and USGS.</li>
        <li><b>Weather &amp; Evapotranspiration:</b> Open-Meteo High-Resolution NWP forecasts (ECMWF IFS / NOAA GFS) &amp; ERA5-Land reanalysis for 7-day precipitation sum and reference evapotranspiration (ET₀).</li>
        <li><b>Soil Hydraulics:</b> ISRIC World Soil Information SoilGrids 250m machine-learning digital soil mapping (sand, silt, clay, organic carbon, pH, bulk density).</li>
      </ul>
    </div>

    <p className="sc-practical-note" style={{ marginTop: 12 }}>For example, NDVI 0.74 is a green-cover signal of 0.74 on the index scale, not 0.74%. It suggests strong green cover in this image. Compare contrasting areas across clear dates; crop age, weeds, bare soil, and clouds can change what the map shows.</p>
  </details>
}

export const spectralIds = INDICATORS.filter(i => MEANING[i.id] && i.source === 'S2').map(i => i.id)
