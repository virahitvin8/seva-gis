import { INDICATORS, MEANING, bandRange, byId } from './lib/indicators'

export function ScaleBox({ id, compact }: { id: string; compact?: boolean }) {
  const bands = MEANING[id]
  if (!bands) return null
  const ind = byId(id)
  return <div className={`sc-box ${compact ? 'compact' : ''}`}>
    <div className="sc-title"><b>{ind.name}</b><span>{ind.unit ? `in ${ind.unit}` : 'unitless, higher = more'}</span></div>
    <div className="sc-bar">{bands.map((b, i) => <i key={b.label} style={{ background: b.color, flex: 1 }} title={`${b.label}: ${bandRange(id, i)}`}/>)}</div>
    <ul>{bands.map((b, i) => <li key={b.label}><i style={{ background: b.color }}/><span>{b.label}</span><code>{bandRange(id, i)}</code></li>)}</ul>
  </div>
}

type Row = [string, string, string]
const GUIDES: { title: string; unit: string; rows: Row[] }[] = [
  { title: 'Stressed area', unit: '% of pixels with NDVI below 0.30', rows: [['#1a9850', 'Low', '< 10 %'], ['#fee08b', 'Watch', '10 to 25 %'], ['#d73027', 'Act', '≥ 25 %']] },
  { title: 'Soil moisture', unit: '% of volume, modelled surface layer', rows: [['#d73027', 'Dry', '< 12 %'], ['#fee08b', 'Low', '12 to 20 %'], ['#80cdc1', 'Adequate', '20 to 35 %'], ['#01665e', 'Wet', '≥ 35 %']] },
  { title: 'Rain, next 7 days', unit: 'mm', rows: [['#dfc27d', 'Little', '< 5 mm'], ['#80cdc1', 'Light', '5 to 15 mm'], ['#35978f', 'Meaningful', '15 to 40 mm'], ['#01665e', 'Heavy', '≥ 40 mm']] },
  { title: 'Terrain slope', unit: 'degrees', rows: MEANING.slope.map((b, i): Row => [b.color, b.label, bandRange('slope', i)]) },
]

export function NumbersGuide({ ids = ['ndvi', 'ndmi'] }: { ids?: string[] }) {
  return <details className="sc-guide" open><summary>How to read these numbers</summary>
    <div className="sc-grid">
      {ids.map(id => <ScaleBox key={id} id={id}/>)}
      {GUIDES.map(g => <div className="sc-box" key={g.title}><div className="sc-title"><b>{g.title}</b><span>{g.unit}</span></div><div className="sc-bar">{g.rows.map(r => <i key={r[1]} style={{ background: r[0], flex: 1 }}/>)}</div><ul>{g.rows.map(r => <li key={r[1]}><i style={{ background: r[0] }}/><span>{r[1]}</span><code>{r[2]}</code></li>)}</ul></div>)}
    </div>
  </details>
}

export const spectralIds = INDICATORS.filter(i => MEANING[i.id] && i.source === 'S2').map(i => i.id)
