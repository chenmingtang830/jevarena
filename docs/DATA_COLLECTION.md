# Private research contributions

Collection is opt-in and separately gated from model calls. A successful model run, page load, vote, JSON export, or share link never submits research data automatically. This intake is **not a public case database or a trusted benchmark**.

## What the contributor sends

The page previews the complete `CaseContribution`: task text and candidate answers, language, optional reference answer and basis, provenance, runs, selected options, probability values when available, usage/cost/latency, vote, and notes. The contributor must explicitly confirm review, research use, and rights to contribute under CC BY 4.0. Third-party material retains its own rights; link sources and do not submit copied material without permission.

The versioned consent requires `allowPublication: false`. Submission is private research review only. This endpoint grants no permission for public distribution, model training, or later provider calls. Public cases require a separate voluntary GitHub contribution and owner review. Submissions are always stored as `community-submitted`; browser claims of `reviewed` or `reproduced` are downgraded. Votes are preferences, not correctness labels.

API keys have no field in the contribution schema. Unknown fields are rejected, and recognizable key patterns accidentally pasted into allowed text are rejected. This is not a complete secret detector: users must review their input. The running website keeps provider keys only in the current tab's memory, not in this database, local storage, cookies, receipts, or share links. HTTPS protects transport. No key vault or server-side provider-key persistence is implemented; therefore there is no stored user-key ciphertext to decrypt. Browser extensions, compromised devices, or injected JavaScript can still read in-memory keys.

## Deployment gates

Both flags must be explicitly enabled after provisioning and verification:

- `NEXT_PUBLIC_CONTRIBUTIONS_ENABLED=true` exposes the UI at build time.
- `JEVARENA_COLLECTION_ENABLED=true` enables the server route.
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

`POST /api/contributions/delete` accepts `{receiptId, deletionToken}`. It removes the task/run payload and returns `{deleted:true}`. Already-deleted receipts remain idempotent until expiry. Unknown/expired receipts and incorrect tokens are denied without claiming successful withdrawal. If a submission is still in flight, wait and retry withdrawal with the same receipt; an early unsuccessful withdrawal must not imply that the pending upload was cancelled. The database stores only the token's SHA-256 digest, never the token itself; a minimal tombstone remains until original expiry to prevent a delayed retry from restoring withdrawn content. Losing a token prevents anonymous self-service deletion; do not ask users to publish it in GitHub or X. No public read or review-status mutation endpoint exists.

## Limits and retention

Input is limited to 128 KiB while streaming, with a 10-second inbound read deadline; the normalized contribution's pretty-printed JSON must also fit the shared 128,000-byte export limit so accepted data remains importable in the browser and Python. The upstream RPC has an 8-second fetch deadline, an 8-second bounded read deadline, and a 4 KiB response limit; the Vercel function has a 30-second ceiling. Requests are same-origin JSON, uncached, do not follow redirects, do not log content, and do not expose raw database errors.

The Pro-capacity profile admits at most 10,000 new submissions per UTC day and 100 per salted IP hash per clock hour, subject to **both** a 5 GiB active payload budget and a 310,000-receipt cap including tombstones. At a typical 10 KiB payload, 10,000 records/day retained for 30 days occupy roughly 2.86 GiB before indexes/metadata/hosting overhead. At the maximum allowed size, that same 300,000-record history would require roughly 36.6 GiB and would not fit the plan or configured intake budget. Therefore 10,000/day is a capacity target, not a guaranteed throughput or unlimited storage promise. No payload is truncated to fit. Capacity exhaustion returns 429; users can keep their JSON and choose a later manual submission or GitHub contribution.

A singleton capacity row and transactional row lock serialize counters, idempotency, quotas, and insert across Vercel instances without a per-request full table count. Insertion adds rows and payload bytes, deletion removes payload bytes but keeps a tombstone, and expiry removes both. Duplicate retries consume no additional quota or storage; withdrawal does not reset the daily/IP quota. Each request purges at most 100 indexed expired receipts, while the scheduled job purges up to 1,000 every five minutes. Autovacuum thresholds on the intake table/TOAST data are lowered to reduce churn-related bloat.

Every new submission checks total physical database size **inside the admission lock**, and pauses intake at 6 GiB to leave space beneath an 8 GB database allowance. This per-request check is necessary because deleting a logical payload does not immediately reclaim physical space; a periodic sample alone would miss rapid withdrawal/resubmission churn. The scheduled job also refreshes the measurement and cleanup heartbeat. New intake fails closed if that scheduled heartbeat is over 15 minutes old, even when per-request measurements continue. These safeguards are **not an absolute physical storage cap**: indexes, backups, unrelated project data and transient bloat can consume additional space. Operators must monitor the hosting dashboard and investigate a storage pause before reopening intake. Existing receipt retries and withdrawal remain available during a pause.

These are data intake limits, not a limit on network requests or function invocations. Default hosting DDoS protections and request-size deadlines do not guarantee zero Vercel costs. The Pro-capacity profile requires a separately approved and provisioned database plan; it does not assume a paid Vercel firewall rule or authorize automatic purchases. Configure available usage alerts; use the collection kill switch if abuse or quota pressure occurs.

Pending payloads expire after **30 days**. An active five-minute `pg_cron` job and bounded on-request cleanup remove expired data; a backlog or job failure can delay physical cleanup, and new intake stops after 15 minutes without a fresh cleanup heartbeat. The application has no public reads. Host backups may retain deleted bytes according to the hosting provider's backup policy; this is not a cryptographic erasure guarantee. Keep an exported JSON copy if you want to retain or independently contribute a task after the private review window.

## Verification and review

Unit tests cover strict payloads, consent, known-secret rejection, task fingerprints, expected/selected options, exact probability maps, run/vote linkage, failures, request limits, same-origin checks, no key/IP leakage into storage, bounded upstream errors, idempotency request stability, withdrawal, and SQL permission/limit guardrails. The migration was exercised against a fresh isolated local PostgreSQL instance; this does not itself prove the live Supabase grants or scheduler state.

Before enabling production, verify live anonymous table/RPC denial, service-role submission, duplicate behavior, wrong-token denial, withdrawal, unchanged payload count after retry, the five-minute purge schedule, and fresh below-threshold storage state. Use synthetic public test content, then withdraw it. Do not label browser-submitted records as reproduced: maintainers must reproduce, inspect provenance/rights, and obtain separate publication permission before adding public fixtures or reports.

Local SQL reproduction files are `supabase/tests/intake-integrity.sql` (rollback-only invariant checks) and `supabase/tests/intake-load.sql` (synthetic writes, **isolated local database only**). In a fresh isolated PostgreSQL 14.18 database with the Pro profile, a 20-client, 4-thread, 25-transaction/client run accepted 500 synthetic approximately 10 KiB records, with 11.933 ms average SQL transaction latency. Row/byte counters matched the actual table exactly (500 rows; 5,375,000 payload bytes). The rollback-only integrity assertions also passed, including 30-day TTL, receipt/idempotency/withdrawal behavior, logical byte/row caps, quotas and stale scheduler rejection. Physical 6 GiB threshold exhaustion was not simulated. This is a local database smoke/load test, not an online capacity benchmark, provider latency, or proof of 10,000 real daily users.
