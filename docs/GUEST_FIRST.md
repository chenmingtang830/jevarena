# Guest-first release

Update: the user's preferred composer homepage has been restored. The recorded
guest experience now lives at `/try`; old `/?example=...` links redirect there.
OAuth and manual key entry are mutually exclusive dialog views, not stacked forms.
The following describes the original guest-first implementation and evidence.

The homepage lets visitors guess and reveal two recorded OpenRouter canary
examples without an account, key, inference request, or submission. Measurements
are imported from the committed September 19 receipt. They are diagnostic local,
sequential runs, not a benchmark or live match. Guesses remain session-only.

`/play` retains editable tasks. Its connection dialog prioritizes OpenRouter's
official PKCE popup flow; manual keys are behind an explicit disclosure. PKCE
verifier, state, and returned API key remain in opener memory. Callback validation
requires the exact origin, popup source, state, and a five-minute lifetime; code
exchange is single-use, bounded, direct to OpenRouter, and never starts inference.
The callback URL necessarily contains a short-lived code and may appear in host
access logs. The API key never appears in URLs or persistent browser storage.
Disconnecting forgets the key locally; revocation is performed on OpenRouter.

Validation: 122 unit tests and 86 desktop/mobile E2E tests passed locally, including
a mocked popup redirect, real callback page, direct mocked code exchange, refresh
clearing, and no automatic inference. No real OpenRouter authorization or new paid
inference was performed. Live provider approval and popup policy compatibility
remain to be checked with a consenting account owner; mock tests are not that proof.

`/run-locally` documents loopback-only startup and opt-in local Gateway relay.
Public Gateway relay remains disabled: its Jev API CORS response omits the required
evaluation specification header. No WAF purchase or production relay was enabled.
Email login/private history remain disabled. Private requests use the operator's
email; public GitHub discussions must not include keys or deletion receipts.
