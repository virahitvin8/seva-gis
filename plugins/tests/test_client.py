"""Unit tests for the plan-to-layer client.

The service call is injected, so these tests prove the request bodies, the drawing
order and the failure handling without a network, a service or a GIS.
"""
from __future__ import annotations

import unittest

from plugins.core import seva_client, seva_core, seva_plan

RING = [[77.59, 12.97], [77.61, 12.97], [77.61, 12.984], [77.59, 12.984]]


class Recorder:
    """Stands in for seva_core.plan_request and remembers every call."""

    def __init__(self, responses=None, fail_on=None):
        self.calls = []
        self.responses = responses or {}
        self.fail_on = set(fail_on or [])

    def __call__(self, config, path, body=None, timeout=240):
        self.calls.append((path, body))
        if path in self.fail_on:
            raise seva_core.SevaError("No Sentinel-2 scenes in this window.")
        if path in self.responses:
            return self.responses[path]
        if path.endswith("/map"):
            return {"tileUrl": "https://earthengine.googleapis.com/v1/projects/p/maps/h/tiles/{z}/{x}/{y}", "source": "GEE/S2", "sceneCount": 3, "latestSceneDate": "2026-08-20"}
        if path.endswith("/zones"):
            return {
                "tileUrl": "https://earthengine.googleapis.com/v1/projects/p/maps/z/tiles/{z}/{x}/{y}",
                "features": [{"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[77.6, 12.97], [77.61, 12.97], [77.61, 12.98], [77.6, 12.97]]]}, "properties": {"pixels": 40, "hectares": 0.4}}],
                "cut": 0.31, "meanIndex": 0.22, "zoneHectares": 0.4, "source": "GEE/S2", "limitations": ["not a survey"],
            }
        if path.endswith("/streams"):
            return {
                "features": [{"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[77.6, 12.97], [77.6, 12.975], [77.61, 12.98]]}, "properties": {"length_km": 0.7}}],
                "stats": {"segments": 1, "totalKm": 0.7, "source": "COPERNICUS/DEM/GLO30", "limitations": ["proxy"], "grid": {"rows": 40, "cols": 40}},
            }
        if path.endswith("/candidates"):
            return {"tileUrl": "https://earthengine.googleapis.com/v1/projects/p/maps/c/tiles/{z}/{x}/{y}", "features": [], "kind": "linear", "limitations": ["cannot resolve poles"], "candidateHectares": 0.0}
        if path.endswith("/stats"):
            return {"indicators": {"ndvi": {"mean": 0.42, "min": 0.1, "max": 0.8, "stdDev": 0.05, "p25": 0.38, "p75": 0.47}}, "sceneCount": 3, "source": "GEE/S2"}
        if path.endswith("/dem"):
            return {"tileUrl": "https://earthengine.googleapis.com/v1/projects/p/maps/d/tiles/{z}/{x}/{y}", "layer": "slope", "source": "COPERNICUS/DEM/GLO30"}
        if path.endswith("/lulc"):
            return {"tileUrl": "https://earthengine.googleapis.com/v1/projects/p/maps/l/tiles/{z}/{x}/{y}", "classAreas": [{"name": "Crops", "area_ha": 12.5, "pct": 61.0}], "source": "GOOGLE/DYNAMICWORLD/V1"}
        if path.endswith("/change"):
            return {"tileUrl": "https://earthengine.googleapis.com/v1/projects/p/maps/ch/tiles/{z}/{x}/{y}", "gainedPct": 4.0, "lostPct": 9.0, "source": "GEE/S2"}
        if path.endswith("/alert"):
            return {"tileUrl": "https://earthengine.googleapis.com/v1/projects/p/maps/a/tiles/{z}/{x}/{y}", "stressedPct": 12.0, "alertMessage": "OK: 12% stressed.", "source": "GEE/S2"}
        return {}


def make_plan(*boxes):
    plan = seva_plan.empty_plan()
    plan["defaults"] = {"start_date": "2026-07-01", "end_date": "2026-08-31", "max_cloud": 20}
    for text, resolved in boxes:
        box = seva_plan.add_box(plan, text)
        box["resolved"] = resolved
    return plan


def path_index(recorder, suffix):
    return [i for i, (path, _) in enumerate(recorder.calls) if path.endswith(suffix)]


CONFIG = {"backend_url": "https://example.test"}


class RequestTests(unittest.TestCase):
    def test_index_requests_the_map_endpoint_with_the_run_window(self):
        recorder = Recorder()
        plan = make_plan(("NDVI", [{"op": "index", "params": {"indicator": "ndvi"}, "label": "NDVI"}]))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        path, body = recorder.calls[0]
        self.assertEqual(path, "/api/earth-engine/map")
        self.assertEqual(body["indicator_id"], "ndvi")
        self.assertEqual(body["mode"], "range")
        self.assertEqual(body["start_date"], "2026-07-01")
        self.assertEqual(body["end_date"], "2026-08-31")
        self.assertEqual(body["max_cloud"], 20)
        self.assertEqual(body["coordinates"], RING)
        self.assertEqual(len(result["layers"]), 1)
        self.assertEqual(result["layers"][0]["kind"], "raster")
        self.assertIn("{z}/{x}/{y}", result["layers"][0]["tile_url"])

    def test_a_box_with_its_own_dates_beats_the_run_window(self):
        recorder = Recorder()
        plan = make_plan(("NDVI in August", [{"op": "index", "params": {"indicator": "ndvi"}, "start_date": "2026-08-01", "end_date": "2026-08-31"}]))
        seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        _, body = recorder.calls[0]
        self.assertEqual(body["start_date"], "2026-08-01")

    def test_a_single_date_uses_date_mode(self):
        recorder = Recorder()
        plan = make_plan(("NDVI on 2026-08-02", [{"op": "index", "params": {"indicator": "ndvi"}, "start_date": "2026-08-02", "end_date": "2026-08-02"}]))
        seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        _, body = recorder.calls[0]
        self.assertEqual(body["mode"], "date")
        self.assertEqual(body["date"], "2026-08-02")
        self.assertNotIn("start_date", body)

    def test_composites_request_band_combinations(self):
        recorder = Recorder()
        plan = make_plan(("true colour", [{"op": "composite", "params": {"combo": "natural"}, "label": "natural composite"}]))
        seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        _, body = recorder.calls[0]
        self.assertEqual(body["band_combination"], "natural")

    def test_terrain_requests_the_dem_layer(self):
        recorder = Recorder()
        plan = make_plan(("slope", [{"op": "dem", "params": {"layer": "slope"}, "label": "Terrain - slope"}]))
        seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        path, body = recorder.calls[0]
        self.assertEqual(path, "/api/earth-engine/dem")
        self.assertEqual(body["layer"], "slope")

    def test_change_splits_the_requested_range_in_half(self):
        recorder = Recorder()
        plan = make_plan(("change", [{"op": "change", "params": {"indicator": "ndvi"}, "label": "Change"}]))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        _, body = recorder.calls[0]
        self.assertEqual(body["before_start"], "2026-07-01")
        self.assertEqual(body["after_end"], "2026-08-31")
        self.assertLess(body["before_end"], body["after_start"])
        self.assertIn("Split the requested range", result["layers"][0]["note"])


class LayerTests(unittest.TestCase):
    def test_several_layers_from_one_sentence_keep_the_order_they_were_asked(self):
        recorder = Recorder()
        plan = make_plan((
            "NDVI, EVI, SAVI",
            [
                {"op": "index", "params": {"indicator": "ndvi"}, "label": "NDVI"},
                {"op": "index", "params": {"indicator": "evi"}, "label": "EVI"},
                {"op": "index", "params": {"indicator": "savi"}, "label": "SAVI"},
            ],
        ))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        self.assertEqual([layer["name"] for layer in result["layers"]], ["NDVI", "EVI", "SAVI"])
        self.assertEqual([body["indicator_id"] for _, body in recorder.calls], ["ndvi", "evi", "savi"])

    def test_drawing_order_follows_the_box_order_and_reacts_to_a_move(self):
        recorder = Recorder()
        plan = make_plan(
            ("NDVI", [{"op": "index", "params": {"indicator": "ndvi"}, "label": "NDVI"}]),
            ("EVI", [{"op": "index", "params": {"indicator": "evi"}, "label": "EVI"}]),
        )
        first = seva_client.run_queries(plan, RING, CONFIG, poster=Recorder())
        self.assertEqual([layer["name"] for layer in first["layers"]], ["NDVI", "EVI"])

        seva_plan.move_box(plan, "b2", -1)
        second = seva_client.run_queries(plan, RING, CONFIG, poster=Recorder())
        self.assertEqual([layer["name"] for layer in second["layers"]], ["EVI", "NDVI"])

    def test_the_boundary_is_drawn_locally_without_touching_the_service(self):
        recorder = Recorder()
        plan = make_plan(("make a red boundary line", [{"op": "boundary", "params": {"color": "#e31a1c", "width": 3}, "label": "Area boundary"}]))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        self.assertEqual(recorder.calls, [], "the outline is built from the selection, not fetched")
        layer = result["layers"][0]
        self.assertEqual(layer["kind"], "vector")
        self.assertEqual(layer["style"]["color"], "#e31a1c")
        self.assertEqual(layer["style"]["width"], 3)
        self.assertFalse(layer["style"]["fill"])
        self.assertEqual(layer["geojson"]["features"][0]["geometry"]["coordinates"][0][0], [77.59, 12.97])

    def test_zones_produce_both_a_raster_and_polygons(self):
        recorder = Recorder()
        plan = make_plan(("danger zones", [{"op": "zones", "params": {"indicator": "ndvi", "level": "low", "classes": 2, "color": "#d73027"}, "label": "Hotspot zones"}]))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        kinds = [layer["kind"] for layer in result["layers"]]
        self.assertIn("raster", kinds)
        self.assertIn("vector", kinds)
        vector = [layer for layer in result["layers"] if layer["kind"] == "vector"][0]
        self.assertTrue(vector["style"]["fill"])
        self.assertEqual(vector["style"]["color"], "#d73027")
        self.assertEqual(len(vector["geojson"]["features"]), 1)

    def test_streams_become_linestrings_with_their_disclosure(self):
        recorder = Recorder()
        plan = make_plan(("streams where water flows", [{"op": "streams", "params": {"percentile": 96.0}, "label": "Stream lines"}]))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        layer = result["layers"][0]
        self.assertEqual(layer["geojson"]["features"][0]["geometry"]["type"], "LineString")
        self.assertEqual(layer["meta"]["totalKm"], 0.7)
        self.assertIn("proxy", layer["meta"]["limitations"])

    def test_candidates_carry_their_uncertainty_into_the_layer(self):
        recorder = Recorder()
        plan = make_plan(("electrical poles", [{"op": "candidates", "params": {"kind": "linear"}, "note": "below pixel size", "label": "Candidates"}]))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        vector = [layer for layer in result["layers"] if layer["kind"] == "vector"][0]
        self.assertIn("below pixel size", vector["note"])

    def test_statistics_come_back_as_a_table_not_a_layer(self):
        recorder = Recorder()
        plan = make_plan(("statistics", [{"op": "stats", "params": {"indicators": ["ndvi"]}, "label": "Statistics"}]))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        self.assertEqual(result["layers"], [])
        self.assertEqual(len(result["tables"]), 1)
        self.assertEqual(result["tables"][0]["rows"][0][0], "NDVI")

    def test_land_cover_adds_a_class_area_table(self):
        recorder = Recorder()
        plan = make_plan(("land cover", [{"op": "lulc", "params": {}, "label": "Land cover"}]))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        self.assertEqual(len(result["layers"]), 1)
        self.assertEqual(result["tables"][0]["rows"], [["Crops", 12.5, 61.0]])


class RobustnessTests(unittest.TestCase):
    def test_a_settings_box_is_folded_into_the_run_and_draws_nothing(self):
        recorder = Recorder()
        plan = make_plan(
            ("only two percent cloud", [{"op": "settings", "params": {"max_cloud": 2}, "label": "window"}]),
            ("NDVI", [{"op": "index", "params": {"indicator": "ndvi"}, "label": "NDVI"}]),
        )
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        self.assertEqual(len(result["layers"]), 1)
        self.assertEqual(len(recorder.calls), 1, "the settings box must not hit the service")
        self.assertEqual(recorder.calls[0][1]["max_cloud"], 2)

    def test_a_failing_box_does_not_stop_the_others(self):
        recorder = Recorder(fail_on={"/api/earth-engine/streams"})
        plan = make_plan(
            ("streams", [{"op": "streams", "params": {}, "label": "Streams"}]),
            ("NDVI", [{"op": "index", "params": {"indicator": "ndvi"}, "label": "NDVI"}]),
        )
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        self.assertEqual([layer["name"] for layer in result["layers"]], ["NDVI"])
        self.assertEqual(len(result["errors"]), 1)
        self.assertIn("No Sentinel-2 scenes", result["errors"][0]["error"])
        self.assertEqual(result["errors"][0]["text"], "streams")

    def test_switched_off_boxes_are_never_requested(self):
        recorder = Recorder()
        plan = make_plan(
            ("NDVI", [{"op": "index", "params": {"indicator": "ndvi"}, "label": "NDVI"}]),
            ("EVI", [{"op": "index", "params": {"indicator": "evi"}, "label": "EVI"}]),
        )
        seva_plan.set_enabled(plan, "b2", False)
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        self.assertEqual(len(recorder.calls), 1)
        self.assertEqual([layer["name"] for layer in result["layers"]], ["NDVI"])

    def test_an_unplanned_box_is_reported_instead_of_being_skipped_silently(self):
        plan = make_plan(("something I typed but never planned", []))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=Recorder())
        self.assertEqual(len(result["errors"]), 1)
        self.assertIn("Not planned yet", result["errors"][0]["error"])

    def test_a_retired_tile_url_from_an_older_server_is_repaired(self):
        legacy = {
            "tileUrl": "https://earthengine.googleapis.com/map/projects/p/maps/h/{z}/{x}/{y}?token=t",
            "source": "GEE/S2",
        }
        recorder = Recorder(responses={"/api/earth-engine/map": legacy})
        plan = make_plan(("NDVI", [{"op": "index", "params": {"indicator": "ndvi"}, "label": "NDVI"}]))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        tile_url = result["layers"][0]["tile_url"]
        self.assertIn("/v1/", tile_url)
        self.assertNotIn("?token=", tile_url)

    def test_every_layer_names_the_box_it_came_from(self):
        recorder = Recorder()
        plan = make_plan(("NDVI", [{"op": "index", "params": {"indicator": "ndvi"}, "label": "NDVI"}]))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        self.assertEqual(result["layers"][0]["box_id"], "b1")
        self.assertEqual(result["layers"][0]["box_text"], "NDVI")

    def test_geotiff_mode_asks_for_a_file_instead_of_tiles(self):
        # ArcGIS cannot use a tile template as a layer, so it asks for a GeoTIFF.
        recorder = Recorder(responses={"/api/earth-engine/export": {
            "downloadUrl": "https://example.test/file.tif",
            "format": "GEO_TIFF",
            "crs": "EPSG:4326",
            "scaleMeters": 10,
            "bounds": [77.59, 12.97, 77.61, 12.984],
            "product": "ndvi",
            "source": "GEE/S2",
        }})
        plan = make_plan(("NDVI", [{"op": "index", "params": {"indicator": "ndvi"}, "label": "NDVI"}]))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder, raster_mode="geotiff")
        self.assertEqual([path for path, _ in recorder.calls], ["/api/earth-engine/export"])
        layer = result["layers"][0]
        self.assertEqual(layer["kind"], "raster_file")
        self.assertEqual(layer["download_url"], "https://example.test/file.tif")
        self.assertEqual(layer["crs"], "EPSG:4326")
        self.assertEqual(layer["scale_meters"], 10)

    def test_geotiff_mode_exports_the_index_and_still_vectorises_zones(self):
        recorder = Recorder(responses={"/api/earth-engine/export": {
            "downloadUrl": "https://example.test/ndvi.tif", "format": "GEO_TIFF", "crs": "EPSG:4326",
        }})
        plan = make_plan(("danger zones", [{"op": "zones", "params": {"indicator": "ndvi", "level": "low"}, "label": "Zones"}]))
        result = seva_client.run_queries(plan, RING, CONFIG, poster=recorder, raster_mode="geotiff")
        self.assertIn("/api/earth-engine/zones", [path for path, _ in recorder.calls])
        self.assertIn("/api/earth-engine/export", [path for path, _ in recorder.calls])
        kinds = sorted(layer["kind"] for layer in result["layers"])
        self.assertEqual(kinds, ["raster_file", "vector"])
        raster = [layer for layer in result["layers"] if layer["kind"] == "raster_file"][0]
        self.assertEqual(raster["download_url"], "https://example.test/ndvi.tif")

    def test_tile_mode_never_calls_the_export_endpoint(self):
        recorder = Recorder()
        plan = make_plan(("NDVI", [{"op": "index", "params": {"indicator": "ndvi"}, "label": "NDVI"}]))
        seva_client.run_queries(plan, RING, CONFIG, poster=recorder)
        self.assertNotIn("/api/earth-engine/export", [path for path, _ in recorder.calls])

    def test_progress_is_reported_per_box(self):
        seen = []
        plan = make_plan(
            ("NDVI", [{"op": "index", "params": {"indicator": "ndvi"}, "label": "NDVI"}]),
            ("EVI", [{"op": "index", "params": {"indicator": "evi"}, "label": "EVI"}]),
        )
        seva_client.run_queries(plan, RING, CONFIG, poster=Recorder(), progress=lambda i, n, t: seen.append((i, n, t)))
        self.assertEqual(seen, [(1, 2, "NDVI"), (2, 2, "EVI")])


if __name__ == "__main__":
    unittest.main()
