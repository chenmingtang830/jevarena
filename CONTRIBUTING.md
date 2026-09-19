# Contributing to JevArena

Use GitHub Discussions for Challenges, Failures, and Learnings. Submit reproducible cases through Issues or a PR. Never include API keys, private conversations, personal data, or content you lack permission to publish.

Export a case in the playground, preview every field, then attach the JSON to an issue. Large cases belong in attachments, not URL query strings. Put curated cases in shared/cases and validate against shared/contracts.schema.json. Include provenance, model aliases and actual versions (unknown is valid), prompt version, settings, network conditions, and evidence for the expected answer.

Code contributions are under Apache-2.0. By contributing original case text, labels, or notes you agree to license those original contributions under CC BY 4.0. Third-party datasets retain their original licenses: link their pinned sources instead of copying them into this repository without a license review. Do not relabel third-party material CC BY.

Community-submitted means untrusted browser data. Reproduced, reviewed, and disputed are separate evidence states assigned by maintainers after inspection. A preference vote is never a correctness label. A PR must explain any evidence-status change; self-reported browser status is not trusted.

Run `uv run python -m unittest discover -s tests` and, from web, `npm ci && npm test && npm run typecheck && npm run build`. Browser tests use synthetic responses, never paid APIs.
