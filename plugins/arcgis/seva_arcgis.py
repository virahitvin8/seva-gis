# -*- coding: utf-8 -*-
"""ArcGIS side of the plugin: ArcMap 10.x (Python 2.7) and ArcGIS Pro (Python 3).

Rasters arrive as real GeoTIFF files rather than tile URLs, because that is what
ArcGIS can open, style, project and export, and because it is what a user keeps
after the session. Vector results arrive as GeoJSON and become feature classes.

Symbology is applied where the API allows it (ArcGIS Pro exposes a CIM symbol);
ArcMap adds the layer with its default symbol and the requested colour is recorded
on the layer instead. That limit is stated rather than hidden.
"""
from __future__ import print_function

import json
import os
import re
import time

try:
    import arcpy

    HAS_ARCPY = True
except ImportError:
    HAS_ARCPY = False

try:  # Python 3
    from urllib.request import urlopen
except ImportError:  # Python 2.7 (ArcMap)
    from urllib2 import urlopen

try:
    from . import seva_core
except ImportError:
    import seva_core

CACHE_DIR = os.path.join(seva_core.CONFIG_DIR, "cache")


def describe_environment():
    if not HAS_ARCPY:
        return "arcpy not available"
    return "ArcGIS Pro" if hasattr(arcpy, "mp") else "ArcMap 10.x"


def is_pro():
    return HAS_ARCPY and hasattr(arcpy, "mp")


def _safe_name(text):
    return re.sub(r"[^A-Za-z0-9_]+", "_", str(text or "seva"))[:60] or "seva"


def _ensure_cache():
    if not os.path.isdir(CACHE_DIR):
        os.makedirs(CACHE_DIR)
    return CACHE_DIR


# ------------------------------------------------------------------ area of interest
def extract_aoi(layer, use_selection=True):
    """Feature layer to a closed WGS84 ring. Returns ``(ring, name, error)``."""
    if not HAS_ARCPY or not layer:
        return None, "", "Choose a polygon feature layer first."
    try:
        description = arcpy.Describe(layer)
    except Exception as exc:
        return None, "", "Could not read that layer: %s" % exc
    shape_type = getattr(description, "shapeType", "")
    if "Polygon" not in shape_type:
        return None, "", "That layer holds %s, not polygons." % (shape_type or "unknown geometry")

    where = None
    if use_selection and getattr(description, "FIDSet", ""):
        oid_field = getattr(description, "OIDFieldName", "OBJECTID")
        where = "%s IN (%s)" % (oid_field, description.FIDSet.replace(" ", ","))

    rings = []
    try:
        with arcpy.da.SearchCursor(layer, ["SHAPE@"], where_clause=where, spatial_reference=arcpy.SpatialReference(4326)) as cursor:
            for row in cursor:
                geometry = row[0]
                if geometry is None:
                    continue
                for part in geometry:
                    ring = [[round(point.X, 8), round(point.Y, 8)] for point in part if point is not None]
                    if len(ring) >= 3:
                        rings.append(ring)
    except Exception as exc:
        return None, "", "Could not read the geometry: %s" % exc

    if not rings:
        return None, "", "No polygon found in that layer."
    rings.sort(key=len, reverse=True)
    name = os.path.basename(str(layer))
    return rings[0], name, None


# ------------------------------------------------------------------ rasters
def download_file(url, name, extension=".tif"):
    """Save a short-lived service download to the local cache. Returns ``(path, error)``.

    Earth Engine links expire, so this is called immediately after the export request.
    """
    if not url:
        return None, "The service did not return a download link."
    safe = _safe_name(name)
    path = os.path.join(_ensure_cache(), "%s_%s%s" % (safe, time.strftime("%Y%m%d-%H%M%S"), extension))
    try:
        handle = open(path, "wb")
        try:
            response_handle = urlopen(url, timeout=300)
            while True:
                chunk = response_handle.read(1024 * 256)
                if not chunk:
                    break
                handle.write(chunk)
            response_handle.close()
        finally:
            handle.close()
    except Exception as exc:
        return None, "Could not download the file: %s" % exc
    if not os.path.getsize(path):
        return None, "The downloaded file was empty."
    return path, None


def fetch_geotiff(config, payload, label="seva-export"):
    """Ask the service for a GeoTIFF and save it locally. Returns ``(path, name, error)``."""
    response = seva_core.plan_request(config, "/api/earth-engine/export", payload, timeout=300)
    name = "%s_%s" % (label, response.get("product") or "raster")
    path, error = download_file(response.get("downloadUrl") or "", name)
    if error:
        return None, "", error
    return path, _safe_name(name), None


