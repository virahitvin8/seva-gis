# -*- coding: utf-8 -*-
"""
SEVA·GIS Precision Agriculture Bridge for QGIS 3.x
Author: N. Akshit Vinay
Repository: https://github.com/virahitvin8/seva-gis
License: MIT
"""
from __future__ import print_function
import os

try:
    from qgis.PyQt.QtCore import QCoreApplication, QTimer
    from qgis.PyQt.QtGui import QIcon
    from qgis.PyQt.QtWidgets import QAction, QMessageBox
    from qgis.core import (
        QgsApplication,
        QgsProject,
        QgsMapLayerType,
        QgsWkbTypes,
    )
    from qgis.gui import QgisInterface
    HAS_QGIS = True
except ImportError:
    HAS_QGIS = False

try:
    from . import seva_core
    from . import ops
    from .dialog import SevaGisDialog
    from .provider import SevaGisProvider
except ImportError:
    import seva_core
    import ops
    from dialog import SevaGisDialog
    from provider import SevaGisProvider


class SevaGisPlugin(object):
    """QGIS Plugin Implementation for SEVA·GIS."""

    def __init__(self, iface):
        self.iface = iface
        self.plugin_dir = os.path.dirname(__file__)
        self.actions = []
        self.menu = "&SEVA·GIS"
        self.toolbar = None
        self.dialog = None
        self.provider = None
        self.timer = None

    def tr(self, message):
        if HAS_QGIS:
            return QCoreApplication.translate("SevaGisPlugin", message)
        return message

    def add_action(self, icon_path, text, callback, enabled_flag=True, status_tip=None, parent=None):
        if not HAS_QGIS:
            return None
        icon = QIcon(icon_path)
        action = QAction(icon, text, parent or self.iface.mainWindow())
        action.triggered.connect(callback)
        action.setEnabled(enabled_flag)
        if status_tip:
            action.setStatusTip(status_tip)
        self.toolbar.addAction(action)
        self.iface.addPluginToMenu(self.menu, action)
        self.actions.append(action)
        return action

    def initGui(self):
        """Create menu items, toolbar, processing provider, and background sync timer."""
        if not HAS_QGIS:
            return
        icon_path = os.path.join(self.plugin_dir, "icon.png")
        self.toolbar = self.iface.addToolBar("SEVA·GIS")
        self.toolbar.setObjectName("SevaGisToolBar")

        # 1. Main Action: Send active layer to SEVA·GIS
        self.action_send = self.add_action(
            icon_path,
            self.tr("⚡ Send Active Field to SEVA·GIS & Analyze"),
            self.send_active_layer,
            status_tip=self.tr("Extract active polygon boundary, reproject to WGS84, and launch live SEVA·GIS satellite analysis."),
        )

        # 2. Open Full SEVA·GIS Bridge Dialog
        self.action_dialog = self.add_action(
            icon_path,
            self.tr("🛰️ SEVA·GIS Desktop Link Console..."),
            self.open_dialog,
            status_tip=self.tr("Open the interactive SEVA·GIS configuration and sync window."),
        )

        # 3. Pull layers from Bridge
        self.action_pull = self.add_action(
            icon_path,
            self.tr("📥 Pull Analysis Results from SEVA·GIS"),
            self.pull_results,
            status_tip=self.tr("Retrieve computed NDVI, moisture stats, and VRA recommendations into layer attributes."),
        )

        # Initialize Processing Provider
        self.provider = SevaGisProvider()
        QgsApplication.processingRegistry().addProvider(self.provider)

        # Setup Auto-sync Timer
        cfg = seva_core.load_config()
        if cfg.get("auto", False):
            self.start_timer(int(cfg.get("auto_minutes", 2)))

    def start_timer(self, minutes):
        if not HAS_QGIS:
            return
        if self.timer:
            self.timer.stop()
        self.timer = QTimer()
        self.timer.timeout.connect(self.auto_pull)
        self.timer.start(max(1, minutes) * 60 * 1000)

    def unload(self):
        """Clean up when plugin is unloaded in QGIS."""
        if not HAS_QGIS:
            return
        if self.timer:
            self.timer.stop()
            self.timer = None
        for action in self.actions:
            self.iface.removePluginMenu(self.menu, action)
            self.iface.removeToolBarIcon(action)
        if self.toolbar:
            del self.toolbar
        if self.provider:
            QgsApplication.processingRegistry().removeProvider(self.provider)

    def open_dialog(self):
        if not HAS_QGIS:
            return
        if not self.dialog:
            self.dialog = SevaGisDialog(self.iface.mainWindow())
        self.dialog.show()
        self.dialog.raise_()
        self.dialog.activateWindow()

    def send_active_layer(self):
        """Quick send of current layer."""
        if not HAS_QGIS:
            return
        layer = self.iface.activeLayer()
        if not layer or layer.type() != QgsMapLayerType.VectorLayer:
            self.iface.messageBar().pushWarning(
                "SEVA·GIS", "Please select a vector polygon layer in the Layers panel."
            )
            return

        if layer.geometryType() != QgsWkbTypes.PolygonGeometry:
            self.iface.messageBar().pushWarning(
                "SEVA·GIS", "The active layer is not a Polygon geometry type."
            )
            return

        cfg = seva_core.load_config()
        features = ops.extract_features(
            layer,
            selected_only=(layer.selectedFeatureCount() > 0),
            default_crop=cfg.get("default_crop", "Paddy (Rice)")
        )

        if not features:
            self.iface.messageBar().pushWarning(
                "SEVA·GIS", "No valid polygon features found in active layer."
            )
            return

        payload = seva_core.make_payload(
            features,
            app="QGIS",
            app_version="3.x",
            project=QgsProject.instance().title() or "QGIS Project"
        )

        res = seva_core.send_parcels(cfg, payload)
        summary = seva_core.describe(res)
        self.iface.messageBar().pushSuccess(
            "SEVA·GIS", "Dispatched %d field(s) via: %s" % (len(features), summary)
        )

    def pull_results(self):
        if not HAS_QGIS:
            return
        cfg = seva_core.load_config()
        results = seva_core.collect_results(cfg, "QGIS")
        if not results:
            self.iface.messageBar().pushInfo(
                "SEVA·GIS", "No new results currently available in bridge queue or exchange folder."
            )
            return

        total_updated = 0
        layers = QgsProject.instance().mapLayers().values()
        for payload in results:
            for lyr in layers:
                if lyr.type() == QgsMapLayerType.VectorLayer:
                    total_updated += ops.apply_results_to_layer(lyr, payload)

        ops.load_exchange_layers(cfg.get("folder", ""))
        self.iface.messageBar().pushSuccess(
            "SEVA·GIS", "Applied results to %d feature(s)." % total_updated
        )

    def auto_pull(self):
        """Silently collect new results during background timer ticks."""
        if not HAS_QGIS:
            return
        cfg = seva_core.load_config()
        if not cfg.get("auto"):
            return
        results = seva_core.collect_results(cfg, "QGIS")
        if not results:
            return
        layers = QgsProject.instance().mapLayers().values()
        for payload in results:
            for lyr in layers:
                if lyr.type() == QgsMapLayerType.VectorLayer:
                    ops.apply_results_to_layer(lyr, payload)
        ops.load_exchange_layers(cfg.get("folder", ""))
