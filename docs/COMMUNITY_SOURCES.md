# Community source collection — 2026-09-19

The case library separates original playable templates from **editorial community references**. References are not RunRecords, correctness labels, or exact replay fixtures. Their authors' claims remain unverified by JevArena, even when the source post itself has been checked.

## Collection and cost

The user approved at most $1 of X API reads, separate from model inference. Public web search located candidate URLs; the configured app-only X post-reader then retrieved four posts and four author objects. No search API, pagination, retries, model calls, recharge or subscription was used. No credentials were copied into this repository.

At the [published X rates](https://docs.x.com/x-api/getting-started/pricing) of $0.005 per post and $0.010 per user, these resources estimate to **$0.06**. This is a resource-count estimate, not a billing receipt; the tool supplies no charge or account balance. Media metadata was returned for two posts, but their media bytes were neither downloaded nor republished. Collection stopped after these four calls, well below the authorized cap at published rates.

## Primary sources

| Author | Post | Editorial category |
| --- | --- | --- |
| [Malte Ubl / @cramforce](https://x.com/cramforce) | [Classifier evaluation](https://x.com/cramforce/status/2100269198727602468) | Author-reported test |
| [Guillermo Rauch / @rauchg](https://x.com/rauchg) | [Command safety reviewer](https://x.com/rauchg/status/2100307962262872105) | Author-reported test |
| [Cua / @trycua](https://x.com/trycua) | [Computer-use preview](https://x.com/trycua/status/2100649543079502213) | Demo |
| [Nathan Flurry / @NathanFlurry](https://x.com/NathanFlurry) | [Classifier framing](https://x.com/NathanFlurry/status/2100036101809619314) | Discussion |

The API supplied post IDs, author handles, timestamps and public metrics. The structured registry in `web/lib/community-cases.ts` retains those bounded fields alongside original editorial paraphrases, limitations and proposed tests. No raw private traces or full post-text archive is committed. The returned Nathan Flurry text ends mid-thought; only its visible framing is summarized.

Public search and third-party roundups served as discovery aids, not evidence for the entries. This is a convenience sample, not an exhaustive survey or a popularity ranking. View/like/repost counts are dated API snapshots, can change, and are not independent experimental evidence. Deleted or corrected sources should be removed or updated through a reviewable PR; authors can request this via Issues.

## Contribution rules

- Provide a concrete original post URL and author profile; verify that the post actually supports the summary.
- Retain the original rights of linked sources. JevArena's original-template CC-BY-4.0 license does not apply to linked X posts. Do not copy full posts or media without permission.
- Separate reported tests, demos and conceptual discussions. Document missing inputs, baselines, versions, sample sizes and measurement conditions.
- Do not invent a playable input from an unavailable dataset. An independently authored inspired challenge must say it is an adaptation, not the author's original experiment.
- Reproduction requires permitted inputs and a separately recorded actual run; source verification alone never upgrades a claim to reproduced or reviewed.
- Keep reference metadata out of prompts, benchmark aggregates and exported original-template contributions.
- Browsing these references makes no X API or inference calls. All paid collection is a bounded maintainer action; no recurring collection was configured.

New entries require the repository's existing review gate. This batch is submitted for owner review, not automatically merged or published to production.
