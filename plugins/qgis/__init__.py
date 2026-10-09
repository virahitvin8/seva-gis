# -*- coding: utf-8 -*-
"""
SEVA·GIS Precision Agriculture Bridge for QGIS 3.x
Author: N. Akshit Vinay
License: MIT
"""


def classFactory(iface):
    """Load SevaGisPlugin class from file seva_gis_plugin.

    :param iface: A QGIS interface instance.
    :type iface: QgsInterface
    """
    from .seva_gis_plugin import SevaGisPlugin

    return SevaGisPlugin(iface)
