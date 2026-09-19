# JevJudge-Bench research plan

Goal: map which judge tasks Jev handles well, which it fails, whether uncertainty predicts
those failures, and what a stronger judge costs to recover them. No outcome is assumed.

## Predeclared hypotheses

The [Jev 1.13 jaggedness document](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
(vendor self-report, reviewed 2026-09-19) identifies numeric precision/counting, date comparisons,
indirection, irrelevant long state, adversarial content and structural consistency as limitations.
These are hypotheses to investigate, not independent benchmark findings.

| Hypothesis | Initial public-data probe | What would strengthen the evidence |
|---|---|---|
| Weak multi-step correctness judgments | JudgeBench math/reasoning/code | Human-reviewed errors and paired advantage for a reasoning judge |
| Style can override subtle correctness | RM-Bench hard versus normal/easy | Within-prompt style-controlled differences, not raw cross-domain averages |
| Precise constraints cause high-confidence errors | RewardBench 2 precise IF | Independent executable verification where available |
| Good common-sense judgment does not imply factuality | RewardBench 2 factuality/focus | Error adjudication using original evidence sources |
| Confidence fails on difficult slices | All three, slice-specific | Held-out Brier/NLL/risk-coverage and overconfident error counts |
| Equivalent answers or answer ordering are unstable | RewardBench 2 tie diagnostics, every dataset swapped | Repeated runs with both orders and explicit tie definitions |

Long context, adversarial inputs and multilingual behavior need further public datasets or
carefully validated perturbations. This first suite does not claim comprehensive coverage.
Potential second-wave sources: LLMBar (instruction-following adversarial comparisons),
Judge Jiu-Jitsu (judge attacks), and source-grounded hallucination datasets. Verify licenses,
schemas and ground truth before adding; none is implemented yet.

## Experiment ladder

1. Free local validation: pinned downloads, source receipts, label mapping, swaps, statistical
   denominators, mock end-to-end run. Never use mocks as capability or pricing evidence.
2. Small paid transport canary: a few matched examples, Jev plus one comparator, both orders.
   Verify version, usage/cost, output parsing and rate limits. Approve a concrete spend ceiling first.
3. Development pilot: stratified prompt groups across domains, Jev plus budget, strong direct-answer
   and reasoning judge configurations. Freeze rubric, settings and thresholds after inspecting dev.
4. Test run: larger untouched local test split; equal examples/budgets; at least 30 prompt groups
   per headline slice where available. Publish coverage and uncertainty, not just point estimates.
5. Manual failure review: blind source-model identity; distinguish label problems, rubric ambiguity
   and real failure. Export a concise failure atlas with source IDs, reproductions and disagreement.
6. Follow-up: test whether Jev-to-strong-judge routing reduces cost at fixed held-out error rate.
   Charge both calls on fallback. Evaluate fixed policies chosen on dev; no oracle routing on test.

## Before paid experiments

The data plan prints exact request counts including order swaps and repeats. Choose concrete
comparison model IDs and price cards, confirm accessible routes, run a bounded canary, then
estimate the full run from actual usage. A per-call reservation is not an exact bill. No request
budget or provider credentials have been supplied for the initial build.

## Sources

- JudgeBench: https://github.com/ScalerLab/JudgeBench and https://arxiv.org/abs/2410.12784
- RM-Bench: https://github.com/THU-KEG/RM-Bench (especially scripts/utils.py)
- RewardBench 2: https://huggingface.co/datasets/allenai/reward-bench-2
- TypeSafe request contract: https://docs.typesafe.ai/api
- TypeSafe confidence semantics: https://docs.typesafe.ai/confidence
- TypeSafe model pin and price: https://docs.typesafe.ai/models

Source revisions and licenses are pinned in `jevjudge/data.py`; downloads receive byte hashes.
