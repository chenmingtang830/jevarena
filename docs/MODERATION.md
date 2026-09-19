# Automated community screening

Only new submissions with `2026-09-19-auto-review-v1` consent (`publication: after-ai-review`, `automatedReview: true`, `reviewProvider: vercel`, `allowPublication: true`) are eligible. Private and prior after-review submissions must not be screened or published without renewed consent.

The server uses `JEVARENA_MODERATION_API_KEY`, never visitor keys, with the fixed Vercel AI Gateway Jev endpoint (`typesafe-ai/jev`). The helper makes one request, no retries, using the adapter timeout. Timeout may still incur cost. The server integration must reserve and enforce the authorized total budget before calling. The helper rejects screening inputs of 80,000 bytes or more and estimates over $0.01; estimates are not provider-enforced billing caps. No live calls were made while implementing this helper.

Schema, semantic, size and recognizable-secret checks precede transmission. The full projected public challenge and source attribution are screened, plus optional human reason. Run records, votes, receipts and API keys are not in the screening prompt. Never publish unscreened additional fields. Secret detection and model screening are imperfect; provider retention policies apply.

Categories: `publishable`, `sensitive`, `abuse-spam`, `missing-context`, `uncertain`. Only a successful `publishable` result permits publication. Errors, invalid responses and cancellation fail closed. Jev generates no explanation: displayed reasons are explicitly **category templates**, not model reasoning.

The database binds each screening job to an immutable contribution ID and single-use claim token. Public reads recheck consent, withdrawal and expiry; withdrawn or expired submissions are excluded even if screening finishes later. Public entries remain unverified community submissions, not reviewed benchmark evidence. Screening does not guarantee safety, correctness, legal compliance or rights clearance. Reporting and removal use the published privacy contact and withdrawal receipt.
