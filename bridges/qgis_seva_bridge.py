# -*- coding: utf-8 -*-
"""
SEVA.GIS — Official PyQGIS Local HTTP Bridge (127.0.0.1:8765)
License: GNU General Public License v2+ (GPLv2+)
Author: N. Akshit Vinay (MSc GIS & Remote Sensing, BSc Agriculture) <virahitvin8>
Platform: QGIS 3.x Python Console / Standalone Plugin

Provides two-way interoperability:
 1. "Pull Active Field Layer into SEVA.GIS" — Converts active QgsVectorLayer to EPSG:4326 GeoJSON
 2. "Push GEE Composite to QGIS Canvas" — Loads cloud or local GeoTIFF composites into active QgsProject
"""

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread

# Import PyQGIS modules if running inside QGIS environment
try:
    from qgis.core import (
        QgsProject,
        QgsCoordinateReferenceSystem,
        QgsCoordinateTransform,
        QgsRasterLayer,
        QgsVectorLayer,
        QgsJsonExporter,
    )
    from qgis.utils import iface
    QGIS_AVAILABLE = True
except ImportError:
    QGIS_AVAILABLE = False


class SevaQgisBridgeHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_cors_headers(200)

    def do_GET(self):
        if self.path == '/status':
            self._set_cors_headers(200)
            payload = {
                'status': 'online',
                'qgisAvailable': QGIS_AVAILABLE,
                'bridge': 'PyQGIS Local HTTP Bridge',
                'port': 8765,
                'activeProject': QgsProject.instance().title() if QGIS_AVAILABLE else 'Standalone Mock',
            }
            self.wfile.write(json.dumps(payload).encode('utf-8'))
            return

        self._set_cors_headers(404)
        self.wfile.write(json.dumps({'error': 'Not Found'}).encode('utf-8'))

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        raw_body = self.rfile.read(content_length)
        
        try:
            body = json.loads(raw_body.decode('utf-8')) if raw_body else {}
        except Exception as e:
            self._set_cors_headers(400)
            self.wfile.write(json.dumps({'error': f'Invalid JSON: {str(e)}'}).encode('utf-8'))
            return

        operation = body.get('operation', 'pull_active_layer')

        if not QGIS_AVAILABLE:
            self._set_cors_headers(200)
            self.wfile.write(json.dumps({
                'status': 'mock_success',
                'message': 'PyQGIS environment not detected outside QGIS console; returning validated bridge schema.',
                'operation': operation,
            }).encode('utf-8'))
            return

        # 1. Pull Active Layer from QGIS to SEVA.GIS
        if operation == 'pull_active_layer':
            layer = iface.activeLayer() if iface else None
            if not layer or not isinstance(layer, QgsVectorLayer):
                self._set_cors_headers(400)
                self.wfile.write(json.dumps({'error': 'No active polygon vector layer selected in QGIS canvas.'}).encode('utf-8'))
                return

            exporter = QgsJsonExporter(layer)
            exporter.setSourceCrs(layer.crs())
            exporter.setDestinationCrs(QgsCoordinateReferenceSystem('EPSG:4326'))
            geojson_str = exporter.exportFeatures(layer.getFeatures())
            
            self._set_cors_headers(200)
            self.wfile.write(json.dumps({
                'status': 'ok',
                'layerName': layer.name(),
                'featureCount': layer.featureCount(),
                'geoJson': json.loads(geojson_str),
            }).encode('utf-8'))
            return

        # 2. Push GEE Composite to QGIS Canvas
        if operation == 'push_raster_to_canvas':
            raster_path = body.get('rasterPath') or body.get('tileUrl')
            layer_name = body.get('layerName', 'SEVA.GIS GEE Composite')

            if not raster_path:
                self._set_cors_headers(400)
                self.wfile.write(json.dumps({'error': 'rasterPath or tileUrl required'}).encode('utf-8'))
                return

            rlayer = QgsRasterLayer(raster_path, layer_name)
            if not rlayer.isValid():
                self._set_cors_headers(500)
                self.wfile.write(json.dumps({'error': f'Failed to load raster: {raster_path}'}).encode('utf-8'))
                return

            QgsProject.instance().addMapLayer(rlayer)
            self._set_cors_headers(200)
            self.wfile.write(json.dumps({
                'status': 'ok',
                'loadedLayer': layer_name,
                'crs': rlayer.crs().authid(),
            }).encode('utf-8'))
            return

        self._set_cors_headers(400)
        self.wfile.write(json.dumps({'error': f'Unknown operation: {operation}'}).encode('utf-8'))


def run_bridge_server(port=8765):
    server_address = ('127.0.0.1', port)
    httpd = HTTPServer(server_address, SevaQgisBridgeHandler)
    print(f"[SEVA.GIS PyQGIS Bridge] Listening on http://127.0.0.1:{port}")
    httpd.serve_forever()


if __name__ == '__main__':
    run_bridge_server()
