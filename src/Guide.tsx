import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

const STEPS = [
  ['1', 'Pick your farm', 'Choose a farm from the list, or press "Add a farm" and draw it on the map.'],
  ['2', 'Look at the map', 'Press "Parameters" on the map and tick what you want to see, such as Crop greenness or Soil moisture.'],
  ['3', 'Read the colours', 'The panel beside the map tells you what each colour means. Green is usually good, red needs a look.'],
]

const WORDS: [string, string][] = [
  ['NDVI', 'Crop greenness. Higher means healthier, denser plants.'],
  ['NDMI', 'Moisture in the leaves. Low means the crop may be thirsty.'],
  ['NDRE', 'How much chlorophyll the leaves hold. Shows early stress.'],
  ['NDWI', 'Surface water. Shows ponds, tanks and flooded patches.'],
  ['NDBI', 'Built-up or bare ground, such as roads and roofs.'],
  ['DEM', 'Height of the ground above sea level.'],
  ['TWI', 'Where rain water tends to collect on the land.'],
  ['ETc / ET0', 'How much water the crop and the air take from the field each day.'],
  ['Management zones', 'Parts of the field that behave alike, so you can treat them alike.'],
  ['z-score', 'How far a spot is from the field average. Lower than -1.5 is unusually weak.'],
]

export default function Guide() {
  const [open, setOpen] = useState(() => localStorage.getItem('seva-guide') !== 'off')
  const close = () => { localStorage.setItem('seva-guide', 'off'); setOpen(false) }
  return <section className="gd">
    {open ? <div className="gd-card">
      <div className="gd-head"><strong>New here? Three easy steps</strong><button aria-label="Hide guide" onClick={close}><X size={16}/></button></div>
      <ol>{STEPS.map(s => <li key={s[0]}><b>{s[0]}</b><div><strong>{s[1]}</strong><span>{s[2]}</span></div></li>)}</ol>
    </div> : <button className="gd-reopen" onClick={() => setOpen(true)}><HelpCircle size={14}/>Show the quick guide</button>}
    <details className="gd-words"><summary>What do these short names mean?</summary>
      <dl>{WORDS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </details>
  </section>
}
