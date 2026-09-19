# Public preview — 2026-09-19

Production: https://jevarena-lab.vercel.app

Repository: https://github.com/chenmingtang830/jevarena

The requested `jevarena.vercel.app` and `jev-arena.vercel.app` aliases were already in use. `jevarena-lab.vercel.app` and the automatically assigned `jevarena-three.vercel.app` are verified domains on this project. Main-branch pushes deploy automatically; pull requests receive Vercel previews. The initial deployment is retained for rollback: `dpl_GAmPrYCeaaPA5tfrEmv2zopjv1xm`.

## Delivered

Two text input modes; Arena and explicit Compare; randomized X/Y; parallel completion barrier; vote then identity/latency/cost reveal; manual cancellation, repeat and swapped-order comparison; attempt history in memory; language field; price estimates and sources; six original templates; case guessing and replay; bounded fragment/JSON sharing and browser PNG generation; GitHub contribution workflow and three discussion categories; Apache-2.0 code license; shared TS/Python contracts and scoring rubric.

OpenRouter is browser-direct. TypeSafe and Vercel adapters have offline contract coverage but their relay is disabled in this deployment. All three are explicitly experimental. A [local OpenRouter canary](OPENROUTER_CANARY-2026-09-19.md) passed four calls; Gateway evidence and normalization fixes were merged in PR #1. Production-browser acceptance is tracked separately from local transport checks. Public templates contain no measured runs. Browser E2E responses are synthetic and not published as results.

## Pending owner review: UX and community studies

PR #2 adds four attributed X community case-study pages, early examples, separate in-memory task drafts, inline validation/focus, and mobile navigation improvements. These changes are not production-shipped until reviewed and merged. Source-post verification is not experimental reproduction. The public OpenRouter canary receipt is diagnostic transport evidence, not a leaderboard entry.

## Verification

40 Python tests, 70 TypeScript unit tests, and 58 desktop/mobile Playwright tests passed locally for the contribution-enabled build. Production build and typecheck passed. These browser tests mock providers and intake; they do not prove production connectivity. Isolated PostgreSQL integrity tests and a 500-submission, 20-client synthetic load check passed, with exact capacity accounting; this is not an online throughput guarantee.

Supabase Pro and enabled Spend Cap were verified in the operator dashboard on September 19. Migration 004 is applied: 30-day receipts, 10,000/day admission ceiling, 100/IP/hour, 5 GiB active payload / 310,000 receipt limits, and a 6 GiB database-size admission stop. Every five minutes an active cron job purges expired rows. Private tables have RLS and deny anonymous/authenticated table access. Limits are safeguards, not an assurance that every maximum-size submission fits, nor an absolute hosting bill cap. See [data collection](DATA_COLLECTION.md).

GitGuardian incident 37449110 was inspected and classified as a test credential: it identified only the disposable PostgreSQL CI service password, not a cloud or model credential. CI now uses a per-run disposable value. Secret scanning remains enabled. GitHub Actions passed both application tests and the real PostgreSQL integrity job at revision `43edb0f`.

## Remaining release gates

- Real production-domain canary and submission/withdrawal verification before announcing public beta. A maximum of four new OpenRouter calls and $0.05 is explicitly authorized; do not exceed it or auto-retry.
- Three-provider live acceptance, including billing/usage/version edge cases. Contract-only adapters are not evidence of live provider reliability.
- Operator-approved rate limiting and a hosting spend envelope before enabling relay. Account is on an existing Pro plan; no upgrade or paid firewall feature was enabled. Remaining quota and spend-alert configuration are not independently verified.
- Advanced selectable reasoning settings and per-case social preview images are follow-ups; v1 uses bounded provider-default reasoning and generic social metadata.
- First diagnostic research report, reviewed failures, grouped uncertainty, and measured model findings require a separately authorized experimental run. No fabricated leaderboard.

BYOK prevents platform-owned inference bills; it does not eliminate Vercel bandwidth, build, or function costs. Public preview is not the completion of the paid-canary/research phase.
