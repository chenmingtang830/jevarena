# Public preview — 2026-09-19

## Current launch status (supersedes historical checkpoints below)

Ready for a scoped **public preview**: guest examples, browser-direct OpenRouter comparisons, and GitHub contributions. Not a verified model leaderboard, three-provider public service, or guaranteed high-traffic deployment.

- Homepage, no-key experience and Examples share five attributed community tasks. The guest page also includes one English maintainer canary. Source reports remain distinct from independently run measurements.
- All no-key entrypoints use visible buttons; confirmed runs open a separate in-memory battle view.
- At `528982180fb34971f4b10e69202f2b102a74429c`, production deployment succeeded; 126 web unit tests and 94 desktop/mobile E2E tests passed. Provider responses in E2E are mocked.
- On September 19, the live production research endpoint accepted one explicitly synthetic no-run task (201), returned the same receipt on duplicate submission (200), rejected a wrong withdrawal token (404), accepted withdrawal (200), and accepted repeated withdrawal (200). Expiry was October 19, 2026. No model was called. The synthetic payload was withdrawn; the minimal anti-replay tombstone remains until expiry. This tests endpoint behavior, not independent inspection of database contents, grants, backup erasure, or throughput.
- GitHub is public, Discussions is enabled, and private vulnerability reporting is enabled. Model credentials and deletion receipts must never be posted to Issues.
- Guest login/history and the public provider relay are not launch features. Vercel Gateway is local opt-in only; experimental opponents are explicitly labeled and excluded from automatic Arena selection.

Launch messaging and contributor paths: [LAUNCH.md](LAUNCH.md). The previously pending endpoint submission/withdrawal gate is now satisfied for this synthetic workflow. Production CORS/inference evidence remains the earlier bounded canary, not a fresh inference run in this release.

### Operational limits for this preview

The existing intake limits and kill switch remain in place. No new infrastructure purchase, paid firewall rule, paid model call, or plan change was made for launch. Account spend alerts and a 10,000-user traffic envelope have **not** been certified. Operator monitoring is still necessary; BYOK does not eliminate hosting costs. If intake fails, users can retain JSON and contribute via GitHub. Disable collection and redeploy if abuse or capacity requires it; the browser-direct model flow is separate.

The checkpoints below are historical, not the current UI inventory or remaining preview blockers.

Production: https://jevarena-lab.vercel.app

Repository: https://github.com/chenmingtang830/jevarena

The requested `jevarena.vercel.app` and `jev-arena.vercel.app` aliases were already in use. `jevarena-lab.vercel.app` and the automatically assigned `jevarena-three.vercel.app` are verified domains on this project. Main-branch pushes deploy automatically; pull requests receive Vercel previews. The initial deployment is retained for rollback: `dpl_GAmPrYCeaaPA5tfrEmv2zopjv1xm`.

## Delivered

Two text input modes; Arena and explicit Compare; randomized X/Y; parallel completion barrier; vote then identity/latency/cost reveal; manual cancellation, repeat and swapped-order comparison; attempt history in memory; language field; price estimates and sources; six original templates; case guessing and replay; bounded fragment/JSON sharing and browser PNG generation; GitHub contribution workflow and three discussion categories; Apache-2.0 code license; shared TS/Python contracts and scoring rubric.

OpenRouter is browser-direct. TypeSafe and Vercel adapters have offline contract coverage but their relay is disabled in this deployment. All three are explicitly experimental. A [local OpenRouter canary](OPENROUTER_CANARY-2026-09-19.md) passed four calls; Gateway evidence and normalization fixes were merged in PR #1. Production-browser acceptance is tracked separately from local transport checks. Public templates contain no measured runs. Browser E2E responses are synthetic and not published as results.

## Shipped UX and community studies

PR #2 was merged with all checks passing and deployed as `3f3444f`. It adds four attributed X community case-study pages, editable quick starts, a single-input homepage, separate in-memory task drafts, inline validation/focus, mobile navigation improvements, and opt-in private research intake. Source-post verification is not experimental reproduction. The public OpenRouter canary receipt is diagnostic transport evidence, not a leaderboard entry.

The [production-browser canary](BROWSER_CANARY-2026-09-19.md) completed four successful calls across both task types and Arena/Compare modes, with $0.000164778 total provider-reported cost. The exported records passed Python validation and re-import into the production website. This proves the tested OpenRouter workflows, not general model quality or other provider availability. Private database submission/withdrawal remains a separate pending acceptance check.

## Verification

40 Python tests, 70 TypeScript unit tests, and 58 desktop/mobile Playwright tests passed locally for the contribution-enabled build. Production build and typecheck passed. These browser tests mock providers and intake; they do not prove production connectivity. Isolated PostgreSQL integrity tests and a 500-submission, 20-client synthetic load check passed, with exact capacity accounting; this is not an online throughput guarantee.

Supabase Pro and enabled Spend Cap were verified in the operator dashboard on September 19. Migration 004 is applied: 30-day receipts, 10,000/day admission ceiling, 100/IP/hour, 5 GiB active payload / 310,000 receipt limits, and a 6 GiB database-size admission stop. Every five minutes an active cron job purges expired rows. Private tables have RLS and deny anonymous/authenticated table access. Limits are safeguards, not an assurance that every maximum-size submission fits, nor an absolute hosting bill cap. See [data collection](DATA_COLLECTION.md).

GitGuardian incident 37449110 was inspected and classified as a test credential: it identified only the disposable PostgreSQL CI service password, not a cloud or model credential. CI now uses a per-run disposable value. Secret scanning remains enabled. GitHub Actions passed both application tests and the real PostgreSQL integrity job at revision `43edb0f`.

## Remaining release gates

- Private database submission/withdrawal verification before announcing public beta. The four-call production inference allowance is exhausted; no further model calls without a new explicit budget.
- Three-provider live acceptance, including billing/usage/version edge cases. Contract-only adapters are not evidence of live provider reliability.
- Operator-approved rate limiting and a hosting spend envelope before enabling relay. Account is on an existing Pro plan; no upgrade or paid firewall feature was enabled. Remaining quota and spend-alert configuration are not independently verified.
- Advanced selectable reasoning settings and per-case social preview images are follow-ups; v1 uses bounded provider-default reasoning and generic social metadata.
- First diagnostic research report, reviewed failures, grouped uncertainty, and measured model findings require a separately authorized experimental run. No fabricated leaderboard.

BYOK prevents platform-owned inference bills; it does not eliminate Vercel bandwidth, build, or function costs. Public preview is not the completion of the paid-canary/research phase.
