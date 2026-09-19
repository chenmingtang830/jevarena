# JevArena

An independent, open-source judgment arena. Try recorded examples without an account or API key; connect OpenRouter or run locally to test your own questions. Every live battle includes Jev. The Python research harness remains **JevJudge-Bench**.

[Play JevArena](https://jevarena-lab.vercel.app) · [Community](https://github.com/chenmingtang830/jevarena/discussions)

Maintained by [Richard Tang (@richardt830)](https://x.com/richardt830).
The source code is Apache-2.0 licensed; third-party examples retain their own licenses.
Normal guest runs do not save your API key or conversation to JevArena's database.
Keys live only in the current tab's memory. Explicit research submissions are an
exception: they save the data you preview and consent to contribute. Providers and
hosting services may retain operational data under their own policies. This is
not a zero-logging or zero-risk service. Use a limited-budget key or run locally.
Send private privacy/deletion requests to richard@learnest.org, not public issues.

## Web playground

```sh
cd web
npm ci
npm run dev
```

The homepage is an editable question composer with one-click examples; `/play` remains an alias for custom tasks. `/try` shows two real recorded canary examples, clearly labeled as diagnostic runs, not a benchmark. OpenRouter authorization uses a popup and PKCE; the returned key exists only in the original tab's memory. Manual keys are a separate, mutually exclusive connection view. No page load or connection automatically calls a model. Other case templates remain explicitly unmeasured.

Starting a confirmed run opens `/battle`, a separate tab-memory battle view.
No prompt, result or key is put in the URL or browser storage. Reloading or
opening that URL in another tab shows an empty state and never repeats a call.
The homepage offers only two source-backed community examples, not trivial
Yes/No templates. Additional OpenRouter opponents are explicitly labeled
experimental until live-tested and are excluded from random Arena selection.

For local Vercel AI Gateway use, start from `web` with `NEXT_PUBLIC_VERCEL_BYOK_ENABLED=true JEVARENA_RELAY_ENABLED=true npm run dev`, then choose Vercel under the manual key disclosure. The loopback server forwards to Gateway without saving the key. Do not expose this relay publicly. Public Vercel support stays disabled pending deployment security review. See `/run-locally` for the full steps.

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

See [contributing](CONTRIBUTING.md), [security](SECURITY.md), and [provider verification](docs/PROVIDERS.md). Small real OpenRouter and Gateway transport canaries have passed; they are not a benchmark or evidence of general model superiority. Mock runs must never enter a model leaderboard.

## Contributing data

After a run, open **Share this experiment**, inspect the complete JSON, and choose
whether to contribute privately to research. Collection is opt-in, not automatic;
publication is a separate GitHub action and owner review. Download the deletion
receipt if you submit: the site has no account or automatic receipt storage.
API keys are never collected or saved by this feature.

The private intake, quota, retention and withdrawal contract is documented in
[data collection](docs/DATA_COLLECTION.md). Maintainers can validate and import a
downloaded case offline without running a model:

```sh
uv run jevjudge community validate case.json
uv run jevjudge community import case.json --out data/community/new-case
```

Community observations stay in a separate, unreviewed corpus. Importing a record
does not establish correctness or admit it into a benchmark. Contributors can
reopen its normalized JSON in `/share` and explicitly rerun it with their own key.

## Python benchmark

Find where Jev fails as a judge, what other judges get right, and what those differences cost.

**Status: runnable local evaluation harness, not measured model findings. The separate web-provider canaries are diagnostic only.**
Independent project; not affiliated with TypeSafe, JudgeBench, RM-Bench, or Ai2.

## Quick start

```sh
uv sync
uv run jevjudge fetch
uv run jevjudge prepare --groups-per-domain 2 --partition test --out data/pilot.jsonl
uv run jevjudge plan --data data/pilot.jsonl --config configs/jev-direct.json

# No credentials or model calls: exercise the full pipeline on public examples.
uv run jevjudge run --data data/pilot.jsonl --config configs/mock.json --out runs/smoke
uv run jevjudge report runs/smoke
```

Open `runs/smoke/report.md`. Every simulated report is marked **MOCK / PIPELINE TEST**.
Raw datasets and runs are gitignored. Source URLs, revisions, byte digests, licenses and
selection parameters are recorded under `data/`; no third-party dataset is republished here.

## Research question

Where is Jev on the quality/cost/latency frontier, and which tasks break its apparent confidence?
The primary artifact is a reviewed failure atlas, not one averaged leaderboard number.

| Source | What it probes | Implementation |
|---|---|---|
| [JudgeBench](https://github.com/ScalerLab/JudgeBench) | Knowledge, reasoning, mathematics, coding; subtle correctness differences | Both response-generator sets; upstream A/B labels |
| [RM-Bench](https://github.com/THU-KEG/RM-Bench) | Correctness versus verbosity/Markdown; subtle errors | All 3×3 chosen/rejected style combinations; easy/normal/hard tags |
| [RewardBench 2](https://huggingface.co/datasets/allenai/reward-bench-2) | Factuality, precise instruction following, math, safety, focus, ties | Diagnostic chosen/rejected pairs and chosen/chosen tie pairs |

All three use a common three-way pairwise protocol here, with both A/B orders.
**These transformed scores are not official leaderboard scores.** In particular,
RewardBench 2 evaluates groups of completions and reward margins; this harness does not
implement its native reward-margin metric. RM-Bench's published scalar-reward protocol
also differs from a direct pairwise choice. Native-protocol replication is a separate next track.

## Run actual judges

Use `configs/jev-direct.json` for TypeSafe's documented direct HTTP API. Set the
`TYPESAFE_API_KEY` environment variable in your shell; never put keys in a config or commit.
Jev is pinned to `jev-1.13.0`, and the actual response model ID is recorded.

Copy and complete `configs/comparison.template.json` for an OpenAI-compatible endpoint.
Choose a budget model, a strong direct-answer judge and a reasoning judge as separate model
config entries. Verify exact provider IDs, availability, prices and output-token parameter
before running. Null rate fields deliberately fail validation. No baseline model has been
selected or live-verified for this Python configuration yet. Direct Anthropic/Gemini APIs and Vercel's experimental Jev
evaluation API are not implemented; compatible chat gateways may route comparison models.

```sh
# Example operational limits, not authorization or a forecast of the actual bill.
uv run jevjudge run --data data/pilot.jsonl --config configs/jev-direct.json \
  --out runs/jev-pilot --execute --max-cost-usd 1 --max-calls 100
uv run jevjudge report runs/jev-pilot
```

Calls are serial and models/orderings interleaved with a fixed seed. Both orders and repeats
count toward the call and cost limits. Before each call the runner reserves the configured
`max_request_usd`; it stops when this would exceed the run limit. **This is a client-side
reservation policy, not a provider-enforced cap.** Use a provider spending cap for a hard
billing limit. Unknown costs, invalid responses, HTTP failures, or a request exceeding its
reservation stop the run. There are no hidden retries. Reported USD costs are preferred;
otherwise recorded input/output usage is priced at the configured rate card. Cached-input
discounts are not inferred; an estimate is labelled as such.

Resume with the identical command and higher limits if needed. The same data, source code,
rubric and configuration must match. Failed/unknown-cost or interrupted in-flight requests
require billing reconciliation and a new run directory. Existing completed attempts are
never silently rerun. A process killed mid-request leaves `RUNNING.lock` and its started event;
inspect before manually removing the lock. Do not delete accounting records to bypass it.

## Read the output

- `manifest.json`: data and implementation digests, rubric, models, run identity, planned calls.
- `attempts.jsonl`: durable start/end events, input hashes, model identity, token counts,
  native probabilities, provider confidence, USD basis, latency and sanitized error types.
- `report.json` / `report.md`: coverage, errors, slice accuracy, prompt-cluster bootstrap
  intervals, order consistency, calibration, risk/coverage and paired model differences.
- `failures.jsonl`: unreviewed disagreements, prioritized by other-model successes and
  selected-label probability. Join with `examples.jsonl` to inspect the source text.

Provider confidence is stored separately from predicted class probability. Brier score,
log loss and ECE use the latter. Chat judges default to decision-only; a separate model
entry with `probability_mode: self_reported` enables elicited probabilities, labelled as
self-reported and never silently equated with Jev's native distribution.

Read [PROTOCOL.md](PROTOCOL.md) before making capability claims, and
[RESEARCH_PLAN.md](RESEARCH_PLAN.md) for the initial hypotheses and experiment ladder.
