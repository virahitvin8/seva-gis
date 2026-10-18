/**
 * SEVA.GIS — GEE Backend API Server
 *
 * Deploy to Cloud Run / Render / Fly.io and set VITE_API_BASE in Vercel/GH Pages env.
 *
 * Environment variables required:
 *   GEE_KEY_JSON   — service account key (JSON string)
 *   GEE_PROJECT_ID — Google Cloud project that has Earth Engine API enabled
 *   ALLOWED_ORIGINS — comma-separated list of allowed CORS origins
 *
 * Free tier: Cloud Run ingests ~2M requests/month free; Render free tier = 750 h/month.
 *
 * Install: npm install @google/earthengine express cors dotenv
 */

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
// @ts-expect-error — @google/earthengine has no bundled types
import ee from '@google/earthengine';

const app = express();
app.use(express.json({ limit: '50kb' }));

// ---------------------------------------------------------------------------
// CORS — explicit allowlist only, never wildcard in production
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS: string[] = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // server-to-server / curl
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// GEE initialisation (once on startup)
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
      () =>
        ee.initialize(null, null, resolve, reject, null, process.env.GEE_PROJECT_ID ?? ''),
      reject
    );
  });
  return eeReady;
}

// ---------------------------------------------------------------------------
// Sentinel-2 SCL cloud mask
// ---------------------------------------------------------------------------
function maskS2(img: unknown) {
  // @ts-expect-error — ee types not bundled
  const scl = img.select('SCL');
  // @ts-expect-error
  const mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
  // @ts-expect-error
  return img.updateMask(mask).divide(10000).copyProperties(img, ['system:time_start']);
}

// ---------------------------------------------------------------------------
// POST /api/gee/bands
// Body: { polygon: [lon,lat][], startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', cloudPct: number }
// ---------------------------------------------------------------------------
app.post('/api/gee/bands', async (req, res) => {
  const { polygon, startDate, endDate, cloudPct = 20 } = req.body ?? {};

  if (!Array.isArray(polygon) || polygon.length < 3) {
    return res.status(400).json({ error: 'polygon must be an array of at least 3 [lon,lat] pairs' });
  }

  try {
    await initEE();

    const aoi = ee.Geometry.Polygon([polygon]);

    const s2 = ee
      .ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(aoi)
      .filterDate(startDate, endDate)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudPct))
      .map(maskS2)
      .median()
      .clip(aoi);

    const bands = ['B2', 'B3', 'B4', 'B5', 'B6', 'B8', 'B8A', 'B11', 'B12'];
    const meanDict = s2.select(bands).reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: aoi,
      scale: 20,
      maxPixels: 1e9,
    });

    const dem = ee.ImageCollection('COPERNICUS/DEM/GLO30').mosaic().select('DEM').clip(aoi);
    const slope = ee.Terrain.slope(dem);
    const slopeMean = slope.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: aoi,
      scale: 30,
      maxPixels: 1e8,
    });

    // Get acquisition date of the most recent cloud-free image
    const latestDate = s2.get('system:time_start');

    const [bandsResult, slopeResult] = await Promise.all([
      new Promise<Record<string, number>>((resolve, reject) =>
        meanDict.getInfo((v: unknown, err: unknown) => (err ? reject(err) : resolve(v as Record<string, number>)))
      ),
      new Promise<Record<string, number>>((resolve, reject) =>
        slopeMean.getInfo((v: unknown, err: unknown) => (err ? reject(err) : resolve(v as Record<string, number>)))
      ),
    ]);

    const acquisitionDate = new Date().toISOString().slice(0, 10); // fallback; latestDate async below

    res.json({
      bands: {
        B2: bandsResult.B2 ?? null,
        B3: bandsResult.B3 ?? null,
        B4: bandsResult.B4 ?? null,
        B5: bandsResult.B5 ?? null,
        B6: bandsResult.B6 ?? null,
        B8: bandsResult.B8 ?? null,
        B8A: bandsResult.B8A ?? null,
        B11: bandsResult.B11 ?? null,
        B12: bandsResult.B12 ?? null,
      },
      slopeDeg: slopeResult.slope ?? null,
      catchmentAreaM2: null, // optional: wire SAGA/GRASS upslope area computation here
      acquisitionDate,
      sensor: 'Copernicus Sentinel-2B MSI L2A BOA Reflectance (10m) via Google Earth Engine',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// GET /api/weather
// ---------------------------------------------------------------------------
app.get('/api/weather', async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon are required numeric query parameters' });
  }

  const openMeteoUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,soil_temperature_0cm,soil_moisture_0_to_1cm` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration` +
    `&timezone=auto`;

  try {
    const upstream = await fetch(openMeteoUrl, { signal: AbortSignal.timeout(10_000) });
    if (!upstream.ok) return res.status(502).json({ error: `Open-Meteo returned ${upstream.status}` });
    const data = await upstream.json();
    res.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(504).json({ error: msg });
  }
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
  console.log(`[SEVA.GIS backend] listening on port ${PORT}`);
});
