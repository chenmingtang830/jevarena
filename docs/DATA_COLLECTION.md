# Research and public-case contributions

The legacy private-research form is opt-in and separately gated from model calls. **Public contribution mode**, when enabled, starts with a visible checkbox on before a guest answer or paid-match confirmation. Turning it off prevents that contribution upload. Page load, provider connection, JSON export and share-link creation do not submit research data. When automated review is enabled, the notice explicitly says that completing the answer or vote sends the contribution to Vercel/Jev for screening and publishes it if it passes. No human approval is required in that new mode. Failed or uncertain screening stays unpublished. The feed is **not a trusted benchmark**. All modes remain deployment-gated until migration and runtime checks pass.

## What the contributor sends

The manual private form previews the complete `CaseContribution`: task text and candidate answers, language, optional reference answer and basis, provenance, runs, selected options, probability values when available, usage/cost/latency, vote, and notes. That form requires explicit review, research-use and rights confirmations. Public mode instead shows its contribution choice before the completing action; do not hide the public scope in terms alone. Third-party material retains its own rights; link sources and do not submit copied material without permission.

Legacy consent version `2026-09-19` requires `allowPublication: false`; those submissions remain private research review only. New consent version `2026-09-19-public-v1` requires `research`, `rights`, `reviewed` and `allowPublication` all true, plus `publication: "after-review"`. It authorizes a public candidate, not immediate publication. Original additions use CC BY 4.0; `sourceAttributions` preserve the URLs, authors, licenses and notices of third-party material. Existing private records must never be converted or published under the new default. Neither consent grants permission for model training or later provider calls.

The separate exact automated-review consent is `{version: "2026-09-19-auto-review-v1", research: true, rights: true, reviewed: true, allowPublication: true, publication: "after-ai-review", automatedReview: true, reviewProvider: "vercel"}`. Only this new consent authorizes later Vercel/Jev screening and automatic publication if it passes. Neither older consent is replayed to providers or automatically published. This new consent does not authorize model training or unrelated provider calls.

An optional `humanAnswer` records `optionId`, `revealedBeforeAnswer` and an optional rationale of up to 2,000 characters. It is distinct from the model-preference `vote`; neither establishes correctness. Preserve whether the result was already revealed. Guest answers need not include invented model runs. Submissions are always stored as `community-submitted`; browser claims of `reviewed` or `reproduced` are downgraded. AI screening does not upgrade their evidence status. Human validation is still required before claiming a reproduced result or verified answer.

API keys have no field in the contribution schema. Unknown fields are rejected, and recognizable key patterns accidentally pasted into allowed text are rejected. This is not a complete secret detector: users must review their input. The running website keeps provider keys only in the current tab's memory, not in this database, local storage, cookies, receipts, or share links. HTTPS protects transport. No key vault or server-side provider-key persistence is implemented; therefore there is no stored user-key ciphertext to decrypt. Browser extensions, compromised devices, or injected JavaScript can still read in-memory keys.

## Deployment gates

Both flags must be explicitly enabled after provisioning and verification:

- `NEXT_PUBLIC_CONTRIBUTIONS_ENABLED=true` exposes the UI at build time.
- `JEVARENA_COLLECTION_ENABLED=true` enables the server route.
- Public mode additionally requires `JEVARENA_PUBLIC_COLLECTION_ENABLED=true` and the build-time UI flag `NEXT_PUBLIC_PUBLIC_COLLECTION_ENABLED=true`. Apply migration 006 first, verify database permission and consent checks, enable the server flag and verify submission/withdrawal, then enable the UI flag and rebuild. Keep these off until the corresponding checks pass. The legacy collection flags alone do not enable publication consent.
- Automated review additionally needs migration 007, `JEVARENA_AUTOMODERATION_ENABLED=true`, server-only `JEVARENA_MODERATION_API_KEY`, `JEVARENA_MODERATION_TOTAL_LIMIT_CENTS=5000`, and `NEXT_PUBLIC_AUTO_REVIEW_ENABLED=true` at build time. Use a smaller budget (for example 4 cents) for the bounded canary first. Enable the UI only after server consent, budget, screening, publication and withdrawal checks pass. Never reuse a contributor’s key for screening.
- `SUPABASE_URL=https://<project-ref>.supabase.co` is the fixed operator-configured destination. Request-provided URLs are never accepted.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. New `sb_secret_` keys use the `apikey` header; legacy JWT keys also use `Authorization`. Never prefix this variable with `NEXT_PUBLIC_`.
- `JEVARENA_IP_HASH_SALT` is a random server-only value of at least 32 characters.
- `VERCEL=1` and Vercel's trusted `x-vercel-forwarded-for` header are required. The intake intentionally fails closed on an untrusted custom/local host.

