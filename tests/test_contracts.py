import unittest
import json
from copy import deepcopy
from jevjudge.contracts import validate_contract, model_input, challenge_fingerprint, SHARED
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
        self.challenge = {"schemaVersion": 1, "id": "test", "title": "Test", "language": "en", "kind": "judgment", "content": "Some text", "question": "Is it supported?", "options": [{"id": "yes", "label": "Yes"}, {"id": "no", "label": "No"}], "expected": "yes", "basis": "PRIVATE"}

    def test_no_labels_in_input(self):
        value = model_input(self.challenge)
        self.assertEqual(set(value), {"content", "question", "options"})

    def test_human_answer_is_distinct_and_validated(self):
        value = {"schemaVersion": 1, "id": "answer", "challenge": self.challenge,
                 "runs": [], "license": "CC-BY-4.0", "status": "community-submitted",
                 "humanAnswer": {"optionId": "yes", "revealedBeforeAnswer": False, "rationale": "Evidence"},
                 "sourceAttributions": [{"url": "https://example.com/source", "author": "Author", "license": "MIT", "notice": "MIT notice"}]}
        self.assertEqual(validate_contract("CaseContribution", value), value)
        self.assertNotIn("vote", value)
        with self.assertRaisesRegex(ValueError, "Human answer"):
            validate_contract("CaseContribution", {**value, "humanAnswer": {"optionId": "missing", "revealedBeforeAnswer": False}})
        with self.assertRaises(Exception):
            validate_contract("CaseContribution", {**value, "humanAnswer": {"optionId": "yes", "revealedBeforeAnswer": False, "rationale": "x" * 2001}})
        with self.assertRaises(ValueError):
            validate_contract("CaseContribution", {**value, "sourceAttributions": [{"url": "http://example.com", "author": "Author", "license": "MIT"}]})

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

    def test_fingerprint_matches_node_json_stringify_unicode_vectors(self):
        # Independently generated with Node crypto over JSON.stringify(modelInput).
        vectors = [
            ("Some text", "4125ebe97c304e211d26f776685d5fcb09002790561df75815c17001dcbb43ce"),
            ('中文 🎉\n"\\\u2028', "6f99a076202891d0766c87ab5ffd28926ad1be8206960d28d07c7ce2162f3c95"),
            ("\ud800x\udc00", "3b48fddd376019c9613aa4e9971776f4acf78bfc032bd7db9b8391c15229f618"),
            ("\ud83d\ude00", "f305045e3b0f3942e851d07b5731514f3041a707ec2e3928001bdadfb0a5fd64"),
            ("😀", "f305045e3b0f3942e851d07b5731514f3041a707ec2e3928001bdadfb0a5fd64"),
        ]
        for content, expected in vectors:
            with self.subTest(content=ascii(content)):
                self.assertEqual(challenge_fingerprint({**self.challenge, "content": content}), expected)

    def test_fingerprint_rebuilds_option_property_order_and_excludes_labels(self):
        reordered = deepcopy(self.challenge)
        reordered["options"] = [{"label": o["label"], "id": o["id"]} for o in reordered["options"]]
        reordered.update(expected="no", basis="Another private reference", source="Private source", language="zh")
        self.assertEqual(challenge_fingerprint(reordered), challenge_fingerprint(self.challenge))

    def test_comparison_fingerprint_matches_typescript(self):
        challenge = {"schemaVersion": 1, "id": "c", "title": "C", "language": "zh", "kind": "comparison",
                     "prompt": "问：2 + 2？", "answer1": "四 🎉", "answer2": "五", "expected": "tie"}
        self.assertEqual(challenge_fingerprint(challenge),
                         "864f528ca109c1cadc53b391b09312853e88ec86fd92e99bc4fe99910f2471d2")

    def test_invalid_expected_answer_rejected(self):
        with self.assertRaisesRegex(ValueError, "Expected"):
            validate_contract("Challenge", {**self.challenge, "expected": "not-an-option"})

    def test_nonfinite_number_rejected(self):
        with self.assertRaisesRegex(ValueError, "finite"):
            validate_contract("Challenge", {**self.challenge, "confidence": float("nan")})
