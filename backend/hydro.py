"""Surface hydrology and stream-network vectorisation for the SEVA.GIS tile service.

Pure NumPy, so every function here is unit-testable without Earth Engine, GDAL or
any geo stack. The pipeline is the standard one used by desktop GIS:

1. priority-flood depression fill (Barnes et al. 2014),
2. D8 flow directions on the filled surface,
3. D8 flow accumulation,
4. a downstream walk over the accumulation grid that emits real LineString
   coordinates for the stream network.

Flow is guaranteed acyclic. Directions always step to the neighbour that is
lexicographically smaller in ``(elevation, cell index)``; flat areas left behind
by the fill pass are nudged by a monotone, index-proportional epsilon so the same
strict ordering holds there too. A quantity that strictly decreases along every
path cannot form a cycle, which is what makes the accumulation pass and the
downstream walk terminate.

The accumulated value is a cell count, i.e. "how many cells drain through here".
Call it a flow-accumulation index: it is a slope-and-area proxy for where a
channel sits, not a calibrated discharge.
"""
from __future__ import annotations

import heapq
import math

import numpy as np

# 8-connected D8 neighbourhood: (drow, dcol, distance in cell units).
OFFSETS = (
    (-1, 0, 1.0),
    (-1, 1, math.sqrt(2.0)),
    (0, 1, 1.0),
    (1, 1, math.sqrt(2.0)),
    (1, 0, 1.0),
    (1, -1, math.sqrt(2.0)),
    (0, -1, 1.0),
    (-1, -1, math.sqrt(2.0)),
)

MAX_SEGMENTS = 600

# Direction codes are evaluated in this order so that, when two neighbours offer the
# same drop, the cardinal one wins. Without it, ties between a cardinal and a diagonal
# neighbour would resolve toward the grid corner and paint north-west streaks across
# level terrain.
CARDINALS_FIRST = (0, 2, 4, 6, 1, 3, 5, 7)


def _slices(offset: int, size: int) -> tuple[slice, slice]:
    """Source and destination slices so that out[dest] = arr[src] for an index offset."""
    if offset >= 0:
        return slice(offset, size), slice(0, size - offset)
    return slice(0, size + offset), slice(-offset, size)


def _shift(arr: np.ndarray, drow: int, dcol: int, fill) -> np.ndarray:
    """Value of the neighbour at (row + drow, col + dcol), evaluated at (row, col)."""
    rows, cols = arr.shape
    out = np.full_like(arr, fill)
    src_r, dst_r = _slices(drow, rows)
    src_c, dst_c = _slices(dcol, cols)
    out[dst_r, dst_c] = arr[src_r, src_c]
    return out


