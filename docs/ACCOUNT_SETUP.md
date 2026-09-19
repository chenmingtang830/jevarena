# Optional email login and private history

Guest comparisons remain available without an account. Do not enable accounts
until the checklist below is complete. The website fails closed when auth is off.

Current release decision: guest-only. SMTP, live login and private history are
not enabled. The history migration is prepared, not applied to production.
`NEXT_PUBLIC_HISTORY_ENABLED` is also off in production so unfinished account
controls do not appear in the guest flow. CI enables this UI only for mocks.

The guest release includes a native key/cost dialog and a session-only,
versioned, initially unchecked Terms/Privacy acknowledgement. Opening or closing
the dialog, pressing Enter in the question or key field, and accepting the
notice never submit a model request. The explicit Start judging action is still
required. Research contribution and public sharing remain separate choices.

## Supabase / email setup

1. Apply the private-history migration after the existing research migrations.
   Run the history integrity SQL in an isolated test database, never production.
2. Configure production SMTP with an authorized sender and verified domain.
   Supabase's built-in delivery is for project-team testing, not public login.
   Keep email confirmation enabled. Set provider and Supabase sending limits
   appropriate to the approved budget; do not remove limits to handle a surge.
3. Set Supabase Auth Site URL to `https://jevarena-lab.vercel.app` and allow exactly
   `https://jevarena-lab.vercel.app/auth/callback` as a redirect URL. Do not add
   wildcard preview domains. The default email confirmation link must preserve
   the PKCE redirect; verify the actual email link on a test account.
4. Vercel **production-only** server variables: `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY` (the public project key, NOT the service-role key),
   `JEVARENA_SITE_URL=https://jevarena-lab.vercel.app`,
   `JEVARENA_AUTH_ENABLED=true` and `NEXT_PUBLIC_HISTORY_ENABLED=true`. Enable last, only after the DB, sender and
   auth-cookie/live acceptance tests pass. None of these grant history access
   without the verified user's session. Research uses its separate existing key.

## Acceptance checklist

- Explicit email request delivers a real one-time link; same-browser callback
  establishes a verified session. Used/expired links fail without leaking codes.
- The original experiment tab and its key remain in memory; nothing saves on login.
- Explicit Save privately stores one experiment; refresh and a separate signed-in
  device can retrieve it. API keys never appear in network save payloads, JSON,
  history rows or logs. Sign-out clears the auth session, not another tab's model key.
- Another account cannot read, list or delete the first account's data, including
  by directly calling the RPCs. Anonymous calls fail. Test expiry and quotas.
- Download works; explicit deletion removes the live row. Account-deletion requests
  are handled by the operator after verification; the FK cascades history deletion.
- Confirm the history cleanup cron runs and the operator understands the
  provider's backup retention. No claim of instantaneous backup erasure.

The code uses HTTP-only, SameSite=Lax auth cookies; secure cookies in production.
Only route handlers access Supabase, and `getUser()` verifies the session before
history access. Auth routes never use the service-role key. There is no browser
Supabase session/localStorage client and no model-key vault. Login emails and
server-side auth redirects must not be logged with bodies or query credentials.

Terms / Privacy operator: Richard Tang, richard@learnest.org (confirmed by owner).
The pages describe implementation, not a legal-compliance certification; obtain
appropriate legal review before relying on them for jurisdiction-specific duties.
