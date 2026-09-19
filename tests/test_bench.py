import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from jevjudge.data import canonical, normalize, pair, state
from jevjudge.providers import accounting, parse_prediction, request_body, validate_config
from jevjudge.report import build_report, calibration, cluster_interval
from jevjudge.runner import run


def example(identifier="1"):
    return pair("fixture", identifier, "What is two plus two?", "Four", "Five", "A", "math")


MOCK = {"models": [{"id": "mock", "kind": "mock", "model": "MOCK"}]}


class DataTests(unittest.TestCase):
    def test_label_metadata_never_enters_state(self):
        row = example()
        row["meta"]["error"] = "SECRET-GOLD-EXPLANATION"
        self.assertEqual(set(state(row)), {"user_prompt", "response_A", "response_B"})
        self.assertNotIn("SECRET-GOLD", json.dumps(state(row)))
        self.assertEqual(state(row, True)["response_A"], "Five")
        self.assertEqual(canonical("A", True), "B")
        self.assertEqual(canonical("TIE", True), "TIE")

    def test_rm_style_matrix_and_grouping(self):
        rows = normalize("rmbench", "math_filtered.json", [{"id": 1, "prompt": "p",
                         "chosen": ["c0", "c1", "c2"], "rejected": ["r0", "r1", "r2"]}])
        self.assertEqual(len(rows), 9)
        self.assertEqual(len({r["group"] for r in rows}), 1)
        self.assertEqual(len({r["partition"] for r in rows}), 1)
        for difficulty in ("hard", "normal", "easy"):
            self.assertEqual(sum(r["meta"]["difficulty"] == difficulty for r in rows), 3)

    def test_rewardbench_ties_not_negative_examples(self):
        rows = normalize("rewardbench2", "test.parquet", [{"id": 7, "prompt": "Name a color",
                         "chosen": ["red", "blue"], "rejected": ["dog"], "subset": "Ties"}])
        self.assertEqual([r["gold"] for r in rows], ["A", "A", "TIE"])
        self.assertTrue(all(not r["meta"]["native_protocol"] for r in rows))

    def test_same_prompt_across_sources_same_group(self):
        a = pair("a", "a", "a  prompt", "a", "b", "A", "x")
        b = pair("b", "b", "a prompt", "c", "d", "B", "y")
        self.assertEqual(a["group"], b["group"])
        self.assertEqual(a["partition"], b["partition"])


class ProviderTests(unittest.TestCase):
    def test_native_confidence_is_not_probability(self):
        pred = parse_prediction({"answers": {"verdict": {"choice": "A", "confidence": .4,
                                "probabilities": {"A": .8, "B": .1, "TIE": .1}}}}, "typesafe")
        self.assertEqual(pred["probabilities"]["A"], .8)
        self.assertEqual(pred["provider_confidence"], .4)

    def test_invalid_distribution_rejected(self):
        for probabilities in ({"A": 1}, {"A": .8, "B": .8, "TIE": .1},
                              {"A": float("nan"), "B": .1, "TIE": .1}):
            with self.assertRaises(ValueError):
                parse_prediction({"answers": {"verdict": {"choice": "A", "probabilities": probabilities}}}, "typesafe")

    def test_choice_probability_contradiction_rejected(self):
        with self.assertRaises(ValueError):
            parse_prediction({"answers": {"verdict": {"choice": "A", "probabilities":
                             {"A": .1, "B": .8, "TIE": .1}}}}, "typesafe")

    def test_decision_only_does_not_invent_probabilities(self):
        pred = parse_prediction({"choices": [{"message": {"content": '{"choice":"B"}'}}]}, "chat")
        self.assertIsNone(pred["probabilities"])
        self.assertIsNone(pred["provider_confidence"])

    def test_cost_missing_is_unknown_and_reported_cost_wins(self):
        model = {"input_usd_per_million": 1, "output_usd_per_million": 4}
        self.assertIsNone(accounting({}, model)["cost_usd"])
        result = accounting({"usage": {"prompt_tokens": 1000, "completion_tokens": 100,
                                       "cost": .001}}, model)
        self.assertEqual(result["cost_usd"], .001)
        self.assertAlmostEqual(result["estimated_cost_usd"], .0014)

    def test_request_contract_and_output_cap(self):
        raw = request_body({"kind": "typesafe", "model": "jev-1.13.0"}, state(example()))
        self.assertEqual(set(raw), {"model", "state", "questions"})
        self.assertEqual(set(raw["questions"]["verdict"]["criteria"]), {"A", "B", "TIE"})
        chat = request_body({"kind": "chat", "model": "x", "output_token_field": "max_completion_tokens",
                             "max_output_tokens": 2048}, state(example()))
        self.assertEqual(chat["max_completion_tokens"], 2048)


