import sys
import os
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, date, timedelta

# Add parent directory to path so we can import from app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.digest_service import compile_digests
from app.models import UserProfile, LegislativeDocument, BillAction, Subject

class TestDigestPipeline(unittest.TestCase):

    @patch("app.services.digest_service.expand_prompt_to_topics")
    @patch("app.services.digest_service.score_against_prompt")
    def test_compile_digests(self, mock_score, mock_expand):
        # 1. Setup mock expansions and scores
        mock_expand.return_value = {
            "topics": ["animal welfare", "veterinary"],
            "keywords": ["dog", "cat"]
        }
        
        # We will mock the scoring function to return user-specific scores:
        # doc1 (non-watched, matching prompt, score 85 > min 70) -> Should be included
        # doc2 (non-watched, matching prompt, score 60 < min 70) -> Should be filtered out
        # doc3 (watched bill, score 50 < min 70) -> Should be included and pinned because it is a watched bill
        # doc4 (mismatching scope priority_states, score 90) -> Should be filtered out for federal
        
        def mock_score_side_effect(doc, topics, keywords):
            if doc.source_id == "HR-101":
                return 85
            elif doc.source_id == "HR-102":
                return 60
            elif doc.source_id == "HR-103":
                return 50
            elif doc.source_id == "HR-104":
                return 90
            return 0
        
        mock_score.side_effect = mock_score_side_effect

        # 2. Construct mock users
        user_daily = MagicMock(spec=UserProfile)
        user_daily.id = "user-uuid-1"
        user_daily.email = "daily@example.com"
        user_daily.is_verified = True
        user_daily.frequency = "daily"
        user_daily.prompt = "Save the dogs and cats"
        user_daily.scope = "federal"
        user_daily.min_relevance_score = 70
        user_daily.review_bills = ["HR-103"]  # watched review bill

        # 3. Construct mock documents and actions
        # Today's date
        today = date.today()
        
        # Document 1: Matching and score >= 70
        doc1 = MagicMock(spec=LegislativeDocument)
        doc1.id = "doc-uuid-1"
        doc1.source = "congress.gov"
        doc1.source_id = "HR-101"
        doc1.source_url = "https://www.congress.gov/bill/119th-congress/hr-101"
        doc1.title = "Animal Protection Act of 2026"
        doc1.policy_area = "Animals"
        doc1.relevance_score = 85
        doc1.relevance_topics = ["animal welfare"]
        doc1.ai_summary = "A bill protecting animals."
        doc1.last_action_date = today
        doc1.last_action_text = "Referred to committee"
        doc1.subjects = []

        # Document 2: Matching but score < 70
        doc2 = MagicMock(spec=LegislativeDocument)
        doc2.id = "doc-uuid-2"
        doc2.source = "congress.gov"
        doc2.source_id = "HR-102"
        doc2.source_url = None
        doc2.title = "Veterinary Training Act"
        doc2.policy_area = "Education"
        doc2.relevance_score = 60
        doc2.relevance_topics = ["veterinary"]
        doc2.ai_summary = "A bill about vets."
        doc2.last_action_date = today
        doc2.last_action_text = "Passed House"
        doc2.subjects = []

        # Document 3: Watched, score < 70 but should be pinned and included anyway
        doc3 = MagicMock(spec=LegislativeDocument)
        doc3.id = "doc-uuid-3"
        doc3.source = "congress.gov"
        doc3.source_id = "HR-103"
        doc3.source_url = None
        doc3.title = "Watched Animal Rescue Bill"
        doc3.policy_area = "Animals"
        doc3.relevance_score = 50
        doc3.relevance_topics = ["animal welfare"]
        doc3.ai_summary = "A watched bill."
        doc3.last_action_date = today
        doc3.last_action_text = "Referred to subcommittee"
        doc3.subjects = []

        # Document 4: Mismatching scope (user wants priority_states but bill is federal)
        # Note: the test user scope is 'federal' in our first run, so it matches.
        # We will test scope filtering by making a second user with scope 'priority_states'.
        doc4 = MagicMock(spec=LegislativeDocument)
        doc4.id = "doc-uuid-4"
        doc4.source = "congress.gov"
        doc4.source_id = "HR-104"
        doc4.source_url = None
        doc4.title = "Federal Animal Experimentation Act"
        doc4.policy_area = "Animals"
        doc4.relevance_score = 90
        doc4.relevance_topics = ["animal welfare"]
        doc4.ai_summary = "Federal regulations."
        doc4.last_action_date = today
        doc4.last_action_text = "Reported by committee"
        doc4.subjects = []

        # 4. Setup mock DB Session
        mock_db = MagicMock()
        
        # User query mock logic
        mock_query = mock_db.query
        
        # We need mock_query().filter().all() to return the users
        # And mock_query().join().options().filter().distinct().all() to return candidate docs
        mock_query_users_result = MagicMock()
        mock_query_users_result.all.return_value = [user_daily]
        
        mock_query_docs_result = MagicMock()
        mock_query_docs_result.all.return_value = [doc1, doc2, doc3, doc4]
        
        def query_side_effect(model_class):
            if model_class == UserProfile:
                # Mock chain for user query
                mock_filter = MagicMock()
                mock_filter.all.return_value = [user_daily]
                mock_query_builder = MagicMock()
                mock_query_builder.filter.return_value = mock_filter
                return mock_query_builder
            elif model_class == LegislativeDocument:
                # Mock chain for documents query:
                # db.query(LegislativeDocument).join(...).options(...).filter(...).distinct(...).all()
                mock_join = MagicMock()
                mock_options = MagicMock()
                mock_filter = MagicMock()
                mock_distinct = MagicMock()
                
                mock_join.return_value = mock_options
                mock_options.options.return_value = mock_filter
                mock_filter.filter.return_value = mock_distinct
                mock_distinct.distinct.return_value = mock_distinct
                mock_distinct.all.return_value = [doc1, doc2, doc3, doc4]
                
                mock_query_builder = MagicMock()
                mock_query_builder.join = mock_join
                return mock_query_builder
            return MagicMock()

        mock_query.side_effect = query_side_effect

        # 5. Execute compile_digests
        payloads = compile_digests(mock_db, "daily")

        # 6. Assertions
        self.assertEqual(len(payloads), 1)
        payload = payloads[0]
        
        # Recipient
        self.assertEqual(payload["recipient"]["email"], "daily@example.com")
        self.assertEqual(payload["recipient"]["frequency"], "daily")
        
        # Items should contain doc1 and doc3 (pinned), but NOT doc2 (below min score)
        # doc4 matches federal scope so it is included (score 90).
        # Expected items: doc3 (pinned, score 50), then doc4 (score 90), then doc1 (score 85).
        # Wait, the sorting pins watched bills to the top, sorted by score descending inside the pinned items.
        # Non-watched are sorted by score descending below.
        # Pinned: doc3 (score 50)
        # Regular: doc4 (score 90), doc1 (score 85)
        # Total items: 3 (doc3, doc4, doc1)
        items = payload["items"]
        self.assertEqual(len(items), 3)
        
        # First item must be the pinned watched bill HR-103
        self.assertEqual(items[0]["document_id"], "HR-103")
        self.assertTrue(items[0]["is_review_bill"])
        
        # Next items are regular, sorted descending by score: HR-104 (90), then HR-101 (85)
        self.assertEqual(items[1]["document_id"], "HR-104")
        self.assertFalse(items[1]["is_review_bill"])
        self.assertEqual(items[1]["relevance_score"], 90)
        
        self.assertEqual(items[2]["document_id"], "HR-101")
        self.assertFalse(items[2]["is_review_bill"])
        self.assertEqual(items[2]["relevance_score"], 85)

        # 7. Test scope filtering
        # Modify user scope to 'priority_states'
        user_daily.scope = "priority_states"
        payloads_scope = compile_digests(mock_db, "daily")
        self.assertEqual(len(payloads_scope), 0)
        
        # All candidate docs are source='congress.gov' (federal), so for scope='priority_states'
        # they should all be skipped and no payload should be compiled.

if __name__ == "__main__":
    unittest.main()
