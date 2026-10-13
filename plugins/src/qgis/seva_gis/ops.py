# -*- coding: utf-8 -*-
"""
SEVA·GIS QGIS Operations Module
Handles layer editing, field mapping, CRS transformations, geometry export, and results merging.
"""
from __future__ import print_function
import json
import os
import sys

try:
    from qgis.PyQt.QtCore import QVariant
    from qgis.core import (
        QgsCoordinateReferenceSystem,
        QgsCoordinateTransform,
        QgsFeature,
        QgsField,
        QgsGeometry,
        QgsMessageLog,
        QgsProject,
        QgsRasterLayer,
        QgsVectorLayer,
        QgsWkbTypes,
        Qgis,
    )
    HAS_QGIS = True
except ImportError:
    HAS_QGIS = False

# Import local or parent seva_core
try:
    from . import seva_core
except ImportError:
    import seva_core


def get_field_type(type_str):
    """Maps seva_core field spec to QVariant type."""
    if not HAS_QGIS:
        return None
    if type_str == "text":
        return QVariant.String
    elif type_str == "float":
        return QVariant.Double
    elif type_str == "int":
        return QVariant.Int
    return QVariant.String


def ensure_layer_fields(layer):
    """Ensure layer has seva_id and all RESULT_FIELDS defined in seva_core."""
    if not HAS_QGIS or not layer or not layer.isEditable() and not layer.startEditing():
        return False

    existing_names = set(field.name() for field in layer.fields())
    fields_to_add = []

    # Check seva_id
    id_name, id_type, id_len = seva_core.ID_FIELD
    if id_name not in existing_names:
        fields_to_add.append(QgsField(id_name, get_field_type(id_type), len=id_len))

    # Check result fields (all <= 10 chars for shapefile safety)
    for name, ftype, flen in seva_core.RESULT_FIELDS:
        if name not in existing_names:
            if flen > 0:
                fields_to_add.append(QgsField(name, get_field_type(ftype), len=flen))
            else:
                fields_to_add.append(QgsField(name, get_field_type(ftype)))

    if fields_to_add:
        layer.addAttributes(fields_to_add)
        layer.updateFields()

    return True


def transform_geometry_to_wgs84(geom, source_crs):
    """Transform geometry to EPSG:4326 (WGS84)."""
    if not HAS_QGIS or not geom:
        return geom
    dest_crs = QgsCoordinateReferenceSystem("EPSG:4326")
    if source_crs == dest_crs:
        return geom
    transform = QgsCoordinateTransform(source_crs, dest_crs, QgsProject.instance())
    geom_wgs = QgsGeometry(geom)
    geom_wgs.transform(transform)
    return geom_wgs


def extract_features(layer, selected_only=True, name_field="", crop_field="", default_crop="Paddy (Rice)"):
    """
    Extract polygons from layer, reprojection to EPSG:4326, generate/assign seva_id,
    and return GeoJSON Feature list formatted for seva-exchange v1.
    """
    if not HAS_QGIS or not layer:
        return []

    ensure_layer_fields(layer)
    features_to_process = layer.selectedFeatures() if (selected_only and layer.selectedFeatureCount() > 0) else layer.getFeatures()
    source_crs = layer.crs()
    geojson_features = []
    id_idx = layer.fields().indexOf(seva_core.ID_FIELD[0])
    layer_editable = layer.isEditable()
    if not layer_editable:
        layer.startEditing()

    for feat in features_to_process:
        geom = feat.geometry()
        if not geom or geom.isEmpty():
            continue

        # Check geometry type (Polygon or MultiPolygon)
        if geom.type() != QgsWkbTypes.PolygonGeometry:
            continue

        # Fix any invalid geometry
        if not geom.isGeosValid():
            fixed = geom.makeValid()
            if not fixed.isEmpty():
                geom = fixed

        wgs_geom = transform_geometry_to_wgs84(geom, source_crs)
        geom_json = json.loads(wgs_geom.asJson())

        # Ensure unique seva_id
        current_id = feat.attribute(seva_core.ID_FIELD[0])
        if not current_id or str(current_id).strip() == "" or current_id == QVariant():
            current_id = seva_core.new_id()
            if id_idx >= 0:
                layer.changeAttributeValue(feat.id(), id_idx, current_id)

        # Build feature properties
        props = {"seva_id": str(current_id)}
        if name_field and layer.fields().indexOf(name_field) >= 0:
            val = feat.attribute(name_field)
            if val is not None and val != QVariant():
                props["name"] = str(val)
        else:
            props["name"] = layer.name() + " #" + str(feat.id())

        if crop_field and layer.fields().indexOf(crop_field) >= 0:
            val = feat.attribute(crop_field)
            if val is not None and val != QVariant():
                props["crop"] = str(val)
        else:
            props["crop"] = default_crop or "Paddy (Rice)"

        geojson_features.append({
            "type": "Feature",
            "geometry": geom_json,
            "properties": props
        })

    if not layer_editable and layer.isEditable():
        layer.commitChanges()

    return geojson_features


def apply_results_to_layer(layer, payload):
    """
    Apply results from seva-exchange v1 payload to matching layer features via seva_id.
    """
    if not HAS_QGIS or not layer:
        return 0

    idx = seva_core.results_index(payload)
    if not idx:
        return 0

    ensure_layer_fields(layer)
    if not layer.isEditable():
        layer.startEditing()

    field_map = {}
    for name in seva_core.FIELD_NAMES:
        col = layer.fields().indexOf(name)
        if col >= 0:
            field_map[name] = col

    id_col = layer.fields().indexOf(seva_core.ID_FIELD[0])
    updated_count = 0

    for feat in layer.getFeatures():
        fid_val = feat.attribute(id_col)
        if fid_val and str(fid_val) in idx:
            record = idx[str(fid_val)]
            for k, v in record.items():
                if k in field_map:
                    layer.changeAttributeValue(feat.id(), field_map[k], v)
            updated_count += 1

    layer.commitChanges()
    return updated_count


def load_exchange_layers(folder):
    """
    Check exchange folder for layers and rasters, adding newly generated files to QGIS project.
    """
    if not HAS_QGIS or not folder or not os.path.isdir(folder):
        return []

    dirs = seva_core.exchange_dirs(folder)
    added = []

    # Check vector layers
    layers_dir = dirs["layers"]
    if os.path.isdir(layers_dir):
        for fname in os.listdir(layers_dir):
            if fname.endswith(".geojson") or fname.endswith(".gpkg"):
                path = os.path.join(layers_dir, fname)
                vlayer = QgsVectorLayer(path, os.path.splitext(fname)[0], "ogr")
                if vlayer.isValid():
                    QgsProject.instance().addMapLayer(vlayer)
                    added.append(fname)

    # Check raster outputs
    rasters_dir = dirs["rasters"]
    if os.path.isdir(rasters_dir):
        for fname in os.listdir(rasters_dir):
            if fname.endswith(".tif") or fname.endswith(".tiff"):
                path = os.path.join(rasters_dir, fname)
                rlayer = QgsRasterLayer(path, os.path.splitext(fname)[0])
                if rlayer.isValid():
                    QgsProject.instance().addMapLayer(rlayer)
                    added.append(fname)

    return added
