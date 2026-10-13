"""Live endpoint checks against a running SEVA.GIS tile service.

These tests talk to real Earth Engine, so they are skipped unless you point them at
a service. Run the service locally first, then:

    SEVA_LIVE_URL=http://127.0.0.1:8099 python -m unittest backend.tests.test_live_endpoints -v

Check the proof, not the status code: every tile URL returned here is fetched and
the response is asserted to be a real image, because a URL that answers 404 is
exactly the failure this suite exists to catch.
"""
from __future__ import annotations

import json
import math
import os
import unittest
import urllib.error
import urllib.request

BASE = os.environ.get("SEVA_LIVE_URL", "").rstrip("/")

# Small, real areas of interest. The second sits on real relief so the stream
# network has something to drain.
FIELD = [[77.5900, 12.9700], [77.6100, 12.9700], [77.6100, 12.9840], [77.5900, 12.9840]]
HILLS = [[77.3100, 13.3400], [77.3300, 13.3400], [77.3300, 13.3520], [77.3100, 13.3520]]


def post(path: str, payload: dict, timeout: float = 240.0) -> dict:
    request = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def get(path: str, timeout: float = 60.0) -> dict:
    with urllib.request.urlopen(BASE + path, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def tile_xy(lon: float, lat: float, zoom: int) -> tuple[int, int]:
    """The standard web-mercator tile containing a coordinate."""
    count = 2 ** zoom
    x = int((lon + 180.0) / 360.0 * count)
    y = int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * count)
    return x, y


def fetch_tile(tile_url: str, lon: float, lat: float, zoom: int = 13) -> tuple[int, str, int]:
    """Fetch the tile that actually covers the area of interest."""
    x, y = tile_xy(lon, lat, zoom)
    url = tile_url.replace("{z}", str(zoom)).replace("{x}", str(x)).replace("{y}", str(y))
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.status, response.headers.get("Content-Type", ""), len(response.read())


