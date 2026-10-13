# -*- coding: utf-8 -*-
"""Turn a query plan into service requests and host-agnostic layer descriptions.

A host (QGIS, ArcGIS Pro, ArcMap) calls :func:`run_queries` and receives plain
dictionaries describing what to draw:

    {"layers": [{"name": ..., "kind": "raster", "tile_url": ...},
                {"name": ..., "kind": "vector", "geojson": {...}, "style": {...}}],
     "tables": [{"name": ..., "columns": [...], "rows": [[...]]}],
     "errors": [{"box": ..., "text": ..., "error": ...}]}

Keeping the network and the interpretation here means the three hosts differ only
in how they add a layer, and one fix reaches all of them. ``poster`` is injectable
so the whole pipeline is testable without a service and without a GIS.
"""
from __future__ import print_function

import datetime

try:
    from . import seva_core
    from . import seva_plan
except ImportError:
    import seva_core
    import seva_plan

DEFAULT_CHANGE_WINDOW_DAYS = 30


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else str(value or "")


def _parse_date(text):
    try:
        return datetime.datetime.strptime(str(text)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def _window(resolved, defaults):
    """Date mode and cloud limit for one request, box settings beating plan settings."""
    start = (resolved.get("start_date") or defaults.get("start_date") or "").strip()
    end = (resolved.get("end_date") or defaults.get("end_date") or "").strip()
    params = resolved.get("params") or {}
    cloud = params.get("max_cloud")
    if cloud is None:
        cloud = defaults.get("max_cloud")

    body = {}
    if start and end:
        if start == end:
            body["mode"] = "date"
            body["date"] = start
        else:
            body["mode"] = "range"
            body["start_date"] = start
            body["end_date"] = end
    else:
        body["mode"] = "latest"
    if cloud is not None:
        try:
            body["max_cloud"] = int(cloud)
        except (TypeError, ValueError):
            pass
    return body


def _change_windows(resolved, defaults):
    """Before/after windows for a change request.

    A box that names a range is split in half, which is the reading a user expects
    from "compare July to August". Anything vaguer falls back to the last two
    equal windows, and the layer carries a note saying which was used.
    """
    window = _window(resolved, defaults)
    start = _parse_date(window.get("start_date") or window.get("date"))
    end = _parse_date(window.get("end_date") or window.get("date"))
    if start and end and start < end:
        middle = start + (end - start) / 2
        return (
            {"before_start": _iso(start), "before_end": _iso(middle)},
            {"after_start": _iso(middle + datetime.timedelta(days=1)), "after_end": _iso(end)},
            "Split the requested range in half.",
        )
    today = datetime.date.today()
    after_end = today
    after_start = today - datetime.timedelta(days=DEFAULT_CHANGE_WINDOW_DAYS)
    before_end = after_start - datetime.timedelta(days=1)
    before_start = before_end - datetime.timedelta(days=DEFAULT_CHANGE_WINDOW_DAYS)
    return (
        {"before_start": _iso(before_start), "before_end": _iso(before_end)},
        {"after_start": _iso(after_start), "after_end": _iso(after_end)},
        "No dates were given, so the last %d days were compared with the %d days before them."
        % (DEFAULT_CHANGE_WINDOW_DAYS, DEFAULT_CHANGE_WINDOW_DAYS),
    )


def _raster(name, payload, note="", meta=None):
    tile_url = seva_core.normalize_tile_url(payload.get("tileUrl") or payload.get("url") or "")
    return {
        "name": name,
        "kind": "raster",
        "tile_url": tile_url,
        "note": note or "",
        "meta": dict(meta or {}),
    }


def _raster_file(name, payload, note="", meta=None):
    """A real GeoTIFF: what ArcGIS can open, style and re-project."""
    return {
        "name": name,
        "kind": "raster_file",
        "download_url": payload.get("downloadUrl") or "",
        "bounds": payload.get("bounds"),
        "format": payload.get("format", "GEO_TIFF"),
        "crs": payload.get("crs", "EPSG:4326"),
        "scale_meters": payload.get("scaleMeters"),
        "note": note or payload.get("note", ""),
        "meta": dict(meta or {}),
    }


def _export_payload(op, resolved, defaults, coordinates, scale=10):
    """One resolved operation to a GeoTIFF export request."""
    params = resolved.get("params") or {}
    payload = {"coordinates": coordinates, "scale": scale}
    payload.update(_window(resolved, defaults))
    if op == "index":
        payload["indicator_id"] = params.get("indicator", "ndvi")
    elif op == "composite":
        payload["band_combination"] = params.get("combo", "natural")
    elif op == "dem":
        payload["dem_layer"] = params.get("layer", "elevation")
    elif op == "lulc":
        payload["land_cover"] = True
    elif op == "zones":
        payload["indicator_id"] = params.get("indicator", "ndvi")
    elif op == "candidates":
        payload["indicator_id"] = "ndvi"
    return payload


def _vector(name, feature_collection, style, note="", meta=None):
    return {
        "name": name,
        "kind": "vector",
        "geojson": feature_collection,
        "style": dict(style or {}),
        "note": note or "",
        "meta": dict(meta or {}),
    }


def _table(name, columns, rows, note="", meta=None):
    return {"name": name, "kind": "table", "columns": columns, "rows": rows, "note": note or "", "meta": dict(meta or {})}


def _common_meta(payload, extra=None):
    meta = {
        "source": payload.get("source", ""),
        "sceneCount": payload.get("sceneCount"),
        "startDate": payload.get("startDate"),
        "endDate": payload.get("endDate"),
        "limitations": payload.get("limitations") or [],
    }
    if extra:
        meta.update(extra)
    return dict((k, v) for k, v in meta.items() if v not in (None, "", []))


def _boundary_layer(resolved, box, ring):
    params = resolved.get("params") or {}
    return _vector(
        resolved.get("label") or "Area boundary",
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Polygon", "coordinates": [[list(point) for point in ring]]},
                    "properties": {"name": box.get("text", "")},
                }
            ],
        },
        {"color": params.get("color", "#e31a1c"), "width": params.get("width", 2), "fill": False},
        "Drawn from the area of interest selected in the host, not from the service.",
    )


