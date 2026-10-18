/**
 * SEVA.GIS — Production Backend API Server
 *
 * Deploy to Cloud Run / Render / Fly.io.
 * Set VITE_API_BASE in GitHub Pages workflow secrets to point here.
 *
 * Required environment variables:
 *   GEE_KEY_JSON       JSON string of GCP service account key with Earth Engine scope
 *   GEE_PROJECT_ID     GCP project ID with Earth Engine API enabled
 *   ALLOWED_ORIGINS    Comma-separated exact origins (e.g. https://sevagis.dpdns.org,http://localhost:5173)
 *   GOOGLE_CLIENT_ID   OAuth 2.0 Web Application client ID
 *   GOOGLE_CLIENT_SECRET  OAuth 2.0 client secret
 *   GOOGLE_REDIRECT_URI   e.g. https://api.sevagis.example.com/api/auth/google/callback
 *   PUBLIC_APP_URL     Frontend URL to redirect after sign-in
 *   SESSION_SECRET     Long random string for JWT signing
 *   PORT               (optional, defaults to 3001)
 *
 * Install:
 *   npm install @google/earthengine express cors dotenv google-auth-library jsonwebtoken cookie-parser
 */

import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
// @ts-expect-error — @google/earthengine has no bundled types
import ee from '@google/earthengine';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// CORS — Set-based exact allowlist.  No .endsWith() shortcuts.
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin(origin, cb) {
      // Allow server-to-server calls (no Origin header) and listed origins only.
      if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin '${origin}' is not in ALLOWED_ORIGINS`));
    },
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// GEE — initialise once
// ---------------------------------------------------------------------------
let eeReady: Promise<void> | null = null;

function initEE(): Promise<void> {
  if (eeReady) return eeReady;
  eeReady = new Promise((resolve, reject) => {
    const keyJson = process.env.GEE_KEY_JSON;
    if (!keyJson) return reject(new Error('GEE_KEY_JSON is not set'));
    const key = JSON.parse(keyJson);
    ee.data.authenticateViaPrivateKey(
      key,
      () => ee.initialize(null, null, resolve, reject, null, process.env.GEE_PROJECT_ID ?? ''),
      reject
    );
  });
  return eeReady;
}

// ---------------------------------------------------------------------------
// Sentinel-2 SCL cloud mask (SCL classes 3,8,9,10 are cloud/shadow/snow)
// ---------------------------------------------------------------------------
function maskS2(img: unknown) {
  // @ts-expect-error
  const scl = img.select('SCL');
  // @ts-expect-error
  const ok = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
  // @ts-expect-error
  return img.updateMask(ok).divide(10000).copyProperties(img, ['system:time_start']);
}

// ---------------------------------------------------------------------------
// POST /api/gee/indices
// Body: { geometry: GeoJSON geometry, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
// Returns real Sentinel-2 index values, scene count, first/last dates.
// ---------------------------------------------------------------------------
app.post('/api/gee/indices', async (req, res) => {
  const { geometry, start, end } = req.body ?? {};

  if (!geometry || !start || !end) {
    return res.status(400).json({ status: 'unavailable', reason: 'geometry, start and end are required' });
  }

  try {
    await initEE();

    const geom = ee.Geometry(geometry);

    const col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(geom)
      .filterDate(start, end)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
      .map(maskS2);

    const img = col.median();

    // Per-pixel index images
    const ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI');
    const ndre = img.normalizedDifference(['B8', 'B5']).rename('NDRE');
    const ndmi = img.normalizedDifference(['B8', 'B11']).rename('NDMI');
    const ndwi = img.normalizedDifference(['B3', 'B8']).rename('NDWI');
    const ironRatio = img.select('B4').divide(img.select('B2')).rename('IRON_RATIO');
    const clayRatio = img.select('B11').divide(img.select('B12')).rename('CLAY_RATIO');

    // Mean index values over AOI
    const idx = ee.Image.cat([ndvi, ndre, ndmi, ndwi, ironRatio, clayRatio]);
    const stats = idx.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: geom,
      scale: 10,
      maxPixels: 1e9,
    });

    // Mineral pixel-share: % of AOI pixels ABOVE a stated ratio threshold (Indicated only)
    const IRON_T = 1.2;   // Red/Blue > 1.2 → iron-oxide likely
    const CLAY_T = 1.05;  // SWIR1/SWIR2 > 1.05 → clay hydroxyl likely
    const mineralShare = ee.Image.cat([
      ironRatio.gt(IRON_T).rename('iron_oxide_share'),
      clayRatio.gt(CLAY_T).rename('clay_aloh_share'),
    ]).reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: geom,
      scale: 20,
      maxPixels: 1e9,
    });

    // Band means for advanced mineral indices
    const bandMeans = img.select(['B2', 'B3', 'B4', 'B5', 'B6', 'B8', 'B8A', 'B11', 'B12'])
      .reduceRegion({ reducer: ee.Reducer.mean(), geometry: geom, scale: 20, maxPixels: 1e9 });

    // Terrain
    const dem = ee.ImageCollection('COPERNICUS/DEM/GLO30').mosaic().select('DEM').clip(geom);
    const slope = ee.Terrain.slope(dem);
    const slopeMean = slope.reduceRegion({ reducer: ee.Reducer.mean(), geometry: geom, scale: 30, maxPixels: 1e8 });

    ee.Dictionary({
      stats,
      mineralShare,
      bands: bandMeans,
      slope: slopeMean,
      scenes: col.size(),
      first: col.aggregate_min('system:time_start'),
      last: col.aggregate_max('system:time_start'),
    }).evaluate((out: Record<string, unknown> | null, err: string | null) => {
      if (err) {
        return res.status(502).json({ status: 'unavailable', reason: String(err) });
      }
      if (!out || !out.scenes) {
        return res.json({
          status: 'unavailable',
          reason: 'No cloud-free Sentinel-2 scenes in the requested date range for this AOI.',
        });
      }

      const firstDate = out.first ? new Date(Number(out.first)).toISOString().slice(0, 10) : null;
      const lastDate  = out.last  ? new Date(Number(out.last)).toISOString().slice(0, 10) : null;

      res.json({
        status: 'ok',
        sensor: 'Copernicus Sentinel-2 L2A SCL-masked (10–20m) via Google Earth Engine',
        scenes: out.scenes,
        firstDate,
        lastDate,
        stats: out.stats,
        mineralShare: out.mineralShare,
        bands: out.bands,
        slopeDeg: (out.slope as Record<string, number>)?.slope ?? null,
        ironThreshold: IRON_T,
        clayThreshold: CLAY_T,
        mineralNote: '% of AOI pixels above stated band-ratio threshold (Indicated — spectrally inferred, not lab confirmed)',
      });
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ status: 'unavailable', reason: msg });
  }
});

// ---------------------------------------------------------------------------
// GET /api/weather — proxy to Open-Meteo (avoids CORS from browser, adds caching)
// ---------------------------------------------------------------------------
app.get('/api/weather', async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ status: 'unavailable', reason: 'lat and lon are required' });
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,soil_temperature_0cm,soil_moisture_0_to_1cm` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration` +
    `&timezone=auto`;

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!upstream.ok) {
      return res.status(502).json({ status: 'unavailable', reason: `Open-Meteo returned ${upstream.status}` });
    }
    const data = await upstream.json();
    // Forward response with a 5-minute cache header
    res.set('Cache-Control', 'public, max-age=300');
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(504).json({ status: 'unavailable', reason: `Open-Meteo unreachable: ${msg}` });
  }
});

// ---------------------------------------------------------------------------
// Google OAuth 2.0 — Authorization Code flow with CSRF state verification
// ---------------------------------------------------------------------------
const SESSION_SECRET = process.env.SESSION_SECRET ?? crypto.randomBytes(32).toString('hex');
const pendingStates = new Map<string, number>(); // state → created timestamp

function oauthClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function signSession(payload: { email: string; name: string }): string {
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: '7d' });
}

// GET /api/auth/google/url — returns the consent screen URL with CSRF state
app.get('/api/auth/google/url', (_req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, Date.now());
  // Prune states older than 10 minutes
  for (const [s, ts] of pendingStates) {
    if (Date.now() - ts > 600_000) pendingStates.delete(s);
  }
  const client = oauthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
    state,
    prompt: 'consent',
  });
  res.json({ url });
});

// GET /api/auth/google/callback — verifies state, exchanges code, sets httpOnly cookie
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!state || !pendingStates.delete(state)) {
    return res.status(400).send('Invalid or expired OAuth state. Please try signing in again.');
  }
  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(String(code));
    if (!tokens.id_token) throw new Error('No id_token in response');
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error('Could not verify Google identity');

    const sessionToken = signSession({ email: payload.email, name: payload.name ?? '' });
    res.cookie('sevagis_session', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.redirect(process.env.PUBLIC_APP_URL ?? '/');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(401).send(`Google sign-in failed: ${msg}`);
  }
});

// GET /api/auth/me — returns current user from session cookie
app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.sevagis_session;
  if (!token) return res.status(401).json({ authenticated: false });
  try {
    const user = jwt.verify(token, SESSION_SECRET) as { email: string; name: string };
    res.json({ authenticated: true, email: user.email, name: user.name });
  } catch {
    res.status(401).json({ authenticated: false });
  }
});

// POST /api/auth/signout
app.post('/api/auth/signout', (_req, res) => {
  res.clearCookie('sevagis_session', { path: '/' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'seva-gis-backend', ts: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, () => {
  console.log(`[SEVA.GIS backend] listening on :${PORT}`);
  console.log(`[SEVA.GIS backend] ALLOWED_ORIGINS: ${[...ALLOWED_ORIGINS].join(', ') || '(none — set ALLOWED_ORIGINS)'}`);
});
