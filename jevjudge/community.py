"""Offline, isolated intake of untrusted JevArena contributions.

Validation establishes structural consistency, not authenticity, correctness,
consent, or a right to redistribute third-party material. Import never calls a
provider and never produces the benchmark runner's labeled pair format.
"""
from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from pathlib import Path

from .contracts import SHARED, challenge_fingerprint, model_input, validate_contract

MAX_CONTRIBUTION_BYTES = 128_000
CORPUS_SCHEMA = "jevarena-community-intake/v1"


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON object keys are not accepted")
        result[key] = value
    return result


def _invalid_constant(_value):
    raise ValueError("JSON numbers must be finite")


def load_contribution(path: str | Path) -> dict:
    """Read at most the web share limit; reject ambiguous or non-JSON input."""
    with Path(path).open("rb") as stream:
        raw = stream.read(MAX_CONTRIBUTION_BYTES + 1)
    if len(raw) > MAX_CONTRIBUTION_BYTES:
        raise ValueError("Contribution exceeds the 128 KB limit")
    value = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object,
                       parse_constant=_invalid_constant)
    return validate_contract("CaseContribution", value)


def validation_receipt(value: dict) -> dict:
    checked = validate_contract("CaseContribution", value)
    return {
        "schema": CORPUS_SCHEMA,
        "contributionId": checked["id"],
        "challengeHash": challenge_fingerprint(checked["challenge"]),
        "kind": checked["challenge"]["kind"],
        "language": checked["challenge"]["language"],
        "runCount": len(checked["runs"]),
        "evidenceStatus": "community-submitted",
        "reviewStatus": "unreviewed",
        "recordTrust": "client-reported",
        "submittedEvidenceStatus": checked["status"],
        "referenceLabelStatus": "unreviewed" if "expected" in checked["challenge"] else "missing",
        "votesArePreferencesOnly": True,
        "eligibleForBenchmark": False,
        "modelCalls": 0,
    }


def import_contribution(value: dict, directory: str | Path) -> dict:
    """Create a new intake directory, never overwrite or promote a submission.

    contribution.json can be imported by the web UI for a user-authorized rerun.
    replay.json contains the exact label-free web protocol for both task kinds;
    it is not compatible with the legacy A/B/TIE research runner. A maintainer
    must independently reproduce, review labels/source/license, and explicitly
    prepare a research dataset before any formal scoring or publication.
    """
    receipt = validation_receipt(value)
    contribution = deepcopy(value)
    contribution["status"] = "community-submitted"
    rubric = json.loads((SHARED / "rubric.json").read_text())
    replay = {
        "schema": "jevarena-community-replay/v1",
        "challengeHash": receipt["challengeHash"],
        "promptVersion": rubric["version"],
        "input": model_input(contribution["challenge"]),
        "recordTrust": "client-reported",
        "reviewStatus": "unreviewed",
        "eligibleForBenchmark": False,
        "execution": "Import contribution.json in JevArena, review the task and cost, then run explicitly with your own key.",
        "boundary": "This is the web finite-choice protocol, not a legacy A/B/TIE benchmark row. No model was called during import.",
    }
    artifacts = {"contribution.json": contribution, "replay.json": replay}
    # Preserve compact UTF-8 so a near-limit web export remains importable;
    # escape only lone/surrogate-form Unicode when writing valid JSON bytes.
    encoded = {name: (json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")
               .encode("utf-8", errors="backslashreplace")
               for name, data in artifacts.items()}
    if len(encoded["contribution.json"]) > MAX_CONTRIBUTION_BYTES:
        raise ValueError("Normalized contribution exceeds the web import limit")
    receipt["files"] = {name: {"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)}
                        for name, raw in encoded.items()}
    receipt["reviewRequired"] = ["Reproduce provider results", "Verify reference labels and rationale",
                                 "Review source, consent, and license", "Explicitly prepare a separate research corpus"]
    encoded["manifest.json"] = (json.dumps(receipt, ensure_ascii=True, indent=2, allow_nan=False) + "\n").encode()
    target = Path(directory)
    target.mkdir(parents=True, exist_ok=False)
    for name, raw in encoded.items():
        with (target / name).open("xb") as stream:
            stream.write(raw)
    return receipt
