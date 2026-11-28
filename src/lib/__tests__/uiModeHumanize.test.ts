import { test } from 'node:test'
import assert from 'node:assert/strict'
import { humanizeAoiCondition } from '../humanizeMetrics.ts'
import { detectAppRuntime } from '../appRuntime.ts'

test('humanizeAoiCondition avoids fabricating numbers when analysis and rain are missing', () => {
  const empty = humanizeAoiCondition({ areaHa: 2.5 })
  assert.equal(empty.hasAnalysis, false)
  assert.equal(empty.aoiHealthScore, null)
  assert.equal(empty.waterNeedMm, null)
  assert.equal(empty.waterVolumeM3, null)
  assert.equal(empty.dailyWaterMm, null)
  assert.ok(empty.references.length >= 3)
})

test('humanizeAoiCondition computes score out of 100, water volumes, and sky themes from real inputs', () => {
  const cond = humanizeAoiCondition({
    areaHa: 2.0,
    rain7dMm: 22,
    analysis: {
      scene: { id: 'S2A_TEST', datetime: '2026-11-20T05:10:00Z', cloud: 4 },
      ndvi: { mean: 0.66, min: 0.25, max: 0.85, p10: 0.42, p50: 0.68, p90: 0.81, n: 100 },
      ndwi: { mean: -0.1, min: -0.3, max: 0.1, p10: -0.2, p50: -0.1, p90: 0.05, n: 100 },
      ndmi: { mean: 0.24, min: 0.05, max: 0.41, p10: 0.12, p50: 0.25, p90: 0.35, n: 100 },
      means: { ndwi: -0.1, ndbi: -0.15 },
      stressPct: 8,
      slopePct: 1.5,
      elevMean: 245,
      analysedAt: '2026-11-20T05:15:00Z',
    },
  })

  assert.equal(cond.hasAnalysis, true)
  assert.equal(cond.aoiHealthScore, Math.round(((0.66 + 0.1) / 0.95) * 100))
  assert.equal(cond.skyTheme, 'rain')
  assert.equal(cond.dailyWaterMm, 4.0)
  // weekly demand 4*7=28 minus 0.75*22=16.5 -> 11.5 mm -> 2.0 ha * 10 = 230 m3
  assert.equal(cond.waterNeedMm, 11.5)
  assert.equal(cond.waterVolumeM3, 230)
  assert.equal(cond.references[0].acquisitionDate, '2026-11-20')
  assert.equal(cond.references[0].cloudPct, 4)
})

test('detectAppRuntime returns false in standard SSR/Node/browser window and detects Android WebView / Capacitor', () => {
  assert.equal(detectAppRuntime(), false)
  assert.equal(detectAppRuntime({ location: { search: '' }, navigator: { userAgent: 'Mozilla/5.0 Chrome/120' } }), false)

  assert.equal(
    detectAppRuntime({
      Capacitor: { isNativePlatform: () => true },
      location: { search: '' },
      matchMedia: () => ({ matches: false }),
    }),
    true
  )

  assert.equal(
    detectAppRuntime({
      location: { search: '' },
      matchMedia: () => ({ matches: true }),
    }),
    true
  )

  assert.equal(
    detectAppRuntime({
      location: { search: '' },
      navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36' },
    }),
    true
  )
})
