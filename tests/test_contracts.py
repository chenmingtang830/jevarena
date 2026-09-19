import unittest
import json
from jevjudge.contracts import validate_contract, model_input, SHARED
from jevjudge.providers import RUBRIC, PROMPT_VERSION, request_body


class ContractTests(unittest.TestCase):
    def test_benchmark_uses_shared_scoring_rubric_with_legacy_labels(self):
        rubric = json.loads((SHARED / "rubric.json").read_text())
        self.assertIn(rubric["comparison"], RUBRIC)
        self.assertEqual(PROMPT_VERSION, rubric["version"])
        body = request_body({"kind": "typesafe", "model": "jev"}, {"user_prompt": "q", "response_A": "a", "response_B": "b"})
        self.assertEqual(set(body["questions"]["verdict"]["criteria"]), {"A", "B", "TIE"})
        self.assertEqual(body["questions"]["verdict"]["instructions"], RUBRIC)
    def test_shared_fixture_matches_typescript(self):
        fixture = json.loads((SHARED / "fixtures.json").read_text())
        rubric = json.loads((SHARED / "rubric.json").read_text())
        self.assertEqual(model_input(fixture["challenge"]), {**fixture["modelInput"], "question": rubric["comparison"]})
    def setUp(self):
        self.challenge = {"schemaVersion": 1, "id": "test", "title": "Test", "language": "en", "kind": "judgment", "content": "Some text", "question": "Is it supported?", "options": [{"id": "yes", "label": "Yes"}, {"id": "no", "label": "No"}], "expected": "SECRET", "basis": "PRIVATE"}

    def test_no_labels_in_input(self):
        value = model_input(self.challenge)
        self.assertEqual(set(value), {"content", "question", "options"})

    def test_keys_rejected(self):
        with self.assertRaises(Exception):
            validate_contract("Challenge", {**self.challenge, "apiKey": "secret"})

    def test_duplicate_ids_rejected(self):
        self.challenge["options"][1]["id"] = "yes"
        with self.assertRaises(ValueError):
            validate_contract("Challenge", self.challenge)

    def test_comparison_rubric(self):
        c = {"schemaVersion": 1, "id": "c", "title": "C", "language": "en", "kind": "comparison", "prompt": "Question", "answer1": "One", "answer2": "Two"}
        self.assertEqual([o["id"] for o in model_input(c)["options"]], ["answer1", "answer2", "tie"])