class StatisticsTests(unittest.TestCase):
    def test_identical_prompt_not_pseudo_replication(self):
        self.assertIsNone(cluster_interval([("same", 1)] * 20))
        self.assertEqual(cluster_interval([("a", 1), ("b", 1)]), [1, 1])

    def test_calibration_numeric_ground_truth(self):
        row = example()
        record = {"example_id": row["id"], "status": "ok", "canonical_choice": "A",
                  "canonical_probabilities": {"A": .8, "B": .1, "TIE": .1}, "provider_confidence": .1}
        stats = calibration([record], {row["id"]: row})
        self.assertAlmostEqual(stats["multiclass_brier"], .06)
        self.assertAlmostEqual(stats["ece_10_equal_width_bins"], .2)
        self.assertEqual(stats["risk_coverage"][4]["n"], 0)


class RunnerTests(unittest.TestCase):
    def test_no_paid_call_without_explicit_flags(self):
        config = {"models": [{"id": "j", "kind": "typesafe", "model": "jev-1.13.0",
                   "endpoint": "https://api.typesafe.ai/v1/systemone", "api_key_env": "TYPESAFE_API_KEY",
                   "input_usd_per_million": .042, "output_usd_per_million": 0, "max_request_usd": .003}]}
        with tempfile.TemporaryDirectory() as d, patch("jevjudge.runner.call") as api:
            with self.assertRaises(ValueError):
                run([example()], config, d)
            api.assert_not_called()

    def test_resume_and_changed_data_fail_closed(self):
        with tempfile.TemporaryDirectory() as d:
            run([example()], MOCK, d)
            before = (Path(d) / "attempts.jsonl").read_bytes()
            run([example()], MOCK, d)
            self.assertEqual((Path(d) / "attempts.jsonl").read_bytes(), before)
            with self.assertRaises(ValueError):
                run([example("2")], MOCK, d)
            report = build_report(d)
            self.assertTrue(report["mock"])
            self.assertEqual(report["models"]["mock"]["complete_pair_coverage"], 1)

    def test_partial_order_does_not_count_as_complete_case(self):
        with tempfile.TemporaryDirectory() as d:
            result = run([example()], MOCK, d, max_calls=1)
            self.assertEqual(result["status"], "budget_or_call_limit")
            report = build_report(d)
            self.assertEqual(report["models"]["mock"]["complete_pairs"], 0)
            self.assertEqual(report["models"]["mock"]["call_coverage"], .5)

    def test_failure_recorded_without_error_body_and_stops(self):
        with tempfile.TemporaryDirectory() as d, patch("jevjudge.runner.call", side_effect=ValueError("SECRET-KEY")):
            result = run([example()], MOCK, d)
            self.assertEqual(result["status"], "stopped_on_error_or_unknown_cost")
            contents = (Path(d) / "attempts.jsonl").read_text()
            self.assertNotIn("SECRET-KEY", contents)
            self.assertEqual(build_report(d)["models"]["mock"]["unknown_cost_calls"], 1)
            with self.assertRaises(ValueError):
                run([example()], MOCK, d)

    def test_budget_reservation_prevents_dispatch(self):
        config = {"models": [{"id": "j", "kind": "typesafe", "model": "jev-1.13.0",
                   "endpoint": "https://api.typesafe.ai/v1/systemone", "api_key_env": "TEST_JEV_KEY",
                   "input_usd_per_million": .042, "output_usd_per_million": 0, "max_request_usd": .003}]}
        with tempfile.TemporaryDirectory() as d, patch.dict("os.environ", {"TEST_JEV_KEY": "test"}), patch("jevjudge.runner.call") as api:
            result = run([example()], config, d, execute=True, max_cost=.001, max_calls=2)
            self.assertEqual(result["calls"], 0)
            api.assert_not_called()

    def test_template_requires_verified_prices(self):
        config = json.loads((Path(__file__).parent.parent / "configs/comparison.template.json").read_text())
        with self.assertRaises(ValueError):
            validate_config(config)


if __name__ == "__main__":
    unittest.main()
