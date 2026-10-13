# -*- coding: utf-8 -*-
"""The query-box list: one sentence per row, in the order the layers will be drawn.

This is the whole idea of the plugin in one widget. A person types a sentence, presses
the + button, types another, and drags them into whatever order they want. Nothing
about Google Earth Engine appears anywhere: no code, no arrays, no account.

Reordering is possible in three ways on purpose, because people reach for different
ones: the grip handle (press and drag), the up and down arrows, and the list order
itself decides the drawing order in the QGIS panel.
"""
from __future__ import print_function

from qgis.PyQt import QtCore, QtWidgets

PLACEHOLDER = "One plain sentence…   e.g.  NDVI   ·   true colour   ·   danger zones   ·   streams where water flows"
MOVE_UP = -1
MOVE_DOWN = 1
MAX_BOXES = 40


def _global_y(event):
    """Qt6 renamed globalPos; QGIS still ships both across versions."""
    if hasattr(event, "globalPosition"):
        return int(event.globalPosition().toPoint().y())
    return int(event.globalPos().y())


class QueryBoxRow(QtWidgets.QFrame):
    """One box: switch, grip, sentence, arrows, delete, and what it turned into."""

    changed = QtCore.pyqtSignal()
    deleteRequested = QtCore.pyqtSignal(str)
    moveRequested = QtCore.pyqtSignal(str, int)
    dragRequested = QtCore.pyqtSignal(object, int)

    def __init__(self, box_id, text="", parent=None):
        super(QueryBoxRow, self).__init__(parent)
        self.box_id = box_id
        self.setFrameShape(QtWidgets.QFrame.StyledPanel)
        self.setObjectName("sevaQueryRow")

        outer = QtWidgets.QVBoxLayout(self)
        outer.setContentsMargins(6, 4, 6, 4)
        outer.setSpacing(2)

        line = QtWidgets.QHBoxLayout()
        line.setSpacing(6)

        self.handle = QtWidgets.QToolButton()
        self.handle.setText("\u283f")  # a grip the eye reads as "hold me"
        self.handle.setToolTip("Press and drag to move this query up or down")
        self.handle.setCursor(QtCore.Qt.OpenHandCursor)
        self.handle.setAutoRaise(True)
        line.addWidget(self.handle)

        self.switch = QtWidgets.QCheckBox()
        self.switch.setChecked(True)
        self.switch.setToolTip("Switch this query off without deleting it")
        line.addWidget(self.switch)

        self.edit = QtWidgets.QLineEdit(text)
        self.edit.setPlaceholderText(PLACEHOLDER)
        self.edit.setClearButtonEnabled(True)
        line.addWidget(self.edit, 1)

        self.up = QtWidgets.QToolButton()
        self.up.setText("\u25b2")
        self.up.setToolTip("Move this query up (draws above the one below it)")
        self.up.setAutoRaise(True)
        line.addWidget(self.up)

        self.down = QtWidgets.QToolButton()
        self.down.setText("\u25bc")
        self.down.setToolTip("Move this query down")
        self.down.setAutoRaise(True)
        line.addWidget(self.down)

        self.remove = QtWidgets.QToolButton()
        self.remove.setText("\u2715")
        self.remove.setToolTip("Delete this query")
        self.remove.setAutoRaise(True)
        line.addWidget(self.remove)

        outer.addLayout(line)

        self.status = QtWidgets.QLabel("")
        self.status.setWordWrap(True)
        self.status.setTextInteractionFlags(QtCore.Qt.TextSelectableByMouse)
        self.status.setContentsMargins(24, 0, 0, 0)
        font = self.status.font()
        font.setPointSize(max(7, font.pointSize() - 1))
        self.status.setFont(font)
        outer.addWidget(self.status)

        self.edit.textChanged.connect(self.changed.emit)
        self.switch.toggled.connect(self.changed.emit)
        self.up.clicked.connect(lambda: self.moveRequested.emit(self.box_id, MOVE_UP))
        self.down.clicked.connect(lambda: self.moveRequested.emit(self.box_id, MOVE_DOWN))
        self.remove.clicked.connect(lambda: self.deleteRequested.emit(self.box_id))
        self.handle.pressed.connect(self._on_grip_pressed)
        self.handle.mouseMoveEvent = self._on_grip_moved  # type: ignore[assignment]

    # -- the sentence and its switch
    def text(self):
        return self.edit.text()

    def set_text(self, value):
        self.edit.setText(value or "")

    def is_enabled(self):
        return bool(self.switch.isChecked())

    def set_enabled(self, value):
        self.switch.setChecked(bool(value))

    # -- what the service made of the sentence
    def show_result(self, resolved=None, error="", note=""):
        resolved = resolved or []
        if error:
            self.status.setText("\u2716 " + error)
            self.status.setStyleSheet("color: #b3261e;")
            self.status.setToolTip(error)
            return

        labels = []
        for item in resolved:
            label = item.get("label") or item.get("op") or ""
            if label and label not in labels:
                labels.append(label)
        if labels:
            self.status.setText("\u2192 " + " · ".join(labels))
            self.status.setStyleSheet("color: #1a7f37;")
        elif self.text().strip():
            self.status.setText("Not planned yet — press Plan queries, or go straight to Add layers.")
            self.status.setStyleSheet("color: #6b7280;")
        else:
            self.status.setText("")
            self.status.setStyleSheet("")
        self.status.setToolTip(note or "")

    # -- dragging by the grip
    def _on_grip_pressed(self):
        self.handle.setCursor(QtCore.Qt.ClosedHandCursor)

    def _on_grip_moved(self, event):
        if event.buttons() & QtCore.Qt.LeftButton:
            self.dragRequested.emit(self, _global_y(event))
        else:
            self.handle.setCursor(QtCore.Qt.OpenHandCursor)
        QtWidgets.QToolButton.mouseMoveEvent(self.handle, event)


