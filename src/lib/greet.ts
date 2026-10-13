export type Greeting = { text: string; line: string; dot: boolean }

const KEY = 'seva-greet'

function pool(n: string, h: number): Greeting[] {
  const part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'
  const line = 'Review field from remote: inspect the latest clear satellite observations, compare multi-temporal passes, and spot spatial changes across your study area.'
  const list: Greeting[] = [
    { text: `Good ${part}, ${n}`, line, dot: true },
    { text: `Welcome back, ${n}`, line, dot: true },
    { text: `Great to see you, ${n}`, line, dot: true },
    { text: `Hey ${n}!`, line, dot: false },
    { text: `Hello ${n}!`, line, dot: false },
    { text: `Hi ${n}, what's up?`, line, dot: false },
    { text: `Kya bolti public, ${n}!`, line, dot: false },
    { text: `Kya scene hai, ${n}!`, line, dot: false },
    { text: `Arre ${n}, kaisa hai bhai!`, line, dot: false },
    { text: `Yo ${n}, sab badhiya?`, line, dot: false },
    { text: `Ssup ${n}! Scene sort hai!`, line, dot: false },
    { text: `Namaste ji, ${n} 🙏`, line, dot: false },
    { text: `Ram Ram, ${n} bhai!`, line, dot: false },
    { text: `Vanakkam, ${n}!`, line, dot: true },
    { text: `Kemon acho, ${n}!`, line, dot: true },
    { text: `What's good, ${n}! Ready to map?`, line, dot: false },
  ]
  if (part === 'morning') list.push({ text: `Suprabhatam, ${n}! Chai peelo ☕`, line, dot: true })
  return list
}

export function pickGreeting(name: string, guest: boolean): Greeting {
  const n = guest ? 'friend' : name.split(' ')[0] || 'friend'
  const list = pool(n, new Date().getHours())
  let i = Number(sessionStorage.getItem(KEY))
  if (!Number.isFinite(i) || sessionStorage.getItem(KEY) === null) { i = Math.floor(Math.random() * list.length); sessionStorage.setItem(KEY, String(i)) }
  return list[i % list.length]
}

export function clearGreeting() { sessionStorage.removeItem(KEY) }

export function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
}
