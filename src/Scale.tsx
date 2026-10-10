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

export function NumbersGuide({ ids = ['ndvi', 'ndmi'] }: { ids?: string[] }) {
  return <details className="sc-guide" open><summary>What these readings suggest for remote review</summary>
    <div className="sc-grid">
      {ids.map(id => <ScaleBox key={id} id={id}/>)}
      {GUIDES.map(g => <div className="sc-box" key={g.title}><div className="sc-title"><b>{g.title}</b><span>{g.unit}</span></div><div className="sc-bar">{g.rows.map(r => <i key={r[1]} style={{ background: r[0], flex: 1 }}/>)}</div><ul>{g.rows.map(r => <li key={r[1]}><i style={{ background: r[0] }}/><span>{r[1]}</span><code>{r[2]}</code></li>)}</ul></div>)}
    </div>
    <p className="sc-practical-note">For example, NDVI 0.74 is a green-cover signal of 0.74 on the index scale, not 0.74%. It suggests strong green cover in this image. Compare contrasting areas across clear dates; crop age, weeds, bare soil, and clouds can change what the map shows.</p>
  </details>
}

export const spectralIds = INDICATORS.filter(i => MEANING[i.id] && i.source === 'S2').map(i => i.id)
