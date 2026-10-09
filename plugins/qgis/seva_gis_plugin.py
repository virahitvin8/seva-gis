# -*- coding: utf-8 -*-
"""
SEVA·GIS Precision Agriculture Bridge for QGIS 3.x
Author: N. Akshit Vinay
Repository: https://github.com/virahitvin8/seva-gis
License: MIT
"""

import base64
import json
import os
import urllib.parse
import urllib.request
import webbrowser

from qgis.PyQt.QtCore import QCoreApplication, Qt
from qgis.PyQt.QtGui import QIcon
from qgis.PyQt.QtWidgets import QAction, QMessageBox

from qgis.core import (
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsFeature,
    QgsField,
    QgsGeometry,
    QgsMessageLog,
    QgsPointXY,
    QgsProject,
    QgsVectorLayer,
    QgsWkbTypes,
)
from qgis.gui import QgisInterface

from .seva_gis_dialog import SevaGisDialog


class SevaGisPlugin:
    """QGIS Plugin Implementation for SEVA·GIS."""

    def __init__(self, iface: QgisInterface):
        self.iface = iface
        self.plugin_dir = os.path.dirname(__file__)
        self.actions = []
        self.menu = "&SEVA·GIS"
        self.toolbar = self.iface.addToolBar("SEVA·GIS")
        self.toolbar.setObjectName("SevaGisToolBar")
        self.dialog = None

    def tr(self, message):
        return QCoreApplication.translate("SevaGisPlugin", message)

    def add_action(self, icon_path, text, callback, enabled_flag=True, status_tip=None, whats_this=None, parent=None):
        icon = QIcon(icon_path)
        action = QAction(icon, text, parent or self.iface.mainWindow())
        action.triggered.connect(callback)
        action.setEnabled(enabled_flag)
        if status_tip:
            action.setStatusTip(status_tip)
        if whats_this:
            action.setWhatsThis(whats_this)
        self.toolbar.addAction(action)
        self.iface.addPluginToMenu(self.menu, action)
        self.actions.append(action)
        return action

    def initGui(self):
        """Create the menu items and toolbar buttons inside QGIS."""
        icon_path = os.path.join(self.plugin_dir, "icon.png")

        # Main Action: Send active layer to SEVA·GIS
        self.action_send = self.add_action(
            icon_path,
            self.tr("⚡ Send Active Field to SEVA·GIS & Analyze"),
            self.send_active_layer,
            status_tip=self.tr("Extract active polygon boundary, reproject to WGS84, and launch live SEVA·GIS satellite analysis."),
        )

        # Secondary Action: Open Full SEVA·GIS Bridge Dialog
        self.action_dialog = self.add_action(
            icon_path,
            self.tr("🛰️ SEVA·GIS Bridge Console..."),
            self.open_dialog,
            status_tip=self.tr("Open the interactive SEVA·GIS bridge window with layer and crop selectors."),
        )

        # Third Action: Pull layers from Local Bridge
        self.action_pull = self.add_action(
            icon_path,
            self.tr("📥 Pull Tractor Swaths & Hotspots from SEVA·GIS"),
            self.pull_from_bridge,
            status_tip=self.tr("Retrieve computed Fields2Cover swath lines and GPS hotspot pins from SEVA·GIS."),
        )

    def unload(self):
        """Clean up when plugin is unloaded in QGIS."""
        for action in self.actions:
            self.iface.removePluginMenu(self.menu, action)
            self.iface.removeToolBarIcon(action)
        if self.toolbar:
            del self.toolbar

    def open_dialog(self):
        """Show the interactive bridge dialog."""
        if not self.dialog:
            self.dialog = SevaGisDialog(self.iface.mainWindow())
            self.dialog.btn_send.clicked.connect(self.process_dialog_send)
        self.dialog.populate_polygon_layers()
        self.dialog.show()
        self.dialog.raise_()
        self.dialog.activateWindow()

    def extract_polygon_wgs84(self, layer, use_selected_only=True):
        """Reprojects features to EPSG:4326 and returns coordinates and metadata."""
        if not layer or layer.type() != layer.VectorLayer:
            raise ValueError("Selected layer is not a valid vector layer.")

        crs_src = layer.crs()
        crs_wgs84 = QgsCoordinateReferenceSystem("EPSG:4326")
        transform = QgsCoordinateTransform(crs_src, crs_wgs84, QgsProject.instance())

        features = layer.selectedFeatures() if use_selected_only and layer.selectedFeatureCount() > 0 else layer.getFeatures()
        
        polygon_rings = []
        feature_name = layer.name()
        
        for feat in features:
            geom = feat.geometry()
            if not geom:
                continue
            geom_wgs = QgsGeometry(geom)
            geom_wgs.transform(transform)

            # Support Polygon and MultiPolygon
            if geom_wgs.isMultipart():
                polys = geom_wgs.asMultiPolygon()
                for poly in polys:
                    if poly and len(poly[0]) >= 3:
                        polygon_rings.append([[round(pt.x(), 6), round(pt.y(), 6)] for pt in poly[0]])
            else:
                poly = geom_wgs.asPolygon()
                if poly and len(poly[0]) >= 3:
                    polygon_rings.append([[round(pt.x(), 6), round(pt.y(), 6)] for pt in poly[0]])
            
            # Try to grab feature name attribute if exists
            for attr in ['name', 'Name', 'farm', 'Farm', 'khasra', 'survey_no', 'FIELD_ID', 'id']:
                if attr in feat.fields().names() and feat[attr]:
                    feature_name = str(feat[attr])
                    break

        if not polygon_rings:
            raise ValueError("No valid polygon geometries found in the selected layer or feature selection.")

        # Return primary ring (or first ring)
        return polygon_rings[0], feature_name

    def send_active_layer(self):
        """Direct 1-click action: extracts current active layer in QGIS and launches SEVA·GIS."""
        layer = self.iface.activeLayer()
        if not layer:
            self.iface.messageBar().pushWarning("SEVA·GIS", "Please select a field polygon layer in the QGIS Layers panel first.")
            return

        try:
            ring, name = self.extract_polygon_wgs84(layer, use_selected_only=True)
            self.transmit_to_sevagis(ring, name=name, crop="Paddy (Rice)", base_url="https://sevagis.dpdns.org")
        except Exception as e:
            self.iface.messageBar().pushCritical("SEVA·GIS Error", str(e))

    def process_dialog_send(self):
        """Handler for dialog 'Send to SEVA·GIS' button."""
        layer_id = self.dialog.layer_combo.currentData()
        if not layer_id:
            self.dialog.lbl_status.setText("❌ No polygon layer selected.")
            return

        layer = QgsProject.instance().mapLayer(layer_id)
        if not layer:
            self.dialog.lbl_status.setText("❌ Layer not found.")
            return

        use_selected = self.dialog.chk_selected_only.isChecked()
        farm_name = self.dialog.txt_farm_name.text().strip() or layer.name()
        crop_type = self.dialog.combo_crop.currentText()
        base_url = self.dialog.txt_url.text().strip() or "https://sevagis.dpdns.org"
        use_daemon = self.dialog.chk_local_bridge.isChecked()

        try:
            ring, extracted_name = self.extract_polygon_wgs84(layer, use_selected_only=use_selected)
            final_name = farm_name if farm_name != "QGIS Field" else extracted_name

            if use_daemon:
                self.send_to_local_bridge_daemon(ring, final_name, crop_type)
                self.dialog.lbl_status.setText(f"✅ Transmitted '{final_name}' to local bridge daemon (127.0.0.1:8765).")
            else:
                self.transmit_to_sevagis(ring, name=final_name, crop=crop_type, base_url=base_url)
                self.dialog.lbl_status.setText(f"🚀 Transmitted '{final_name}' to SEVA·GIS! Browser opened.")

            self.iface.messageBar().pushSuccess("SEVA·GIS Bridge", f"Field '{final_name}' sent to SEVA·GIS! Live satellite telemetry initiated.")
            self.dialog.accept()
        except Exception as e:
            self.dialog.lbl_status.setText(f"❌ Error: {str(e)}")
            self.iface.messageBar().pushCritical("SEVA·GIS Error", str(e))

    def transmit_to_sevagis(self, ring, name="QGIS Field", crop="Paddy (Rice)", base_url="https://sevagis.dpdns.org"):
        """Constructs deep-link payload and opens browser."""
        payload = {
            "source": "qgis",
            "name": name,
            "crop": crop,
            "ring": ring,
        }
        json_str = json.dumps(payload)
        b64_data = base64.urlsafe_b64encode(json_str.encode("utf-8")).decode("utf-8")

        # Build clean deep-link
        target_url = f"{base_url.rstrip('/')}/?import={b64_data}"
        webbrowser.open(target_url, new=2)

    def send_to_local_bridge_daemon(self, ring, name, crop):
        """Sends payload directly to local bridge daemon via HTTP POST."""
        payload = {
            "source": "qgis",
            "name": name,
            "crop": crop,
            "ring": ring,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "http://127.0.0.1:8765/api/import",
            data=data,
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=3) as resp:
                pass
        except Exception as e:
            # Fallback to direct browser URL if daemon is not running
            self.transmit_to_sevagis(ring, name=name, crop=crop)

    def pull_from_bridge(self):
        """Pulls generated tractor swaths and scout hotspots from local bridge daemon or exports."""
        try:
            req = urllib.request.Request("http://127.0.0.1:8765/api/export")
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                self.load_geojson_to_qgis(data)
                self.iface.messageBar().pushSuccess("SEVA·GIS", "Loaded latest analysis layers from SEVA·GIS into QGIS!")
        except Exception as e:
            QMessageBox.information(
                self.iface.mainWindow(),
                "SEVA·GIS Local Bridge",
                f"No active local bridge found on http://127.0.0.1:8765.\n\n"
                f"To pull directly:\n"
                f"1. Run 'python seva_bridge.py' on your computer.\n"
                f"2. Or export GeoJSON from the SEVA·GIS dashboard and drag it into QGIS.",
            )

    def load_geojson_to_qgis(self, geojson_data):
        """Creates temporary memory layers for swaths or hotspots."""
        if not geojson_data or "features" not in geojson_data:
            return

        vl = QgsVectorLayer("LineString?crs=epsg:4326", "SEVA·GIS Tractor Swaths", "memory")
        pr = vl.dataProvider()
        # Add features
        feats = []
        for f_data in geojson_data["features"]:
            geom_type = f_data.get("geometry", {}).get("type")
            coords = f_data.get("geometry", {}).get("coordinates", [])
            if geom_type == "LineString":
                q_feat = QgsFeature()
                pts = [QgsPointXY(c[0], c[1]) for c in coords]
                q_feat.setGeometry(QgsGeometry.fromPolylineXY(pts))
                feats.append(q_feat)
        if feats:
            pr.addFeatures(feats)
            vl.updateExtents()
            QgsProject.instance().addMapLayer(vl)
