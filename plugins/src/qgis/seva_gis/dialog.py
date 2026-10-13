# -*- coding: utf-8 -*-
"""
SEVA·GIS QGIS Plugin - Configuration & Operations Dialog
"""
from __future__ import print_function
import os

try:
    from qgis.PyQt import QtCore, QtGui, QtWidgets
    from qgis.core import QgsProject, QgsMapLayerType, QgsWkbTypes
    HAS_QGIS = True
except ImportError:
    HAS_QGIS = False

try:
    from . import seva_core
    from . import ops
except ImportError:
    import seva_core
    import ops


class SevaGisDialog(QtWidgets.QDialog if HAS_QGIS else object):
    def __init__(self, parent=None):
        if not HAS_QGIS:
            return
        super(SevaGisDialog, self).__init__(parent)
        self.setWindowTitle("SEVA·GIS — Precision Agriculture Desktop Link")
        self.resize(520, 560)
        self.cfg = seva_core.load_config()
        self.init_ui()

    def init_ui(self):
        layout = QtWidgets.QVBoxLayout(self)

        # Header Title Banner
        header = QtWidgets.QFrame()
        header.setStyleSheet("background: #0f172a; border-radius: 8px; padding: 12px; margin-bottom: 6px;")
        h_layout = QtWidgets.QHBoxLayout(header)
        title_label = QtWidgets.QLabel(
            "<span style='font-size: 15px; font-weight: bold; color: #34d399;'>🛰️ SEVA·GIS Precision Agriculture Bridge</span><br>"
            "<span style='color: #94a3b8; font-size: 11px;'>Two-way sync: Desktop QGIS &harr; In-browser GeoAI & Robotics</span>"
        )
        h_layout.addWidget(title_label)
        layout.addWidget(header)

        # Tabs for cleanly organized settings
        tabs = QtWidgets.QTabWidget()
        layout.addWidget(tabs)

        # Tab 1: Dispatch Parcels
        tab_send = QtWidgets.QWidget()
        s_layout = QtWidgets.QVBoxLayout(tab_send)

        # Layer Selection Group
        layer_group = QtWidgets.QGroupBox("Active Field Layer in QGIS")
        l_layout = QtWidgets.QVBoxLayout(layer_group)
        self.layer_combo = QtWidgets.QComboBox()
        self.populate_polygon_layers()
        self.layer_combo.currentIndexChanged.connect(self.on_layer_changed)
        l_layout.addWidget(QtWidgets.QLabel("Select polygon/cadastral layer:"))
        l_layout.addWidget(self.layer_combo)

        self.chk_selected_only = QtWidgets.QCheckBox("Use selected features only (recommended)")
        self.chk_selected_only.setChecked(True)
        l_layout.addWidget(self.chk_selected_only)
        s_layout.addWidget(layer_group)

        # Attribute Field Mapping
        attr_group = QtWidgets.QGroupBox("Field & Agronomic Attributes")
        a_layout = QtWidgets.QFormLayout(attr_group)

        self.combo_name_field = QtWidgets.QComboBox()
        self.combo_crop_field = QtWidgets.QComboBox()
        self.combo_default_crop = QtWidgets.QComboBox()
        self.combo_default_crop.addItems([
            "Paddy (Rice)", "Wheat", "Cotton", "Maize",
            "Sugarcane", "Soybean", "Mustard", "Tomato",
            "Potato", "Pulses", "Coconut", "Groundnut", "Sunflower",
            "Uncultivated / Bare Land"
        ])
        default_idx = self.combo_default_crop.findText(self.cfg.get("default_crop", "Paddy (Rice)"))
        if default_idx >= 0:
            self.combo_default_crop.setCurrentIndex(default_idx)

        a_layout.addRow("Field Name attribute:", self.combo_name_field)
        a_layout.addRow("Crop attribute field (optional):", self.combo_crop_field)
        a_layout.addRow("Default Crop (fallback):", self.combo_default_crop)
        s_layout.addWidget(attr_group)

        # Trigger Action Button
        btn_send_box = QtWidgets.QHBoxLayout()
        self.btn_send = QtWidgets.QPushButton("⚡ Send Field to SEVA·GIS & Analyze")
        self.btn_send.setStyleSheet(
            "background-color: #059669; color: white; font-weight: bold; font-size: 13px; padding: 10px 16px; border-radius: 6px;"
        )
        self.btn_send.clicked.connect(self.on_send_clicked)
        btn_send_box.addWidget(self.btn_send)
        s_layout.addLayout(btn_send_box)

        self.lbl_send_status = QtWidgets.QLabel("")
        self.lbl_send_status.setWordWrap(True)
        self.lbl_send_status.setStyleSheet("color: #059669; font-size: 11px;")
        s_layout.addWidget(self.lbl_send_status)
        s_layout.addStretch()

        tabs.addTab(tab_send, "🚀 Send Fields")

        # Tab 2: Connection & Two-Way Sync Settings
        tab_sync = QtWidgets.QWidget()
        sy_layout = QtWidgets.QVBoxLayout(tab_sync)

        conn_group = QtWidgets.QGroupBox("Local Bridge & Web App Connection")
        c_layout = QtWidgets.QFormLayout(conn_group)

        self.txt_seva_url = QtWidgets.QLineEdit(self.cfg.get("seva_url", seva_core.APP_URL))
        self.txt_bridge_url = QtWidgets.QLineEdit(self.cfg.get("bridge_url", seva_core.BRIDGE_URL))
        self.txt_token = QtWidgets.QLineEdit(self.cfg.get("token", ""))
        self.txt_token.setPlaceholderText("Auto-detected from ~/.seva/bridge_token if empty")

        test_bridge_box = QtWidgets.QHBoxLayout()
        self.btn_test_bridge = QtWidgets.QPushButton("Test Bridge Health")
        self.lbl_bridge_health = QtWidgets.QLabel("Status: unknown")
        self.btn_test_bridge.clicked.connect(self.test_bridge_connection)
        test_bridge_box.addWidget(self.btn_test_bridge)
        test_bridge_box.addWidget(self.lbl_bridge_health)

        c_layout.addRow("SEVA Web App URL:", self.txt_seva_url)
        c_layout.addRow("Local Bridge URL:", self.txt_bridge_url)
        c_layout.addRow("Pairing Token:", self.txt_token)
        c_layout.addRow("", test_bridge_box)
        sy_layout.addWidget(conn_group)

        # Exchange Folder Settings
        folder_group = QtWidgets.QGroupBox("File Exchange Folder (Optional Atomic Sync)")
        f_layout = QtWidgets.QFormLayout(folder_group)
        folder_picker_box = QtWidgets.QHBoxLayout()
        self.txt_folder = QtWidgets.QLineEdit(self.cfg.get("folder", ""))
        self.btn_browse = QtWidgets.QPushButton("Browse...")
        self.btn_browse.clicked.connect(self.browse_folder)
        folder_picker_box.addWidget(self.txt_folder)
        folder_picker_box.addWidget(self.btn_browse)

        self.chk_auto = QtWidgets.QCheckBox("Enable auto-pull results in background")
        self.chk_auto.setChecked(bool(self.cfg.get("auto", False)))
        self.spin_minutes = QtWidgets.QSpinBox()
        self.spin_minutes.setRange(1, 60)
        self.spin_minutes.setValue(int(self.cfg.get("auto_minutes", 2)))

        auto_box = QtWidgets.QHBoxLayout()
        auto_box.addWidget(self.chk_auto)
        auto_box.addWidget(QtWidgets.QLabel("Interval (min):"))
        auto_box.addWidget(self.spin_minutes)

        f_layout.addRow("Exchange Root Folder:", folder_picker_box)
        f_layout.addRow("", auto_box)
        sy_layout.addWidget(folder_group)

        # Manual Pull Button
        sync_btns = QtWidgets.QHBoxLayout()
        self.btn_pull = QtWidgets.QPushButton("📥 Pull Latest Results Now")
        self.btn_pull.setStyleSheet("background-color: #0284c7; color: white; font-weight: bold; padding: 8px 12px; border-radius: 5px;")
        self.btn_pull.clicked.connect(self.on_pull_clicked)
        sync_btns.addWidget(self.btn_pull)

        self.btn_save_cfg = QtWidgets.QPushButton("Save Settings")
        self.btn_save_cfg.clicked.connect(self.save_settings)
        sync_btns.addWidget(self.btn_save_cfg)
        sy_layout.addLayout(sync_btns)

        self.lbl_sync_status = QtWidgets.QLabel("")
        self.lbl_sync_status.setWordWrap(True)
        self.lbl_sync_status.setStyleSheet("color: #475569; font-size: 11px;")
        sy_layout.addWidget(self.lbl_sync_status)
        sy_layout.addStretch()

        tabs.addTab(tab_sync, "⚙️ Connection & Sync")

        # Bottom dialog close button
        bottom_box = QtWidgets.QHBoxLayout()
        btn_close = QtWidgets.QPushButton("Close")
        btn_close.clicked.connect(self.accept)
        bottom_box.addStretch()
        bottom_box.addWidget(btn_close)
        layout.addLayout(bottom_box)

        self.on_layer_changed()
        self.test_bridge_connection()

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

    def on_layer_changed(self):
        layer_id = self.layer_combo.currentData()
        self.combo_name_field.clear()
        self.combo_crop_field.clear()
        self.combo_name_field.addItem("(Auto-generate)", "")
        self.combo_crop_field.addItem("(None - Use default)", "")

        if not layer_id:
            return
        layer = QgsProject.instance().mapLayer(layer_id)
        if not layer:
            return

        for field in layer.fields():
            fname = field.name()
            self.combo_name_field.addItem(fname, fname)
            self.combo_crop_field.addItem(fname, fname)

    def test_bridge_connection(self):
        cfg = {"bridge_url": self.txt_bridge_url.text().strip()}
        health = seva_core.bridge_health(cfg)
        if health and health.get("ok"):
            age = health.get("last_poll_age")
            age_str = ("(tab active %ss ago)" % age) if age is not None else "(ready)"
            self.lbl_bridge_health.setText("<span style='color: #10b981; font-weight: bold;'>Online</span> " + age_str)
        else:
            self.lbl_bridge_health.setText("<span style='color: #ef4444;'>Offline</span> (start seva_bridge.py)")

    def browse_folder(self):
        folder = QtWidgets.QFileDialog.getExistingDirectory(self, "Select Exchange Folder", self.txt_folder.text())
        if folder:
            self.txt_folder.setText(folder)

    def save_settings(self):
        self.cfg["seva_url"] = self.txt_seva_url.text().strip()
        self.cfg["bridge_url"] = self.txt_bridge_url.text().strip()
        self.cfg["token"] = self.txt_token.text().strip()
        self.cfg["folder"] = self.txt_folder.text().strip()
        self.cfg["default_crop"] = self.combo_default_crop.currentText()
        self.cfg["auto"] = self.chk_auto.isChecked()
        self.cfg["auto_minutes"] = self.spin_minutes.value()
        seva_core.save_config(self.cfg)
        self.lbl_sync_status.setText("Settings saved to ~/.seva/desktop.json successfully.")

    def on_send_clicked(self):
        layer_id = self.layer_combo.currentData()
        if not layer_id:
            QtWidgets.QMessageBox.warning(self, "No Layer", "Please select a valid polygon vector layer.")
            return

        layer = QgsProject.instance().mapLayer(layer_id)
        if not layer:
            QtWidgets.QMessageBox.warning(self, "Error", "Layer could not be found.")
            return

        name_field = self.combo_name_field.currentData() or ""
        crop_field = self.combo_crop_field.currentData() or ""
        default_crop = self.combo_default_crop.currentText()
        selected_only = self.chk_selected_only.isChecked()

        features = ops.extract_features(layer, selected_only, name_field, crop_field, default_crop)
        if not features:
            QtWidgets.QMessageBox.warning(self, "No Features", "No valid polygon features were found or selected.")
            return

        payload = seva_core.make_payload(
            features,
            app="QGIS",
            app_version="3.x",
            project=QgsProject.instance().title() or "Untitled Project"
        )

        res = seva_core.send_parcels(self.cfg, payload)
        summary = seva_core.describe(res)
        self.lbl_send_status.setText("Dispatched %d field(s) via: %s" % (len(features), summary))

    def on_pull_clicked(self):
        results = seva_core.collect_results(self.cfg, "QGIS")
        if not results:
            self.lbl_sync_status.setText("No new results currently available in bridge queue or exchange folder.")
            return

        total_applied = 0
        layers = QgsProject.instance().mapLayers().values()
        for res_payload in results:
            for lyr in layers:
                if lyr.type() == QgsMapLayerType.VectorLayer:
                    total_applied += ops.apply_results_to_layer(lyr, res_payload)

        # Also load new files from exchange folder
        added_files = ops.load_exchange_layers(self.cfg.get("folder", ""))
        msg = "Applied results to %d features across %d payload(s)." % (total_applied, len(results))
        if added_files:
            msg += " Added %d new layer/raster files to project." % len(added_files)
        self.lbl_sync_status.setText(msg)
