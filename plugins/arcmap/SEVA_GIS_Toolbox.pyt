# -*- coding: utf-8 -*-
"""
SEVA·GIS Precision Agriculture Python Toolbox for ArcMap & ArcGIS Pro
Author: N. Akshit Vinay
Repository: https://github.com/virahitvin8/seva-gis
License: MIT
"""

import base64
import json
import os
import sys
import urllib.parse
import urllib.request
import webbrowser

try:
    import arcpy
except ImportError:
    arcpy = None


class Toolbox(object):
    def __init__(self):
        """Define the toolbox (the name of the toolbox is the name of the .pyt file)."""
        self.label = "SEVA·GIS Precision Agriculture Tools"
        self.alias = "sevagis"
        self.description = "Direct bridge between ArcMap / ArcGIS Pro and SEVA·GIS in-browser GeoAI."
        self.tools = [SendFieldToSevaGIS, ImportSevaGisLayers]


class SendFieldToSevaGIS(object):
    def __init__(self):
        """Define the tool (tool name is the name of the class)."""
        self.label = "⚡ Send Field to SEVA·GIS & Analyze"
        self.description = "Extracts polygon boundary from ArcMap / ArcGIS Pro, reprojects to WGS84, and opens live SEVA·GIS satellite analysis."
        self.canRunInBackground = False

    def getParameterInfo(self):
        """Define parameter definitions."""
        # 0: Input Polygon Layer
        param_layer = arcpy.Parameter(
            displayName="Field Boundary Feature Layer",
            name="in_layer",
            datatype="GPFeatureLayer",
            parameterType="Required",
            direction="Input",
        )
        param_layer.filter.list = ["Polygon"]

        # 1: Farm / Plot Name Field
        param_name_field = arcpy.Parameter(
            displayName="Field Name (Attribute Field or String)",
            name="name_field",
            datatype="GPString",
            parameterType="Optional",
            direction="Input",
        )
        param_name_field.value = "ArcGIS Field"

        # 2: Crop Type
        param_crop = arcpy.Parameter(
            displayName="Crop Type",
            name="crop_type",
            datatype="GPString",
            parameterType="Optional",
            direction="Input",
        )
        param_crop.filter.list = [
            "Paddy (Rice)", "Wheat", "Cotton", "Maize",
            "Sugarcane", "Soybean", "Mustard", "Tomato",
            "Potato", "Pulses", "Uncultivated / Bare Land"
        ]
        param_crop.value = "Paddy (Rice)"

        # 3: SEVA·GIS Target URL
        param_url = arcpy.Parameter(
            displayName="SEVA·GIS Web App Endpoint",
            name="app_url",
            datatype="GPString",
            parameterType="Optional",
            direction="Input",
        )
        param_url.value = "https://sevagis.dpdns.org"

        return [param_layer, param_name_field, param_crop, param_url]

    def isLicensed(self):
        return True

    def updateParameters(self, parameters):
        return

    def updateMessages(self, parameters):
        return

    def execute(self, parameters, messages):
        """The source code of the tool."""
        in_layer = parameters[0].valueAsText
        field_name = parameters[1].valueAsText or "ArcGIS Field"
        crop_type = parameters[2].valueAsText or "Paddy (Rice)"
        app_url = parameters[3].valueAsText or "https://sevagis.dpdns.org"

        arcpy.AddMessage("🛰️ SEVA·GIS ArcMap/ArcGIS Pro Bridge active...")
        arcpy.AddMessage(f"Processing layer: {in_layer}")

        # Target WGS84 Spatial Reference
        sr_wgs84 = arcpy.SpatialReference(4326)

        rings = []
        resolved_name = field_name

        # Read geometries with projection to WGS84
        with arcpy.da.SearchCursor(in_layer, ["SHAPE@"], spatial_reference=sr_wgs84) as cursor:
            for row in cursor:
                geom = row[0]
                if geom and geom.type == "polygon":
                    # Extract exterior ring
                    for part in geom:
                        poly_ring = []
                        for pt in part:
                            if pt:
                                poly_ring.append([round(pt.X, 6), round(pt.Y, 6)])
                        if len(poly_ring) >= 3:
                            rings.append(poly_ring)
                            break
                    if rings:
                        break

        if not rings:
            arcpy.AddError("No valid polygon features found in layer.")
            return

        active_ring = rings[0]
        arcpy.AddMessage(f"Extracted boundary polygon with {len(active_ring)} vertices.")

        # Construct Deep-Link Payload
        payload = {
            "source": "arcmap",
            "name": resolved_name,
            "crop": crop_type,
            "ring": active_ring,
        }

        json_str = json.dumps(payload)
        b64_data = base64.urlsafe_b64encode(json_str.encode("utf-8")).decode("utf-8")
        target_url = f"{app_url.rstrip('/')}/?import={b64_data}"

        arcpy.AddMessage(f"🚀 Transmitting to SEVA·GIS: {target_url[:60]}...")
        webbrowser.open(target_url, new=2)

        # Also attempt local bridge daemon if active
        try:
            req = urllib.request.Request(
                "http://127.0.0.1:8765/api/import",
                data=json_str.encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=2) as resp:
                arcpy.AddMessage("Connected to local bridge daemon (127.0.0.1:8765).")
        except Exception:
            pass

        arcpy.AddMessage("✅ SEVA·GIS launched successfully! Live satellite telemetry initiated.")


class ImportSevaGisLayers(object):
    def __init__(self):
        self.label = "📥 Import SEVA·GIS Swaths & Hotspots into ArcMap"
        self.description = "Imports GeoJSON tractor swaths and GPS scout hotspots generated by SEVA·GIS into ArcMap / ArcGIS Pro."
        self.canRunInBackground = False

    def getParameterInfo(self):
        param_json = arcpy.Parameter(
            displayName="SEVA·GIS Exported GeoJSON File",
            name="in_geojson",
            datatype="DEFile",
            parameterType="Required",
            direction="Input",
        )
        param_json.filter.list = ["geojson", "json"]

        param_out = arcpy.Parameter(
            displayName="Output Feature Class",
            name="out_fc",
            datatype="DEFeatureClass",
            parameterType="Required",
            direction="Output",
        )

        return [param_json, param_out]

    def isLicensed(self):
        return True

    def execute(self, parameters, messages):
        in_file = parameters[0].valueAsText
        out_fc = parameters[1].valueAsText

        arcpy.AddMessage(f"Importing SEVA·GIS GeoJSON: {in_file} -> {out_fc}")
        try:
            # Use arcpy JSON to Features conversion
            arcpy.conversion.JSONToFeatures(in_file, out_fc)
            arcpy.AddMessage("✅ Successfully converted SEVA·GIS layers into ArcGIS Feature Class!")
        except Exception as e:
            arcpy.AddError(f"Import failed: {str(e)}")
