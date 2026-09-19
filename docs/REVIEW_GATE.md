# Contribution and release gate

Configured on 2026-09-19 for `main`:

- Pull request required; at least one approving review.
- `CODEOWNERS` assigns every file to `@chenmingtang830`; code-owner review is required.
- New commits dismiss stale approvals; conversations must be resolved.
- GitHub Actions `test` must pass, and the branch must be current with main.
- Administrators may bypass the merge gate at the owner's explicit request; ordinary contributors remain subject to it. Force pushes and deletions remain disabled by the branch policy.
- All external fork contributors need maintainer approval before Actions runs.

Anyone can still suggest a case through an issue, discussion, or fork PR. These are intake, not accepted contributions. Production publication requires the reviewed merge and a verified deployment. Untrusted fork previews must never receive production secrets or real BYOK keys. A maintainer-reviewed first-party preview may be used for a separately authorized, bounded canary; review its exact revision first and do not expose keys through CI. CI receives no inference keys and makes no paid calls.

The initial CODEOWNERS file was bootstrapped before enabling protection. Subsequent implementation is delivered through reviewable PRs. Changing CODEOWNERS also requires review.

## Same-account limitation

Agents here authenticate to GitHub as `chenmingtang830`, the same account as the human owner. GitHub does not allow authors to approve their own pull request, and cannot distinguish a human action from an agent using that same credential. The owner explicitly permits administrator bypass for this limitation; bypass permission alone is not an instruction to merge a particular PR. An explicit owner merge request, inspection of the diff and green checks, and a recorded reason are required before using the exception. Other contributors still need owner approval and CI. No additional reviewer is granted access automatically. To mechanically distinguish future agent actions from the owner, provision a separate least-privilege bot identity through a separate explicit setup.

Repository settings can still be changed by an authorized administrator. Branch protection is an enforceable merge gate, not a claim that an owner-scoped credential is incapable of changing repository policy.
