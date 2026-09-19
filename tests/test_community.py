from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
from io import StringIO
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from jevjudge.cli import main
from jevjudge.community import MAX_CONTRIBUTION_BYTES, import_contribution, load_contribution, validation_receipt
from jevjudge.contracts import challenge_fingerprint, model_input, validate_contract


def contribution(kind="judgment"):
    challenge = {"schemaVersion": 1, "id": "question", "title": "Public example", "language": "en",
                 "kind": kind, "basis": "UNREVIEWED_REFERENCE", "source": "Contributor original"}
    if kind == "judgment":
        challenge.update(content="All blue balls are round. This ball is blue.", question="Is this ball round?",
                         options=[{"id": "yes", "label": "Yes"}, {"id": "no", "label": "No"}], expected="yes")
        probabilities = {"yes": 0.8, "no": 0.2}
    else:
        challenge.update(prompt="What is 2 + 2?", answer1="Four", answer2="4", expected="tie")
        probabilities = {"answer1": 0.1, "answer2": 0.1, "tie": 0.8}
    run = {"schemaVersion": 1, "id": "run-x", "challengeId": challenge["id"],
           "challengeHash": challenge_fingerprint(challenge), "provider": "openrouter", "model": "typesafe/jev-1.13",
           "resolvedModel": None, "promptVersion": "test-version", "createdAt": "2026-09-19T12:00:00Z",
           "choice": challenge["expected"], "probabilities": probabilities,
           "usage": {"inputTokens": 100, "outputTokens": 3}, "cost": {"usd": None, "basis": "unknown"},
           "latencyMs": 10, "status": "success"}
    return {"schemaVersion": 1, "id": "submission", "challenge": challenge,
            "runs": [run, {**deepcopy(run), "id": "run-y", "model": "some/comparison-model"}],
            "vote": {"runIds": ["run-x", "run-y"], "value": "both", "revealedBeforeVote": False},
            "license": "CC-BY-4.0", "status": "reviewed", "notes": "Test fixture, not real model evidence."}


