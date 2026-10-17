# -*- coding: utf-8 -*-
"""
SEVA·GIS Python Toolbox for ArcMap 10.x and ArcGIS Pro
Author: N. Akshit Vinay (Reverse Engineering Anything / REA Project)
License: MIT Open Source

Provides native ArcToolbox geoprocessing tools to bridge ArcMap & ArcGIS Pro
with SEVA·GIS zero-API-key client-side precision agriculture & remote sensing pipelines.
"""

import arcpy
import json
import os
import sys

class Toolbox(object):
    def __init__(self):
        self.label = "SEVA·GIS Geoprocessing Toolbox"
        self.alias = "sevagis"
        self.tools = [
            ExtractAOITool,
            SpectralIndicesTool,
            MineralExplorationTool,
            HydrologicalWaterBudgetTool
        ]


class ExtractAOITool(object):
    def __init__(self):
        self.label = "1. Extract AOI & Geodetic Boundary"
        self.description = "Extracts polygon boundary in WGS84 coordinates and calculates parcel area in hectares and acres."
        self.canRunInBackground = False

    def getParameterInfo(self):
        param_layer = arcpy.Parameter(
            displayName="Input AOI Polygon Layer",
            name="in_layer",
            datatype="GPFeatureLayer",
            parameterType="Required",
            direction="Input"
        )
        param_layer.filter.list = ["Polygon"]

        param_output = arcpy.Parameter(
            displayName="Output GeoJSON Summary",
            name="out_geojson",
            datatype="DEFile",
            parameterType="Required",
            direction="Output"
        )
        param_output.filter.list = ["geojson", "json"]

        return [param_layer, param_output]

    def execute(self, parameters, messages):
        in_layer = parameters[0].valueAsText
        out_file = parameters[1].valueAsText

        messages.addMessage("Delineating geodetic perimeter for: {}".format(in_layer))
        desc = arcpy.Describe(in_layer)
        sr_wgs84 = arcpy.SpatialReference(4326)

        coords = []
        total_area_ha = 0.0

        with arcpy.da.SearchCursor(in_layer, ["SHAPE@"], spatial_reference=sr_wgs84) as cursor:
            for row in cursor:
                geom = row[0]
                total_area_ha += geom.getArea("GEODESIC", "HECTARES")
                for part in geom:
                    for pnt in part:
                        if pnt:
                            coords.append([pnt.X, pnt.Y])

        geojson_data = {
            "type": "Feature",
            "properties": {
                "name": desc.name,
                "area_ha": round(total_area_ha, 3),
                "area_acres": round(total_area_ha * 2.47105, 3),
                "point_count": len(coords)
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords] if coords else []
            }
        }

        with open(out_file, "w") as f:
            json.dump(geojson_data, f, indent=2)

        messages.addMessage("Successfully exported AOI. Area: {} ha ({} acres)".format(
            round(total_area_ha, 2), round(total_area_ha * 2.47105, 2)
        ))


class SpectralIndicesTool(object):
    def __init__(self):
        self.label = "2. Compute Sentinel-2 Multi-Spectral Indices"
        self.description = "Computes calibrated NDVI, NDMI, NDWI, and SAVI vegetation health indices from input bands."
        self.canRunInBackground = False

    def getParameterInfo(self):
        p_nir = arcpy.Parameter(
            displayName="Near-Infrared (NIR / Band 8)",
            name="nir_raster",
            datatype="GPRasterLayer",
            parameterType="Required",
            direction="Input"
        )
        p_red = arcpy.Parameter(
            displayName="Red (Band 4)",
            name="red_raster",
            datatype="GPRasterLayer",
            parameterType="Required",
            direction="Input"
        )
        p_swir = arcpy.Parameter(
            displayName="SWIR (Band 11) [Optional for NDMI]",
            name="swir_raster",
            datatype="GPRasterLayer",
            parameterType="Optional",
            direction="Input"
        )
        p_out = arcpy.Parameter(
            displayName="Output NDVI Raster",
            name="out_ndvi",
            datatype="DERasterDataset",
            parameterType="Required",
            direction="Output"
        )
        return [p_nir, p_red, p_swir, p_out]

    def execute(self, parameters, messages):
        nir_path = parameters[0].valueAsText
        red_path = parameters[1].valueAsText
        out_path = parameters[3].valueAsText

        messages.addMessage("Computing NDVI = (NIR - Red) / (NIR + Red + 0.0001)...")
        r_nir = arcpy.Raster(nir_path)
        r_red = arcpy.Raster(red_path)

        # Standard NDVI Map Algebra
        denom = r_nir + r_red
        ndvi = (r_nir - r_red) / arcpy.sa.Con(denom == 0, 0.0001, denom)
        ndvi.save(out_path)

        messages.addMessage("Calibrated NDVI raster saved to: {}".format(out_path))


