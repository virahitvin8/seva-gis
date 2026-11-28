import { useEffect, useMemo, useState } from 'react'
import { Sparkles, MessageCircle } from 'lucide-react'
import { EXTENDED_CROPS, computeStageAdjustedVerdict, matchCropSpec, type GrowthStage } from './lib/cropstages'
import type { FarmData, WeekRec } from './lib/seva'
import { getGroundTalk } from './lib/plainTalk'
import { useI18n } from './lib/i18n'

type Props = {
  farm: FarmData & { id: string; name: string; crop?: string; passes?: WeekRec[] }
  onStageChange?: (stage: GrowthStage) => void
}

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—')

export default function FieldHealthScore({ farm }: Props) {
  const { t } = useI18n()
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

  const [showFriendAdvice, setShowFriendAdvice] = useState(false)

  const verdict = useMemo(() => {
    return computeStageAdjustedVerdict(cropDef.id, 'vegetative', currentNdvi, currentNdmi)
  }, [cropDef.id, currentNdvi, currentNdmi])

  const groundTalk = useMemo(() => {
    const talk = getGroundTalk('ndvi')
    return {
      talk,
      interp: talk.interpret(currentNdvi)
    }
  }, [currentNdvi])

  if (!farm.analysis) return <section className="ag-card" style={{ padding: 16, marginBottom: 20 }}><h3>{t('cropcheck.title')}</h3><p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 12 }}>{t('cropcheck.subtitle')}</p></section>

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
                {t('cropcheck.title')}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: verdict.tone === 'good' ? '#15803d' : verdict.tone === 'warn' ? '#b45309' : '#b91c1c' }}>
              {verdict.status}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Vegetative cover index for {cropDef.name}: {f(currentNdvi, 2)} (NDMI moisture: {f(currentNdmi, 2)})
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
        {verdict.note}
      </p>

      {showFriendAdvice && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #22c55e', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageCircle size={15} />
              <span>Face-to-Face Ground Talk for {cropDef.name}</span>
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


      <p style={{ margin: '8px 2px 0', color: 'var(--muted)', fontSize: 10, lineHeight: 1.5 }}>NDVI is an image score, not a percentage, yield, or lab measurement. Crop variety, planting date, and local conditions can shift these guide values; check the field before acting.</p>
    </div>
  )
}
