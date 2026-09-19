import { describe, expect, it } from "vitest";
import { PublicCommunityItemSchema, PublicCommunityResponseSchema, questionForReplay, questionPrompt } from "../lib/published-community";

const item = {
  id: "test-question", license: "CC-BY-4.0", submittedAt: "2026-09-19T12:00:00Z",
  challenge: { schemaVersion: 1, id: "test-question", title: "Synthetic test", language: "en", kind: "judgment", content: "What is 2 + 2?", question: "Choose the value", options: [{ id: "a", label: "4" }, { id: "b", label: "5" }], expected: "a", basis: "Private reference basis" },
  moderation: { decision: "publish", reason: "Suitable question", model: "typesafe/jev" },
};
describe("public community projection", () => {
  it("accepts only published decisions, not private intake envelopes", () => {
    expect(PublicCommunityItemSchema.safeParse(item).success).toBe(true);
    expect(PublicCommunityItemSchema.safeParse({ ...item, moderation: { ...item.moderation, decision: "reject" } }).success).toBe(false);
    for (const field of ["apiKey", "deletionToken", "consent", "ipHash"]) {
      expect(PublicCommunityItemSchema.safeParse({ ...item, [field]: "secret" }).success).toBe(false);
    }
  });
  it("rejects invalid references and accepts an empty feed", () => {
    expect(PublicCommunityResponseSchema.parse({ items: [] })).toEqual({ items: [] });
    expect(PublicCommunityItemSchema.safeParse({ ...item, challenge: { ...item.challenge, expected: "missing" } }).success).toBe(false);
  });
  it("copies task and choices without reference answers or fabricated runs", () => {
    const parsed = PublicCommunityItemSchema.parse(item);
    expect(questionPrompt(parsed.challenge)).toBe("What is 2 + 2?\n\nChoose the value\n\nPossible answers:\n4\n5");
    expect(questionPrompt(parsed.challenge)).not.toContain("Private reference");
    expect(questionForReplay(parsed).runs).toEqual([]);
    expect(questionForReplay(parsed).status).toBe("community-submitted");
  });
});
