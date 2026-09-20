import { describe, expect, it } from "vitest";
import { assessCommunityQuestion } from "../lib/community-question-quality";

describe("community question quality", () => {
  it("blocks missing structure before a submission can be sent", () => {
    const quality = assessCommunityQuestion("", "Only answer");
    expect(quality.status).toBe("blocked");
    expect(quality.checks.map((check) => check.status)).toContain("blocked");
  });

  it("accepts a clear finite-choice question", () => {
    const quality = assessCommunityQuestion("Which total is correct?", "4\n5");
    expect(quality.status).toBe("ready");
    expect(quality.checks.every((check) => check.status === "ready")).toBe(true);
  });

  it("keeps ambiguous phrasing submit-ready but flags it for a closer review", () => {
    const quality = assessCommunityQuestion("A model response about an arithmetic result", "Answer 1\nAnswer 2");
    expect(quality.status).toBe("review");
    expect(quality.checks.find((check) => check.id === "decision")).toMatchObject({ status: "review" });
  });

  it("blocks duplicate choices after whitespace and case normalization", () => {
    const quality = assessCommunityQuestion("Which response is best?", "Yes\n yes ");
    expect(quality.status).toBe("blocked");
    expect(quality.checks.find((check) => check.id === "answers")).toMatchObject({ status: "blocked" });
  });
});