No browser receives the service key or database access. Apply the ordered SQL files under `supabase/migrations/` through an authorized migration session. Migration 003 enables `pg_cron`; migration 004 changes the job to every five minutes and installs the Pro-capacity profile below. Apply 004 only after the operator has provisioned the approved plan; the SQL does not purchase or upgrade anything. Verify the job is active and the storage monitor is fresh before enabling intake. Set secrets in Vercel environment configuration without echoing them or writing them into repository files. Rebuild when enabling the public UI flag. A missing secret, rate-limiter failure, bad database response, or unsupported origin fails closed; no fallback database or automatic retry exists.

Vercel documents its trusted request headers at [Request headers](https://vercel.com/docs/headers/request-headers). Do not deploy this handler directly behind arbitrary client-controlled forwarding headers. Hashed IPs remain pseudonymous data, not anonymous data: the server salts and SHA-256 hashes the IP before sending it to Supabase, and retains that hash only in bounded hourly quota counters. Providers and hosting infrastructure may separately process network metadata according to their policies.

## API and receipts

`POST /api/contributions` accepts strict JSON:

```json
{
  "schemaVersion": 1,
  "submissionId": "a browser-generated UUID",
  "deletionToken": "43 base64url characters from 32 random bytes",
  "consent": {
    "version": "2026-09-19",
    "research": true,
    "rights": true,
    "reviewed": true,
    "allowPublication": false
  },
  "contribution": { "...": "the previewed CaseContribution" }
}
```

The success response contains `receiptId` (equal to `submissionId`), `status`, `receivedAt`, `expiresAt`, and the browser's `deletionToken`. Save or download the receipt deliberately; it is the only withdrawal credential. It is not included in public share data. Identical retries reuse the frozen submission ID, token, and payload and return the same receipt without duplicate counting. Edited content needs a new ID and token. Unknown network outcomes can safely retry the same request, or withdraw using the locally retained receipt ID and token.

The example above is the unchanged private contract. The older public-candidate consent remains `{version: "2026-09-19-public-v1", research: true, rights: true, reviewed: true, allowPublication: true, publication: "after-review"}`; it does not enroll a record in automated screening. Use the exact new consent above only after displaying the new provider-screening notice. `/community` reads a restricted public projection of the newest 20 eligible, unexpired, non-withdrawn published records, not the private intake table. No deletion token, token hash, IP metadata or API key is exposed. A receipt can withdraw the underlying record and exclude it from the feed, but cannot recall third-party copies or GitHub commits.

`POST /api/contributions/delete` accepts `{receiptId, deletionToken}`. It removes the task/run payload and returns `{deleted:true}`. Already-deleted receipts remain idempotent until expiry. Unknown/expired receipts and incorrect tokens are denied without claiming successful withdrawal. If a submission is still in flight, wait and retry withdrawal with the same receipt; an early unsuccessful withdrawal must not imply that the pending upload was cancelled. The database stores only the token's SHA-256 digest, never the token itself; a minimal tombstone remains until original expiry to prevent a delayed retry from restoring withdrawn content. Losing a token prevents anonymous self-service deletion; do not ask users to publish it in GitHub or X. Public reads exclude withdrawn records, including withdrawal concurrent with screening. There is no browser-accessible review-status mutation endpoint.

## Automated publication limits

The operator-funded screening budget has a **$50 lifetime ceiling**, not a daily reset. An atomic database reservation charges one cent of budget per attempt before the provider request, allowing at most 5,000 attempts. Failed, timed-out or uncertain attempts do not release their reservation or retry automatically. The reservation ceiling is an application admission control, not a promise about provider invoices or hosting fees; bounded input and output and current pricing must remain within the per-attempt reservation before enabling calls. Budget exhaustion holds contributions unpublished.

New 201 submissions schedule one background moderation action through Next.js `after()`. The database claim is atomic; duplicate receipts cannot start another paid attempt. There are no automatic retries. Public projection reads are uncached (`no-store`).

Jev returns a publication-risk category. The UI uses a fixed human-readable mapping for that category; it must never attribute an invented free-text explanation to Jev. Passing the screen is not fact-checking, rights verification, independent reproduction or human review. Only exact new-consent records can be claimed for screening. Legacy private and review-only records remain in their original scope.

## Limits and retention

Input is limited to 128 KiB while streaming, with a 10-second inbound read deadline; the normalized contribution's pretty-printed JSON must also fit the shared 128,000-byte export limit so accepted data remains importable in the browser and Python. The upstream RPC has an 8-second fetch deadline, an 8-second bounded read deadline, and a 4 KiB response limit; the Vercel function has a 30-second ceiling. Requests are same-origin JSON, uncached, do not follow redirects, do not log content, and do not expose raw database errors.

The Pro-capacity profile admits at most 10,000 new submissions per UTC day and 100 per salted IP hash per clock hour, subject to **both** a 5 GiB active payload budget and a 310,000-receipt cap including tombstones. At a typical 10 KiB payload, 10,000 records/day retained for 30 days occupy roughly 2.86 GiB before indexes/metadata/hosting overhead. At the maximum allowed size, that same 300,000-record history would require roughly 36.6 GiB and would not fit the plan or configured intake budget. Therefore 10,000/day is a capacity target, not a guaranteed throughput or unlimited storage promise. No payload is truncated to fit. Capacity exhaustion returns 429; users can keep their JSON and choose a later manual submission or GitHub contribution.

A singleton capacity row and transactional row lock serialize counters, idempotency, quotas, and insert across Vercel instances without a per-request full table count. Insertion adds rows and payload bytes, deletion removes payload bytes but keeps a tombstone, and expiry removes both. Duplicate retries consume no additional quota or storage; withdrawal does not reset the daily/IP quota. Each request purges at most 100 indexed expired receipts, while the scheduled job purges up to 1,000 every five minutes. Autovacuum thresholds on the intake table/TOAST data are lowered to reduce churn-related bloat.

Every new submission checks total physical database size **inside the admission lock**, and pauses intake at 6 GiB to leave space beneath an 8 GB database allowance. This per-request check is necessary because deleting a logical payload does not immediately reclaim physical space; a periodic sample alone would miss rapid withdrawal/resubmission churn. The scheduled job also refreshes the measurement and cleanup heartbeat. New intake fails closed if that scheduled heartbeat is over 15 minutes old, even when per-request measurements continue. These safeguards are **not an absolute physical storage cap**: indexes, backups, unrelated project data and transient bloat can consume additional space. Operators must monitor the hosting dashboard and investigate a storage pause before reopening intake. Existing receipt retries and withdrawal remain available during a pause.

These are data intake limits, not a limit on network requests or function invocations. Default hosting DDoS protections and request-size deadlines do not guarantee zero Vercel costs. The Pro-capacity profile requires a separately approved and provisioned database plan; it does not assume a paid Vercel firewall rule or authorize automatic purchases. Configure available usage alerts; use the collection kill switch if abuse or quota pressure occurs.

Payloads expire after **30 days**. Expired and withdrawn records are excluded from public reads immediately, even before physical cleanup. An active five-minute `pg_cron` job and bounded on-request cleanup remove expired data; a backlog or job failure can delay physical cleanup, and new intake stops after 15 minutes without a fresh cleanup heartbeat. Host backups may retain deleted bytes according to the hosting provider's backup policy; this is not a cryptographic erasure guarantee. Keep an exported JSON copy if you want to retain or independently contribute a task after this window.

## Verification and review

Unit tests cover strict payloads, consent, known-secret rejection, task fingerprints, expected/selected options, exact probability maps, run/vote linkage, failures, request limits, same-origin checks, no key/IP leakage into storage, bounded upstream errors, idempotency request stability, withdrawal, and SQL permission/limit guardrails. The migration was exercised against a fresh isolated local PostgreSQL instance; this does not itself prove the live Supabase grants or scheduler state.

Before enabling production, verify live anonymous table/RPC denial, service-role submission, duplicate behavior, wrong-token denial, withdrawal, unchanged payload count after retry, the five-minute purge schedule, and fresh below-threshold storage state. Verify each consent is accepted only under its corresponding gate and that opt-out causes no upload. For automated review, test exact consent matching, atomic lifetime reservations, old-record exclusion, duplicate exclusion, failed screening staying unpublished, publication projection, expiry and withdrawal races. Use synthetic public test content with an explicitly authorized small budget, then withdraw it. Do not label browser-submitted records as reproduced or fact-checked merely because screening passed.

Local SQL reproduction files are `supabase/tests/intake-integrity.sql` (rollback-only invariant checks) and `supabase/tests/intake-load.sql` (synthetic writes, **isolated local database only**). In a fresh isolated PostgreSQL 14.18 database with the Pro profile, a 20-client, 4-thread, 25-transaction/client run accepted 500 synthetic approximately 10 KiB records, with 11.933 ms average SQL transaction latency. Row/byte counters matched the actual table exactly (500 rows; 5,375,000 payload bytes). The rollback-only integrity assertions also passed, including 30-day TTL, receipt/idempotency/withdrawal behavior, logical byte/row caps, quotas and stale scheduler rejection. Physical 6 GiB threshold exhaustion was not simulated. This is a local database smoke/load test, not an online capacity benchmark, provider latency, or proof of 10,000 real daily users.
