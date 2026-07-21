from __future__ import annotations
import re
from typing import List, Set, Tuple, Optional, Dict


def _contains_keyword(text: str, keyword: str) -> bool:
    """Whole-word/phrase match, not a raw substring check.

    Plain `keyword in text` false-positives badly on short keywords — e.g.
    "dead" matches inside "deadline", which is extremely common in real
    Congress.gov action text ("extends the deadline for comments"). That
    false match caused is_action_active() to misclassify active bills as
    dead, which deletes them from the database in sync.py.
    """
    return re.search(rf"\b{re.escape(keyword)}\b", text) is not None

# Congress.gov policy areas that automatically qualify a bill for ingestion.
ALDF_POLICY_AREAS: Set[str] = {"Animals", "Agriculture and Food"}

# ALDF focus-area taxonomy applied to Congress.gov legislative subject names.
SUBJECT_CATEGORIES: Dict[str, List[str]] = {
    "Animals Used in Research": [
        "Animal and plant health",
        "Environmental assessment, monitoring, research",
        "Veterinary medicine and animal diseases",
        "Infectious and parasitic diseases",
        "Environmental health",
        "World health",
    ],
    "Farmed Animals": [
        "Livestock",
        "Agricultural practices and innovations",
        "Agricultural research",
        
        "Aquaculture",
        "Meat",
        "Seafood",
        "Food supply, safety, and labeling",
        "Pest management",
    ],
    "Wildlife": [
        "Birds",
        "Fishes",
        "Insects",
        "Mammals",
        "Reptiles",
        "Aquatic ecology",
        "Ecology",
        "Endangered and threatened species",
        "Forests, forestry, trees",
        "Hunting and fishing",
        "Land use and conservation",
        "Lakes and rivers",
        "Marine and coastal resources, fisheries",
        "Marine pollution",
        "Outdoor recreation",
        "Watersheds",
        "Wetlands",
        "Wilderness and natural areas, wildlife refuges, wild rivers, habitats",
        "Wildlife conservation and habitat protection",
    ],
    "Companion & Captive Animals": [
        "Animal protection and human-animal relationships",
        "Crimes against animals and natural resources",
        "Service animals",
    ],
    "Legal & Policy Issues": [
        "Human trafficking",
        "Smuggling and trafficking",
    ],
}

# Reverse lookup built once at import time: subject name → category label.
_SUBJECT_TO_CATEGORY: Dict[str, str] = {
    subject: category
    for category, subjects in SUBJECT_CATEGORIES.items()
    for subject in subjects
}


def get_subject_category(subject_name: str) -> Optional[str]:
    """Return the ALDF category for a subject name, or None if unmapped."""
    return _SUBJECT_TO_CATEGORY.get(subject_name)


def match_bill(
    policy_area: Optional[str],
    legislative_subjects: List[str],
    active_animal_subjects: Set[str]
) -> Tuple[bool, List[str]]:
    """
    Checks if a bill is animal-related.
    
    A bill matches if:
    1. policy_area == "Animals"
    OR
    2. Any subject name in legislative_subjects matches an active record in active_animal_subjects.
    
    Returns a tuple of (is_matched, matching_subjects).
    """
    matching_subjects = []
    is_matched = False

    # Rule 1: Policy area is one of the ALDF-tracked areas (Animals, Agriculture and Food).
    if policy_area in ALDF_POLICY_AREAS:
        is_matched = True

    # Rule-2: At least one legislative subject matches our active list
    for subject in legislative_subjects:
        if subject in active_animal_subjects:
            matching_subjects.append(subject)
            is_matched = True

    return is_matched, matching_subjects


# Bills matching these ended without becoming law — these are the only ones
# that should be dropped from tracking. Notably excludes "became public law" /
# "became private law" / "public law no": that's a bill's successful, final
# outcome, so it should be kept and shown as "Became Law", not deleted like a
# dead bill.
DEAD_KEYWORDS = [
    "vetoed",
    "veto",
    "failed",
    "rejected",
    "tabled",
    "indefinitely postponed",
    "withdrawn",
    "dead",
    "died",
]


def is_action_active(action_text: Optional[str]) -> bool:
    """
    Checks if a bill's latest action indicates it should still be tracked.

    A bill is INACTIVE (and dropped) only if it ended without becoming law:
    - Vetoed (e.g. "vetoed", "veto")
    - Failed (e.g. "failed", "rejected", "tabled", "indefinitely postponed")
    - Withdrawn (e.g. "withdrawn")
    - Dead (e.g. "dead", "died")

    Bills that became law are NOT inactive here — get_current_stage() below
    maps that text to the "Became Law" stage instead — since that's the
    successful, final outcome we want to keep and surface, not discard like
    a bill that died in committee.

    Otherwise (including "became law"), it is considered ACTIVE.
    """
    if not action_text:
        return True  # If no action recorded, assume active (e.g. newly introduced)

    text_lower = action_text.lower()

    for kw in DEAD_KEYWORDS:
        if _contains_keyword(text_lower, kw):
            return False

    return True


def get_current_stage(last_action_text: Optional[str]) -> str:
    """
    Derives the progress stage of a bill based on its last action text.
    
    Stages:
    - Became Law
    - Vetoed
    - Failed/Dead
    - Presented to President
    - Resolving Differences
    - Passed Chamber
    - Committee Action
    - Referred to Committee
    - Introduced
    """
    if not last_action_text:
        return "Introduced"
    text_lower = last_action_text.lower()
    
    # Inactive/terminal states
    if any(_contains_keyword(text_lower, kw) for kw in ["became public law", "became private law", "public law no", "signed by president"]):
        return "Became Law"
    if any(_contains_keyword(text_lower, kw) for kw in ["vetoed", "veto"]):
        return "Vetoed"
    if any(_contains_keyword(text_lower, kw) for kw in ["failed", "rejected", "tabled", "indefinitely postponed", "withdrawn", "dead", "died"]):
        return "Failed/Dead"

    # Active states
    if _contains_keyword(text_lower, "presented to president"):
        return "Presented to President"
    if _contains_keyword(text_lower, "conference") or _contains_keyword(text_lower, "resolving differences"):
        return "Resolving Differences"
    if _contains_keyword(text_lower, "passed") or _contains_keyword(text_lower, "agreed to"):
        return "Passed Chamber"
    if any(_contains_keyword(text_lower, kw) for kw in ["reported by", "reported from", "committee consideration", "ordered to be reported", "hearings held"]):
        return "Committee Action"
    if _contains_keyword(text_lower, "referred to") or _contains_keyword(text_lower, "read twice"):
        return "Referred to Committee"
        
    return "Introduced"


