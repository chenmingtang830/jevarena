import { z } from "zod";
import { CaseContributionSchema, modelInput, type CaseContribution } from "./contracts";
import { MAX_SHARE_BYTES } from "./sharing";

export const CONTRIBUTION_CONSENT_VERSION = "2026-09-19";
export const PUBLIC_CONTRIBUTION_CONSENT_VERSION = "2026-09-19-public-v1";
export const MAX_CONTRIBUTION_BYTES = 128 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const SUPABASE_TIMEOUT_MS = 8_000;
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const ContributionSubmissionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  submissionId: z.uuid(),
  deletionToken: token,
  consent: z.union([z.strictObject({
    version: z.literal(CONTRIBUTION_CONSENT_VERSION),
    research: z.literal(true),
    rights: z.literal(true),
    reviewed: z.literal(true),
    allowPublication: z.literal(false),
  }), z.strictObject({
    version: z.literal(PUBLIC_CONTRIBUTION_CONSENT_VERSION),
    research: z.literal(true),
    rights: z.literal(true),
    reviewed: z.literal(true),
    allowPublication: z.literal(true),
    publication: z.literal("after-review"),
  }), z.strictObject({
    version: z.literal("2026-09-19-auto-review-v1"), research:z.literal(true),rights:z.literal(true),reviewed:z.literal(true),
    allowPublication:z.literal(true),publication:z.literal("after-ai-review"),automatedReview:z.literal(true),reviewProvider:z.literal("vercel"),
  })]),
  contribution: CaseContributionSchema,
});
const WithdrawalSchema = z.strictObject({ receiptId: z.uuid(), deletionToken: token });
type Environment = Record<string, string | undefined>;
type Fetcher = typeof fetch;

class IntakeError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
const invalid = () => new IntakeError(400, "INVALID", "Invalid contribution. Check the task, linked runs, and consent.");
const unavailable = () => new IntakeError(503, "UNAVAILABLE", "Research collection is unavailable. Keep your receipt and try again later.");
const responseHeaders = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableJSON(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
// Strict objects reject credential fields; this additionally catches common keys
// accidentally pasted into permitted text. It is not a general secret detector.
const recognizableSecret = /(?:sk-or-v1-[A-Za-z0-9_-]{16,}|sk-ant-api[A-Za-z0-9_-]{16,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|sb_secret_[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_ -]?key|authorization|access[_ -]?token)\s*[=:]\s*["']?(?:Bearer\s+)?[A-Za-z0-9_.-]{20,})/i;

export async function validateContribution(value: unknown): Promise<CaseContribution> {
  const parsed = CaseContributionSchema.safeParse(value);
  if (!parsed.success) throw invalid();
  const contribution = { ...parsed.data, status: "community-submitted" as const };
  if (new TextEncoder().encode(JSON.stringify(contribution, null, 2)).length > MAX_SHARE_BYTES) throw new IntakeError(413, "TOO_LARGE", "Contribution exceeds the shared JSON export size limit.");
  if (recognizableSecret.test(JSON.stringify(contribution))) throw new IntakeError(400, "SENSITIVE_CONTENT", "Possible credential found. Remove secrets before contributing.");
  const input = modelInput(contribution.challenge);
  const options = new Set(input.options.map((option) => option.id));
  const hash = await sha256(JSON.stringify(input));
  const ids = new Set<string>();
  if (contribution.challenge.expected !== undefined && !options.has(contribution.challenge.expected)) throw invalid();
  if (contribution.humanAnswer && !options.has(contribution.humanAnswer.optionId)) throw invalid();
  for (const run of contribution.runs) {
    if (ids.has(run.id) || run.challengeId !== contribution.challenge.id || run.challengeHash !== hash) throw invalid();
    ids.add(run.id);
    if (run.choice !== null && !options.has(run.choice)) throw invalid();
    if (run.status !== "success" && (run.choice !== null || run.probabilities !== undefined || run.confidence !== undefined)) throw invalid();
    if (run.probabilities !== undefined && (Object.keys(run.probabilities).length !== options.size || Object.keys(run.probabilities).some((id) => !options.has(id)))) throw invalid();
  }
  if (contribution.vote) {
    const [x, y] = contribution.vote.runIds;
    if (x === y || !ids.has(x) || !ids.has(y)) throw invalid();
    if (contribution.vote.runIds.some((id) => contribution.runs.find((run) => run.id === id)?.status !== "success")) throw invalid();
  }
  return contribution;
}

function settings(env: Environment) {
  if (env.JEVARENA_COLLECTION_ENABLED !== "true" || env.VERCEL !== "1") throw unavailable();
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const salt = env.JEVARENA_IP_HASH_SALT;
  if (!key || key.length < 32 || /\s/.test(key) || !salt || salt.length < 32) throw unavailable();
  let url: URL;
  try { url = new URL(env.SUPABASE_URL ?? ""); } catch { throw unavailable(); }
  if (url.protocol !== "https:" || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) || url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw unavailable();
  return { url: url.origin, key, salt };
}

function checkRequest(request: Request, limit: number) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new IntakeError(403, "ORIGIN", "Same-origin requests required.");
  if (request.headers.has("authorization")) throw invalid();
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) throw new IntakeError(415, "CONTENT_TYPE", "JSON required.");
  if (request.headers.has("content-encoding") && request.headers.get("content-encoding") !== "identity") throw invalid();
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) throw new IntakeError(413, "TOO_LARGE", "Contribution exceeds the size limit.");
}

