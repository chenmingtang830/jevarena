import { describe, expect, it, vi } from "vitest";
import { moderateContribution, prepareModeration } from "../lib/moderation";
const consent = { version: "2026-09-19-auto-review-v1", research: true, rights: true, reviewed: true, allowPublication: true, publication: "after-ai-review", automatedReview: true, reviewProvider: "vercel" };
const input = { schemaVersion: 1, id: "synthetic", challenge: { schemaVersion: 1, id: "task", title: "Synthetic", language: "en", kind: "judgment", content: "Two plus two is four", question: "Is this correct?", options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }], basis: "Included public reference" }, humanAnswer: { optionId: "yes", revealedBeforeAnswer: false, rationale: "Arithmetic" }, runs: [], notes: "Excluded notes", status: "community-submitted", license: "CC-BY-4.0" };
const response = (choice: string) => ({ status: "success", choice, resolvedModel: null, cost: { usd: null, basis: "unknown" }, latencyMs: 10 });
describe("automatic moderation", () => {
  it("screens full projected public fields and reason with injection-resistant instructions", async () => {
    const prepared = await prepareModeration(input, consent);
    expect(prepared.challenge.content).toContain("Arithmetic");
    expect(prepared.challenge.content).toContain("Included public reference");
    expect(prepared.challenge.content).not.toMatch(/Excluded notes|revealedBeforeAnswer/);
    expect(prepared.challenge.question).toContain("untrusted data");
    expect(prepared.estimate.maxUsd).toBeLessThanOrEqual(0.01);
  });
  it("blocks private/prior consent and recognizable secrets without calls", async () => {
    const runner = vi.fn();
    for (const invalid of [{ ...consent, allowPublication: false }, { ...consent, version: "2026-09-19-public-v1", publication: "after-review" }]) expect(await moderateContribution(input, invalid, "test-key-only", undefined, runner)).toMatchObject({ publish: false, calls: 0 });
    expect(await moderateContribution({ ...input, notes: `sk-or-v1-${"a".repeat(24)}` }, consent, "test-key-only", undefined, runner)).toMatchObject({ publish: false, calls: 0 });
    expect(runner).not.toHaveBeenCalled();
  });
  it.each(["publishable", "sensitive", "abuse-spam", "missing-context", "uncertain"])("maps %s to a template and calls fixed Gateway once", async category => {
    const runner = vi.fn().mockResolvedValue(response(category));
    const result = await moderateContribution(input, consent, "test-key-only", undefined, runner);
    expect(result).toMatchObject({ category, publish: category === "publishable", status: "screened", reasonSource: "category-template", calls: 1 });
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0][0]).toMatchObject({ provider: "vercel", model: "typesafe-ai/jev" });
    expect(JSON.stringify(result)).not.toContain("test-key-only");
  });
  it("fails closed on exceptions, malformed choices and provider errors without retries", async () => {
    for (const runner of [vi.fn().mockRejectedValue(new Error("private-content")), vi.fn().mockResolvedValue(response("invalid")), vi.fn().mockResolvedValue({ ...response("publishable"), status: "error" })]) {
      const result = await moderateContribution(input, consent, "test-key-only", undefined, runner);
      expect(result).toMatchObject({ status: "failed", publish: false, category: "uncertain", calls: 1 });
      expect(runner).toHaveBeenCalledTimes(1); expect(JSON.stringify(result)).not.toContain("private-content");
    }
  });
  it("rejects oversized screening and cancelled work before sending", async () => {
    const runner = vi.fn();
    const large = { ...input, challenge: { ...input.challenge, content: "x".repeat(40000), question: "y".repeat(40000) } };
    expect(await moderateContribution(large, consent, "test-key-only", undefined, runner)).toMatchObject({ publish: false, calls: 0 });
    const controller = new AbortController(); controller.abort();
    expect(await moderateContribution(input, consent, "test-key-only", controller.signal, runner)).toMatchObject({ publish: false, calls: 0 });
    expect(runner).not.toHaveBeenCalled();
  });
});
