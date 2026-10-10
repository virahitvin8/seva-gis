import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

const STEPS = [
  ['1', 'Choose a field to review', 'Select a saved field, or draw or upload the outline of another field you want to inspect remotely.'],
  ['2', 'Open the latest clear picture', 'Check its date and cloud cover, then switch between crop cover, moisture signals, terrain, and true-colour layers.'],
  ['3', 'Compare earlier passes', 'Use Crop journal or Analysis lab to spot where the field changed over time and focus your remote review there.'],
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
