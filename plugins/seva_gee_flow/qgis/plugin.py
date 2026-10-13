# -*- coding: utf-8 -*-
"""SEVA·GEE Flow - QGIS Plugin Implementation."""
from __future__ import print_function
import os

try:
    from PyQt5.QtCore import QCoreApplication
    from PyQt5.QtGui import QIcon
    from PyQt5.QtWidgets import QAction
    HAS_QGIS = True
except ImportError:
    HAS_QGIS = False

from .dialog import SevaGeeFlowDialog


class SevaGeeFlowPlugin(object):
    """QGIS Plugin class managing actions, menus, and the visual workflow dialog."""

    def __init__(self, iface):
        self.iface = iface
        self.plugin_dir = os.path.dirname(__file__)
        self.action = None
        self.dialog = None

    def tr(self, message):
        return QCoreApplication.translate('SevaGeeFlow', message)

    def initGui(self):
        """Initializes GUI elements when plugin is loaded into QGIS."""
        icon_path = os.path.join(self.plugin_dir, 'icon.png')
        icon = QIcon(icon_path) if os.path.exists(icon_path) else QIcon()

        self.action = QAction(icon, self.tr('SEVA·GEE Flow (Visual Earth Engine)'), self.iface.mainWindow())
        self.action.setStatusTip(self.tr('No-code Google Earth Engine workflow for QGIS'))
        self.action.triggered.connect(self.run)

        # Add to Plugins Menu and Toolbar
        self.iface.addPluginToRasterMenu(self.tr('SEVA·GEE Flow'), self.action)
        self.iface.addRasterToolBarIcon(self.action)

    def unload(self):
        """Cleans up GUI elements when plugin is disabled or uninstalled."""
        if self.action:
            self.iface.removePluginRasterMenu(self.tr('SEVA·GEE Flow'), self.action)
            self.iface.removeRasterToolBarIcon(self.action)

    def run(self):
        """Opens the SEVA·GEE Flow process box dialog."""
        if not self.dialog:
            self.dialog = SevaGeeFlowDialog(iface=self.iface, parent=self.iface.mainWindow())
        self.dialog.show()
        self.dialog.raise_()
        self.dialog.activateWindow()
