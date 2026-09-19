# Arena-inspired participation, Jev-specific evidence

Reference reviewed 2026-09-19: [Arena's official interaction overview](https://arena.ai/how-it-works) and [Battle Mode guide](https://help.arena.ai/articles/4489017547-how-to-use-battle-mode).

The transferable interaction is simple: supply a task, compare anonymous responses, vote, then reveal identity. Following the user's reference screenshot and [Arena's homepage](https://arena.ai/), the initial JevArena surface is a centered single composer, a compact toolbar and starter prompts. Configuration is progressively disclosed, and the results area appears only after a comparison starts. Arena branding and assets are not copied.

The simple composer is a yes/no/unsure judgment, not unrestricted chat. A deterministic prompt and fixed choices preserve Jev's decision interface without an extra model call to interpret the input. Custom choices and two-answer assessment remain available through the advanced editor. BYOK connection and cost review still precede paid execution.

### Browser-observed quick-start flow

On 2026-09-19, an interactive visit to Arena confirmed that choosing a starter
fills a prompt template, reveals privacy context, and offers editing and exit
controls. Switching from Battle to Side by Side retained the draft and exposed
model choices. No prompt was submitted during this inspection.

JevArena borrows contextual disclosure, editable starters and draft-preserving
mode changes, not Arena's data-use policy. Its notice must explain the current
provider transmission and session-only handling of keys and unsent drafts.
Optional private research intake is separately consented and deployment-gated;
see [the collection contract](DATA_COLLECTION.md). Explicit sharing/export and
research contribution are separate from running a comparison. Never imply default public disclosure, zero provider
retention, end-to-end encryption, or consent to later research calls.

## User-pinned Proofpress visual reference

The subsequent visual direction is the local Proofpress landing implementation,
inspected at `/Users/richardtang/Proofpress/web/landing/src/index.css` on 2026-09-19.
This is a typography and visual-system reference; the single-composer interaction
above remains intact. JevArena uses locally bundled DM Sans Variable for interface
and headings, plus IBM Plex Mono for identifiers, result values, and JSON. It
adopts Proofpress's white canvas, warm paper, dark ink, teal accent and fine rules,
with compact corners and no floating panel shadows.

The implemented source of truth is `web/app/globals.css` and the font imports in
`web/app/layout.tsx`; `DESIGN.md` and `.impeccable/design.json` document that built
state. Proofpress's marketing layout, product claims, governance terminology,
imagery, and logo are not transferred into JevArena. This visual revision makes
no change to BYOK execution, evidence status, or collection/backend behavior.

## What remains specific to JevArena

- Every battle includes Jev, which selects a judgment rather than generating a chat response.
- Users bring their own keys; browsing and guessing original cases need no key.
- Full-response speed, cost, confidence and identity remain hidden until voting. Failed attempts are not victories.
- Votes remain session-local unless explicitly contributed. No global leaderboard, aggregate score or public vote database is implied.
- X community case studies summarize real source posts, not experiments reproduced by JevArena. Author reports, missing evidence and proposed tests remain separate. Popularity is secondary metadata, not correctness.
- Switching task modes preserves separate drafts in memory only. Reloading still clears private session data and keys.

## Backend acceptance boundary

The merged [PR #1](https://github.com/chenmingtang830/jevarena/pull/1) records a real four-call local Node-to-Vercel Gateway canary on two public tasks: two Jev and two DeepSeek V4.1 Flash calls succeeded. Returned costs totaled $0.00013035; this is not a reconciled invoice or performance benchmark. The canary discovered cost/confidence/settings normalization fixes, now merged into main.

That local evidence does **not** validate authenticated OpenRouter browser calls, TypeSafe direct calls, deployed browser-to-relay requests, global relay throttling, all selected models, or account billing behavior. The relay stays disabled. A merge is not evidence that a particular deployed revision or live provider route passed acceptance; check the deployed commit and bounded test receipt separately.

The user subsequently authorized a separate four-call, $0.05 OpenRouter canary. It completed successfully from local Node, with returned cost $0.000161366; see [bounded acceptance evidence](OPENROUTER_CANARY-2026-09-19.md). Those two original four-call approvals are exhausted. Later browser acceptance requires its own explicit authorization and receipt; this reference document grants no inference budget.
