// Reverses the PowerShell text round-trip corruption.
//
// `Get-Content -Raw` decoded our UTF-8 file as Windows-1252, and `Set-Content
// -Encoding UTF8` wrote that back as UTF-8. The transform is therefore:
//
//   corrupted = utf8_encode( cp1252_decode( original_utf8_bytes ) )
//
// and it is exactly reversible, provided no byte was lost. Bytes 0x80-0x9F are the
// ones that differ between Latin-1 and Windows-1252, so they need an explicit table.
import { readFileSync, writeFileSync } from 'node:fs'

const CP1252_TO_BYTE = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
  [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
  [0x017e, 0x9e], [0x0178, 0x9f],
])

/** Returns null when the text cannot be a cp1252-decoded UTF-8 stream. */
function unroundtrip(text) {
  const bytes = []
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    // A UTF-8 BOM is a file-level marker, not content: `Set-Content -Encoding UTF8`
    // added one and Node keeps it as U+FEFF. Drop it rather than mapping it.
    if (cp === 0xfeff) continue
    if (CP1252_TO_BYTE.has(cp)) {
      bytes.push(CP1252_TO_BYTE.get(cp))
    } else if (cp <= 0xff) {
      bytes.push(cp)
    } else {
      return { fail: cp }
    }
  }
  const decoded = Buffer.from(bytes).toString('utf8')
  // A round-trip is only valid if nothing was replaced.
  if (decoded.includes('\uFFFD')) return { fail: -1 }
  return { text: decoded }
}

const looksNative = (text) => /[\u0900-\u097F]/.test(text) && /[\u0C00-\u0C7F]/.test(text)

const targets = process.argv.slice(2)
if (!targets.length) {
  console.error('usage: node scratch/recover-encoding.mjs <file> [file...]')
  process.exit(1)
}

for (const target of targets) {
  let text = readFileSync(target, 'utf8')
  const before = text
  let passes = 0
  while (!looksNative(text) && passes < 4) {
    const result = unroundtrip(text)
    if (!result || result.fail !== undefined) {
      console.log(`  blocked at pass ${passes}: unmappable code point U+${(result?.fail ?? 0).toString(16).toUpperCase()}`)
      break
    }
    if (result.text === text) break
    text = result.text
    passes += 1
  }
  if (looksNative(text)) {
    writeFileSync(target, text, 'utf8')
    console.log(`recovered ${target} after ${passes} pass(es) — Devanagari and Telugu present`)
  } else {
    console.log(`NO CHANGE for ${target} (${passes} passes, ${text.length} chars)`)
  }
  void before
}
