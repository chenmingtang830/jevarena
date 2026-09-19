"""Validate portable web cases without trusting community labels or provenance."""
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

_PACKAGE = Path(__file__).resolve().parent
# Editable checkout uses the canonical web-shared files; wheels bundle the same JSON.
SHARED = _PACKAGE.parent / "shared"
if not SHARED.is_dir():
    SHARED = _PACKAGE / "_shared"


def validate_contract(kind: str, value: dict) -> dict:
    schema = json.loads((SHARED / "contracts.schema.json").read_text())
    if kind not in schema["$defs"]:
        raise ValueError("Unknown contract")
    Draft202012Validator(schema["$defs"][kind], format_checker=FormatChecker()).validate(value)
    if kind == "Challenge" and value["kind"] == "judgment":
        ids = [o["id"] for o in value["options"]]
        if len(set(ids)) != len(ids):
            raise ValueError("Duplicate option IDs")
    if kind == "RunRecord":
        probabilities = value.get("probabilities")
        if probabilities is not None and not abs(sum(probabilities.values()) - 1) < 0.001:
            raise ValueError("Probabilities must sum to one")
        if (value["cost"]["usd"] is None) != (value["cost"]["basis"] == "unknown"):
            raise ValueError("Unknown cost must be null")
        if value["status"] == "success" and value["choice"] is None:
            raise ValueError("Success requires a choice")
    if kind == "CaseContribution":
        validate_contract("Challenge", value["challenge"])
        for run in value["runs"]:
            validate_contract("RunRecord", run)
    return value


def model_input(challenge: dict) -> dict:
    c = validate_contract("Challenge", challenge)
    if c["kind"] == "judgment":
        return {key: c[key] for key in ("content", "question", "options")}
    rubric = json.loads((SHARED / "rubric.json").read_text())
    return {
        "content": json.dumps({key: c[key] for key in ("prompt", "answer1", "answer2")}, ensure_ascii=False, separators=(",", ":")),
        "question": rubric["comparison"],
        "options": [
            {"id": "answer1", "label": "Answer 1 is better"},
            {"id": "answer2", "label": "Answer 2 is better"},
            {"id": "tie", "label": "Both answers are equally good"},
        ],
    }
