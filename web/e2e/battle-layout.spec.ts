import { expect, test } from "@playwright/test";
import { openManualKey } from "./manual-key";

test.skip(process.env.NEXT_PUBLIC_PUBLIC_COLLECTION_ENABLED !== "true", "Requires the public contribution UI");

test("battle keeps the question visible and contribution control aligned and keyboard operable", async ({ page }) => {
  let submissions = 0;
  await page.route("**/api/contributions", route => { submissions++; return route.abort(); });
  await page.route("https://openrouter.ai/**", route => route.request().method() === "GET" ? route.abort() : route.fulfill({ json: route.request().url().includes("/decisions")
    ? { answers: { judgment: { choice: "option1", probabilities: { option1: 0.8, option2: 0.2 } } }, usage: { input_tokens: 10, output_tokens: 0, cost: 0.000001 } }
    : { model: "mock-version", choices: [{ finish_reason: "stop", message: { content: '{"choice":"option2"}' } }], usage: { prompt_tokens: 10, completion_tokens: 4, cost: 0.00001 } }
  }));
  const question = "SYNTHETIC: Does 2 + 2 equal 4?";
  await page.goto("/play");
  await page.getByLabel("Question and context").fill(question);
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await openManualKey(page);
  await page.getByLabel("OpenRouter", { exact: true }).fill("test-only-not-a-real-key");
  await page.getByRole("checkbox", { name: "I agree to Terms and acknowledge Privacy", exact: true }).check();
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await expect(page.getByText("Which judgment is better?", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your question", exact: true }).getByText(question, { exact: true })).toBeVisible();

  const checkbox = page.getByRole("checkbox", { name: "Contribute publicly", exact: true });
  const labelText = page.locator(".public-contribution-choice:visible label span");
  const controlBox = await checkbox.boundingBox();
  const textBox = await labelText.boundingBox();
  expect(controlBox).not.toBeNull();
  expect(textBox).not.toBeNull();
  expect(controlBox!.height).toBe(16);
  expect(controlBox!.width).toBe(16);
  expect(Math.abs(controlBox!.y + controlBox!.height / 2 - textBox!.y - textBox!.height / 2)).toBeLessThanOrEqual(1);
  await checkbox.focus();
  await checkbox.press("Space");
  await expect(checkbox).not.toBeChecked();
  await expect(page.locator(".public-contribution-choice:visible").getByText("Private mode: no community submission. Your answer stays in this tab.")).toBeVisible();
  await page.getByRole("button", { name: "Both good", exact: true }).click();
  expect(submissions).toBe(0);
  const results = page.getByRole("region", { name: "Comparison results" });
  await expect(results).toContainText("Yes probability");
  await expect(results).not.toContainText("option1 probability");
});
