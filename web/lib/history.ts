import { z } from "zod";
import { ChallengeSchema, RunRecordSchema, VoteSchema, modelInput } from "./contracts";

export const HISTORY_CONSENT_VERSION = "2026-09-19";
export const MAX_HISTORY_BYTES = 64 * 1024;
export const HistorySchema = z.strictObject({
  challenge: ChallengeSchema,
  runs: z.array(RunRecordSchema).max(20),
  vote: VoteSchema.optional(),
});
export type PrivateHistory = z.infer<typeof HistorySchema>;
const SaveSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  history: HistorySchema,
  consent: z.strictObject({ version: z.literal(HISTORY_CONSENT_VERSION), savePrivate: z.literal(true) }),
});
const SummarySchema = z.strictObject({ id: z.uuid(), title: z.string().max(160), language: z.string().max(40), kind: z.enum(["judgment", "comparison"]), createdAt: z.iso.datetime({ offset: true }), expiresAt: z.iso.datetime({ offset: true }) });
const DetailSchema = z.strictObject({ id: z.uuid(), history: HistorySchema, createdAt: z.iso.datetime({ offset: true }), expiresAt: z.iso.datetime({ offset: true }) });
const CursorSchema = z.strictObject({ createdAt: z.iso.datetime({ offset: true }), id: z.uuid() });
export type HistoryContext = {
  userId: string;
  client: { rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
};
export type HistoryContextProvider = () => Promise<HistoryContext | null>;
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", Vary: "Cookie" };
class HistoryError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
const invalid = () => new HistoryError(400, "INVALID", "Invalid history. Review the task, runs, and save consent.");
const unavailable = () => new HistoryError(503, "UNAVAILABLE", "Private history is unavailable. Keep a local export and try again later.");
const secretPattern = /(?:sk-or-v1-[A-Za-z0-9_-]{16,}|sk-ant-api[A-Za-z0-9_-]{16,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|sb_secret_[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_ -]?key|authorization|access[_ -]?token)\s*[=:]\s*["']?(?:Bearer\s+)?[A-Za-z0-9_.-]{20,})/i;

export async function validateHistory(value: unknown): Promise<PrivateHistory> {
  const parsed = HistorySchema.safeParse(value);
  if (!parsed.success) throw invalid();
  const history = parsed.data;
  const json = JSON.stringify(history);
  if (new TextEncoder().encode(JSON.stringify(history, null, 2)).length > MAX_HISTORY_BYTES) throw new HistoryError(413, "TOO_LARGE", "Private history is limited to 64 KiB. Export larger tasks locally.");
  if (secretPattern.test(json)) throw new HistoryError(400, "SENSITIVE_CONTENT", "Possible credential found. Remove secrets before saving.");
  const input = modelInput(history.challenge);
  const ids = new Set(input.options.map((option) => option.id));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input)))), (n) => n.toString(16).padStart(2, "0")).join("");
  if (history.challenge.expected !== undefined && !ids.has(history.challenge.expected)) throw invalid();
  const runIds = new Set<string>();
  for (const run of history.runs) {
    if (runIds.has(run.id) || run.challengeId !== history.challenge.id || run.challengeHash !== hash || (run.choice !== null && !ids.has(run.choice))) throw invalid();
    runIds.add(run.id);
    if (run.status !== "success" && (run.choice !== null || run.probabilities !== undefined || run.confidence !== undefined)) throw invalid();
    if (run.probabilities && (Object.keys(run.probabilities).length !== ids.size || Object.keys(run.probabilities).some((id) => !ids.has(id)))) throw invalid();
  }
  if (history.vote) {
    const [x, y] = history.vote.runIds;
    if (x === y || !runIds.has(x) || !runIds.has(y) || history.vote.runIds.some((id) => history.runs.find((run) => run.id === id)?.status !== "success")) throw invalid();
  }
  return history;
}

