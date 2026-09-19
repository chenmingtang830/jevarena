import { openManualKey } from "./manual-key";
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("question and editable answers are the only initial task controls", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/")) {
      requests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/play");
  await expect(page.locator("textarea:visible")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Ask a question.", exact: true })).toBeVisible();
  await expect(page.getByLabel("Question and context")).toBeVisible();
  await expect(page.getByLabel("Option 1", { exact: true })).toHaveValue("Yes");
  await expect(page.getByLabel("Option 2", { exact: true })).toHaveValue("No");
  await expect(page.getByRole("button", { name: "Task options", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make a judgment", exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="password"]:visible')).toHaveCount(0);
  await expect(page.getByLabel("Estimate threshold (USD)")).not.toBeVisible();
  await expect(page.getByRole("region", { name: "Comparison results" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Start judging", exact: true })).toHaveCount(1);
  expect(requests).toEqual([]);
});

test("comparison reviews cost before identical deterministic judge inputs", async ({ page }, testInfo) => {
  const calls: { url: string; body: Record<string, any> }[] = [];
  await page.route("https://openrouter.ai/**", async (route) => {
    calls.push({ url: route.request().url(), body: route.request().postDataJSON() });
    return route.fulfill({ json: route.request().url().includes("/decisions")
      ? { answers: { judgment: { choice: "option1" } }, usage: { input_tokens: 20, output_tokens: 0, cost: 0.000001 } }
      : { model: "synthetic-version", choices: [{ finish_reason: "stop", message: { content: '{"choice":"option2"}' } }], usage: { prompt_tokens: 20, completion_tokens: 4, cost: 0.00001 } },
    });
  });
  await page.goto("/play");
  const content = "SYNTHETIC TEST ONLY: Is 2 + 2 equal to 4?";
  await page.getByLabel("Question and context").fill(content);
  await page.getByLabel("Option 1", { exact: true }).fill("Correct");
  await page.getByLabel("Option 2", { exact: true }).fill("Incorrect");
  await expect(page.getByRole("region", { name: "Privacy before you run" })).toBeVisible();
  const start = page.getByRole("button", { name: "Start judging", exact: true });
  expect(calls).toHaveLength(0);
  await start.click();
  await expect(start).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Connect OpenRouter" })).toBeVisible();
  await expect(page.getByLabel("Estimate threshold (USD)")).not.toBeVisible();
  await expect(page.getByLabel("Opponent tier")).not.toBeVisible();
  expect(calls).toHaveLength(0);
  await openManualKey(page);
  await expect(start).toHaveCount(1);
  await expect(start).toBeDisabled();
  const key = page.getByLabel("OpenRouter", { exact: true });
  await expect(key).toBeVisible();
  await key.fill("test-only-not-a-real-key");
  await expect(page.getByRole("heading", { name: "Ready to compare" })).toBeVisible();
  const settings = page.locator("summary").filter({ hasText: "Advanced settings" });
  await expect(settings.locator("..")).not.toHaveAttribute("open", "");
  await expect(page.getByLabel("Estimate threshold (USD)")).not.toBeVisible();
  await expect(page.getByLabel("Opponent tier")).not.toBeVisible();
  await expect(start).toBeDisabled();
  const consent = page.getByRole("checkbox", { name: "I agree to Terms and acknowledge Privacy", exact: true });
  await expect(consent).not.toBeChecked();
  await consent.check();
  await expect(start).toBeEnabled();
  await page.locator("summary").filter({ hasText: "Advanced settings" }).click();
  await expect(page.getByText(/not billing caps/i)).toBeVisible();
  await expect(page.locator(".price-note")).toContainText(/2 calls.*Estimated/);
  expect(calls).toHaveLength(0);
  await mkdir("../.impeccable/review", { recursive: true });
  await page.screenshot({ path: `../.impeccable/review/cost-review-${testInfo.project.name}.png`, fullPage: true });
  await start.click();
  await expect(page.getByText("Which judgment is better?", { exact: true })).toBeVisible();
  expect(calls).toHaveLength(2);
  const decision = calls.find((call) => call.url.includes("/decisions"))!.body;
  const chat = calls.find((call) => call.url.includes("/chat/completions"))!.body;
  const chatInput = JSON.parse(chat.messages.find((m: { role: string }) => m.role === "user").content);
  expect(decision.state).toBe(content);
  expect(chatInput.content).toBe(content);
  expect(decision.questions.judgment.instructions).toBe("Answer the question in the provided text using one of the possible answers.");
  expect(chatInput.question).toBe(decision.questions.judgment.instructions);
  expect(decision.questions.judgment.criteria).toEqual({ option1: "Correct", option2: "Incorrect" });
  expect(chatInput.options).toEqual([{ id: "option1", label: "Correct" }, { id: "option2", label: "Incorrect" }]);
  const results = page.getByRole("region", { name: "Comparison results" });
  await expect(results).not.toContainText("google/gemini");
  await page.getByRole("button", { name: "Both good", exact: true }).click();
  await expect(results).toContainText("google/gemini-2.5-flash");
});

test("all three quick starts fill question and possible answers without calls", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/")) {
      requests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/play");
  const examples = [
    { label: "A surprising remainder", question: /Which option/, context: /6\^3 mod 89/, answers: ["38", "9", "53", "39"] },
    { label: "A bigger power", question: /Which option/, context: /19\^9 mod 7/, answers: ["1", "0", "4", "6"] },
  ];
  for (const example of examples) {
    await page.getByRole("button", { name: example.label, exact: true }).click();
    const question = page.getByLabel("Question and context");
    await expect(question).toHaveValue(example.question);
    await expect(question).toHaveValue(example.context);
    await expect(question).toBeFocused();
    await expect(question).toBeEditable();
    await expect(page.getByRole("textbox", { name: /^Option \d+$/ })).toHaveCount(example.answers.length);
    for (const [i, answer] of example.answers.entries()) {
      await expect(page.getByLabel(`Option ${i + 1}`, { exact: true })).toHaveValue(answer);
      await expect(page.getByLabel(`Option ${i + 1}`, { exact: true })).toBeEditable();
    }
    await expect(page.getByRole("region", { name: "Privacy before you run" })).toBeVisible();
    await expect(page.locator('input[type="password"]:visible')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Replace draft", exact: true })).toHaveCount(0);
    expect(requests).toEqual([]);
  }
});
