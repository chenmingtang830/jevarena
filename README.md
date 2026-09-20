# JevArena

JevArena is an open-source arena for testing **Jev against another judge**.
Ask a question, choose possible answers and an opponent, then vote before the
models, speed, and cost are revealed.

[Open JevArena](https://jevarena-lab.vercel.app/) ·
[Try examples](https://jevarena-lab.vercel.app/try) ·
[Browse community questions](https://jevarena-lab.vercel.app/community) ·
[Submit a question](https://jevarena-lab.vercel.app/community/submit)

## How it works

1. **Ask** — enter a question and its possible answers, or start from an example.
2. **Choose** — connect OpenRouter and select any supported model to face Jev.
3. **Judge** — compare the two hidden decisions, then vote to reveal identity,
   latency, cost, and available confidence data.
4. **Contribute** — opt out before submitting if you do not want your question,
   result, and vote sent for community screening.

Every live battle includes Jev. A vote records preference, not verified
correctness. Community questions are AI-screened before publication and remain
unverified until independently reviewed.

## Keys and privacy

**JevArena does not save your model API key.** The key stays in the current
tab's memory and disappears on refresh. OpenRouter calls go directly from the
browser to OpenRouter. Use a dedicated key with a small provider-side limit, or
[run locally](https://jevarena-lab.vercel.app/run-locally).

Questions and answers are sent to the selected providers only when you start a
run. Public contribution is a separate, visible choice. Do not submit secrets,
private conversations, or sensitive personal information. Read the
[Privacy Policy](https://jevarena-lab.vercel.app/privacy) and
[Security Policy](SECURITY.md).

## Run the website

```sh
cd web
npm ci
npm run dev
```

```sh
npm run typecheck
npm test
npm run build
CI=true npm run test:e2e
```

Public live comparisons use OpenRouter. Vercel AI Gateway is available for
local use and remains disabled on the hosted site pending its production relay
gate. Browser tests use synthetic responses and never spend model credits.

## Run JevJudge-Bench

The Python package is the reproducible research harness behind the project. It
transforms pinned JudgeBench, RM-Bench, and RewardBench 2 data into one
diagnostic pairwise protocol; its scores are **not** the upstream leaderboards.

```sh
uv sync
uv run jevjudge fetch
uv run jevjudge prepare --groups-per-domain 2 --partition test --out data/pilot.jsonl
uv run jevjudge run --data data/pilot.jsonl --config configs/mock.json --out runs/smoke
uv run jevjudge report runs/smoke
```

Mock output is marked `MOCK / PIPELINE TEST`. Read [PROTOCOL.md](PROTOCOL.md)
before making model claims and [RESEARCH_PLAN.md](RESEARCH_PLAN.md) before paid
runs. Actual runs require an explicit call and cost limit; the runner has no
hidden retries.

## Contribute

- [Submit a community question](https://jevarena-lab.vercel.app/community/submit)
- [Report a reproducible case](https://github.com/chenmingtang830/jevarena/issues/new?template=case.yml)
- [Report a bug](https://github.com/chenmingtang830/jevarena/issues/new?template=bug.yml)
- [Join Discussions](https://github.com/chenmingtang830/jevarena/discussions)

See [CONTRIBUTING.md](CONTRIBUTING.md) for tests, evidence states, and licensing.
Code is Apache-2.0. Original case contributions use CC BY 4.0; third-party
material keeps its original license and attribution.

Maintained by [Richard Tang](https://x.com/richardt830). JevArena is independent
and is not affiliated with Arena, TypeSafe, or the model providers.

## Maintainer notes

Provider behavior, release gates, data handling, and canary evidence live in
[`docs/`](docs/) instead of the product introduction. The project-scoped
Supabase MCP in `.mcp.json` is read-only; production changes remain migration-led.