function checkOrigin(request: Request, mutation: boolean) {
  const origin = request.headers.get("origin");
  if ((mutation && origin !== new URL(request.url).origin) || (origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new HistoryError(403, "ORIGIN", "Same-origin requests required.");
  if (request.headers.has("authorization")) throw invalid();
}
async function authenticate(getContext: HistoryContextProvider) {
  const context = await getContext();
  if (!context || !z.uuid().safeParse(context.userId).success) throw new HistoryError(401, "AUTH_REQUIRED", "Sign in to save or read your private history.");
  return context;
}
async function boundedBody(request: Request): Promise<unknown> {
  const max = MAX_HISTORY_BYTES + 2048;
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) throw new HistoryError(415, "CONTENT_TYPE", "JSON required.");
  const encoding = request.headers.get("content-encoding");
  if (encoding && encoding !== "identity") throw invalid();
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > max)) throw new HistoryError(413, "TOO_LARGE", "Private history exceeds the size limit.");
  if (!request.body) throw invalid();
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => undefined); reject(new HistoryError(504, "TIMEOUT", "Save timed out. No automatic retry.")); }, 8_000); });
  const read = async () => {
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { void reader.cancel().catch(() => undefined); throw new HistoryError(413, "TOO_LARGE", "Private history exceeds the size limit."); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw invalid(); }
  };
  try { return await Promise.race([read(), timedOut]); }
  finally { clearTimeout(timer); reader.releaseLock(); }
}
async function rpc(context: HistoryContext, name: string, args: Record<string, unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { data, error } = await Promise.race([
      Promise.resolve(context.client.rpc(name, args)),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(unavailable()), 10_000); }),
    ]);
    if (error || !data || typeof data !== "object" || Array.isArray(data)) throw unavailable();
    const record = data as Record<string, unknown>;
    if (record.ok !== true) {
      if (record.code === "AUTH_REQUIRED") throw new HistoryError(401, "AUTH_REQUIRED", "Sign in to use private history.");
      if (record.code === "NOT_FOUND") throw new HistoryError(404, "NOT_FOUND", "Private history not found or expired.");
      if (record.code === "CONFLICT") throw new HistoryError(409, "CONFLICT", "This save ID already contains different content. Start a new save.");
      if (record.code === "CAPACITY") throw new HistoryError(429, "CAPACITY", "History storage is full. Delete older saves or export this task locally.");
      if (record.code === "INVALID") throw invalid();
      throw unavailable();
    }
    return record;
  } finally { clearTimeout(timer); }
}
function failed(error: unknown) {
  const safe = error instanceof HistoryError ? error : unavailable();
  return Response.json({ code: safe.code, error: safe.message }, { status: safe.status, headers });
}

export async function saveHistory(request: Request, getContext: HistoryContextProvider) {
  try {
    checkOrigin(request, true);
    const context = await authenticate(getContext);
    const parsed = SaveSchema.safeParse(await boundedBody(request));
    if (!parsed.success) throw invalid();
    const history = await validateHistory(parsed.data.history);
    const record = await rpc(context, "jevarena_history_save", { p_id: parsed.data.id, p_history: history, p_consent: parsed.data.consent });
    const detail = DetailSchema.safeParse(record.item);
    if (!detail.success || detail.data.id !== parsed.data.id.toLowerCase() || typeof record.duplicate !== "boolean") throw unavailable();
    return Response.json({ id: detail.data.id, createdAt: detail.data.createdAt, expiresAt: detail.data.expiresAt }, { status: record.duplicate ? 200 : 201, headers });
  } catch (error) { return failed(error); }
}
export async function listHistory(request: Request, getContext: HistoryContextProvider) {
  try {
    checkOrigin(request, false);
    const context = await authenticate(getContext);
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some((key) => !["limit", "before"].includes(key)) || query.getAll("limit").length > 1 || query.getAll("before").length > 1) throw invalid();
    const rawLimit = query.get("limit") ?? "20";
    if (!/^\d{1,2}$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 20) throw invalid();
    const limit = Number(rawLimit);
    let cursor: z.infer<typeof CursorSchema> | null = null;
    const before = query.get("before");
    if (before) {
      try {
        if (before.length > 256 || !/^[A-Za-z0-9_-]+$/.test(before)) throw invalid();
        cursor = CursorSchema.parse(JSON.parse(atob(before.replaceAll("-", "+").replaceAll("_", "/"))));
      } catch { throw invalid(); }
    }
    const record = await rpc(context, "jevarena_history_list", { p_limit: limit + 1, p_before: cursor?.createdAt ?? null, p_before_id: cursor?.id ?? null });
    const parsed = z.array(SummarySchema).max(21).safeParse(record.items);
    if (!parsed.success) throw unavailable();
    const items = parsed.data.slice(0, limit);
    const last = items.at(-1);
    const nextCursor = parsed.data.length > limit && last ? btoa(JSON.stringify({ createdAt: last.createdAt, id: last.id })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "") : null;
    return Response.json({ items, nextCursor }, { headers });
  } catch (error) { return failed(error); }
}
export async function readHistory(request: Request, id: string, getContext: HistoryContextProvider) {
  try {
    checkOrigin(request, false);
    const context = await authenticate(getContext);
    if (!z.uuid().safeParse(id).success) throw invalid();
    const record = await rpc(context, "jevarena_history_read", { p_id: id });
    const detail = DetailSchema.safeParse(record.item);
    if (!detail.success || detail.data.id !== id.toLowerCase()) throw unavailable();
    await validateHistory(detail.data.history);
    return Response.json(detail.data, { headers });
  } catch (error) { return failed(error); }
}
export async function deleteHistory(request: Request, id: string, getContext: HistoryContextProvider) {
  try {
    checkOrigin(request, true);
    const context = await authenticate(getContext);
    if (!z.uuid().safeParse(id).success) throw invalid();
    const record = await rpc(context, "jevarena_history_delete", { p_id: id });
    if (record.deleted !== true) throw unavailable();
    return Response.json({ deleted: true }, { headers });
  } catch (error) { return failed(error); }
}
