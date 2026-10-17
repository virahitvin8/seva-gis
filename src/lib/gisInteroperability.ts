/**
 * SEVA·GIS Universal GIS Interoperability Engine
 * Grounded in LeanREA Reverse-Engineering of Desktop GIS & Cloud Pipelines:
 * - QGIS 3.x (PyQGIS console scripts, QML raster/vector symbology, QLR layer definition)
 * - ArcGIS / ArcMap (ArcPy geoprocessing scripts, ArcGIS Pro CIM .lyrx definitions)
 * - Google Earth Engine (GEE JavaScript Code Editor, headless Python batch pipelines)
 * - GDAL / OGR (CLI recipes for COG, Shapefile, GeoPackage, and band math)
 * - Precision Agriculture (ISO 11783-10 TaskData.xml for tractor rate controllers)
 * - CAD / Survey (AutoCAD DXF R12 ASCII interchange)
 */

import type { FarmData } from './seva'

export interface GisExportBundle {
  filename: string
  content: string
  mimeType: string
  label: string
  description: string
  software: 'qgis' | 'arcgis' | 'gee' | 'gdal' | 'isoxml' | 'cad'
}

// Convert Lat/Lon to approximate UTM Zone & Easting/Northing
export function computeUtmCoordinates(lat: number, lon: number) {
  const zone = Math.floor((lon + 180) / 6) + 1
  const hemisphere = lat >= 0 ? 'N' : 'S'
  const radLat = (lat * Math.PI) / 180
  const radLon = (lon * Math.PI) / 180
  const lonOrigin = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180)

  const a = 6378137.0, eccSquared = 0.00669438
  const k0 = 0.9996
  const N = a / Math.sqrt(1 - eccSquared * Math.sin(radLat) ** 2)
  const T = Math.tan(radLat) ** 2
  const C = (eccSquared / (1 - eccSquared)) * Math.cos(radLat) ** 2
  const A = Math.cos(radLat) * (radLon - lonOrigin)

  const M = a * ((1 - eccSquared / 4 - 3 * eccSquared ** 2 / 64) * radLat
    - (3 * eccSquared / 8 + 3 * eccSquared ** 2 / 32) * Math.sin(2 * radLat)
    + (15 * eccSquared ** 2 / 256) * Math.sin(4 * radLat))

  const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6) + 500000
  let y = k0 * (M + N * Math.tan(radLat) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24))
  if (lat < 0) y += 10000000

  return {
    zone: `UTM ${zone}${hemisphere}`,
    zoneNumber: zone,
    hemisphere,
    epsg: hemisphere === 'N' ? 32600 + zone : 32700 + zone,
    easting: Math.round(x),
    northing: Math.round(y),
  }
}

// Extract clean polygon coordinates or fallback box
export function getCleanPolygonRing(farm: FarmData): [number, number][] {
  if (farm.polygon && farm.polygon.length >= 3) {
    return farm.polygon
  }
  const delta = 0.0015
  return [
    [farm.lon - delta, farm.lat - delta],
    [farm.lon + delta, farm.lat - delta],
    [farm.lon + delta, farm.lat + delta],
    [farm.lon - delta, farm.lat + delta],
  ]
}

export function getCleanSlug(name: string): string {
  return (name || 'field').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'seva-field'
}