@unittest.skipUnless(BASE, "set SEVA_LIVE_URL to run the live endpoint checks")
class LiveEndpointTests(unittest.TestCase):
    def test_health_reports_engine_ready(self):
        health = get("/health")
        self.assertEqual(health["service"], "seva-gis-earth-engine")
        self.assertTrue(health["engineReady"], "Earth Engine must be initialised")

    def test_interpret_needs_no_earth_engine_and_keeps_every_sentence(self):
        sentences = [
            "make a red color boundary line of my area of location",
            "I need NDVI, EVI, SAVI analysis",
            "true color and false color image",
            "date range from July to August",
            "only two percent cloud percentage in this month",
            "make circles or polygons upon the danger zones in my area",
            "make only healthy zones",
            "draw the line stream where the water flows as per the slope",
            "identify ELECTRICAL POLES MARKING",
        ]
        # The plugin sends its date and cloud row along with the sentences, exactly as a
        # user does when they fill those two fields once for the whole run.
        result = post(
            "/api/earth-engine/interpret",
            {
                "sentences": sentences,
                "max_cloud": 20,
                "start_date": "2026-07-01",
                "end_date": "2026-08-31",
            },
        )
        self.assertEqual(result["planVersion"], 1)
        self.assertIn(result["engine"], ("rules", "llm:vertex", "llm:openai"))

        by_text: dict[str, list[dict]] = {}
        for box in result["boxes"]:
            by_text.setdefault(box["text"], []).append(box)
            self.assertIn(box["op"], (
                "index", "composite", "dem", "lulc", "zones", "streams",
                "candidates", "boundary", "stats", "change", "alert", "settings",
            ))

        # No sentence may be dropped.
        for sentence in sentences:
            self.assertIn(sentence, by_text, "lost the sentence: %s" % sentence)

        self.assertEqual(
            [b["params"]["indicator"] for b in by_text["I need NDVI, EVI, SAVI analysis"]],
            ["ndvi", "evi", "savi"],
        )
        self.assertEqual(
            [b["params"]["combo"] for b in by_text["true color and false color image"]],
            ["natural", "cir"],
        )
        self.assertEqual(by_text["date range from July to August"][0]["op"], "settings")

        poles = by_text["identify ELECTRICAL POLES MARKING"][0]
        self.assertEqual(poles["op"], "candidates")
        self.assertEqual(poles.get("start_date"), "2026-07-01", "MARKING must not read as the month mar")
        self.assertIn("under one metre", poles["note"])

    def test_map_tile_url_is_modern_and_serves_pixels(self):
        result = post(
            "/api/earth-engine/map",
            {"coordinates": FIELD, "mode": "latest", "max_cloud": 30, "indicator_id": "ndvi"},
        )
        tile_url = result["tileUrl"]
        self.assertIn("/v1/", tile_url, "the retired legacy /map/ endpoint must not be emitted")
        self.assertNotIn("?token=", tile_url)
        status, content_type, size = fetch_tile(tile_url, 77.60, 12.977)
        self.assertEqual(status, 200)
        self.assertIn("image", content_type)
        self.assertGreater(size, 100, "the tile must carry real bytes")

    def test_zones_return_polygons_and_a_working_tile(self):
        result = post(
            "/api/earth-engine/zones",
            {
                "coordinates": FIELD,
                "mode": "latest",
                "max_cloud": 30,
                "indicator_id": "ndvi",
                "level": "low",
                "classes": 2,
                "min_hectares": 0.2,
            },
        )
        self.assertEqual(result["type"], "FeatureCollection")
        self.assertGreater(len(result["features"]), 0, "a fallow/urban area still yields low-vigour zone polygons")
        self.assertIn("limitations", result)
        for feature in result["features"]:
            self.assertIn(feature["geometry"]["type"], ("Polygon", "MultiPolygon"))
            self.assertGreater(feature["properties"]["pixels"], 0)
            self.assertGreater(feature["properties"]["hectares"], 0)
        status, content_type, _ = fetch_tile(result["tileUrl"], 77.60, 12.977)
        self.assertEqual(status, 200)
        self.assertIn("image", content_type)

    def test_streams_return_linestrings_inside_the_area(self):
        result = post(
            "/api/earth-engine/streams",
            {"coordinates": HILLS, "percentile": 96.0, "target_meters": 30},
        )
        self.assertEqual(result["type"], "FeatureCollection")
        self.assertGreater(len(result["features"]), 0, "relief must produce at least one channel")
        self.assertIn("method", result["stats"])
        for feature in result["features"]:
            self.assertEqual(feature["geometry"]["type"], "LineString")
            coordinates = feature["geometry"]["coordinates"]
            self.assertGreaterEqual(len(coordinates), 3)
            for lon, lat in coordinates:
                self.assertTrue(77.30 <= lon <= 77.34, lon)
                self.assertTrue(13.33 <= lat <= 13.36, lat)

    def test_candidates_are_labelled_candidates(self):
        result = post(
            "/api/earth-engine/candidates",
            {"coordinates": FIELD, "kind": "linear", "max_cloud": 30, "min_hectares": 0.2},
        )
        self.assertEqual(result["status"], "candidate")
        self.assertTrue(result["limitations"])
        self.assertIn("cannot", " ".join(result["limitations"]))
        for feature in result["features"]:
            self.assertIn(feature["geometry"]["type"], ("Polygon", "MultiPolygon"))
        status, content_type, _ = fetch_tile(result["tileUrl"], 77.60, 12.977)
        self.assertEqual(status, 200)
        self.assertIn("image", content_type)

    def test_water_candidates_use_the_water_bands(self):
        result = post(
            "/api/earth-engine/candidates",
            {"coordinates": FIELD, "kind": "water", "max_cloud": 30, "threshold": 0.0},
        )
        self.assertEqual(result["kind"], "water")
        self.assertIn("Depth is not measured", result["limitations"][0])


if __name__ == "__main__":
    unittest.main()
