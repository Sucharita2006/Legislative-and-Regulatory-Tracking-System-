"""
test_sync_process_bill.py

Phase C of issue #8 (missing test coverage): services/sync.py's process_bill(),
the single shared pipeline used by both historical backfill and daily sync.

Strategy: `db` is a MagicMock whose `.query(Model)` is routed by model class
(LegislativeDocument lookups return a configurable "existing doc"; Subject
lookups return None so process_bill always creates fresh Subject rows,
keeping tests simple). `client` is a MagicMock CongressAPIClient. The
semantic prefilter, AI scoring, and embedding calls are patched out — they
either need real network access or are irrelevant to the branch being tested.
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("CONGRESS_API_KEY", "test_dummy")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("OPENROUTER_API_KEY", "test_dummy")

from backend.app.models import LegislativeDocument, Subject, BillAction
from backend.app.services.sync import (
    process_bill,
    OUTCOME_INACTIVE,
    OUTCOME_NO_MATCH,
    OUTCOME_UNCHANGED,
    OUTCOME_INSERTED,
)


def make_mock_db(existing_doc=None):
    """A MagicMock db whose .query(Model) behavior differs by model:
    - LegislativeDocument lookups return `existing_doc` (None for a fresh bill).
    - Subject lookups always return None, so process_bill always creates new
      Subject rows rather than needing per-name mock configuration.
    - BillAction .delete() is a no-op.
    """
    mock_db = MagicMock()

    def query_side_effect(model):
        chain = MagicMock()
        if model is Subject:
            chain.filter.return_value.first.return_value = None
        elif model is BillAction:
            chain.filter.return_value.delete.return_value = None
        else:
            chain.filter.return_value.first.return_value = existing_doc
        return chain

    mock_db.query.side_effect = query_side_effect
    return mock_db


def make_mock_client(subjects=None, detail=None, actions=None):
    client = MagicMock()
    client.fetch_bill_subjects.return_value = subjects or {
        "subjects": {"policyArea": {}, "legislativeSubjects": []}
    }
    client.fetch_bill_details.return_value = detail or {"bill": {}}
    client.fetch_bill_actions.return_value = actions or {"actions": []}
    return client


class TestProcessBillEarlyExits(unittest.TestCase):

    def test_malformed_bill_returns_none(self):
        db = make_mock_db()
        client = make_mock_client()
        result = process_bill(db=db, client=client, list_bill={}, congress=119, active_subject_names=set())
        self.assertIsNone(result)
        client.fetch_bill_subjects.assert_not_called()

    def test_inactive_bill_not_previously_stored(self):
        db = make_mock_db(existing_doc=None)
        client = make_mock_client()
        list_bill = {"number": "1", "type": "HR", "latestAction": {"text": "Vetoed by the President."}}

        result = process_bill(db=db, client=client, list_bill=list_bill, congress=119, active_subject_names=set())

        self.assertEqual(result.outcome, OUTCOME_INACTIVE)
        self.assertEqual(result.source_id, "119-HR-1")
        db.delete.assert_not_called()
        client.fetch_bill_subjects.assert_not_called()

    def test_inactive_bill_previously_stored_gets_deleted(self):
        existing = LegislativeDocument(source_id="119-HR-1")
        db = make_mock_db(existing_doc=existing)
        client = make_mock_client()
        list_bill = {"number": "1", "type": "HR", "latestAction": {"text": "Bill failed in the Senate."}}

        result = process_bill(db=db, client=client, list_bill=list_bill, congress=119, active_subject_names=set())

        self.assertEqual(result.outcome, OUTCOME_INACTIVE)
        db.delete.assert_called_once_with(existing)
        db.commit.assert_called()

    def test_unchanged_update_date_skips_further_api_calls(self):
        from backend.app.services.sync import parse_datetime
        same_update_date = parse_datetime("2026-01-01T00:00:00Z")
        existing = LegislativeDocument(source_id="119-HR-1", update_date=same_update_date)
        db = make_mock_db(existing_doc=existing)
        client = make_mock_client()
        list_bill = {
            "number": "1", "type": "HR",
            "latestAction": {"text": "Referred to committee"},
            "updateDate": "2026-01-01T00:00:00Z",
        }

        result = process_bill(db=db, client=client, list_bill=list_bill, congress=119, active_subject_names=set())

        self.assertEqual(result.outcome, OUTCOME_UNCHANGED)
        self.assertIs(result.document, existing)
        client.fetch_bill_subjects.assert_not_called()
        client.fetch_bill_details.assert_not_called()


@patch("backend.app.services.semantic_scoring.semantic_prefilter")
class TestProcessBillNoMatch(unittest.TestCase):

    def test_no_curated_and_no_semantic_match_is_rejected(self, mock_prefilter):
        mock_prefilter.return_value = {"score": 0, "embedding": None}
        db = make_mock_db(existing_doc=None)
        client = make_mock_client(
            subjects={"subjects": {"policyArea": {"name": "Something Unrelated"}, "legislativeSubjects": []}},
            detail={"bill": {"title": "Unrelated Bill", "summaries": {"count": 0}}},
        )
        list_bill = {"number": "2", "type": "HR", "latestAction": {"text": "Referred to committee"}}

        result = process_bill(db=db, client=client, list_bill=list_bill, congress=119, active_subject_names=set())

        self.assertEqual(result.outcome, OUTCOME_NO_MATCH)
        db.add.assert_not_called()


@patch("backend.app.services.semantic_scoring.store_bill_embedding")
@patch("backend.app.services.ai_processing.process_bill_ai")
@patch("backend.app.services.semantic_scoring.semantic_prefilter")
class TestProcessBillInsert(unittest.TestCase):

    def _make_matching_client(self):
        return make_mock_client(
            subjects={"subjects": {"policyArea": {"name": "Animals"}, "legislativeSubjects": []}},
            detail={"bill": {
                "title": "Animal Welfare Improvement Act",
                "originChamber": "House",
                "latestAction": {"text": "Referred to committee", "actionDate": "2026-01-02"},
                "summaries": {"count": 0},
                "committees": {},
            }},
            actions={"actions": []},
        )

    def test_ai_score_above_threshold_is_inserted(self, mock_prefilter, mock_process_ai, mock_store_embedding):
        mock_prefilter.return_value = {"score": 0, "embedding": None}

        def fake_process_ai(doc, db):
            doc.relevance_score = 85

        mock_process_ai.side_effect = fake_process_ai

        db = make_mock_db(existing_doc=None)
        client = self._make_matching_client()
        list_bill = {"number": "3", "type": "HR"}  # no latestAction -> is_action_active(None) == True

        result = process_bill(db=db, client=client, list_bill=list_bill, congress=119, active_subject_names=set())

        self.assertEqual(result.outcome, OUTCOME_INSERTED)
        self.assertTrue(result.stored)
        db.add.assert_called()
        db.delete.assert_not_called()

    def test_ai_score_below_threshold_is_deleted(self, mock_prefilter, mock_process_ai, mock_store_embedding):
        mock_prefilter.return_value = {"score": 0, "embedding": None}

        def fake_process_ai(doc, db):
            doc.relevance_score = 10  # below AI_THRESHOLD (40)

        mock_process_ai.side_effect = fake_process_ai

        db = make_mock_db(existing_doc=None)
        client = self._make_matching_client()
        list_bill = {"number": "4", "type": "HR"}

        result = process_bill(db=db, client=client, list_bill=list_bill, congress=119, active_subject_names=set())

        self.assertEqual(result.outcome, OUTCOME_NO_MATCH)
        self.assertFalse(result.stored)
        db.delete.assert_called_once()
        mock_store_embedding.assert_not_called()


if __name__ == "__main__":
    unittest.main()
