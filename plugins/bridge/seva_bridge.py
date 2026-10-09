#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SEVA·GIS Local Bridge Daemon
Provides a zero-configuration, bi-directional HTTP communication bus between
desktop GIS software (QGIS 3, ArcMap 10.x, ArcGIS Pro) and the SEVA·GIS web application.

Usage:
    python seva_bridge.py [optional port, default 8765]
"""

import http.server
import json
import sys
from urllib.parse import urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

# Shared in-memory message bus
PENDING_IMPORTS = []
LATEST_EXPORTS = {}


class SevaBridgeHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for SEVA·GIS web client
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/health" or parsed.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            payload = {
                "status": "online",
                "bridge": "SEVA_GIS_LOCAL_BRIDGE",
                "port": PORT,
                "version": "1.0.0",
                "pending_imports_count": len(PENDING_IMPORTS),
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        if parsed.path == "/api/poll":
            # Web app polls for pending field layers sent from QGIS / ArcMap
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            if PENDING_IMPORTS:
                incoming = PENDING_IMPORTS.pop(0)
                self.wfile.write(json.dumps({"has_import": True, "data": incoming}).encode("utf-8"))
            else:
                self.wfile.write(json.dumps({"has_import": False}).encode("utf-8"))
            return

        if parsed.path == "/api/export":
            # QGIS or ArcMap fetches latest exported analysis (swaths / hotspots)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(LATEST_EXPORTS).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid JSON", "details": str(e)}).encode("utf-8"))
            return

        if parsed.path == "/api/import":
            # Received from QGIS or ArcMap
            PENDING_IMPORTS.append(payload)
            print(f"📥 [QGIS/ArcMap -> SEVA·GIS] Received field: '{payload.get('name', 'Unnamed')}' ({len(payload.get('ring', []))} vertices)")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "queued", "queue_length": len(PENDING_IMPORTS)}).encode("utf-8"))
            return

        if parsed.path == "/api/export":
            # Received from SEVA·GIS web app
            global LATEST_EXPORTS
            LATEST_EXPORTS = payload
            print(f"📤 [SEVA·GIS -> QGIS/ArcMap] Stored analysis layers: {payload.get('name', 'Export')}")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "saved"}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[SEVA Bridge {PORT}] {args[0]} {args[1]} -> {args[2]}\n")


def run():
    server_address = ("127.0.0.1", PORT)
    httpd = http.server.HTTPServer(server_address, SevaBridgeHandler)
    print("=" * 65)
    print(f"🛰️  SEVA·GIS LOCAL DESKTOP BRIDGE ACTIVE on http://127.0.0.1:{PORT}")
    print("=" * 65)
    print("• Ready to receive layers from QGIS 3 & ArcMap / ArcGIS Pro")
    print("• Ready to synchronize with SEVA·GIS web app (https://sevagis.dpdns.org)")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping SEVA·GIS Bridge.")
        httpd.server_close()


if __name__ == "__main__":
    run()
