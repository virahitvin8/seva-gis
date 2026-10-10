import { BAND_COMBINATIONS } from './geoai'
import { byId } from './indicators'
import { farmRing, type FarmData, type SceneOpts } from './seva'

type EarthEngineIndex = { label: string; expression: string; scale: number }
const INDEX_EXPRESSION: Record<string, EarthEngineIndex> = {
  ndvi: { label: 'NDVI · green-cover signal', expression: "image.normalizedDifference(['B8', 'B4']).rename('NDVI')", scale: 10 },
  evi: { label: 'EVI · dense-canopy cover', expression: "image.expression('2.5 * (nir - red) / (nir + 6 * red - 7.5 * blue + 1)', {nir: image.select('B8').divide(10000), red: image.select('B4').divide(10000), blue: image.select('B2').divide(10000)}).rename('EVI')", scale: 10 },
  savi: { label: 'SAVI · cover where soil shows through', expression: "image.expression('1.5 * (nir - red) / (nir + red + 0.5)', {nir: image.select('B8').divide(10000), red: image.select('B4').divide(10000)}).rename('SAVI')", scale: 10 },
  msavi: { label: 'MSAVI · sparse crop cover', expression: "image.expression('(2 * nir + 1 - sqrt((2 * nir + 1) * (2 * nir + 1) - 8 * (nir - red))) / 2', {nir: image.select('B8').divide(10000), red: image.select('B4').divide(10000)}).rename('MSAVI')", scale: 10 },
  gndvi: { label: 'GNDVI · leaf-greenness signal', expression: "image.normalizedDifference(['B8', 'B3']).rename('GNDVI')", scale: 10 },
  ndre: { label: 'NDRE · dense-canopy comparison', expression: "image.normalizedDifference(['B8', 'B5']).rename('NDRE')", scale: 20 },
  cire: { label: 'CIre · red-edge leaf-colour signal', expression: "image.select('B7').divide(image.select('B5')).subtract(1).rename('CIre')", scale: 20 },
  chla: { label: 'CIgreen · leaf-greenness estimate', expression: "image.select('B7').divide(image.select('B3')).subtract(1).rename('CIgreen')", scale: 20 },
  nbr: { label: 'NBR · crop-cover change signal', expression: "image.normalizedDifference(['B8', 'B12']).rename('NBR')", scale: 20 },
  ndmi: { label: 'NDMI · canopy-moisture signal', expression: "image.normalizedDifference(['B8', 'B11']).rename('NDMI')", scale: 20 },
  ndwi: { label: 'NDWI · possible surface-water signal', expression: "image.normalizedDifference(['B3', 'B8']).rename('NDWI')", scale: 10 },
  mndwi: { label: 'MNDWI · possible open-water signal', expression: "image.normalizedDifference(['B3', 'B11']).rename('MNDWI')", scale: 20 },
  msi: { label: 'MSI · canopy-dryness signal', expression: "image.select('B11').divide(image.select('B8')).rename('MSI')", scale: 20 },
  ndbi: { label: 'NDBI · bare or built-looking surface signal', expression: "image.normalizedDifference(['B11', 'B8']).rename('NDBI')", scale: 20 },
  bsi: { label: 'BSI · possible exposed-soil signal', expression: "image.expression('((swir + red) - (nir + blue)) / ((swir + red) + (nir + blue))', {swir: image.select('B11'), red: image.select('B4'), nir: image.select('B8'), blue: image.select('B2')}).rename('BSI')", scale: 20 },
  lai: { label: 'LAI · rough estimated leaf cover', expression: "image.expression('-log(max(0.02, (0.92 - min(0.88, ndvi)) / 0.85)) / 0.65', {ndvi: image.normalizedDifference(['B8', 'B4'])}).rename('LAI')", scale: 10 },
}

export const supportsEarthEngineIndicator = (id: string) => id in INDEX_EXPRESSION

