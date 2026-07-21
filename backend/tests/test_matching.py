"""
test_matching.py

Regression test for a real data-loss bug found in a follow-up audit:
is_action_active() and get_current_stage() used plain substring checks for
keywords like "dead"/"died", which false-positive on the extremely common
word "deadline" ("extends the deadline for submission of comments"). Since
is_action_active() returning False causes sync.py to delete the bill from
the database, this silently destroyed active bills whose text happened to
mention a deadline.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

from backend.app.services.matching import is_action_active, get_current_stage


class TestIsActionActive(unittest.TestCase):

    def test_deadline_text_is_not_misclassified_as_dead(self):
        self.assertTrue(is_action_active("Extends the deadline for submission of public comments."))
        self.assertTrue(is_action_active("Committee action deferred pending a new deadline."))

    def test_actually_dead_bill_is_still_detected(self):
        self.assertFalse(is_action_active("The bill died in committee at the end of the session."))
        self.assertFalse(is_action_active("Motion to proceed failed by a vote of 45-55."))
        self.assertFalse(is_action_active("Vetoed by the President."))
        self.assertFalse(is_action_active("Bill withdrawn by sponsor."))

    def test_became_law_is_active_not_dead(self):
        self.assertTrue(is_action_active("Became Public Law No. 119-1."))

    def test_none_or_empty_text_is_active(self):
        self.assertTrue(is_action_active(None))
        self.assertTrue(is_action_active(""))


class TestGetCurrentStage(unittest.TestCase):

    def test_deadline_text_does_not_map_to_failed_dead(self):
        stage = get_current_stage("Extends the deadline for submission of public comments.")
        self.assertNotEqual(stage, "Failed/Dead")

    def test_died_in_committee_maps_to_failed_dead(self):
        self.assertEqual(get_current_stage("Bill died in committee."), "Failed/Dead")

    def test_vetoed_maps_to_vetoed(self):
        self.assertEqual(get_current_stage("Vetoed by the President."), "Vetoed")

    def test_became_law_maps_correctly(self):
        self.assertEqual(get_current_stage("Became Public Law No. 119-1."), "Became Law")


if __name__ == "__main__":
    unittest.main()
