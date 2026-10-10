import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export default function Reveal({ children, delay = 0, defer = false }: { children: ReactNode; delay?: number; defer?: boolean }) {
  const calm = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [entered, setEntered] = useState(!defer)

  useEffect(() => {
    if (!defer || entered || !ref.current) return
    if (typeof IntersectionObserver === 'undefined') { setEntered(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setEntered(true)
        observer.disconnect()
      }
    }, { rootMargin: '500px 0px' })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [defer, entered])

  return (
    <motion.div
      ref={ref}
      initial={calm ? false : { opacity: 0, y: 28 }}
      whileInView={calm ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {entered ? children : <div className="reveal-placeholder" aria-hidden="true" />}
    </motion.div>
  )
}
