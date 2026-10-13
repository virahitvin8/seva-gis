"""Unit tests for the DEM -> stream-network pipeline.

Run from the repository root: python -m unittest discover -s backend/tests -t .
No Earth Engine, GDAL or network access is required.
"""
from __future__ import annotations

import unittest

import numpy as np

from backend.hydro import (
    accumulation,
    analyse_streams,
    downstream_neighbours,
    fill_depressions,
    flow_directions,
    nudge_flats,
    path_length_km,
    path_to_lonlat,
    percentile_threshold,
)

BOUNDS = (77.0, 12.0, 77.08, 12.08)


def valley(rows=80, cols=80, pit=None):
    """V-shaped valley along the middle row, draining toward the east edge."""
    rr, cc = np.mgrid[0:rows, 0:cols]
    dem = 0.60 * (cols - 1 - cc) + 0.08 * np.abs(rr - rows // 2) + 100.0
    if pit is not None:
        dem[pit] = 90.0
    return dem, np.ones((rows, cols), dtype=bool)


class FlowDirectionTests(unittest.TestCase):
    def test_planar_slope_follows_the_gradient(self):
        high_west = np.tile(np.arange(30, 0, -1, dtype=float), (10, 1))
        east = flow_directions(high_west, np.ones(high_west.shape, bool))
        self.assertTrue((east[:, 1:-1] == 2).all(), "interior cells must point east (code 2)")

        high_east = high_west[:, ::-1].copy()
        west = flow_directions(high_east, np.ones(high_east.shape, bool))
        self.assertTrue((west[:, 1:-1] == 6).all(), "interior cells must point west (code 6)")

    def test_directly_downhill_neighbour_beats_the_diagonal(self):
        # Equal drop in two directions: the cardinal step must win, otherwise flow
        # drifts diagonally and paints streaks across level terrain.
        plane = np.tile(np.arange(30, 0, -1, dtype=float), (4, 1))
        directions = flow_directions(plane, np.ones(plane.shape, bool))
        self.assertFalse((directions[:, 1:-1] == 1).any())
        self.assertFalse((directions[:, 1:-1] == 3).any())

    def test_outlets_are_marked_not_routed(self):
        flat = np.zeros((5, 5), dtype=float)
        directions = flow_directions(flat, np.ones((5, 5), bool))
        self.assertEqual(int(directions[0, 0]), -1, "the global minimum must be an outlet")

    def test_masked_cells_never_route(self):
        dem, valid = valley()
        valid[10:20, 10:20] = False
        directions = flow_directions(nudge_flats(fill_depressions(dem, valid), valid), valid)
        self.assertTrue((directions[~valid] == -1).all())


class DepressionFillTests(unittest.TestCase):
    def test_pit_is_raised_to_its_lowest_spill_point(self):
        dem, valid = valley(pit=(20, 20))
        filled = fill_depressions(dem, valid)
        spill = min(
            dem[20 + a, 20 + b] for a in (-1, 0, 1) for b in (-1, 0, 1) if (a, b) != (0, 0)
        )
        self.assertAlmostEqual(float(filled[20, 20]), float(spill), places=9)

    def test_filled_surface_has_no_interior_depression(self):
        dem, valid = valley(pit=(20, 20))
        dem[35, 40] = 88.0
        dem[50:52, 25:28] = 95.0
        filled = fill_depressions(dem, valid)
        interior = filled[1:-1, 1:-1]
        lowest_neighbour = np.full_like(interior, np.inf)
        for a in (-1, 0, 1):
            for b in (-1, 0, 1):
                if (a, b) != (0, 0):
                    lowest_neighbour = np.minimum(
                        lowest_neighbour, filled[1 + a : filled.shape[0] - 1 + a, 1 + b : filled.shape[1] - 1 + b]
                    )
        sinks = interior < lowest_neighbour - 1e-12
        self.assertEqual(int(sinks.sum()), 0, "priority flood must remove every interior sink")


class AccumulationTests(unittest.TestCase):
    def test_flow_is_acyclic_and_accumulates_downstream(self):
        dem, valid = valley(pit=(20, 20))
        filled = nudge_flats(fill_depressions(dem, valid), valid)
        directions = flow_directions(filled, valid)
        downstream = downstream_neighbours(directions)
        total = dem.size

        for start in range(total):
            seen, cell, steps = set(), start, 0
            while cell >= 0 and cell not in seen:
                seen.add(cell)
                cell = int(downstream[cell])
                steps += 1
                self.assertLess(steps, total, "downstream walk must terminate")
            self.assertEqual(cell, -1, f"cycle reachable from cell {start}")

        counts = accumulation(directions, valid, filled).reshape(-1)
        for cell in range(total):
            target = int(downstream[cell])
            if target >= 0:
                self.assertGreaterEqual(counts[target], counts[cell], "accumulation must not fall downstream")
        self.assertLessEqual(float(counts.max()), valid.sum() + 1e-6)
        self.assertGreater(float(counts.max()), 100.0, "a valley must gather flow from more than a few cells")


class StreamNetworkTests(unittest.TestCase):
    def test_streams_sit_in_the_valley_and_are_valid_linestrings(self):
        dem, valid = valley()
        features = analyse_streams(dem, BOUNDS, valid, threshold_percentile=95.0)
        self.assertGreater(len(features["features"]), 0, "a valley must produce at least one channel")

        for feature in features["features"]:
            self.assertEqual(feature["geometry"]["type"], "LineString")
            coordinates = feature["geometry"]["coordinates"]
            self.assertGreaterEqual(len(coordinates), 3)
            for lon, lat in coordinates:
                self.assertTrue(BOUNDS[0] <= lon <= BOUNDS[2], "longitude inside the grid")
                self.assertTrue(BOUNDS[1] <= lat <= BOUNDS[3], "latitude inside the grid")

        longest = max(features["features"], key=lambda f: f["properties"]["length_km"])
        lats = [point[1] for point in longest["geometry"]["coordinates"]]
        valley_lat = BOUNDS[1] + (BOUNDS[3] - BOUNDS[1]) * (1 - 0.5)
        self.assertAlmostEqual(float(np.mean(lats)), valley_lat, delta=0.002)

    def test_stats_disclose_method_and_limitations(self):
        dem, valid = valley()
        stats = analyse_streams(dem, BOUNDS, valid)["stats"]
        self.assertIn("method", stats)
        self.assertTrue(stats["limitations"], "results must carry their limitations")
        self.assertEqual(stats["grid"]["rows"], dem.shape[0])
        self.assertGreater(stats["grid"]["cellSizeMeters"], 0)

    def test_tiny_or_empty_areas_return_no_geometry_instead_of_failing(self):
        empty = analyse_streams(np.full((6, 6), np.nan), BOUNDS)
        self.assertEqual(empty["features"], [])
        self.assertEqual(empty["stats"]["reason"], "insufficient_valid_dem")

    def test_lower_threshold_percentile_exposes_more_channel(self):
        dem, valid = valley()
        sparse = analyse_streams(dem, BOUNDS, valid, threshold_percentile=99.0)["stats"]["totalKm"]
        dense = analyse_streams(dem, BOUNDS, valid, threshold_percentile=90.0)["stats"]["totalKm"]
        self.assertGreater(dense, sparse)

    def test_flat_terrain_terminates_and_stays_inside_the_area(self):
        # Flat surfaces are the case that makes naive D8 implementations loop forever.
        features = analyse_streams(np.zeros((40, 40)), BOUNDS, np.ones((40, 40), bool), threshold_percentile=90.0)
        for feature in features["features"]:
            for lon, lat in feature["geometry"]["coordinates"]:
                self.assertTrue(BOUNDS[0] <= lon <= BOUNDS[2])
                self.assertTrue(BOUNDS[1] <= lat <= BOUNDS[3])


class GeometryHelperTests(unittest.TestCase):
    def test_path_to_lonlat_uses_pixel_centres(self):
        coordinates = path_to_lonlat([0, 1], (0.0, 0.0, 1.0, 1.0), (2, 2))
        self.assertEqual(coordinates[0], [0.25, 0.75])
        self.assertEqual(coordinates[1], [0.75, 0.75])

    def test_path_length_matches_a_known_distance(self):
        # 0.01 degrees of latitude is about 1.106 km.
        length = path_length_km([[77.0, 12.0], [77.0, 12.01]])
        self.assertAlmostEqual(length, 1.106, delta=0.01)

    def test_threshold_is_floored_so_a_channel_always_exists(self):
        grid = np.ones((10, 10))
        self.assertGreaterEqual(percentile_threshold(grid, np.ones((10, 10), bool), 100.0), 2.0)


if __name__ == "__main__":
    unittest.main()
