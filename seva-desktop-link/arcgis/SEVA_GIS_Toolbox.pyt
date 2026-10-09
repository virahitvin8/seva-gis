# -*- coding: utf-8 -*-
"""
SEVA·GIS Precision Agriculture Python Toolbox for ArcMap 10.x & ArcGIS Pro
Author: N. Akshit Vinay
Repository: https://github.com/virahitvin8/seva-gis
License: MIT
"""
from __future__ import print_function
import os
import sys

try:
    import arcpy
    HAS_ARCPY = True
except ImportError:
    HAS_ARCPY = False

# Add toolbox directory to path
tb_dir = os.path.dirname(__file__)
if tb_dir not in sys.path:
    sys.path.insert(0, tb_dir)

try:
    import seva_core
    import seva_arcgis
except ImportError:
    from . import seva_core
    from . import seva_arcgis


class Toolbox(object):
    def __init__(self):
        self.label = "SEVA·GIS Precision Agriculture Tools"
        self.alias = "sevagis"
        self.description = "Two-way bridge between ArcMap / ArcGIS Pro and SEVA·GIS in-browser GeoAI."
        self.tools = [SendParcelsTool, PullResultsTool]


class SendParcelsTool(object):
    def __init__(self):
        self.label = "⚡ Send Parcels to SEVA·GIS & Analyze"
        self.description = "Extracts polygon boundaries, reprojects to WGS84, and dispatches them to SEVA·GIS via the local bridge daemon or deep-link."
        self.canRunInBackground = False

    def getParameterInfo(self):
        if not HAS_ARCPY:
            return []

        # 0: Input Polygon Layer
        p0 = arcpy.Parameter(
            displayName="Cadastral / Parcel Feature Layer",
            name="in_layer",
            datatype="GPFeatureLayer",
            parameterType="Required",
            direction="Input"
        )
        p0.filter.list = ["Polygon"]

        # 1: Name Field
        p1 = arcpy.Parameter(
            displayName="Field Name Attribute",
            name="name_field",
            datatype="Field",
            parameterType="Optional",
            direction="Input"
        )
        p1.parameterDependencies = [p0.name]

        # 2: Crop Field
        p2 = arcpy.Parameter(
            displayName="Crop Type Attribute",
            name="crop_field",
            datatype="Field",
            parameterType="Optional",
            direction="Input"
        )
        p2.parameterDependencies = [p0.name]

        # 3: Default Crop
        p3 = arcpy.Parameter(
            displayName="Default Crop (if field is empty)",
            name="default_crop",
            datatype="GPString",
            parameterType="Optional",
            direction="Input"
        )
        p3.filter.list = [
            "Paddy (Rice)", "Wheat", "Cotton", "Maize",
            "Sugarcane", "Soybean", "Mustard", "Tomato",
            "Potato", "Pulses", "Coconut", "Groundnut", "Sunflower",
            "Uncultivated / Bare Land"
        ]
        p3.value = "Paddy (Rice)"

        # 4: Exchange Folder
        p4 = arcpy.Parameter(
            displayName="Exchange Folder (Optional)",
            name="exchange_folder",
            datatype="DEFolder",
            parameterType="Optional",
            direction="Input"
        )

        return [p0, p1, p2, p3, p4]

    def isLicensed(self):
        return True

    def updateParameters(self, parameters):
        return

    def updateMessages(self, parameters):
        return

    def execute(self, parameters, messages):
        if not HAS_ARCPY:
            messages.addErrorMessage("arcpy is not available.")
            return

        in_layer = parameters[0].valueAsText
        name_field = parameters[1].valueAsText or ""
        crop_field = parameters[2].valueAsText or ""
        default_crop = parameters[3].valueAsText or "Paddy (Rice)"
        folder = parameters[4].valueAsText or ""

        cfg = seva_core.load_config()
        if folder:
            cfg["folder"] = folder

        messages.addMessage("Extracting polygon features from %s..." % in_layer)
        features = seva_arcgis.extract_features(
            in_layer,
            name_field=name_field,
            crop_field=crop_field,
            default_crop=default_crop
        )

        if not features:
            messages.addWarning("No valid polygon features found in layer.")
            return

        payload = seva_core.make_payload(
            features,
            app="ArcGIS",
            app_version="ArcMap/Pro",
            project=str(in_layer)
        )

        messages.addMessage("Sending %d parcel(s) to SEVA·GIS..." % len(features))
        res = seva_core.send_parcels(cfg, payload)
        summary = seva_core.describe(res)

        messages.addMessage("Successfully dispatched via: %s" % summary)
        if res.get("link"):
            messages.addMessage("Web link: %s" % res["link"])


class PullResultsTool(object):
    def __init__(self):
        self.label = "📥 Pull Analysis Results from SEVA·GIS"
        self.description = "Retrieves completed NDVI, moisture, and VRA recommendations and updates layer attributes via seva_id."
        self.canRunInBackground = False

    def getParameterInfo(self):
        if not HAS_ARCPY:
            return []

        p0 = arcpy.Parameter(
            displayName="Target Feature Layer to Update",
            name="target_layer",
            datatype="GPFeatureLayer",
            parameterType="Required",
            direction="Input"
        )
        p0.filter.list = ["Polygon"]

        p1 = arcpy.Parameter(
            displayName="Exchange Folder (Optional)",
            name="exchange_folder",
            datatype="DEFolder",
            parameterType="Optional",
            direction="Input"
        )

        return [p0, p1]

    def isLicensed(self):
        return True

    def updateParameters(self, parameters):
        return

    def updateMessages(self, parameters):
        return

    def execute(self, parameters, messages):
        if not HAS_ARCPY:
            messages.addErrorMessage("arcpy is not available.")
            return

        target_layer = parameters[0].valueAsText
        folder = parameters[1].valueAsText or ""

        cfg = seva_core.load_config()
        if folder:
            cfg["folder"] = folder

        messages.addMessage("Checking for latest results from SEVA·GIS...")
        results = seva_core.collect_results(cfg, "ArcGIS")

        if not results:
            messages.addMessage("No new results currently available in bridge queue or exchange folder.")
            return

        total_updated = 0
        for payload in results:
            total_updated += seva_arcgis.apply_results_to_layer(target_layer, payload)

        messages.addMessage("Updated %d feature(s) across %d results payload(s)." % (total_updated, len(results)))