// ============================================================================
// 1. QGIS (PyQGIS Console Script)
// ============================================================================
export function generatePyQgisScript(farm: FarmData & { name: string; crop?: string }): string {
  const ring = getCleanPolygonRing(farm)
  const closedRing = [...ring, ring[0]]
  const coordsStr = closedRing.map(([lon, lat]) => `QgsPointXY(${lon.toFixed(6)}, ${lat.toFixed(6)})`).join(', ')
  const utm = computeUtmCoordinates(farm.lat, farm.lon)
  const nameSafe = (farm.name || 'Field').replace(/'/g, "\\'")
  const cropSafe = (farm.crop || 'Crop').replace(/'/g, "\\'")
  const areaHa = farm.area || 1.0
  const ndvi = farm.analysis?.ndvi?.mean ?? 0.72
  const ndmi = farm.analysis?.ndmi?.mean ?? 0.24
  const elev = farm.analysis?.elevMean ?? 240
  const slope = farm.analysis?.slopeDeg ?? 1.5
  const sceneDate = farm.analysis?.scene?.datetime || new Date().toISOString().split('T')[0]

  return `# ==============================================================================
# SEVA·GIS - Native PyQGIS Automation Console Script
# Compatible with: QGIS 3.16 through 3.38+ LTR
# Target Field: ${nameSafe} (${areaHa.toFixed(2)} Ha) | ${utm.zone}
# Generated: ${new Date().toISOString()}
#
# HOW TO RUN IN QGIS:
# 1. Open QGIS 3.x
# 2. Press Ctrl+Alt+P (or go to Plugins -> Python Console)
# 3. Paste this script into the console editor and click "Run script"
# ==============================================================================

import os
from qgis.core import (
    QgsProject, QgsVectorLayer, QgsFeature, QgsGeometry, QgsPointXY,
    QgsField, QgsFillSymbol, QgsSingleSymbolRenderer, QgsCoordinateReferenceSystem,
    QgsRasterLayer, QgsPalLayerSettings, QgsVectorLayerSimpleLabeling,
    QgsTextFormat, QgsTextBufferSettings
)
from qgis.PyQt.QtCore import QVariant
from qgis.PyQt.QtGui import QColor
from qgis.utils import iface

print("[SEVA·GIS] Initializing native PyQGIS layer construction for '${nameSafe}'...")

# 1. Create In-Memory Vector Layer for Boundary
vl = QgsVectorLayer("Polygon?crs=EPSG:4326", "SEVA - ${nameSafe} Boundary", "memory")
dp = vl.dataProvider()

# 2. Define Attribute Schema
dp.addAttributes([
    QgsField("Name", QVariant.String),
    QgsField("Crop", QVariant.String),
    QgsField("Area_Ha", QVariant.Double),
    QgsField("NDVI_Mean", QVariant.Double),
    QgsField("NDMI_Mean", QVariant.Double),
    QgsField("Elevation_m", QVariant.Double),
    QgsField("Slope_deg", QVariant.Double),
    QgsField("UTM_Zone", QVariant.String),
    QgsField("Scene_Date", QVariant.String),
    QgsField("Platform", QVariant.String),
])
vl.updateFields()

# 3. Create Feature and Inject Geodesic Coordinates
feat = QgsFeature()
polygon_points = [
    ${coordsStr}
]
geom = QgsGeometry.fromPolygonXY([polygon_points])
feat.setGeometry(geom)
feat.setAttributes([
    "${nameSafe}",
    "${cropSafe}",
    ${areaHa.toFixed(2)},
    ${ndvi.toFixed(3)},
    ${ndmi.toFixed(3)},
    ${elev.toFixed(1)},
    ${slope.toFixed(1)},
    "${utm.zone}",
    "${sceneDate}",
    "SEVA.GIS (Sentinel-2 L2A + Copernicus DEM)"
])
dp.addFeatures([feat])
vl.updateExtents()

# 4. Apply High-Contrast Precision Symbology (Green Outer Stroke + Alpha Fill)
symbol = QgsFillSymbol.createSimple({
    'color': '34, 197, 94, 40',          # Semitransparent emerald fill
    'color_border': '22, 163, 74, 255',   # Sharp green border
    'width_border': '0.9',
    'style': 'solid',
    'style_border': 'solid'
})
vl.setRenderer(QgsSingleSymbolRenderer(symbol))

# 5. Add Clean Dynamic Callout Labeling
label_settings = QgsPalLayerSettings()
label_settings.fieldName = "concat(Name, ' (', Area_Ha, ' ha | NDVI: ', NDVI_Mean, ')')"
label_settings.isExpression = True

text_format = QgsTextFormat()
text_format.setSize(9.5)
text_format.setColor(QColor(15, 23, 42))

buffer_settings = QgsTextBufferSettings()
buffer_settings.setEnabled(True)
buffer_settings.setSize(1.2)
buffer_settings.setColor(QColor(255, 255, 255, 220))
text_format.setBuffer(buffer_settings)

label_settings.setFormat(text_format)
vl.setLabeling(QgsVectorLayerSimpleLabeling(label_settings))
vl.setLabelsEnabled(True)

# 6. Add Layer to QGIS Project Canvas
project = QgsProject.instance()
project.addMapLayer(vl)

# 7. Add High-Resolution Satellite Basemap (ESRI World Imagery XYZ)
xyz_url = "type=xyz&url=https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}&zmax=19&zmin=0"
basemap = QgsRasterLayer(xyz_url, "ESRI World Imagery (High-Res)", "wms")
if basemap.isValid():
    project.addMapLayer(basemap, False)
    root = project.layerTreeRoot()
    root.insertLayer(-1, basemap)
    print("[SEVA·GIS] Added ESRI World Imagery XYZ Tile basemap.")
else:
    print("[SEVA·GIS] XYZ Basemap load skipped or offline.")

# 8. Zoom Canvas to Parcel Extent with 15% Padding
if iface:
    extent = vl.extent()
    extent.scale(1.3)
    iface.mapCanvas().setExtent(extent)
    iface.mapCanvas().refresh()

print("[SEVA·GIS] SUCCESS: Field '${nameSafe}' successfully loaded into active QGIS project.")
`
}

// ============================================================================
// 2. QGIS Style XML (.qml)
// ============================================================================
export function generateQgisQmlStyle(indicator: 'ndvi' | 'ndmi' | 'elevation' = 'ndvi'): string {
  if (indicator === 'ndvi') {
    return `<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>
<qgis version="3.28.0" styleCategories="AllStyleCategories">
  <pipe>
    <rasterrenderer type="singlebandpseudocolor" band="1" opacity="1" classificationMin="-0.1" classificationMax="0.9">
      <rastershader>
        <colorrampshader colorRampType="INTERPOLATED" clip="0" classificationMode="1">
          <colorrampshaderitem value="-0.10" color="#a50026" label="Water / Barren (&lt; 0.0)" alpha="255"/>
          <colorrampshaderitem value="0.15" color="#d73027" label="Bare Soil (0.15)" alpha="255"/>
          <colorrampshaderitem value="0.30" color="#f46d43" label="Severe Stress (0.30)" alpha="255"/>
          <colorrampshaderitem value="0.45" color="#fdae61" label="Moderate Canopy (0.45)" alpha="255"/>
          <colorrampshaderitem value="0.60" color="#d9ef8b" label="Good Growth (0.60)" alpha="255"/>
          <colorrampshaderitem value="0.75" color="#66bd63" label="High Vigour (0.75)" alpha="255"/>
          <colorrampshaderitem value="0.90" color="#006837" label="Peak Biomass (0.90)" alpha="255"/>
        </colorrampshader>
      </rastershader>
    </rasterrenderer>
    <brightnesscontrast brightness="0" contrast="0"/>
    <huesaturation colorizeGreen="128" colorizeOn="0" colorizeStrength="100" colorizeBlue="128" saturation="0" grayscaleMode="0" colorizeRed="255"/>
    <rasterresampler maxOversampling="2"/>
  </pipe>
  <blendMode>0</blendMode>
</qgis>`
  }

  // Elevation style
  return `<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>
<qgis version="3.28.0" styleCategories="AllStyleCategories">
  <pipe>
    <rasterrenderer type="singlebandpseudocolor" band="1" opacity="1" classificationMin="100" classificationMax="1200">
      <rastershader>
        <colorrampshader colorRampType="INTERPOLATED" clip="0" classificationMode="1">
          <colorrampshaderitem value="100" color="#2b83ba" label="Lowland / Depression" alpha="255"/>
          <colorrampshaderitem value="350" color="#abdda4" label="Valley Floor" alpha="255"/>
          <colorrampshaderitem value="600" color="#ffffbf" label="Mid Terrace" alpha="255"/>
          <colorrampshaderitem value="850" color="#fdae61" label="Upper Slope" alpha="255"/>
          <colorrampshaderitem value="1200" color="#d7191c" label="Ridge / Crest" alpha="255"/>
        </colorrampshader>
      </rastershader>
    </rasterrenderer>
  </pipe>
</qgis>`
}

// ============================================================================
// 3. QGIS Layer Definition (.qlr)
// ============================================================================
export function generateQgisQlr(farm: FarmData & { name: string }): string {
  const nameSafe = (farm.name || 'Field').replace(/[<>&'"]/g, '')
  return `<!DOCTYPE qgis-layer-definition>
<qlr>
  <maplayers>
    <maplayer type="raster" name="ESRI Satellite Imagery" autoRefreshTime="0" autoRefreshMode="Disabled">
      <id>esri_world_imagery</id>
      <datasource>type=xyz&amp;url=https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}&amp;zmax=19&amp;zmin=0</datasource>
      <keywordList><value></value></keywordList>
      <layername>ESRI World Imagery</layername>
      <srs>
        <spatialrefsys nativeFormat="Wkt">
          <wkt>PROJCRS["WGS 84 / Pseudo-Mercator",BASEGEOGCRS["WGS 84",DATUM["World Geodetic System 1984",ELLIPSOID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],CONVERSION["Popular Visualisation Pseudo-Mercator",METHOD["Popular Visualisation Pseudo Mercator"]],CS[Cartesian,2],AXIS["easting (X)",east],AXIS["northing (Y)",north],UNIT["metre",1],ID["EPSG",3857]]</wkt>
          <proj4>+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs</proj4>
          <srsid>3857</srsid>
          <srid>3857</srid>
          <authid>EPSG:3857</authid>
          <description>WGS 84 / Pseudo-Mercator</description>
        </spatialrefsys>
      </srs>
    </maplayer>
  </maplayers>
</qlr>`
}

// ============================================================================
// 4. ArcGIS / ArcMap (ArcPy Automation Script)
// ============================================================================
export function generateArcPyScript(farm: FarmData & { name: string; crop?: string }): string {
  const ring = getCleanPolygonRing(farm)
  const closedRing = [...ring, ring[0]]
  const coordsList = closedRing.map(([lon, lat]) => `arcpy.Point(${lon.toFixed(6)}, ${lat.toFixed(6)})`).join(', ')
  const utm = computeUtmCoordinates(farm.lat, farm.lon)
  const nameSafe = (farm.name || 'Field').replace(/'/g, "\\'")
  const cropSafe = (farm.crop || 'Crop').replace(/'/g, "\\'")
  const areaHa = farm.area || 1.0
  const ndvi = farm.analysis?.ndvi?.mean ?? 0.72
  const ndmi = farm.analysis?.ndmi?.mean ?? 0.24
  const elev = farm.analysis?.elevMean ?? 240
  const slope = farm.analysis?.slopeDeg ?? 1.5

  return `# -*- coding: utf-8 -*-
# ==============================================================================
# SEVA·GIS - Native ArcPy Loader & Spatial Analysis Pipeline
# Compatible with: ArcGIS Pro 2.x/3.x and ArcMap 10.4-10.8
# Target Field: ${nameSafe} (${areaHa.toFixed(2)} Ha) | ${utm.zone}
# Generated: ${new Date().toISOString()}
#
# HOW TO RUN IN ARCGIS PRO / ARCMAP:
# 1. Open ArcGIS Pro or ArcMap
# 2. Open the Python Window (Analysis -> Python in Pro, or Standard Toolbar in ArcMap)
# 3. Paste this script and press Enter
# ==============================================================================

import os
import sys
import arcpy

print("[SEVA·GIS] Initializing ArcPy feature class builder for '${nameSafe}'...")

arcpy.env.overwriteOutput = True

# 1. Define Geographic Coordinate Reference System (WGS 1984, EPSG:4326)
sr_wgs84 = arcpy.SpatialReference(4326)

# 2. Select Workspace: Use Current Scratch Geodatabase or In-Memory
try:
    workspace = arcpy.env.scratchGDB if arcpy.env.scratchGDB else "in_memory"
except Exception:
    workspace = "in_memory"

fc_name = "SEVA_${getCleanSlug(farm.name).replace(/-/g, '_')}"
output_fc = os.path.join(workspace, fc_name)

# If layer already exists, delete it first
if arcpy.Exists(output_fc):
    arcpy.management.Delete(output_fc)

# 3. Create Feature Class with Polygon Geometry
arcpy.management.CreateFeatureclass(
    out_path=workspace,
    out_name=fc_name,
    geometry_type="POLYGON",
    spatial_reference=sr_wgs84
)

# 4. Add Schema Fields
fields_to_add = [
    ("Field_Name", "TEXT", 100),
    ("Crop_Type", "TEXT", 50),
    ("Area_Ha", "DOUBLE", None),
    ("NDVI_Mean", "DOUBLE", None),
    ("NDMI_Mean", "DOUBLE", None),
    ("Elev_m", "DOUBLE", None),
    ("Slope_deg", "DOUBLE", None),
    ("UTM_Zone", "TEXT", 20),
    ("Source", "TEXT", 100),
]

for field_name, field_type, length in fields_to_add:
    if length:
        arcpy.management.AddField(output_fc, field_name, field_type, field_length=length)
    else:
        arcpy.management.AddField(output_fc, field_name, field_type)

# 5. Build Polygon Geometry and Insert Record via Data Access Cursor
pts = arcpy.Array([
    ${coordsList}
])
polygon_geom = arcpy.Polygon(pts, sr_wgs84)

fields = ["SHAPE@", "Field_Name", "Crop_Type", "Area_Ha", "NDVI_Mean", "NDMI_Mean", "Elev_m", "Slope_deg", "UTM_Zone", "Source"]
with arcpy.da.InsertCursor(output_fc, fields) as cursor:
    cursor.insertRow([
        polygon_geom,
        "${nameSafe}",
        "${cropSafe}",
        ${areaHa.toFixed(2)},
        ${ndvi.toFixed(3)},
        ${ndmi.toFixed(3)},
        ${elev.toFixed(1)},
        ${slope.toFixed(1)},
        "${utm.zone}",
        "SEVA.GIS (Sentinel-2 L2A + Copernicus DEM)"
    ])

print("[SEVA·GIS] Created feature class with 1 record at: {}".format(output_fc))

# 6. Add Layer to Active Map Document (Auto-detecting ArcGIS Pro vs ArcMap 10.x)
try:
    # Check for ArcGIS Pro arcpy.mp
    if hasattr(arcpy, "mp"):
        aprx = arcpy.mp.ArcGISProject("CURRENT")
        active_map = aprx.activeMap
        if active_map:
            active_map.addDataFromPath(output_fc)
            print("[SEVA·GIS] Added '{}' to active ArcGIS Pro map.".format(fc_name))
    # Fallback to ArcMap arcpy.mapping
    elif hasattr(arcpy, "mapping"):
        mxd = arcpy.mapping.MapDocument("CURRENT")
        df = arcpy.mapping.ListDataFrames(mxd)[0]
        layer = arcpy.mapping.Layer(output_fc)
        arcpy.mapping.AddLayer(df, layer, "TOP")
        arcpy.RefreshTOC()
        arcpy.RefreshActiveView()
        print("[SEVA·GIS] Added '{}' to ArcMap 10.x data frame.".format(fc_name))
except Exception as map_err:
    print("[SEVA·GIS] Map document auto-add note: {}".format(map_err))

# 7. Spatial Analyst Clip & Zonal Summary Recipe (Optional if raster present)
print("""
[SEVA·GIS] Tip for Satellite Raster Ingestion:
To clip any Sentinel-2 or DEM raster in ArcGIS:
  arcpy.CheckOutExtension('Spatial')
  clipped_raster = arcpy.sa.ExtractByMask('your_sentinel2_raster.tif', output_fc)
  clipped_raster.save('clipped_farm_raster.tif')
""")
`
}

// ============================================================================
// 5. ArcGIS Pro CIM Layer (.lyrx)
// ============================================================================
export function generateArcGisLyrx(farm: FarmData & { name: string }): string {
  const nameSafe = (farm.name || 'Field').replace(/"/g, '')
  const lyrx = {
    type: "CIMLayerDocument",
    version: "3.0.0",
    build: 36056,
    layers: [
      "CIMPATH=map/seva_boundary.json"
    ],
    layerDefinitions: [
      {
        type: "CIMFeatureLayer",
        name: `SEVA - ${nameSafe} Boundary`,
        uRI: "CIMPATH=map/seva_boundary.json",
        sourceModifiedTime: {
          type: "TimeInstant"
        },
        description: "SEVA.GIS Precision Boundary Layer",
        layerElevation: {
          type: "CIMLayerElevationSurface"
        },
        expanded: true,
        layerType: "Operational",
        showLegends: true,
        visibility: true,
        displayCacheType: "Permanent",
        maxDisplayCacheAge: 5,
        showPopups: true,
        renderer: {
          type: "CIMSimpleRenderer",
          patch: "Default",
          symbol: {
            type: "CIMSymbolReference",
            symbol: {
              type: "CIMPolygonSymbol",
              symbolLayers: [
                {
                  type: "CIMSolidStroke",
                  enable: true,
                  capStyle: "Round",
                  joinStyle: "Round",
                  lineStyle3D: "Strip",
                  miterLimit: 10,
                  width: 2.0,
                  color: {
                    type: "CIMRGBColor",
                    values: [22, 163, 74, 100]
                  }
                },
                {
                  type: "CIMSolidFill",
                  enable: true,
                  color: {
                    type: "CIMRGBColor",
                    values: [34, 197, 94, 25]
                  }
                }
              ]
            }
          }
        }
      }
    ]
  }
  return JSON.stringify(lyrx, null, 2)
}

// ============================================================================
// 6. Google Earth Engine (GEE JavaScript Code Editor Script)
// ============================================================================
export function generateGeeCodeEditorScript(farm: FarmData & { name: string; crop?: string }): string {
  const ring = getCleanPolygonRing(farm)
  const coordsList = ring.map(([lon, lat]) => `[${lon.toFixed(6)}, ${lat.toFixed(6)}]`).join(',\n    ')
  const nameSafe = (farm.name || 'Field').replace(/'/g, "\\'")
  const areaHa = farm.area || 1.0

  return `// ==============================================================================
// SEVA·GIS - Google Earth Engine (GEE) Production Pipeline
// Target Farm: '${nameSafe}' (~${areaHa.toFixed(2)} Hectares)
// Grounded in: Copernicus Sentinel-2 L2A Harmonized + GLO-30 Copernicus DSM
// Link to Run: https://code.earthengine.google.com/
// ==============================================================================

// 1. Define Area of Interest (AOI) Polygon
var aoi = ee.Geometry.Polygon([
  [
    ${coordsList}
  ]
]);

Map.centerObject(aoi, 16);
Map.setOptions('HYBRID');

// 2. High-Precision Cloud & Shadow Masking (Sentinel-2 L2A Scene Classification Layer)
function maskS2sr(image) {
  var scl = image.select('SCL');
  // SCL values to mask: 3 = Cloud shadow, 8 = Cloud med prob, 9 = Cloud high prob, 10 = Cirrus
  var mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
  return image.updateMask(mask).divide(10000)
    .copyProperties(image, ['system:time_start']);
}

// 3. Query Sentinel-2 L2A Surface Reflectance Collection (Last 45 Days)
var s2Collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filterDate(ee.Date(Date.now()).advance(-45, 'day'), ee.Date(Date.now()))
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 25))
  .map(maskS2sr);

var composite = s2Collection.median().clip(aoi);

// 4. Compute Comprehensive Multi-Spectral Indicators
// NDVI = (NIR - RED) / (NIR + RED)
var ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI');

// NDMI = (NIR - SWIR1) / (NIR + SWIR1) -> Moisture Index
var ndmi = composite.normalizedDifference(['B8', 'B11']).rename('NDMI');

// SAVI = ((NIR - RED) / (NIR + RED + 0.5)) * 1.5
var savi = composite.expression(
  '((NIR - RED) / (NIR + RED + 0.5)) * 1.5', {
    'NIR': composite.select('B8'),
    'RED': composite.select('B4')
  }
).rename('SAVI');

// EVI = 2.5 * ((NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1))
var evi = composite.expression(
  '2.5 * ((NIR - RED) / (NIR + 6.0 * RED - 7.5 * BLUE + 1.0))', {
    'NIR': composite.select('B8'),
    'RED': composite.select('B4'),
    'BLUE': composite.select('B2')
  }
).rename('EVI');

// 5. Digital Terrain Modeling (Copernicus DEM GLO-30)
var dem = ee.Image('COPERNICUS/DEM/GLO30').select('DEM').clip(aoi);
var terrain = ee.Terrain.products(dem);
var slope = terrain.select('slope');

// 6. Palettes & Map Layers
var ndviPalette = ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850'];
var ndmiPalette = ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6'];
var demPalette = ['#2b83ba', '#abdda4', '#ffffbf', '#fdae61', '#d7191c'];

// Add Visual Layers to Canvas
Map.addLayer(composite, {bands: ['B4', 'B3', 'B2'], min: 0.02, max: 0.25}, 'True Color RGB (B4/B3/B2)', false);
Map.addLayer(composite, {bands: ['B8', 'B4', 'B3'], min: 0.04, max: 0.40}, 'False Color IR (B8/B4/B3)', false);
Map.addLayer(dem, {min: 100, max: 800, palette: demPalette}, 'Copernicus Elevation (m)', false);
Map.addLayer(slope, {min: 0, max: 15, palette: ['#ffffcc', '#fd8d3c', '#800026']}, 'Slope Gradient (deg)', false);
Map.addLayer(ndmi, {min: -0.2, max: 0.6, palette: ndmiPalette}, 'Canopy Water NDMI', false);
Map.addLayer(ndvi, {min: 0.1, max: 0.85, palette: ndviPalette}, 'Crop Vigour NDVI', true);

// Boundary Vector Outline
var empty = ee.Image().byte();
var outline = empty.paint({
  featureCollection: ee.FeatureCollection([ee.Feature(aoi)]),
  color: 1,
  width: 2.5
});
Map.addLayer(outline, {palette: ['#00FF66']}, 'AOI Field Boundary');

// 7. Zonal Statistics Summary
var stats = ndvi.addBands(ndmi).addBands(dem).reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e9
});

print('=== SEVA·GIS Field Statistics for ${nameSafe} ===', stats);

// 8. Pre-Configured Export to Google Drive (Click "Run" in Tasks tab)
Export.image.toDrive({
  image: ndvi.toFloat(),
  description: 'SEVA_NDVI_${getCleanSlug(farm.name)}',
  folder: 'SEVA_GIS_Exports',
  fileNamePrefix: 'NDVI_${getCleanSlug(farm.name)}',
  region: aoi,
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e9
});

Export.image.toDrive({
  image: dem.toFloat(),
  description: 'SEVA_DEM_${getCleanSlug(farm.name)}',
  folder: 'SEVA_GIS_Exports',
  fileNamePrefix: 'DEM_${getCleanSlug(farm.name)}',
  region: aoi,
  scale: 30,
  crs: 'EPSG:4326',
  maxPixels: 1e9
});
`
}

// ============================================================================
// 7. Google Earth Engine Headless Python Batch Pipeline
// ============================================================================
export function generateGeePythonScript(farm: FarmData & { name: string }): string {
  const ring = getCleanPolygonRing(farm)
  const coordsList = ring.map(([lon, lat]) => `[${lon.toFixed(6)}, ${lat.toFixed(6)}]`).join(',\n        ')
  const nameSafe = (farm.name || 'Field').replace(/'/g, "\\'")
  const slug = getCleanSlug(farm.name)

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SEVA·GIS Headless Google Earth Engine Batch Processor.

Connects to Google Earth Engine via Service Account or OAuth credentials.
Calculates Sentinel-2 L2A NDVI and Copernicus DEM over ${nameSafe}.
"""

import ee
import os
import sys

# 1. Initialize GEE
try:
    ee.Initialize()
    print("[SEVA·GIS] Earth Engine initialized successfully.")
except Exception as e:
    print("[SEVA·GIS] Authentication error. Run 'earthengine authenticate' first.")
    sys.exit(1)

# 2. Area of Interest
aoi = ee.Geometry.Polygon([
    [
        ${coordsList}
    ]
])

# 3. Sentinel-2 L2A Cloud Masking
def mask_s2(image):
    scl = image.select('SCL')
    mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10))
    return image.updateMask(mask).divide(10000).copyProperties(image, ['system:time_start'])

# 4. Filter Collection
s2 = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(aoi)
      .filterDate(ee.Date(ee.Date(ee.Number(ee.Date.now())).advance(-45, 'day')), ee.Date.now())
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .map(mask_s2)
      .median()
      .clip(aoi))

ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI')
dem = ee.Image('COPERNICUS/DEM/GLO30').select('DEM').clip(aoi)

# 5. Extract Zonal Metrics
stats = ndvi.reduceRegion(
    reducer=ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True),
    geometry=aoi,
    scale=10,
    maxPixels=1e9
).getInfo()

print("Field Metrics for '${nameSafe}':")
for k, v in stats.items():
    print("  {}: {}".format(k, v))

# 6. Direct GeoTIFF Download URL
url = ndvi.getDownloadURL({
    'name': '${slug}_ndvi',
    'scale': 10,
    'crs': 'EPSG:4326',
    'region': aoi
})
print("\\nDirect GeoTIFF Download Link (valid 2 hours):\\n" + url)
`
}

// ============================================================================
// 8. GDAL / OGR Shell Script (Bash & PowerShell)
// ============================================================================
export function generateGdalScript(farm: FarmData & { name: string }): string {
  const slug = getCleanSlug(farm.name)
  const utm = computeUtmCoordinates(farm.lat, farm.lon)

  return `#!/usr/bin/env bash
# ==============================================================================
# SEVA·GIS - Native GDAL / OGR Processing Recipe
# Target: ${farm.name} | Projected EPSG:${utm.epsg} (${utm.zone})
# Requirements: gdal-bin, python3-gdal
# ==============================================================================
set -e

echo "[SEVA·GIS] Starting GDAL geospatial translation pipeline for '${slug}'..."

# 1. Convert GeoJSON Boundary to ESRI Shapefile
ogr2ogr -f "ESRI Shapefile" "${slug}_boundary.shp" "${slug}.geojson"
echo "  -> Created ESRI Shapefile: ${slug}_boundary.shp"

# 2. Convert to OGC GeoPackage (Standard GIS Container)
ogr2ogr -f "GPKG" "${slug}_field.gpkg" "${slug}.geojson" -nln "boundary"
echo "  -> Created OGC GeoPackage: ${slug}_field.gpkg"

# 3. Project to Local UTM Zone (${utm.zone}) for Metric Distance & Buffer Operations
ogr2ogr -t_srs "EPSG:${utm.epsg}" "${slug}_utm.gpkg" "${slug}_field.gpkg"
echo "  -> Projected to ${utm.zone} (EPSG:${utm.epsg})"

# 4. Clip Sentinel-2 Band 8 (NIR) & Band 4 (Red) Rasters to Exact Field Boundary
# Assumes input S2 tiles are named B08.jp2 and B04.jp2 (or .tif)
if [ -f "B08.tif" ] && [ -f "B04.tif" ]; then
    echo "[SEVA·GIS] Clipping raster bands..."
    gdalwarp -cutline "${slug}.geojson" -crop_to_cutline -dstnodata -9999 B08.tif "${slug}_B08_clipped.tif"
    gdalwarp -cutline "${slug}.geojson" -crop_to_cutline -dstnodata -9999 B04.tif "${slug}_B04_clipped.tif"

    # 5. Compute NDVI via gdal_calc.py
    echo "[SEVA·GIS] Calculating NDVI band math..."
    gdal_calc.py -A "${slug}_B08_clipped.tif" -B "${slug}_B04_clipped.tif" \\
        --outfile="${slug}_NDVI.tif" \\
        --calc="(A.astype(float) - B) / (A + B + 1e-6)" \\
        --type='Float32' \\
        --NoDataValue=-9999

    # 6. Convert to Cloud Optimized GeoTIFF (COG) with Deflate Compression & Overviews
    echo "[SEVA·GIS] Generating Cloud Optimized GeoTIFF (COG)..."
    gdaladdo -r average "${slug}_NDVI.tif" 2 4 8 16
    gdal_translate -of COG -co COMPRESS=DEFLATE -co PREDICTOR=2 "${slug}_NDVI.tif" "${slug}_NDVI_COG.tif"
    echo "  -> Created COG: ${slug}_NDVI_COG.tif"
else
    echo "[SEVA·GIS] S2 band files (B08.tif, B04.tif) not found in directory. Vector conversions complete."
fi

echo "[SEVA·GIS] Pipeline finished successfully."
`
}

// ============================================================================
// 9. Precision Agriculture ISO-XML (ISO 11783-10 TaskData.xml)
// ============================================================================
export function generateIsoXmlTaskData(farm: FarmData & { name: string; crop?: string }): string {
  const ring = getCleanPolygonRing(farm)
  const nameSafe = (farm.name || 'Field').replace(/[<>&'"]/g, '')
  const cropSafe = (farm.crop || 'Agricultural Land').replace(/[<>&'"]/g, '')
  const areaSqM = Math.round((farm.area || 1.0) * 10000)

  // Points XML
  const pntXml = ring.map((pt, idx) => `      <PNT A="2" C="${pt[1].toFixed(7)}" D="${pt[0].toFixed(7)}" />`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ========================================================================== -->
<!-- SEVA·GIS - ISO 11783-10 Standard TaskData XML                              -->
<!-- Precision Agriculture Rate Controller / Tractor Terminal Specification     -->
<!-- Supported Displays: John Deere GS3/4600/G5, Trimble TMX/FmX, Topcon, Case  -->
<!-- Target Parcel: ${nameSafe} (~${(areaSqM / 10000).toFixed(2)} Ha)          -->
<!-- ========================================================================== -->
<ISO11783_TaskData VersionMajor="4" VersionMinor="2" ManagementSoftwareManufacturer="SEVA.GIS" ManagementSoftwareVersion="4.0.0" DataTransferOrigin="1">
  <CTR A="CTR1" B="SEVA Kisan Community" />
  <FRM A="FRM1" B="${nameSafe} Holding" I="CTR1" />
  <PFD A="PFD1" C="${nameSafe}" D="${areaSqM}" E="FRM1">
    <PLN A="1">
      <LSG A="1">
${pntXml}
      </LSG>
    </PLN>
  </PFD>
  <PDT A="PDT1" B="${cropSafe} Prescription VRA" C="1" />
  <TSK A="TSK1" B="Nitrogen VRA &amp; Seed Mapping" E="PFD1" G="1" />
</ISO11783_TaskData>
`
}

// ============================================================================
// 10. AutoCAD DXF (Release 12 ASCII CAD Format)
// ============================================================================
export function generateDxfCad(farm: FarmData & { name: string }): string {
  const ring = getCleanPolygonRing(farm)
  const closedRing = [...ring, ring[0]]
  const nameSafe = (farm.name || 'Field').replace(/[^\w\s-]/g, '')

  let dxf = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n`
  dxf += `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n`
  dxf += `0\nLAYER\n2\nSEVA_BOUNDARY\n70\n0\n62\n3\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n`
  dxf += `0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n`
  dxf += `0\nSECTION\n2\nENTITIES\n`

  // Polyline Header
  dxf += `0\nPOLYLINE\n8\nSEVA_BOUNDARY\n66\n1\n70\n1\n`

  // Vertices
  for (const [lon, lat] of closedRing) {
    dxf += `0\nVERTEX\n8\nSEVA_BOUNDARY\n10\n${lon.toFixed(6)}\n20\n${lat.toFixed(6)}\n30\n0.0\n`
  }

  // Seqend
  dxf += `0\nSEQEND\n8\nSEVA_BOUNDARY\n`

  // Add Centroid Text Label
  dxf += `0\nTEXT\n8\nSEVA_BOUNDARY\n10\n${farm.lon.toFixed(6)}\n20\n${farm.lat.toFixed(6)}\n30\n0.0\n40\n0.0003\n1\n${nameSafe}\n`

  dxf += `0\nENDSEC\n0\nEOF\n`
  return dxf
}
