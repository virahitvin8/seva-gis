"""Unit tests for Earth Engine tile URL generation.

Earth Engine retired ``earthengine.googleapis.com/map/<mapid>/{z}/{x}/{y}?token=``;
it answers 404 now. The service used to emit that form, which is why map layers
would not load in QGIS or ArcGIS even though the render call succeeded. These
tests pin the replacement so the regression cannot come back.
"""
from __future__ import annotations

import unittest

from backend.main import _tileurl, modernize_tile_url

V1_PREFIX = "https://earthengine.googleapis.com/v1/"


class ModernizeTileUrlTests(unittest.TestCase):
    def test_legacy_url_is_rewritten_to_the_v1_tile_endpoint(self):
        legacy = (
            "https://earthengine.googleapis.com/map/projects/seva-gis-backend/maps/abc123-def456"
            "/{z}/{x}/{y}?token=deadbeef"
        )
        self.assertEqual(
            modernize_tile_url(legacy),
            V1_PREFIX + "projects/seva-gis-backend/maps/abc123-def456/tiles/{z}/{x}/{y}",
        )

    def test_a_bare_mapid_legacy_url_is_also_rewritten(self):
        legacy = "https://earthengine.googleapis.com/map/abc123/{z}/{x}/{y}?token=t"
        self.assertEqual(
            modernize_tile_url(legacy),
            V1_PREFIX + "projects/earthengine-legacy/maps/abc123/tiles/{z}/{x}/{y}",
        )

    def test_modern_url_is_untouched(self):
        modern = V1_PREFIX + "projects/seva-gis-backend/maps/abc123/tiles/{z}/{x}/{y}"
        self.assertEqual(modernize_tile_url(modern), modern)

    def test_empty_input_stays_empty(self):
        self.assertEqual(modernize_tile_url(""), "")


class TileUrlTests(unittest.TestCase):
    def test_projects_mapid_keeps_its_path_and_gains_tile_placeholders(self):
        url = _tileurl({"mapid": "projects/seva-gis-backend/maps/hash-token"})
        self.assertEqual(url, V1_PREFIX + "projects/seva-gis-backend/maps/hash-token/tiles/{z}/{x}/{y}")

    def test_bare_mapid_is_placed_under_earthengine_legacy(self):
        url = _tileurl({"mapid": "0fd09d37b73fb3995431ff513143a2ec", "token": "33292387"})
        self.assertEqual(
            url,
            V1_PREFIX + "projects/earthengine-legacy/maps/0fd09d37b73fb3995431ff513143a2ec/tiles/{z}/{x}/{y}",
        )

    def test_url_format_from_an_older_client_is_normalised(self):
        url = _tileurl(
            {"urlFormat": "https://earthengine.googleapis.com/map/projects/p/maps/h/{z}/{x}/{y}?token=t"}
        )
        self.assertEqual(url, V1_PREFIX + "projects/p/maps/h/tiles/{z}/{x}/{y}")

    def test_no_result_ever_carries_a_token_query(self):
        for mapid in ("abc", "projects/p/maps/h"):
            self.assertNotIn("?token=", _tileurl({"mapid": mapid, "token": "secret"}))

    def test_every_result_is_a_usable_xyz_template(self):
        for mapid in ("abc", "projects/p/maps/h"):
            self.assertIn("{z}/{x}/{y}", _tileurl({"mapid": mapid}))


if __name__ == "__main__":
    unittest.main()
