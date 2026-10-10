export type Greeting = { text: string; line: string; dot: boolean }

const KEY = 'seva-greet'

function pool(n: string, h: number): Greeting[] {
  const part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'
  const line = 'Review a field from home: see the latest clear satellite picture, compare earlier passes, and spot areas that changed.'
  const list: Greeting[] = [
    { text: `Good ${part}, ${n}`, line, dot: true },
    { text: `Welcome back, ${n}`, line, dot: true },
    { text: `Great to see you, ${n}`, line, dot: true },
    { text: `Hey ${n}!`, line, dot: false },
    { text: `Hello ${n}!`, line, dot: false },
    { text: `Hi ${n}, what's up?`, line, dot: false },
    { text: `Yo ${n}!`, line, dot: false },
    { text: `How's it going, ${n}?`, line, dot: false },
    { text: `What are we building today, ${n}?`, line: 'Choose a field, compare satellite passes, or open the GeoAI studio for a closer remote review.', dot: false },
    { text: `Namaste, ${n} 🙏`, line, dot: false },
    { text: `Namaskaram, ${n}`, line, dot: true },
    { text: `Hola, ${n}`, line, dot: true },
    { text: `Bonjour, ${n}`, line, dot: true },
    { text: `Hallo, ${n}`, line, dot: true },
    { text: `Ciao, ${n}`, line, dot: true },
    { text: `Konnichiwa, ${n}`, line, dot: true },
  ]
  if (part === 'morning') list.push({ text: `Suprabhatam, ${n}`, line, dot: true })
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
