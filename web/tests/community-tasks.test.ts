import { describe, it, expect } from "vitest";
import { communityTasks } from "../lib/community-tasks";
import { ChallengeSchema, modelInput } from "../lib/contracts";

describe("source-backed community tasks", () => {
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
