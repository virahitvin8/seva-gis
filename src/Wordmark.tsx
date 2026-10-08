import { motion, useReducedMotion } from 'motion/react'

type Props = { variant?: 'script' | 'pro'; tag?: string }

export default function Wordmark({ variant = 'script', tag }: Props) {
  const calm = useReducedMotion()
  if (variant === 'pro') return (
    <span className="wm pro notranslate" translate="no">
      <span className="wm-text" aria-label="seva.gis">seva<em>.gis</em></span>
      {tag && <small>{tag}</small>}
    </span>
  )
  const draw = calm ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 1.2, delay: 0.5, ease: 'easeInOut' as const } }
  return (
    <span className="wm lg glow notranslate" translate="no">
      <span className="wm-text" aria-label="seva.gis">seva<i className="wm-dot">•</i><em>gis</em></span>
      <svg className="wm-swash" viewBox="0 0 200 18" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="wmg" x1="0" x2="1"><stop offset="0" stopColor="#b6f36a"/><stop offset=".5" stopColor="#38f2d0"/><stop offset="1" stopColor="#ff5fd2"/></linearGradient></defs>
        <motion.path d="M4 12 C40 3 90 15 130 8 S185 5 196 9" fill="none" stroke="url(#wmg)" strokeWidth="3.5" strokeLinecap="round" {...draw}/>
      </svg>
      {tag && <small>{tag}</small>}
    </span>
  )
}