const geeBand = (band: string) => band.replace(/^B0(\d)$/, 'B$1')
const geeColor = (color: string) => color.replace(/^#/, '')

export function buildEarthEngineScript(farm: FarmData & { name: string }, indicatorId: string, selectedCombo = 'natural', sceneOpts: SceneOpts = {}) {
  const ring = farmRing(farm).map(([lon, lat]) => `[${lon.toFixed(7)}, ${lat.toFixed(7)}]`).join(',\n  ')
  const indexId = supportsEarthEngineIndicator(indicatorId) ? indicatorId : 'ndvi'
  const index = INDEX_EXPRESSION[indexId]
  const maxCloud = Math.min(100, Math.max(0, Math.round(sceneOpts.maxCloud ?? 30)))
  const dateFilter = sceneOpts.mode === 'date' && sceneOpts.date
    ? `var start = ee.Date('${sceneOpts.date}');\nvar end = start.advance(1, 'day');`
    : sceneOpts.mode === 'range' && sceneOpts.from && sceneOpts.to
      ? `var start = ee.Date('${sceneOpts.from}');\nvar end = ee.Date('${sceneOpts.to}').advance(1, 'day');`
      : `var end = ee.Date(Date.now());\nvar start = end.advance(-45, 'day');`
  const title = farm.name.replace(/[\\']/g, '')
  const composites = BAND_COMBINATIONS.map(combo => {
    const selected = combo.id === selectedCombo
    const bands = combo.bands.map(geeBand)
    return `  Map.addLayer(reflectance, {bands: ${JSON.stringify(bands)}, min: [0.02, 0.02, 0.02], max: [0.30, 0.30, 0.30], gamma: [1.25, 1.25, 1.25]}, '${combo.name}', ${selected});`
  }).join('\n')
  const indices = Object.entries(INDEX_EXPRESSION).map(([id, spec]) => {
    const current = byId(id)
    const low = current.range?.[0] ?? 0
    const high = current.range?.[1] ?? 1
    const colors = (current.ramp ?? ['#a50026', '#fee08b', '#006837']).map(geeColor)
    const shown = id === indexId
    return `  var index_${id} = ${spec.expression}.clip(field);\n  Map.addLayer(index_${id}, {min: ${low}, max: ${high}, palette: ${JSON.stringify(colors)}}, '${spec.label}', ${shown});`
  }).join('\n')

  return `// SEVA·GIS field handoff — ${title}
// Paste into the signed-in Earth Engine Code Editor and click Run.
// This script carries over SEVA's selected AOI, time filter, cloud limit, active band view, and index style.
// Earth Engine independently selects/composites scenes; values can differ from the current preview provider.

var field = ee.Geometry.Polygon([[
  ${ring}
]], null, false);
Map.centerObject(field);
Map.addLayer(ee.Image(0).byte().paint(field, 1, 2), {palette: ['ffff00']}, 'SEVA farm boundary');

${dateFilter}
var collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(field)
  .filterDate(start, end)
  .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', ${maxCloud}))
  .map(function(image) {
    // Match SEVA's usable SCL classes: vegetation, bare soil, water, and unclassified.
    var scl = image.select('SCL');
    var clear = scl.gte(4).and(scl.lte(7));
    return image.updateMask(clear).copyProperties(image, ['system:time_start']);
  });

print('AOI', field);
print('Sentinel-2 scenes on selected date', collection.size());
collection.size().evaluate(function(count) {
  if (!count) {
    print('No Sentinel-2 scene was found for this date and AOI. Choose another clear date in SEVA·GIS.');
    return;
  }
  var image = collection.median().clip(field);
  var reflectance = image.divide(10000);
  // Available band combinations. Choose one from the Code Editor Layers panel.
${composites}

${indices}
  print('${indexId.toUpperCase()} farm average (about ${index.scale} m source bands)', index_${indexId}.reduceRegion({
    reducer: ee.Reducer.mean(), geometry: field, scale: ${index.scale}, maxPixels: 1e8, tileScale: 2
  }));
}, function(error) { print('Earth Engine could not load the scene', error); });`
}
