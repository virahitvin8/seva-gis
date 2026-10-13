# -*- coding: utf-8 -*-
"""The ArcGIS query-box window.

ArcMap and ArcGIS Pro both ship Tkinter, and neither gives a toolbox parameter a
multi-line box, so the boxes live in this window instead: type a sentence, press
+, reorder with the grip or the arrows, and press Add layers to map. A toolbox tool
can then re-run the same saved queries for scripted or model workflows.

Python 2.7 (ArcMap 10.x) and Python 3 (ArcGIS Pro) compatible.

The window must stay responsive while a stream or elevation request runs, so the
work happens on a thread and reports back through a queue that the interface polls.
"""
from __future__ import print_function

import json
import os
import threading

try:  # Python 3
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
    from queue import Empty, Queue
except ImportError:  # Python 2.7 (ArcMap)
    import Tkinter as tk
    import ttk
    import tkFileDialog as filedialog
    import tkMessageBox as messagebox
    from Queue import Empty, Queue

try:
    from . import seva_arcgis, seva_client, seva_core, seva_plan
except ImportError:
    import seva_arcgis
    import seva_client
    import seva_core
    import seva_plan

PLACEHOLDER = "(one plain sentence, e.g. NDVI · true colour · danger zones · streams where water flows)"
MAX_BOXES = 40


