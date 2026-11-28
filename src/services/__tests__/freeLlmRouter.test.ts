import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BANDIT_PRESETS,
  computeRouteScore,
  createCooldownEntry,
  isCooldownProbeRipe,
  rankLlmRoutes,
  executeRoutedOpenAiFallback,
  type LlmRouteCandidate,
} from '../freeLlmRouter';

const baseRoutes: LlmRouteCandidate[] = [
  {
    id: 'route-fast',
    platform: 'groq',
    label: 'Fast',
    baseUrl: 'https://example.invalid/v1',
    model: 'llama-fast',
    speedScore: 0.96,
    intelligenceScore: 0.55,
    successes: 5,
    failures: 1,
    headroomFactor: 1,
  },
  {
    id: 'route-smart',
    platform: 'openrouter',
    label: 'Smart',
    baseUrl: 'https://example.invalid/v1',
    model: 'deepseek-smart',
    speedScore: 0.45,
    intelligenceScore: 0.97,
    successes: 5,
    failures: 1,
    headroomFactor: 1,
  },
];

test('BANDIT_PRESETS sum to 1.0 and rank routes according to chosen strategy', () => {
  for (const w of Object.values(BANDIT_PRESETS)) {
    assert.ok(Math.abs(w.reliability + w.speed + w.intelligence - 1) < 1e-6);
  }
  const fastRanked = rankLlmRoutes(baseRoutes, 'fastest');
  assert.equal(fastRanked[0].id, 'route-fast');

  const smartRanked = rankLlmRoutes(baseRoutes, 'smartest');
  assert.equal(smartRanked[0].id, 'route-smart');
});

test('cooldown ladder escalates 2m -> 10m -> 1h -> 24h and honors half-time probing', () => {
  const t0 = 1_700_000_000_000;
  const cd1 = createCooldownEntry('r1', 0, t0);
  const cd2 = createCooldownEntry('r1', 1, t0);
  const cd3 = createCooldownEntry('r1', 2, t0);
  const cd4 = createCooldownEntry('r1', 3, t0);
  assert.equal(cd1.untilMs - t0, 2 * 60 * 1000);
  assert.equal(cd2.untilMs - t0, 10 * 60 * 1000);
  assert.equal(cd3.untilMs - t0, 60 * 60 * 1000);
  assert.equal(cd4.untilMs - t0, 24 * 60 * 60 * 1000);

  assert.equal(isCooldownProbeRipe(cd2, t0 + 60 * 1000), false);
  assert.equal(isCooldownProbeRipe(cd2, t0 + 6 * 60 * 1000), true);
  assert.ok(computeRouteScore(baseRoutes[0], 'balanced', cd2, t0 + 1000) < 0.05);
});

test('executeRoutedOpenAiFallback returns null quickly when unconfigured and fails over cleanly across routes', async () => {
  const unconfigured = await executeRoutedOpenAiFallback('Analyze NDVI', {
    strategy: 'balanced',
    freellmapiGatewayUrl: '',
    gatewayApiKey: '',
    groqApiKey: '',
    openRouterApiKey: '',
  });
  assert.equal(unconfigured, null);

  const origFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) {
      return new Response('Rate limited', { status: 429, headers: { 'retry-after': '120' } });
    }
    return new Response(
      JSON.stringify({
        model: 'auto:balanced',
        choices: [{ message: { content: JSON.stringify({ headline: 'Healthy Crop' }) } }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const res = await executeRoutedOpenAiFallback('Analyze NDVI', {
      strategy: 'balanced',
      freellmapiGatewayUrl: 'http://localhost:3001',
      gatewayApiKey: '',
      groqApiKey: 'gsk_test_key',
      openRouterApiKey: '',
    });
    assert.ok(res);
    assert.equal(calls, 2);
    assert.ok(res.text.includes('Healthy Crop'));
  } finally {
    globalThis.fetch = origFetch;
  }
});

