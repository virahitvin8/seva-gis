# -*- coding: utf-8 -*-
"""
SEVA·GIS QGIS Plugin - Interactive Dialog Window
"""

import json
from qgis.PyQt import QtCore, QtGui, QtWidgets
from qgis.core import QgsProject, QgsMapLayerType, QgsWkbTypes


class SevaGisDialog(QtWidgets.QDialog):
    def __init__(self, parent=None):
        super(SevaGisDialog, self).__init__(parent)
        self.setWindowTitle("SEVA·GIS — Precision Agriculture Bridge")
        self.resize(460, 420)
        self.init_ui()

    def init_ui(self):
        layout = QtWidgets.QVBoxLayout(self)

        # Header Title Banner
        header = QtWidgets.QFrame()
        header.setStyleSheet("background: #0f172a; border-radius: 8px; padding: 10px;")
        h_layout = QtWidgets.QHBoxLayout(header)
        title_label = QtWidgets.QLabel("🛰️ <b>SEVA·GIS BRIDGE</b><br><small style='color: #94a3b8;'>Live Satellite Farm Analytics & Robotics</small>")
        title_label.setStyleSheet("color: white; font-size: 13px;")
        h_layout.addWidget(title_label)
        layout.addWidget(header)

        # Layer Selection Group
        layer_group = QtWidgets.QGroupBox("Active Field Layer in QGIS")
        l_layout = QtWidgets.QVBoxLayout(layer_group)
        self.layer_combo = QtWidgets.QComboBox()
        self.populate_polygon_layers()
        l_layout.addWidget(QtWidgets.QLabel("Select polygon/cadastral layer:"))
        l_layout.addWidget(self.layer_combo)

        self.chk_selected_only = QtWidgets.QCheckBox("Use selected features only (recommended)")
        self.chk_selected_only.setChecked(True)
        l_layout.addWidget(self.chk_selected_only)
        layout.addWidget(layer_group)

        # Agronomy Crop Configuration
        crop_group = QtWidgets.QGroupBox("Field & Agronomic Parameters")
        c_layout = QtWidgets.QFormLayout(crop_group)
        self.txt_farm_name = QtWidgets.QLineEdit("QGIS Field")
        self.combo_crop = QtWidgets.QComboBox()
        self.combo_crop.addItems([
            "Paddy (Rice)", "Wheat", "Cotton", "Maize",
            "Sugarcane", "Soybean", "Mustard", "Tomato",
            "Potato", "Pulses", "Uncultivated / Bare Land"
        ])
        c_layout.addRow("Farm / Plot Name:", self.txt_farm_name)
        c_layout.addRow("Crop Type:", self.combo_crop)
        layout.addWidget(crop_group)

        # Bridge URL Endpoint
        bridge_group = QtWidgets.QGroupBox("SEVA·GIS Application Target")
        b_layout = QtWidgets.QFormLayout(bridge_group)
        self.txt_url = QtWidgets.QLineEdit("https://sevagis.dpdns.org")
        self.chk_local_bridge = QtWidgets.QCheckBox("Use Local Real-time Bridge Daemon (127.0.0.1:8765)")
        b_layout.addRow("Web App URL:", self.txt_url)
        b_layout.addRow("", self.chk_local_bridge)
        layout.addWidget(bridge_group)

        # Action Buttons
        btn_layout = QtWidgets.QHBoxLayout()
        self.btn_send = QtWidgets.QPushButton("⚡ Send to SEVA·GIS & Analyze")
        self.btn_send.setStyleSheet(
            "background-color: #10b981; color: white; font-weight: bold; padding: 8px 14px; border-radius: 6px;"
        )
        self.btn_cancel = QtWidgets.QPushButton("Close")
        btn_layout.addWidget(self.btn_send)
        btn_layout.addWidget(self.btn_cancel)
        layout.addLayout(btn_layout)

        # Status / Feedback label
        self.lbl_status = QtWidgets.QLabel("Select a polygon layer and click 'Send to SEVA·GIS'.")
        self.lbl_status.setWordWrap(True)
        self.lbl_status.setStyleSheet("color: #64748b; font-size: 11px; margin-top: 4px;")
        layout.addWidget(self.lbl_status)

        self.btn_cancel.clicked.connect(self.reject)

    def populate_polygon_layers(self):
        self.layer_combo.clear()
        layers = QgsProject.instance().mapLayers().values()
        found = False
        for lyr in layers:
            if lyr.type() == QgsMapLayerType.VectorLayer:
                geom_type = lyr.geometryType()
                if geom_type == QgsWkbTypes.PolygonGeometry:
                    self.layer_combo.addItem(lyr.name(), lyr.id())
                    found = True
        if not found:
            self.layer_combo.addItem("No polygon layers found", None)
