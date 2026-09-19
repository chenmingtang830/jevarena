# Contributing to JevArena

All code and accepted case contributions pass through a PR, successful CI, and owner review before merge. External fork workflows require maintainer approval. See [the review gate](docs/REVIEW_GATE.md) for exact enforcement and the same-account author limitation.

Use GitHub Discussions for Challenges, Failures, and Learnings. Submit reproducible cases through Issues or a PR. Never include API keys, private conversations, personal data, or content you lack permission to publish.

Export a case in the playground, preview every field, then attach the JSON to an issue. Large cases belong in attachments, not URL query strings. Validate cases with `uv run jevjudge community validate case.json`: this checks the shared schema plus task fingerprints, option IDs, run associations, and vote references. The JSON Schema alone cannot express all cross-record checks. The current template registry is `web/lib/cases.ts`. Include provenance, model aliases and actual versions (unknown is valid), prompt version, settings, network conditions, and evidence for the expected answer.

Optional private research submission is separate from public GitHub contribution. Its unchecked consent form sends only the previewed case, not your model API key, and supplies a deletion receipt. Research consent does not authorize publication. Deployment gates, retention, and withdrawal are described in [the collection contract](docs/DATA_COLLECTION.md). To inspect a downloaded case offline, use `uv run jevjudge community import case.json --out data/community/new-receipt`; import does not call models or promote the case into a benchmark.

Code contributions are under Apache-2.0. By contributing original case text, labels, or notes you agree to license those original contributions under CC BY 4.0. Third-party datasets retain their original licenses: link their pinned sources instead of copying them into this repository without a license review. Do not relabel third-party material CC BY.

Community-submitted means untrusted browser data. Reproduced, reviewed, and disputed are separate evidence states assigned by maintainers after inspection. A preference vote is never a correctness label. A PR must explain any evidence-status change; self-reported browser status is not trusted.

Run `uv run python -m unittest discover -s tests` and, from web, `npm ci && npm test && npm run typecheck && npm run build`. Browser tests use synthetic responses, never paid APIs.
