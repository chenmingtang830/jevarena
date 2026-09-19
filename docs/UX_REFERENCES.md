# Arena-inspired participation, Jev-specific evidence

Reference reviewed 2026-09-19: [Arena's official interaction overview](https://arena.ai/how-it-works) and [Battle Mode guide](https://help.arena.ai/articles/4489017547-how-to-use-battle-mode).

The transferable interaction is simple: supply a task, compare anonymous responses, vote, then reveal identity. Following the user's reference screenshot and [Arena's homepage](https://arena.ai/), the initial JevArena surface is a centered single composer, a compact toolbar and starter prompts. Configuration is progressively disclosed, and the results area appears only after a comparison starts. Arena branding and assets are not copied.

The simple composer is a yes/no/unsure judgment, not unrestricted chat. A deterministic prompt and fixed choices preserve Jev's decision interface without an extra model call to interpret the input. Custom choices and two-answer assessment remain available through the advanced editor. BYOK connection and cost review still precede paid execution.

## What remains specific to JevArena

- Every battle includes Jev, which selects a judgment rather than generating a chat response.
- Users bring their own keys; browsing and guessing original cases need no key.
- Full-response speed, cost, confidence and identity remain hidden until voting. Failed attempts are not victories.
- Votes remain session-local unless explicitly contributed. No global leaderboard, aggregate score or public vote database is implied.
- X community case studies summarize real source posts, not experiments reproduced by JevArena. Author reports, missing evidence and proposed tests remain separate. Popularity is secondary metadata, not correctness.
- Switching task modes preserves separate drafts in memory only. Reloading still clears private session data and keys.

## Backend acceptance boundary

The existing [PR #1](https://github.com/chenmingtang830/jevarena/pull/1) records a real four-call local Node-to-Vercel Gateway canary on two public tasks: two Jev and two DeepSeek V4.1 Flash calls succeeded. Returned costs totaled $0.00013035; this is not a reconciled invoice or performance benchmark. The canary discovered cost/confidence/settings normalization fixes, also in that PR.

That evidence does **not** validate authenticated OpenRouter browser calls, TypeSafe direct calls, deployed browser-to-relay requests, global relay throttling, all selected models, or account billing behavior. The relay stays disabled. UI and community work does not approve or merge PR #1; it must not be described as having shipped its fixes.

The user subsequently authorized a separate four-call, $0.05 OpenRouter canary. It completed successfully from local Node, with returned cost $0.000161366; see [bounded acceptance evidence](OPENROUTER_CANARY-2026-09-19.md). Both four-call approvals are now exhausted. No more model inference is authorized by this revision.
