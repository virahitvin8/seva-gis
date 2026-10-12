import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATALOGS, LANGUAGE_OPTIONS } from '../i18nCatalog.ts'

const LANGS = ['en', 'hi', 'te'] as const

test('every language has exactly the same keys', () => {
  const reference = Object.keys(CATALOGS.en).sort()
  assert.ok(reference.length > 0, 'the English catalogue is empty')
  for (const lang of LANGS) {
    const keys = Object.keys(CATALOGS[lang]).sort()
    const missing = reference.filter(k => !keys.includes(k))
    const extra = keys.filter(k => !reference.includes(k))
    assert.deepEqual(missing, [], `${lang} is missing keys: ${missing.join(', ')}`)
    assert.deepEqual(extra, [], `${lang} has keys English does not: ${extra.join(', ')}`)
  }
})

test('no catalogue value is empty or left as a placeholder', () => {
  for (const lang of LANGS) {
    for (const [key, value] of Object.entries(CATALOGS[lang])) {
      assert.ok(value.trim().length > 0, `${lang}.${key} is empty`)
      assert.ok(!/^TODO|^\?\?\?/.test(value), `${lang}.${key} looks unfinished: ${value}`)
    }
  }
})

test('Telugu and Hindi entries are actually in their own script', () => {
  // Guards against a key being created and then accidentally left as English copy.
  const devanagari = /[\u0900-\u097F]/
  const telugu = /[\u0C00-\u0C7F]/

  for (const [key, value] of Object.entries(CATALOGS.hi)) {
    assert.ok(devanagari.test(value), `hi.${key} has no Devanagari text: "${value}"`)
  }
  for (const [key, value] of Object.entries(CATALOGS.te)) {
    assert.ok(telugu.test(value), `te.${key} has no Telugu text: "${value}"`)
  }
})

test('translations differ from English rather than being copied across', () => {
  let identical = 0
  for (const key of Object.keys(CATALOGS.en)) {
    if (CATALOGS.hi[key] === CATALOGS.en[key]) identical++
    if (CATALOGS.te[key] === CATALOGS.en[key]) identical++
  }
  assert.equal(identical, 0, `${identical} entries are byte-identical to English`)
})

test('the language picker offers exactly the languages the catalogues define', () => {
  assert.deepEqual(LANGUAGE_OPTIONS.map(o => o.code).sort(), [...LANGS].sort())
})
