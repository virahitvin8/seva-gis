# -*- coding: utf-8 -*-
"""The SEVA.GIS dialog for QGIS.

Three tabs and one idea: type a sentence per box, press Add layers to map, and get
the layers in that order. Everything that talks to the service runs on a worker
thread, because a stream or elevation request can take a minute and QGIS must stay
usable while it does.
"""
from __future__ import print_function

import json
import os

from qgis.PyQt import QtCore, QtWidgets
from qgis.core import QgsProject

try:
    from . import ops, seva_client, seva_core, seva_plan
    from .query_boxes import QueryBoxList
except ImportError:
    import ops
    import seva_client
    import seva_core
    import seva_plan
    from query_boxes import QueryBoxList

EXAMPLES = (
    "NDVI",
    "make a red boundary line of my area",
    "true colour and false colour image",
    "NDVI, EVI and SAVI",
    "danger zones in my area",
    "only the healthy zones",
    "streams where the water flows as per the slope",
    "land cover",
    "elevation and slope",
    "statistics of my area",
)


class _Worker(QtCore.QThread):
    """Runs one blocking job off the interface thread."""

    progressed = QtCore.pyqtSignal(str)
    done = QtCore.pyqtSignal(object)
    failed = QtCore.pyqtSignal(str)

    def __init__(self, job, parent=None):
        super(_Worker, self).__init__(parent)
        self._job = job

    def run(self):
        try:
            self.done.emit(self._job(self.progressed.emit))
        except seva_core.SevaError as exc:
            self.failed.emit(str(exc))
        except Exception as exc:  # a crash in a thread must still reach the dialog
            self.failed.emit("Unexpected problem: %s" % exc)


