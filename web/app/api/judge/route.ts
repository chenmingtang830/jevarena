import {
  executeUpstream,
  MAX_REQUEST_BYTES,
  validateRequest,
} from "../../../lib/providers";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};
const error = (status: number, message: string) =>
  Response.json({ error: message }, { status, headers });
// This bounds each warm instance only. Production also needs a Vercel Firewall rate-limit rule.
let active = 0;
let windowStarted = 0;
let requests = 0;
export async function POST(request: Request) {
  if (process.env.JEVARENA_RELAY_ENABLED !== "true")
    return error(
      503,
      "Relay disabled. Use OpenRouter direct or contact the operator.",
    );
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return error(403, "Same-origin requests required.");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return error(415, "JSON required.");
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES)
    return error(413, "Request too large.");
  const now = Date.now();
  if (now - windowStarted > 60_000) {
    windowStarted = now;
    requests = 0;
  }
  if (active >= 4 || requests >= 30)
    return error(429, "Relay busy. Try again later.");
  active++;
  requests++;
  try {
    if (!request.body) return error(400, "Request required.");
    const reader = request.body.getReader(),
      parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return error(413, "Request too large.");
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    let args;
    try {
      args = validateRequest(JSON.parse(new TextDecoder().decode(bytes)));
    } catch {
      return error(400, "Invalid judgment request.");
    }
    if (args.provider === "openrouter")
      return error(400, "OpenRouter uses browser direct calls.");
    return Response.json(
      await executeUpstream({ ...args, signal: request.signal }),
      { headers },
    );
  } catch {
    return error(502, "Relay failed. No automatic retry.");
  } finally {
    active--;
  }
}
