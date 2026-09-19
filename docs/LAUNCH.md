# JevArena public preview

An independent, open-source playground to find where Jev's judgments hold up—and where they fail.

## Try it

- [Ask your own question](https://jevarena-lab.vercel.app/): enter context and possible answers, connect OpenRouter, review the estimated cost, then compare Jev with another judge.
- [Try without a key](https://jevarena-lab.vercel.app/try): guess on recorded examples and reveal their source-reported results. This does not run a model.
- [Community examples](https://jevarena-lab.vercel.app/cases): five actual test inputs from Pooya Parsa's public Jev experiments, with original post, account and pinned data attribution.
- [Run locally](https://jevarena-lab.vercel.app/run-locally): inspect the code and run on your machine instead of entering a key on the hosted site.

Votes happen before model identities, latency and cost are revealed. Keys are held in tab memory and cleared on refresh, not saved to a server key vault. Providers still receive submitted tasks. Private research submission is optional and separate from public sharing.

## Help improve it

- [Contribute a reproducible case](https://github.com/chenmingtang830/jevarena/issues/new?template=case.yml). Include the original task, options, source, model/version, run settings and evidence for the answer. Redact credentials and private data.
- [Report a website bug](https://github.com/chenmingtang830/jevarena/issues/new?template=bug.yml).
- [Discuss challenges, failures and learnings](https://github.com/chenmingtang830/jevarena/discussions).
- Submit focused PRs with tests. All contributions require maintainer review; a submitted result does not automatically become a verified benchmark result.

## Preview boundaries

OpenRouter is the public live path. Vercel AI Gateway is local opt-in. Login is not enabled. Some selectable opponents are experimental and not live-tested. Community source observations are not our own reruns. Small canaries verify bounded workflows, not model superiority. There is no global ranking or unlimited traffic guarantee.

Code is Apache-2.0; original case contributions use CC BY 4.0; third-party content retains its original license. JevArena is not affiliated with Arena or the model providers. [Privacy](https://jevarena-lab.vercel.app/privacy) · [Security reporting](https://github.com/chenmingtang830/jevarena/security/advisories/new).

## X launch draft — not yet posted

> built JevArena to find where Jev gets judgments wrong.
>
> try real community questions without a key, or bring OpenRouter to compare judges. open source, public preview.
>
> bring your hardest cases + PRs:
> https://jevarena-lab.vercel.app
> https://github.com/chenmingtang830/jevarena

No claims of model superiority, zero infrastructure logging, independently reproduced community results, or guaranteed costs should be added without new evidence.
