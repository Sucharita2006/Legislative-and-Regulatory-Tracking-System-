"""
test_congress_api.py

Phase B of issue #8 (missing test coverage): CongressAPIClient's request/retry
logic and the action-dedup logic in fetch_bill_actions. Uses httpx.MockTransport
so no real network calls happen; time.sleep is patched to a no-op so retry
tests run instantly instead of actually backing off.
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest.mock import patch
from pathlib import Path

import httpx

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("CONGRESS_API_KEY", "test_dummy")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("OPENROUTER_API_KEY", "test_dummy")

from backend.app.services.congress_api import CongressAPIClient, CongressAPIError


def _client_with_transport(handler) -> CongressAPIClient:
    """Build a CongressAPIClient whose internal httpx.Client is wired to a
    MockTransport instead of doing real network I/O. api_key is forced to a
    known test value so assertions don't depend on whatever real
    CONGRESS_API_KEY happens to be set in the host environment/.env."""
    client = CongressAPIClient()
    client.api_key = "test-api-key"
    client.client = httpx.Client(
        transport=httpx.MockTransport(handler),
        headers={"User-Agent": "AnimalLegislationTracker/1.0"},
    )
    return client


class TestFetchBills(unittest.TestCase):

    def test_successful_request_builds_correct_params(self):
        seen_requests = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen_requests.append(request)
            return httpx.Response(200, json={"bills": [{"number": "1"}]})

        client = _client_with_transport(handler)
        result = client.fetch_bills(119, offset=10, limit=50, from_date_time="2026-01-01T00:00:00Z")

        self.assertEqual(result, {"bills": [{"number": "1"}]})
        self.assertEqual(len(seen_requests), 1)
        req = seen_requests[0]
        self.assertTrue(str(req.url).startswith("https://api.congress.gov/v3/bill/119"))
        query = dict(httpx.QueryParams(req.url.query))
        self.assertEqual(query["offset"], "10")
        self.assertEqual(query["limit"], "50")
        self.assertEqual(query["fromDateTime"], "2026-01-01T00:00:00Z")
        self.assertEqual(query["format"], "json")
        self.assertEqual(query["api_key"], "test-api-key")
        # toDateTime was not passed, so it should be absent, not "None".
        self.assertNotIn("toDateTime", query)
        client.close()


class TestRetryBehavior(unittest.TestCase):

    def setUp(self):
        patcher = patch("backend.app.services.congress_api.time.sleep")
        self.mock_sleep = patcher.start()
        self.addCleanup(patcher.stop)

    def test_retries_on_429_then_succeeds(self):
        responses = [httpx.Response(429), httpx.Response(429), httpx.Response(200, json={"ok": True})]

        def handler(request: httpx.Request) -> httpx.Response:
            return responses.pop(0)

        client = _client_with_transport(handler)
        result = client.fetch_bills(119)

        self.assertEqual(result, {"ok": True})
        self.assertEqual(self.mock_sleep.call_count, 2)
        client.close()

    def test_retries_on_500_then_succeeds(self):
        responses = [httpx.Response(500), httpx.Response(200, json={"ok": True})]

        def handler(request: httpx.Request) -> httpx.Response:
            return responses.pop(0)

        client = _client_with_transport(handler)
        result = client.fetch_bills(119)

        self.assertEqual(result, {"ok": True})
        self.assertEqual(self.mock_sleep.call_count, 1)
        client.close()

    def test_exhausts_retries_and_raises_on_persistent_429(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(429)

        client = _client_with_transport(handler)
        with self.assertRaises(CongressAPIError):
            client.fetch_bills(119)
        # 4 total attempts, sleeps only happen before a retry (not after the last attempt).
        self.assertEqual(self.mock_sleep.call_count, 3)
        client.close()

    def test_non_retryable_4xx_raises_immediately_without_sleeping(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404)

        client = _client_with_transport(handler)
        with self.assertRaises(CongressAPIError):
            client.fetch_bills(119)
        self.mock_sleep.assert_not_called()
        client.close()

    def test_error_message_never_contains_the_api_key(self):
        """The whole point of CongressAPIError: httpx's own exception message
        includes the full request URL (and therefore api_key) — assert the
        sanitized message that actually escapes this module never does."""
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404)

        client = _client_with_transport(handler)
        with self.assertRaises(CongressAPIError) as ctx:
            client.fetch_bills(119)
        self.assertNotIn("test-api-key", str(ctx.exception))
        self.assertNotIn("api_key", str(ctx.exception))
        client.close()

    def test_connection_error_message_never_contains_the_api_key(self):
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("boom", request=request)

        client = _client_with_transport(handler)
        with self.assertRaises(CongressAPIError) as ctx:
            client.fetch_bills(119)
        self.assertNotIn("test-api-key", str(ctx.exception))
        client.close()

    def test_retries_on_connection_error_then_succeeds(self):
        state = {"calls": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            state["calls"] += 1
            if state["calls"] == 1:
                raise httpx.ConnectError("boom", request=request)
            return httpx.Response(200, json={"ok": True})

        client = _client_with_transport(handler)
        result = client.fetch_bills(119)

        self.assertEqual(result, {"ok": True})
        self.assertEqual(self.mock_sleep.call_count, 1)
        client.close()


class TestFetchBillActionsDedup(unittest.TestCase):

    def test_deduplicates_same_date_and_text_across_source_systems(self):
        actions_payload = {
            "actions": [
                {"actionDate": "2026-01-01", "text": "Introduced", "sourceSystem": {"name": "House"}},
                {"actionDate": "2026-01-01", "text": "Introduced", "sourceSystem": {"name": "Senate"}},
                {"actionDate": "2026-01-02", "text": "Referred to committee", "sourceSystem": {"name": "House"}},
            ]
        }

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=actions_payload)

        client = _client_with_transport(handler)
        result = client.fetch_bill_actions(119, "HR", "1")

        self.assertEqual(len(result["actions"]), 2)
        self.assertEqual(result["actions"][0]["text"], "Introduced")
        self.assertEqual(result["actions"][1]["text"], "Referred to committee")
        client.close()

    def test_path_lowercases_bill_type(self):
        seen_requests = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen_requests.append(request)
            return httpx.Response(200, json={"actions": []})

        client = _client_with_transport(handler)
        client.fetch_bill_actions(119, "HR", "1234")

        self.assertIn("/bill/119/hr/1234/actions", str(seen_requests[0].url))
        client.close()


if __name__ == "__main__":
    unittest.main()
