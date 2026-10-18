/**
 * SEVA.GIS — Central API helper
 *
 * Usage:
 *   import { api } from '@/lib/api';
 *   const res = await api('/api/gee/indices', { method: 'POST', body: JSON.stringify(payload) });
 *
 * Set VITE_API_BASE in your CI/deploy environment to point at the backend host.
 * When unset (GitHub Pages static build), api() calls fall through to the browser
 * which returns 404; the caller must handle that as 'status: unavailable'.
 */

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';

export async function api(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  // Guard: if the response is an HTML error page (e.g. a 404 SPA fallback),
  // return a synthetic JSON error response instead of letting res.json() throw.
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json') && !res.ok) {
    return new Response(
      JSON.stringify({ status: 'unavailable', reason: `HTTP ${res.status} from ${url} (non-JSON response)` }),
      { status: res.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return res;
}
