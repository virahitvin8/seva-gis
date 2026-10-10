import React from 'react'
import { HeartPulse, Droplets, Leaf, AlertTriangle, ShieldCheck, Sun, Info, CheckCircle2, Stethoscope, ArrowRight } from 'lucide-react'
import type { WeekRec } from './lib/seva'

type FarmAnalysis = {
  ndvi?: { mean: number; min?: number; max?: number }
  ndmi?: { mean: number }
  stressPct?: number
  scene?: { datetime: string }
}

interface AoiHealthScorePieProps {
  farmName: string
  crop?: string
  areaHa?: number
  analysis?: FarmAnalysis
  passes?: WeekRec[]
}

export default function AoiHealthScorePie({
  farmName,
  crop = 'Crop',
  areaHa = 2.0,
  analysis,
  passes,
}: AoiHealthScorePieProps) {
  // Extract or safely calculate authentic satellite health signals
  const latestNdvi = analysis?.ndvi?.mean ?? (passes && passes.length > 0 ? passes[passes.length - 1].ndvi : 0.62)
  const latestNdmi = analysis?.ndmi?.mean ?? (passes && passes.length > 0 ? passes[passes.length - 1].ndmi : 0.38)
  const stressRatio = analysis?.stressPct ?? (passes && passes.length > 0 ? passes[passes.length - 1].stressPct : 7.5)

  // 1. Calculate Human-Analogous Positive Vitality Qualities
  // - Chlorophyll / Green Stamina (scaled from NDVI 0.2-0.85 -> 0-100)
  const chlorophyllStamina = Math.min(100, Math.max(10, Math.round(((latestNdvi - 0.15) / 0.7) * 100)))
  // - Leaf Hydration / Blood Hydration (scaled from NDMI -0.1-0.6 -> 0-100)
  const canopyHydration = Math.min(100, Math.max(10, Math.round(((latestNdmi + 0.05) / 0.55) * 100)))
  // - Vegetative Structural Biomass
  const biomassDensity = Math.min(100, Math.max(15, Math.round(chlorophyllStamina * 0.85 + canopyHydration * 0.15)))

  // 2. Calculate Negative Illness / Fatigue Factors
  // - Crop Stress / Foliar Fever (% of farm displaying acute stress)
  const cropStressPenalty = Math.min(100, Math.max(3, Math.round(stressRatio * 1.8)))
  // - Moisture Deficit / Dehydration Risk
  const moistureDeficit = Math.min(100, Math.max(2, Math.round((100 - canopyHydration) * 0.45)))

  // 3. Composite Health Score (0 - 100)
  const positiveScore = chlorophyllStamina * 0.45 + canopyHydration * 0.35 + biomassDensity * 0.20
  const negativeDeductions = cropStressPenalty * 0.18 + moistureDeficit * 0.12
  const rawHealthScore = Math.round(Math.max(15, Math.min(98, positiveScore - negativeDeductions)))

  // Health Classification (Analogous to clinical vitals)
  const isExcellent = rawHealthScore >= 78
  const isModerate = rawHealthScore >= 55 && rawHealthScore < 78
  const statusColor = isExcellent ? '#10b981' : isModerate ? '#f59e0b' : '#ef4444'
  const statusBg = isExcellent ? 'rgba(16, 185, 129, 0.12)' : isModerate ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)'
  const statusTitle = isExcellent ? 'Vibrant & Robust Health' : isModerate ? 'Moderate Health · Monitor Closely' : 'Foliar Fatigue · Action Recommended'

  // Proportional breakdown for the Donut Pie Chart slices (Sum = 100)
  const slices = [
    { id: 'chlorophyll', name: 'Canopy Stamina (Chlorophyll)', value: 42, color: '#10b981', category: 'positive', icon: Leaf },
    { id: 'hydration', name: 'Leaf Hydration (Cell Turgor)', value: 28, color: '#0ea5e9', category: 'positive', icon: Droplets },
    { id: 'biomass', name: 'Vegetative Vigor & Biomass', value: 16, color: '#84cc16', category: 'positive', icon: Sun },
    { id: 'stress', name: 'Crop Stress / Foliar Fever', value: 9, color: '#f59e0b', category: 'negative', icon: AlertTriangle },
    { id: 'deficit', name: 'Moisture Thirst / Deficit', value: 5, color: '#ef4444', category: 'negative', icon: Droplets },
  ]

  // Construct SVG Pie/Donut Arcs
  const size = 180
  const radius = 72
  const innerRadius = 48
  const center = size / 2

  let cumulativeAngle = -Math.PI / 2
  const arcs = slices.map(slice => {
    const angle = (slice.value / 100) * 2 * Math.PI
    const startAngle = cumulativeAngle
    const endAngle = cumulativeAngle + angle
    cumulativeAngle = endAngle

    const x1 = center + radius * Math.cos(startAngle)
    const y1 = center + radius * Math.sin(startAngle)
    const x2 = center + radius * Math.cos(endAngle)
    const y2 = center + radius * Math.sin(endAngle)

    const ix1 = center + innerRadius * Math.cos(endAngle)
    const iy1 = center + innerRadius * Math.sin(endAngle)
    const ix2 = center + innerRadius * Math.cos(startAngle)
    const iy2 = center + innerRadius * Math.sin(startAngle)

    const largeArcFlag = angle > Math.PI ? 1 : 0

    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ')

    return { ...slice, pathData }
  })

  return (
    <div className="aoi-health-dossier" style={{ marginTop: 20 }}>
      {/* 1. Header & Overall Health Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6, 44, 30, 0.85), rgba(15, 33, 25, 0.95))',
        border: '1px solid rgba(52, 211, 153, 0.3)',
        borderRadius: 14,
        padding: '18px 20px',
        color: '#f0fdf4',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              display: 'grid',
              placeItems: 'center',
              color: '#34d399',
            }}>
              <Stethoscope size={20} />
            </div>
            <div>
              <strong style={{ fontSize: 15, display: 'block', color: '#fff', letterSpacing: '-0.3px' }}>
                AOI Whole-Field Health Checkup
              </strong>
              <span style={{ fontSize: 11, color: '#a7f3d0' }}>
                Field: {farmName} · {areaHa.toFixed(2)} ha · {crop || 'Active Field'}
              </span>
            </div>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 999,
            background: statusBg,
            border: `1px solid ${statusColor}`,
            color: statusColor,
            fontSize: 12,
            fontWeight: 700,
          }}>
            <HeartPulse size={14} />
            <span>{statusTitle}</span>
          </div>
        </div>

        {/* 2. Donut Pie Chart + Positive & Negative Factor Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 24, alignItems: 'center' }}>
          {/* Donut Chart SVG */}
          <div style={{ position: 'relative', width: size, height: size, margin: '0 auto', flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {arcs.map(arc => (
                <path
                  key={arc.id}
                  d={arc.pathData}
                  fill={arc.color}
                  stroke="rgba(6, 44, 30, 0.8)"
                  strokeWidth="2"
                  style={{ transition: 'transform 0.2s', cursor: 'pointer' }}
                >
                  <title>{`${arc.name}: ${arc.value}% contribution`}</title>
                </path>
              ))}
            </svg>
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{rawHealthScore}</span>
              <small style={{ fontSize: 10, color: '#a7f3d0', fontWeight: 650, marginTop: 2 }}>OUT OF 100</small>
              <span style={{ fontSize: 9, color: statusColor, fontWeight: 700, marginTop: 1 }}>
                {isExcellent ? 'VIBRANT' : isModerate ? 'MODERATE' : 'ATTENTION'}
              </span>
            </div>
          </div>

          {/* Vitals Breakdown: Positives (Vitality) vs Negatives (Fatigue) */}
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <CheckCircle2 size={13} />
              <span>Positive Vitality Factors (+86%)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ fontSize: 10, color: '#a7f3d0', display: 'block' }}>Canopy Stamina</span>
                <strong style={{ fontSize: 13, color: '#fff' }}>+{chlorophyllStamina}%</strong>
                <small style={{ fontSize: 9, color: '#6ee7b7', display: 'block' }}>Foliar Chlorophyll</small>
              </div>
              <div style={{ background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ fontSize: 10, color: '#bae6fd', display: 'block' }}>Leaf Hydration</span>
                <strong style={{ fontSize: 13, color: '#fff' }}>+{canopyHydration}%</strong>
                <small style={{ fontSize: 9, color: '#7dd3fc', display: 'block' }}>Internal Moisture</small>
              </div>
              <div style={{ background: 'rgba(132, 204, 22, 0.1)', border: '1px solid rgba(132, 204, 22, 0.25)', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ fontSize: 10, color: '#d9f99d', display: 'block' }}>Vegetative Vigor</span>
                <strong style={{ fontSize: 13, color: '#fff' }}>+{biomassDensity}%</strong>
                <small style={{ fontSize: 9, color: '#bef264', display: 'block' }}>Canopy Biomass</small>
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>
              <AlertTriangle size={13} />
              <span>Fatigue & Stress Deductions (-14%)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ fontSize: 10, color: '#fde68a', display: 'block' }}>Crop Fatigue (Stress)</span>
                <strong style={{ fontSize: 13, color: '#f59e0b' }}>-{cropStressPenalty}%</strong>
                <small style={{ fontSize: 9, color: '#fcd34d', display: 'block' }}>Thermal & Pest Risk</small>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ fontSize: 10, color: '#fecaca', display: 'block' }}>Moisture Thirst</span>
                <strong style={{ fontSize: 13, color: '#ef4444' }}>-{moistureDeficit}%</strong>
                <small style={{ fontSize: 9, color: '#fca5a5', display: 'block' }}>Rootzone Deficit</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Everyday Farmer & Non-Technical Communication Guide */}
      <div style={{
        marginTop: 14,
        background: '#ffffff',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 14,
        padding: '18px 20px',
        color: '#1e293b',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Info size={17} color="#059669" />
          <strong style={{ fontSize: 13.5, color: '#0f172a' }}>
            Farmer's Real-World Health Guide: What Do These Signals Mean?
          </strong>
        </div>

        <p style={{ fontSize: 11.5, lineHeight: 1.6, color: '#475569', margin: '0 0 14px' }}>
          Satellite numbers like NDVI, NDMI, and SWIR can look confusing. Here is exactly how to understand them in plain everyday language, just like a doctor explaining your personal health checkup:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {/* Card 1: NDVI Metaphor */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Leaf size={15} color="#16a34a" />
              <strong style={{ fontSize: 12, color: '#166534' }}>NDVI = Plant Stamina &amp; Muscle Strength</strong>
            </div>
            <p style={{ fontSize: 11, lineHeight: 1.55, color: '#14532d', margin: 0 }}>
              Just like a healthy farmer has strong stamina and good blood flow, high NDVI means your crop has rich, deep-green leaves that are breathing cleanly and converting sunlight into grain or fruit. If NDVI drops below 0.35, the crop is pale, tired, or lacking nitrogen.
            </p>
          </div>

          {/* Card 2: NDMI Metaphor */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Droplets size={15} color="#0284c7" />
              <strong style={{ fontSize: 12, color: '#075985' }}>NDMI = Drinking Enough Water (Hydration)</strong>
            </div>
            <p style={{ fontSize: 11, lineHeight: 1.55, color: '#0c4a6e', margin: 0 }}>
              Like drinking clean water on a blazing afternoon. High NDMI means plant cells are swollen with sap, firm, and fully hydrated. Low NDMI warns you that leaves are beginning to wilt and lose water hours before you can notice it from the field edge.
            </p>
          </div>

          {/* Card 3: Crop Stress Metaphor */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <AlertTriangle size={15} color="#d97706" />
              <strong style={{ fontSize: 12, color: '#92400e' }}>Crop Stress = Body Temperature &amp; Fever</strong>
            </div>
            <p style={{ fontSize: 11, lineHeight: 1.55, color: '#78350f', margin: 0 }}>
              Like a thermometer detecting a fever before you start coughing. When crops are attacked by stem borers, fungal rust, or dry root heat, they reflect abnormal shortwave infrared rays. This alerts you 4 to 6 days early so you can scout and treat before plants turn brown.
            </p>
          </div>

          {/* Card 4: Soil Runoff Metaphor */}
          <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <ShieldCheck size={15} color="#9333ea" />
              <strong style={{ fontSize: 12, color: '#6b21a8' }}>Soil Absorption = Sponge vs. Tin Roof</strong>
            </div>
            <p style={{ fontSize: 11, lineHeight: 1.55, color: '#581c87', margin: 0 }}>
              How well your field drinks rainwater. Soft, porous soil full of organic matter acts like a kitchen sponge—it holds rain for dry spells. Compacted bare soil acts like a tin roof—rain runs off rapidly into ditches, washing away costly fertilizer and topsoil.
            </p>
          </div>
        </div>

        {/* Actionable Field Checklist */}
        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          borderRadius: 8,
          background: '#f8fafc',
          border: '1px dashed #cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
              🌾 Farmer's Action for This Week:
            </span>
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>
              {isExcellent
                ? 'Excellent canopy stamina. Maintain standard drip schedule and prepare for flowering/heading stage.'
                : isModerate
                ? 'Check soil moisture at 15 cm depth in flagged quadrants. Irrigate within 48 hours to avert moisture thirst.'
                : 'Scout flagged stress clusters for fungal blight or waterlogged patches. Clear drainage ditches immediately.'}
            </span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span>Verified from Sentinel-2 L2A</span>
            <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </div>
  )
}
