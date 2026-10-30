import type { Lang } from './i18nCatalog'

export type Greeting = { text: string; line: string; dot: boolean }

const KEY = 'seva-greet'

export function pickGreeting(name: string, guest: boolean, lang: Lang = 'en'): Greeting {
  const n = guest ? (lang === 'hi' ? 'मित्र' : lang === 'te' ? 'మిత్రమా' : 'friend') : name.split(' ')[0] || (lang === 'hi' ? 'मित्र' : lang === 'te' ? 'మిత్రమా' : 'friend')
  const h = new Date().getHours()

  if (lang === 'hi') {
    const part = h < 12 ? 'शुभ प्रभात' : h < 17 ? 'शुभ दोपहर' : 'शुभ संध्या'
    return {
      text: `${part}, ${n}`,
      line: 'रिमोट से अध्ययन क्षेत्र का निरीक्षण करें: नवीनतम स्पष्ट उपग्रह चित्र, बहु-कालिक चक्र और अपने खेत में स्थानीय बदलाव देखें।',
      dot: true
    }
  }

  if (lang === 'te') {
    const part = h < 12 ? 'శుభోదయం' : h < 17 ? 'శుభ మధ్యాహ్నం' : 'శుభ సాయంత్రం'
    return {
      text: `${part}, ${n}`,
      line: 'రిమోట్ పరిశీలన: తాజా స్పష్టమైన ఉపగ్రహ చిత్రాలను సమీక్షించండి, బహుళ-కాలిక మార్పులను మరియు మీ అధ్యయన ప్రాంతంలో మార్పులను గుర్తించండి.',
      dot: true
    }
  }

  const part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'
  const line = 'Review field from remote: inspect the latest clear satellite observations, compare multi-temporal passes, and spot spatial changes across your study area.'
  return {
    text: `Good ${part}, ${n}`,
    line,
    dot: true
  }
}

export function clearGreeting() { sessionStorage.removeItem(KEY) }

export function todayLabel(lang: Lang = 'en') {
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-US'
  return new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
}

