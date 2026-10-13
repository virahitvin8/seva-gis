"""Unit tests for the query-box plan model.

Run from the repository root: python -m unittest discover -s plugins/tests -t .
"""
from __future__ import annotations

import unittest

from plugins.core import seva_plan


def plan_with(*texts):
    plan = seva_plan.empty_plan()
    for text in texts:
        seva_plan.add_box(plan, text)
    return plan


class BoxListTests(unittest.TestCase):
    def test_new_boxes_are_appended_with_fresh_ids(self):
        plan = plan_with("NDVI", "EVI")
        self.assertEqual([box["id"] for box in plan["boxes"]], ["b1", "b2"])
        third = seva_plan.add_box(plan, "SAVI")
        self.assertEqual(third["id"], "b3")
        self.assertEqual(len(plan["boxes"]), 3)

    def test_move_up_and_down_swaps_neighbours(self):
        plan = plan_with("one", "two", "three")
        self.assertTrue(seva_plan.move_box(plan, "b3", -1))
        self.assertEqual([b["text"] for b in plan["boxes"]], ["one", "three", "two"])
        self.assertTrue(seva_plan.move_box(plan, "b3", 1))
        self.assertEqual([b["text"] for b in plan["boxes"]], ["one", "two", "three"])

    def test_moving_past_either_end_is_refused_not_wrapped(self):
        plan = plan_with("one", "two")
        self.assertFalse(seva_plan.move_box(plan, "b1", -1))
        self.assertFalse(seva_plan.move_box(plan, "b2", 1))
        self.assertEqual([b["text"] for b in plan["boxes"]], ["one", "two"])

    def test_drag_reorder_applies_the_new_order(self):
        plan = plan_with("one", "two", "three")
        seva_plan.reorder(plan, ["b3", "b1", "b2"])
        self.assertEqual([b["text"] for b in plan["boxes"]], ["three", "one", "two"])

    def test_reorder_keeps_boxes_the_caller_forgot(self):
        plan = plan_with("one", "two", "three")
        seva_plan.reorder(plan, ["b3"])
        self.assertEqual([b["text"] for b in plan["boxes"]], ["three", "one", "two"])
        self.assertEqual(len(plan["boxes"]), 3, "a query must never disappear")

    def test_editing_a_sentence_discards_its_old_meaning(self):
        plan = plan_with("NDVI")
        plan["boxes"][0]["resolved"] = [{"op": "index", "params": {"indicator": "ndvi"}}]
        seva_plan.set_text(plan, "b1", "streams")
        self.assertEqual(plan["boxes"][0]["resolved"], [], "the plan must be recomputed after an edit")

    def test_toggling_a_box_leaves_the_others_alone(self):
        plan = plan_with("NDVI", "EVI")
        self.assertTrue(seva_plan.set_enabled(plan, "b2", False))
        self.assertEqual(seva_plan.sentences(plan), ["NDVI"])
        self.assertEqual(len(plan["boxes"]), 2, "a switched-off box is kept, not deleted")

    def test_removing_a_box_returns_whether_it_existed(self):
        plan = plan_with("one")
        self.assertTrue(seva_plan.remove_box(plan, "b1"))
        self.assertFalse(seva_plan.remove_box(plan, "b1"))


class DefaultsTests(unittest.TestCase):
    def test_a_settings_box_overrides_the_plan_window(self):
        plan = plan_with("date range from July to August")
        plan["boxes"][0]["resolved"] = [
            {"op": "settings", "params": {"max_cloud": 2}, "start_date": "2026-07-01", "end_date": "2026-08-31"}
        ]
        plan["defaults"] = {"start_date": "2026-01-01", "end_date": "2026-01-31", "max_cloud": 60}
        defaults = seva_plan.active_defaults(plan)
        self.assertEqual(defaults["start_date"], "2026-07-01")
        self.assertEqual(defaults["end_date"], "2026-08-31")
        self.assertEqual(defaults["max_cloud"], 2)

    def test_a_switched_off_settings_box_is_ignored(self):
        plan = plan_with("only two percent cloud")
        plan["boxes"][0]["resolved"] = [{"op": "settings", "params": {"max_cloud": 2}}]
        plan["boxes"][0]["enabled"] = False
        plan["defaults"] = {"max_cloud": 45}
        self.assertEqual(seva_plan.active_defaults(plan)["max_cloud"], 45)


