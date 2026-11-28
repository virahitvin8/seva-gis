/**
 * Explicit CORS allow-list shared across server.js, Vercel /api/* handlers, and Vite dev middleware.
 * Never emits wildcard '*'; supports production domains, localhost dev ports, and Capacitor native shells.
 */
export const DEFAULT_ALLOWED_ORIGINS = [
  'https://sevagis.dpdns.org',
  'https://sevagis.is-a.dev',
  'https://sevagis.is-a.bot',
  'https://sevagis.stusite.me',
  'https://virahitvin8.github.io',
  'https://seva-gis.vercel.app',
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'http://localhost:8443',
  'http://localhost:8081',
  'http://localhost:5173',
  'http://127.0.0.1:8443',
  'http://127.0.0.1:5173',
];

export function resolveAllowedOrigins() {
  const raw = typeof process !== 'undefined' && process.env?.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : DEFAULT_ALLOWED_ORIGINS;
  const merged = new Set(DEFAULT_ALLOWED_ORIGINS);
  for (const item of raw) {
    const trimmed = String(item || '').trim();
    if (trimmed) merged.add(trimmed);
  }
  return merged;
}

export function applyCorsHeaders(req, res) {
  const origin = req?.headers?.origin;
  if (!origin) return false;
  const allowed = resolveAllowedOrigins();
  if (allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-SEVA-Mail-Backend');
    res.setHeader('Access-Control-Max-Age', '600');
    return true;
  }
  return false;
}

