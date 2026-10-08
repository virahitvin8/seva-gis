import { motion, useReducedMotion } from 'motion/react'
import { Mail } from 'lucide-react'

const LINKS = [
  { href: 'mailto:akshitvinay4636@gmail.com', label: 'Email Akshit Vinay', cls: 'mail', icon: <Mail size={22}/> },
  { href: 'https://www.linkedin.com/in/neelam-akshit-vinay-b18554322', label: 'Akshit Vinay on LinkedIn', cls: 'in', icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4V21H3zM9.75 9.75h3.8v1.6h.06c.53-1 1.82-2.05 3.75-2.05 4 0 4.74 2.64 4.74 6.07V21h-4v-4.9c0-1.17-.02-2.67-1.63-2.67-1.63 0-1.88 1.27-1.88 2.58V21h-4z"/></svg> },
  { href: 'https://github.com/virahitvin8', label: 'Akshit Vinay on GitHub', cls: 'gh', icon: <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg> },
]

export default function Credits() {
  const calm = useReducedMotion()
  const draw = (delay: number) => calm ? {} : { initial: { pathLength: 0 }, whileInView: { pathLength: 1 }, viewport: { once: true }, transition: { duration: 1.2, delay, ease: 'easeInOut' as const } }
  return (
    <section className="cr" aria-label="Credits">
      <svg className="cr-wave top" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true">
        <motion.path d="M0 20 C40 0 80 40 120 20 S200 0 240 20 S320 40 360 20 S440 0 480 20 S560 40 600 20" fill="none" stroke="#b6f36a" strokeWidth="2.5" strokeLinecap="round" {...draw(0)}/>
        <motion.path d="M0 28 C40 10 80 46 120 28 S200 10 240 28 S320 46 360 28 S440 10 480 28 S560 46 600 28" fill="none" stroke="#fee08b" strokeWidth="1.6" strokeLinecap="round" opacity=".7" {...draw(0.3)}/>
      </svg>
      <p className="cr-tag">Idea, design and coded for everyone who loves the land, and wants to see it grow. <svg className="cr-heart" viewBox="0 0 24 24" aria-label="love" role="img"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3 5 6.5 5c2.1 0 3.9 1.2 5.5 3.2C13.6 6.2 15.4 5 17.5 5 21 5 22.8 8.6 21.5 11.8 19.5 16.4 12 21 12 21z" fill="#e0245e"/></svg></p>
      <svg className="cr-wave bottom" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true">
        <motion.path d="M0 20 C40 40 80 0 120 20 S200 40 240 20 S320 0 360 20 S440 40 480 20 S560 0 600 20" fill="none" stroke="#b6f36a" strokeWidth="2.5" strokeLinecap="round" {...draw(0.2)}/>
      </svg>
      <div className="cr-links">
        {LINKS.map(l => <motion.a key={l.cls} className={`cr-btn ${l.cls}`} href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" aria-label={l.label} title={l.label} whileHover={{ y: -5, rotate: -6, scale: 1.08 }} whileTap={{ scale: 0.94 }}>{l.icon}</motion.a>)}
      </div>
    </section>
  )
}
