// Measures how much of SEVA·GIS is actually translatable today.
//
// The user's complaint is that switching to Telugu changes almost nothing. This
// script turns that feeling into a number rather than an opinion:
//
//   * "translatable" strings are prose-like literals that a user can read on screen
//     (JSX text nodes and JSX attribute strings such as placeholder/title/aria-label);
//   * "wired" strings are the ones that go through t('key') or a catalogue entry.
//
// Run with: npm run i18n:coverage

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

/** Text that already lives in a translation catalogue, so it does not need counting. */
const CATALOGUE_FILES = ['src/lib/i18nCatalog.ts', 'src/report.ts', 'src/lib/plainTalk.ts']

const PROSE = /[A-Za-z]{3,}\s+[A-Za-z]{3,}/
const SKIP = [
  /^https?:/,
  /^data:/,
  /^#/,
  /^[\d\s.,:%/()+·-]*$/,
  /^[a-z-]+$/,
  /^[A-Z_]+$/,
]

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full)
  }
  return out
}

function isProse(value) {
  const s = value.trim()
  if (s.length < 6) return false
  if (SKIP.some(re => re.test(s))) return false
  return PROSE.test(s)
}

function proseIn(text) {
  const found = new Set()
  for (const m of text.matchAll(/(?:placeholder|title|aria-label|alt|label)\s*=\s*"([^"]{6,})"/g)) {
    if (isProse(m[1])) found.add(m[1].trim())
  }
  for (const m of text.matchAll(/>\s*([A-Z][A-Za-z][^<>{}\n]{6,})\s*</g)) {
    if (isProse(m[1])) found.add(m[1].trim())
  }
  return [...found]
}

// `node scripts/i18n-coverage.mjs --list <file>` prints the untranslated strings so
// they can be turned into catalogue keys without guessing.
const listIndex = process.argv.indexOf('--list')
if (listIndex !== -1) {
  for (const target of process.argv.slice(listIndex + 1)) {
    const abs = join(ROOT, target)
    const strings = proseIn(readFileSync(abs, 'utf8'))
    console.log(`=== ${target} — ${strings.length} untranslated prose strings ===`)
    strings.forEach((s, i) => console.log(`${String(i + 1).padStart(3)}. [${s.length}] ${s.replace(/\s+/g, ' ').slice(0, 200)}`))
  }
  process.exit(0)
}

const files = walk(SRC)
let translatable = 0
let wiredCalls = 0
const allKeys = new Set()
const perFile = []

for (const file of files) {
  const rel = relative(ROOT, file)
  const text = readFileSync(file, 'utf8')

  // Strings the app currently shows but that are not routed through a catalogue.
  const literals = new Set()
  if (file.endsWith('.tsx')) {
    for (const m of text.matchAll(/(?:placeholder|title|aria-label|alt|label)\s*=\s*"([^"]{6,})"/g)) {
      if (isProse(m[1])) literals.add(m[1].trim())
    }
    for (const m of text.matchAll(/>\s*([A-Z][A-Za-z][^<>{}\n]{6,})\s*</g)) {
      if (isProse(m[1])) literals.add(m[1].trim())
    }
  }

  const wired = [...text.matchAll(/\bt\(\s*'([^']+)'/g)].length
  wiredCalls += wired

  const isCatalogue = CATALOGUE_FILES.some(c => rel.replace(/\\/g, '/') === c)
  if (isCatalogue) {
    const keys = new Set([...text.matchAll(/^\s*'([a-z][\w.]*)':/gm)].map(m => m[1]))
    for (const key of keys) allKeys.add(key)
    perFile.push({ rel, literals: 0, wired, keys: keys.size, isCatalogue: true })
    continue
  }

  translatable += literals.size
  perFile.push({ rel, literals: literals.size, wired, keys: 0, isCatalogue: false })
}

const catalogueKeys = allKeys.size

// Coverage = share of user-visible prose that is routed through a catalogue.
// A t() call site corresponds to one translated string, so this is a straight
// comparison of "wired" against "still hard-coded English".
const pct = translatable + wiredCalls ? (wiredCalls / (wiredCalls + translatable)) * 100 : 0

console.log('SEVA·GIS — localisation coverage')
console.log('=================================')
console.log(`prose strings still hard-coded in components : ${translatable}`)
console.log(`t() call sites wired to the catalogue        : ${wiredCalls}`)
console.log(`distinct catalogue keys defined              : ${catalogueKeys}`)
console.log('')
console.log(`COVERAGE: ${pct.toFixed(1)}%  (wired / (wired + still hard-coded))`)
console.log('')
console.log('Worst offenders (most untranslated prose):')
perFile
  .filter(f => !f.isCatalogue && f.literals > 0)
  .sort((a, b) => b.literals - a.literals)
  .slice(0, 15)
  .forEach(f => console.log(`  ${String(f.literals).padStart(4)}  ${f.rel}`))
