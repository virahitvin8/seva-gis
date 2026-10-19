import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { RotateCw, Play, Pause, Sparkles } from 'lucide-react'

export interface ClockwiseParam {
  name: string
  unit: string
  formula: string
  range: string
  source: string
  desc: string
  use: string
}

export interface ClockwiseDomainData {
  id: string
  title: string
  badge: string
  color: string
  summary: string
  workflow: string[]
  parameters: ClockwiseParam[]
}

interface Props {
  domain: ClockwiseDomainData
  activeIdx: number
  onSelectIdx: (idx: number) => void
}

export default function ClockwiseDispersionDial({
  domain,
  activeIdx,
  onSelectIdx
}: Props) {
  const [autoRotate, setAutoRotate] = useState(true)
  const [intervalSec, setIntervalSec] = useState<1 | 3 | 5>(3)
  const [tickProgress, setTickProgress] = useState(0)

  const count = domain.parameters.length || 6
  const safeIdx = ((activeIdx % count) + count) % count
  const activeParam = domain.parameters[safeIdx] || domain.parameters[0]

  // Reset progress bar whenever domain or active index changes
  useEffect(() => {
    setTickProgress(0)
  }, [domain.id, safeIdx, intervalSec])

  // Continuous clockwise progression timer (1s / 3s / 5s)
  useEffect(() => {
    if (!autoRotate) return
    const stepMs = 60
    const totalMs = intervalSec * 1000
    let elapsed = 0

    const timer = window.setInterval(() => {
      elapsed += stepMs
      const ratio = Math.min(1, elapsed / totalMs)
      setTickProgress(ratio)
      if (elapsed >= totalMs) {
        elapsed = 0
        onSelectIdx((safeIdx + 1) % count)
      }
    }, stepMs)

    return () => window.clearInterval(timer)
  }, [autoRotate, intervalSec, safeIdx, count, onSelectIdx, domain.id])

  // Clockwise angle calculation: Node 0 (1) at 12 o'clock (-90 deg), advancing +60 deg clockwise
  const stepAngleDeg = 360 / count
  const activeAngleDeg = safeIdx * stepAngleDeg

  // SVG coordinate helpers (center = 190, 190; orbit radius = 128)
  const cx = 190
  const cy = 190
  const orbitR = 128

  const getNodeCoords = (idx: number, radius = orbitR) => {
    const rad = ((idx * stepAngleDeg - 90) * Math.PI) / 180
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
      deg: idx * stepAngleDeg
    }
  }

  // Generate dispersion particles radiating around active node and center
  const activeCoords = getNodeCoords(safeIdx)

  return (
    <div
      style={{
        background:
          'radial-gradient(circle at 28% 35%, rgba(182, 243, 106, 0.11), rgba(6, 14, 26, 0.94) 72%)',
        border: `1px solid ${domain.color}55`,
        borderRadius: 18,
        padding: '16px 18px',
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 16px 42px -12px rgba(0, 0, 0, 0.65), inset 0 0 28px ${domain.color}18`
      }}
    >
      {/* Top Control Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 12,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.span
            animate={autoRotate ? { rotate: 360 } : { rotate: 0 }}
            transition={
              autoRotate
                ? { duration: intervalSec * 2, repeat: Infinity, ease: 'linear' }
                : { duration: 0.2 }
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: `${domain.color}22`,
              border: `1px solid ${domain.color}77`,
              color: domain.color
            }}
          >
            <RotateCw size={14} />
          </motion.span>
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: domain.color,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>CLOCKWISE PARAMETER DISPERSION ENGINE</span>
              <span
                style={{
                  background: `${domain.color}25`,
                  border: `1px solid ${domain.color}66`,
                  padding: '1px 7px',
                  borderRadius: 999,
                  fontSize: 9.5,
                  color: '#f8fafc'
                }}
              >
                1 → 2 → 3 → 4 → 5 → 6 → 1
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: '#cbd5e1', marginTop: 2 }}>
              Domain: <strong style={{ color: '#fff' }}>{domain.title}</strong> · Active Slot{' '}
              <strong style={{ color: domain.color }}>
                #{safeIdx + 1}/{count} ({activeParam.name})
              </strong>
            </div>
          </div>
        </div>

        {/* Cadence Controls: 1s / 3s / 5s + Play/Pause */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, marginRight: 2 }}>
            Cadence:
          </span>
          {([1, 3, 5] as const).map(sec => {
            const selected = intervalSec === sec
            return (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  setIntervalSec(sec)
                  setAutoRotate(true)
                }}
                style={{
                  padding: '4px 9px',
                  borderRadius: 999,
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: selected
                    ? `1px solid ${domain.color}`
                    : '1px solid rgba(255,255,255,0.14)',
                  background: selected ? `${domain.color}2e` : 'rgba(15, 23, 42, 0.7)',
                  color: selected ? '#fff' : '#94a3b8',
                  transition: 'all 0.18s ease'
                }}
              >
                {sec}s / step
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setAutoRotate(v => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 10.5,
              fontWeight: 800,
              cursor: 'pointer',
              border: `1px solid ${autoRotate ? domain.color : 'rgba(248,113,113,0.5)'}`,
              background: autoRotate ? `${domain.color}22` : 'rgba(248,113,113,0.15)',
              color: autoRotate ? domain.color : '#fca5a5'
            }}
          >
            {autoRotate ? <Pause size={11} /> : <Play size={11} />}
            {autoRotate ? 'Auto-Rotating' : 'Paused'}
          </button>
        </div>
      </div>

      {/* Main Responsive Split: Left Mesmerizing Orbital Dispersion Wheel | Right Live Parameter Telemetry */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 16,
          alignItems: 'center'
        }}
      >
        {/* LEFT: Orbital Clockwise Dispersion Wheel */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <svg
            viewBox="0 0 380 380"
            style={{
              width: '100%',
              maxWidth: 340,
              height: 'auto',
              overflow: 'visible',
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.55))'
            }}
          >
            <defs>
              <radialGradient id={`coreGlow-${domain.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={domain.color} stopOpacity="0.45" />
                <stop offset="55%" stopColor="#38f2d0" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#050b14" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`sweepGrad-${domain.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={domain.color} stopOpacity="0.95" />
                <stop offset="50%" stopColor="#38f2d0" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#ff5fd2" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Ambient Core Nebula */}
            <circle cx={cx} cy={cy} r={155} fill={`url(#coreGlow-${domain.id})`} />

            {/* Expanding Loading Dispersion Ripples from Center */}
            {[0, 1, 2].map(ripple => (
              <motion.circle
                key={`ripple-${ripple}-${domain.id}`}
                cx={cx}
                cy={cy}
                r={42}
                fill="none"
                stroke={domain.color}
                strokeWidth={1.4}
                initial={{ r: 38, opacity: 0.65 }}
                animate={{ r: 148, opacity: 0 }}
                transition={{
                  duration: intervalSec * 1.15,
                  repeat: Infinity,
                  delay: ripple * (intervalSec * 0.38),
                  ease: 'easeOut'
                }}
              />
            ))}

            {/* Outer Degree Tick Ring */}
            <g>
              {Array.from({ length: 36 }).map((_, i) => {
                const a = (i * 10 * Math.PI) / 180
                const r1 = i % 6 === 0 ? 150 : 154
                const r2 = 160
                return (
                  <line
                    key={i}
                    x1={cx + r1 * Math.cos(a)}
                    y1={cy + r1 * Math.sin(a)}
                    x2={cx + r2 * Math.cos(a)}
                    y2={cy + r2 * Math.sin(a)}
                    stroke={i % 6 === 0 ? domain.color : 'rgba(255,255,255,0.18)'}
                    strokeWidth={i % 6 === 0 ? 2 : 1}
                  />
                )
              })}
            </g>

            {/* Dashed Counter-Rotating Secondary Orbit */}
            <motion.circle
              cx={cx}
              cy={cy}
              r={144}
              fill="none"
              stroke="rgba(56, 242, 208, 0.25)"
              strokeWidth={1.2}
              strokeDasharray="5 8"
              animate={{ rotate: -360 }}
              transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />

            {/* Main Parameter Orbit Track */}
            <circle
              cx={cx}
              cy={cy}
              r={orbitR}
              fill="none"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={2}
            />

            {/* Clockwise Directional Arc Segments between nodes */}
            {domain.parameters.map((_, idx) => {
              const p1 = getNodeCoords(idx, orbitR)
              const p2 = getNodeCoords((idx + 1) % count, orbitR)
              const isPassedOrActive = idx === safeIdx
              return (
                <g key={`arc-${idx}`}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={p1.x}
                    y2={p1.y}
                    stroke={idx === safeIdx ? `${domain.color}88` : 'rgba(255,255,255,0.06)'}
                    strokeWidth={idx === safeIdx ? 2 : 1}
                    strokeDasharray={idx === safeIdx ? 'none' : '3 5'}
                  />
                  {isPassedOrActive && (
                    <motion.line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={`url(#sweepGrad-${domain.id})`}
                      strokeWidth={3}
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0.4 }}
                      animate={{ pathLength: tickProgress, opacity: 1 }}
                      transition={{ duration: 0.05, ease: 'linear' }}
                    />
                  )}
                </g>
              )
            })}

            {/* Rotating Clockwise Radar Hand */}
            <motion.g
              animate={{ rotate: activeAngleDeg }}
              transition={{ type: 'spring', stiffness: 95, damping: 16 }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            >
              <line
                x1={cx}
                y1={cy}
                x2={cx}
                y2={cy - orbitR + 24}
                stroke={`url(#sweepGrad-${domain.id})`}
                strokeWidth={3.5}
                strokeLinecap="round"
              />
              <polygon
                points={`${cx},${cy - orbitR + 18} ${cx - 6},${cy - orbitR + 30} ${cx + 6},${cy - orbitR + 30}`}
                fill={domain.color}
              />
            </motion.g>

            {/* Dispersion Halo Burst on Active Node */}
            <motion.circle
              key={`burst-${domain.id}-${safeIdx}`}
              cx={activeCoords.x}
              cy={activeCoords.y}
              r={24}
              fill="none"
              stroke={domain.color}
              strokeWidth={2.5}
              initial={{ r: 20, opacity: 0.95 }}
              animate={{ r: 44, opacity: 0 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
            />

            {/* 6 Clockwise Parameter Nodes (1 -> 2 -> 3 -> 4 -> 5 -> 6) */}
            {domain.parameters.map((param, idx) => {
              const pos = getNodeCoords(idx)
              const isActive = idx === safeIdx
              const isNext = idx === (safeIdx + 1) % count
              const shortLabel =
                param.name.length > 13 ? param.name.slice(0, 12) + '…' : param.name

              return (
                <g
                  key={param.name}
                  onClick={() => onSelectIdx(idx)}
                  style={{ cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Parameter ${idx + 1}: ${param.name}`}
                >
                  {/* Node Outer Ring */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isActive ? 25 : isNext ? 21 : 19}
                    fill={isActive ? domain.color : 'rgba(8, 17, 32, 0.92)'}
                    stroke={
                      isActive
                        ? '#ffffff'
                        : isNext
                          ? `${domain.color}aa`
                          : 'rgba(255,255,255,0.25)'
                    }
                    strokeWidth={isActive ? 2.8 : isNext ? 1.8 : 1.2}
                  />

                  {/* Clockwise Slot Number Badge (1..6) */}
                  <text
                    x={pos.x}
                    y={pos.y - 3}
                    textAnchor="middle"
                    fill={isActive ? '#041019' : '#f8fafc'}
                    fontSize={isActive ? 12 : 11}
                    fontWeight={900}
                  >
                    0{idx + 1}
                  </text>

                  {/* Short Parameter Label inside/below node */}
                  <text
                    x={pos.x}
                    y={pos.y + 9}
                    textAnchor="middle"
                    fill={isActive ? '#06202b' : '#94a3b8'}
                    fontSize={7.2}
                    fontWeight={800}
                  >
                    {shortLabel.split(' ')[0]}
                  </text>

                  {/* Floating Pill Caption outside node */}
                  <g
                    transform={`translate(${pos.x}, ${
                      pos.y + (pos.y >= cy ? 35 : -30)
                    })`}
                  >
                    <rect
                      x={-48}
                      y={-9}
                      width={96}
                      height={17}
                      rx={8.5}
                      fill={isActive ? `${domain.color}33` : 'rgba(5, 12, 24, 0.85)'}
                      stroke={isActive ? domain.color : 'rgba(255,255,255,0.14)'}
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={2.5}
                      textAnchor="middle"
                      fill={isActive ? '#ffffff' : '#cbd5e1'}
                      fontSize={8.2}
                      fontWeight={isActive ? 800 : 600}
                    >
                      {shortLabel}
                    </text>
                  </g>
                </g>
              )
            })}

            {/* Center Core Hub */}
            <circle
              cx={cx}
              cy={cy}
              r={42}
              fill="rgba(5, 12, 24, 0.95)"
              stroke={domain.color}
              strokeWidth={2.2}
            />
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              fill={domain.color}
              fontSize={8.5}
              fontWeight={800}
              letterSpacing="0.08em"
            >
              SLOT 0{safeIdx + 1}/0{count}
            </text>
            <text
              x={cx}
              y={cy + 3}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={10.5}
              fontWeight={900}
            >
              {activeParam.name.slice(0, 11)}
            </text>
            <text
              x={cx}
              y={cy + 16}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={8}
              fontWeight={700}
            >
              ↻ {intervalSec}s CLOCKWISE
            </text>
          </svg>

          {/* Linear Step Progress Bar under Dial */}
          <div style={{ width: '100%', maxWidth: 300, marginTop: 4 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: '#94a3b8',
                marginBottom: 4
              }}
            >
              <span>
                Step {safeIdx + 1} → Step {((safeIdx + 1) % count) + 1}
              </span>
              <span style={{ color: domain.color, fontWeight: 800 }}>
                {Math.round(tickProgress * 100)}% Dispersion
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 5,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.1)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${tickProgress * 100}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${domain.color}, #38f2d0, #ff5fd2)`,
                  transition: 'width 0.06s linear'
                }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Synchronized Clockwise Step Sequence & Live Dispersion Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 1 -> 2 -> 3 -> 4 -> 5 -> 6 Sequence Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 7
            }}
          >
            {domain.parameters.map((p, idx) => {
              const isAct = idx === safeIdx
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => onSelectIdx(idx)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 11,
                    cursor: 'pointer',
                    background: isAct
                      ? `linear-gradient(135deg, ${domain.color}2e, rgba(15, 23, 42, 0.92))`
                      : 'rgba(10, 18, 32, 0.72)',
                    border: isAct
                      ? `1.5px solid ${domain.color}`
                      : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: isAct ? `0 0 18px ${domain.color}33` : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 10,
                      fontWeight: 800,
                      color: isAct ? domain.color : '#94a3b8'
                    }}
                  >
                    <span>STEP 0{idx + 1}</span>
                    <span>{isAct ? '● LIVE' : '↻'}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: isAct ? '#ffffff' : '#cbd5e1',
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{
                      fontSize: 9.5,
                      color: '#64748b',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {p.unit}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Animated Active Parameter Dispersion Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${domain.id}-${safeIdx}`}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.24 }}
              style={{
                background: 'rgba(7, 15, 28, 0.92)',
                border: `1px solid ${domain.color}66`,
                borderRadius: 14,
                padding: '13px 15px',
                boxShadow: `inset 0 0 22px ${domain.color}14`
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: 6
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: domain.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em'
                  }}
                >
                  <Sparkles size={12} />
                  CLOCKWISE NODE 0{safeIdx + 1} → 0{((safeIdx + 1) % count) + 1} · {domain.badge}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#e2e8f0',
                    background: 'rgba(255,255,255,0.08)',
                    padding: '2px 8px',
                    borderRadius: 999
                  }}
                >
                  Range: {activeParam.range} ({activeParam.unit})
                </span>
              </div>

              <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', marginBottom: 4 }}>
                {activeParam.name}
              </div>

              <div
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 11.5,
                  color: domain.color,
                  background: 'rgba(2, 6, 23, 0.85)',
                  border: `1px solid ${domain.color}38`,
                  padding: '6px 10px',
                  borderRadius: 8,
                  marginBottom: 8
                }}
              >
                ƒ(x): {activeParam.formula}
              </div>

              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                {activeParam.desc}
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 6,
                  fontSize: 11,
                  color: '#94a3b8',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  paddingTop: 7
                }}
              >
                <span>
                  <strong style={{ color: '#e2e8f0' }}>Sensor / Source:</strong>{' '}
                  {activeParam.source}
                </span>
                <span>
                  <strong style={{ color: domain.color }}>Operational Decision:</strong>{' '}
                  {activeParam.use}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
