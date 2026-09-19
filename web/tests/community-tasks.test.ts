import { describe, it, expect } from "vitest";
import { communityTasks } from "../lib/community-tasks";
import { ChallengeSchema, modelInput } from "../lib/contracts";

describe("source-backed community tasks", () => {
  it("adds three source-backed triage disagreements without treating author labels as truth", () => {
    const triage = communityTasks.filter((item) => item.sourceId.startsWith("ambiguous-"));
    expect(triage).toHaveLength(3);
    for (const { challenge, observation } of triage) {
      expect(challenge.kind).toBe("judgment");
      if (challenge.kind !== "judgment") throw new Error("Wrong kind");
      expect(challenge.options.map((option) => option.id)).toEqual(["bug", "feature", "question", "docs"]);
      expect(challenge.question).toContain("Something already built behaves incorrectly");
      expect(observation).toContain("Label disagreement");
      expect(challenge.expected).toBeUndefined();
    }
  });
  it("keeps source observations out of model requests", () => {
    for (const { challenge, observation } of communityTasks) {
      expect(ChallengeSchema.safeParse(challenge).success).toBe(true);
      expect(JSON.stringify(modelInput(challenge))).not.toContain(observation);
      expect(challenge.expected).toBeUndefined();
    }
  });
  it("checks the reported arithmetic independently", () => {
    expect(6n ** 3n % 89n).toBe(38n);
    expect(19n ** 9n % 7n).toBe(6n);
  });
});
