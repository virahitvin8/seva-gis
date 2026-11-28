/**
 * SEVA.GIS FreeLLMAPI Multi-Provider Smart Router & Bandit Scorer
 * Derived cleanly from tashfeenahmed/freellmapi (MIT License):
 *   - Thompson/Beta-posterior reliability + speed + intelligence bandit scoring
 *   - Bounded multiplicative guardrails (headroomFactor * rateLimitFactor)
 *   - Escalating heuristic cooldown ladder (2m -> 10m -> 1h -> 24h) + authoritative Retry-After
 *   - Half-time early probe gating for recovering free endpoints
 *   - OpenAI-compatible multi-provider chain including FreeLLMAPI /v1 local/self-hosted gateway
 */

export type RoutingStrategy = 'balanced' | 'smartest' | 'fastest' | 'reliable';

export interface RoutingWeights {
  reliability: number;
  speed: number;
  intelligence: number;
}

export const BANDIT_PRESETS: Record<RoutingStrategy, RoutingWeights> = {
  balanced: { reliability: 0.5, speed: 0.25, intelligence: 0.25 },
  smartest: { reliability: 0.35, speed: 0.1, intelligence: 0.55 },
  fastest: { reliability: 0.35, speed: 0.55, intelligence: 0.1 },
  reliable: { reliability: 0.7, speed: 0.15, intelligence: 0.15 },
};

export const HEURISTIC_COOLDOWN_LADDER_MS = [
  2 * 60 * 1000,      // 2 minutes
  10 * 60 * 1000,     // 10 minutes
  60 * 60 * 1000,     // 1 hour
  24 * 60 * 60 * 1000 // 24 hours
];

export interface CooldownEntry {
  routeId: string;
  failures: number;
  benchedAtMs: number;
  untilMs: number;
  kind: 'heuristic' | 'authoritative' | 'credit';
}

export interface LlmRouteCandidate {
  id: string;
  platform: 'freellmapi-gateway' | 'google' | 'groq' | 'openrouter' | 'mistral' | 'cerebras' | 'ollama' | 'custom';
  label: string;
  baseUrl: string;
  model: string;
  keyless?: boolean;
  speedScore: number;        // 0..1
  intelligenceScore: number; // 0..1
  successes: number;
  failures: number;
  headroomFactor: number;    // 0..1 remaining quota factor
}

export interface RouterRuntimeConfig {
  strategy: RoutingStrategy;
  freellmapiGatewayUrl: string;
  gatewayApiKey: string;
  groqApiKey: string;
  openRouterApiKey: string;
}

const STORAGE_ROUTER_CFG = 'seva_freellmapi_router_cfg';

export function getStoredRouterConfig(): RouterRuntimeConfig {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_ROUTER_CFG) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        strategy: parsed.strategy && parsed.strategy in BANDIT_PRESETS ? parsed.strategy : 'balanced',
        freellmapiGatewayUrl: String(parsed.freellmapiGatewayUrl || '').trim(),
        gatewayApiKey: String(parsed.gatewayApiKey || ''),
        groqApiKey: String(parsed.groqApiKey || ''),
        openRouterApiKey: String(parsed.openRouterApiKey || ''),
      };
    }
  } catch {
    // ignore storage restriction
  }
  return {
    strategy: 'balanced',
    freellmapiGatewayUrl: '',
    gatewayApiKey: '',
    groqApiKey: '',
    openRouterApiKey: '',
  };
}

export function saveStoredRouterConfig(cfg: Partial<RouterRuntimeConfig>): void {
  const merged = { ...getStoredRouterConfig(), ...cfg };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_ROUTER_CFG, JSON.stringify(merged));
    }
  } catch {
    // ignore storage restriction
  }
}

/**
 * Beta posterior reliability estimate (Jeffreys/Laplace smoothing so a route is never frozen permanently).
 */
export function betaPosteriorMean(successes: number, failures: number): number {
  const s = Math.max(0, successes);
  const f = Math.max(0, failures);
  return (s + 1) / (s + f + 2);
}

/**
 * Scores a candidate route using bounded weights and multiplicative safety guardrails (freellmapi formula).
 */
export function computeRouteScore(
  candidate: LlmRouteCandidate,
  strategy: RoutingStrategy = 'balanced',
  cooldown: CooldownEntry | null = null,
  nowMs: number = Date.now()
): number {
  const w = BANDIT_PRESETS[strategy] || BANDIT_PRESETS.balanced;
  const rel = betaPosteriorMean(candidate.successes, candidate.failures);
  const base =
    w.reliability * rel +
    w.speed * Math.max(0, Math.min(1, candidate.speedScore)) +
    w.intelligence * Math.max(0, Math.min(1, candidate.intelligenceScore));

  const headroom = Math.max(0.05, Math.min(1, candidate.headroomFactor));
  let rateLimitFactor = 1.0;
  if (cooldown && nowMs < cooldown.untilMs) {
    rateLimitFactor = cooldown.kind === 'credit' ? 0 : 0.02;
  }
  return Number((base * headroom * rateLimitFactor).toFixed(4));
}

/**
 * Escalates cooldown duration across the 2m -> 10m -> 1h -> 24h ladder unless Retry-After is authoritative.
 */
