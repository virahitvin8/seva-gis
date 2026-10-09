# -*- coding: utf-8 -*-
"""
SEVA·GIS QGIS Processing Algorithm Provider
Allows running SEVA.GIS parcel dispatch and results joining inside QGIS Processing Toolbox and Modeler.
"""
from __future__ import print_function
import os

try:
    from qgis.PyQt.QtGui import QIcon
    from qgis.core import (
        QgsProcessingProvider,
        QgsProcessingAlgorithm,
        QgsProcessingParameterVectorLayer,
        QgsProcessingParameterBoolean,
        QgsProcessingParameterString,
        QgsProcessingOutputNumber,
        QgsProcessingOutputString,
        QgsWkbTypes,
    )
    HAS_QGIS = True
except ImportError:
    HAS_QGIS = False

try:
    from . import seva_core
    from . import ops
except ImportError:
    import seva_core
    import ops


class SendParcelsAlgorithm(QgsProcessingAlgorithm if HAS_QGIS else object):
    INPUT = "INPUT"
    SELECTED_ONLY = "SELECTED_ONLY"
    DEFAULT_CROP = "DEFAULT_CROP"
    OUTPUT_COUNT = "OUTPUT_COUNT"
    OUTPUT_ROUTE = "OUTPUT_ROUTE"

    def createInstance(self):
        return SendParcelsAlgorithm()

    def name(self):
        return "send_parcels"

    def displayName(self):
        return "⚡ Send Parcels to SEVA·GIS"

    def group(self):
        return "Bridge & Analytics"

    def groupId(self):
        return "bridge"

    def shortHelpString(self):
        return "Extracts polygon boundaries, reprojects to WGS84, and dispatches them to SEVA·GIS via the local bridge, exchange folder, or deep-link."

    def initAlgorithm(self, config=None):
        if not HAS_QGIS:
            return
        self.addParameter(
            QgsProcessingParameterVectorLayer(self.INPUT, "Input Cadastral/Parcel Layer", [QgsProcessingParameterVectorLayer.TypeVectorPolygon])
        )
        self.addParameter(
            QgsProcessingParameterBoolean(self.SELECTED_ONLY, "Selected features only", defaultValue=True)
        )
        self.addParameter(
            QgsProcessingParameterString(self.DEFAULT_CROP, "Crop Type", defaultValue="Paddy (Rice)")
        )
        self.addOutput(
            QgsProcessingOutputNumber(self.OUTPUT_COUNT, "Parcels Sent Count")
        )
        self.addOutput(
            QgsProcessingOutputString(self.OUTPUT_ROUTE, "Delivery Route")
        )

    def processAlgorithm(self, parameters, context, feedback):
        if not HAS_QGIS:
            return {}
        layer = self.parameterAsVectorLayer(parameters, self.INPUT, context)
        selected_only = self.parameterAsBool(parameters, self.SELECTED_ONLY, context)
        crop = self.parameterAsString(parameters, self.DEFAULT_CROP, context)

        cfg = seva_core.load_config()
        features = ops.extract_features(layer, selected_only=selected_only, default_crop=crop)
        payload = seva_core.make_payload(features, app="QGIS", app_version="3.x")
        res = seva_core.send_parcels(cfg, payload)

        return {
            self.OUTPUT_COUNT: len(features),
            self.OUTPUT_ROUTE: seva_core.describe(res)
        }


class SevaGisProvider(QgsProcessingProvider if HAS_QGIS else object):
    def loadAlgorithms(self):
        if not HAS_QGIS:
            return
        self.addAlgorithm(SendParcelsAlgorithm())

    def id(self):
        return "sevagis"

    def name(self):
        return "SEVA·GIS"

    def icon(self):
        icon_path = os.path.join(os.path.dirname(__file__), "icon.png")
        if HAS_QGIS and os.path.exists(icon_path):
            return QIcon(icon_path)
        return QIcon() if HAS_QGIS else None

    def longName(self):
        return "SEVA·GIS Precision Agriculture Processing Provider"
