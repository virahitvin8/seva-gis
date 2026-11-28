/**
 * SEVA.GIS Zero-Server Cloudflare Mail Worker (Apache-2.0)
 * Architectural pattern inspired by hieunc229/mailflare Cloudflare Workers + D1/R2 edge email.
 * Deploy cleanly on Cloudflare's free Workers tier so static hosts (sevagis.dpdns.org, Android APK)
 * can dispatch field reports over HTTPS with zero VPS infrastructure.
 */

const ALLOWED_ORIGINS = new Set([
  'https://sevagis.dpdns.org',
  'https://sevagis.is-a.dev',
  'https://sevagis.is-a.bot',
  'https://seva-gis.vercel.app',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:8443',
  'http://localhost:5173',
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-SEVA-Mail-Backend',
    'Vary': 'Origin',
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return Response.json(
        { success: false, error: 'Method Not Allowed. Send JSON POST to this worker.' },
        { status: 405, headers: cors }
      );
    }

    if (env.WORKER_SHARED_SECRET) {
      const auth = request.headers.get('Authorization') || '';
      if (auth !== `Bearer ${env.WORKER_SHARED_SECRET}`) {
        return Response.json({ success: false, error: 'Unauthorized worker token.' }, { status: 401, headers: cors });
      }
    }

    try {
      const payload = await request.json();
      const recipient = String(payload.email || payload.recipientEmail || payload.to || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        return Response.json({ success: false, error: 'Invalid recipient email address.' }, { status: 400, headers: cors });
      }

      const subject = String(payload.subject || `[SEVA.GIS] Field Report — ${payload.farmName || 'Plot'}`);
      const html = String(payload.html || payload.htmlContent || '<p>SEVA.GIS Report</p>');
      const fromAddr = String(payload.from || env.SENDER_EMAIL || 'reports@sevagis.dpdns.org');

      // Path 1: Resend HTTPS API (configured via Wrangler secret RESEND_API_KEY)
      if (env.RESEND_API_KEY) {
        const attachments = payload.attachment?.contentBase64
          ? [{ filename: payload.attachment.filename || 'report.html', content: payload.attachment.contentBase64 }]
          : [];
        const upstream = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddr,
            to: [recipient],
            subject,
            html,
            attachments,
          }),
        });
        const data = await upstream.json().catch(() => ({}));
        if (!upstream.ok) {
          return Response.json(
            { success: false, delivered: false, transport: 'mailflare-worker-resend', error: data.message || `Resend HTTP ${upstream.status}` },
            { status: 502, headers: cors }
          );
        }
        return Response.json(
          { success: true, delivered: true, transport: 'mailflare-worker', id: data.id, message: `Delivered via Cloudflare Worker to ${recipient}` },
          { status: 200, headers: cors }
        );
      }

      // Path 2: Upstream JMAP (e.g., public Stalwart HTTPS URL bound as env.JMAP_URL)
      return Response.json(
        {
          success: false,
          delivered: false,
          needsClientFallback: true,
          transport: 'mailflare-worker-unconfigured',
          message: 'Cloudflare Worker is deployed, but RESEND_API_KEY secret is not bound yet.',
        },
        { status: 200, headers: cors }
      );
    } catch (err) {
      return Response.json(
        { success: false, error: err?.message || 'Malformed request body.' },
        { status: 500, headers: cors }
      );
    }
  },
};