def fill_depressions(dem: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Fill interior pits by priority flooding inward from the valid border cells.

    Border cells are the drainage edge, which is the right assumption when the area
    of interest is a polygon cut out of a larger DEM: whatever leaves the polygon is
    assumed to leave the study area.
    """
    dem = np.asarray(dem, dtype=np.float64)
    rows, cols = dem.shape
    filled = dem.copy()
    closed = ~valid

    border = np.zeros((rows, cols), dtype=bool)
    border[0, :] = border[-1, :] = True
    border[:, 0] = border[:, -1] = True

    heap: list[tuple[float, int]] = []
    for row, col in np.argwhere(border & valid):
        closed[row, col] = True
        heapq.heappush(heap, (float(dem[row, col]), int(row) * cols + int(col)))

    while heap:
        elevation, flat = heapq.heappop(heap)
        row, col = divmod(flat, cols)
        for drow, dcol, _ in OFFSETS:
            nrow, ncol = row + drow, col + dcol
            if 0 <= nrow < rows and 0 <= ncol < cols and not closed[nrow, ncol]:
                closed[nrow, ncol] = True
                neighbour = dem[nrow, ncol]
                raised = neighbour if neighbour > elevation else elevation
                filled[nrow, ncol] = raised
                heapq.heappush(heap, (float(raised), nrow * cols + ncol))
    return filled


def nudge_flats(filled: np.ndarray, valid: np.ndarray, epsilon: float = 1e-7) -> np.ndarray:
    """Break filled flats by a strictly decreasing, index-proportional epsilon."""
    rows, cols = filled.shape
    out = np.asarray(filled, dtype=np.float64).copy()
    if rows * cols == 0:
        return out
    rank = np.arange(rows * cols, dtype=np.float64).reshape(rows, cols)
    rank /= float(rows * cols)
    out = out + rank * epsilon
    out[~valid] = np.nan
    return out


def flow_directions(filled: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """D8 direction code per cell: index into OFFSETS, or -1 for an outlet/edge cell.

    Preference order per cell: the largest drop wins; equal drops favour the cardinal
    neighbour over the diagonal; and if no neighbour is lower at all the cell steps to
    the equal-elevation neighbour with the smaller cell index. Those two cases cover
    every step, and each one strictly decreases ``(elevation, index)``, so flow can
    never cycle.
    """
    rows, cols = filled.shape
    index = np.arange(rows * cols, dtype=np.float64).reshape(rows, cols)
    mask = valid.astype(np.float64)

    lower_elevation = np.full((rows, cols), np.inf)
    lower_distance = np.full((rows, cols), np.inf)
    lower_code = np.full((rows, cols), -1, dtype=np.int8)
    flat_index = np.full((rows, cols), np.inf)
    flat_code = np.full((rows, cols), -1, dtype=np.int8)

    for code in CARDINALS_FIRST:
        drow, dcol, distance = OFFSETS[code]
        neighbour_elevation = _shift(filled, drow, dcol, np.inf)
        inside = _shift(mask, drow, dcol, 0.0) > 0.5
        neighbour_index = _shift(index, drow, dcol, np.inf)

        lower = inside & (neighbour_elevation < filled)
        take = lower & (
            (neighbour_elevation < lower_elevation)
            | ((neighbour_elevation == lower_elevation) & (distance < lower_distance))
        )
        lower_elevation = np.where(take, neighbour_elevation, lower_elevation)
        lower_distance = np.where(take, distance, lower_distance)
        lower_code = np.where(take, code, lower_code)

        flat = inside & (neighbour_elevation == filled) & (neighbour_index < index)
        take_flat = flat & (neighbour_index < flat_index)
        flat_index = np.where(take_flat, neighbour_index, flat_index)
        flat_code = np.where(take_flat, code, flat_code)

    code = np.where(lower_code >= 0, lower_code, flat_code)
    return np.where(valid, code, -1).astype(np.int8)


def downstream_neighbours(directions: np.ndarray) -> np.ndarray:
    """Flat downstream cell index per cell; -1 for outlets and off-grid targets."""
    rows, cols = directions.shape
    flat_dir = directions.reshape(-1)
    downstream = np.full(rows * cols, -1, dtype=np.int64)
    for code, (drow, dcol, _) in enumerate(OFFSETS):
        cells = np.flatnonzero(flat_dir == code)
        if cells.size == 0:
            continue
        row = cells // cols
        col = cells % cols
        nrow = row + drow
        ncol = col + dcol
        inside = (nrow >= 0) & (nrow < rows) & (ncol >= 0) & (ncol < cols)
        downstream[cells[inside]] = (nrow[inside] * cols + ncol[inside]).astype(np.int64)
    return downstream


def accumulation(directions: np.ndarray, valid: np.ndarray, filled: np.ndarray) -> np.ndarray:
    """Cells draining through each cell, itself included.

    Cells are visited in descending (elevation, index) order. That is a valid reverse
    topological order because every downstream step strictly decreases that pair, so a
    cell's upstream neighbours are always folded in before the cell is passed on.
    """
    rows, cols = directions.shape
    downstream = downstream_neighbours(directions)
    counts = np.ones(rows * cols, dtype=np.float64)
    counts[~valid.reshape(-1)] = 0.0

    elevation = np.asarray(filled, dtype=np.float64).reshape(-1)
    flat_index = np.arange(rows * cols, dtype=np.float64)
    # lexsort: last key is primary -> ascending (elevation, index); reversed -> descending.
    order = np.lexsort((flat_index, elevation))[::-1]
    for cell in order:
        target = downstream[cell]
        if target >= 0:
            counts[target] += counts[cell]
    return counts.reshape(rows, cols)


def stream_paths(
    accumulation_grid: np.ndarray,
    downstream: np.ndarray,
    threshold: float,
    min_points: int = 2,
) -> list[list[int]]:
    """Trace upstream-to-downstream channel paths over cells above ``threshold``."""
    stream = (accumulation_grid.reshape(-1) >= threshold).copy()
    total = stream.size

    upstream_count = np.zeros(total, dtype=np.int64)
    for cell in np.flatnonzero(stream):
        target = downstream[cell]
        if 0 <= target < total and stream[target]:
            upstream_count[target] += 1

    visited = np.zeros(total, dtype=bool)
    paths: list[list[int]] = []

    def walk(start: int) -> list[int]:
        path: list[int] = []
        cell = start
        while 0 <= cell < total and stream[cell] and not visited[cell]:
            visited[cell] = True
            path.append(cell)
            cell = int(downstream[cell])
        return path

    for head in np.flatnonzero(stream & (upstream_count == 0)):
        if len(paths) >= MAX_SEGMENTS:
            break
        path = walk(int(head))
        if len(path) >= min_points:
            paths.append(path)

    # Channels whose head was already consumed by an upstream walk are still emitted,
    # so no part of the network is silently dropped.
    for cell in np.flatnonzero(stream & ~visited):
        if len(paths) >= MAX_SEGMENTS:
            break
        path = walk(int(cell))
        if len(path) >= min_points:
            paths.append(path)
    return paths


def path_to_lonlat(path: list[int], bounds: tuple[float, float, float, float], shape) -> list[list[float]]:
    """Map pixel-centre cell indices to [lon, lat] over an axis-aligned EPSG:4326 grid."""
    rows, cols = shape
    lon_min, lat_min, lon_max, lat_max = bounds
    dx = (lon_max - lon_min) / float(cols)
    dy = (lat_max - lat_min) / float(rows)
    return [
        [round(lon_min + (col + 0.5) * dx, 7), round(lat_max - (row + 0.5) * dy, 7)]
        for row, col in (divmod(cell, cols) for cell in path)
    ]


def path_length_km(coordinates: list[list[float]]) -> float:
    """Equirectangular length of a lon/lat polyline, in kilometres."""
    total = 0.0
    for (lon1, lat1), (lon2, lat2) in zip(coordinates, coordinates[1:]):
        mean_lat = math.radians((lat1 + lat2) / 2.0)
        dx = (lon2 - lon1) * 111.320 * math.cos(mean_lat)
        dy = (lat2 - lat1) * 110.574
        total += math.hypot(dx, dy)
    return total


def percentile_threshold(accumulation_grid: np.ndarray, valid: np.ndarray, percentile: float) -> float:
    """Accumulation value at the given percentile of the valid cells (channel head cut-off)."""
    values = accumulation_grid[valid]
    if values.size == 0:
        return 2.0
    return max(float(np.percentile(values, percentile)), 2.0)


def analyse_streams(
    dem: np.ndarray,
    bounds: tuple[float, float, float, float],
    valid: np.ndarray | None = None,
    threshold_percentile: float = 96.0,
    min_points: int = 3,
) -> dict:
    """Full DEM -> stream LineString pipeline.

    Returns a GeoJSON FeatureCollection plus the parameters and grid geometry used, so
    the caller can disclose exactly how the lines were produced.
    """
    dem = np.asarray(dem, dtype=np.float64)
    if valid is None:
        valid = np.isfinite(dem)
    if valid.sum() < 16:
        return {
            "type": "FeatureCollection",
            "features": [],
            "stats": {"reason": "insufficient_valid_dem", "validCells": int(valid.sum())},
        }

    filled = nudge_flats(fill_depressions(dem, valid), valid)
    directions = flow_directions(filled, valid)
    accumulation_grid = accumulation(directions, valid, filled)
    threshold = percentile_threshold(accumulation_grid, valid, threshold_percentile)

    features = []
    total_km = 0.0
    for path in stream_paths(accumulation_grid, downstream_neighbours(directions), threshold, min_points):
        coordinates = path_to_lonlat(path, bounds, dem.shape)
        length = path_length_km(coordinates)
        total_km += length
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": coordinates},
                "properties": {"length_km": round(length, 4), "cells": len(path)},
            }
        )

    rows, cols = dem.shape
    cell_m = ((bounds[3] - bounds[1]) * 110.574 * 1000.0 / float(rows)) if rows else 0.0
    return {
        "type": "FeatureCollection",
        "features": features,
        "stats": {
            "segments": len(features),
            "totalKm": round(total_km, 3),
            "accumulationThreshold": round(threshold, 2),
            "thresholdPercentile": threshold_percentile,
            "validCells": int(valid.sum()),
            "grid": {"rows": int(rows), "cols": int(cols), "cellSizeMeters": round(cell_m, 2)},
            "method": "priority-flood fill -> D8 directions -> D8 accumulation -> downstream trace",
            "limitations": [
                "Flow accumulation counts cells, not calibrated discharge.",
                "Flat areas are drained by a deterministic index tie-break, which can straighten channels across plateaus.",
                "Channel heads depend on the accumulation percentile; lower it to expose more first-order streams.",
            ],
        },
    }
