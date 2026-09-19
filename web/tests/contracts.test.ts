import { describe, it, expect } from "vitest";
import {
  ChallengeSchema,
  CaseContributionSchema,
  RunRecordSchema,
  modelInput,
} from "../lib/contracts";
import { templates, cases } from "../lib/cases";
import fixtures from "../../shared/fixtures.json";
import rubric from "../../shared/rubric.json";
import jsonSchema from "../../shared/contracts.schema.json";
import { z } from "zod";
describe("shared contracts", () => {
  it("matches the Python-shared fixture", () => {
    expect(modelInput(ChallengeSchema.parse(fixtures.challenge))).toEqual({
      ...fixtures.modelInput,
      question: rubric.comparison,
    });
  });
  it("keeps committed JSON schema synchronized", () => {
    expect(z.toJSONSchema(ChallengeSchema)).toEqual(jsonSchema.$defs.Challenge);
    expect(z.toJSONSchema(RunRecordSchema)).toEqual(jsonSchema.$defs.RunRecord);
    expect(z.toJSONSchema(CaseContributionSchema)).toEqual(
      jsonSchema.$defs.CaseContribution,
    );
  });
  it("validates all original templates and contributions", () => {
    templates.forEach((x) =>
      expect(ChallengeSchema.safeParse(x).success).toBe(true),
    );
    cases.forEach((x) =>
      expect(CaseContributionSchema.safeParse(x).success).toBe(true),
    );
  });
  it("excludes labels and explanations from model input", () => {
    const c = {
      ...templates[0],
      expected: "SECRET_LABEL",
      basis: "PRIVATE_EXPLANATION",
      source: "SECRET_SOURCE",
    };
    const input = JSON.stringify(modelInput(c));
    expect(input).not.toContain("SECRET");
    expect(input).not.toContain("PRIVATE");
  });
  it("rejects unknown fields, including keys", () => {
    expect(
      CaseContributionSchema.safeParse({ ...cases[0], apiKey: "secret" })
        .success,
    ).toBe(false);
    expect(
      ChallengeSchema.safeParse({ ...templates[0], apiKey: "secret" }).success,
    ).toBe(false);
  });
  it("maps comparison to stable option IDs", () => {
    expect(modelInput(templates[1]).options.map((o) => o.id)).toEqual([
      "answer1",
      "answer2",
      "tie",
    ]);
  });
  it("rejects malformed probability distributions and unknown zero costs", () => {
    const r = {
      schemaVersion: 1,
      id: "run",
      challengeId: "c",
      challengeHash: "hash",
      provider: "typesafe",
      model: "jev",
      resolvedModel: null,
      promptVersion: "v1",
      createdAt: new Date().toISOString(),
      choice: "a",
      usage: { inputTokens: null, outputTokens: null },
      cost: { usd: null, basis: "unknown" },
      latencyMs: 10,
      status: "success",
    };
    expect(RunRecordSchema.safeParse(r).success).toBe(true);
    expect(
      RunRecordSchema.safeParse({ ...r, probabilities: { a: 0.9, b: 0.9 } })
        .success,
    ).toBe(false);
    expect(
      RunRecordSchema.safeParse({ ...r, cost: { usd: 0, basis: "unknown" } })
        .success,
    ).toBe(false);
  });
});