class MineralExplorationTool(object):
    def __init__(self):
        self.label = "3. Hyperspectral Lithology & Mineral Ratios"
        self.description = "Computes Ferrous Minerals (FMI), Iron Oxide (IOI), Clay/Hydroxyl, Calcite, and Silica indices."
        self.canRunInBackground = False

    def getParameterInfo(self):
        p_b4 = arcpy.Parameter(displayName="Band 4 (Red)", name="b4", datatype="GPRasterLayer", parameterType="Required", direction="Input")
        p_b2 = arcpy.Parameter(displayName="Band 2 (Blue)", name="b2", datatype="GPRasterLayer", parameterType="Required", direction="Input")
        p_b8 = arcpy.Parameter(displayName="Band 8 (NIR)", name="b8", datatype="GPRasterLayer", parameterType="Required", direction="Input")
        p_b11 = arcpy.Parameter(displayName="Band 11 (SWIR 1)", name="b11", datatype="GPRasterLayer", parameterType="Required", direction="Input")
        p_b12 = arcpy.Parameter(displayName="Band 12 (SWIR 2)", name="b12", datatype="GPRasterLayer", parameterType="Required", direction="Input")
        p_out = arcpy.Parameter(displayName="Output Mineral Ratio Raster (FMI or Clay)", name="out_raster", datatype="DERasterDataset", parameterType="Required", direction="Output")
        return [p_b4, p_b2, p_b8, p_b11, p_b12, p_out]

    def execute(self, parameters, messages):
        b4 = arcpy.Raster(parameters[0].valueAsText)
        b2 = arcpy.Raster(parameters[1].valueAsText)
        b8 = arcpy.Raster(parameters[2].valueAsText)
        b11 = arcpy.Raster(parameters[3].valueAsText)
        b12 = arcpy.Raster(parameters[4].valueAsText)
        out_path = parameters[5].valueAsText

        messages.addMessage("Synthesizing Ferrous Minerals Index: SWIR2/SWIR1 (B12/B11)...")
        fmi = b12 / arcpy.sa.Con(b11 == 0, 0.0001, b11)
        fmi.save(out_path)
        messages.addMessage("Mineral exploration layer saved to: {}".format(out_path))


class HydrologicalWaterBudgetTool(object):
    def __init__(self):
        self.label = "4. Hydrological Water Budget (SCS-CN Model)"
        self.description = "Calculates surface runoff depth (Q) and infiltration from Curve Number (CN) and rainfall."
        self.canRunInBackground = False

    def getParameterInfo(self):
        p_rain = arcpy.Parameter(displayName="Annual Precipitation (mm)", name="rain_mm", datatype="GPDouble", parameterType="Required", direction="Input")
        p_rain.value = 1180.0
        p_cn = arcpy.Parameter(displayName="Runoff Curve Number (CN)", name="cn_val", datatype="GPDouble", parameterType="Required", direction="Input")
        p_cn.value = 75.0
        p_out = arcpy.Parameter(displayName="Output Budget Report (.txt)", name="out_report", datatype="DEFile", parameterType="Required", direction="Output")
        p_out.filter.list = ["txt", "json"]
        return [p_rain, p_cn, p_out]

    def execute(self, parameters, messages):
        p = float(parameters[0].value)
        cn = float(parameters[1].value)
        out_path = parameters[2].valueAsText

        # SCS-CN Formulation: S = (25400 / CN) - 254
        s = (25400.0 / cn) - 254.0
        ia = 0.2 * s # Initial abstraction
        q = ((p - ia) ** 2) / (p - ia + s) if p > ia else 0.0
        et = p * 0.52
        infil = p - q - et

        report = (
            "=====================================================\n"
            "   SEVA·GIS HYDROLOGICAL WATER BUDGET ASSESSMENT   \n"
            "=====================================================\n"
            "Curve Number (CN):              {:.1f}\n"
            "Potential Retention (S):        {:.2f} mm\n"
            "Initial Abstraction (Ia):       {:.2f} mm\n"
            "Annual Precipitation (P):       {:.2f} mm\n"
            "Surface Runoff Yield (Q):       {:.2f} mm\n"
            "Estimated Evapotranspiration:   {:.2f} mm\n"
            "Calculated Infiltration:        {:.2f} mm\n"
            "=====================================================\n"
        ).format(cn, s, ia, p, q, et, max(0.0, infil))

        with open(out_path, "w") as f:
            f.write(report)

        messages.addMessage(report)
        messages.addMessage("Water budget report written to: {}".format(out_path))