async function readBounded(stream: ReadableStream<Uint8Array> | null, limit: number, timeoutMs: number): Promise<unknown> {
  if (!stream) throw invalid();
  const reader = stream.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      void reader.cancel().catch(() => undefined);
      reject(new IntakeError(504, "TIMEOUT", "Request timed out. No automatic retry."));
    }, timeoutMs);
  });
  const read = async () => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (timedOut) throw new IntakeError(504, "TIMEOUT", "Request timed out. No automatic retry.");
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        void reader.cancel().catch(() => undefined);
        throw new IntakeError(413, "TOO_LARGE", "Contribution exceeds the size limit.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw invalid(); }
  };
  try { return await Promise.race([read(), timeout]); }
  finally { clearTimeout(timer); reader.releaseLock(); }
}

async function rpc(config: ReturnType<typeof settings>, name: "jevarena_submit_contribution" | "jevarena_delete_contribution", body: Record<string, unknown>, fetcher: Fetcher): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: config.key };
  // New Supabase secret keys are not JWTs. Only legacy service-role JWTs use Bearer.
  if (!config.key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${config.key}`;
  let result: Response;
  try {
    result = await fetcher(`${config.url}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS) });
  } catch { throw unavailable(); }
  if (!result.ok) { void result.body?.cancel().catch(() => undefined); throw unavailable(); }
  let data: unknown;
  try { data = await readBounded(result.body, 4096, SUPABASE_TIMEOUT_MS); } catch { throw unavailable(); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw unavailable();
  const record = data as Record<string, unknown>;
  if (record.ok !== true) {
    switch (record.code) {
      case "RATE_LIMIT": throw new IntakeError(429, "RATE_LIMIT", "Collection capacity reached. Keep your receipt and try later.");
      case "CONFLICT": throw new IntakeError(409, "CONFLICT", "This receipt belongs to a different submission. Do not reuse it for edited content.");
      case "GONE": throw new IntakeError(410, "WITHDRAWN", "This contribution was withdrawn and cannot be resubmitted with the same receipt.");
      case "NOT_FOUND": throw new IntakeError(404, "NOT_FOUND", "Receipt not found or token incorrect. If submission is still in flight, wait and retry withdrawal with the same receipt.");
      case "INVALID": throw invalid();
      default: throw unavailable();
    }
  }
  return record;
}

function errorResponse(error: unknown) {
  const safe = error instanceof IntakeError ? error : unavailable();
  return Response.json({ error: safe.message, code: safe.code }, { status: safe.status, headers: responseHeaders });
}

export async function handleContribution(request: Request, env: Environment = process.env, fetcher: Fetcher = fetch): Promise<Response> {
  try {
    const config = settings(env);
    checkRequest(request, MAX_CONTRIBUTION_BYTES);
    const parsed = ContributionSubmissionSchema.safeParse(await readBounded(request.body, MAX_CONTRIBUTION_BYTES, REQUEST_TIMEOUT_MS));
    if (!parsed.success) throw invalid();
    const { submissionId, deletionToken, consent } = parsed.data;
    // Enable only after the database accepts the separately versioned consent.
    if (consent.allowPublication && env.JEVARENA_PUBLIC_COLLECTION_ENABLED !== "true") throw unavailable();
    const contribution = await validateContribution(parsed.data.contribution);
    // This deployment is Vercel-only: never trust arbitrary forwarded headers on
    // a directly reachable local/custom server. No plaintext IP reaches Supabase.
    const ip = request.headers.get("x-vercel-forwarded-for");
    if (!ip || ip.length > 64 || !/^[0-9a-fA-F:.]+$/.test(ip)) throw unavailable();
    const [payloadHash, deletionHash, ipHash] = await Promise.all([
      sha256(stableJSON({ contribution, consent })),
      sha256(deletionToken),
      sha256(`jevarena-ip-v1\0${config.salt}\0${ip}`),
    ]);
    const record = await rpc(config, "jevarena_submit_contribution", { p_id: submissionId, p_payload: contribution, p_consent: consent, p_payload_hash: payloadHash, p_deletion_token_hash: deletionHash, p_ip_hash: ipHash }, fetcher);
    if (record.receiptId !== submissionId || typeof record.receivedAt !== "string" || !Number.isFinite(Date.parse(record.receivedAt)) || typeof record.expiresAt !== "string" || !Number.isFinite(Date.parse(record.expiresAt)) || typeof record.duplicate !== "boolean") throw unavailable();
    return Response.json({ receiptId: submissionId, status: "community-submitted", receivedAt: record.receivedAt, expiresAt: record.expiresAt, deletionToken }, { status: record.duplicate ? 200 : 201, headers: responseHeaders });
  } catch (error) { return errorResponse(error); }
}

export async function handleWithdrawal(request: Request, env: Environment = process.env, fetcher: Fetcher = fetch): Promise<Response> {
  try {
    const config = settings(env);
    checkRequest(request, 1024);
    const parsed = WithdrawalSchema.safeParse(await readBounded(request.body, 1024, REQUEST_TIMEOUT_MS));
    if (!parsed.success) throw invalid();
    const record = await rpc(config, "jevarena_delete_contribution", { p_id: parsed.data.receiptId, p_deletion_token_hash: await sha256(parsed.data.deletionToken) }, fetcher);
    if (record.deleted !== true) throw unavailable();
    return Response.json({ deleted: true }, { headers: responseHeaders });
  } catch (error) { return errorResponse(error); }
}
