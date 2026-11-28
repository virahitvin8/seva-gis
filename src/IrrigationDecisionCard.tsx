import { useEffect, useMemo, useState } from 'react'
import { Droplets, CheckCircle2, Clock } from 'lucide-react'
import { EXTENDED_CROPS } from './lib/cropstages'
import { METHODS } from './lib/hydro'

type Props = {
  farmAreaHa: number
  cropName: string
  ndvi?: number
  ndmi: number
  et0Next7: number
  rainNext7: number
  soilMoisturePct: number
}

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—')

export default function IrrigationDecisionCard({
  farmAreaHa,
  cropName,
  ndvi,
  ndmi,
  et0Next7,
  rainNext7,
  soilMoisturePct,
}: Props) {
  const [selectedCrop, setSelectedCrop] = useState(() => {
    const norm = (cropName || '').toLowerCase()
    return EXTENDED_CROPS.find(c => norm.includes(c.id))?.id || (norm.includes('bare') || norm.includes('uncultivated') || norm.includes('fallow') ? 'uncultivated' : 'paddy')
  })
  const isBare = selectedCrop === 'uncultivated'

  useEffect(() => {
    const norm = (cropName || '').toLowerCase()
    setSelectedCrop(EXTENDED_CROPS.find(c => norm.includes(c.id))?.id || (norm.includes('bare') || norm.includes('uncultivated') || norm.includes('fallow') ? 'uncultivated' : 'paddy'))
  }, [cropName])
  const [irrMethod, setIrrMethod] = useState('furrow')
  const methodDef = METHODS.find(m => m.id === irrMethod) || METHODS[1]

  const calculation = useMemo(() => {
    // Effective rain (75% infiltration efficiency)
    const effRainWeekly = +(0.75 * Math.max(0, rainNext7)).toFixed(1)

    if (isBare) {
      return {
        shouldIrrigateToday: false,
        urgency: 'none' as const,
        decisionHeadline: 'No standing crop demand is included for fallow land',
        grossWaterNeededMm: 0,
        litersPerAcre: 0,
        totalVolumeM3: 0,
        why: 'If the field is fallow or uncultivated, this crop-water model has no standing crop demand. Check local soil conditions before deciding whether water is needed.',
        dailyEtc: 0,
        effRainWeekly,
        stageTitle: 'Uncultivated / Bare Soil',
        canopyNote: 'Low vegetative cover',
      }
    }

    const dailyEt0 = Math.max(1.5, et0Next7 / 7)
    const canopyFactor = (ndvi ?? 0.5) >= 0.6 ? 1.08 : (ndvi ?? 0.5) >= 0.35 ? 0.92 : 0.72
    const effectiveKc = 1.0 * canopyFactor
    const dailyEtc = dailyEt0 * effectiveKc
    const weeklyEtc = dailyEtc * 7

    // Soil and canopy moisture deficit
    // NDMI optimal is ~0.30; if NDMI < 0.15, plant is experiencing stomatal water stress
    const ndmiStress = ndmi < 0.12 ? 1.0 : ndmi < 0.22 ? 0.6 : 0.2
    const soilDryness = soilMoisturePct < 18 ? 1.0 : soilMoisturePct < 26 ? 0.6 : 0.1

    // Net irrigation required (mm)
    const netWaterDeficit = Math.max(0, weeklyEtc - effRainWeekly)
    const grossWaterNeededMm = +(netWaterDeficit / methodDef.eff).toFixed(1)

    // Liters per acre and cubic meters
    // 1 mm on 1 acre (4046.86 m²) = 4,046.86 Liters
    const litersPerAcre = Math.round(grossWaterNeededMm * 4047)
    const totalVolumeM3 = Math.round((grossWaterNeededMm * (farmAreaHa || 1) * 10))

    // Decision Logic: "Irrigate today? How much?"
    let shouldIrrigateToday = false
    let urgency: 'immediate' | 'soon' | 'none' = 'none'
    let decisionHeadline = 'No large shortfall in this estimate'
    let why = ''

    if (rainNext7 > 25) {
      shouldIrrigateToday = false
      urgency = 'none'
      decisionHeadline = 'Rain is forecast — check before watering'
      why = `${rainNext7.toFixed(0)} mm is forecast this week. Confirm the local forecast and the soil near the roots before changing your usual plan.`
    } else if (ndmiStress >= 0.8 || soilDryness >= 0.8) {
      shouldIrrigateToday = true
      urgency = 'immediate'
      decisionHeadline = 'Water may be short — check near the roots'
      why = `The canopy signal (${ndmi.toFixed(2)}) or modelled moisture at 9–27 cm (${soilMoisturePct}%) is low for this simple check. If the root-zone soil is dry, the planning amount is ${grossWaterNeededMm} mm through ${methodDef.name}.`
    } else if (netWaterDeficit > 15 && rainNext7 < 6) {
      shouldIrrigateToday = true
      urgency = 'immediate'
      decisionHeadline = 'Rain may not cover demand — monitor soil'
      why = `This estimate puts crop demand at ${weeklyEtc.toFixed(0)} mm and forecast rain at ${rainNext7.toFixed(0)} mm. Check the soil near the roots; if it is dry, use ${grossWaterNeededMm} mm as a planning figure to discuss with a local adviser.`
    } else if (netWaterDeficit > 8) {
      shouldIrrigateToday = false
      urgency = 'soon'
      decisionHeadline = 'Check the field again in a few days'
      why = `The model shows a possible gap of ${grossWaterNeededMm} mm after expected rain. Check root-zone soil again in 2–3 days and update the plan if conditions change.`
    } else {
      shouldIrrigateToday = false
      urgency = 'none'
      decisionHeadline = 'No large water gap is showing'
      why = `This estimate shows about ${dailyEtc.toFixed(1)} mm/day of crop demand. Check actual soil and local rain before changing irrigation.`
    }

    return {
      shouldIrrigateToday,
      urgency,
      decisionHeadline,
      grossWaterNeededMm,
      litersPerAcre,
      totalVolumeM3,
      why,
      dailyEtc: +dailyEtc.toFixed(1),
      effRainWeekly,
      stageTitle: 'Observed canopy water rate',
      canopyNote: ndmi < 0.15 ? 'Lower moisture signal; check the soil' : 'Higher moisture signal; still check the soil',
    }
  }, [isBare, irrMethod, ndvi, ndmi, et0Next7, rainNext7, soilMoisturePct, farmAreaHa, methodDef])

  const toneClass = calculation.urgency === 'immediate' || calculation.urgency === 'soon' ? 'warn' : 'good'

  return (
    <div className={`ag-card irr-decision-card ${toneClass}`} style={{ border: '2px solid var(--border)', borderRadius: 12, padding: '16px 20px', background: 'var(--card-bg, #fff)', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: 8, borderRadius: 10, background: calculation.urgency === 'immediate' ? '#fee2e2' : calculation.urgency === 'soon' ? '#fef3c7' : '#dcfce7', color: calculation.urgency === 'immediate' ? '#b91c1c' : calculation.urgency === 'soon' ? '#b45309' : '#15803d' }}>
            {calculation.urgency === 'immediate' ? <Droplets size={24} /> : calculation.urgency === 'soon' ? <Clock size={24} /> : <CheckCircle2 size={24} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--muted)' }}>
              <span>WATER PLAN · MODEL ESTIMATE</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: calculation.urgency === 'immediate' ? '#b91c1c' : calculation.urgency === 'soon' ? '#b45309' : '#15803d' }}>
              {calculation.decisionHeadline}
            </h2>
          </div>
        </div>

        {/* Cover / Method Selector */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={selectedCrop}
            onChange={e => setSelectedCrop(e.target.value)}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontWeight: 600 }}
          >
            {EXTENDED_CROPS.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={irrMethod}
            onChange={e => setIrrMethod(e.target.value)}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontWeight: 600 }}
          >
            {METHODS.map(m => (
          <option key={m.id} value={m.id}>{m.name} · about {Math.round(m.eff * 100)}% delivery in model</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rationale Banner */}
      <p style={{ margin: '12px 0', fontSize: 13, lineHeight: 1.5, color: '#334155' }}>
        <b>Field check:</b> {calculation.why} Planning estimate only: check soil near the roots and local rain before applying water.
      </p>

      {/* Quantity Specs */}
      <div className="ag-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 10 }}>
        <div className={`ag-item ${calculation.shouldIrrigateToday ? 'bad' : 'good'}`}>
          <span>Amount if field check confirms need</span>
          <b>{calculation.shouldIrrigateToday ? `${calculation.grossWaterNeededMm} mm` : '0 mm'}</b>
          <small>{calculation.shouldIrrigateToday ? `About ${calculation.litersPerAcre.toLocaleString()} L/acre in this estimate` : 'No amount flagged by this estimate'}</small>
        </div>

        <div className="ag-item neutral">
          <span>Estimated volume for this outline</span>
          <b>{calculation.shouldIrrigateToday ? `${calculation.totalVolumeM3.toLocaleString()} m³` : '0 m³'}</b>
          <small>for {f(farmAreaHa, 1)} ha farm area</small>
        </div>

        <div className="ag-item neutral">
          <span>Estimated daily crop water use</span>
          <b>{calculation.dailyEtc} mm/day</b>
          <small>{calculation.stageTitle}</small>
        </div>

        <div className="ag-item neutral">
          <span>Canopy moisture signal</span>
          <b>{f(ndmi, 2)}</b>
          <small>{calculation.canopyNote} · not a soil reading</small>
        </div>

        <div className="ag-item neutral">
          <span>Rain outlook (7 d)</span>
          <b>{f(rainNext7, 1)} mm</b>
          <small>Model estimates {calculation.effRainWeekly} mm may reach the soil</small>
        </div>
      </div>
      <p className="ag-note">This model uses satellite canopy cover, forecast rain, a broad soil-water estimate, and the chosen irrigation method. It is a planning aid, not an instruction to irrigate.</p>
    </div>
  )
}
