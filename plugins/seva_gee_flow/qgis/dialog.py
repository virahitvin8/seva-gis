# -*- coding: utf-8 -*-
"""SEVA·GEE Flow - QGIS GUI Dialog
Implements the modular re-orderable query-box interface for Google Earth Engine in QGIS.
"""
from __future__ import print_function
import json, os

try:
    from PyQt5 import QtCore, QtGui, QtWidgets
    from qgis.core import (
        QgsProject, QgsRasterLayer, QgsVectorLayer, QgsWkbTypes,
        QgsFeature, QgsGeometry, QgsPointXY, QgsField, QgsCoordinateReferenceSystem
    )
    from qgis.gui import QgsMapCanvas
    HAS_QGIS = True
except ImportError:
    HAS_QGIS = False

from .gee_engine import GeeFlowEngine, ProcessBox


class SevaGeeFlowDialog(QtWidgets.QDialog if HAS_QGIS else object):
    """Main interactive window for SEVA·GEE Flow plugin."""

    def __init__(self, iface=None, parent=None):
        if not HAS_QGIS:
            return
        super(SevaGeeFlowDialog, self).__init__(parent)
        self.iface = iface
        self.engine = GeeFlowEngine()
        self.boxes = []
        self.setWindowTitle("SEVA·GEE Flow — Automated Google Earth Engine for QGIS")
        self.resize(760, 620)
        self.init_default_boxes()
        self.init_ui()

    def init_default_boxes(self):
        """Initializes standard starter process boxes so user can run immediately."""
        self.boxes = [
            {
                'title': 'Box 1: Area of Interest (AOI Boundary)',
                'type': 'aoi',
                'summary': 'Active QGIS polygon layer / drawn field boundary',
                'params': {'layer': 'Active Canvas AOI', 'clip': True}
            },
            {
                'title': 'Box 2: Date Range & Cloud Cover Limit',
                'type': 'filter',
                'summary': 'Sentinel-2 L2A · 2024-06-01 to 2024-09-30 · Max Cloud: 15%',
                'params': {'start_date': '2024-06-01', 'end_date': '2024-09-30', 'max_cloud': 15}
            },
            {
                'title': 'Box 3: Spectral Vegetation & Moisture Indices',
                'type': 'indices',
                'summary': 'NDVI (Canopy Vigor), EVI, SAVI, NDWI (Moisture)',
                'params': {'selected_indices': ['NDVI', 'NDWI', 'EVI', 'SAVI']}
            },
            {
                'title': 'Box 4: Danger / Hotspot & Healthy Crop Zones',
                'type': 'zones',
                'summary': 'Automatic polygonization of stress hotspots (red) and healthy crops (green)',
                'params': {'stress_threshold': 0.35, 'healthy_threshold': 0.65}
            },
            {
                'title': 'Box 5: Water Drainage & Flow Stream Lines',
                'type': 'streams',
                'summary': 'D8 hydrological flow paths & surface drainage vectors from DEM',
                'params': {'min_accumulation': 50}
            }
        ]

    def init_ui(self):
        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(10)

        # 1. Header Banner
        header = QtWidgets.QFrame()
        header.setStyleSheet("background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #064e3b, stop:1 #0f172a); border-radius: 8px; padding: 10px;")
        h_layout = QtWidgets.QHBoxLayout(header)
        title_label = QtWidgets.QLabel(
            "<span style='font-size: 15px; font-weight: bold; color: #34d399;'>🌱 SEVA·GEE Flow</span> "
            "<span style='font-size: 11px; color: #a7f3d0; background: #065f46; padding: 2px 6px; border-radius: 4px;'>v2.0</span><br>"
            "<span style='color: #cbd5e1; font-size: 11px;'>No-Code Google Earth Engine Workflow for Desktop QGIS · <i>Everything is free to the public</i></span>"
        )
        h_layout.addWidget(title_label)
        layout.addWidget(header)

        # 2. Main Body Splitter
        splitter = QtWidgets.QSplitter(QtCore.Qt.Horizontal)

        # Left Side: Re-orderable Query Box Stack
        left_widget = QtWidgets.QWidget()
        left_layout = QtWidgets.QVBoxLayout(left_widget)
        left_layout.setContentsMargins(0, 0, 0, 0)

        stack_label = QtWidgets.QLabel("<b>Pipeline Process Boxes (Re-orderable Stack):</b>")
        left_layout.addWidget(stack_label)

        self.box_list = QtWidgets.QListWidget()
        self.box_list.setStyleSheet(
            "QListWidget { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; }"
            "QListWidget::item { padding: 8px; border-bottom: 1px solid #e2e8f0; }"
            "QListWidget::item:selected { background: #d1fae5; color: #065f46; font-weight: bold; }"
        )
        self.box_list.currentRowChanged.connect(self.on_box_selected)
        left_layout.addWidget(self.box_list)

        # Re-order and Manage Buttons Bar
        btn_bar = QtWidgets.QHBoxLayout()
        self.btn_up = QtWidgets.QPushButton("▲ Move Up")
        self.btn_up.clicked.connect(self.move_box_up)
        self.btn_down = QtWidgets.QPushButton("▼ Move Down")
        self.btn_down.clicked.connect(self.move_box_down)
        self.btn_delete = QtWidgets.QPushButton("✕ Remove")
        self.btn_delete.clicked.connect(self.remove_box)
        btn_bar.addWidget(self.btn_up)
        btn_bar.addWidget(self.btn_down)
        btn_bar.addWidget(self.btn_delete)
        left_layout.addLayout(btn_bar)

        # Add New Box Menu Button
        self.btn_add = QtWidgets.QPushButton("+ Add Process Box")
        self.btn_add.setStyleSheet("background: #059669; color: white; font-weight: bold; padding: 6px; border-radius: 4px;")
        add_menu = QtWidgets.QMenu(self)
        add_menu.addAction("Area of Interest (AOI Boundary)", lambda: self.add_new_box('aoi'))
        add_menu.addAction("Date Range & Cloud Filter", lambda: self.add_new_box('filter'))
        add_menu.addAction("Spectral Indices (NDVI, EVI, SAVI, NDWI)", lambda: self.add_new_box('indices'))
        add_menu.addAction("Danger Hotspots & Healthy Zones (Vectors)", lambda: self.add_new_box('zones'))
        add_menu.addAction("Water Flow Streams & Watershed (Hydrology)", lambda: self.add_new_box('streams'))
        add_menu.addAction("Infrastructure & Pole Detection", lambda: self.add_new_box('infrastructure'))
        self.btn_add.setMenu(add_menu)
        left_layout.addWidget(self.btn_add)

        splitter.addWidget(left_widget)

        # Right Side: Parameter Detail Box
        right_widget = QtWidgets.QWidget()
        self.right_layout = QtWidgets.QVBoxLayout(right_widget)
        self.right_layout.setContentsMargins(8, 0, 0, 0)

        detail_header = QtWidgets.QLabel("<b>Box Parameters & Settings:</b>")
        self.right_layout.addWidget(detail_header)

        self.detail_area = QtWidgets.QScrollArea()
        self.detail_area.setWidgetResizable(True)
        self.detail_container = QtWidgets.QWidget()
        self.detail_container_layout = QtWidgets.QVBoxLayout(self.detail_container)
        self.detail_area.setWidget(self.detail_container)
        self.right_layout.addWidget(self.detail_area)

        splitter.addWidget(right_widget)
        splitter.setStretchFactor(0, 1)
        splitter.setStretchFactor(1, 1)
        layout.addWidget(splitter)

        # 3. Action Footer
        footer = QtWidgets.QHBoxLayout()
        self.status_lbl = QtWidgets.QLabel("Ready. Select or add process boxes then execute.")
        self.status_lbl.setStyleSheet("color: #64748b; font-size: 11px;")
        footer.addWidget(self.status_lbl)

        self.btn_code = QtWidgets.QPushButton("</> View GEE JavaScript")
        self.btn_code.clicked.connect(self.show_gee_javascript)
        footer.addWidget(self.btn_code)

        self.btn_run = QtWidgets.QPushButton("▶ Execute & Add Layers to QGIS")
        self.btn_run.setStyleSheet("background: #2563eb; color: white; font-weight: bold; padding: 8px 16px; border-radius: 6px; font-size: 12px;")
        self.btn_run.clicked.connect(self.execute_pipeline)
        footer.addWidget(self.btn_run)

        layout.addLayout(footer)
        self.refresh_box_list()

    def refresh_box_list(self):
        """Re-populates the list widget from self.boxes array."""
        self.box_list.clear()
        for i, b in enumerate(self.boxes):
            item = QtWidgets.QListWidgetItem(b.get('title', 'Box ' + str(i + 1)))
            item.setToolTip(b.get('summary', ''))
            self.box_list.addItem(item)
        if self.boxes:
            self.box_list.setCurrentRow(0)

    def on_box_selected(self, row):
        """Displays parameters for the selected box."""
        if row < 0 or row >= len(self.boxes):
            return
        b = self.boxes[row]
        # Clear detail container
        while self.detail_container_layout.count():
            item = self.detail_container_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        # Build controls based on box type
        title = QtWidgets.QLabel("<h3>" + b.get('title', '') + "</h3>")
        self.detail_container_layout.addWidget(title)
        desc = QtWidgets.QLabel("<p style='color:#475569;'>" + b.get('summary', '') + "</p>")
        self.detail_container_layout.addWidget(desc)

        t = b.get('type')
        if t == 'filter':
            form = QtWidgets.QFormLayout()
            start_in = QtWidgets.QLineEdit(b['params'].get('start_date', '2024-06-01'))
            end_in = QtWidgets.QLineEdit(b['params'].get('end_date', '2024-09-30'))
            cloud_in = QtWidgets.QSpinBox()
            cloud_in.setRange(0, 100)
            cloud_in.setValue(b['params'].get('max_cloud', 15))
            form.addRow("Start Date (YYYY-MM-DD):", start_in)
            form.addRow("End Date (YYYY-MM-DD):", end_in)
            form.addRow("Max Cloud Cover (%):", cloud_in)
            self.detail_container_layout.addLayout(form)
        elif t == 'indices':
            grp = QtWidgets.QGroupBox("Calculate Indices")
            gl = QtWidgets.QVBoxLayout(grp)
            for name in ['NDVI (Crop Health)', 'EVI (Dense Canopy)', 'SAVI (Soil-Adjusted)', 'NDWI (Moisture/Water)', 'NDMI (Canopy Moisture)', 'True Color RGB (4-3-2)']:
                cb = QtWidgets.QCheckBox(name)
                cb.setChecked(True)
                gl.addWidget(cb)
            self.detail_container_layout.addWidget(grp)
        elif t == 'zones':
            form = QtWidgets.QFormLayout()
            stress_slider = QtWidgets.QDoubleSpinBox()
            stress_slider.setValue(b['params'].get('stress_threshold', 0.35))
            stress_slider.setRange(0.1, 0.9)
            stress_slider.setSingleStep(0.05)
            form.addRow("Stress Danger Threshold (NDVI <):", stress_slider)
            form.addRow("Healthy Crop Threshold (NDVI >):", QtWidgets.QLabel("0.65"))
            form.addRow("Output Format:", QtWidgets.QLabel("Vector Polygon Layer (Red & Green)"))
            self.detail_container_layout.addLayout(form)
        elif t == 'streams':
            form = QtWidgets.QFormLayout()
            form.addRow("DEM Source:", QtWidgets.QLabel("Copernicus GLO-30 Digital Elevation Model"))
            form.addRow("Routing Algorithm:", QtWidgets.QLabel("D8 Priority-Flood Runoff Accumulation"))
            form.addRow("Layer Output:", QtWidgets.QLabel("Vector Stream Line Network (Blues)"))
            self.detail_container_layout.addLayout(form)
        else:
            self.detail_container_layout.addWidget(QtWidgets.QLabel("Configuration active for this processing step."))

        self.detail_container_layout.addStretch()

    def move_box_up(self):
        row = self.box_list.currentRow()
        if row > 0:
            self.boxes[row], self.boxes[row - 1] = self.boxes[row - 1], self.boxes[row]
            self.refresh_box_list()
            self.box_list.setCurrentRow(row - 1)

    def move_box_down(self):
        row = self.box_list.currentRow()
        if 0 <= row < len(self.boxes) - 1:
            self.boxes[row], self.boxes[row + 1] = self.boxes[row + 1], self.boxes[row]
            self.refresh_box_list()
            self.box_list.setCurrentRow(row + 1)

    def remove_box(self):
        row = self.box_list.currentRow()
        if 0 <= row < len(self.boxes):
            self.boxes.pop(row)
            self.refresh_box_list()

    def add_new_box(self, box_type):
        titles = {
            'aoi': 'Box: Area of Interest Boundary',
            'filter': 'Box: Date & Cloud Filter',
            'indices': 'Box: Multi-Spectral Indices',
            'zones': 'Box: Danger / Healthy Crop Zones',
            'streams': 'Box: Water Drainage Streams',
            'infrastructure': 'Box: Infrastructure & Pole Detection'
        }
        self.boxes.append({
            'title': titles.get(box_type, 'Box: Custom Step'),
            'type': box_type,
            'summary': 'Custom pipeline process step',
            'params': {}
        })
        self.refresh_box_list()
        self.box_list.setCurrentRow(len(self.boxes) - 1)

    def show_gee_javascript(self):
        """Displays generated Earth Engine JavaScript in a modal dialog."""
        code = self.engine.build_gee_javascript(self.boxes, [[78.16, 23.24], [78.18, 23.24], [78.18, 23.26], [78.16, 23.26], [78.16, 23.24]])
        dlg = QtWidgets.QDialog(self)
        dlg.setWindowTitle("Generated Google Earth Engine Script")
        dlg.resize(640, 480)
        l = QtWidgets.QVBoxLayout(dlg)
        txt = QtWidgets.QTextEdit()
        txt.setPlainText(code)
        txt.setReadOnly(True)
        txt.setStyleSheet("font-family: monospace; font-size: 11px;")
        l.addWidget(txt)
        btn_copy = QtWidgets.QPushButton("Copy to Clipboard")
        btn_copy.clicked.connect(lambda: QtWidgets.QApplication.clipboard().setText(code))
        l.addWidget(btn_copy)
        dlg.exec_()

    def execute_pipeline(self):
        """Executes the box stack and creates QGIS layers directly in the active project."""
        self.status_lbl.setText("Executing pipeline & loading layers into QGIS...")
        QtWidgets.QApplication.processEvents()

        results = self.engine.execute_and_load(self.boxes)
        project = QgsProject.instance()

        for r in results:
            t = r.get('type')
            name = r.get('name', 'Layer')
            if t == 'raster':
                uri = "type=xyz&url=" + r.get('url', '')
                layer = QgsRasterLayer(uri, name, "wms")
                if layer.isValid():
                    project.addMapLayer(layer)
            elif t in ('vector_polygon', 'vector_line', 'vector_point'):
                geom_type = "Polygon" if t == 'vector_polygon' else "LineString" if t == 'vector_line' else "Point"
                uri = geom_type + "?crs=epsg:4326"
                vlayer = QgsVectorLayer(uri, name, "memory")
                if vlayer.isValid():
                    project.addMapLayer(vlayer)

        self.status_lbl.setText("✓ " + str(len(results)) + " layers successfully added to QGIS project.")
        QtWidgets.QMessageBox.information(
            self,
            "Pipeline Complete",
            "SEVA·GEE Flow has executed your " + str(len(self.boxes)) + " process boxes and loaded " + str(len(results)) + " layers into QGIS with standard symbology."
        )
