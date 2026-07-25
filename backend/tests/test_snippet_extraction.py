import os
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("CONGRESS_API_KEY", "test_dummy")
os.environ.setdefault("DATABASE_URL", "postgresql://test_dummy")
os.environ.setdefault("OPENROUTER_API_KEY", "test_dummy")

from types import SimpleNamespace
from backend.app.services.digest_service import _extract_matching_snippet


def test_snippet_extraction_matching_keyword():
    doc = SimpleNamespace(
        title="Aquatic Invasive Species Control Act",
        ai_summary="This bill addresses federal funding. It establishes federal frameworks for managing and preventing invasive species in U.S. waterways. It also mandates reporting.",
    )
    prompt = SimpleNamespace(
        expanded_topics={"topics": ["invasive species"], "keywords": ["waterways"]},
        prompt_text="Invasive species in waterways",
    )
    snippet = _extract_matching_snippet(doc, prompt)
    assert snippet == '"It establishes federal frameworks for managing and preventing invasive species in U.S. waterways."'


def test_snippet_extraction_fallback_first_sentence():
    doc = SimpleNamespace(
        title="General Agriculture Act",
        ai_summary="Provides subsidy programs for state corn farmers. Ensures food security standards nationwide.",
    )
    prompt = SimpleNamespace(
        expanded_topics={"topics": ["wildlife"], "keywords": ["animal protection"]},
        prompt_text="wildlife protection",
    )
    snippet = _extract_matching_snippet(doc, prompt)
    assert snippet == '"Provides subsidy programs for state corn farmers."'


def test_snippet_extraction_missing_summary_uses_title():
    doc = SimpleNamespace(
        title="Emergency Waterway Conservation Act",
        ai_summary="(no AI summary available)",
    )
    prompt = SimpleNamespace(
        expanded_topics={},
        prompt_text="waterway conservation",
    )
    snippet = _extract_matching_snippet(doc, prompt)
    assert snippet == '"Emergency Waterway Conservation Act"'


def test_snippet_extraction_truncates_long_sentence():
    long_sentence = "A " * 120 + "is a very long sentence that exceeds the standard single line visual length requirement for email card rationale displays."
    doc = SimpleNamespace(
        title="Long Sentence Act",
        ai_summary=f"{long_sentence} Second sentence follows.",
    )
    prompt = SimpleNamespace(expanded_topics={}, prompt_text="")
    snippet = _extract_matching_snippet(doc, prompt)
    assert len(snippet) <= 183
    assert snippet.endswith('..."')
