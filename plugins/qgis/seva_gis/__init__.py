# -*- coding: utf-8 -*-
"""SEVA.GIS Query Boxes for QGIS 3.x.

Installation is the ordinary QGIS path: Plugins > Manage and Install Plugins >
Install from ZIP, or drop this folder into your QGIS plugin directory.
"""


def classFactory(iface):
    """QGIS entry point."""
    from .plugin import SevaGisPlugin

    return SevaGisPlugin(iface)
