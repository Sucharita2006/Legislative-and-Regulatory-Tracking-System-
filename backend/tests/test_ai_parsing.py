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
