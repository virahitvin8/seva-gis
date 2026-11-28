import { dispatchReportEmail } from '../../server/directMailService.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ sent: false, error: 'Method Not Allowed. Use POST.' });
    return;
  }
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = String(payload.recipientEmail || payload.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ sent: false, error: 'Valid recipientEmail is required.' });
      return;
    }

    const result = await dispatchReportEmail({
      email,
      recipientEmail: email,
      farmName: payload.aoiName || payload.farmName || 'Agricultural Parcel',
      reportId: payload.reportId || `SEVA-${Date.now().toString().slice(-6)}`,
      format: Array.isArray(payload.formats) && payload.formats[0] ? payload.formats[0] : 'html',
      filename: `${String(payload.aoiName || payload.farmName || 'SEVA_Report').replace(/\W+/g, '_')}.html`,
      htmlContent: payload.reportHtml || payload.htmlBody || payload.htmlContent || '',
      smtpConfig: payload.smtpConfig,
    });

    if (!result.delivered) {
      res.status(501).json({
        sent: false,
        configured: false,
        needsClientFallback: true,
        recipientEmail: email,
        message: result.message,
      });
      return;
    }

    res.status(200).json({
      sent: true,
      transport: result.transport,
      attachedFiles: Array.isArray(payload.formats) ? payload.formats : ['html'],
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({ sent: false, error: err?.message || 'Failed to dispatch report email.' });
  }
}