def add_raster(path, name=None):
    """Add a raster file to the open map. Returns ``(layer_name, error)``."""
    if not HAS_ARCPY:
        return None, "arcpy not available"
    if not os.path.exists(path):
        return None, "File not found: %s" % path
    try:
        if is_pro():
            project = arcpy.mp.ArcGISProject("CURRENT")
            active_map = project.activeMap
            if active_map is None:
                return None, "No map is open in this project."
            layer = active_map.addDataFromPath(path)
            if name and layer is not None:
                try:
                    layer.name = name
                except Exception:
                    pass
            return (layer.name if layer is not None else os.path.basename(path)), None
        document = arcpy.mapping.MapDocument("CURRENT")
        frame = arcpy.mapping.ListDataFrames(document)[0]
        layer = arcpy.mapping.Layer(path)
        arcpy.mapping.AddLayer(frame, layer, "TOP")
        arcpy.RefreshActiveView()
        return layer.name, None
    except Exception as exc:
        return None, "Could not add the raster: %s" % exc


# ------------------------------------------------------------------ vectors
def add_vector(feature_collection, name, style=None):
    """GeoJSON to a feature class, added to the map and coloured where possible."""
    if not HAS_ARCPY:
        return None, "arcpy not available"
    features = (feature_collection or {}).get("features") or []
    if not features:
        return None, "The service found nothing to draw for '%s'." % name

    safe = _safe_name(name)
    geojson_path = os.path.join(_ensure_cache(), "%s_%s.geojson" % (safe, time.strftime("%Y%m%d-%H%M%S")))
    with open(geojson_path, "w") as handle:
        json.dump(feature_collection, handle)

    workspace = _ensure_cache() if is_pro() else "in_memory"
    if is_pro():
        output = os.path.join(workspace, "%s_%s.shp" % (safe, time.strftime("%H%M%S")))
    else:
        output = os.path.join(workspace, safe)
    try:
        arcpy.conversion.JSONToFeatures(geojson_path, output)
    except Exception:
        try:
            arcpy.JSONToFeatures_conversion(geojson_path, output)
        except Exception as exc:
            return None, "Could not convert the returned shapes: %s" % exc

    try:
        if is_pro():
            project = arcpy.mp.ArcGISProject("CURRENT")
            active_map = project.activeMap
            layer = active_map.addDataFromPath(output)
            if layer is not None:
                layer.name = name
                _apply_pro_symbology(layer, style)
            added = layer.name if layer is not None else output
        else:
            document = arcpy.mapping.MapDocument("CURRENT")
            frame = arcpy.mapping.ListDataFrames(document)[0]
            layer = arcpy.mapping.Layer(output)
            layer.name = name
            arcpy.mapping.AddLayer(frame, layer, "TOP")
            arcpy.RefreshActiveView()
            added = layer.name
    except Exception as exc:
        return None, "Made the shapes but could not add them to the map: %s" % exc
    return added, None


def _apply_pro_symbology(layer, style):
    """Best effort: ArcGIS Pro exposes the symbol through its CIM symbology object."""
    style = style or {}
    try:
        red, green, blue = _rgb(style.get("color"))
        symbology = layer.symbology
        symbol = symbology.renderer.symbol
        symbol.color = {"RGB": [red, green, blue, 100]}
        if "fill" in style and not style.get("fill", True):
            symbol.color = {"RGB": [0, 0, 0, 0]}
            symbol.outlineColor = {"RGB": [red, green, blue, 100]}
        layer.symbology = symbology
    except Exception:
        pass  # symbol editing varies by version; adding the layer still succeeded


def _rgb(value):
    text = str(value or "#e31a1c").strip().lstrip("#")
    if len(text) != 6:
        text = "e31a1c"
    try:
        return int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16)
    except ValueError:
        return 227, 26, 28


# ------------------------------------------------------------------ view
def zoom_to_ring(ring):
    """Move the open map to the area of interest."""
    if not HAS_ARCPY or not ring:
        return
    try:
        lons = [point[0] for point in ring]
        lats = [point[1] for point in ring]
        rectangle = arcpy.Extent(min(lons), min(lats), max(lons), max(lats), spatial_reference=arcpy.SpatialReference(4326))
        if is_pro():
            project = arcpy.mp.ArcGISProject("CURRENT")
            view = project.activeView
            if view is not None and hasattr(view, "camera"):
                view.camera.setExtent(rectangle)
                view.refresh()
        else:
            document = arcpy.mapping.MapDocument("CURRENT")
            frame = arcpy.mapping.ListDataFrames(document)[0]
            frame.extent = rectangle
            arcpy.RefreshActiveView()
    except Exception:
        pass
