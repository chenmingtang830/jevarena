# Contribution and release gate

Configured on 2026-09-19 for `main`:

- Pull request required; at least one approving review.
- `CODEOWNERS` assigns every file to `@chenmingtang830`; code-owner review is required.
- New commits dismiss stale approvals; conversations must be resolved.
- GitHub Actions `test` must pass, and the branch must be current with main.
- Rules apply to administrators too; force pushes and deletions are disabled.
- All external fork contributors need maintainer approval before Actions runs.

Anyone can still suggest a case through an issue, discussion, or fork PR. These are intake, not accepted contributions. Only merge into main publishes code and curated cases. Preview deployments are untrusted previews; do not give them production secrets or real BYOK keys. CI receives no inference keys and makes no paid calls.

The initial CODEOWNERS file was bootstrapped before enabling protection. Subsequent implementation is delivered as an unmerged PR. Changing CODEOWNERS also requires review.

## Same-account limitation

Agents here authenticate to GitHub as `chenmingtang830`, the same account as the human owner. GitHub does not allow authors to approve their own pull request, and cannot distinguish a human action from an agent using that same credential. This PR therefore needs a separate trusted write-access reviewer before it can merge; no reviewer is added or access granted automatically. Do not disable protection or merge with an admin bypass to work around it. To mechanically distinguish future agent actions from the owner, provision a separate least-privilege bot identity through a separate explicit setup.

Repository settings can still be changed by an authorized administrator. Branch protection is an enforceable merge gate, not a claim that an owner-scoped credential is incapable of changing repository policy.
