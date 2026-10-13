# -*- coding: utf-8 -*-
"""SEVA·GEE Flow - QGIS Plugin Entry Point."""

def classFactory(iface):
    """Load SEVA·GEE Flow plugin class.

    :param iface: A QGIS interface instance.
    :type iface: QgsInterface
    """
    from .plugin import SevaGeeFlowPlugin
    return SevaGeeFlowPlugin(iface)
