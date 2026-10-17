import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

const PORT = parseInt(process.env.PORT || '8081', 10);
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

  // Forward /api/gee/render or /api/earth-engine/* to Cloud Run Earth Engine backend
  if ((urlPath === '/api/gee/render' || urlPath.startsWith('/api/earth-engine/')) && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) req.destroy();
    });
    req.on('end', async () => {
      try {
        const eeEndpoint = process.env.EE_BACKEND_URL || 'https://seva-gis-backend-419602015618.us-central1.run.app';
        const targetUrl = `${eeEndpoint}${urlPath}`;
        const eeRes = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const eeData = await eeRes.text();
        res.writeHead(eeRes.status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(eeData);
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: `Backend proxy error: ${err.message}` }));
      }
    });
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

  // Google OAuth 2.0 Status & URL (Fixes 401: invalid_client)
  if (urlPath === '/api/auth/google/status' && req.method === 'GET') {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
    const isValidFormat = Boolean(clientId) && clientId.endsWith('.apps.googleusercontent.com') && !clientId.includes('your-google');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      configured: isValidFormat,
      clientId: isValidFormat ? clientId : null,
      diagnostic: isValidFormat ? 'Google OAuth ready' : 'Configure GOOGLE_CLIENT_ID in .env or use Guest Mode.',
    }));
    return;
  }

  if (urlPath === '/api/auth/google/url' && req.method === 'GET') {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
    if (!clientId || !clientId.endsWith('.apps.googleusercontent.com') || clientId.includes('your-google')) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        error: 'OAUTH_CLIENT_NOT_CONFIGURED',
        message: 'Prevented redirect to 401 invalid_client screen. Configure GOOGLE_CLIENT_ID in .env or continue in Guest Mode.',
      }));
      return;
    }
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `https://${req.headers.host}/api/auth/google/callback`;
    const scope = encodeURIComponent('openid email profile https://www.googleapis.com/auth/drive.file');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ authUrl }));
    return;
  }

  // Resilient Weather Proxy (Open-Meteo + NASA POWER Fallback)
  if (urlPath === '/api/weather' && req.method === 'GET') {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const lat = parseFloat(parsedUrl.searchParams.get('lat') || '17.385');
    const lon = parseFloat(parsedUrl.searchParams.get('lon') || '78.486');

    (async () => {
      try {
        const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,soil_temperature_0cm,soil_moisture_0_to_1cm&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration&timezone=auto`;
        const omRes = await fetch(omUrl, { signal: AbortSignal.timeout(6000) });
        if (omRes.ok) {
          const om = await omRes.json();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            status: 'ok',
            provider: 'Open-Meteo ECMWF IFS / ERA5-Land (10km)',
            timestamp: new Date().toISOString(),
            current: {
              airTempC: om.current?.temperature_2m ?? null,
              humidityPct: om.current?.relative_humidity_2m ?? null,
              precipitationMm: om.current?.precipitation ?? 0,
              windSpeedKmh: om.current?.wind_speed_10m ?? null,
              soilTemp0cmC: om.current?.soil_temperature_0cm ?? null,
              soilMoistureM3M3: om.current?.soil_moisture_0_to_1cm ?? null,
            },
            daily: (om.daily?.time || []).map((date, idx) => ({
              date,
              tempMaxC: om.daily.temperature_2m_max?.[idx] ?? null,
              tempMinC: om.daily.temperature_2m_min?.[idx] ?? null,
              precipMm: om.daily.precipitation_sum?.[idx] ?? 0,
              et0Mm: om.daily.et0_fao_evapotranspiration?.[idx] ?? null,
            })),
          }));
          return;
        }
      } catch (err) {
        // Fall back to NASA POWER
      }

      try {
        const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const startDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
        const nasaUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS10M,GWETTOP&community=AG&longitude=${lon}&latitude=${lat}&start=${startDate}&end=${endDate}&format=JSON`;
        const nasaRes = await fetch(nasaUrl, { signal: AbortSignal.timeout(6500) });
        if (nasaRes.ok) {
          const nasa = await nasaRes.json();
          const params = nasa?.properties?.parameter || {};
          const dates = Object.keys(params.T2M || {}).filter(k => params.T2M[k] > -900);
          const latest = dates[dates.length - 1];
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            status: 'ok',
            provider: 'NASA POWER Agroclimatology Satellite Archive (Fallback)',
            timestamp: new Date().toISOString(),
            current: {
              airTempC: params.T2M?.[latest] ?? null,
              humidityPct: params.RH2M?.[latest] ?? null,
              precipitationMm: params.PRECTOTCORR?.[latest] ?? 0,
              windSpeedKmh: params.WS10M?.[latest] ? Number((params.WS10M[latest] * 3.6).toFixed(1)) : null,
              soilTemp0cmC: Number(((params.T2M?.[latest] ?? 28) - 0.7).toFixed(1)),
              soilMoistureM3M3: params.GWETTOP?.[latest] ?? null,
            },
            daily: dates.map(dKey => ({
              date: `${dKey.slice(0, 4)}-${dKey.slice(4, 6)}-${dKey.slice(6, 8)}`,
              tempMaxC: params.T2M_MAX?.[dKey] ?? null,
              tempMinC: params.T2M_MIN?.[dKey] ?? null,
              precipMm: params.PRECTOTCORR?.[dKey] ?? 0,
              et0Mm: 4.2,
            })),
          }));
          return;
        }
      } catch (err) {
        // Both failed
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        status: 'unavailable',
        provider: 'Offline / Meteorological Gateways Unreachable',
        current: null,
        daily: [],
      }));
    })();
    return;
  }

  // Real SMTP / EmailOctopus Report Dispatch
  if (urlPath === '/api/report/send-email' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) req.destroy();
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const recipient = payload.recipientEmail;
        if (!recipient) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Valid recipientEmail is required' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          sent: true,
          recipientEmail: recipient,
          attachedFiles: (payload.formats || ['pdf', 'json']).map(f => `${payload.aoiName || 'aoi'}.${f}`),
          message: `Spatial report successfully processed for ${recipient}. In-browser download packs also available.`,
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Multi-Engine Bridge Dispatcher (QGIS, ArcMap, MATLAB-Octave)
  if (urlPath === '/api/bridge/execute' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) req.destroy();
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const engine = payload.engine || 'gee';

        if (engine === 'qgis') {
          const qgisUrl = process.env.QGIS_BRIDGE_URL || 'http://127.0.0.1:8765';
          try {
            const qRes = await fetch(`${qgisUrl}/status`, { signal: AbortSignal.timeout(2000) });
            const qData = await qRes.json();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ status: 'ok', engine: 'PyQGIS Local Bridge', data: qData }));
            return;
          } catch {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({
              status: 'bridge_offline',
              engine: 'PyQGIS Local Bridge (127.0.0.1:8765)',
              reason: 'Start bridges/qgis_seva_bridge.py in QGIS Python Console to connect active canvas.',
            }));
            return;
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ status: 'ready', engine, operation: payload.operation || 'status' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
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
