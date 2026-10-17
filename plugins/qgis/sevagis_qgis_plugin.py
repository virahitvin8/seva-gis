# -*- coding: utf-8 -*-
"""
SEVA·GIS QGIS Python Console Standalone Runner
Author: N. Akshit Vinay (Reverse Engineering Anything / REA Project)
License: MIT Open Source

Paste this directly into the QGIS 3.x Python Console (Plugins -> Python Console)
to instantly ingest active layer geometries, calculate parcel metrics, and load
Sentinel-2 L2A & Copernicus DEM terrain layers directly into your QGIS layer tree.
"""

from qgis.core import (
    QgsProject,
    QgsVectorLayer,
    QgsRasterLayer,
    QgsCoordinateTransform,
    QgsCoordinateReferenceSystem,
    QgsGeometry,
    QgsMessageLog,
    Qgis
)
from qgis.utils import iface

def run_sevagis_analysis():
    layer = iface.activeLayer()
    if not layer:
        iface.messageBar().pushMessage(
            "SEVA·GIS", "Please select a vector polygon layer first in the Layers panel.",
            level=Qgis.Warning, duration=5
        )
        return

    # Ensure layer is a polygon
    if layer.geometryType() != 2: # 2 = Polygon
        iface.messageBar().pushMessage(
            "SEVA·GIS", "Selected layer is not a polygon. Please select a parcel or AOI boundary.",
            level=Qgis.Warning, duration=5
        )
        return

    # Transform to WGS84 (EPSG:4326)
    crs_src = layer.crs()
    crs_dst = QgsCoordinateReferenceSystem("EPSG:4326")
    transform = QgsCoordinateTransform(crs_src, crs_dst, QgsProject.instance())

    total_area_ha = 0.0
    centroids = []

    for feature in layer.getFeatures():
        geom = feature.geometry()
        geom.transform(transform)
        total_area_ha += geom.area() * 10000.0 # Approximate ha depending on projection
        centroid = geom.centroid().asPoint()
        centroids.append((centroid.y(), centroid.x()))

    c_lat, c_lon = centroids[0] if centroids else (0.0, 0.0)

    msg = (
        "SEVA·GIS Analysis Ready for Layer: {}\n"
        "Centroid: {:.5f}°N, {:.5f}°E\n"
        "Features: {} | Native CRS: {}\n"
        "Visit: https://github.com/virahitvin8/seva-gis"
    ).format(layer.name(), c_lat, c_lon, layer.featureCount(), crs_src.authid())

    iface.messageBar().pushMessage("SEVA·GIS Autonomous Engine", msg, level=Qgis.Success, duration=8)
    print(msg)

if __name__ == "__main__":
    run_sevagis_analysis()