class InterpretationTests(unittest.TestCase):
    def test_several_entries_for_one_sentence_become_one_box(self):
        plan = plan_with("I need NDVI, EVI, SAVI", "streams")
        interpreted = [
            {"text": "I need NDVI, EVI, SAVI", "op": "index", "params": {"indicator": "ndvi"}, "label": "NDVI"},
            {"text": "I need NDVI, EVI, SAVI", "op": "index", "params": {"indicator": "evi"}, "label": "EVI"},
            {"text": "I need NDVI, EVI, SAVI", "op": "index", "params": {"indicator": "savi"}, "label": "SAVI"},
            {"text": "streams", "op": "streams", "params": {}, "label": "Stream lines"},
        ]
        warnings = seva_plan.assign_interpretation(plan, interpreted)
        self.assertEqual(warnings, [])
        self.assertEqual(len(plan["boxes"][0]["resolved"]), 3, "one sentence, three layers")
        self.assertEqual([r["params"]["indicator"] for r in plan["boxes"][0]["resolved"]], ["ndvi", "evi", "savi"])
        self.assertEqual(len(plan["boxes"][1]["resolved"]), 1)

    def test_switched_off_boxes_do_not_consume_an_answer(self):
        plan = plan_with("NDVI", "EVI")
        plan["boxes"][0]["enabled"] = False
        seva_plan.assign_interpretation(plan, [{"text": "EVI", "op": "index", "params": {"indicator": "evi"}}])
        self.assertEqual(plan["boxes"][0]["resolved"], [])
        self.assertEqual(plan["boxes"][1]["resolved"][0]["params"]["indicator"], "evi")

    def test_a_short_answer_warns_instead_of_silently_dropping_a_box(self):
        plan = plan_with("NDVI", "EVI", "SAVI")
        warnings = seva_plan.assign_interpretation(plan, [{"text": "NDVI", "op": "index", "params": {}}])
        self.assertTrue(warnings)
        self.assertIn("1 of 3", warnings[0])


class ValidationTests(unittest.TestCase):
    def test_an_empty_box_is_reported(self):
        plan = plan_with("")
        self.assertTrue(any("empty" in problem.lower() for problem in seva_plan.validate(plan)))

    def test_unknown_operations_are_reported(self):
        plan = plan_with("NDVI")
        plan["boxes"][0]["resolved"] = [{"op": "launch-missile", "params": {}}]
        self.assertTrue(any("unknown operation" in problem for problem in seva_plan.validate(plan)))

    def test_a_plan_with_nothing_switched_on_is_reported(self):
        plan = plan_with("NDVI")
        plan["boxes"][0]["enabled"] = False
        self.assertTrue(any("switched off" in problem for problem in seva_plan.validate(plan)))

    def test_a_normal_plan_has_no_problems(self):
        plan = plan_with("NDVI", "streams")
        plan["boxes"][0]["resolved"] = [{"op": "index", "params": {}}]
        plan["boxes"][1]["resolved"] = [{"op": "streams", "params": {}}]
        self.assertEqual(seva_plan.validate(plan), [])

    def test_summary_counts_only_boxes_that_draw(self):
        plan = plan_with("NDVI", "date range", "streams")
        plan["boxes"][0]["resolved"] = [{"op": "index", "params": {}}]
        plan["boxes"][1]["resolved"] = [{"op": "settings", "params": {}}]
        plan["boxes"][2]["resolved"] = [{"op": "streams", "params": {}}]
        self.assertIn("3 box(es) on", seva_plan.summarise(plan))
        self.assertIn("2 layer(s)", seva_plan.summarise(plan))


if __name__ == "__main__":
    unittest.main()
