# -*- coding: utf-8 -*-
"""Shared ArcGIS helpers for the SEVA.GIS desktop link (ArcMap 10.x + ArcGIS Pro). Python 2.7 & 3 compatible."""
from __future__ import print_function
import json
import os
import sys

try:
    import arcpy
    HAS_ARCPY = True
except ImportError:
    HAS_ARCPY = False

try:
    from . import seva_core
except ImportError:
    import seva_core


def get_arcpy_field_type(ftype):
    if ftype == "text":
        return "TEXT"
    elif ftype == "float":
        return "DOUBLE"
    elif ftype == "int":
        return "SHORT"
    return "TEXT"


def ensure_layer_fields(layer):
    """Ensure layer has seva_id and all RESULT_FIELDS defined in seva_core."""
    if not HAS_ARCPY or not layer:
        return False

    existing = set(f.name.lower() for f in arcpy.ListFields(layer))

    # Check seva_id
    id_name, id_type, id_len = seva_core.ID_FIELD
    if id_name.lower() not in existing:
        arcpy.AddField_management(layer, id_name, get_arcpy_field_type(id_type), field_length=id_len)

    # Check result fields (all <= 10 chars for shapefile safety)
    for name, ftype, flen in seva_core.RESULT_FIELDS:
        if name.lower() not in existing:
            if flen > 0:
                arcpy.AddField_management(layer, name, get_arcpy_field_type(ftype), field_length=flen)
            else:
                arcpy.AddField_management(layer, name, get_arcpy_field_type(ftype))

    return True


def geom_to_geojson_coords(geom):
    """Convert an arcpy Polygon geometry into GeoJSON coordinates [[[lon, lat], ...]]."""
    coords = []
    for part in geom:
        ring = []
        for pt in part:
            if pt:
                ring.append([round(pt.X, 6), round(pt.Y, 6)])
        if len(ring) >= 3:
            # Ensure closed ring
            if ring[0] != ring[-1]:
                ring.append(ring[0])
            coords.append(ring)
    return coords


def extract_features(layer, name_field="", crop_field="", default_crop="Paddy (Rice)"):
    """
    Extract polygons from layer reprojected to EPSG:4326 (WGS84),
    ensuring seva_id is assigned, and returning a GeoJSON feature list.
    """
    if not HAS_ARCPY or not layer:
        return []

    ensure_layer_fields(layer)
    sr_wgs84 = arcpy.SpatialReference(4326)

    # Determine which fields exist in layer
    field_names = [f.name for f in arcpy.ListFields(layer)]
    has_name = bool(name_field and name_field in field_names)
    has_crop = bool(crop_field and crop_field in field_names)

    cols = ["OID@", "SHAPE@", "seva_id"]
    if has_name:
        cols.append(name_field)
    if has_crop:
        cols.append(crop_field)

    features = []
    rows_to_assign_id = []

    with arcpy.da.SearchCursor(layer, cols, spatial_reference=sr_wgs84) as cursor:
        for row in cursor:
            oid = row[0]
            geom = row[1]
            sid = row[2]

            if not geom or geom.type.lower() != "polygon":
                continue

            coords = geom_to_geojson_coords(geom)
            if not coords:
                continue

            if not sid or str(sid).strip() == "" or str(sid).lower() == "none":
                sid = seva_core.new_id()
                rows_to_assign_id.append((oid, sid))

            idx = 3
            p_name = ""
            if has_name:
                p_name = str(row[idx]) if row[idx] is not None else ""
                idx += 1
            if not p_name:
                p_name = str(layer) + " #" + str(oid)

            p_crop = default_crop or "Paddy (Rice)"
            if has_crop:
                val = row[idx]
                if val is not None and str(val).strip():
                    p_crop = str(val)

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon" if len(coords) == 1 else "MultiPolygon",
                    "coordinates": coords[0] if len(coords) == 1 else coords
                },
                "properties": {
                    "seva_id": str(sid),
                    "name": p_name,
                    "crop": p_crop
                }
            })

    # Update assigned IDs if any were missing
    if rows_to_assign_id:
        id_dict = dict(rows_to_assign_id)
        with arcpy.da.UpdateCursor(layer, ["OID@", "seva_id"]) as ucursor:
            for urow in ucursor:
                if urow[0] in id_dict:
                    urow[1] = id_dict[urow[0]]
                    ucursor.updateRow(urow)

    return features


def apply_results_to_layer(layer, payload):
    """Apply results from seva-exchange v1 payload to matching layer features via seva_id."""
    if not HAS_ARCPY or not layer:
        return 0

    idx = seva_core.results_index(payload)
    if not idx:
        return 0

    ensure_layer_fields(layer)
    existing_fields = [f.name.lower() for f in arcpy.ListFields(layer)]

    cols = ["seva_id"]
    active_field_names = []
    for f in seva_core.FIELD_NAMES:
        if f.lower() in existing_fields:
            cols.append(f)
            active_field_names.append(f)

    updated_count = 0
    with arcpy.da.UpdateCursor(layer, cols) as cursor:
        for row in cursor:
            sid = str(row[0]) if row[0] is not None else ""
            if sid in idx:
                record = idx[sid]
                row_list = list(row)
                for i, fname in enumerate(active_field_names):
                    if fname in record:
                        row_list[i + 1] = record[fname]
                cursor.updateRow(row_list)
                updated_count += 1

    return updated_count
