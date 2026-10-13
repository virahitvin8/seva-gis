# -*- coding: utf-8 -*-
"""QGIS side of the plugin: read the area of interest, and put results on the map.

Everything here is deliberate about two things:

* the area of interest is reprojected to WGS84 ``[lon, lat]`` before it leaves the
  machine, because that is what the service expects and what satellite imagery uses;
* layers are added in reverse so the legend reads top to bottom in the same order
  as the query boxes, which is the order the user arranged.
"""
from __future__ import print_function

import json

try:
    from qgis.PyQt import QtCore, QtWidgets
    from qgis.PyQt.QtCore import QVariant
    from qgis.core import (
        QgsCoordinateReferenceSystem,
        QgsCoordinateTransform,
        QgsFeature,
        QgsField,
        QgsFillSymbol,
        QgsGeometry,
        QgsLineSymbol,
        QgsProject,
        QgsRasterLayer,
        QgsRectangle,
        QgsVectorLayer,
        QgsWkbTypes,
    )

    HAS_QGIS = True
except ImportError:  # keeps the module importable for tooling and tests
    HAS_QGIS = False

WGS84 = "EPSG:4326"
FIELD_TYPE_NAMES = {QVariant.Int: "int", QVariant.Double: "double", QVariant.String: "string"} if HAS_QGIS else {}


# ------------------------------------------------------------------ area of interest
def polygon_layers(project=None):
    """Polygon layers currently open, in legend order."""
    if not HAS_QGIS:
        return []
    project = project or QgsProject.instance()
    return [
        layer
        for layer in project.mapLayers().values()
        if layer.type() == layer.VectorLayer and layer.geometryType() == QgsWkbTypes.PolygonGeometry
    ]


def extract_aoi(layer, selected_only=True):
    """Polygon layer to a closed WGS84 ring. Returns ``(ring, name, error)``.

    When several features are selected the largest ring is used, so "my area" means
    one area rather than a stack of overlapping ones.
    """
    if not HAS_QGIS or layer is None:
        return None, "", "No area selected. Choose a polygon layer or paste coordinates."
    if layer.geometryType() != QgsWkbTypes.PolygonGeometry:
        return None, "", "That layer is not a polygon layer."

    features = layer.selectedFeatures() if (selected_only and layer.selectedFeatureCount() > 0) else layer.getFeatures()
    ring = None
    for feature in features:
        geometry = feature.geometry()
        if geometry is None or geometry.isEmpty():
            continue
        if not geometry.isGeosValid():
            repaired = geometry.makeValid()
            if repaired is not None and not repaired.isEmpty():
                geometry = repaired
        transformed = _to_wgs84(geometry, layer.crs())
        if transformed is None:
            continue
        for candidate in _rings(transformed):
            if ring is None or len(candidate) > len(ring):
                ring = candidate

    if not ring or len(ring) < 3:
        return None, "", "No usable polygon found in that layer."
    return ring, layer.name(), None


def _to_wgs84(geometry, source_crs):
    destination = QgsCoordinateReferenceSystem(WGS84)
    if not source_crs or source_crs == destination:
        return geometry
    geometry = QgsGeometry(geometry)
    transform = QgsCoordinateTransform(source_crs, destination, QgsProject.instance())
    geometry.transform(transform)
    return geometry


def _rings(geometry):
    """Every exterior ring of a geometry, in WGS84."""
    try:
        raw = json.loads(geometry.asJson())
    except (ValueError, TypeError, AttributeError):
        return []
    polygons = []
    if raw.get("type") == "Polygon":
        polygons = [raw.get("coordinates") or []]
    elif raw.get("type") == "MultiPolygon":
        polygons = raw.get("coordinates") or []
    rings = []
    for polygon in polygons:
        if polygon and len(polygon[0]) >= 3:
            rings.append([[round(float(x), 8), round(float(y), 8)] for x, y in polygon[0]])
    rings.sort(key=len, reverse=True)
    return rings


def parse_coordinates(text):
    """Parse pasted coordinates into a ring.

    Accepts the shapes people actually paste: one ``lon,lat`` per line, or all pairs
    on one line separated by spaces or semicolons.
    """
    if not text:
        return None, "Paste coordinates first, one lon,lat per line."
    cleaned = text.replace(";", "\n").replace("\t", "\n").replace("\n", " ")
    ring = []
    for chunk in cleaned.split():
        parts = chunk.split(",")
        if len(parts) < 2:
            continue
        try:
            lon = float(parts[0].strip())
            lat = float(parts[1].strip())
        except ValueError:
            continue
        if abs(lon) > 180 or abs(lat) > 90:
            return None, "Coordinates must be longitude, latitude in WGS84."
        ring.append([round(lon, 8), round(lat, 8)])
    if len(ring) < 3:
        return None, "A polygon needs at least three coordinate pairs."
    return ring, None


