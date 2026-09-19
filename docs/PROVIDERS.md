# Provider contracts and relay operation

Verified 2026-09-19 using public official documentation, OpenAPI and model catalog responses. **No authenticated model canary has run.** Catalog `validation: contract-only` must not be represented as measured availability, accuracy, or a successful production integration. User BYOK runs may encounter account-specific access, quota, or provider changes.

| Provider | Jev endpoint | Comparator | Browser route |
| --- | --- | --- | --- |
| OpenRouter | `https://openrouter.ai/api/alpha/decisions` | `/api/v1/chat/completions` | Direct |
| TypeSafe | `https://api.typesafe.ai/v1/systemone` | None | Fixed relay |
| Vercel AI Gateway | `https://ai-gateway.vercel.sh/v4/ai/evaluation-model` | `/v1/chat/completions` | Fixed relay |

Sources: [OpenRouter OpenAPI](https://openrouter.ai/openapi.json), [TypeSafe HTTP reference](https://docs.typesafe.ai/api), [official Vercel evaluation adapter](https://github.com/vercel/ai/blob/main/packages/gateway/src/gateway-evaluation-model.ts), [official Vercel provider](https://github.com/vercel/ai/blob/main/packages/gateway/src/gateway-provider.ts).

All Jev requests use one shared state and one typed choice question. The gateway protocol uses version 4 evaluation headers and protocol version 0.0.1. Native and OpenRouter calls carry the model in JSON. TypeSafe uses the documented `jev-latest` alias; an alias is not an immutable version. Only response-reported model IDs become resolved versions; the Vercel evaluation response often does not return one, so it stays null. No SDK retries, fallback model requests, tools, or generated explanations are enabled by the application. Providers themselves may perform routing.

The exact `deepseek/deepseek-r1-0528` exists in the OpenRouter catalog. Vercel currently lists `deepseek/deepseek-r1`, not the same identifier, so its reasoning pool is deliberately absent. The frontend must not silently replace it. Chat completions are capped at 4,096 output tokens, including any provider-accounted reasoning. Truncation or refusal marks the attempt failed, preserving returned usage/cost. This cap can disadvantage reasoning models and must accompany comparisons.

## Pricing

Static standard-rate snapshot lives in `web/lib/catalog.ts` with per-model public source URLs. OpenRouter Jev pricing comes from its [endpoint catalog](https://openrouter.ai/api/v1/models/typesafe/jev-1.13/endpoints), because the general model endpoint can omit decision models. Vercel pricing is from its public `/v1/models`. TypeSafe price remains unknown. Cost prefers provider-reported USD; otherwise it estimates using measured token usage and the snapshot, or remains unknown. Preflight byte-based ranges are illustrative estimates, not hard budget limits or quotes. Caching, route and price changes can alter billing.

## Relay deployment

The relay is **off by default**. Set `JEVARENA_RELAY_ENABLED=true` only after configuring deployment-level Vercel Firewall limits for `/api/judge`, reviewing account usage limits and enabling available spend alerts. It has a four-call warm-instance concurrency ceiling and 30 requests/minute warm-instance ceiling. Those are **not global limits**; serverless instances can scale independently. If the account cannot enforce a suitable deployment-level policy, keep relay disabled and use OpenRouter direct.

The route requires same-origin JSON, bounds streamed requests to 96,000 bytes, permits only catalog models and fixed upstream hosts, forbids redirects, and applies a 55-second timeout with a 60-second function limit. It limits upstream JSON to 256,000 bytes. Responses are no-store. Turning the environment switch off and redeploying disables relay traffic. The Origin check is a browser CSRF boundary, not authentication or a substitute for global rate limiting.

Never configure default platform model credentials. Each request carries the user's key transiently. Code must not log bodies, authorization headers, prompts, responses, or upstream error messages. Disable request/body capture in any subsequently installed tracing service. A relay request exposes its key and task to this server and the chosen provider; direct requests expose them to the provider. The site does not promise that provider infrastructure does not log data. Keys remain page-memory-only in the UI. Cancellation cannot guarantee that provider computation or billing stops.

## Release validation

Keyless CORS preflights using origin `https://jevarena.vercel.app` on 2026-09-19: OpenRouter decision endpoint returned 204 with wildcard origin and required headers; TypeSafe returned 400 without allow-origin. Gateway returned 200 with origin allowed but omitted the required evaluation specification header from its allow-headers list. These justify OpenRouter direct and relay for the other providers; they do not prove authenticated calls succeed.

Official [WAF rate-limit documentation](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) says rules are available on all plans, but counters are per-region. Suggested initial rule: path equals `/api/judge`, method POST, fixed 60-second window, 20 requests per IP, action 429. Project Firewall > Configure > New Rule > Save > Review Changes > Publish. An IP-based rule does not cap aggregate site traffic. The [pricing page](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing) currently lists $0.50 per million allowed requests; inspect account allowances and the first-time pricing dialog before enabling. No billing feature was enabled by this implementation.

Run fixture tests first. Before claiming live support, validate authenticated requests from the deployed browser origin, one per adapter and selected comparator, under an explicitly approved small model budget. Confirm actual returned version, choice, probability semantics, usage and invoice behavior. No keyless preflight or fixture test proves account access. Do not report fixture latency or prices as benchmark results.
