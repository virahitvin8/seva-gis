# -*- coding: utf-8 -*-
"""
SEVA.GIS — Official Esri arcpy Python Toolbox (.pyt)
Compatible with:
 - ArcMap 10.4 / 10.5 / 10.6 / 10.7 / 10.8 (Python 2.7)
 - ArcGIS Pro 2.x / 3.x (Python 3.x + arcpy.mp)

Author: N. Akshit Vinay (MSc GIS & Remote Sensing, BSc Agriculture) <virahitvin8>
Brand: "Where Satellites Meet Soil"
"""

import os
import json

try:
    import arcpy
    ARCPY_AVAILABLE = True
except ImportError:
    ARCPY_AVAILABLE = False


class Toolbox(object):
    def __init__(self):
        self.label = "SEVA GIS Multi-Engine Bridge Toolbox"
        self.alias = "sevagis"
        self.tools = [ExportAoiToSevaGisTool, IngestGeeCompositeTool]


class ExportAoiToSevaGisTool(object):
    def __init__(self):
        self.label = "1. Export Active Field Feature AOI to SEVA.GIS"
        self.description = (
            "Extracts selected parcel polygon from ArcMap/ArcGIS Pro layer, "
            "reprojects to WGS84 (EPSG:4326), and exports clean GeoJSON for SEVA.GIS."
        )
        self.canRunInBackground = False

    def getParameterInfo(self):
        param_in_features = arcpy.Parameter(
            displayName="Input Parcel / Watershed Feature Layer",
            name="in_features",
            datatype="GPFeatureLayer",
            parameterType="Required",
            direction="Input"
        )
        param_in_features.filter.list = ["Polygon"]

        param_out_geojson = arcpy.Parameter(
            displayName="Output SEVA.GIS GeoJSON File",
            name="out_geojson",
            datatype="DEFile",
            parameterType="Required",
            direction="Output"
        )
        param_out_geojson.filter.list = ["geojson", "json"]

        return [param_in_features, param_out_geojson]

    def isLicensed(self):
        return True

    def updateParameters(self, parameters):
        return

    def updateMessages(self, parameters):
        return

    def execute(self, parameters, messages):
        in_layer = parameters[0].valueAsText
        out_file = parameters[1].valueAsText

        messages.addMessage("Transforming parcel coordinates to EPSG:4326 (WGS84)...")
        wgs84 = arcpy.SpatialReference(4326)

        # Reproject temporary feature class to WGS84
        temp_fc = arcpy.CreateScratchName("seva_temp", data_type="FeatureClass", workspace="in_memory")
        arcpy.Project_management(in_layer, temp_fc, wgs84)

        # Convert to GeoJSON using arcpy.FeaturesToJSON_conversion
        arcpy.FeaturesToJSON_conversion(temp_fc, out_file, format_json="FORMATTED", geoJSON="GEOJSON")
        arcpy.Delete_management(temp_fc)

        messages.addMessage("Successfully exported AOI GeoJSON: " + out_file)
        messages.addMessage("Import this file into SEVA.GIS (sevagis.dpdns.org) for zero-key GEE analysis.")


class IngestGeeCompositeTool(object):
    def __init__(self):
        self.label = "2. Ingest SEVA.GIS Composite GeoTIFF to Map Document"
        self.description = (
            "Loads downloaded 10m Sentinel-2 / DEM GeoTIFF composite exported from SEVA.GIS "
            "into the current ArcMap MXD or ArcGIS Pro Map Project."
        )
        self.canRunInBackground = False

    def getParameterInfo(self):
        param_raster = arcpy.Parameter(
            displayName="SEVA.GIS Exported GeoTIFF / VRT",
            name="in_raster",
            datatype="DERasterDataset",
            parameterType="Required",
            direction="Input"
        )
        return [param_raster]

    def isLicensed(self):
        return True

    def execute(self, parameters, messages):
        raster_path = parameters[0].valueAsText
        messages.addMessage("Loading composite raster: " + raster_path)

        # Check if running in ArcGIS Pro vs ArcMap 10.x
        try:
            aprx = arcpy.mp.ArcGISProject("CURRENT")
            active_map = aprx.activeMap
            active_map.addDataFromPath(raster_path)
            messages.addMessage("Added raster layer to active ArcGIS Pro map.")
        except AttributeError:
            # Fallback to ArcMap 10.x arcpy.mapping
            mxd = arcpy.mapping.MapDocument("CURRENT")
            df = arcpy.mapping.ListDataFrames(mxd)[0]
            new_layer = arcpy.mapping.RasterLayer(raster_path)
            arcpy.mapping.AddLayer(df, new_layer, "TOP")
            arcpy.RefreshTOC()
            arcpy.RefreshActiveView()
            messages.addMessage("Added raster layer to active ArcMap data frame.")
