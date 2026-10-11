// geeRender.js — real Sentinel-2 pixels for a farm polygon (QGIS-style output)
// If your server.js uses require(), change the import to:
//   const ee = require('@google/earthengine');  and  module.exports = { renderFarm, PRESETS };
import ee from '@google/earthengine';

const S2 = 'COPERNICUS/S2_SR_HARMONIZED'; // L2A surface reflectance, values 0-10000

export const PRESETS = {
  trueColor:      ['B4', 'B3', 'B2'],
  colourInfrared: ['B8', 'B4', 'B3'],
  agriculture:    ['B11', 'B8', 'B2'],
  swir:           ['B12', 'B8A', 'B4'],
};

const evalAsync = (obj) =>
  new Promise((res, rej) => obj.evaluate((v, err) => (err ? rej(new Error(err)) : res(v))));

const thumbAsync = (img, params) =>
  new Promise((res, rej) => img.getThumbURL(params, (url, err) => (err ? rej(new Error(err)) : res(url))));

// Remove cloud, shadow, cirrus, snow, saturated pixels using the SCL band
function maskS2(img) {
  const scl = img.select('SCL');
  const bad = scl.eq(1).or(scl.eq(3)).or(scl.eq(8)).or(scl.eq(9)).or(scl.eq(10)).or(scl.eq(11));
  return img.updateMask(bad.not());
}

/**
 * @param {object} p
 * @param {object} p.geojson   farm polygon as GeoJSON geometry {type:'Polygon', coordinates:[...]}
 * @param {'latest'|'single'|'range'} p.mode
 * @param {string} [p.startDate]  'YYYY-MM-DD' (single / range)
 * @param {string} [p.endDate]    'YYYY-MM-DD' (range)
 * @param {number} [p.maxCloud]   default 30
 * @param {string} [p.preset]     key of PRESETS, default 'trueColor'
 * @param {number} [p.padM]       padding around the farm in metres, default 20
 */
export async function renderFarm(p) {
  const { geojson, mode = 'latest', startDate, endDate, maxCloud = 30, preset = 'trueColor', padM = 20 } = p;
  const bands = PRESETS[preset];
  if (!bands) throw new Error('BAD_PRESET');

  const region = ee.Geometry(geojson);

  // 1. Collection
  let col = ee.ImageCollection(S2)
    .filterBounds(region)
    .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', maxCloud));

  if (mode === 'latest') col = col.filterDate(ee.Date(Date.now()).advance(-120, 'day'), ee.Date(Date.now()).advance(1, 'day'));
  else if (mode === 'single') col = col.filterDate(startDate, ee.Date(startDate).advance(1, 'day'));
  else col = col.filterDate(startDate, endDate);

  const total = await evalAsync(col.size());
  if (!total) throw new Error('NO_SCENES'); // tell the UI, never draw a blank/white image

  // 2. Composite
  let composite, label, sceneCount;
  if (mode === 'range') {
    composite = col.map(maskS2).median();
    label = `${startDate} → ${endDate} (median)`;
    sceneCount = total;
  } else {
    const newest = col.sort('system:time_start', false).first();
    const day = await evalAsync(ee.Date(newest.get('system:time_start')).format('YYYY-MM-dd'));
    const dayCol = col.filterDate(day, ee.Date(day).advance(1, 'day'));
    composite = dayCol.map(maskS2).mosaic();
    label = day;
    sceneCount = await evalAsync(dayCol.size());
  }
  const img = composite.select(bands);

  // 3. Stretch computed ON THE FARM (this is what QGIS does and what was missing)
  const raw = await evalAsync(
    img.reduceRegion({
      reducer: ee.Reducer.percentile([2, 98]),
      geometry: region,
      scale: 10,
      maxPixels: 1e9,
      bestEffort: true,
    })
  );
  let mins = bands.map((b) => raw[`${b}_p2`]);
  let maxs = bands.map((b) => raw[`${b}_p98`]);
  if (mins.some((v) => v == null) || maxs.some((v) => v == null)) throw new Error('ALL_MASKED');

  if (preset === 'trueColor') { // keep natural colour balance
    const lo = Math.min(...mins), hi = Math.max(...maxs);
    mins = mins.map(() => lo);
    maxs = maxs.map(() => hi);
  }
  maxs = maxs.map((m, i) => (m <= mins[i] ? mins[i] + 1 : m));

  // 4. Bounding box (NOT a polygon mask) so you see real pixels around the field
  const box = region.buffer(padM).bounds(1);
  const ring = (await evalAsync(box.coordinates()))[0];
  const lons = ring.map((c) => c[0]), lats = ring.map((c) => c[1]);
  const lonMin = Math.min(...lons), lonMax = Math.max(...lons);
  const latMin = Math.min(...lats), latMax = Math.max(...lats);
  const latMid = (latMin + latMax) / 2;
  const widthM = (lonMax - lonMin) * 111320 * Math.cos((latMid * Math.PI) / 180);
  const heightM = (latMax - latMin) * 110574;
  let W = Math.max(8, Math.ceil(widthM / 10));  // 1 output pixel = 1 Sentinel-2 10 m pixel
  let H = Math.max(8, Math.ceil(heightM / 10));
  const k = Math.min(1, 2048 / Math.max(W, H));
  W = Math.round(W * k); H = Math.round(H * k);

  // 5. Render PNG (masked pixels stay transparent)
  const url = await thumbAsync(img.visualize({ bands, min: mins, max: maxs, gamma: 1 }), {
    region: box,
    dimensions: `${W}x${H}`,
    format: 'png',
    crs: 'EPSG:4326',
  });

  return {
    url,
    bounds: [[latMin, lonMin], [latMax, lonMax]], // Leaflet [[south, west],[north, east]]
    date: label,
    scenes: sceneCount,
    preset,
    stretch: { bands, mins, maxs },
  };
}

/* ───────────────── server.js (Express) ─────────────────
import { renderFarm } from './geeRender.js';

app.post('/api/gee/render', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    res.json(await renderFarm(req.body));
  } catch (e) {
    console.error('[gee/render]', e.message);
    res.status(e.message === 'NO_SCENES' ? 404 : 500).json({ error: e.message });
  }
});
*/

/* ───────────────── frontend (IndicatorMap.tsx, Leaflet) ─────────────────
const r = await fetch('/api/gee/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ geojson: farmGeoJSON, mode: 'latest', maxCloud: 30, preset: 'trueColor' }),
});
const data = await r.json();
if (!r.ok) { showToast(data.error === 'NO_SCENES' ? 'No clear Sentinel-2 scene. Raise Max cloud.' : data.error); return; }

overlayRef.current?.remove();
const overlay = L.imageOverlay(data.url, data.bounds, { opacity: 0.92, zIndex: 400, interactive: false }).addTo(map);
overlay.getElement()!.style.imageRendering = 'pixelated';   // crisp 10 m pixels like QGIS
overlayRef.current = overlay;

// farm boundary = outline only, never a fill (the flat magenta in your screenshot)
L.polygon(farmLatLngs, { color: '#facc15', weight: 2, fill: false }).addTo(map);
*/
