# -*- coding: utf-8 -*-
"""The query-box model shared by the QGIS and ArcGIS plugins.

A plan is the ordered list of boxes the user sees:

    { "seva_plan": 2,
      "defaults": {"start_date": "2026-07-01", "end_date": "2026-08-31", "max_cloud": 20},
      "boxes": [ {"id": "b1", "text": "NDVI", "enabled": true,
                  "resolved": [{"op": "index", "params": {...}, "label": "NDVI"}]} ] }

The order of ``boxes`` is the drawing order in the GIS panel, so moving a box up
moves its layer up. Each box keeps the sentence the user typed, and ``resolved``
holds what the service made of it, which is what lets the same sentence produce
several layers without the user losing track of the one thing they wrote.

Plain functions over plain dictionaries: no classes to serialise, and a stored
plan stays readable and editable by hand.
"""
from __future__ import print_function

import re

PLAN_VERSION = 2

OPS = (
    "index", "composite", "dem", "lulc", "zones", "streams",
    "candidates", "boundary", "stats", "change", "alert", "settings",
)

# Operations that draw something on the map. "settings" only sets a window, and
# "stats" produces numbers, so neither becomes a layer.
LAYER_OPS = ("index", "composite", "dem", "lulc", "zones", "streams", "candidates", "boundary", "alert", "change")
VECTOR_OPS = ("zones", "streams", "candidates", "boundary")


def empty_plan():
    return {
        "seva_plan": PLAN_VERSION,
        "defaults": {"start_date": "", "end_date": "", "max_cloud": 20},
        "boxes": [],
    }


def _next_id(plan):
    highest = 0
    for box in plan.get("boxes", []):
        match = re.match(r"b(\d+)$", str(box.get("id", "")))
        if match:
            highest = max(highest, int(match.group(1)))
    return "b%d" % (highest + 1)


def add_box(plan, text=""):
    """Append a box at the end of the list, exactly where the + button places it."""
    box = {"id": _next_id(plan), "text": text or "", "enabled": True, "resolved": []}
    plan.setdefault("boxes", []).append(box)
    return box


def find_box(plan, box_id):
    for index, box in enumerate(plan.get("boxes", [])):
        if box.get("id") == box_id:
            return index, box
    return -1, None


def remove_box(plan, box_id):
    index, box = find_box(plan, box_id)
    if box is None:
        return False
    plan["boxes"].pop(index)
    return True


def set_text(plan, box_id, text):
    _, box = find_box(plan, box_id)
    if box is None:
        return False
    box["text"] = text
    box["resolved"] = []  # the sentence changed, so its meaning must be recomputed
    return True


def set_enabled(plan, box_id, enabled):
    _, box = find_box(plan, box_id)
    if box is None:
        return False
    box["enabled"] = bool(enabled)
    return True


def move_box(plan, box_id, delta):
    """Move a box one step in the list. ``delta`` of -1 is up, +1 is down."""
    index, box = find_box(plan, box_id)
    if box is None:
        return False
    target = index + int(delta)
    boxes = plan["boxes"]
    if target < 0 or target >= len(boxes):
        return False
    boxes[index], boxes[target] = boxes[target], boxes[index]
    return True


def reorder(plan, ordered_ids):
    """Apply a drag-and-drop order. Unknown ids are ignored, dropped ones are kept.

    Anything the caller forgot to mention stays at the end rather than vanishing,
    because losing a query silently is worse than an unexpected position.
    """
    boxes = plan.get("boxes", [])
    by_id = {}
    for box in boxes:
        by_id[box.get("id")] = box
    ordered = []
    for box_id in ordered_ids or []:
        box = by_id.pop(box_id, None)
        if box is not None:
            ordered.append(box)
    for box in boxes:
        if box.get("id") in by_id:
            ordered.append(by_id.pop(box["id"]))
    plan["boxes"] = ordered
    return plan


def clear_resolved(plan):
    for box in plan.get("boxes", []):
        box["resolved"] = []
        box.pop("error", None)
    return plan


def sentences(plan, only_enabled=True):
    """The exact text of each box, in drawing order, as sent to the service."""
    out = []
    for box in plan.get("boxes", []):
        if only_enabled and not box.get("enabled", True):
            continue
        text = (box.get("text") or "").strip()
        out.append(text)
    return out


def active_defaults(plan):
    """Plan-wide window, with any settings box layered on top.

    A user who writes "date range from July to August" in a box expects it to apply
    to the run, and a user who wrote the dates in the Settings fields expects the
    same. Both arrive here, and a box with its own dates still wins later on.
    """
    defaults = dict(plan.get("defaults") or {})
    for box in plan.get("boxes", []):
        if not box.get("enabled", True):
            continue
        for resolved in box.get("resolved", []):
            if resolved.get("op") != "settings":
                continue
            if resolved.get("start_date"):
                defaults["start_date"] = resolved["start_date"]
            if resolved.get("end_date"):
                defaults["end_date"] = resolved["end_date"]
            cloud = (resolved.get("params") or {}).get("max_cloud")
            if cloud is not None:
                defaults["max_cloud"] = cloud
    return defaults


def assign_interpretation(plan, interpreted_boxes):
    """Attach the service's answer to the boxes the user typed.

    The service returns one entry per sentence in order, and it may return several
    entries for one sentence (``"NDVI, EVI and SAVI"``). Consecutive entries that
    share the same text therefore belong to the same box, which lines the answer up
    with the user's list without relying on ids that were assigned elsewhere.
    """
    groups = []
    for item in interpreted_boxes or []:
        text = (item.get("text") or "").strip()
        if groups and groups[-1][0] == text:
            groups[-1][1].append(item)
        else:
            groups.append((text, [item]))

    enabled_boxes = [b for b in plan.get("boxes", []) if b.get("enabled", True)]
    warnings = []
    if len(groups) != len(enabled_boxes):
        warnings.append(
            "The service described %d of %d boxes; the rest were left as typed."
            % (len(groups), len(enabled_boxes))
        )
    for box, (_, group) in zip(enabled_boxes, groups):
        box["resolved"] = group
        box.pop("error", None)
        box["engine"] = group[0].get("engine", "")
    return warnings


def validate(plan):
    """Problems a user can fix, stated in their language."""
    problems = []
    for box in plan.get("boxes", []):
        text = (box.get("text") or "").strip()
        if not text:
            problems.append("Box %s is empty." % box.get("id"))
            continue
        for resolved in box.get("resolved", []):
            op = resolved.get("op")
            if op not in OPS:
                problems.append("Box %s asks for an unknown operation: %s" % (box.get("id"), op))
    if not [b for b in plan.get("boxes", []) if b.get("enabled", True)]:
        problems.append("Nothing to run: every box is switched off.")
    return problems


def summarise(plan):
    """One-line description used by the dialogs and the status bars."""
    boxes = [b for b in plan.get("boxes", []) if b.get("enabled", True)]
    layers = 0
    for box in boxes:
        for resolved in box.get("resolved", []):
            if resolved.get("op") in LAYER_OPS:
                layers += 1
    if not boxes:
        return "No queries yet. Type one sentence per box and press + to add more."
    return "%d box(es) on, %d layer(s) will be added in order." % (len(boxes), layers)