export function createCooldownEntry(
  routeId: string,
  prevFailures: number,
  nowMs: number = Date.now(),
  retryAfterMs?: number,
  statusCode?: number
): CooldownEntry {
  const failures = prevFailures + 1;
  if (statusCode === 402) {
    return {
      routeId,
      failures,
      benchedAtMs: nowMs,
      untilMs: nowMs + 24 * 60 * 60 * 1000,
      kind: 'credit',
    };
  }
  if (typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return {
      routeId,
      failures,
      benchedAtMs: nowMs,
      untilMs: nowMs + retryAfterMs,
      kind: 'authoritative',
    };
  }
  const idx = Math.min(HEURISTIC_COOLDOWN_LADDER_MS.length - 1, Math.max(0, failures - 1));
  return {
    routeId,
    failures,
    benchedAtMs: nowMs,
    untilMs: nowMs + HEURISTIC_COOLDOWN_LADDER_MS[idx],
    kind: 'heuristic',
  };
}

/**
 * Returns true if a heuristic cooldown has served >=50% of its bench with >=60s remaining (half-time probe).
 */
export function isCooldownProbeRipe(entry: CooldownEntry, nowMs: number = Date.now()): boolean {
  if (entry.kind !== 'heuristic') return false;
  const total = entry.untilMs - entry.benchedAtMs;
  const elapsed = nowMs - entry.benchedAtMs;
  const remaining = entry.untilMs - nowMs;
  return total > 0 && elapsed >= total * 0.5 && remaining >= 60 * 1000;
}

/**
 * Ranks available OpenAI-compatible routes in descending bandit score order, filtering hard-benched routes
 * unless ripe for early probe recovery.
 */
export function rankLlmRoutes(
  candidates: LlmRouteCandidate[],
  strategy: RoutingStrategy,
  cooldowns: Record<string, CooldownEntry> = {},
  nowMs: number = Date.now()
): LlmRouteCandidate[] {
  return candidates
    .filter((c) => {
      const cd = cooldowns[c.id];
      if (!cd || nowMs >= cd.untilMs) return true;
      return isCooldownProbeRipe(cd, nowMs);
    })
    .sort((a, b) => {
      const scoreB = computeRouteScore(b, strategy, cooldowns[b.id] || null, nowMs);
      const scoreA = computeRouteScore(a, strategy, cooldowns[a.id] || null, nowMs);
      return scoreB - scoreA;
    });
}

export interface RoutedCompletionResult {
  text: string;
  routeId: string;
  platform: string;
  model: string;
}

/**
 * Attempts an OpenAI-compatible `/chat/completions` call across ranked FreeLLMAPI/provider routes with cooldown tracking.
 */
export async function executeRoutedOpenAiFallback(
  prompt: string,
  cfg: RouterRuntimeConfig = getStoredRouterConfig(),
  timeoutMs = 12000
): Promise<RoutedCompletionResult | null> {
  const candidates: Array<LlmRouteCandidate & { apiKey?: string }> = [];

  if (cfg.freellmapiGatewayUrl) {
    const cleanBase = cfg.freellmapiGatewayUrl.replace(/\/$/, '');
    candidates.push({
      id: 'freellmapi-gateway',
      platform: 'freellmapi-gateway',
      label: 'FreeLLMAPI Local/Self-Hosted Router',
      baseUrl: cleanBase.endsWith('/v1') ? cleanBase : `${cleanBase}/v1`,
      model: 'auto:balanced',
      apiKey: cfg.gatewayApiKey || 'freellmapi',
      keyless: !cfg.gatewayApiKey,
      speedScore: 0.9,
      intelligenceScore: 0.92,
      successes: 3,
      failures: 0,
      headroomFactor: 1.0,
    });
  }

  if (cfg.groqApiKey) {
    candidates.push({
      id: 'groq-llama-3.3',
      platform: 'groq',
      label: 'Groq Free Tier',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
      apiKey: cfg.groqApiKey,
      speedScore: 0.98,
      intelligenceScore: 0.85,
      successes: 2,
      failures: 0,
      headroomFactor: 1.0,
    });
  }

  if (cfg.openRouterApiKey) {
    candidates.push({
      id: 'openrouter-free',
      platform: 'openrouter',
      label: 'OpenRouter Free Pool',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      apiKey: cfg.openRouterApiKey,
      speedScore: 0.72,
      intelligenceScore: 0.88,
      successes: 2,
      failures: 0,
      headroomFactor: 1.0,
    });
  }

  if (candidates.length === 0) return null;

  const cooldownStore: Record<string, CooldownEntry> = {};
  const ranked = rankLlmRoutes(candidates, cfg.strategy, cooldownStore);
  const keyMap = new Map(candidates.map((c) => [c.id, c.apiKey || '']));

  for (const route of ranked) {
    try {
      const res = await fetch(`${route.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(keyMap.get(route.id) ? { Authorization: `Bearer ${keyMap.get(route.id)}` } : {}),
        },
        body: JSON.stringify({
          model: route.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const retrySec = Number(res.headers.get('retry-after'));
        cooldownStore[route.id] = createCooldownEntry(
          route.id,
          route.failures,
          Date.now(),
          Number.isFinite(retrySec) ? retrySec * 1000 : undefined,
          res.status
        );
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === 'string' && text.trim()) {
        return {
          text,
          routeId: route.id,
          platform: route.platform,
          model: data?.model || route.model,
        };
      }
    } catch {
      cooldownStore[route.id] = createCooldownEntry(route.id, route.failures, Date.now());
    }
  }

  return null;
}

