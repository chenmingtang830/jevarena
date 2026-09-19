import { openManualKey } from "./manual-key";
import { test, expect } from "@playwright/test";

test("visitors browse without inference and invalid fragments fail safely", async ({
  page,
}) => {
  let calls = 0;
  await page.route("https://openrouter.ai/**", (route) => {
    if (route.request().method() === "GET") return route.abort();
    calls++;
    return route.abort();
  });
  await page.goto("/play");
  await expect(
    page.getByRole("textbox", { name: "Question and context" }),
  ).toBeVisible();
  await page.goto("/cases");
  await expect(page.locator("main")).toBeVisible();
  await page.goto("/share#broken");
  await expect(page.locator("main")).toContainText(
    /invalid|could not|unable|unsupported|import/i,
  );
  expect(calls).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("synthetic battle hides metadata until vote, never stores keys", async ({
  page,
}) => {
  const calls: unknown[] = [];
  await page.route("https://openrouter.ai/**", async (route) => {
    if (route.request().method() === "GET") return route.abort();
    const data = route.request().postDataJSON();
    calls.push(data);
    if (route.request().url().includes("/decisions")) {
      await route.fulfill({
        json: {
          answers: {
            judgment: {
              choice: "option1",
              probabilities: { option1: 0.8, option2: 0.2 },
            },
          },
          usage: { input_tokens: 10, output_tokens: 0, cost: 0.000001 },
        },
      });
    } else
      await route.fulfill({
        json: {
          model: "mock-version",
          choices: [
            {
              finish_reason: "stop",
              message: { content: '{"choice":"option2"}' },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 4, cost: 0.00001 },
        },
      });
  });
  await page.goto("/play");
  await page
    .getByLabel("Question and context")
    .fill("Is this correct? SYNTHETIC TEST ONLY: 2+2=4");
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  expect(calls).toHaveLength(0);
  if (!(await page.getByLabel("OpenRouter", { exact: true }).isVisible()))
    await openManualKey(page);
  await page
    .getByLabel("OpenRouter", { exact: true })
    .fill("test-only-not-a-real-key");
  await page.getByRole("checkbox", { name: "I agree to Terms and acknowledge Privacy", exact: true }).check();
  await page.getByRole("button", { name: "Start judging" }).click();
  await expect(
    page.getByText("Which judgment is better?", { exact: true }),
  ).toBeVisible();
  const results = page.getByRole("region", { name: "Comparison results" });
  await expect(page).toHaveURL("/battle");
  await expect(page.getByRole("region", { name: "Set up experiment" })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "The arena", exact: true })).toBeFocused();
  await expect(results).not.toContainText("gemini");
  await expect(results).not.toContainText("probability");
  await page.getByRole("button", { name: "Both good", exact: true }).click();
  await expect(results).toContainText("google/gemini-2.5-flash");
  await expect(results).toContainText("typesafe/jev-1.13");
  expect(calls).toHaveLength(2);
  await page.goBack();
  await expect(page.getByLabel("Question and context")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL("/battle");
  await expect(results).toBeVisible();
  expect(calls).toHaveLength(2);
  const stored = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(stored).not.toContain("test-only-not-a-real-key");
  await page.getByRole("button", { name: "Share this experiment" }).click();
  await expect(page.locator(".share-preview")).not.toContainText(
    "test-only-not-a-real-key",
  );
  await expect(
    page.getByRole("button", { name: "Copy link", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("comparison form and incomplete paid attempts do not create a winner", async ({
  page,
}) => {
  await page.route("https://openrouter.ai/**", (r) =>
    r.fulfill({ status: 401, json: { error: "SECRET_UPSTREAM_DETAIL" } }),
  );
  await page.goto("/cases/decimal-comparison");
  await page.getByLabel("Original question").fill("What is 2+2?");
  await page.getByLabel("Candidate answer 1").fill("4");
  await page.getByLabel("Candidate answer 2").fill("5");
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  if (!(await page.getByLabel("OpenRouter", { exact: true }).isVisible()))
    await openManualKey(page);
  await page
    .getByLabel("OpenRouter", { exact: true })
    .fill("test-only-not-a-real-key");
  await page.getByRole("checkbox", { name: "I agree to Terms and acknowledge Privacy", exact: true }).check();
  await page.getByRole("button", { name: "Start judging" }).click();
  await expect(page.getByText(/This match is incomplete/)).toBeVisible();
  await page.getByRole("button", { name: "Edit question", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Both good", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    "SECRET_UPSTREAM_DETAIL",
  );
});

test("explicit Compare, cancellation and retry retain attempts", async ({
  page,
}) => {
  let count = 0;
  await page.route("https://openrouter.ai/**", async (route) => {
    if (route.request().method() === "GET") return route.abort();
    count++;
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      await route.fulfill({ status: 429, json: { error: "test" } });
    } catch {
      /* cancelled request */
    }
  });
  await page.goto("/play");
  await page
    .getByLabel("Question and context")
    .fill("Is this synthetic retry test correct?");
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  if (!(await page.getByLabel("OpenRouter", { exact: true }).isVisible()))
    await openManualKey(page);
  await page
    .getByLabel("OpenRouter", { exact: true })
    .fill("test-only-not-a-real-key");
  await page.getByRole("checkbox", { name: "I agree to Terms and acknowledge Privacy", exact: true }).check();
  await page.locator("summary").filter({ hasText: "Advanced settings" }).click();
  await page
    .getByLabel("Opponent", { exact: true })
    .selectOption("openrouter:anthropic/claude-sonnet-4.5");
  await page.getByLabel("Estimate threshold (USD)").fill("1");
  await page.getByRole("button", { name: "Start judging" }).click();
  await page.getByRole("button", { name: "Cancel requests" }).click();
  await expect(page.getByText(/This match is incomplete/)).toBeVisible();
  await page.getByRole("button", { name: "Edit question", exact: true }).click();
  await page.getByRole("button", { name: "Start judging" }).click();
  await expect(page.getByRole("dialog", { name: "Ready to compare" })).toBeVisible();
  await page.getByRole("button", { name: "Start judging" }).click();
  await expect(
    page.locator("summary").filter({ hasText: "2 attempts in this session" }),
  ).toBeVisible();
  expect(count).toBeLessThanOrEqual(4);
});

test("case opens editable immediately, reference and original export never run a model", async ({
  page,
}) => {
  let calls = 0;
  await page.route("https://openrouter.ai/**", (route) => {
    if (route.request().method() === "GET") return route.abort();
    calls++;
    return route.abort();
  });
  await page.goto("/cases/phishing-email");
  const content = page.getByLabel("Question and context");
  await expect(content).toBeEditable();
  const original = await content.inputValue();
  expect(original.length).toBeGreaterThan(0);
  await content.fill("A changed draft, not a new model result.");
  await expect(page.getByRole("heading", { name: "Your judgment first" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reproduce with your keys" })).toHaveCount(0);
  await page.getByText("Reference answer and reasoning", { exact: true }).click();
  await expect(
    page.getByText(/Reference answers can be disputed/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Share this example" }).click();
  const json = await page.locator(".share-preview").textContent();
  expect(json).toBeTruthy();
  const originalChallenge = JSON.parse(json!).challenge;
  expect(`${originalChallenge.question}\n\n${originalChallenge.content}`).toBe(original);
  expect(originalChallenge.content).not.toBe("A changed draft, not a new model result.");
  await page.goto("/share");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "case.json",
      mimeType: "application/json",
      buffer: Buffer.from(json!),
    });
  await expect(
    page.getByText("Community submitted · unverified", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Question and context")).toHaveValue(original);
  const withHistory = JSON.parse(json!);
  withHistory.runs = [{
    schemaVersion: 1, id: "synthetic-imported-run", challengeId: withHistory.challenge.id,
    challengeHash: "synthetic-unverified-hash", provider: "openrouter", model: "synthetic/imported-model",
    resolvedModel: null, promptVersion: "synthetic-v1", createdAt: "2026-09-19T00:00:00Z",
    choice: withHistory.challenge.options[0].id, usage: { inputTokens: null, outputTokens: null },
    cost: { usd: null, basis: "unknown" }, latencyMs: 100, status: "success",
  }];
  await page.goto("/share");
  await page.locator("input[type=file]").setInputFiles({ name: "history.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(withHistory)) });
  await expect(page.getByRole("heading", { name: "Imported observations · unverified" })).toBeVisible();
  await expect(page.getByText("synthetic/imported-model", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Question and context")).toHaveValue(original);
  await expect(page.getByRole("heading", { name: "Your judgment first" })).toHaveCount(0);
  expect(calls).toBe(0);
});
