import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { templates } from "../lib/cases";
import { modelInput, type CaseContribution, type RunRecord } from "../lib/contracts";
import { CONTRIBUTION_CONSENT_VERSION, PUBLIC_CONTRIBUTION_CONSENT_VERSION, handleContribution, handleWithdrawal, MAX_CONTRIBUTION_BYTES, sha256, validateContribution } from "../lib/contributions";

const submissionId = "572d5a61-38a4-4df1-8a65-64d314d32a72";
const deletionToken = "a".repeat(43);
const env = { JEVARENA_COLLECTION_ENABLED: "true", VERCEL: "1", SUPABASE_URL: "https://mmwdowikyxwdqitootfs.supabase.co", SUPABASE_SERVICE_ROLE_KEY: `sb_secret_${"b".repeat(40)}`, JEVARENA_IP_HASH_SALT: "test-only-salt-".repeat(4) };
const consent = { version: CONTRIBUTION_CONSENT_VERSION, research: true, rights: true, reviewed: true, allowPublication: false };
async function contribution(): Promise<CaseContribution> {
  const challenge = templates[0];
  const options = modelInput(challenge).options;
  const base: RunRecord = { schemaVersion: 1, id: "run-x", challengeId: challenge.id, challengeHash: await sha256(JSON.stringify(modelInput(challenge))), provider: "openrouter", model: "typesafe/jev-1.13", resolvedModel: null, promptVersion: "test", createdAt: "2026-09-19T00:00:00Z", choice: options[0].id, usage: { inputTokens: null, outputTokens: null }, cost: { usd: null, basis: "unknown" }, latencyMs: 100, status: "success" };
  return { schemaVersion: 1, id: "test-contribution", challenge, runs: [base, { ...base, id: "run-y", model: "google/gemini-2.5-flash" }], vote: { runIds: ["run-x", "run-y"], value: "both", revealedBeforeVote: false }, license: "CC-BY-4.0", status: "community-submitted" };
}
async function submission() { return { schemaVersion: 1, submissionId, deletionToken, consent, contribution: await contribution() }; }
function request(value: unknown, headers: Record<string, string> = {}) { return new Request("https://jevarena.example/api/contributions", { method: "POST", headers: { "content-type": "application/json", origin: "https://jevarena.example", "x-vercel-forwarded-for": "203.0.113.9", ...headers }, body: JSON.stringify(value) }); }
function accepted(duplicate = false) { return Response.json({ ok: true, duplicate, receiptId: submissionId, receivedAt: "2026-09-19T00:00:00Z", expiresAt: "2026-10-19T00:00:00Z" }); }
afterEach(() => vi.useRealTimers());

