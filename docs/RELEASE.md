# Public preview — 2026-09-19

Production: https://jevarena-lab.vercel.app

Repository: https://github.com/chenmingtang830/jevarena

The requested `jevarena.vercel.app` and `jev-arena.vercel.app` aliases were already in use. `jevarena-lab.vercel.app` and the automatically assigned `jevarena-three.vercel.app` are verified domains on this project. Main-branch pushes deploy automatically; pull requests receive Vercel previews. The initial deployment is retained for rollback: `dpl_GAmPrYCeaaPA5tfrEmv2zopjv1xm`.

## Delivered

Two text input modes; Arena and explicit Compare; randomized X/Y; parallel completion barrier; vote then identity/latency/cost reveal; manual cancellation, repeat and swapped-order comparison; attempt history in memory; language field; price estimates and sources; six original templates; case guessing and replay; bounded fragment/JSON sharing and browser PNG generation; GitHub contribution workflow and three discussion categories; Apache-2.0 code license; shared TS/Python contracts and scoring rubric.

OpenRouter is browser-direct. TypeSafe and Vercel adapters have offline contract coverage but their relay is disabled in this deployment. All three are explicitly experimental: no authenticated inference canary has been run, and no model-quality conclusion is supported. Public cases contain no measured runs. Browser E2E responses are synthetic and not published as results.

## Verification

24 Python tests, 33 TypeScript unit tests, and 10 desktop/mobile Playwright tests passed locally. Production build passed. HTTP checks confirm public page access and the relay kill switch. GitHub Actions repeats all suites on each push. The independent frontend reviewer identified result-focus and wordmark-spacing corrections, implemented before final handoff.

## Remaining release gates

- Explicit inference budget and credentials for a real production-domain canary. Never infer authorization from deployment permission.
- Three-provider live acceptance, including billing/usage/version edge cases. Contract-only adapters are not evidence of live provider reliability.
- Operator-approved rate limiting and a hosting spend envelope before enabling relay. Account is on an existing Pro plan; no upgrade or paid firewall feature was enabled. Remaining quota and spend-alert configuration are not independently verified.
- Advanced selectable reasoning settings and per-case social preview images are follow-ups; v1 uses bounded provider-default reasoning and generic social metadata.
- First diagnostic research report, reviewed failures, grouped uncertainty, and measured model findings require a separately authorized experimental run. No fabricated leaderboard.

BYOK prevents platform-owned inference bills; it does not eliminate Vercel bandwidth, build, or function costs. Public preview is not the completion of the paid-canary/research phase.
