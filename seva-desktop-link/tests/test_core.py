# -*- coding: utf-8 -*-
"""Unit tests for seva_core.py"""
import os, sys, unittest, tempfile, shutil

# Add core to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "core")))
import seva_core


class TestSevaCore(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_payload_validation(self):
        # Valid payload
        f = {
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [[[75.8, 30.9], [75.9, 30.9], [75.9, 30.8], [75.8, 30.8], [75.8, 30.9]]]},
            "properties": {"seva_id": "test-id-1", "name": "Test Field", "crop": "Wheat"}
        }
        p = seva_core.make_payload([f], app="QGIS", app_version="3.34", project="Farm1")
        self.assertIsNone(seva_core.validate_payload(p))

        # Invalid geometry
        f_bad = dict(f, geometry={"type": "Point", "coordinates": [75.8, 30.9]})
        p_bad = seva_core.make_payload([f_bad], app="QGIS")
        self.assertIsNotNone(seva_core.validate_payload(p_bad))

    def test_encode_decode_fragment(self):
        f = {
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [[[75.8, 30.9], [75.9, 30.9], [75.9, 30.8], [75.8, 30.9]]]},
            "properties": {"seva_id": "uuid-123", "name": "Parcel 42"}
        }
        payload = seva_core.make_payload([f], app="ArcGIS")
        encoded = seva_core.encode_fragment(payload)
        self.assertIsInstance(encoded, str)
        decoded = seva_core.decode_fragment(encoded)
        self.assertEqual(decoded["seva_exchange"], "1")
        self.assertEqual(decoded["features"][0]["properties"]["seva_id"], "uuid-123")

    def test_results_index(self):
        f = {
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": []},
            "properties": {"seva_id": "uuid-99", "sv_ndvi": 0.74, "sv_health": "healthy", "extra": "ignored"}
        }
        payload = seva_core.make_payload([f], app="SEVA")
        idx = seva_core.results_index(payload)
        self.assertIn("uuid-99", idx)
        self.assertEqual(idx["uuid-99"]["sv_ndvi"], 0.74)
        self.assertNotIn("extra", idx["uuid-99"])

    def test_exchange_dirs_and_write(self):
        dirs = seva_core.exchange_dirs(self.tmp)
        self.assertTrue(os.path.isdir(dirs["inbox"]))
        self.assertTrue(os.path.isdir(dirs["outbox"]))
        payload = seva_core.make_payload([], app="Test")
        file_path = seva_core.write_parcels(self.tmp, payload)
        self.assertTrue(os.path.isfile(file_path))


if __name__ == "__main__":
    unittest.main()