class CommunityTests(unittest.TestCase):
    def test_both_task_kinds_validate_without_trusting_status(self):
        for kind in ("judgment", "comparison"):
            with self.subTest(kind=kind):
                value = contribution(kind)
                receipt = validation_receipt(value)
                self.assertEqual(receipt["kind"], kind)
                self.assertEqual(receipt["evidenceStatus"], "community-submitted")
                self.assertEqual(receipt["submittedEvidenceStatus"], "reviewed")
                self.assertEqual(receipt["reviewStatus"], "unreviewed")
                self.assertFalse(receipt["eligibleForBenchmark"])
                self.assertTrue(receipt["votesArePreferencesOnly"])
                self.assertEqual(value["status"], "reviewed")

    def test_bad_run_associations_rejected(self):
        changes = [
            {"challengeId": "different"}, {"challengeHash": "0" * 64}, {"choice": "not-an-option"},
            {"probabilities": {"yes": 1}}, {"probabilities": {"yes": 0.8, "no": 0.1, "invented": 0.1}},
            {"probabilities": {"yes": 0.9, "no": 0.9}},
        ]
        for change in changes:
            with self.subTest(change=change):
                value = contribution()
                value["runs"][0].update(change)
                with self.assertRaises(ValueError):
                    validate_contract("CaseContribution", value)

    def test_duplicate_and_missing_vote_run_ids_rejected(self):
        for ids in (["run-x", "run-x"], ["run-x", "not-found"]):
            value = contribution()
            value["vote"]["runIds"] = ids
            with self.assertRaises(ValueError):
                validate_contract("CaseContribution", value)
        value = contribution()
        value["runs"][1]["id"] = "run-x"
        with self.assertRaisesRegex(ValueError, "Duplicate run"):
            validate_contract("CaseContribution", value)

    def test_empty_cases_and_incomplete_runs_remain_unreviewed(self):
        value = contribution()
        value.pop("vote")
        value["runs"] = []
        value["challenge"].pop("expected")
        self.assertEqual(validation_receipt(value)["referenceLabelStatus"], "missing")
        value = contribution()
        value.pop("vote")
        value["runs"][1].update(status="error", choice=None, error="Provider did not complete")
        value["runs"][1].pop("probabilities")
        self.assertEqual(validation_receipt(value)["runCount"], 2)

    def test_incomplete_runs_cannot_preserve_judgments_or_receive_votes(self):
        for extra in ({"choice": "yes"}, {"probabilities": {"yes": 1, "no": 0}}, {"confidence": 0.9}):
            value = contribution()
            value.pop("vote")
            run = value["runs"][0]
            run.update(status="error", choice=None)
            run.pop("probabilities")
            run.update(extra)
            with self.subTest(extra=extra), self.assertRaisesRegex(ValueError, "Incomplete"):
                validate_contract("CaseContribution", value)
        value = contribution()
        value["runs"][1].update(status="error", choice=None)
        value["runs"][1].pop("probabilities")
        with self.assertRaisesRegex(ValueError, "completed"):
            validate_contract("CaseContribution", value)

    def test_changed_content_and_option_order_invalidate_hash(self):
        for mutation in (lambda c: c.update(content="Different content"),
                         lambda c: c["options"].reverse()):
            value = contribution()
            mutation(value["challenge"])
            with self.assertRaisesRegex(ValueError, "fingerprint"):
                validate_contract("CaseContribution", value)

    def test_import_isolated_replay_and_no_overwrite(self):
        for kind in ("judgment", "comparison"):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as tmp:
                value = contribution(kind)
                target = Path(tmp) / "intake"
                receipt = import_contribution(value, target)
                stored = load_contribution(target / "contribution.json")
                replay = json.loads((target / "replay.json").read_text())
                self.assertEqual(stored["status"], "community-submitted")
                self.assertEqual(stored["challenge"], value["challenge"])
                self.assertEqual(stored["runs"], value["runs"])
                self.assertEqual(replay["input"], model_input(value["challenge"]))
                self.assertNotIn("UNREVIEWED_REFERENCE", json.dumps(replay))
                self.assertNotIn("expected", replay["input"])
                self.assertNotIn("gold", replay)
                self.assertFalse(replay["eligibleForBenchmark"])
                self.assertEqual(receipt, json.loads((target / "manifest.json").read_text()))
                for filename, meta in receipt["files"].items():
                    raw = (target / filename).read_bytes()
                    self.assertEqual(hashlib.sha256(raw).hexdigest(), meta["sha256"])
                original = (target / "manifest.json").read_bytes()
                with self.assertRaises(FileExistsError):
                    import_contribution(value, target)
                self.assertEqual((target / "manifest.json").read_bytes(), original)

    def test_bounded_strict_json_loading(self):
        bad_inputs = [b"{", b'{"schemaVersion":1,"schemaVersion":1}', b'{"score":NaN}',
                      b'{"score":Infinity}', b"\xff", b" " * (MAX_CONTRIBUTION_BYTES + 1)]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "case.json"
            for raw in bad_inputs:
                with self.subTest(raw=raw[:40]):
                    path.write_bytes(raw)
                    with self.assertRaises(ValueError):
                        load_contribution(path)

    def test_unicode_case_stays_web_importable(self):
        value = contribution()
        value["challenge"]["content"] = "界" * 38_000
        for run in value["runs"]:
            run["challengeHash"] = challenge_fingerprint(value["challenge"])
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "intake"
            import_contribution(value, target)
            self.assertLess((target / "contribution.json").stat().st_size, MAX_CONTRIBUTION_BYTES)
            self.assertEqual(load_contribution(target / "contribution.json")["challenge"], value["challenge"])

    def test_cli_validate_import_and_research_boundary(self):
        with tempfile.TemporaryDirectory() as tmp:
            path, out = Path(tmp) / "case.json", Path(tmp) / "intake"
            path.write_text(json.dumps(contribution()))
            for command in (["community", "validate", str(path)],
                            ["community", "import", str(path), "--out", str(out)]):
                output = StringIO()
                with patch("sys.argv", ["jevjudge", *command]), redirect_stdout(output):
                    main()
                self.assertEqual(json.loads(output.getvalue())["modelCalls"], 0)
            error = StringIO()
            with patch("sys.argv", ["jevjudge", "plan", "--data", str(out / "contribution.json"),
                                    "--config", "not-read.json"]), redirect_stderr(error), self.assertRaises(SystemExit):
                main()
            self.assertIn("Community intake is unreviewed", error.getvalue())

    def test_cli_does_not_echo_rejected_private_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "case.json"
            value = contribution()
            value["apiKey"] = "DO_NOT_PRINT_THIS_SECRET"
            path.write_text(json.dumps(value))
            output = StringIO()
            with patch("sys.argv", ["jevjudge", "community", "validate", str(path)]), redirect_stderr(output), self.assertRaises(SystemExit):
                main()
            self.assertNotIn("DO_NOT_PRINT_THIS_SECRET", output.getvalue())
            self.assertNotIn("UNREVIEWED_REFERENCE", output.getvalue())