def build_layers(op, resolved, box, ring, defaults, config, poster, raster_mode="tiles"):
    """One resolved operation to zero or more drawable items.

    ``raster_mode`` decides how a raster arrives: ``tiles`` streams XYZ tiles and
    suits QGIS, while ``geotiff`` fetches a real file and suits ArcGIS, which cannot
    consume a tile template as a layer.
    """
    params = resolved.get("params") or {}
    label = resolved.get("label") or op
    note = resolved.get("note") or ""
    coordinates = [list(point) for point in ring]
    wants_file = raster_mode == "geotiff"

    if op == "boundary":
        return [_boundary_layer(resolved, box, ring)], []

    body = {"coordinates": coordinates}
    body.update(_window(resolved, defaults))

    def export(extra_note=""):
        payload = poster(
            config,
            "/api/earth-engine/export",
            _export_payload(op, resolved, defaults, coordinates),
        )
        merged = (note + " " + extra_note).strip()
        return _raster_file(
            label,
            payload,
            merged,
            _common_meta(payload, {"product": payload.get("product"), "scaleMeters": payload.get("scaleMeters")}),
        )

    if op == "index":
        if wants_file:
            return [export()], []
        body["indicator_id"] = params.get("indicator", "ndvi")
        body["compositing"] = "median"
        payload = poster(config, "/api/earth-engine/map", body)
        return [_raster(label, payload, note, _common_meta(payload, {"latestSceneDate": payload.get("latestSceneDate")}))], []

    if op == "composite":
        if wants_file:
            return [export()], []
        body["band_combination"] = params.get("combo", "natural")
        payload = poster(config, "/api/earth-engine/map", body)
        return [_raster(label, payload, note, _common_meta(payload, {"latestSceneDate": payload.get("latestSceneDate")}))], []

    if op == "dem":
        if wants_file:
            return [export()], []
        payload = poster(config, "/api/earth-engine/dem", {"coordinates": coordinates, "layer": params.get("layer", "elevation")})
        return [_raster(label, payload, note, _common_meta(payload))], []

    if op == "lulc":
        if wants_file:
            payload = poster(config, "/api/earth-engine/lulc", body)
            rows = [[item.get("name"), item.get("area_ha"), item.get("pct")] for item in payload.get("classAreas", [])]
            tables = [_table("Land cover areas", ["Class", "Hectares", "Percent"], rows, "", _common_meta(payload))] if rows else []
            return [export()], tables
        payload = poster(config, "/api/earth-engine/lulc", body)
        layers = [_raster(label, payload, note, _common_meta(payload))]
        rows = [[item.get("name"), item.get("area_ha"), item.get("pct")] for item in payload.get("classAreas", [])]
        tables = [_table("Land cover areas", ["Class", "Hectares", "Percent"], rows, "", _common_meta(payload))] if rows else []
        return layers, tables

    if op == "alert":
        body["ndvi_threshold"] = params.get("threshold", 0.3)
        body["alert_pct"] = params.get("alert_pct", 30.0)
        payload = poster(config, "/api/earth-engine/alert", body)
        message = payload.get("alertMessage", "")
        drawn = note or message
        if wants_file:
            drawn = (drawn + " This one arrives as a tile-based image rather than a file; the figures "
                             "are on the layer and the underlying index can be exported as a GeoTIFF.").strip()
        return [_raster(label, payload, drawn, _common_meta(payload, {"stressedPct": payload.get("stressedPct")}))], []

    if op == "change":
        before, after, reason = _change_windows(resolved, defaults)
        body.update(before)
        body.update(after)
        body["indicator_id"] = params.get("indicator", "ndvi")
        body["threshold"] = params.get("threshold", 0.1)
        payload = poster(config, "/api/earth-engine/change", body)
        detail = "gain %s%%, loss %s%% (%s)" % (payload.get("gainedPct"), payload.get("lostPct"), reason)
        drawn = ((note + " ") if note else "") + detail
        if wants_file:
            drawn += " This one arrives as a tile-based image rather than a file."
        return [_raster(label, payload, drawn, _common_meta(payload, {"gainedPct": payload.get("gainedPct"), "lostPct": payload.get("lostPct")}))], []

    if op == "zones":
        body["indicator_id"] = params.get("indicator", "ndvi")
        body["level"] = params.get("level", "low")
        body["classes"] = params.get("classes", 2)
        body["class_mode"] = params.get("mode", "quantile")
        if params.get("threshold") is not None:
            body["threshold"] = params["threshold"]
        payload = poster(config, "/api/earth-engine/zones", body)
        color = params.get("color") or ("#1a9850" if params.get("level") == "high" else "#d73027")
        meta = _common_meta(payload, {"cut": payload.get("cut"), "meanIndex": payload.get("meanIndex"), "zoneHectares": payload.get("zoneHectares")})
        raster_item = export() if wants_file else _raster(label + " (raster)", payload, note, meta)
        layers = [
            raster_item,
            _vector(
                label,
                {"type": "FeatureCollection", "features": payload.get("features", [])},
                {"color": color, "fill": True, "fillOpacity": 0.35, "width": 1},
                note,
                meta,
            ),
        ]
        return layers, []

    if op == "streams":
        stream_body = {"coordinates": coordinates, "percentile": params.get("percentile", 96.0)}
        payload = poster(config, "/api/earth-engine/streams", stream_body)
        stats = payload.get("stats") or {}
        stream_note = note or ("%s km across %s segment(s)." % (stats.get("totalKm"), stats.get("segments")))
        meta = {"source": stats.get("source", ""), "limitations": stats.get("limitations") or [], "totalKm": stats.get("totalKm"), "grid": stats.get("grid")}
        return [
            _vector(
                label,
                {"type": "FeatureCollection", "features": payload.get("features", [])},
                {"color": "#2c7bb6", "width": 2, "fill": False},
                stream_note,
                dict((k, v) for k, v in meta.items() if v not in (None, "", [])),
            )
        ], []

    if op == "candidates":
        body["kind"] = params.get("kind", "linear")
        if params.get("threshold") is not None:
            body["threshold"] = params["threshold"]
        payload = poster(config, "/api/earth-engine/candidates", body)
        color = params.get("color") or "#f46d43"
        meta = _common_meta(payload, {"kind": payload.get("kind"), "candidateHectares": payload.get("candidateHectares")})
        raster_item = export() if wants_file else _raster(label + " (raster)", payload, note, meta)
        layers = [
            raster_item,
            _vector(
                label,
                {"type": "FeatureCollection", "features": payload.get("features", [])},
                {"color": color, "fill": True, "fillOpacity": 0.3, "width": 1},
                note or " | ".join(payload.get("limitations", [])),
                meta,
            ),
        ]
        return layers, []

    if op == "stats":
        body["indicators"] = params.get("indicators") or ["ndvi", "ndmi"]
        body["scale"] = 20
        payload = poster(config, "/api/earth-engine/stats", body)
        rows = []
        for indicator, values in sorted((payload.get("indicators") or {}).items()):
            rows.append([
                indicator.upper(),
                values.get("mean"), values.get("min"), values.get("max"),
                values.get("stdDev"), values.get("p25"), values.get("p75"),
            ])
        return [], [_table(label, ["Index", "Mean", "Min", "Max", "StdDev", "P25", "P75"], rows, note, _common_meta(payload))]

    raise seva_core.SevaError("Unsupported operation: %s" % op)


