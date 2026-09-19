import { expect, it } from "vitest";
import { MODELS, estimateCost } from "../lib/catalog";
import { buildRequest } from "../lib/providers";
import { communityTasks } from "../lib/community-tasks";

it("additional models are explicit opt-in with bounded known-price chat requests", () => {
  const added = MODELS.filter((model) => model.compareOnly);
  expect(added).toHaveLength(3);
  for (const model of added) {
    const challenge = communityTasks[0].challenge;
    const request = buildRequest({ provider: "openrouter", model: model.id, apiKey: "synthetic-test-only", challenge });
    expect(request.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request.body).toMatchObject({ model: model.id });
    expect(estimateCost(model, challenge).maxUsd).toBeGreaterThan(0);
    expect(model.validation).toBe("contract-only");
  }
});