class QueryBoxesWindow(object):
    def __init__(self, layer=None, use_selection=True):
        self.config = seva_core.load_config()
        self.plan = None
        self.ring = None
        self.rows = []
        self.queue = Queue()
        self.busy = False

        try:
            self.root = tk.Toplevel()
        except tk.TclError:
            self.root = tk.Tk()
        self.root.title("SEVA.GIS — query boxes")
        self.root.geometry("760x680")
        self.root.protocol("WM_DELETE_WINDOW", self.close)

        self._build(layer, use_selection)
        self._load_saved_plan()

    # ------------------------------------------------------------------ layout
    def _build(self, layer, use_selection):
        outer = ttk.Frame(self.root, padding=10)
        outer.pack(fill="both", expand=True)

        ttk.Label(outer, text="Type one plain sentence per box", font=("Segoe UI", 11, "bold")).pack(anchor="w")
        ttk.Label(
            outer,
            text="No Google Earth Engine account, no JavaScript, no API key. Each box becomes a layer, in the order you arrange them.",
            foreground="#555555",
            wraplength=700,
        ).pack(anchor="w", pady=(0, 8))

        area = ttk.LabelFrame(outer, text="1. Area of interest", padding=8)
        area.pack(fill="x", pady=4)
        line = ttk.Frame(area)
        line.pack(fill="x")
        ttk.Label(line, text="Polygon layer:").pack(side="left")
        self.layer_var = tk.StringVar(value=layer or "")
        ttk.Entry(line, textvariable=self.layer_var, width=52).pack(side="left", padx=6)
        ttk.Button(line, text="Browse…", command=self._browse_layer).pack(side="left")
        self.selection_var = tk.IntVar(value=1 if use_selection else 0)
        ttk.Checkbutton(area, text="Use the selected feature(s) only", variable=self.selection_var).pack(anchor="w", pady=(6, 0))

        window = ttk.LabelFrame(outer, text="2. Dates and cloud (used by every box that does not state its own)", padding=8)
        window.pack(fill="x", pady=4)
        row = ttk.Frame(window)
        row.pack(fill="x")
        self.latest_var = tk.IntVar(value=1)
        ttk.Checkbutton(row, text="Latest available", variable=self.latest_var, command=self._sync_window).pack(side="left")
        ttk.Label(row, text="From:").pack(side="left", padx=(12, 2))
        self.start_var = tk.StringVar(value="")
        self.start_entry = ttk.Entry(row, textvariable=self.start_var, width=12)
        self.start_entry.pack(side="left")
        ttk.Label(row, text="To:").pack(side="left", padx=(8, 2))
        self.end_var = tk.StringVar(value="")
        self.end_entry = ttk.Entry(row, textvariable=self.end_var, width=12)
        self.end_entry.pack(side="left")
        ttk.Label(row, text="Max cloud %:").pack(side="left", padx=(12, 2))
        self.cloud_var = tk.StringVar(value="20")
        ttk.Spinbox(row, from_=0, to=100, textvariable=self.cloud_var, width=5).pack(side="left")
        self._sync_window()

        boxes = ttk.LabelFrame(outer, text="3. Your queries, in drawing order", padding=8)
        boxes.pack(fill="both", expand=True, pady=4)
        canvas = tk.Canvas(boxes, borderwidth=0, highlightthickness=0)
        scrollbar = ttk.Scrollbar(boxes, orient="vertical", command=canvas.yview)
        self.rows_frame = ttk.Frame(canvas)
        self.rows_frame.bind("<Configure>", lambda event: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self.rows_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        actions = ttk.Frame(outer)
        actions.pack(fill="x", pady=(6, 0))
        self.add_button = ttk.Button(actions, text="+  Add another query", command=self.add_box)
        self.add_button.pack(side="left")
        self.plan_button = ttk.Button(actions, text="Plan queries", command=self.on_plan)
        self.plan_button.pack(side="left", padx=6)
        self.run_button = ttk.Button(actions, text="Add layers to map", command=self.on_run)
        self.run_button.pack(side="left")
        ttk.Button(actions, text="Save…", command=self.on_save).pack(side="left", padx=6)
        ttk.Button(actions, text="Load…", command=self.on_load).pack(side="left")
        ttk.Button(actions, text="Close", command=self.close).pack(side="right")

        self.progress = ttk.Progressbar(outer, mode="indeterminate")
        self.status_var = tk.StringVar(value="")
        ttk.Label(outer, textvariable=self.status_var, foreground="#333333", wraplength=720).pack(anchor="w", pady=(6, 0))

    def _sync_window(self):
        state = "disabled" if self.latest_var.get() else "normal"
        self.start_entry.configure(state=state)
        self.end_entry.configure(state=state)

    def _browse_layer(self):
        path = filedialog.askopenfilename(title="Choose a polygon feature class or shapefile")
        if path:
            self.layer_var.set(path)

    # ------------------------------------------------------------------ rows
    def add_box(self, text="", box_id=None, enabled=True):
        if len(self.rows) >= MAX_BOXES:
            return None
        if not box_id:
            highest = 0
            for row in self.rows:
                if row["id"].startswith("b"):
                    try:
                        highest = max(highest, int(row["id"][1:]))
                    except ValueError:
                        pass
            box_id = "b%d" % (highest + 1)

        container = ttk.Frame(self.rows_frame)
        container.pack(fill="x", pady=2)
        enabled_var = tk.IntVar(value=1 if enabled else 0)
        text_var = tk.StringVar(value=text)

        first = ttk.Frame(container)
        first.pack(fill="x")
        grip = ttk.Label(first, text="\u283f", cursor="fleur")
        grip.pack(side="left")
        ttk.Checkbutton(first, variable=enabled_var).pack(side="left")
        entry = ttk.Entry(first, textvariable=text_var)
        entry.pack(side="left", fill="x", expand=True, padx=4)
        ttk.Button(first, text="\u25b2", width=3, command=lambda: self.move_box(box_id, -1)).pack(side="left")
        ttk.Button(first, text="\u25bc", width=3, command=lambda: self.move_box(box_id, 1)).pack(side="left")
        ttk.Button(first, text="\u2715", width=3, command=lambda: self.remove_box(box_id)).pack(side="left")

        status = ttk.Label(container, text="", foreground="#1a7f37", wraplength=660, justify="left")
        status.pack(anchor="w", padx=(34, 0))

        row = {
            "id": box_id, "container": container, "enabled": enabled_var,
            "text": text_var, "entry": entry, "status": status,
        }
        self.rows.append(row)
        grip.bind("<ButtonPress-1>", lambda event, r=row: self._grip_press(r))
        grip.bind("<B1-Motion>", lambda event, r=row: self._grip_drag(r, event))
        return row

    def remove_box(self, box_id):
        for index, row in enumerate(self.rows):
            if row["id"] == box_id:
                row["container"].destroy()
                self.rows.pop(index)
                return True
        return False

    def move_box(self, box_id, delta):
        for index, row in enumerate(self.rows):
            if row["id"] != box_id:
                continue
            target = index + int(delta)
            if target < 0 or target >= len(self.rows):
                return False
            self.rows.pop(index)
            self.rows.insert(target, row)
            self._repack()
            return True
        return False

    def _repack(self):
        for row in self.rows:
            row["container"].pack_forget()
        for row in self.rows:
            row["container"].pack(fill="x", pady=2)

    def _grip_press(self, row):
        self._drag_row = row

    def _grip_drag(self, row, event):
        widget = self.root.winfo_containing(event.x_root, event.y_root)
        if widget is None:
            return
        for target_index, candidate in enumerate(self.rows):
            parent = candidate["container"]
            if widget == parent or str(widget).startswith(str(parent)):
                current = self.rows.index(row)
                if current != target_index:
                    self.rows.pop(current)
                    self.rows.insert(target_index, row)
                    self._repack()
                return

    def _clear(self):
        for row in list(self.rows):
            row["container"].destroy()
        self.rows = []

    def _boxes(self):
        return [
            {"id": row["id"], "text": row["text"].get().strip(), "enabled": bool(row["enabled"].get())}
            for row in self.rows
        ]

    def _show_result(self, plan):
        by_id = dict((box.get("id"), box) for box in (plan or {}).get("boxes", []))
        for row in self.rows:
            box = by_id.get(row["id"])
            if box is None:
                row["status"].configure(text="", foreground="#1a7f37")
                continue
            if box.get("error"):
                row["status"].configure(text="\u2716 " + box["error"], foreground="#b3261e")
                continue
            labels = []
            for item in box.get("resolved", []):
                label = item.get("label") or item.get("op") or ""
                if label and label not in labels:
                    labels.append(label)
            if labels:
                row["status"].configure(text="\u2192 " + " · ".join(labels), foreground="#1a7f37")
            elif row["text"].get().strip():
                row["status"].configure(text="Not planned yet — press Plan queries.", foreground="#6b7280")
            else:
                row["status"].configure(text="", foreground="#1a7f37")

    # ------------------------------------------------------------------ plan and run
    def _collect_plan(self):
        defaults = {}
        try:
            defaults["max_cloud"] = int(self.cloud_var.get() or 20)
        except ValueError:
            defaults["max_cloud"] = 20
        if not self.latest_var.get():
            defaults["start_date"] = self.start_var.get().strip()
            defaults["end_date"] = self.end_var.get().strip()
        else:
            defaults["start_date"] = ""
            defaults["end_date"] = ""
        plan = {"seva_plan": seva_plan.PLAN_VERSION, "defaults": defaults, "boxes": self._boxes()}
        for box in plan["boxes"]:
            box["resolved"] = []
        return plan

    def on_plan(self):
        plan = self._collect_plan()
        sentences = [box["text"] for box in plan["boxes"] if box["enabled"] and box["text"]]
        if not sentences:
            messagebox.showinfo("SEVA.GIS", "Add at least one query first.")
            return
        payload = {"sentences": sentences, "max_cloud": plan["defaults"].get("max_cloud", 20)}
        if plan["defaults"].get("start_date"):
            payload["start_date"] = plan["defaults"]["start_date"]
        if plan["defaults"].get("end_date"):
            payload["end_date"] = plan["defaults"]["end_date"]
        self._start(self._job_plan, payload, plan)

    def _job_plan(self, payload, plan, report):
        report("Describing %d box(es)…" % len(payload["sentences"]))
        result = seva_core.plan_request(self.config, "/api/earth-engine/interpret", payload)
        seva_plan.assign_interpretation(plan, result.get("boxes"))
        return {"plan": plan, "result": result}

    def on_run(self):
        plan = self.plan
        if plan is None or [box["id"] for box in plan.get("boxes", [])] != [box["id"] for box in self._boxes()]:
            self._plan_then_run()
            return
        entered = self._boxes()
        for stored, current in zip(plan.get("boxes", []), entered):
            if stored.get("text", "").strip() != current["text"] or bool(stored.get("enabled")) != current["enabled"]:
                self._plan_then_run()
                return
        if any(not box.get("resolved") for box in plan.get("boxes", []) if box.get("enabled")):
            self._plan_then_run()
            return
        self._start(self._job_run, None, plan)

    def _plan_then_run(self):
        plan = self._collect_plan()
        sentences = [box["text"] for box in plan["boxes"] if box["enabled"] and box["text"]]
        if not sentences:
            messagebox.showinfo("SEVA.GIS", "Add at least one query first.")
            return
        payload = {"sentences": sentences, "max_cloud": plan["defaults"].get("max_cloud", 20)}
        if plan["defaults"].get("start_date"):
            payload["start_date"] = plan["defaults"]["start_date"]
        if plan["defaults"].get("end_date"):
            payload["end_date"] = plan["defaults"]["end_date"]
        self._start(self._job_plan_then_run, payload, plan)

    def _job_plan_then_run(self, payload, plan, report):
        report("Reading the area and describing %d box(es)…" % len(payload["sentences"]))
        ring, name, error = self._aoi()
        if error:
            raise seva_core.SevaError(error)
        result = seva_core.plan_request(self.config, "/api/earth-engine/interpret", payload)
        seva_plan.assign_interpretation(plan, result.get("boxes"))
        report("Running the queries…")
        outcome = seva_client.run_queries(
            plan,
            ring,
            self.config,
            progress=lambda index, total, text: report("Box %d of %d: %s" % (index, total, text[:48])),
            raster_mode="geotiff",
        )
        return {"plan": plan, "result": result, "outcome": outcome, "ring": ring, "area": name}

    def _job_run(self, payload, plan, report):
        ring, name, error = self._aoi()
        if error:
            raise seva_core.SevaError(error)
        outcome = seva_client.run_queries(
            plan,
            ring,
            self.config,
            progress=lambda index, total, text: report("Box %d of %d: %s" % (index, total, text[:48])),
            raster_mode="geotiff",
        )
        return {"outcome": outcome, "ring": ring, "area": name}

    def _aoi(self):
        layer = self.layer_var.get().strip()
        if not layer:
            return None, "", "Choose a polygon layer first, or use the toolbox tool with a layer selected."
        return seva_arcgis.extract_aoi(layer, bool(self.selection_var.get()))

    # ------------------------------------------------------------------ threading
    def _start(self, job, payload, plan):
        if self.busy:
            return
        self.busy = True
        self.run_button.configure(state="disabled")
        self.plan_button.configure(state="disabled")
        self.progress.pack(fill="x", pady=(6, 0))
        self.progress.start(12)

        def report(text):
            self.queue.put(("progress", text))

        def work():
            try:
                self.queue.put(("done", job(payload, plan, report)))
            except seva_core.SevaError as exc:
                self.queue.put(("failed", str(exc)))
            except Exception as exc:  # a crash in a thread must still surface
                self.queue.put(("failed", "Unexpected problem: %s" % exc))

        thread = threading.Thread(target=work)
        thread.daemon = True
        thread.start()
        self._poll()

    def _poll(self):
        try:
            while True:
                kind, payload = self.queue.get_nowait()
                if kind == "progress":
                    self.status_var.set(payload)
                elif kind == "done":
                    self._finish(payload)
                    return
                elif kind == "failed":
                    self._set_busy(False)
                    self.status_var.set(payload)
                    messagebox.showwarning("SEVA.GIS", payload)
                    return
        except Empty:
            pass
        self.root.after(120, self._poll)

    def _set_busy(self, busy):
        self.busy = busy
        if bus:
            self.run_button.configure(state="normal")
            self.plan_button.configure(state="normal")
            self.progress.stop()
            self.progress.pack_forget()

    def _finish(self, payload):
        self._set_busy(False)
        plan = payload.get("plan")
        if plan is not None:
            self.plan = plan
            seva_plan.save_plan(plan)
            self._show_result(plan)
        outcome = payload.get("outcome")
        if outcome is None:
            self.status_var.set("Planned %s" % seva_plan.summarise(self.plan))
            return

        added, problems = self._add_layers(outcome)
        for error in outcome.get("errors", []):
            for box in self.plan.get("boxes", []):
                if box.get("id") == error.get("box"):
                    box["error"] = error.get("error", "")
        self._show_result(self.plan)
        if payload.get("ring"):
            seva_arcgis.zoom_to_ring(payload["ring"])
        message = "Added %d layer(s): %s" % (len(added), " | ".join(added)) if added else "Nothing was added."
        problems = list(problems) + [error.get("error", "") for error in outcome.get("errors", [])]
        if problems:
            message += "\n\n" + "\n".join(problem for problem in problems if problem)
            messagebox.showwarning("SEVA.GIS", message)
        self.status_var.set(message.split("\n")[0])

    def _add_layers(self, outcome):
        added, problems = [], []
        for item in outcome.get("layers", []):
            report = self.status_var.set
            if item.get("kind") == "raster_file":
                report("Downloading %s…" % item.get("name"))
                path, error = seva_arcgis.download_file(item.get("download_url"), item.get("name"))
                if error:
                    problems.append("%s: %s" % (item.get("name"), error))
                    continue
                name, error = seva_arcgis.add_raster(path, item.get("name"))
                if error:
                    problems.append("%s: %s" % (item.get("name"), error))
                else:
                    added.append(name)
            elif item.get("kind") == "vector":
                name, error = seva_arcgis.add_vector(item.get("geojson"), item.get("name"), item.get("style"))
                if error:
                    problems.append("%s: %s" % (item.get("name"), error))
                else:
                    added.append(name)
            else:
                problems.append(
                    "%s arrives as a tile template, which ArcGIS cannot add as a layer. "
                    "Use QGIS for this one, or ask for it again as an index export." % item.get("name")
                )
        tables = outcome.get("tables") or []
        for table in tables:
            self._show_table(table)
        return added, problems

    def _show_table(self, table):
        window = tk.Toplevel(self.root)
        window.title(table.get("name") or "SEVA.GIS results")
        columns = table.get("columns") or []
        tree = ttk.Treeview(window, columns=columns, show="headings", height=min(18, max(3, len(table.get("rows") or []))))
        for column in columns:
            tree.heading(column, text=str(column))
            tree.column(column, width=110, anchor="center")
        for row in table.get("rows") or []:
            tree.insert("", "end", values=["" if value is None else value for value in row])
        tree.pack(fill="both", expand=True, padx=8, pady=8)
        caption = table.get("note") or ""
        if caption:
            ttk.Label(window, text=caption, wraplength=620).pack(anchor="w", padx=8, pady=(0, 8))

    # ------------------------------------------------------------------ persistence
    def _load_saved_plan(self):
        saved = seva_core.load_plan()
        boxes = saved.get("boxes") or []
        if boxes:
            for box in boxes:
                self.add_box(box.get("text", ""), box.get("id"), box.get("enabled", True))
            defaults = saved.get("defaults") or {}
            if defaults.get("max_cloud") is not None:
                self.cloud_var.set(str(defaults.get("max_cloud")))
            if defaults.get("start_date") and defaults.get("end_date"):
                self.latest_var.set(0)
                self.start_var.set(defaults["start_date"])
                self.end_var.set(defaults["end_date"])
                self._sync_window()
            self.plan = saved if any(box.get("resolved") for box in boxes) else None
        else:
            self.add_box()

    def on_save(self):
        path = filedialog.asksaveasfilename(title="Save queries", defaultextension=".json", filetypes=[("SEVA.GIS queries", "*.json")])
        if not path:
            return
        plan = self._collect_plan()
        handle = open(path, "w")
        try:
            json.dump(plan, handle, indent=2)
        finally:
            handle.close()
        self.status_var.set("Saved %d box(es) to %s" % (len(plan["boxes"]), path))

    def on_load(self):
        path = filedialog.askopenfilename(title="Load queries", filetypes=[("SEVA.GIS queries", "*.json")])
        if not path:
            return
        handle = open(path)
        try:
            plan = json.load(handle)
        finally:
            handle.close()
        self._clear()
        for box in plan.get("boxes") or []:
            self.add_box(box.get("text", ""), box.get("id"), box.get("enabled", True))
        if not self.rows:
            self.add_box()
        self.plan = None
        self.status_var.set("Loaded %d box(es). Press Add layers to map." % len(plan.get("boxes") or []))

    def close(self):
        try:
            self.root.destroy()
        except Exception:
            pass


def open_window(layer=None, use_selection=True):
    """Open the window, or focus it when it is already open. Returns the window."""
    window = QueryBoxesWindow(layer, use_selection)
    try:
        window.root.mainloop()
    except Exception:
        pass
    return window
