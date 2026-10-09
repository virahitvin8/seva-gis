import { useMemo, useState } from 'react'
import { Droplet, Droplets, AlertTriangle, CheckCircle2, CloudRain, Clock, Sparkles } from 'lucide-react'
import { GROWTH_STAGES, EXTENDED_CROPS, type GrowthStage } from './lib/cropstages'
import { METHODS } from './lib/hydro'

type Props = {
  farmAreaHa?: number
  cropName?: string
  ndmi?: number
  et0Next7?: number
  rainNext7?: number
  rain30?: number
  soilMoisturePct?: number
}

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—')

export default function IrrigationDecisionCard({
  farmAreaHa = 1.0,
  cropName = 'Paddy',
  ndmi = 0.22,
  et0Next7 = 35,
  rainNext7 = 8,
  rain30 = 45,
  soilMoisturePct = 28,
}: Props) {
  const [selectedCrop, setSelectedCrop] = useState(() => {
    const norm = (cropName || '').toLowerCase()
    return EXTENDED_CROPS.find(c => norm.includes(c.id))?.id || 'paddy'
  })
  const [selectedStage, setSelectedStage] = useState<GrowthStage>('flowering')
  const [irrMethod, setIrrMethod] = useState('furrow')

  const stageDef = GROWTH_STAGES.find(s => s.id === selectedStage) || GROWTH_STAGES[2]
  const methodDef = METHODS.find(m => m.id === irrMethod) || METHODS[1]

  const calculation = useMemo(() => {
    // Stage-adjusted crop evapotranspiration (ETc)
    const dailyEt0 = Math.max(1.5, et0Next7 / 7)
    const effectiveKc = 1.05 * stageDef.kcMultiplier
    const dailyEtc = dailyEt0 * effectiveKc
    const weeklyEtc = dailyEtc * 7

    // Effective rain (75% infiltration efficiency)
    const effRainWeekly = 0.75 * Math.max(0, rainNext7)

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
    let decisionHeadline = 'NO — Do Not Irrigate Today'
    let why = ''

    if (rainNext7 > 25) {
      shouldIrrigateToday = false
      urgency = 'none'
      decisionHeadline = 'NO — Heavy Rain Forecast'
      why = `Forecast predicts ${rainNext7.toFixed(0)} mm rain this week. Applying irrigation today risks waterlogging, root suffocation, and nutrient runoff.`
    } else if (selectedStage === 'maturity') {
      shouldIrrigateToday = false
      urgency = 'none'
      decisionHeadline = 'NO — Crop in Maturity Stage'
      why = 'Crop is ripening and drying down. Withhold water now to accelerate grain hardening and prevent mold before harvest.'
    } else if (ndmiStress >= 0.8 || soilDryness >= 0.8) {
      shouldIrrigateToday = true
      urgency = 'immediate'
      decisionHeadline = 'YES — Irrigate Today'
      why = `Satellite NDMI (${ndmi.toFixed(2)}) and soil moisture (${soilMoisturePct}%) indicate root-zone water deficit during the ${stageDef.name} stage.`
    } else if (netWaterDeficit > 15 && rainNext7 < 6) {
      shouldIrrigateToday = true
      urgency = 'immediate'
      decisionHeadline = 'YES — Irrigate Today'
      why = `Weekly crop demand (${weeklyEtc.toFixed(0)} mm) significantly exceeds forecast rain (${rainNext7.toFixed(0)} mm). Replenish root-zone storage.`
    } else if (netWaterDeficit > 8) {
      shouldIrrigateToday = false
      urgency = 'soon'
      decisionHeadline = 'WAIT 2–3 DAYS — Monitor Soil'
      why = `Moisture is currently adequate, but demand will deplete root-zone water in 2–3 days. Prepare irrigation schedule.`
    } else {
      shouldIrrigateToday = false
      urgency = 'none'
      decisionHeadline = 'NO — Soil Moisture Adequate'
      why = `Existing soil water and weather outlook comfortably cover the crop's ${dailyEtc.toFixed(1)} mm/day water consumption.`
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
      effRainWeekly: +effRainWeekly.toFixed(1),
    }
  }, [selectedStage, irrMethod, ndmi, et0Next7, rainNext7, soilMoisturePct, farmAreaHa, stageDef, methodDef])

  const toneClass = calculation.urgency === 'immediate' ? 'bad' : calculation.urgency === 'soon' ? 'warn' : 'good'

  return (
    <div className={`ag-card irr-decision-card ${toneClass}`} style={{ border: '2px solid var(--border)', borderRadius: 12, padding: '16px 20px', background: 'var(--card-bg, #fff)', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: 8, borderRadius: 10, background: calculation.urgency === 'immediate' ? '#fee2e2' : calculation.urgency === 'soon' ? '#fef3c7' : '#dcfce7', color: calculation.urgency === 'immediate' ? '#b91c1c' : calculation.urgency === 'soon' ? '#b45309' : '#15803d' }}>
            {calculation.urgency === 'immediate' ? <Droplets size={24} /> : calculation.urgency === 'soon' ? <Clock size={24} /> : <CheckCircle2 size={24} />}
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--muted)' }}>
              FARMER DECISION ENGINE
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: calculation.urgency === 'immediate' ? '#b91c1c' : calculation.urgency === 'soon' ? '#b45309' : '#15803d' }}>
              {calculation.decisionHeadline}
            </h2>
          </div>
        </div>

        {/* Crop & Stage Selector */}
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
            value={selectedStage}
            onChange={e => setSelectedStage(e.target.value as GrowthStage)}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontWeight: 600 }}
          >
            {GROWTH_STAGES.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.waterSensitivity} need)</option>
            ))}
          </select>

          <select
            value={irrMethod}
            onChange={e => setIrrMethod(e.target.value)}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff' }}
          >
            {METHODS.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({Math.round(m.eff * 100)}% eff)</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rationale Banner */}
      <p style={{ margin: '12px 0', fontSize: 13, lineHeight: 1.5, color: '#334155' }}>
        <b>Recommendation:</b> {calculation.why}
      </p>

      {/* Quantity Specs */}
      <div className="ag-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 10 }}>
        <div className={`ag-item ${calculation.shouldIrrigateToday ? 'bad' : 'good'}`}>
          <span>How much to apply</span>
          <b>{calculation.shouldIrrigateToday ? `${calculation.grossWaterNeededMm} mm` : '0 mm'}</b>
          <small>{calculation.shouldIrrigateToday ? `~${calculation.litersPerAcre.toLocaleString()} L/acre` : 'No irrigation today'}</small>
        </div>

        <div className="ag-item neutral">
          <span>Total field volume</span>
          <b>{calculation.shouldIrrigateToday ? `${calculation.totalVolumeM3.toLocaleString()} m³` : '0 m³'}</b>
          <small>for {f(farmAreaHa, 1)} ha farm area</small>
        </div>

        <div className="ag-item neutral">
          <span>Crop ETc use</span>
          <b>{calculation.dailyEtc} mm/day</b>
          <small>{stageDef.name} stage</small>
        </div>

        <div className="ag-item neutral">
          <span>Canopy water (NDMI)</span>
          <b>{f(ndmi, 2)}</b>
          <small>{ndmi < 0.15 ? 'Water stressed' : 'Well hydrated'}</small>
        </div>

        <div className="ag-item neutral">
          <span>Rain outlook (7 d)</span>
          <b>{f(rainNext7, 1)} mm</b>
          <small>Effective: {calculation.effRainWeekly} mm</small>
        </div>
      </div>
    </div>
  )
}
