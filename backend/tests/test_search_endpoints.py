"""
test_search_endpoints.py

Phase D of issue #8 (missing test coverage): GET /documents/search and
POST /search/live. Uses FastAPI's TestClient with a MagicMock db (query
chain configured to route through a single reusable mock so
.options()/.filter()/.join()/.distinct()/.order_by()/.offset()/.limit()/.all()/
.count()/.first() all work regardless of call order). Caching and the
AI-expansion/scoring calls are patched out for determinism and to avoid
real network calls.
"""
from __future__ import annotations

import os
import sys
import uuid
import unittest
from datetime import datetime, date
from unittest.mock import MagicMock, patch
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("CONGRESS_API_KEY", "test_dummy")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("OPENROUTER_API_KEY", "test_dummy")

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_db
from backend.app.models import LegislativeDocument


def make_doc(source_id, title="Test Bill", congress=119, bill_type="HR", bill_number="1",
             policy_area="Animals", last_action_text="Referred to committee",
             relevance_score=75, embedding=None):
    return LegislativeDocument(
        id=uuid.uuid4(),
        source_id=source_id,
        source_url=f"https://congress.gov/{source_id}",
        congress=congress,
        bill_type=bill_type,
        bill_number=bill_number,
        title=title,
        introduced_date=date(2026, 1, 1),
        origin_chamber="House",
        policy_area=policy_area,
        last_action_date=date(2026, 1, 2),
        last_action_text=last_action_text,
        update_date=datetime(2026, 1, 2),
        update_date_incl_text=datetime(2026, 1, 2),
        source_hash="hash",
        api_raw={"sponsor": {"fullName": "Rep. Test", "party": "D", "state": "CA"}},
        ingested_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
        relevance_score=relevance_score,
        relevance_topics=["Farmed Animals"],
        ai_summary="Summary text.",
        embedding=embedding,
    )


def make_query_mock(docs, total=None):
    """A single MagicMock that supports the whole SQLAlchemy query builder
    chain used by the search endpoints, regardless of call order."""
    q = MagicMock()
    for method in ("options", "filter", "join", "distinct", "order_by", "offset", "limit"):
        getattr(q, method).return_value = q
    q.all.return_value = docs
    q.count.return_value = total if total is not None else len(docs)
    q.first.return_value = docs[0] if docs else None
    return q


class BaseSearchTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        cache_patcher = patch("backend.app.services.cache.get_cache", return_value=None)
        set_cache_patcher = patch("backend.app.services.cache.set_cache")
        self.mock_get_cache = cache_patcher.start()
        self.mock_set_cache = set_cache_patcher.start()
        self.addCleanup(cache_patcher.stop)
        self.addCleanup(set_cache_patcher.stop)

    def tearDown(self):
        app.dependency_overrides.clear()


class TestDocumentsSearch(BaseSearchTest):

    def test_invalid_sort_by_returns_400(self):
        response = self.client.get("/documents/search?sort_by=not_a_real_field")
        self.assertEqual(response.status_code, 400)

    def test_basic_query_returns_paginated_shape(self):
        doc = make_doc("119-HR-1")
        mock_db = MagicMock()
        mock_db.query.return_value = make_query_mock([doc], total=1)
        app.dependency_overrides[get_db] = lambda: mock_db

        response = self.client.get("/documents/search?keyword=welfare")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total"], 1)
        self.assertEqual(len(body["results"]), 1)
        result = body["results"][0]
        self.assertEqual(result["source_id"], "119-HR-1")
        self.assertEqual(result["sponsor_name"], "Rep. Test")
        self.assertEqual(result["prompt_score"], 75)

    def test_bill_number_shortcut_bypasses_pagination(self):
        doc = make_doc("119-HR-42")
        mock_db = MagicMock()
        mock_db.query.return_value = make_query_mock([doc])
        app.dependency_overrides[get_db] = lambda: mock_db

        response = self.client.get("/documents/search?keyword=119-HR-42")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total"], 1)
        self.assertEqual(body["results"][0]["source_id"], "119-HR-42")
        # Bill with no relevance_score defaults prompt_score to 100 in this
        # path — here relevance_score=75 is set, so it should carry through.
        self.assertEqual(body["results"][0]["prompt_score"], 75)


@patch("backend.app.services.semantic_scoring.vector_search")
class TestSearchLive(BaseSearchTest):

    def test_missing_prompt_returns_400(self, mock_vector_search):
        response = self.client.post("/search/live", json={"prompt": ""})
        self.assertEqual(response.status_code, 400)
        mock_vector_search.assert_not_called()

    def test_bill_number_shortcut_bypasses_vector_search(self, mock_vector_search):
        doc = make_doc("119-HR-42")
        mock_db = MagicMock()
        mock_db.query.return_value = make_query_mock([doc])
        app.dependency_overrides[get_db] = lambda: mock_db

        response = self.client.post("/search/live", json={"prompt": "119-HR-42"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["search_mode"], "bill_number")
        self.assertEqual(body["results"][0]["source_id"], "119-HR-42")
        mock_vector_search.assert_not_called()

    def test_vector_search_hits_are_returned_sorted_by_score(self, mock_vector_search):
        doc_low = make_doc("119-HR-1", relevance_score=50)
        doc_high = make_doc("119-HR-2", relevance_score=60)
        mock_vector_search.return_value = [
            {"doc": doc_low, "prompt_score": 40},
            {"doc": doc_high, "prompt_score": 90},
        ]
        mock_db = MagicMock()
        app.dependency_overrides[get_db] = lambda: mock_db

        # /search/live locally re-imports expand_prompt_to_topics/score_against_prompt
        # from services.ai_processing, shadowing main's module-level names — patch
        # the source module, not backend.app.main.
        with patch("backend.app.services.ai_processing.expand_prompt_to_topics", return_value={"topics": [], "keywords": [], "inferred_filters": {}}):
            response = self.client.post("/search/live", json={"prompt": "protect farm animals"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["results"]), 2)
        # Higher prompt_score should be sorted first.
        self.assertEqual(body["results"][0]["source_id"], "119-HR-2")
        self.assertEqual(body["results"][0]["prompt_score"], 90)

    def test_empty_vector_search_falls_back_to_keyword_scoring(self, mock_vector_search):
        mock_vector_search.return_value = []
        doc = make_doc("119-HR-3", title="Farm Animal Protection Act")
        mock_db = MagicMock()
        mock_db.query.return_value = make_query_mock([doc])
        app.dependency_overrides[get_db] = lambda: mock_db

        with patch("backend.app.services.ai_processing.expand_prompt_to_topics", return_value={"topics": ["Farmed Animals"], "keywords": ["farm"], "inferred_filters": {}}), \
             patch("backend.app.services.ai_processing.score_against_prompt", return_value=77):
            response = self.client.post("/search/live", json={"prompt": "farm animal welfare"})

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["results"]), 1)
        self.assertEqual(body["results"][0]["source_id"], "119-HR-3")
        self.assertEqual(body["results"][0]["prompt_score"], 77)


if __name__ == "__main__":
    unittest.main()