def run_queries(plan, ring, config, poster=None, progress=None, raster_mode="tiles"):
    """Resolve every enabled box, then return what to draw.

    A failure inside one box never aborts the run: the other boxes still produce
    their layers, and the failure is reported next to the sentence that caused it.
    """
    poster = poster or seva_core.plan_request
    defaults = seva_plan.active_defaults(plan)
    layers = []
    tables = []
    errors = []

    boxes = [box for box in plan.get("boxes", []) if box.get("enabled", True)]
    for position, box in enumerate(boxes):
        text = (box.get("text") or "").strip()
        if progress:
            progress(position + 1, len(boxes), text)
        resolved_items = box.get("resolved") or []
        if not resolved_items:
            errors.append({"box": box.get("id"), "text": text, "error": "Not planned yet. Press Plan to describe this box."})
            continue
        for resolved in resolved_items:
            op = resolved.get("op")
            if op == "settings":
                continue  # already folded into the run window
            try:
                drawn, reported = build_layers(op, resolved, box, ring, defaults, config, poster, raster_mode)
            except seva_core.SevaError as exc:
                errors.append({"box": box.get("id"), "text": text, "error": str(exc)})
                continue
            for layer in drawn:
                layer["box_id"] = box.get("id")
                layer["box_text"] = text
                layers.append(layer)
            for table in reported:
                table["box_id"] = box.get("id")
                tables.append(table)

    return {"layers": layers, "tables": tables, "errors": errors, "defaults": defaults}


def describe_result(result):
    """Short status line for a dialog or a host message bar."""
    layers = len(result.get("layers", []))
    tables = len(result.get("tables", []))
    errors = len(result.get("errors", []))
    parts = ["%d layer(s)" % layers]
    if tables:
        parts.append("%d table(s)" % tables)
    if errors:
        parts.append("%d problem(s)" % errors)
    return ", ".join(parts)
