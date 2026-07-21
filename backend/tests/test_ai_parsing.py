import os
import sys

# Ensure the backend package is importable when tests run from the repo root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.ai_processing import _parse_llm_json


def test_parse_valid_json():
    content = '{"relevance_score": 50, "relevance_topics": ["Animal welfare"], "relevance_rationale": "ok", "ai_summary":"summary"}'
    parsed = _parse_llm_json(content)
    assert isinstance(parsed, dict)
    assert parsed["relevance_score"] == 50


def test_parse_malformed_control_chars():
    # Simulate an LLM returning a JSON string where a value contains an unescaped newline
    content = '{\n  "relevance_score": 50,\n  "relevance_topics": ["Animal welfare"],\n  "relevance_rationale": "line1\nline2",\n  "ai_summary":"summary"\n}'
    parsed = _parse_llm_json(content)
    assert "line1" in parsed["relevance_rationale"]
    # After parsing the sanitized JSON the newline should be present in the Python string
    assert "\n" in parsed["relevance_rationale"]


def test_parse_with_surrounding_prose_and_fences():
    content = (
        'Note: see below\n```json\n{\n  "relevance_score": 30,\n  "relevance_topics": ["Wildlife conservation"],\n  "relevance_rationale": "short rationale",\n  "ai_summary": "short summary"\n}\n```\nThanks.'
    )
    parsed = _parse_llm_json(content)
    assert parsed["relevance_score"] == 30
    assert parsed["relevance_topics"] == ["Wildlife conservation"]


def test_expand_prompt_to_topics_success():
    from unittest.mock import patch, MagicMock
    from app.services.ai_processing import expand_prompt_to_topics

    mock_response_content = {
        "choices": [{
            "message": {
                "content": '{"topics": ["Wildlife conservation"], "keywords": ["smuggling"], "inferred_filters": {"subject": "Wildlife conservation", "origin_chamber": "Senate", "bill_type": "S", "date_from": "2026-01-01", "date_to": null, "state": "CA"}}'
            }
        }]
    }
    
    # Mock httpx.Client.post
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = mock_response_content
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.Client.post", return_value=mock_response):
        result = expand_prompt_to_topics("Senate wildlife conservation bills in CA after January")
        
    assert result["topics"] == ["Wildlife conservation"]
    assert result["keywords"] == ["smuggling"]
    assert result["inferred_filters"]["subject"] == "Wildlife conservation"
    assert result["inferred_filters"]["origin_chamber"] == "Senate"
    assert result["inferred_filters"]["bill_type"] == "S"
    assert result["inferred_filters"]["date_from"] == "2026-01-01"
    assert result["inferred_filters"]["date_to"] is None
    assert result["inferred_filters"]["state"] == "CA"


def test_expand_prompt_to_topics_failure_fallback():
    from unittest.mock import patch
    from app.services.ai_processing import expand_prompt_to_topics

    # Mock httpx.Client.post raising an exception
    with patch("httpx.Client.post", side_effect=Exception("API Error")):
        result = expand_prompt_to_topics("Senate wildlife conservation")
        
    assert result["topics"] == []
    assert "senate" in result["keywords"]
    assert result["inferred_filters"]["subject"] is None
    assert result["inferred_filters"]["origin_chamber"] is None
