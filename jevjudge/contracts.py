"""Validate portable web cases without trusting community labels or provenance."""
import hashlib
import json
import math
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

_PACKAGE = Path(__file__).resolve().parent
# Editable checkout uses the canonical web-shared files; wheels bundle the same JSON.
SHARED = _PACKAGE.parent / "shared"
if not SHARED.is_dir():
    SHARED = _PACKAGE / "_shared"


def validate_contract(kind: str, value: dict) -> dict:
    _reject_nonfinite(value)
    schema = json.loads((SHARED / "contracts.schema.json").read_text())
    if kind not in schema["$defs"]:
        raise ValueError("Unknown contract")
    Draft202012Validator(schema["$defs"][kind], format_checker=FormatChecker()).validate(value)
    if kind == "Challenge":
        ids = option_ids(value)
        if len(set(ids)) != len(ids):
            raise ValueError("Duplicate option IDs")
        if "expected" in value and value["expected"] not in ids:
            raise ValueError("Expected answer must name an option")
    if kind == "RunRecord":
        probabilities = value.get("probabilities")
        if probabilities is not None and not abs(sum(probabilities.values()) - 1) < 0.001:
            raise ValueError("Probabilities must sum to one")
        if (value["cost"]["usd"] is None) != (value["cost"]["basis"] == "unknown"):
            raise ValueError("Unknown cost must be null")
        if value["status"] == "success" and value["choice"] is None:
            raise ValueError("Success requires a choice")
        if value["status"] != "success" and (value["choice"] is not None
                                               or "probabilities" in value or "confidence" in value):
            raise ValueError("Incomplete runs cannot contain judgments or probabilities")
    if kind == "CaseContribution":
        challenge = validate_contract("Challenge", value["challenge"])
        ids = set(option_ids(challenge))
        if "humanAnswer" in value and value["humanAnswer"]["optionId"] not in ids:
            raise ValueError("Human answer must name a challenge option")
        for source in value.get("sourceAttributions", []):
            if not source["url"].startswith("https://"):
                raise ValueError("HTTPS source required")
        fingerprint = challenge_fingerprint(challenge)
        run_ids = set()
        for run in value["runs"]:
            validate_contract("RunRecord", run)
            if run["id"] in run_ids:
                raise ValueError("Duplicate run IDs")
            run_ids.add(run["id"])
            if run["challengeId"] != challenge["id"] or run["challengeHash"] != fingerprint:
                raise ValueError("Run does not match the challenge or its fingerprint")
            if run["choice"] is not None and run["choice"] not in ids:
                raise ValueError("Run choice must name a challenge option")
            if "probabilities" in run and set(run["probabilities"]) != ids:
                raise ValueError("Probability keys must exactly match challenge options")
        if "vote" in value:
            validate_contract("Vote", value["vote"])
            if not set(value["vote"]["runIds"]).issubset(run_ids):
                raise ValueError("Vote references a missing run")
            successful_ids = {run["id"] for run in value["runs"] if run["status"] == "success"}
            if not set(value["vote"]["runIds"]).issubset(successful_ids):
                raise ValueError("Votes require two completed judgments")
    if kind == "Vote" and len(set(value["runIds"])) != 2:
        raise ValueError("A vote must reference two distinct runs")
    return value


def _reject_nonfinite(value):
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("JSON numbers must be finite")
    if isinstance(value, dict):
        for child in value.values():
            _reject_nonfinite(child)
    elif isinstance(value, list):
        for child in value:
            _reject_nonfinite(child)


def option_ids(challenge: dict) -> list[str]:
    return ([o["id"] for o in challenge["options"]] if challenge["kind"] == "judgment"
            else ["answer1", "answer2", "tie"])


def _js_json(value) -> str:
    """JSON.stringify for the ordered, string-only model-input data structure.

    JS emits paired UTF-16 surrogates as their code point and escapes lone
    surrogates. Python's JSON parser can retain either form, so normalize both.
    This is deliberately not a general-purpose numeric JSON canonicalizer.
    """
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    output = []
    index = 0
    while index < len(encoded):
        code = ord(encoded[index])
        if (0xD800 <= code <= 0xDBFF and index + 1 < len(encoded)
                and 0xDC00 <= ord(encoded[index + 1]) <= 0xDFFF):
            output.append(chr(0x10000 + ((code - 0xD800) << 10) + ord(encoded[index + 1]) - 0xDC00))
            index += 2
            continue
        output.append(f"\\u{code:04x}" if 0xD800 <= code <= 0xDFFF else encoded[index])
        index += 1
    return "".join(output)


def model_input(challenge: dict) -> dict:
    c = validate_contract("Challenge", challenge)
    if c["kind"] == "judgment":
        # Zod's strictObject reconstructs option properties in schema order.
        return {"content": c["content"], "question": c["question"],
                "options": [{"id": o["id"], "label": o["label"]} for o in c["options"]]}
    rubric = json.loads((SHARED / "rubric.json").read_text())
    return {
        "content": _js_json({key: c[key] for key in ("prompt", "answer1", "answer2")}),
        "question": rubric["comparison"],
        "options": [
            {"id": "answer1", "label": "Answer 1 is better"},
            {"id": "answer2", "label": "Answer 2 is better"},
            {"id": "tie", "label": "Both answers are equally good"},
        ],
    }


def challenge_fingerprint(challenge: dict) -> str:
    """Match web challengeFingerprint: SHA-256(JSON.stringify(modelInput))."""
    return hashlib.sha256(_js_json(model_input(challenge)).encode("utf-8")).hexdigest()
