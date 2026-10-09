# -*- coding: utf-8 -*-
"""Unit tests for seva_bridge.py"""
import json
import os
import sys
import threading
import time
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "bridge")))
import seva_bridge


class TestSevaBridge(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.token = "test-secret-token-12345"
        cls.port = 8769
        cls.server = seva_bridge.make_server(
            port=cls.port,
            token=cls.token,
            origins=("http://localhost:5173", "https://sevagis.dpdns.org"),
            host="127.0.0.1"
        )
        cls.thread = threading.Thread(target=cls.server.serve_forever)
        cls.thread.daemon = True
        cls.thread.start()
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def _url(self, path):
        return "http://127.0.0.1:%d%s" % (self.port, path)

    def test_health_endpoint(self):
        req = urllib.request.Request(self._url("/health"))
        req.add_header("Host", "127.0.0.1:%d" % self.port)
        resp = urllib.request.urlopen(req, timeout=2)
        self.assertEqual(resp.status, 200)
        data = json.loads(resp.read().decode("utf-8"))
        self.assertTrue(data.get("ok"))
        self.assertEqual(data.get("app"), "seva-bridge")

    def test_unauthorized_access(self):
        req = urllib.request.Request(self._url("/api/poll"))
        req.add_header("Host", "127.0.0.1:%d" % self.port)
        with self.assertRaises(urllib.error.HTTPError) as cm:
            urllib.request.urlopen(req, timeout=2)
        self.assertEqual(cm.exception.code, 401)

    def test_import_and_poll_flow(self):
        # 1. Post to /api/import
        payload = {
            "type": "FeatureCollection",
            "seva_exchange": "1",
            "features": [{
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]},
                "properties": {"seva_id": "test-uuid-88"}
            }]
        }
        data_bytes = json.dumps(payload).encode("utf-8")
        req_post = urllib.request.Request(self._url("/api/import"), data=data_bytes)
        req_post.add_header("Host", "127.0.0.1:%d" % self.port)
        req_post.add_header("Content-Type", "application/json")
        req_post.add_header("X-Seva-Token", self.token)
        post_resp = urllib.request.urlopen(req_post, timeout=2)
        self.assertEqual(post_resp.status, 200)

        # 2. Poll from /api/poll
        req_poll = urllib.request.Request(self._url("/api/poll"))
        req_poll.add_header("Host", "127.0.0.1:%d" % self.port)
        req_poll.add_header("X-Seva-Token", self.token)
        poll_resp = urllib.request.urlopen(req_poll, timeout=2)
        self.assertEqual(poll_resp.status, 200)
        poll_data = json.loads(poll_resp.read().decode("utf-8"))
        self.assertEqual(len(poll_data.get("items", [])), 1)
        self.assertEqual(poll_data["items"][0]["features"][0]["properties"]["seva_id"], "test-uuid-88")

    def test_host_guard_rejection(self):
        req = urllib.request.Request(self._url("/health"))
        req.add_header("Host", "malicious-domain.com")
        with self.assertRaises(urllib.error.HTTPError) as cm:
            urllib.request.urlopen(req, timeout=2)
        self.assertEqual(cm.exception.code, 403)


if __name__ == "__main__":
    unittest.main()
