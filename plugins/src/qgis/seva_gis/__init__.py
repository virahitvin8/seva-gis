# -*- coding: utf-8 -*-
"""
SEVA·GIS Precision Agriculture Bridge for QGIS 3.x
Plugin factory initialization.
"""


def classFactory(iface):
    """Load SevaGisPlugin class from file plugin.py."""
    from .plugin import SevaGisPlugin
    return SevaGisPlugin(iface)
