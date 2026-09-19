# OpenRouter canary — 2026-09-19

Four authorized real requests completed successfully from local Node to OpenRouter, sequentially, without retries. The two public templates are the same as the earlier Gateway canary. Expected labels and explanations were not sent to either model. All four returned choices match the template references. This is a transport canary, not a benchmark or production-browser acceptance test.

| Task | Requested model | Choice | Full local response | Returned cost USD |
| --- | --- | --- | --- | --- |
| Decimal comparison | typesafe/jev-1.13 | answer2 | 421 ms | 0.000019194 |
| Decimal comparison | google/gemini-2.5-flash | answer2 | 617 ms | 0.000081000 |
| Chinese negation | typesafe/jev-1.13 | no | 168 ms | 0.000015372 |
| Chinese negation | google/gemini-2.5-flash | no | 513 ms | 0.000045800 |

Total provider-reported cost: **$0.000161366**, not a reconciled invoice. Approved envelope: four calls, $0.05. Conservative preflight maximum: $0.021826796. All four calls are now spent; another invocation needs new explicit authorization even though the dollar ceiling was not reached.

Jev returned revision `typesafe/jev-1.13-20260917`, choice probability 1 and confidence 1 on both items. Gemini's actual revision remains unknown. Two easy items and fixed-order sequential calls do not establish general accuracy, calibration, latency rankings or tail latency. No Jev failure was observed in this tiny sample.

## Evidence and normalization

Sanitized public evidence: [OpenRouter canary JSON](evidence/openrouter-canary-2026-09-19.json). Original local receipt remains in ignored `runs/openrouter-canary-2026-09-19T08-12-50.472Z/receipt.json`.

The existing base RunRecord incorrectly assigned the chat-only 4096 output-token cap to native Jev too. PR #1 already addresses that general metadata defect. The public projection removes this setting from Jev records offline; no calls were repeated, and the raw local receipt is unchanged. The manual canary script also corrects that metadata for future runs. Actual Gemini requests had the 4096-token cap; Jev's choice endpoint did not.

The key was read from an explicitly authorized existing local environment file into memory. It was not printed, copied into a browser, committed or included in evidence. HTTP outcomes, normalized records and public task hashes were retained, not request headers or raw credential files.

## Not yet accepted

- Browser-direct authenticated calls and production-origin CORS behavior.
- TypeSafe native authenticated requests and other selected chat models.
- Deployed relay behavior under load, distributed rate limiting and hosting spend controls. Production `/api/judge` still returns 503 with its relay-disabled message on a keyless check.
- Provider invoices, long-tail latency, difficult tasks and reproducible research conclusions.

Only the two specified OpenRouter paths were exercised. Do not mark all providers or the backend as fully accepted. No model canary runs automatically in CI.