# ------------------------------------------------------------------ building layers
def _qt_color(value, alpha=255):
    """'#rrggbb' to the 'r,g,b,a' string QGIS symbol properties expect."""
    text = str(value or "#e31a1c").strip().lstrip("#")
    if len(text) != 6:
        text = "e31a1c"
    try:
        red, green, blue = (int(text[index : index + 2], 16) for index in (0, 2, 4))
    except ValueError:
        red, green, blue = 227, 26, 28
    return "%d,%d,%d,%d" % (red, green, blue, alpha)


def _field_type(values):
    numeric = [value for value in values if isinstance(value, (int, float)) and not isinstance(value, bool)]
    if not numeric:
        return QVariant.String
    if all(float(value).is_integer() for value in numeric):
        return QVariant.Int
    return QVariant.Double


def vector_layer(name, feature_collection, style):
    """Build an in-memory layer from returned GeoJSON, styled as asked."""
    features = (feature_collection or {}).get("features") or []
    if not features:
        return None, "The service found nothing to draw for '%s'." % name

    geometry_types = set(
        ((feature.get("geometry") or {}).get("type")) or "" for feature in features
    )
    geometry_types.discard("")
    polygon_family = any("Polygon" in geometry_type for geometry_type in geometry_types)
    if polygon_family:
        wkb = "MultiPolygon" if "MultiPolygon" in geometry_types else "Polygon"
    else:
        wkb = "MultiLineString" if "MultiLineString" in geometry_types else "LineString"

    keys = []
    for feature in features:
        for key in (feature.get("properties") or {}):
            if key not in keys:
                keys.append(key)
    fields = [
        QgsField(key, _field_type([(feature.get("properties") or {}).get(key) for feature in features]))
        for key in keys
    ]

    uri = "%s?crs=%s" % (wkb, WGS84)
    for field in fields:
        uri += "&field=%s:%s" % (field.name(), FIELD_TYPE_NAMES.get(field.type(), "string"))

    layer = QgsVectorLayer(uri, name, "memory")
    if not layer.isValid():
        return None, "Could not create a layer for '%s'." % name
    layer.dataProvider().addAttributes(fields)
    layer.updateFields()

    new_features = []
    for feature in features:
        created = QgsFeature(layer.fields())
        geometry = QgsGeometry.fromGeoJson(json.dumps(feature.get("geometry") or {}))
        if geometry is None or geometry.isEmpty():
            continue
        created.setGeometry(geometry)
        properties = feature.get("properties") or {}
        values = []
        for field in layer.fields():
            value = properties.get(field.name())
            if value is None:
                values.append(None)
            elif field.type() == QVariant.String:
                values.append(str(value))
            else:
                try:
                    values.append(float(value) if field.type() == QVariant.Double else int(float(value)))
                except (TypeError, ValueError):
                    values.append(None)
        created.setAttributes(values)
        new_features.append(created)

    if not new_features:
        return None, "No usable geometry came back for '%s'." % name
    layer.dataProvider().addFeatures(new_features)
    layer.updateExtents()
    apply_style(layer, style)
    return layer, None


def apply_style(layer, style):
    style = style or {}
    color = _qt_color(style.get("color"), 255)
    width = str(style.get("width", 2))
    if layer.geometryType() == QgsWkbTypes.PolygonGeometry:
        fill = style.get("fill", True)
        properties = {
            "outline_color": color,
            "outline_width": width,
            "color": color if fill else "0,0,0,0",
        }
        if fill:
            properties["style"] = "solid"
        symbol = QgsFillSymbol.createSimple(properties)
    else:
        symbol = QgsLineSymbol.createSimple({"color": color, "width": width, "line_style": "solid"})
    try:
        layer.renderer().setSymbol(symbol)
    except (AttributeError, TypeError):
        pass
    layer.triggerRepaint()
    return layer


def xyz_layer(name, tile_url):
    """A live raster layer that pulls XYZ tiles straight from the service.

    Nothing is copied into the project, so the layer stays current and costs no disk
    space. The URL is percent-encoded, which the ``{z}/{x}/{y}`` placeholders need.
    """
    if not tile_url:
        return None, "The service did not return a tile URL for '%s'." % name
    try:
        from urllib.parse import quote
    except ImportError:  # Python 2
        from urllib import quote
    uri = "type=xyz&url=%s&zmin=0&zmax=19" % quote(tile_url, safe=":/{}?=&,+")
    layer = QgsRasterLayer(uri, name, "wms")
    if not layer.isValid():
        return None, "The service did not return a usable tile layer for '%s'." % name
    layer.setCrs(QgsCoordinateReferenceSystem("EPSG:3857"))
    return layer, None


