# -*- coding: utf-8 -*-
"""Toolbar and menu entries for SEVA.GIS Query Boxes.

Two entries on purpose: the dialog, and a run of the saved queries on whatever is
selected. Anything else would just be another way to open the same window.
"""
from __future__ import print_function

import os

from qgis.PyQt.QtGui import QIcon
from qgis.PyQt.QtWidgets import QAction, QMessageBox
from qgis.core import QgsProject, QgsWkbTypes

try:
    from . import ops, seva_core
    from .dialog import SevaGisDialog
except ImportError:
    import ops
    import seva_core
    from dialog import SevaGisDialog

TESTED_QGIS = ("3.10", "3.99")


class SevaGisPlugin(object):
    def __init__(self, iface):
        self.iface = iface
        self.plugin_dir = os.path.dirname(__file__)
        self.actions = []
        self.menu = "&SEVA.GIS"
        self.toolbar = None
        self.dialog = None

    def tr(self, text):
        return text

    def add_action(self, icon, text, callback, tooltip=""):
        action = QAction(icon, text, self.iface.mainWindow())
        action.triggered.connect(callback)
        if tooltip:
            action.setStatusTip(tooltip)
            action.setToolTip(tooltip)
        self.toolbar.addAction(action)
        self.iface.addPluginToMenu(self.menu, action)
        self.actions.append(action)
        return action

    def initGui(self):
        icon = QIcon(os.path.join(self.plugin_dir, "icon.png"))
        self.toolbar = self.iface.addToolBar("SEVA.GIS")
        self.toolbar.setObjectName("SevaGisQueryBoxesToolBar")

        self.add_action(
            icon,
            "SEVA.GIS query boxes…",
            self.open_dialog,
            "Type one sentence per box and get the layers, in order, in your panel.",
        )
        self.add_action(
            icon,
            "SEVA.GIS: run my saved queries on the selected area",
            self.run_saved,
            "Re-run the queries you arranged last time on the polygon selected now.",
        )

    def unload(self):
        for action in self.actions:
            self.iface.removePluginMenu(self.menu, action)
            self.iface.removeToolBarIcon(action)
        self.actions = []
        if self.toolbar is not None:
            del self.toolbar
            self.toolbar = None
        if self.dialog is not None:
            self.dialog.close()
            self.dialog = None

    # ------------------------------------------------------------------ actions
    def open_dialog(self):
        if self.dialog is None:
            self.dialog = SevaGisDialog(self.iface)
        self.dialog.show()
        self.dialog.raise_()
        self.dialog.activateWindow()
        return self.dialog

    def run_saved(self):
        saved = seva_core.load_plan()
        boxes = [box for box in saved.get("boxes", []) if (box.get("text") or "").strip()]
        if not boxes:
            QMessageBox.information(
                self.iface.mainWindow(),
                "SEVA.GIS",
                "No saved queries yet. Open the query boxes and write what you need first.",
            )
            self.open_dialog()
            return
        dialog = self.open_dialog()
        dialog.on_run()
