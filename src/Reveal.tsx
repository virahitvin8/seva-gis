import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export default function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const calm = useReducedMotion()
  if (calm) return <>{children}</>
  return <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>
}
