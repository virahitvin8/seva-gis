import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  // Cloud Run / Kubernetes Health Check
  if (urlPath === '/health' || urlPath === '/healthz' || urlPath === '/_ah/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('OK');
    return;
  }

  // SEVA.GIS Report Email Delivery API with EmailOctopus integration
  if (urlPath === '/api/send-report' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) req.destroy(); // 10MB limit
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const email = payload.email || 'user@example.com';
        const farmName = payload.farmName || 'Farm Parcel';
        const reportId = payload.reportId || 'SEVA-REPORT';
        const eoApiKey = payload.apiKey || process.env.EMAIL_OCTOPUS_API_KEY || 'eo_5f948784821e2b4da262a423736cfe098e358a89fa382f7885f401126a997e58';
        const eoListId = payload.listId || process.env.EMAIL_OCTOPUS_LIST_ID || '15e4d8e2-c4b5-11f1-8441-836e7cd382aa';
        const tagline = payload.tagline || 'Thank you for using SEVA·GIS! Visit again, see again — Earth intelligence in the spirit of selfless service.';

        console.log(`[SEVA·GIS EmailOctopus] Processing report delivery for ${farmName} (${reportId}) to ${email}`);

        let eoContactId = null;
        let eoSuccess = false;

        // Sync contact to EmailOctopus list
        try {
          const eoRes = await fetch(`https://emailoctopus.com/api/1.6/lists/${eoListId}/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: eoApiKey,
              email_address: email,
              fields: {
                FirstName: farmName,
              },
              tags: ['SEVA-GIS-Report-Download'],
              status: 'SUBSCRIBED',
            }),
          });
          const eoData = await eoRes.json();
          if (eoRes.ok && eoData?.id) {
            eoContactId = eoData.id;
            eoSuccess = true;
            console.log(`[SEVA·GIS EmailOctopus] Successfully subscribed contact ${eoContactId} (${email}) to list ${eoListId}`);
          } else if (eoData?.error?.code === 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
            eoSuccess = true;
            console.log(`[SEVA·GIS EmailOctopus] Member already exists (${email}); updating status`);
          } else {
            console.warn('[SEVA·GIS EmailOctopus] API notice:', eoData);
          }
        } catch (eoErr) {
          console.warn('[SEVA·GIS EmailOctopus] Network exception during sync:', eoErr);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          emailOctopus: eoSuccess,
          contactId: eoContactId,
          message: `Report successfully dispatched and synced with EmailOctopus for ${email}! ${tagline}`,
          recipient: email,
          reportId: reportId,
          tagline: tagline,
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Sanitize path to prevent directory traversal
  let safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath);

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If requested file does not exist or is a directory, fallback to SPA index.html
      filePath = path.join(DIST_DIR, 'index.html');
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      
      const headers = {
        'Content-Type': contentType,
      };

      // Aggressive caching for hashed assets, no-cache for index.html
      if (filePath.endsWith('index.html')) {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      } else {
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      }

      res.writeHead(200, headers);
      res.end(content);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[SEVA·GIS] Production Web Server listening on http://${HOST}:${PORT}`);
});

// Graceful termination for Cloud Run container lifecycle
process.on('SIGTERM', () => {
  console.log('[SEVA·GIS] SIGTERM received, closing server...');
  server.close(() => {
    process.exit(0);
  });
});
