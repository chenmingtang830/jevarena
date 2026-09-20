# Contributing to JevArena

Choose the smallest useful path:

- [Submit a question](https://jevarena-lab.vercel.app/community/submit) for AI screening and possible publication.
- [Report a case](https://github.com/chenmingtang830/jevarena/issues/new?template=case.yml) with its source, model/version, settings, and answer evidence.
- [Report a bug](https://github.com/chenmingtang830/jevarena/issues/new?template=bug.yml).
- Open a focused pull request with tests.

Never include API keys, private conversations, personal data, or material you
cannot publish. A community vote is preference, not correctness. Keep
`community-submitted`, `reproduced`, `reviewed`, and `disputed` evidence
states distinct.

For case JSON, preview every field and run:

```sh
uv run jevjudge community validate case.json
```

For code changes, run:

```sh
uv run python -m unittest discover -s tests
cd web
npm ci
npm test
npm run build
npm run typecheck
CI=true npm run test:e2e
```

Browser tests use synthetic responses and never call paid models. All changes
require passing CI and maintainer review; see [the review gate](docs/REVIEW_GATE.md).

Code is Apache-2.0. Original case text, labels, and notes are contributed under
CC BY 4.0. Third-party data keeps its own license and attribution. See the
[data contract](docs/DATA_COLLECTION.md) and [community conduct](CODE_OF_CONDUCT.md).