def _describe(name, meta):
    """Fold the source and the dates into the legend name, so a screenshot explains itself."""
    notes = [str(meta.get(key)) for key in ("source", "startDate", "endDate") if meta.get(key)]
    return "%s [%s]" % (name, " ".join(notes)) if notes else name


def prepare(result):
    """Turn a service result into ready-to-add QGIS layers, keeping the box order."""
    prepared, problems = [], []
    for item in result.get("layers", []):
        label = item.get("name") or "SEVA.GIS layer"
        meta = item.get("meta") or {}
        try:
            if item.get("kind") == "raster":
                layer, problem = xyz_layer(_describe(label, meta), item.get("tile_url") or "")
            else:
                layer, problem = vector_layer(_describe(label, meta), item.get("geojson"), item.get("style"))
        except Exception as exc:  # one bad layer must not stop the others
            layer, problem = None, "Could not build '%s': %s" % (label, exc)
        if layer is None:
            problems.append(problem or ("Could not build '%s'." % label))
            continue
        try:
            if meta:
                layer.setCustomProperty("seva_meta", json.dumps(meta))
            if item.get("note"):
                layer.setCustomProperty("seva_note", item["note"])
            if item.get("box_text"):
                layer.setCustomProperty("seva_box", item["box_text"])
        except AttributeError:
            pass
        prepared.append(layer)
    return prepared, problems


def add_layers(layers, project=None, progress=None):
    """Add prepared layers so the legend order matches the box order.

    A newly added layer goes to the top of the legend, so the list is walked in
    reverse: the first box the user wrote ends up on top of the panel and the map.
    """
    if not HAS_QGIS:
        return [], []
    project = project or QgsProject.instance()
    added = []
    for layer in reversed(list(layers)):
        if progress:
            progress(layer.name())
        project.addMapLayer(layer, True)
        added.append(layer.name())
    return added, []


def zoom_to_ring(iface, ring):
    """Fit the map to the area of interest, so a result is never off-screen."""
    if not HAS_QGIS or iface is None or not ring:
        return
    canvas = iface.mapCanvas()
    rectangle = QgsRectangle()
    for lon, lat in ring:
        rectangle.combineExtentWith(float(lon), float(lat))
    source = QgsCoordinateReferenceSystem(WGS84)
    destination = canvas.mapSettings().destinationCrs()
    if source != destination:
        transform = QgsCoordinateTransform(source, destination, QgsProject.instance())
        rectangle = transform.transformBoundingBox(rectangle)
    rectangle.scale(1.15)  # a little breathing room around the boundary
    canvas.setExtent(rectangle)
    canvas.refresh()


# ------------------------------------------------------------------ tables
class ResultTableDialog(QtWidgets.QDialog if HAS_QGIS else object):
    """Numbers the service returned (statistics, land-cover areas) as a real table."""

    def __init__(self, tables, parent=None):
        if not HAS_QGIS:
            return
        super(ResultTableDialog, self).__init__(parent)
        self.setWindowTitle("SEVA.GIS results")
        self.resize(700, 440)
        layout = QtWidgets.QVBoxLayout(self)
        for table in tables or []:
            layout.addWidget(QtWidgets.QLabel("<b>%s</b>" % (table.get("name") or "Results")))
            rows = table.get("rows") or []
            columns = table.get("columns") or []
            view = QtWidgets.QTableWidget(len(rows), len(columns))
            view.setHorizontalHeaderLabels([str(column) for column in columns])
            view.setEditTriggers(QtWidgets.QAbstractItemView.NoEditTriggers)
            for row_index, row in enumerate(rows):
                for column_index, value in enumerate(row):
                    view.setItem(row_index, column_index, QtWidgets.QTableWidgetItem("" if value is None else str(value)))
            view.resizeColumnsToContents()
            layout.addWidget(view)
            caption_parts = [table.get("note") or ""]
            meta = table.get("meta") or {}
            caption_parts.extend(str(meta.get(key)) for key in ("source", "startDate", "endDate") if meta.get(key))
            caption = " · ".join(part for part in caption_parts if part)
            if caption:
                label = QtWidgets.QLabel(caption)
                label.setWordWrap(True)
                layout.addWidget(label)
        buttons = QtWidgets.QDialogButtonBox(QtWidgets.QDialogButtonBox.Close)
        buttons.rejected.connect(self.reject)
        buttons.accepted.connect(self.accept)
        layout.addWidget(buttons)
