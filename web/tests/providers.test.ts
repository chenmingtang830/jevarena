import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRequest,
  executeJudge,
  executeUpstream,
  normalizeResponse,
  validateRequest,
} from "../lib/providers";
import { getModels, getJevModel } from "../lib/catalog";
import {
  RunRecordSchema,
  type Challenge,
  type RunRecord,
} from "../lib/contracts";
import { POST } from "../app/api/judge/route";

const challenge: Challenge = {
  schemaVersion: 1,
  id: "test",
  title: "Test",
  kind: "judgment",
  language: "en",
  content: "2+2=4",
  question: "Correct?",
  options: [
    { id: "yes", label: "Correct" },
    { id: "no", label: "Incorrect" },
  ],
  expected: "yes",
  basis: "PRIVATE_REFERENCE",
};
const args = {
  provider: "openrouter" as const,
  model: "typesafe/jev-1.13",
  apiKey: "test-key-not-real",
  challenge,
};
const base: RunRecord = {
  schemaVersion: 1,
  id: "run",
  challengeId: "test",
  challengeHash: "hash",
  provider: "openrouter",
  model: args.model,
  resolvedModel: null,
  promptVersion: "v1",
  createdAt: new Date().toISOString(),
  choice: null,
  usage: { inputTokens: null, outputTokens: null },
  cost: { usd: null, basis: "unknown" },
  latencyMs: 2,
  status: "error",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("fixed provider contracts", () => {
  it("preserves actual Gateway zero cost and independent TypeSafe confidence", () => {
    const run = normalizeResponse(
      {
        answers: {
          judgment: { choice: "yes", probabilities: { yes: 1, no: 0 } },
        },
        usage: { inputTokens: 457, outputTokens: 43 },
        providerMetadata: {
          gateway: { cost: "0", marketCost: "0.000019194" },
          typesafe: { confidence: { judgment: 0.91 } },
        },
      },
      { ...args, provider: "vercel", model: "typesafe-ai/jev" },
      base,
    );
    expect(run.cost).toEqual({ usd: 0, basis: "provider" });
    expect(run.confidence).toBe(0.91);
    expect(run.probabilities?.yes).toBe(1);
  });
  it("does not interpret malformed Gateway money as free and preserves zero confidence", () => {
    for (const cost of ["", "NaN", "-1", "Infinity", null]) {
      const run = normalizeResponse(
        {
          answers: { judgment: { choice: "yes" } },
          usage: { inputTokens: 10, outputTokens: 0 },
          providerMetadata: {
            gateway: { cost },
            typesafe: { confidence: { judgment: 0 } },
          },
        },
        { ...args, provider: "vercel", model: "typesafe-ai/jev" },
        base,
      );
      expect(run.cost.basis).toBe("estimate");
      expect(run.confidence).toBe(0);
    }
  });
  it("does not send labels or basis to any provider", () => {
    for (const provider of ["openrouter", "vercel", "typesafe"] as const) {
      const request = buildRequest({
        ...args,
        provider,
        model: getJevModel(provider).id,
      });
      expect(JSON.stringify(request.body)).not.toContain("PRIVATE_REFERENCE");
      expect(JSON.stringify(request.body)).not.toContain("expected");
    }
  });
  it("uses a dedicated decision endpoint and typed choice", () => {
    const request = buildRequest(args);
    expect(request.url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(request.body).toMatchObject({
      questions: { judgment: { type: "choice" } },
    });
  });
  it("uses Vercel evaluation protocol headers", () => {
    const request = buildRequest({
      ...args,
      provider: "vercel",
      model: "typesafe-ai/jev",
    });
    expect(request.url).toContain("/evaluation-model");
    expect(request.headers).toMatchObject({
      "ai-model-id": "typesafe-ai/jev",
      "ai-evaluation-model-specification-version": "4",
    });
  });
  it("rejects arbitrary model URLs and invalid credentials", () => {
    expect(() =>
      validateRequest({ ...args, model: "https://evil.example" }),
    ).toThrow();
    expect(() =>
      validateRequest({ ...args, apiKey: "test\nsecret" }),
    ).toThrow();
  });
  it("does not substitute a different R1 for the pinned revision", () => {
    expect(getModels("vercel").some((m) => m.tier === "reasoning")).toBe(false);
  });
  it("retains probabilities, confidence and actual provider costs separately", () => {
    const run = normalizeResponse(
      {
        model: "jev-resolved",
        answers: {
          judgment: {
            choice: "yes",
            probabilities: { yes: 0.8, no: 0.2 },
            confidence: 0.6,
          },
        },
        usage: { input_tokens: 20, output_tokens: 0, cost: 0.001 },
      },
      args,
      base,
    );
    expect(run.status).toBe("success");
    expect(run.probabilities?.yes).toBe(0.8);
    expect(run.confidence).toBe(0.6);
    expect(run.cost).toEqual({ usd: 0.001, basis: "provider" });
  });
  it("unknown usage and model version remain unknown", () => {
    const run = normalizeResponse(
      { answers: { judgment: { choice: "yes" } } },
      args,
      base,
    );
    expect(run.cost).toEqual({ usd: null, basis: "unknown" });
    expect(run.resolvedModel).toBeNull();
  });
  it("does not treat echoed request aliases as resolved versions", () => {
    const run = normalizeResponse(
      { model: args.model, answers: { judgment: { choice: "yes" } } },
      args,
      base,
    );
    expect(run.resolvedModel).toBeNull();
    expect(RunRecordSchema.safeParse(run).success).toBe(true);
  });
  it("drops malformed resolved model metadata on success and failure", () => {
    for (const choice of ["yes", "bad"]) {
      const run = normalizeResponse(
        { model: "x".repeat(161), answers: { judgment: { choice } } },
        args,
        base,
      );
      expect(run.resolvedModel).toBeNull();
      expect(RunRecordSchema.safeParse(run).success).toBe(true);
    }
  });
  it("uses the shared probability tolerance and produces shareable errors", () => {
    for (const probabilities of [
      { yes: 0.5, no: 0.49 },
      { yes: 0.5, no: 0.499 },
      { yes: 0.5, no: 0.4995 },
    ]) {
      const run = normalizeResponse(
        {
          answers: { judgment: { choice: "yes", probabilities } },
          usage: { cost: 0.001 },
        },
        args,
        base,
      );
      expect(run.status).toBe(
        probabilities.no === 0.4995 ? "success" : "error",
      );
      expect(run.cost.usd).toBe(0.001);
      expect(RunRecordSchema.safeParse(run).success).toBe(true);
    }
  });
  it("keeps all normalized invalid-answer records within the shared contract", () => {
    for (const answer of [
      { choice: "bad" },
      { choice: "yes", confidence: 2 },
      { choice: "yes", probabilities: { yes: NaN, no: 1 } },
      { choice: "yes", probabilities: { yes: 0.8, no: 0.2 } },
    ]) {
      expect(
        RunRecordSchema.safeParse(
          normalizeResponse({ answers: { judgment: answer } }, args, base),
        ).success,
      ).toBe(true);
    }
  });
  it("rejects invalid probabilities but preserves billed usage", () => {
    const run = normalizeResponse(
      {
        answers: {
          judgment: { choice: "yes", probabilities: { yes: 2, no: -1 } },
        },
        usage: { input_tokens: 20, output_tokens: 0, cost: 0.001 },
      },
      args,
      base,
    );
    expect(run.status).toBe("error");
    expect(run.cost.usd).toBe(0.001);
    expect(run.probabilities).toBeUndefined();
  });
  it("rejects truncated chat output even when its content parses", () => {
    const run = normalizeResponse(
      {
        choices: [
          { finish_reason: "length", message: { content: '{"choice":"yes"}' } },
        ],
      },
      { ...args, model: "google/gemini-2.5-flash" },
      base,
    );
    expect(run.status).toBe("error");
  });
  it("does not expose upstream errors or retry", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("secret-token", { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    const run = await executeUpstream(args);
    expect(run.error).not.toContain("secret-token");
    expect(run.error).not.toContain(args.apiKey);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves cancellation as a distinct outcome", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret")));
    const controller = new AbortController();
    controller.abort();
    const run = await executeUpstream({ ...args, signal: controller.signal });
    expect(run.status).toBe("cancelled");
  });
  it("retains failed relay attempts without leaking response bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("secret-token", { status: 503 })),
    );
    const run = await executeJudge({
      ...args,
      provider: "typesafe",
      model: "jev-latest",
    });
    expect(run.status).toBe("error");
    expect(run.error).toContain("503");
    expect(JSON.stringify(run)).not.toContain("secret-token");
    expect(run.cost.basis).toBe("unknown");
  });
  it("forbids HTTP redirects to protect credentials", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("redirect"));
    vi.stubGlobal("fetch", fetch);
    await executeUpstream(args);
    expect(fetch.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      cache: "no-store",
    });
  });
});
describe("relay boundaries", () => {
  const request = (body: unknown, origin = "https://arena.example") =>
    new Request("https://arena.example/api/judge", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  it("is disabled by default", async () => {
    vi.stubEnv("JEVARENA_RELAY_ENABLED", "false");
    expect((await POST(request(args))).status).toBe(503);
  });
  it("rejects cross origin and arbitrary models before fetch", async () => {
    vi.stubEnv("JEVARENA_RELAY_ENABLED", "true");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await POST(request(args, "https://evil.example"))).status).toBe(
      403,
    );
    expect(
      (
        await POST(
          request({ ...args, provider: "typesafe", model: "http://localhost" }),
        )
      ).status,
    ).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("bounds payload without trusting content length", async () => {
    vi.stubEnv("JEVARENA_RELAY_ENABLED", "true");
    expect((await POST(request({ padding: "x".repeat(100000) }))).status).toBe(
      413,
    );
  });
});
