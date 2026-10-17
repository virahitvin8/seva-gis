import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeUtmCoordinates,
  getCleanPolygonRing,
  getCleanSlug,
  generatePyQgisScript,
  generateQgisQmlStyle,
  generateQgisQlr,
  generateArcPyScript,
  generateArcGisLyrx,
  generateGeeCodeEditorScript,
  generateGeePythonScript,
  generateGdalScript,
  generateIsoXmlTaskData,
  generateDxfCad
} from '../gisInteroperability'
import type { FarmData } from '../seva'

const mockFarm: FarmData & { id: string; name: string; crop: string } = {
  id: 'test-field-1',
  name: 'Annamayya Groundnut Farm',
  crop: 'Groundnut',
  lat: 14.435,
  lon: 78.850,
  area: 2.5,
  polygon: [
    [78.848, 14.433],
    [78.852, 14.433],
    [78.852, 14.437],
    [78.848, 14.437]
  ],
  analysis: {
    ndvi: { mean: 0.76, min: 0.35, max: 0.88, std: 0.08 },
    ndmi: { mean: 0.28, min: -0.1, max: 0.45, std: 0.05 },
    elevMean: 245,
    slopeDeg: 1.8,
    stressPct: 4.2,
    scene: { datetime: '2026-10-15T05:30:00Z', cloud: 1.2 }
  } as any
}

test('computeUtmCoordinates calculates correct UTM zone and EPSG for southern India', () => {
  const utm = computeUtmCoordinates(14.435, 78.850)
  assert.equal(utm.zone, 'UTM 44N')
  assert.equal(utm.epsg, 32644)
  assert.ok(utm.easting > 400000 && utm.easting < 600000)
  assert.ok(utm.northing > 1500000 && utm.northing < 1700000)
})

test('getCleanPolygonRing returns existing closed or open ring with valid count', () => {
  const ring = getCleanPolygonRing(mockFarm)
  assert.equal(ring.length, 4)
  assert.deepEqual(ring[0], [78.848, 14.433])
})

test('getCleanSlug produces clean URL and filesystem safe slug', () => {
  assert.equal(getCleanSlug('Annamayya Groundnut Farm!'), 'annamayya-groundnut-farm')
})

test('generatePyQgisScript produces valid runnable PyQGIS code', () => {
  const py = generatePyQgisScript(mockFarm)
  assert.ok(py.includes('from qgis.core import'))
  assert.ok(py.includes('QgsVectorLayer("Polygon?crs=EPSG:4326"'))
  assert.ok(py.includes('QgsField("NDVI_Mean"'))
  assert.ok(py.includes('QgsPointXY(78.848000, 14.433000)'))
  assert.ok(py.includes('Annamayya Groundnut Farm'))
  assert.ok(py.includes('ESRI World Imagery'))
})

test('generateQgisQmlStyle outputs valid XML schema with singlebandpseudocolor', () => {
  const qml = generateQgisQmlStyle('ndvi')
  assert.ok(qml.startsWith('<!DOCTYPE qgis'))
  assert.ok(qml.includes('type="singlebandpseudocolor"'))
  assert.ok(qml.includes('classificationMax="0.9"'))
  assert.ok(qml.includes('Peak Biomass'))
})

test('generateQgisQlr outputs valid layer definition XML', () => {
  const qlr = generateQgisQlr(mockFarm)
  assert.ok(qlr.includes('<!DOCTYPE qgis-layer-definition>'))
  assert.ok(qlr.includes('<maplayer type="raster"'))
  assert.ok(qlr.includes('ESRI World Imagery'))
})

test('generateArcPyScript produces valid ArcPy geoprocessing script', () => {
  const arc = generateArcPyScript(mockFarm)
  assert.ok(arc.includes('import arcpy'))
  assert.ok(arc.includes('arcpy.SpatialReference(4326)'))
  assert.ok(arc.includes('arcpy.management.CreateFeatureclass'))
  assert.ok(arc.includes('arcpy.da.InsertCursor'))
  assert.ok(arc.includes('arcpy.Point(78.848000, 14.433000)'))
  assert.ok(arc.includes('NDVI_Mean'))
})

test('generateArcGisLyrx outputs valid JSON CIM Layer Document', () => {
  const lyrx = generateArcGisLyrx(mockFarm)
  const parsed = JSON.parse(lyrx)
  assert.equal(parsed.type, 'CIMLayerDocument')
  assert.equal(parsed.layerDefinitions[0].type, 'CIMFeatureLayer')
  assert.ok(parsed.layerDefinitions[0].name.includes('Annamayya Groundnut Farm'))
})

test('generateGeeCodeEditorScript produces complete GEE JavaScript with cloud masking and exports', () => {
  const gee = generateGeeCodeEditorScript(mockFarm)
  assert.ok(gee.includes('var aoi = ee.Geometry.Polygon'))
  assert.ok(gee.includes('COPERNICUS/S2_SR_HARMONIZED'))
  assert.ok(gee.includes('maskS2sr'))
  assert.ok(gee.includes('normalizedDifference'))
  assert.ok(gee.includes('COPERNICUS/DEM/GLO30'))
  assert.ok(gee.includes('Export.image.toDrive'))
})

test('generateGeePythonScript produces valid headless Earth Engine Python script', () => {
  const py = generateGeePythonScript(mockFarm)
  assert.ok(py.includes('import ee'))
  assert.ok(py.includes('ee.Initialize()'))
  assert.ok(py.includes('getDownloadURL'))
})

test('generateGdalScript outputs ogr2ogr and gdalwarp CLI recipes', () => {
  const gdal = generateGdalScript(mockFarm)
  assert.ok(gdal.includes('ogr2ogr -f "ESRI Shapefile"'))
  assert.ok(gdal.includes('ogr2ogr -f "GPKG"'))
  assert.ok(gdal.includes('gdal_calc.py'))
  assert.ok(gdal.includes('gdal_translate -of COG'))
})

test('generateIsoXmlTaskData outputs standard ISO 11783-10 TaskData XML for rate controllers', () => {
  const xml = generateIsoXmlTaskData(mockFarm)
  assert.ok(xml.startsWith('<?xml version="1.0"'))
  assert.ok(xml.includes('<ISO11783_TaskData VersionMajor="4" VersionMinor="2"'))
  assert.ok(xml.includes('<PFD A="PFD1"'))
  assert.ok(xml.includes('<PNT A="2"'))
})

test('generateDxfCad outputs standard AutoCAD R12 DXF ASCII format', () => {
  const dxf = generateDxfCad(mockFarm)
  assert.ok(dxf.includes('AC1009'))
  assert.ok(dxf.includes('SEVA_BOUNDARY'))
  assert.ok(dxf.includes('POLYLINE'))
  assert.ok(dxf.includes('VERTEX'))
  assert.ok(dxf.includes('SEQEND'))
})