describe("private research contribution integrity", () => {
  it("keeps human answers distinct from model preferences and validates option IDs", async () => {
    const value = await contribution();
    const answer = { optionId: modelInput(value.challenge).options[0].id, revealedBeforeAnswer: false, rationale: "My reasoning" };
    const parsed = await validateContribution({ ...value, runs: [], vote: undefined, humanAnswer: answer });
    expect(parsed.humanAnswer).toEqual(answer);
    expect(parsed.vote).toBeUndefined();
    await expect(validateContribution({ ...value, humanAnswer: { ...answer, optionId: "missing" } })).rejects.toThrow();
    await expect(validateContribution({ ...value, humanAnswer: { ...answer, rationale: "x".repeat(2001) } })).rejects.toThrow();
    await expect(validateContribution({ ...value, humanAnswer: { ...answer, apiKey: "secret" } })).rejects.toThrow();
  });
  it("preserves source attribution separately from original contribution licensing", async () => {
    const value = await contribution();
    const source = { url: "https://example.com/source", author: "Original author", license: "MIT", notice: "Original notice" };
    expect((await validateContribution({ ...value, sourceAttributions: [source] })).sourceAttributions).toEqual([source]);
    await expect(validateContribution({ ...value, sourceAttributions: [{ ...source, url: "javascript:alert(1)" }] })).rejects.toThrow();
  });
  it("validates a linked battle and forces untrusted community evidence", async () => {
    const value = await contribution();
    const parsed = await validateContribution({ ...value, status: "reviewed" });
    expect(parsed.status).toBe("community-submitted");
    expect(parsed.runs).toEqual(value.runs);
  });
  it("accepts original no-run task proposals without inventing measurements", async () => {
    const value = await contribution();
    expect((await validateContribution({ ...value, runs: [], vote: undefined })).runs).toEqual([]);
  });
  it.each(["apiKey", "api_key", "authorization", "upstreamUrl"])("rejects unknown credential/config field %s", async (field) => {
    await expect(validateContribution({ ...await contribution(), [field]: "do-not-store" })).rejects.toThrow();
  });
  it("rejects nested unknown fields and recognizable secrets in content", async () => {
    const value = await contribution();
    await expect(validateContribution({ ...value, runs: [{ ...value.runs[0], apiKey: "do-not-store" }] })).rejects.toThrow();
    await expect(validateContribution({ ...value, notes: `sk-or-v1-${"d".repeat(64)}` })).rejects.toThrow("Possible credential");
  });
  it("rejects incorrect task identity and input fingerprint", async () => {
    const value = await contribution();
    for (const patch of [{ challengeId: "different" }, { challengeHash: "f".repeat(64) }]) await expect(validateContribution({ ...value, runs: [{ ...value.runs[0], ...patch }] })).rejects.toThrow();
  });
  it("requires valid expected/selected option IDs and exact probability keys", async () => {
    const value = await contribution();
    await expect(validateContribution({ ...value, challenge: { ...value.challenge, expected: "unknown" } })).rejects.toThrow();
    await expect(validateContribution({ ...value, runs: [{ ...value.runs[0], choice: "unknown" }] })).rejects.toThrow();
    await expect(validateContribution({ ...value, runs: [{ ...value.runs[0], probabilities: { unknown: 1 } }] })).rejects.toThrow();
    const probabilities = Object.fromEntries(modelInput(value.challenge).options.map((o, i) => [o.id, i === 0 ? 1 : 0]));
    expect((await validateContribution({ ...value, runs: [{ ...value.runs[0], probabilities }, value.runs[1]] })).runs[0].probabilities).toEqual(probabilities);
  });
  it("bounds accepted payloads to the shared pretty-printed JSON export limit", async () => {
    const value = await contribution();
    const challenge = { schemaVersion: 1 as const, id: "large", kind: "comparison" as const, title: "Large", language: "en", prompt: "a".repeat(40_000), answer1: "b".repeat(40_000), answer2: "c".repeat(40_000) };
    await expect(validateContribution({ ...value, challenge, runs: [], vote: undefined, notes: "d".repeat(9_000) })).rejects.toThrow("shared JSON export");
  });
  it("rejects duplicate run IDs and forged vote references", async () => {
    const value = await contribution();
    await expect(validateContribution({ ...value, runs: [value.runs[0], value.runs[0]] })).rejects.toThrow();
    for (const runIds of [["run-x", "run-x"], ["run-x", "missing"]]) await expect(validateContribution({ ...value, vote: { ...value.vote, runIds } })).rejects.toThrow();
  });
  it("does not accept winning votes on incomplete or invalid runs", async () => {
    const value = await contribution();
    const bad = { ...value.runs[0], status: "error", choice: null };
    await expect(validateContribution({ ...value, runs: [bad, value.runs[1]] })).rejects.toThrow();
    await expect(validateContribution({ ...value, vote: undefined, runs: [{ ...bad, confidence: 0.8 }] })).rejects.toThrow();
    expect((await validateContribution({ ...value, vote: undefined, runs: [bad] })).runs[0].status).toBe("error");
  });
});

