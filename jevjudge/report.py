"""Paired, prompt-clustered diagnostics. Every transformed score is explicitly labelled."""
from __future__ import annotations

import json
import math
import random
import statistics
from collections import defaultdict
from pathlib import Path

from .data import dump, load_jsonl


def mean(values):
    return statistics.mean(values) if values else None


def percentile(values, q):
    if not values:
        return None
    values = sorted(values)
    index = (len(values) - 1) * q
    lo = int(index)
    return values[lo] + (values[min(lo + 1, len(values) - 1)] - values[lo]) * (index - lo)


def cluster_interval(items, seed=42, draws=1000):
    """CI for the pair-weighted mean, resampling entire prompt clusters."""
    groups = defaultdict(list)
    for group, score in items:
        groups[group].append(score)
    if len(groups) < 2:
        return None
    clusters = [(sum(v), len(v)) for v in groups.values()]
    rng = random.Random(seed)
    samples = []
    for _ in range(draws):
        sample = rng.choices(clusters, k=len(clusters))
        samples.append(sum(s for s, n in sample) / sum(n for s, n in sample))
    return [percentile(samples, 0.025), percentile(samples, 0.975)]


def calibration(records, rows):
    observations = []
    brier, nll = [], []
    for r in records:
        probs = r.get("canonical_probabilities")
        if r["status"] != "ok" or not probs:
            continue
        gold = rows[r["example_id"]]["gold"]
        confidence = probs[r["canonical_choice"]]
        correct = int(r["canonical_choice"] == gold)
        observations.append((confidence, correct))
        brier.append(sum((p - int(k == gold)) ** 2 for k, p in probs.items()))
        nll.append(-math.log(max(probs[gold], 1e-15)))
    bins = []
    for index in range(10):
        values = [(p, c) for p, c in observations if min(int(p * 10), 9) == index]
        bins.append({"lower": index / 10, "n": len(values),
                     "mean_probability": mean([p for p, c in values]),
                     "accuracy": mean([c for p, c in values])})
    ece = sum(b["n"] * abs(b["mean_probability"] - b["accuracy"])
              for b in bins if b["n"]) / len(observations) if observations else None
    risk = []
    for threshold in (0, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99):
        selected = [c for p, c in observations if p >= threshold]
        risk.append({"threshold": threshold, "n": len(selected),
                     "coverage": len(selected) / len(observations) if observations else None,
                     "error_rate": 1 - mean(selected) if selected else None})
    return {"n": len(observations), "multiclass_brier": mean(brier), "nll": mean(nll),
            "ece_10_equal_width_bins": ece, "bins": bins, "risk_coverage": risk,
            "note": "Uses selected-label probability, never vendor confidence. Order/repeat observations are correlated."}


def slice_keys(row):
    keys = ["all", f"dataset:{row['dataset']}", f"domain:{row['dataset']}/{row['domain']}"]
    for name in ("difficulty", "comparison"):
        if name in row["meta"]:
            keys.append(f"{name}:{row['dataset']}/{row['meta'][name]}")
    size = len(row["prompt"]) + len(row["a"]) + len(row["b"])
    keys.append("input_chars:" + ("0-4000" if size < 4000 else "4000-16000" if size < 16000 else "16000+"))
    return keys


