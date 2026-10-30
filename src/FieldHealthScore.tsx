import { useEffect, useMemo, useState } from 'react'
import { Sparkles, TrendingUp, AlertCircle, CheckCircle2, ChevronRight, Sprout, MessageCircle } from 'lucide-react'
import { EXTENDED_CROPS, GROWTH_STAGES, computeStageAdjustedVerdict, matchCropSpec, autoDetectStage, type GrowthStage } from './lib/cropstages'
import type { FarmData, WeekRec } from './lib/seva'
import { getGroundTalk } from './lib/plainTalk'

type Props = {
  farm: FarmData & { id: string; name: string; crop?: string; passes?: WeekRec[] }
  onStageChange?: (stage: GrowthStage) => void
}

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—')

export default function FieldHealthScore({ farm }: Props) {
  const currentNdvi = farm.analysis?.ndvi.mean ?? 0
  const currentNdmi = farm.analysis?.ndmi.mean ?? 0

  const [cropId, setCropId] = useState(() => {
    return matchCropSpec(farm.crop || '').id
  })

  // Synchronize when farm changes
  useEffect(() => {
    if (farm.crop) {
      setCropId(matchCropSpec(farm.crop).id)
    }
  }, [farm.crop, farm.id])

  const cropDef = useMemo(() => {
    return EXTENDED_CROPS.find(c => c.id === cropId) || matchCropSpec(farm.crop || '')
  }, [cropId, farm.crop])

  // Automatically detect stage as per actual satellite health metrics
  const detectedStage = useMemo(() => {
    return autoDetectStage(cropDef, currentNdvi, currentNdmi)
  }, [cropDef, currentNdvi, currentNdmi])

  const [isAuto, setIsAuto] = useState(true)
  const [manualStage, setManualStage] = useState<GrowthStage>('flowering')
  const [showFriendAdvice, setShowFriendAdvice] = useState(false)

  const stage = isAuto ? detectedStage : manualStage
  const stageDef = GROWTH_STAGES.find(s => s.id === stage) || GROWTH_STAGES[2]

  const verdict = useMemo(() => {
    return computeStageAdjustedVerdict(cropDef.id, stage, currentNdvi, currentNdmi)
  }, [cropDef.id, stage, currentNdvi, currentNdmi])

  const groundTalk = useMemo(() => {
    const talk = getGroundTalk('ndvi')
    return {
      talk,
      interp: talk.interpret(currentNdvi)
    }
  }, [currentNdvi])

  // Benchmark curve vs actual passes
  const chartPoints = useMemo(() => {
    const stages: GrowthStage[] = ['sowing', 'vegetative', 'flowering', 'grain_fill', 'maturity']
    return stages.map(s => ({
      stage: s,
      name: GROWTH_STAGES.find(gs => gs.id === s)?.name.split(' / ')[0] || s,
      expected: cropDef.stages[s]?.ndviExpected ?? 0.5,
    }))
  }, [cropDef])

  const W = 360, H = 100, L = 28, R = 10
  const x = (i: number) => L + (i / 4) * (W - L - R)
  const y = (v: number) => H - 16 - ((v - 0.1) / 0.85) * (H - 24)

  const benchmarkPath = chartPoints.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.expected)}`).join(' ')
  const currentStageIndex = ['sowing', 'vegetative', 'flowering', 'grain_fill', 'maturity'].indexOf(stage)

  if (!farm.analysis) return <section className="ag-card" style={{ padding: 16, marginBottom: 20 }}><h3>Crop check</h3><p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 12 }}>Waiting for a clear satellite reading. Once it arrives, this card will compare the field’s green-cover signal with a general crop guide.</p></section>

  return (
    <div className="ag-card" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg, #fff)', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Show the actual NDVI reading instead of converting it to a percentage. */}
          <div style={{
            width: 58, height: 58, borderRadius: '50%',
            background: verdict.tone === 'good' ? '#dcfce7' : verdict.tone === 'warn' ? '#fef3c7' : '#fee2e2',
            border: `3px solid ${verdict.tone === 'good' ? '#16a34a' : verdict.tone === 'warn' ? '#d97706' : '#dc2626'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <b style={{ fontSize: 18, lineHeight: 1, color: verdict.tone === 'good' ? '#15803d' : verdict.tone === 'warn' ? '#b45309' : '#b91c1c' }}>
              {f(currentNdvi, 2)}
            </b>
            <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--muted)' }}>NDVI</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                CROP CHECK
              </span>
              {isAuto && (
                <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Sparkles size={10} /> Suggested stage
                </span>
              )}
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: verdict.tone === 'good' ? '#15803d' : verdict.tone === 'warn' ? '#b45309' : '#b91c1c' }}>
              {verdict.status}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              General green-cover guide for {cropDef.name} at {stageDef.name.toLowerCase()}: {f(cropDef.stages[stage]?.ndviExpected ?? 0.7, 2)}
            </span>
          </div>
        </div>

        {/* Dynamic Crop & Growth Stage Selectors */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={cropId}
            onChange={e => setCropId(e.target.value)}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontWeight: 600 }}
          >
            {EXTENDED_CROPS.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={isAuto ? 'auto' : stage}
            onChange={e => {
              if (e.target.value === 'auto') {
                setIsAuto(true)
              } else {
                setIsAuto(false)
                setManualStage(e.target.value as GrowthStage)
              }
            }}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: isAuto ? '#f0fdf4' : '#fff', color: isAuto ? '#15803d' : '#0f172a', fontWeight: 600 }}
          >
            <option value="auto">✨ Auto: {stageDef.name}</option>
            {GROWTH_STAGES.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowFriendAdvice(prev => !prev)}
            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1px solid #16a34a', background: showFriendAdvice ? '#dcfce7' : '#ffffff', color: '#15803d', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Sparkles size={12} />
            <span>{showFriendAdvice ? 'Hide Ground Talk' : '🗣️ Ground Talk (Like Friends)'}</span>
          </button>
        </div>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#475569', lineHeight: 1.4 }}>
        {verdict.note} {stageDef.advisory} {isAuto && 'The stage is only a guess from the satellite signal; choose the stage you see in the field if you know it.'}
      </p>

      {showFriendAdvice && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #22c55e', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageCircle size={15} />
              <span>Face-to-Face Ground Talk for {cropDef.name} ({stageDef.name})</span>
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: groundTalk.interp.rating === 'Great' ? '#bbf7d0' : '#fef08a', color: groundTalk.interp.rating === 'Great' ? '#14532d' : '#854d0e' }}>
              Condition: {groundTalk.interp.rating}
            </span>
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#166534', lineHeight: 1.4 }}>
            <b>What the satellite is seeing:</b> {groundTalk.talk.friendConcept}
          </p>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#14532d', lineHeight: 1.4 }}>
            <b>Your crop reading right now:</b> {groundTalk.interp.summary}
          </p>
          <div style={{ background: '#ffffff', borderRadius: 6, padding: '8px 10px', border: '1px solid #86efac', fontSize: 11.5, color: '#15803d' }}>
            <b>👉 What you should do on the ground:</b> {groundTalk.interp.groundAction}
          </div>
        </div>
      )}

      {/* Season NDVI Trend vs Crop-Peak Benchmark Curve */}
      <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
          <span><b>Green-cover signal by crop stage</b> · general guide</span>
          <span><i style={{ display: 'inline-block', width: 8, height: 8, background: '#16a34a', borderRadius: '50%', marginRight: 4 }} />This field · <i style={{ display: 'inline-block', width: 14, height: 2, background: '#64748b', marginRight: 4 }} />Guide</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map(v => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x="4" y={y(v) + 3} fontSize="8" fill="#94a3b8">{v}</text>
            </g>
          ))}

          {/* Benchmark line */}
          <path d={benchmarkPath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" />

          {/* Benchmark points */}
          {chartPoints.map((p, i) => (
            <circle key={p.stage} cx={x(i)} cy={y(p.expected)} r="3" fill="#94a3b8" />
          ))}

          {/* Current observed field NDVI marker */}
          {currentStageIndex >= 0 && (
            <g>
              <line x1={x(currentStageIndex)} x2={x(currentStageIndex)} y1={y(0.1)} y2={y(currentNdvi)} stroke="#16a34a" strokeWidth="1.5" />
              <circle cx={x(currentStageIndex)} cy={y(currentNdvi)} r="5.5" fill="#16a34a" stroke="#fff" strokeWidth="2" />
              <text x={x(currentStageIndex)} y={y(currentNdvi) - 9} fontSize="9" fontWeight="bold" textAnchor="middle" fill="#15803d">
                {currentNdvi.toFixed(2)}
              </text>
            </g>
          )}

          {/* Stage labels */}
          {chartPoints.map((p, i) => (
            <text key={p.stage} x={x(i)} y={H - 2} fontSize="8" textAnchor="middle" fill={i === currentStageIndex ? '#0f172a' : '#94a3b8'} fontWeight={i === currentStageIndex ? 'bold' : 'normal'}>
              {p.name}
            </text>
          ))}
        </svg>
      </div>
      <p style={{ margin: '8px 2px 0', color: 'var(--muted)', fontSize: 10, lineHeight: 1.5 }}>NDVI is an image score, not a percentage, yield, or lab measurement. Crop variety, planting date, and local conditions can shift these guide values; check the field before acting.</p>
    </div>
  )
}