class QueryBoxList(QtWidgets.QWidget):
    """The stack of boxes, plus the + button that adds the next one."""

    changed = QtCore.pyqtSignal()

    def __init__(self, parent=None):
        super(QueryBoxList, self).__init__(parent)
        self._layout = QtWidgets.QVBoxLayout(self)
        self._layout.setContentsMargins(0, 0, 0, 0)
        self._layout.setSpacing(4)
        self._layout.addStretch(1)

        self.add_button = QtWidgets.QPushButton("+  Add another query")
        self.add_button.setToolTip("Add a box and type one more thing you want on the map")
        self.add_button.clicked.connect(self._on_add_clicked)

        footer = QtWidgets.QHBoxLayout()
        footer.addWidget(self.add_button)
        footer.addStretch(1)
        self._layout.addLayout(footer)
        self._counter = QtWidgets.QLabel("")
        footer.addWidget(self._counter)

    # -- structure
    def rows(self):
        out = []
        for index in range(self._layout.count()):
            widget = self._layout.itemAt(index).widget()
            if isinstance(widget, QueryBoxRow):
                out.append(widget)
        return out

    def index_of(self, box_id):
        for index, row in enumerate(self.rows()):
            if row.box_id == box_id:
                return index
        return -1

    def row_for(self, box_id):
        for row in self.rows():
            if row.box_id == box_id:
                return row
        return None

    def _insert_row(self, row):
        self._layout.insertWidget(len(self.rows()), row)

    def add_row(self, text="", box_id=None, enabled=True):
        """Add a box at the bottom, where the + button sits."""
        if len(self.rows()) >= MAX_BOXES:
            return None
        row = QueryBoxRow(box_id or self._fresh_id(), text)
        row.set_enabled(enabled)
        row.changed.connect(self._on_row_changed)
        row.deleteRequested.connect(self.remove_row)
        row.moveRequested.connect(self.move_by)
        row.dragRequested.connect(self.drag_to)
        self._insert_row(row)
        self._refresh_counter()
        self.changed.emit()
        return row

    def _fresh_id(self):
        highest = 0
        for row in self.rows():
            if row.box_id.startswith("b"):
                try:
                    highest = max(highest, int(row.box_id[1:]))
                except ValueError:
                    pass
        return "b%d" % (highest + 1)

    def remove_row(self, box_id):
        row = self.row_for(box_id)
        if row is None:
            return False
        self._layout.removeWidget(row)
        row.setParent(None)
        row.deleteLater()
        self._refresh_counter()
        self.changed.emit()
        return True

    def move_by(self, box_id, delta):
        row = self.row_for(box_id)
        if row is None:
            return False
        index = self.index_of(box_id)
        target = index + int(delta)
        if target < 0 or target >= len(self.rows()):
            return False
        self._relocate(row, target)
        return True

    def drag_to(self, row, global_y):
        """Live reorder while the grip is held: the row follows the pointer."""
        for other in self.rows():
            top = other.mapToGlobal(QtCore.QPoint(0, 0)).y()
            if top <= global_y <= top + other.height():
                target = self.index_of(other.box_id)
                if target >= 0 and target != self.index_of(row.box_id):
                    self._relocate(row, target)
                return

    def _relocate(self, row, target):
        self._layout.removeWidget(row)
        self._layout.insertWidget(target, row)
        self._refresh_counter()
        self.changed.emit()

    def clear(self):
        for row in self.rows():
            self._layout.removeWidget(row)
            row.setParent(None)
            row.deleteLater()
        self._refresh_counter()
        self.changed.emit()

    def _on_add_clicked(self):
        row = self.add_row()
        if row is not None:
            row.edit.setFocus()

    def _on_row_changed(self):
        self._refresh_counter()
        self.changed.emit()

    def _refresh_counter(self):
        count = len(self.rows())
        self._counter.setText("%d / %d" % (count, MAX_BOXES) if count else "")

    # -- plan in, plan out, in list order
    def plan_boxes(self):
        return [
            {"id": row.box_id, "text": row.text().strip(), "enabled": row.is_enabled()}
            for row in self.rows()
        ]

    def load_boxes(self, boxes):
        """Rebuild the list from a stored plan, keeping every sentence."""
        self.clear()
        for box in boxes or []:
            self.add_row(box.get("text", ""), box.get("id"), box.get("enabled", True))
        if not boxes:
            self.add_row()
        self._refresh_counter()

    def apply_plan(self, plan):
        """Show each box's plan, its note, or its error, next to its sentence."""
        by_id = {}
        for box in (plan or {}).get("boxes", []):
            by_id[box.get("id")] = box
        for row in self.rows():
            box = by_id.get(row.box_id)
            if box is None:
                row.show_result([], "", "")
                continue
            note = ""
            for item in box.get("resolved", []):
                if item.get("note"):
                    note = item["note"]
                    break
            row.show_result(box.get("resolved") or [], box.get("error", ""), note)
        self._refresh_counter()