def build_report(directory):
    directory = Path(directory)
    manifest = json.loads((directory / "manifest.json").read_text())
    rows = {r["id"]: r for r in load_jsonl(directory / "examples.jsonl")}
    attempts = load_jsonl(directory / "attempts.jsonl")
    records = [r for r in attempts if r["event"] == "finished"]
    grouped = defaultdict(list)
    for record in records:
        grouped[record["model_id"]].append(record)
    report = {"title": "MOCK / PIPELINE TEST — NO MODEL RESULTS" if manifest["mock"] else "JevJudge-Bench",
              "fingerprint": manifest["fingerprint"], "mock": manifest["mock"],
              "protocol": manifest["protocol"], "models": {}, "paired_comparisons": [],
              "limitations": ["Diagnostic three-way pairwise protocol, not official RewardBench 2 or RM-Bench leaderboard scores.",
                              "Exploratory slice intervals; no multiple-comparison correction or causal failure attribution.",
                              "Public benchmark contamination is unknown. Label disagreement requires review.",
                              "CIs resample prompt groups; variants and order swaps are not independent examples.",
                              "Latency is serial client-observed full-response time, not TTFT or server-only latency.",
                              "List-price costs may overestimate cached requests; unknown bills are never zero."]}
    case_scores = {}
    failures = []
    expected_per_case = 2 * manifest["repeats"]
    for model in manifest["config"]["models"]:
        name = model["id"]
        rs = grouped[name]
        by_case = defaultdict(list)
        for r in rs:
            by_case[r["example_id"]].append(r)
        scores = {}
        slices = defaultdict(list)
        agreement, a_rate = [], []
        for identifier, results in by_case.items():
            good = [r for r in results if r["status"] == "ok"]
            row = rows[identifier]
            if len(good) == expected_per_case:
                score = mean([int(r["canonical_choice"] == row["gold"]) for r in good])
                scores[identifier] = score
                for key in slice_keys(row):
                    slices[key].append((row["group"], score))
                for repeat in range(manifest["repeats"]):
                    pair = [r for r in good if r["repeat"] == repeat]
                    agreement.append(int(pair[0]["canonical_choice"] == pair[1]["canonical_choice"]))
            for r in good:
                a_rate.append(int(r["choice"] == "A"))
                if r["canonical_choice"] != row["gold"]:
                    failures.append({"model_id": name, "example_id": identifier, "dataset": row["dataset"],
                                     "domain": row["domain"], "gold": row["gold"],
                                     "prediction": r["canonical_choice"], "swapped": r["swapped"],
                                     "repeat": r["repeat"], "probabilities": r.get("canonical_probabilities"),
                                     "provider_confidence": r.get("provider_confidence"),
                                     "review_status": "unreviewed_label_disagreement", "failure_tags": [],
                                     "prompt_group": row["group"], "metadata": row["meta"]})
        case_scores[name] = scores
        stats = {key: {"pairs": len(values), "prompt_groups": len({g for g, s in values}),
                       "accuracy": mean([s for g, s in values]), "ci95": cluster_interval(values),
                       "exploratory_small_n": len({g for g, s in values}) < 30}
                 for key, values in slices.items()}
        success = [r for r in rs if r["status"] == "ok"]
        expected = len(rows) * expected_per_case
        started_n = sum(r["event"] == "started" and r["model_id"] == name for r in attempts)
        known_costs = [r["cost_usd"] for r in rs if r.get("cost_usd") is not None]
        correct_n = sum(r["canonical_choice"] == rows[r["example_id"]]["gold"] for r in success)
        report["models"][name] = {
            "requested_model": model.get("model"),
            "resolved_models": sorted({r["resolved_model"] for r in rs if r.get("resolved_model")}),
            "planned_calls": expected, "started_calls": started_n, "finished_calls": len(rs),
            "successful_calls": len(success), "call_coverage": len(rs) / expected,
            "complete_pairs": len(scores), "complete_pair_coverage": len(scores) / len(rows),
            "attempted_accuracy_errors_as_wrong": correct_n / started_n if started_n else None,
            "planned_accuracy_missing_as_wrong": correct_n / expected,
            "order_consistency": mean(agreement), "displayed_A_rate": mean(a_rate),
            "cost_known_usd": sum(known_costs), "unknown_cost_calls": started_n - len(known_costs),
            "cost_basis": sorted({r.get("cost_basis", "unknown") for r in rs}),
            "known_usd_per_1000_finished_calls": sum(known_costs) / len(rs) * 1000 if rs else None,
            "latency_success_ms": {"p50": percentile([r["latency_ms"] for r in success], 0.5),
                                   "p95": percentile([r["latency_ms"] for r in success], 0.95)},
            "latency_all_finished_ms": {"p50": percentile([r["latency_ms"] for r in rs], 0.5),
                                        "p95": percentile([r["latency_ms"] for r in rs], 0.95)},
            "probability_sources": sorted({r.get("probability_source", "none") for r in success}),
            "calibration": calibration(rs, rows), "slices": stats}
    names = list(case_scores)
    for i, left in enumerate(names):
        for right in names[i + 1:]:
            common = sorted(case_scores[left].keys() & case_scores[right].keys())
            for dataset in sorted({r["dataset"] for r in rows.values()}):
                ids = [k for k in common if rows[k]["dataset"] == dataset]
                differences = [(rows[k]["group"], case_scores[left][k] - case_scores[right][k]) for k in ids]
                report["paired_comparisons"].append({"left": left, "right": right, "dataset": dataset,
                    "common_pairs": len(ids), "prompt_groups": len({g for g, d in differences}),
                    "accuracy_delta_left_minus_right": mean([d for g, d in differences]),
                    "ci95": cluster_interval(differences)})
    for failure in failures:
        identifier = failure["example_id"]
        failure["other_models_correct_both_orders_all_repeats"] = [
            name for name, scores in case_scores.items()
            if name != failure["model_id"] and scores.get(identifier) == 1]
    failures.sort(key=lambda f: (-len(f["other_models_correct_both_orders_all_repeats"]),
                                -(f["probabilities"] or {}).get(f["prediction"], 0), f["example_id"]))
    dump(directory / "report.json", report)
    with (directory / "failures.jsonl").open("w") as stream:
        for failure in failures:
            stream.write(json.dumps(failure, ensure_ascii=False) + "\n")
    lines = ["# " + report["title"], "", "Protocol: **diagnostic three-way pairwise**, both orders.", "",
             "Scores are label agreement, not independently verified truth. See report.json for denominators and uncertainty.", ""]
    for name, model in report["models"].items():
        lines += [f"## {name}", "", f"Complete pairs: {model['complete_pairs']}/{len(rows)}. "
                  f"Calls: {model['successful_calls']}/{model['planned_calls']} successful/planned.", "",
                  f"Known cost: ${model['cost_known_usd']:.6f}; unknown-cost calls: {model['unknown_cost_calls']}.", "",
                  f"Latency (successful, ms): {model['latency_success_ms']}. Order consistency: {model['order_consistency']}.", "",
                  "| Slice | Accuracy | 95% cluster interval | Prompt groups |", "|---|---:|---|---:|"]
        for key, s in sorted(model["slices"].items(), key=lambda kv: kv[1]["accuracy"]):
            lines.append(f"| {key} | {s['accuracy']:.3f} | {s['ci95']} | {s['prompt_groups']}" +
                         (" (exploratory)" if s["exploratory_small_n"] else "") + " |")
        lines += [""]
    lines += ["## Failure review", "", "failures.jsonl prioritizes errors where other models agree with the label, then high-probability errors.",
              "Join example_id to examples.jsonl to inspect original public text. Review labels before assigning failure causes.", "",
              "## Limitations", ""] + ["- " + s for s in report["limitations"]]
    (directory / "report.md").write_text("\n".join(lines) + "\n")
    return report
