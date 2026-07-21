"""
test_semantic_scoring.py

Phase A of issue #8 (missing test coverage): the pure, mock-free functions in
services/semantic_scoring.py — cosine_similarity, _sim_to_score,
build_candidate_text, and bill_text_for_embedding. No HTTP, Redis, or DB
involved; these are plain math/string helpers.
"""
from __future__ import annotations

import os
import sys
import unittest
from types import SimpleNamespace
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("CONGRESS_API_KEY", "test_dummy")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("OPENROUTER_API_KEY", "test_dummy")

from backend.app.services.semantic_scoring import (
    cosine_similarity,
    _sim_to_score,
    build_candidate_text,
    bill_text_for_embedding,
    _SIM_LOW,
    _SIM_HIGH,
)


class TestCosineSimilarity(unittest.TestCase):

    def test_identical_vectors_score_one(self):
        v = [1.0, 2.0, 3.0]
        self.assertAlmostEqual(cosine_similarity(v, v), 1.0)

    def test_orthogonal_vectors_score_zero(self):
        self.assertAlmostEqual(cosine_similarity([1.0, 0.0], [0.0, 1.0]), 0.0)

    def test_opposite_vectors_score_negative_one(self):
        self.assertAlmostEqual(cosine_similarity([1.0, 0.0], [-1.0, 0.0]), -1.0)

    def test_zero_vector_returns_zero_not_divide_by_zero(self):
        self.assertEqual(cosine_similarity([0.0, 0.0], [1.0, 1.0]), 0.0)
        self.assertEqual(cosine_similarity([1.0, 1.0], [0.0, 0.0]), 0.0)


class TestSimToScore(unittest.TestCase):

    def test_low_bound_maps_to_zero(self):
        self.assertEqual(_sim_to_score(_SIM_LOW), 0)

    def test_high_bound_maps_to_hundred(self):
        self.assertEqual(_sim_to_score(_SIM_HIGH), 100)

    def test_midpoint_maps_to_fifty(self):
        midpoint = (_SIM_LOW + _SIM_HIGH) / 2
        self.assertEqual(_sim_to_score(midpoint), 50)

    def test_below_low_bound_clamps_to_zero(self):
        self.assertEqual(_sim_to_score(-1.0), 0)
        self.assertEqual(_sim_to_score(0.0), 0)

    def test_above_high_bound_clamps_to_hundred(self):
        self.assertEqual(_sim_to_score(1.0), 100)


class TestBuildCandidateText(unittest.TestCase):

    def test_all_fields_present(self):
        text = build_candidate_text(
            title="Animal Welfare Act",
            policy_area="Animals",
            subject_names=["Livestock", "Mammals"],
            summary="A bill to protect animals.",
        )
        self.assertIn("Animal Welfare Act", text)
        # Title is intentionally repeated (highest signal).
        self.assertEqual(text.count("Animal Welfare Act"), 2)
        self.assertIn("Policy area: Animals", text)
        self.assertIn("Subjects: Livestock, Mammals", text)
        self.assertIn("A bill to protect animals.", text)

    def test_missing_fields_are_omitted_not_blank(self):
        text = build_candidate_text(title="Only A Title", policy_area=None, subject_names=[], summary=None)
        self.assertEqual(text, "Only A Title | Only A Title")

    def test_all_fields_empty_returns_empty_string(self):
        self.assertEqual(build_candidate_text(None, None, [], None), "")

    def test_summary_truncated_to_1500_chars(self):
        long_summary = "x" * 3000
        text = build_candidate_text("T", None, [], long_summary)
        # Only the truncated 1500-char slice should appear.
        self.assertIn("x" * 1500, text)
        self.assertNotIn("x" * 1501, text)


class TestBillTextForEmbedding(unittest.TestCase):

    def _doc(self, **overrides):
        defaults = dict(
            title="Bill Title",
            policy_area="Animals",
            subjects=[SimpleNamespace(name="Livestock")],
            ai_summary="AI generated summary.",
            official_summary="Official CRS summary.",
        )
        defaults.update(overrides)
        return SimpleNamespace(**defaults)

    def test_prefers_ai_summary_over_official_summary(self):
        doc = self._doc()
        text = bill_text_for_embedding(doc)
        self.assertIn("AI generated summary.", text)
        self.assertNotIn("Official CRS summary.", text)

    def test_falls_back_to_official_summary_when_no_ai_summary(self):
        doc = self._doc(ai_summary=None)
        text = bill_text_for_embedding(doc)
        self.assertIn("Official CRS summary.", text)

    def test_empty_subjects_list_when_doc_has_none(self):
        doc = self._doc(subjects=[])
        text = bill_text_for_embedding(doc)
        self.assertNotIn("Subjects:", text)


if __name__ == "__main__":
    unittest.main()
