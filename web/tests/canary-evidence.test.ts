import { describe, expect, it } from "vitest";
import evidence from "../../docs/evidence/openrouter-canary-2026-09-19.json";
import { RunRecordSchema } from "../lib/contracts";
import { templates } from "../lib/cases";

describe("bounded public OpenRouter canary evidence", () => {
  it("contains exactly four successful real transport observations, not synthetic scores", () => {
    expect(evidence.calls).toBe(4);
    expect(evidence.runs).toHaveLength(4);
    expect(evidence.observations).toHaveLength(4);
    for (const run of evidence.runs) {
      expect(RunRecordSchema.safeParse(run).success).toBe(true);
      expect(run.choice).toBe(templates.find(c => c.id === run.challengeId)?.expected);
      expect(run.status).toBe("success");
      expect(run.provider).toBe("openrouter");
    }
  });
  it("preserves actual costs and only records the chat output cap for chat", () => {
    expect(evidence.runs.reduce((sum, r) => sum + r.cost.usd, 0)).toBeCloseTo(0.000161366, 12);
    for (const run of evidence.runs) {
      expect(run.cost.basis).toBe("provider");
      if (run.model.startsWith("typesafe/")) expect(run.settings).not.toHaveProperty("maxOutputTokens");
      else expect(run.settings.maxOutputTokens).toBe(4096);
    }
  });
});
