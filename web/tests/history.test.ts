import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { templates } from "../lib/cases";
import { modelInput, type RunRecord } from "../lib/contracts";
import { deleteHistory, listHistory, readHistory, saveHistory, validateHistory, type HistoryContext, type PrivateHistory } from "../lib/history";

const id = "30000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000001";
const createdAt = "2026-09-19T10:00:00+00:00";
const expiresAt = "2026-10-19T10:00:00+00:00";
const consent = { version: "2026-09-19", savePrivate: true };
async function history(): Promise<PrivateHistory> {
  const challenge = templates[0];
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(modelInput(challenge)))));
  const challengeHash = Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join("");
  const run: RunRecord = { schemaVersion: 1, id: "run-x", challengeId: challenge.id, challengeHash, provider: "openrouter", model: "typesafe/jev-1.13", resolvedModel: null, promptVersion: "v1", createdAt: "2026-09-19T10:00:00Z", choice: modelInput(challenge).options[0].id, usage: { inputTokens: null, outputTokens: null }, cost: { usd: null, basis: "unknown" }, latencyMs: 10, status: "success" };
  return { challenge, runs: [run, { ...run, id: "run-y" }], vote: { runIds: ["run-x", "run-y"], value: "both", revealedBeforeVote: false } };
}
function request(body?: unknown, extraHeaders: Record<string, string> = {}, query = "") { return new Request(`https://jevarena.example/api/history${query}`, { method: body ? "POST" : "GET", headers: { origin: "https://jevarena.example", "content-type": "application/json", ...extraHeaders }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
function context(data: unknown, error: unknown = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  const get = vi.fn(async (): Promise<HistoryContext> => ({ userId, client: { rpc } }));
  return { rpc, get };
}
async function body() { return { schemaVersion: 1, id, history: await history(), consent }; }
async function detail() { return { id, history: await history(), createdAt, expiresAt }; }
const summary = { id, title: "Test", language: "en", kind: "judgment", createdAt, expiresAt };
afterEach(() => vi.useRealTimers());

describe("private history payload", () => {
  it("preserves data without adding research consent, licensing, or publication state", async () => {
    const value = await history();
    expect(await validateHistory(value)).toEqual(value);
    expect(Object.keys(await validateHistory(value))).toEqual(["challenge", "runs", "vote"]);
  });
  it.each(["apiKey", "userId", "license", "status", "allowPublication"])("rejects forbidden field %s", async (key) => {
    await expect(validateHistory({ ...await history(), [key]: "forbidden" })).rejects.toThrow();
  });
  it("rejects nested credentials and recognizable secrets pasted into task text", async () => {
    const value = await history();
    await expect(validateHistory({ ...value, challenge: { ...value.challenge, apiKey: "secret" } })).rejects.toThrow();
    await expect(validateHistory({ ...value, challenge: { ...value.challenge, basis: `sk-or-v1-${"x".repeat(64)}` } })).rejects.toThrow("Possible credential");
  });
  it("rejects oversized payloads before storage", async () => {
    const value = { challenge: { schemaVersion: 1, id: "large", title: "Large", language: "en", kind: "comparison", prompt: "x".repeat(30_000), answer1: "y".repeat(30_000), answer2: "z".repeat(10_000) }, runs: [] };
    await expect(validateHistory(value)).rejects.toThrow("64 KiB");
  });
  it("checks fingerprints, option mappings, duplicate run IDs and vote linkage", async () => {
    const value = await history();
    for (const patch of [{ challengeHash: "bad" }, { challengeId: "different" }, { choice: "unknown" }, { probabilities: { unknown: 1 } }]) await expect(validateHistory({ ...value, runs: [{ ...value.runs[0], ...patch }, value.runs[1]] })).rejects.toThrow();
    await expect(validateHistory({ ...value, runs: [value.runs[0], value.runs[0]] })).rejects.toThrow();
    await expect(validateHistory({ ...value, vote: { ...value.vote, runIds: ["missing", "run-y"] } })).rejects.toThrow();
    await expect(validateHistory({ ...value, runs: [{ ...value.runs[0], status: "error", choice: null }, value.runs[1]] })).rejects.toThrow();
  });
});

describe("private history routes", () => {
  it("requires verified sign-in for save, list, detail and delete", async () => {
    const get = vi.fn(async () => null);
    expect((await saveHistory(request(await body()), get)).status).toBe(401);
    expect((await listHistory(request(), get)).status).toBe(401);
    expect((await readHistory(request(), id, get)).status).toBe(401);
    expect((await deleteHistory(request(), id, get)).status).toBe(401);
  });
  it("blocks cross-site mutations before auth/database calls", async () => {
    const { get, rpc } = context({});
    expect((await saveHistory(request(await body(), { origin: "https://evil.example" }), get)).status).toBe(403);
    expect((await deleteHistory(request(undefined, { origin: "https://evil.example" }), id, get)).status).toBe(403);
    expect(get).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("requires explicit private-save consent and rejects any owner override", async () => {
    const { get, rpc } = context({});
    const value = await body();
    for (const patch of [{ consent: { ...consent, savePrivate: false } }, { consent: { ...consent, allowResearch: true } }, { userId: "different" }]) expect((await saveHistory(request({ ...value, ...patch }), get)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("saves only allowlisted task data through the verified user's RPC, with no owner argument", async () => {
    const { get, rpc } = context({ ok: true, duplicate: false, item: await detail() });
    const value = await body();
    const response = await saveHistory(request(value), get);
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("jevarena_history_save", { p_id: id, p_history: value.history, p_consent: consent });
    expect(await response.json()).toEqual({ id, createdAt, expiresAt });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });
  it("returns duplicate saves without creating a new entry", async () => {
    const { get } = context({ ok: true, duplicate: true, item: await detail() });
    expect((await saveHistory(request(await body()), get)).status).toBe(200);
  });
  it("rejects too-large declared and streamed requests before RPC", async () => {
    const { get, rpc } = context({});
    expect((await saveHistory(request({}, { "content-length": "999999" }), get)).status).toBe(413);
    expect((await saveHistory(request({ content: "x".repeat(70_000) }), get)).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("times out stalled request bodies without saving", async () => {
    vi.useFakeTimers();
    const { get, rpc } = context({});
    const stalled = new Request("https://jevarena.example/api/history", { method: "POST", headers: { origin: "https://jevarena.example", "content-type": "application/json" }, body: new ReadableStream<Uint8Array>({ start() {} }), duplex: "half" } as RequestInit);
    const result = saveHistory(stalled, get);
    await vi.advanceTimersByTimeAsync(8001);
    expect((await result).status).toBe(504);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("paginates summaries with a bounded opaque cursor, not raw task data", async () => {
    const second = { ...summary, id: "30000000-0000-4000-8000-000000000002" };
    const { get, rpc } = context({ ok: true, items: [summary, second] });
    const response = await listHistory(request(undefined, {}, "?limit=1"), get);
    expect(response.status).toBe(200);
    const page = await response.json();
    expect(page.items).toEqual([summary]);
    expect(page.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(rpc).toHaveBeenCalledWith("jevarena_history_list", { p_limit: 2, p_before: null, p_before_id: null });
    const next = context({ ok: true, items: [] });
    expect((await listHistory(request(undefined, {}, `?before=${page.nextCursor}`), next.get)).status).toBe(200);
    expect(next.rpc).toHaveBeenCalledWith("jevarena_history_list", { p_limit: 21, p_before: createdAt, p_before_id: id });
  });
  it.each(["?limit=1000", "?limit=0", "?limit=1&limit=2", "?userId=other", "?before=invalid!"])("rejects unbounded or foreign-owner query %s", async (query) => {
    const { get, rpc } = context({});
    expect((await listHistory(request(undefined, {}, query), get)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("validates owned detail before returning it and exposes no unrelated fields", async () => {
    const item = await detail();
    const { get, rpc } = context({ ok: true, item });
    const response = await readHistory(request(), id, get);
    expect(await response.json()).toEqual(item);
    expect(rpc).toHaveBeenCalledWith("jevarena_history_read", { p_id: id });
    const malformed = context({ ok: true, item: { ...item, apiKey: "secret" } });
    expect((await readHistory(request(), id, malformed.get)).status).toBe(503);
  });
  it("deletes only through the current user RPC and requires explicit success", async () => {
    const { get, rpc } = context({ ok: true, deleted: true });
    expect(await (await deleteHistory(request(), id, get)).json()).toEqual({ deleted: true });
    expect(rpc).toHaveBeenCalledWith("jevarena_history_delete", { p_id: id });
    expect((await deleteHistory(request(), id, context({ ok: false, code: "NOT_FOUND" }).get)).status).toBe(404);
  });
  it.each([["NOT_FOUND", 404], ["CONFLICT", 409], ["CAPACITY", 429], ["AUTH_REQUIRED", 401]])("maps RPC %s safely", async (code, status) => {
    const { get } = context({ ok: false, code, privateInfo: "DO_NOT_ECHO" });
    const response = await saveHistory(request(await body()), get);
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("DO_NOT_ECHO");
  });
  it("sanitizes database failures and never retries automatically", async () => {
    const { get, rpc } = context(null, { message: "SECRET database details" });
    const response = await saveHistory(request(await body()), get);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("SECRET");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("history migration boundaries", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/202609190005_private_history.sql", import.meta.url), "utf8");
  it("requires auth.uid ownership in every user-facing RPC and revokes direct table access", () => {
    expect(sql.match(/owner_id uuid:=auth.uid\(\)/g)).toHaveLength(4);
    expect(sql).toContain("using((select auth.uid())=user_id and expires_at>now())");
    expect(sql).toContain("revoke all on jevarena_private.history,jevarena_private.history_capacity from public,anon,authenticated,service_role");
    expect(sql).toContain("to authenticated;");
  });
  it("bounds per-user/global capacity, keeps research separate and cleans up deleted accounts", () => {
    expect(sql).toContain("where user_id=owner_id)>=100");
    expect(sql).toContain("payload_bytes between 0 and 536870912");
    expect(sql).toContain("pg_database_size(current_database())>=6442450944");
    expect(sql).toContain("references auth.users(id) on delete cascade");
    expect(sql).toContain("cron.schedule('jevarena-history-retention'");
    expect(sql).not.toContain("insert into jevarena_private.contributions");
  });
});
