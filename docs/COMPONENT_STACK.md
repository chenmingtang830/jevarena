# Frontend component stack

The frontend uses source-installed shadcn/ui Button, Input, Textarea and
ScrollArea, plus Vercel AI Elements Suggestion for quick starts. NativeSelect is
adapted from the shadcn new-york-v4 registry. Button retains Radix Slot, forwarded
refs and class-variance-authority variants. These are not a wrapper-only claim.

Sources:
- https://ui.shadcn.com/docs/components/button
- https://ui.shadcn.com/r/styles/new-york-v4/native-select.json
- https://elements.ai-sdk.dev/components/suggestion

The registry source is customized to keep the existing DM Sans / IBM Plex Mono,
white / teal palette, focus indicators and button sizing. Native selects retain
mobile platform pickers. Native details/summary remains intentional for privacy
and disclosure; page layout and blind voting are application-specific React.

Quick starts only fill the local draft. They never send a model request.
Review still precedes explicit paid execution. Keys remain in tab memory.

## Transport boundary

This is a UI-component migration, not an AI SDK transport migration. The tested
provider adapters continue to use fetch. Jev uses its dedicated choice protocol,
not a chat protocol. Do not describe this release as using AI SDK generateText,
streamText or useChat. Any later transport migration must preserve no retries,
bounded bodies, cancellation, provider cost and version metadata, and run the
provider contract fixtures before a separately authorized paid canary.
