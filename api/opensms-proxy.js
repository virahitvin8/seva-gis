function isPrivateOrLoopbackHost(urlString) {
  try {
    const { hostname } = new URL(urlString);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
      hostname.endsWith('.local')
    );
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ stat: false, error: 'Method Not Allowed. Use POST.' });
    return;
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    let target = String(payload.serverUrl || '').trim();
    if (!target) {
      res.status(400).json({ stat: false, error: 'OpenSMS gateway URL is not set.' });
      return;
    }
    if (!target.endsWith('/')) target += '/';

    if (isPrivateOrLoopbackHost(target)) {
      res.status(502).json({
        stat: false,
        reason: 'private-lan-ip',
        error: `Cloud server cannot reach private phone IP (${target}). Use Phone SMS App / WhatsApp directly, run OpenSMS via HTTPS tunnel (Tailscale/Cloudflare/ngrok), or dispatch from the Android app on the same Wi-Fi.`,
      });
      return;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (payload.apiKey && String(payload.apiKey).trim()) {
      headers['Authorization'] = `Bearer ${String(payload.apiKey).trim()}`;
    }

    const upstream = await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify({ number: payload.number, text: payload.text }),
      signal: AbortSignal.timeout(8000),
    });

    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (err) {
    res.status(502).json({
      stat: false,
      error: err?.message || 'OpenSMS proxy request failed.',
    });
  }
}