class SevaGisDialog(QtWidgets.QDialog):
    def __init__(self, iface, parent=None):
        super(SevaGisDialog, self).__init__(parent or (iface.mainWindow() if iface else None))
        self.iface = iface
        self.config = seva_core.load_config()
        self.plan = None
        self.ring = None
        self.area_name = ""
        self._worker = None

        self.setWindowTitle("SEVA.GIS — query boxes")
        self.resize(760, 680)
        self._build_ui()
        self._load_saved_plan()
        self._refresh_layers()
        self._test_connection(quiet=True)

    # ------------------------------------------------------------------ interface
    def _build_ui(self):
        layout = QtWidgets.QVBoxLayout(self)

        header = QtWidgets.QLabel(
            "<b style='font-size:14px'>Type one plain sentence per box</b><br>"
            "<span style='color:#6b7280'>No Google Earth Engine account, no JavaScript, no API key. "
            "Each box becomes a layer, in the order you arrange them.</span>"
        )
        header.setWordWrap(True)
        layout.addWidget(header)

        tabs = QtWidgets.QTabWidget()
        layout.addWidget(tabs, 1)
        tabs.addTab(self._build_queries_tab(), "Queries")
        tabs.addTab(self._build_settings_tab(), "Settings")
        tabs.addTab(self._build_help_tab(), "How to use")
        self.tabs = tabs

        bottom = QtWidgets.QHBoxLayout()
        bottom.addStretch(1)
        close = QtWidgets.QPushButton("Close")
        close.clicked.connect(self.close)
        bottom.addWidget(close)
        layout.addLayout(bottom)

    def _build_queries_tab(self):
        page = QtWidgets.QWidget()
        layout = QtWidgets.QVBoxLayout(page)

        # --- area of interest
        area_group = QtWidgets.QGroupBox("1. Area of interest")
        area_layout = QtWidgets.QVBoxLayout(area_group)
        layer_row = QtWidgets.QHBoxLayout()
        self.layer_combo = QtWidgets.QComboBox()
        self.layer_combo.setMinimumWidth(240)
        layer_row.addWidget(QtWidgets.QLabel("Polygon layer:"))
        layer_row.addWidget(self.layer_combo, 1)
        refresh = QtWidgets.QPushButton("Refresh")
        refresh.setToolTip("Re-read the layers open in this project")
        refresh.clicked.connect(self._refresh_layers)
        layer_row.addWidget(refresh)
        area_layout.addLayout(layer_row)

        option_row = QtWidgets.QHBoxLayout()
        self.selected_only = QtWidgets.QCheckBox("Use the selected feature(s) only")
        self.selected_only.setChecked(True)
        option_row.addWidget(self.selected_only)
        paste = QtWidgets.QPushButton("Paste coordinates instead…")
        paste.setToolTip("lon,lat pairs, one per line — or draw nothing at all and paste them here")
        paste.clicked.connect(self._paste_coordinates)
        option_row.addWidget(paste)
        option_row.addStretch(1)
        area_layout.addLayout(option_row)

        self.area_status = QtWidgets.QLabel("")
        self.area_status.setWordWrap(True)
        self.area_status.setStyleSheet("color:#6b7280;")
        area_layout.addWidget(self.area_status)
        layout.addWidget(area_group)

        # --- window
        window_group = QtWidgets.QGroupBox("2. Dates and cloud (used by every box that does not state its own)")
        window_layout = QtWidgets.QHBoxLayout(window_group)
        self.latest_only = QtWidgets.QCheckBox("Latest available")
        self.latest_only.setChecked(True)
        self.latest_only.setToolTip("Let each request pick the newest usable scene")
        self.latest_only.toggled.connect(self._sync_window_enabled)
        window_layout.addWidget(self.latest_only)

        self.start_date = QtWidgets.QDateEdit(QtCore.QDate.currentDate().addDays(-45))
        self.end_date = QtWidgets.QDateEdit(QtCore.QDate.currentDate())
        for widget, label in ((self.start_date, "From:"), (self.end_date, "To:")):
            widget.setCalendarPopup(True)
            widget.setDisplayFormat("yyyy-MM-dd")
            window_layout.addWidget(QtWidgets.QLabel(label))
            window_layout.addWidget(widget)
        window_layout.addWidget(QtWidgets.QLabel("Max cloud %:"))
        self.cloud = QtWidgets.QSpinBox()
        self.cloud.setRange(0, 100)
        self.cloud.setValue(int(self.config.get("max_cloud", 20) or 20))
        window_layout.addWidget(self.cloud)
        window_layout.addStretch(1)
        layout.addWidget(window_group)

        # --- boxes
        boxes_group = QtWidgets.QGroupBox("3. Your queries, in drawing order")
        boxes_layout = QtWidgets.QVBoxLayout(boxes_group)
        scroll = QtWidgets.QScrollArea()
        scroll.setWidgetResizable(True)
        self.boxes = QueryBoxList()
        scroll.setWidget(self.boxes)
        boxes_layout.addWidget(scroll, 1)
        layout.addWidget(boxes_group, 1)

        actions = QtWidgets.QHBoxLayout()
        self.run_button = QtWidgets.QPushButton("Add layers to map")
        self.run_button.setDefault(True)
        self.run_button.setToolTip("Plan the boxes if needed, then add every layer to the QGIS panel")
        self.run_button.clicked.connect(self.on_run)
        actions.addWidget(self.run_button)

        self.plan_button = QtWidgets.QPushButton("Plan queries only")
        self.plan_button.setToolTip("Show what each sentence will become, without touching the map")
        self.plan_button.clicked.connect(self.on_plan)
        actions.addWidget(self.plan_button)

        clear = QtWidgets.QPushButton("Clear boxes")
        clear.clicked.connect(self._clear)
        actions.addWidget(clear)
        actions.addStretch(1)
        layout.addLayout(actions)

        self.progress = QtWidgets.QProgressBar()
        self.progress.setRange(0, 100)
        self.progress.setValue(0)
        self.progress.setTextVisible(False)
        self.progress.setVisible(False)
        layout.addWidget(self.progress)

        self.status = QtWidgets.QLabel("")
        self.status.setWordWrap(True)
        layout.addWidget(self.status)
        return page

    def _build_settings_tab(self):
        page = QtWidgets.QWidget()
        layout = QtWidgets.QVBoxLayout(page)

        service = QtWidgets.QGroupBox("Service")
        form = QtWidgets.QFormLayout(service)
        self.service_url = QtWidgets.QLineEdit(self.config.get("backend_url", seva_core.DEFAULT_BACKEND))
        form.addRow("Service URL:", self.service_url)
        test_row = QtWidgets.QHBoxLayout()
        test = QtWidgets.QPushButton("Test connection")
        test.clicked.connect(lambda: self._test_connection(quiet=False))
        test_row.addWidget(test)
        self.health_label = QtWidgets.QLabel("Status: unknown")
        test_row.addWidget(self.health_label)
        test_row.addStretch(1)
        form.addRow("", test_row)
        note = QtWidgets.QLabel(
            "This is the public SEVA.GIS service. It holds the Earth Engine identity, so you never "
            "need a Google account, a project, or a key."
        )
        note.setWordWrap(True)
        form.addRow("", note)
        layout.addWidget(service)

        behaviour = QtWidgets.QGroupBox("Behaviour")
        behaviour_form = QtWidgets.QFormLayout(behaviour)
        self.zoom_after = QtWidgets.QCheckBox("Zoom the map to my area after adding layers")
        self.zoom_after.setChecked(True)
        behaviour_form.addRow("", self.zoom_after)
        self.open_tables = QtWidgets.QCheckBox("Open statistics and land-cover tables after a run")
        self.open_tables.setChecked(True)
        behaviour_form.addRow("", self.open_tables)
        layout.addWidget(behaviour)

        plan_group = QtWidgets.QGroupBox("Saved queries")
        plan_layout = QtWidgets.QHBoxLayout(plan_group)
        save = QtWidgets.QPushButton("Save queries to a file…")
        save.clicked.connect(self._save_plan_file)
        load = QtWidgets.QPushButton("Load queries from a file…")
        load.clicked.connect(self._load_plan_file)
        plan_layout.addWidget(save)
        plan_layout.addWidget(load)
        plan_layout.addStretch(1)
        layout.addWidget(plan_group)

        save_button = QtWidgets.QPushButton("Save settings")
        save_button.clicked.connect(self._save_settings)
        layout.addWidget(save_button)
        layout.addStretch(1)
        return page

    def _build_help_tab(self):
        page = QtWidgets.QWidget()
        layout = QtWidgets.QVBoxLayout(page)
        text = QtWidgets.QLabel(
            "<b>One sentence per box.</b><br>"
            "Pick your area, set the dates if you want, then type what you need and press "
            "<i>Add layers to map</i>. Press <b>+</b> for the next one.<br><br>"
            "<b>Reordering.</b> Hold the grip on the left of a box and drag it, or use the "
            "&#9650; and &#9660; arrows. Boxes higher in the list are drawn above the ones below.<br><br>"
            "<b>Switching off.</b> Untick a box to keep it for later without drawing it.<br><br>"
            "<b>Some sentences that work</b><br>" + "<br>".join("&nbsp;&nbsp;• " + example for example in EXAMPLES) +
            "<br><br>Anything the service cannot do is said plainly next to the box that asked for it, "
            "including the things satellite imagery cannot resolve, such as individual poles or buried pipes."
        )
        text.setWordWrap(True)
        text.setTextInteractionFlags(QtCore.Qt.TextSelectableByMouse)
        layout.addWidget(text)
        layout.addStretch(1)
        return page

    # ------------------------------------------------------------------ helpers
    def _sync_window_enabled(self):
        enabled = not self.latest_only.isChecked()
        self.start_date.setEnabled(enabled)
        self.end_date.setEnabled(enabled)

    def _refresh_layers(self):
        self.layer_combo.clear()
        for layer in ops.polygon_layers():
            self.layer_combo.addItem(layer.name(), layer.id())
        if self.layer_combo.count() == 0:
            self.layer_combo.addItem("No polygon layer open", None)
        self._update_area_status()

    def _update_area_status(self):
        if self.ring:
            self.area_status.setText("Area: %s (%d vertices)" % (self.area_name, len(self.ring)))
        else:
            self.area_status.setText("No area chosen yet. Select your polygon layer, or paste coordinates.")

    def _paste_coordinates(self):
        from qgis.PyQt.QtWidgets import QInputDialog

        text, accepted = QInputDialog.getMultiLineText(
            self,
            "Paste coordinates",
            "One longitude, latitude pair per line (WGS84):",
            "77.5900, 12.9700\n77.6100, 12.9700\n77.6100, 12.9840\n77.5900, 12.9840",
        )
        if not accepted:
            return
        ring, error = ops.parse_coordinates(text)
        if error:
            QtWidgets.QMessageBox.warning(self, "Coordinates", error)
            return
        self.ring = ring
        self.area_name = "pasted coordinates"
        self.layer_combo.setCurrentIndex(0)
        self.selected_only.setChecked(False)
        self._update_area_status()

    def _current_aoi(self):
        """The ring to send, from the pasted coordinates or the chosen layer."""
        if self.ring:
            return self.ring, self.area_name, None
        layer_id = self.layer_combo.currentData()
        layer = QgsProject.instance().mapLayer(layer_id) if layer_id else None
        ring, name, error = ops.extract_aoi(layer, self.selected_only.isChecked())
        if error:
            return None, "", error
        self.ring = ring
        self.area_name = name
        self._update_area_status()
        return ring, name, None

    def _collect_plan(self):
        defaults = {"max_cloud": self.cloud.value()}
        if not self.latest_only.isChecked():
            defaults["start_date"] = self.start_date.date().toString("yyyy-MM-dd")
            defaults["end_date"] = self.end_date.date().toString("yyyy-MM-dd")
        else:
            defaults["start_date"] = ""
            defaults["end_date"] = ""
        plan = {"seva_plan": seva_plan.PLAN_VERSION, "defaults": defaults, "boxes": self.boxes.plan_boxes()}
        for box in plan["boxes"]:
            box["resolved"] = []
        return plan

    def _window_payload(self, defaults):
        payload = {"max_cloud": defaults.get("max_cloud", 20)}
        if defaults.get("start_date"):
            payload["start_date"] = defaults["start_date"]
        if defaults.get("end_date"):
            payload["end_date"] = defaults["end_date"]
        return payload

    # ------------------------------------------------------------------ planning
    def on_plan(self):
        self._start_plan(then_run=False)

    def _start_plan(self, then_run):
        plan = self._collect_plan()
        sentences = [box["text"] for box in plan["boxes"] if box["enabled"] and box["text"]]
        if not sentences:
            QtWidgets.QMessageBox.information(self, "SEVA.GIS", "Add at least one query first.")
            return
        defaults = plan["defaults"]
        config = dict(self.config)
        payload = dict(self._window_payload(defaults))
        payload["sentences"] = sentences

        def job(progress):
            progress("Describing %d box(es)…" % len(sentences))
            return seva_core.plan_request(config, "/api/earth-engine/interpret", payload)

        def finished(result):
            warnings = seva_plan.assign_interpretation(plan, result.get("boxes"))
            self.plan = plan
            self.boxes.apply_plan(plan)
            seva_plan.save_plan(plan)
            engine = result.get("engine", "")
            summary = "Planned with %s: %s" % (engine or "the service", seva_plan.summarise(plan))
            if warnings:
                summary += "  " + "  ".join(warnings)
            self._set_status(summary)
            if then_run:
                self._start_run()

        self._run_job(job, finished, "Planning queries…")

    # ------------------------------------------------------------------ running
    def on_run(self):
        plan = self.plan
        needs_plan = plan is None
        if not needs_plan:
            current_ids = [box["id"] for box in self.boxes.plan_boxes()]
            planned_ids = [box.get("id") for box in plan.get("boxes", [])]
            needs_plan = current_ids != planned_ids
            if not needs_plan:
                for box, entered in zip(plan.get("boxes", []), self.boxes.plan_boxes()):
                    if entered.get("text", "") != box.get("text", "").strip() or entered.get("enabled") != box.get("enabled"):
                        needs_plan = True
                        break
                if not needs_plan:
                    enabled = [box for box in plan.get("boxes", []) if box.get("enabled")]
                    needs_plan = any(not box.get("resolved") for box in enabled)
        if needs_plan:
            self._start_plan(then_run=True)
            return
        self._start_run()

    def _start_run(self):
        ring, area_name, error = self._current_aoi()
        if error:
            QtWidgets.QMessageBox.warning(self, "Area of interest", error)
            return
        plan = self.plan
        config = dict(self.config)
        iface = self.iface

        def job(progress):
            return seva_client.run_queries(
                plan,
                ring,
                config,
                progress=lambda index, total, text: progress("Box %d of %d: %s" % (index, total, text[:48])),
            )

        def finished(result):
            self._apply_result(result, ring)

        self._run_job(job, finished, "Contacting the service…")

    def _apply_result(self, result, ring):
        layers, problems = ops.prepare(result)
        added, _ = ops.add_layers(layers)

        if self.zoom_after.isChecked():
            ops.zoom_to_ring(self.iface, ring)

        for error in result.get("errors", []):
            for box in self.plan.get("boxes", []):
                if box.get("id") == error.get("box"):
                    box["error"] = error.get("error", "")
        self.boxes.apply_plan(self.plan)

        if result.get("tables") and self.open_tables.isChecked():
            dialog = ops.ResultTableDialog(result["tables"], self)
            dialog.setModal(False)
            dialog.show()

        lines = []
        if added:
            lines.append("Added %d layer(s), top of the panel first: %s" % (len(added), " | ".join(reversed(added))))
        else:
            lines.append("Nothing was added.")
        problems = list(problems) + [error.get("error", "") for error in result.get("errors", [])]
        if problems:
            lines.append("Problems: " + "; ".join(problem for problem in problems if problem))
        self._set_status("  ".join(lines))
        if problems:
            QtWidgets.QMessageBox.warning(self, "SEVA.GIS", "\n".join(problem for problem in problems if problem))

    # ------------------------------------------------------------------ worker plumbing
    def _run_job(self, job, on_done, label):
        if self._worker is not None and self._worker.isRunning():
            return
        self._set_busy(True, label)
        worker = _Worker(job, self)
        self._worker = worker

        def finished(result):
            self._set_busy(False, "")
            on_done(result)

        def failed(message):
            self._set_busy(False, "")
            self._set_status(message)
            QtWidgets.QMessageBox.warning(self, "SEVA.GIS", message)

        worker.progressed.connect(lambda text: self._set_status(text))
        worker.done.connect(finished)
        worker.failed.connect(failed)
        worker.start()

    def _set_busy(self, busy, label):
        self.run_button.setEnabled(not busy)
        self.plan_button.setEnabled(not busy)
        self.progress.setVisible(busy)
        if busy:
            self.progress.setRange(0, 0)
            self._set_status(label)
        else:
            self.progress.setRange(0, 100)
            self.progress.setValue(0)

    def _set_status(self, text):
        self.status.setText(text)

    # ------------------------------------------------------------------ persistence
    def _save_settings(self):
        self.config["backend_url"] = self.service_url.text().strip() or seva_core.DEFAULT_BACKEND
        self.config["max_cloud"] = self.cloud.value()
        self.config = seva_core.save_config(self.config)
        self._set_status("Settings saved to %s" % seva_core.CONFIG_FILE)
        self._test_connection(quiet=True)

    def _test_connection(self, quiet=True):
        config = dict(self.config)
        config["backend_url"] = self.service_url.text().strip() or self.config.get("backend_url")
        health = seva_core.health(config)
        if health:
            state = "ready" if health.get("engineReady") else "reachable, satellite engine warming up"
            self.health_label.setText("<span style='color:#1a7f37'>Online — %s</span>" % state)
        else:
            self.health_label.setText("<span style='color:#b3261e'>Offline — check the URL</span>")
            if not quiet:
                self._set_status("Could not reach %s" % config.get("backend_url"))

    def _load_saved_plan(self):
        plan = seva_core.load_plan()
        self.boxes.load_boxes(plan.get("boxes"))
        defaults = plan.get("defaults") or {}
        if defaults.get("max_cloud") is not None:
            self.cloud.setValue(int(defaults.get("max_cloud") or 20))
        if defaults.get("start_date") and defaults.get("end_date"):
            start = QtCore.QDate.fromString(defaults["start_date"], "yyyy-MM-dd")
            end = QtCore.QDate.fromString(defaults["end_date"], "yyyy-MM-dd")
            if start.isValid() and end.isValid():
                self.latest_only.setChecked(False)
                self.start_date.setDate(start)
                self.end_date.setDate(end)
        self._sync_window_enabled()
        if defaults.get("start_date") or plan.get("boxes"):
            self.plan = plan if any(box.get("resolved") for box in plan.get("boxes", [])) else None

    def _clear(self):
        self.boxes.clear()
        self.boxes.add_row()
        self.plan = None
        self._set_status("Boxes cleared.")

    def _save_plan_file(self):
        path, _ = QtWidgets.QFileDialog.getSaveFileName(self, "Save queries", os.path.expanduser("~"), "SEVA.GIS queries (*.json)")
        if not path:
            return
        plan = self._collect_plan()
        with open(path, "w") as handle:
            json.dump(plan, handle, indent=2)
        self._set_status("Saved %d box(es) to %s" % (len(plan["boxes"]), path))

    def _load_plan_file(self):
        path, _ = QtWidgets.QFileDialog.getOpenFileName(self, "Load queries", os.path.expanduser("~"), "SEVA.GIS queries (*.json)")
        if not path:
            return
        try:
            with open(path) as handle:
                plan = json.load(handle)
        except (IOError, OSError, ValueError) as exc:
            QtWidgets.QMessageBox.warning(self, "SEVA.GIS", "Could not read that file: %s" % exc)
            return
        self.boxes.load_boxes(plan.get("boxes"))
        self.plan = None
        self._set_status("Loaded %d box(es). Press Add layers to map." % len(plan.get("boxes") or []))
