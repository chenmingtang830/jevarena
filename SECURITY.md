# Security and privacy

Do not report vulnerabilities by including working secrets in public issues. Report a minimal redacted reproduction through GitHub private vulnerability reporting when enabled.

Keys are held only in tab memory, not localStorage, sessionStorage, cookies, URL fragments, downloads, or telemetry. The direct OpenRouter route sends the key to OpenRouter. The fixed relay temporarily receives a key in request memory and sends it only to its allowlisted provider. This repository contains no analytics or error-tracking integration. Provider retention policies still apply.

No application key vault or client-side key encryption is implemented: there is no
persisted user key to encrypt. HTTPS protects transport, not a compromised browser,
extension, page script, or provider. Do not describe tab memory as encrypted storage.

Optional research intake stores only explicitly previewed contribution records in
a private Supabase schema. Its service credential is server-only Vercel secret
configuration; it is not a user's model key. Browser database roles have no table
or RPC access. Server validation and atomic database quotas apply before intake.
Deletion receipts contain a bearer secret: save them privately, never publish them
with cases. The database stores only its hash. Research consent does not authorize
publication. See [data collection](docs/DATA_COLLECTION.md) for retention and limits.

Fragment sharing is publication to anyone holding the link, not private storage. Preview is mandatory. Free-text fields can themselves contain secrets: review and remove sensitive text before sharing. The share decoder limits compressed and expanded sizes and treats all imported evidence as community-submitted. React text rendering is used; imported HTML is never executed.

Relay production gate: enable JEVARENA_RELAY_ENABLED only after a site-level rate-limit/WAF policy and spend controls are verified. Process-local concurrency and throttling are additional safeguards, not distributed rate limiting. Turn the variable off and redeploy to disable the relay. No automatic inference retries. BYOK avoids platform model bills, not hosting or bandwidth charges.

Deployment acceptance must include production-domain CORS, genuine provider canaries under an explicitly approved budget, error redaction, desktop/mobile flow, and account-level usage alerts. Until then, provider contract tests do not prove real inference compatibility. Never claim this site is strictly double-blind: a BYOK user can inspect network requests.
