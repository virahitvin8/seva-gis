import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_ARGON_CONFIG,
  analyzeCropWithArgon,
  generateArgonPythonScript,
  type FarmArgonTelemetry
} from '../../services/geminiArgonService'

const sampleFarm: FarmArgonTelemetry = {
  farmName: 'Kaveri Basin Rice Paddock',
  crop: 'Paddy Rice',
  growthStage: 'Tillering / Panicle Initiation',
  areaHa: 2.85,
  lat: 16.5062,
  lon: 80.648,
  ndvi: 0.62,
  ndre: 0.38,
  ndmi: 0.18,
  savi: 0.55,
  evi: 0.58,
  soilMoisturePct: 24,
  elevationM: 32,
  slopeDegrees: 1.2,
  soilType: 'Clay Loam',
  recentRainfallMm: 4.5
}

test('configures gemini-4-argon with thinking_level: high by default', () => {
  assert.equal(DEFAULT_ARGON_CONFIG.model, 'gemini-4-argon')
  assert.equal(DEFAULT_ARGON_CONFIG.thinkingLevel, 'high')
  assert.equal(DEFAULT_ARGON_CONFIG.temperature, 0.2)
})

test('generates an executable Google GenAI SDK Python script using gemini-4-argon and high reasoning', () => {
  const script = generateArgonPythonScript(sampleFarm)
  assert.ok(script.includes('from google import genai'))
  assert.ok(script.includes('gemini-4-argon'))
  assert.ok(script.includes('"thinking_level": "high"'))
  assert.ok(script.includes('Kaveri Basin Rice Paddock'))
  assert.ok(script.includes('Paddy Rice'))
  assert.ok(script.includes('16.5062'))
  assert.ok(script.includes('80.6480'))
  assert.ok(script.includes('0.620'))
})

test('executes deterministic FAO-56 fallback when no API key or network error occurs', async () => {
  const result = await analyzeCropWithArgon(sampleFarm, {
    model: 'gemini-4-argon',
    thinkingLevel: 'high'
  })

  assert.ok(result.model.includes('gemini-4-argon'))
  assert.equal(result.isSimulatedOffline, true)
  assert.equal(result.thinkingLevel, 'high')
  assert.ok(['optimal', 'warning', 'critical'].includes(result.status))
  assert.ok(result.headline.length > 0)
  assert.ok(result.deepReasoningMarkdown.includes('Spectral Diagnosis'))
  assert.ok(result.actionableRecommendations.immediate.length > 0)
  assert.ok(result.variableRateAdvisory.recommendedWindow.length > 0)

  // Multilingual SMS advisories
  assert.ok(result.multilingualAdvisories.english.length > 0)
  assert.ok(result.multilingualAdvisories.hindi.length > 0)
  assert.ok(result.multilingualAdvisories.telugu.length > 0)
})

test('detects severe drought/water stress when NDMI and soil moisture are critically low', async () => {
  const droughtFarm: FarmArgonTelemetry = {
    ...sampleFarm,
    ndmi: 0.08,
    soilMoisturePct: 15,
    recentRainfallMm: 0
  }

  const result = await analyzeCropWithArgon(droughtFarm)
  assert.equal(result.status, 'critical')
  assert.ok((result.variableRateAdvisory.irrigationDepthMm ?? 0) >= 30)
  assert.ok(result.actionableRecommendations.whatToAvoid.some(a => /urea|nitrogen|saline/i.test(a)))
})

test('detects nitrogen chlorosis when NDRE is suppressed despite adequate moisture', async () => {
  const nitrogenDeficientFarm: FarmArgonTelemetry = {
    ...sampleFarm,
    ndvi: 0.65,
    ndre: 0.25, // Significantly lower than threshold 0.38
    ndmi: 0.35, // Moisture is good
    soilMoisturePct: 42
  }

  const result = await analyzeCropWithArgon(nitrogenDeficientFarm)
  assert.ok((result.variableRateAdvisory.nitrogenUreaKgHa ?? 0) > 25)
  assert.ok(/chlorosis|nitrogen|canopy/i.test(result.headline))
})