describe("contribution routes", () => {
  it("requires a separately enabled public candidate protocol, never upgrades legacy consent", async () => {
    const value = await submission();
    const publicConsent = { ...consent, version: PUBLIC_CONTRIBUTION_CONSENT_VERSION, allowPublication: true, publication: "after-review" };
    const fetcher = vi.fn().mockImplementation(() => accepted());
    expect((await handleContribution(request({ ...value, consent: publicConsent }), env, fetcher)).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await handleContribution(request({ ...value, consent: publicConsent }), { ...env, JEVARENA_PUBLIC_COLLECTION_ENABLED: "true" }, fetcher)).status).toBe(201);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.p_consent).toEqual(publicConsent);
    expect(body.p_payload.status).toBe("community-submitted");
    expect((await handleContribution(request({ ...value, consent: { ...publicConsent, publication: "immediate" } }), { ...env, JEVARENA_PUBLIC_COLLECTION_ENABLED: "true" }, fetcher)).status).toBe(400);
  });
  it("is disabled unless fully configured on Vercel", async () => {
    const fetcher = vi.fn();
    const value = await submission();
    for (const patch of [{ JEVARENA_COLLECTION_ENABLED: "false" }, { SUPABASE_SERVICE_ROLE_KEY: "" }, { JEVARENA_IP_HASH_SALT: "short" }, { VERCEL: "0" }, { SUPABASE_URL: "https://attacker.example" }, { SUPABASE_URL: "https://mmwdowikyxwdqitootfs.supabase.co/redirect" }]) expect((await handleContribution(request(value), { ...env, ...patch }, fetcher)).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires same-origin JSON with no authorization/key header", async () => {
    const fetcher = vi.fn();
    const value = await submission();
    expect((await handleContribution(request(value, { origin: "https://evil.example" }), env, fetcher)).status).toBe(403);
    expect((await handleContribution(request(value, { "content-type": "text/plain" }), env, fetcher)).status).toBe(415);
    expect((await handleContribution(request(value, { authorization: "Bearer do-not-store" }), env, fetcher)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires exact affirmative consent and private-only publication flag", async () => {
    const fetcher = vi.fn();
    const value = await submission();
    for (const patch of [{ research: false }, { rights: false }, { reviewed: false }, { allowPublication: true }, { version: "old" }]) expect((await handleContribution(request({ ...value, consent: { ...consent, ...patch } }), env, fetcher)).status).toBe(400);
    expect((await handleContribution(request({ ...value, apiKey: "not-allowed" }), env, fetcher)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("enforces declared and streamed size limits before a database request", async () => {
    const fetcher = vi.fn();
    expect((await handleContribution(request({}, { "content-length": String(MAX_CONTRIBUTION_BYTES + 1) }), env, fetcher)).status).toBe(413);
    expect((await handleContribution(request({ padding: "x".repeat(MAX_CONTRIBUTION_BYTES) }), env, fetcher)).status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("times out a stalled inbound stream without writing anything", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start() {} });
    const stalled = new Request("https://jevarena.example/api/contributions", { method: "POST", headers: { origin: "https://jevarena.example", "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
    const pending = handleContribution(stalled, env, fetcher);
    await vi.advanceTimersByTimeAsync(10_001);
    expect((await pending).status).toBe(504);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("stores only hashes for deletion token and IP; secret key goes only to fixed upstream", async () => {
    const fetcher = vi.fn(async () => accepted());
    const result = await handleContribution(request(await submission()), env, fetcher);
    expect(result.status).toBe(201);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${env.SUPABASE_URL}/rest/v1/rpc/jevarena_submit_contribution`);
    const body = JSON.parse(String(options.body));
    expect(body.p_deletion_token_hash).toBe(await sha256(deletionToken));
    expect(body.p_ip_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(String(options.body)).not.toContain(deletionToken);
    expect(String(options.body)).not.toContain("203.0.113.9");
    expect(String(options.body)).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
    expect(options.cache).toBe("no-store");
    expect(options.redirect).toBe("error");
    expect(options.headers).toEqual({ "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_ROLE_KEY });
    expect(await result.json()).toEqual({ receiptId: submissionId, status: "community-submitted", receivedAt: "2026-09-19T00:00:00Z", expiresAt: "2026-10-19T00:00:00Z", deletionToken });
    expect(result.headers.get("cache-control")).toContain("no-store");
  });
  it("fails closed without a trusted Vercel client IP", async () => {
    const fetcher = vi.fn();
    const value = await submission();
    expect((await handleContribution(request(value, { "x-vercel-forwarded-for": "" }), env, fetcher)).status).toBe(503);
    expect((await handleContribution(request(value, { "x-vercel-forwarded-for": "1.2.3.4, 5.6.7.8" }), env, fetcher)).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves identical idempotency hashes on manual retry", async () => {
    const fetcher = vi.fn(async () => accepted(true));
    const value = await submission();
    expect((await handleContribution(request(value), env, fetcher)).status).toBe(200);
    expect((await handleContribution(request(value), env, fetcher)).status).toBe(200);
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][1].body).toBe(calls[1][1].body);
  });
  it.each([["RATE_LIMIT", 429], ["CONFLICT", 409], ["GONE", 410], ["INVALID", 400]])("maps database %s safely without retry", async (code, status) => {
    const fetcher = vi.fn(async () => Response.json({ ok: false, code, privateError: env.SUPABASE_SERVICE_ROLE_KEY }));
    const result = await handleContribution(request(await submission()), env, fetcher);
    expect(result.status).toBe(status);
    expect(await result.text()).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("fails closed on upstream errors and never echoes sensitive upstream content", async () => {
    for (const fetcher of [vi.fn(async () => Response.json({ secret: env.SUPABASE_SERVICE_ROLE_KEY }, { status: 500 })), vi.fn(async () => { throw new Error(env.SUPABASE_SERVICE_ROLE_KEY); }), vi.fn(async () => Response.json({ ok: true, secret: env.SUPABASE_SERVICE_ROLE_KEY }))]) {
      const result = await handleContribution(request(await submission()), env, fetcher);
      expect(result.status).toBe(503);
      expect(await result.text()).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it("withdraws by hashed token and treats repeated deletion as success", async () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true, deleted: true }));
    const value = { receiptId: submissionId, deletionToken };
    for (let n = 0; n < 2; n++) expect(await (await handleWithdrawal(request(value), env, fetcher)).json()).toEqual({ deleted: true });
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][0]).toContain("jevarena_delete_contribution");
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ p_id: submissionId, p_deletion_token_hash: await sha256(deletionToken) });
    expect((await handleWithdrawal(request({ ...value, secret: "no" }), env, fetcher)).status).toBe(400);
  });
  it("does not report deletion when the database denies the bearer token", async () => {
    const result = await handleWithdrawal(request({ receiptId: submissionId, deletionToken }), env, vi.fn(async () => Response.json({ ok: false, code: "NOT_FOUND" })));
    expect(result.status).toBe(404);
  });
});

describe("migration guardrails (text checks; SQL is also exercised in isolated Postgres)", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/202609190001_private_contributions.sql", import.meta.url), "utf8");
  it("enables RLS on all intake tables and denies browser roles", () => {
    expect(sql.match(/enable row level security/g)).toHaveLength(3);
    expect(sql).toContain("revoke all on all tables in schema jevarena_private from public, anon, authenticated, service_role");
    expect(sql).toContain("grant execute on function public.jevarena_submit_contribution(uuid,jsonb,jsonb,text,text,text) to service_role");
    expect(sql).not.toContain("grant execute on function public.jevarena_submit_contribution(uuid,jsonb,jsonb,text,text,text) to anon");
  });
  it("uses atomic quotas, hard storage cap and bounded deletion tombstones", () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain(">= 1000");
    expect(sql).toContain(">= 200");
    expect(sql).toContain(">= 5");
    expect(sql).toContain("interval '30 days'");
    expect(sql).toContain("set payload = null");
    expect(sql).toContain("where expires_at <= now()");
  });
  it("replaces baseline caps with a bounded 30-day Pro profile and an actual five-minute scheduler", () => {
    const current = readFileSync(new URL("../../supabase/migrations/202609190004_pro_capacity.sql", import.meta.url), "utf8");
    expect(current).toContain("receipt_rows between 0 and 310000");
    expect(current).toContain("active_payload_bytes between 0 and 5368709120");
    expect(current).toContain("current_database_bytes := pg_database_size(current_database())");
    expect(current).toContain("current_database_bytes >= 6442450944");
    expect(current).toContain("storage_checked_at < now() - interval '15 minutes'");
    expect(current).toContain("perform cron.schedule('jevarena-private-retention', '*/5 * * * *'");
    expect(current).toContain("default now() + interval '30 days'");
    expect(current).not.toContain("pg_advisory_xact_lock");
    expect(current).toContain("purge_expired_contributions(100)");
    expect(current).toContain("purge_expired_contributions(1000)");
  });
});
