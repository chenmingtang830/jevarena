import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("simple entry and examples make no calls or expose configuration", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/")) {
      requests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/");
  await expect(page.locator("textarea:visible")).toHaveCount(1);
  await expect(page.getByLabel("Your claim or question")).toBeVisible();
  await expect(page.locator('input[type="password"]:visible')).toHaveCount(0);
  await expect(page.getByLabel("Estimate threshold (USD)")).not.toBeVisible();
  await expect(page.getByRole("region", { name: "Comparison results" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Start blind comparison" })).not.toBeVisible();
  await page.locator('.starter-chips button').first().click();
  await expect(page.getByLabel("Your claim or question")).not.toHaveValue("");
  await expect(page.locator("textarea:visible")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Start blind comparison" })).not.toBeVisible();
  expect(requests).toEqual([]);
});

test("simple comparison reviews cost before identical deterministic judge inputs", async ({ page }, testInfo) => {
  const calls: { url: string; body: Record<string, any> }[] = [];
  await page.route("https://openrouter.ai/**", async (route) => {
    calls.push({ url: route.request().url(), body: route.request().postDataJSON() });
    return route.fulfill({ json: route.request().url().includes("/decisions")
      ? { answers: { judgment: { choice: "option1" } }, usage: { input_tokens: 20, output_tokens: 0, cost: 0.000001 } }
      : { model: "synthetic-version", choices: [{ finish_reason: "stop", message: { content: '{"choice":"option2"}' } }], usage: { prompt_tokens: 20, completion_tokens: 4, cost: 0.00001 } },
    });
  });
  await page.goto("/");
  const content = "SYNTHETIC TEST ONLY: 2 + 2 = 4.";
  await page.getByLabel("Your claim or question").fill(content);
  await page.getByRole("button", { name: "Review & compare", exact: true }).click();
  await expect(page.getByLabel("Estimate threshold (USD)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start blind comparison" })).toBeVisible();
  expect(calls).toHaveLength(0);
  const key = page.getByLabel("OpenRouter", { exact: true });
  if (!(await key.isVisible())) await page.locator("summary").filter({ hasText: "Connect your API keys" }).click();
  await key.fill("test-only-not-a-real-key");
  await expect(page.getByText(/Not a billing cap/)).toBeVisible();
  expect(calls).toHaveLength(0);
  await mkdir("../.impeccable/review", { recursive: true });
  await page.screenshot({ path: `../.impeccable/review/cost-review-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Start blind comparison" }).click();
  await expect(page.getByText("Which judgment is better?", { exact: true })).toBeVisible();
  expect(calls).toHaveLength(2);
  const decision = calls.find((call) => call.url.includes("/decisions"))!.body;
  const chat = calls.find((call) => call.url.includes("/chat/completions"))!.body;
  const chatInput = JSON.parse(chat.messages.find((m: { role: string }) => m.role === "user").content);
  expect(decision.state).toBe(content);
  expect(chatInput.content).toBe(content);
  expect(decision.questions.judgment.instructions).toBe("Is the statement supported by the provided context or established facts?");
  expect(chatInput.question).toBe(decision.questions.judgment.instructions);
  expect(decision.questions.judgment.criteria).toEqual({ option1: "Yes", option2: "No", option3: "Unsure" });
  expect(chatInput.options).toEqual([{ id: "option1", label: "Yes" }, { id: "option2", label: "No" }, { id: "option3", label: "Unsure" }]);
  const results = page.getByRole("region", { name: "Comparison results" });
  await expect(results).not.toContainText("google/gemini");
  await page.getByRole("button", { name: "Both good", exact: true }).click();
  await expect(results).toContainText("google/gemini-2.5-flash");
});

test("simple and advanced drafts survive mode changes", async ({ page }) => {
  await page.route("https://openrouter.ai/**", (route) => route.abort());
  await page.goto("/");
  await page.getByLabel("Your claim or question").fill("My simple draft");
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.getByLabel("What should the models evaluate?").fill("My advanced draft");
  await page.getByLabel("What’s the judgment?").fill("My custom rubric?");
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await expect(page.getByLabel("Your claim or question")).toHaveValue("My simple draft");
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await expect(page.getByLabel("What should the models evaluate?")).toHaveValue("My advanced draft");
  await expect(page.getByLabel("What’s the judgment?")).toHaveValue("My custom rubric?");
});
