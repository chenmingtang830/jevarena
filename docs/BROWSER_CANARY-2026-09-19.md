# Production browser canary — September 19, 2026

Deployment: `3f3444ffeb0b9f7c4c7d8c4f904b492f24a5c069`, https://jevarena-lab.vercel.app/.
Operator authorized at most four OpenRouter calls and $0.05, without automatic retries. Exactly four calls were made, using a local operator key entered only in the browser's BYOK input. No inference key is present in these records.

## Observed results

| Workflow | Model | Choice | Browser end-to-end latency | Provider-reported USD |
| --- | --- | --- | ---: | ---: |
| Judgment / Arena: +20%, then −20% | Jev 1.13 | No | 401.9 ms | 0.000014784 |
| Judgment / Arena: +20%, then −20% | Gemini 2.5 Flash | No | 945.3 ms | 0.000049800 |
| Answer comparison / Compare: 9.11 vs 9.9 | Jev 1.13 | Answer 2 | 243.1 ms | 0.000019194 |
| Answer comparison / Compare: 9.11 vs 9.9 | Gemini 2.5 Flash | Answer 2 | 837.1 ms | 0.000081000 |

Total returned cost: **$0.000164778**; not an independently reconciled invoice. Jev resolved to `typesafe/jev-1.13-20260917`; Gemini's resolved version was unavailable and remains null. No probabilities or explanations were invented for Gemini.

Both judgments appeared together before voting. Model identity, latency, cost and probability were absent from the first vote view; voting revealed them. The case-library guessing flow worked without a key. Selecting reproduction only populated the workbench; explicit cost review and start were required for inference. There were no automatic paid retries.

The following records were read from the rendered share preview, saved, and compared back to the preview as parsed JSON with exact equality:

- [Judgment record](canaries/browser-2026-09-19-judgment.json)
- [Comparison record](canaries/browser-2026-09-19-comparison.json)

Both passed `jevjudge community validate`. The comparison passed isolated `community import`; its normalized contribution was uploaded to the production `/share` page and rendered with matching decisions, time and cost. It retained the **community submitted / unverified** label and did not make a model call. Import does not confer benchmark eligibility or label correctness.

## Limits

These are two simple English smoke cases, not a representative benchmark, failure study, calibration evaluation or latency leaderboard. The browser's network and concurrency conditions differ from batch experiments. The observed faster Jev responses do not establish a general quality or speed advantage. TypeSafe and Vercel Gateway browser paths remain disabled; this receipt does not validate them.

Private contribution/withdrawal acceptance is a separate release check and must not be inferred from successful model calls or offline tests.
