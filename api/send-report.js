import { dispatchReportEmail } from '../server/directMailService.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed. Use POST.' });
    return;
  }
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(payload.email || payload.recipientEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, error: 'A valid recipient email is required.' });
      return;
    }

    const result = await dispatchReportEmail(payload);
    res.status(200).json({
      success: Boolean(result.delivered),
      delivered: Boolean(result.delivered),
      needsClientFallback: Boolean(result.needsClientFallback),
      recipient: email,
      transport: result.transport,
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to dispatch report email.' });
  }
}

