import { test, expect } from "@playwright/test";

test("visitors browse without inference and invalid fragments fail safely", async ({
  page,
}) => {
  let calls = 0;
  await page.route("https://openrouter.ai/**", (route) => {
    calls++;
    return route.abort();
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good judgment. Put it to the test." }),
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
  await page.goto("/");
  await page
    .getByLabel("What should the models evaluate?")
    .fill("SYNTHETIC TEST ONLY: 2+2=4");
  await page.getByLabel("What’s the judgment?").fill("Is this correct?");
  await page
    .locator("summary")
    .filter({ hasText: "Connect your API keys" })
    .click();
  await page
    .getByLabel("OpenRouter", { exact: true })
    .fill("test-only-not-a-real-key");
  await page.getByRole("button", { name: "Start blind comparison" }).click();
  await expect(
    page.getByText("Which judgment is better?", { exact: true }),
  ).toBeVisible();
  const results = page.getByRole("region", { name: "Comparison results" });
  await expect(results).not.toContainText("gemini");
  await expect(results).not.toContainText("probability");
  await page.getByRole("button", { name: "Both good", exact: true }).click();
  await expect(results).toContainText("google/gemini-2.5-flash");
  await expect(results).toContainText("typesafe/jev-1.13");
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
  await page.goto("/");
  await page
    .getByRole("button", { name: "Compare two answers", exact: true })
    .click();
  await page.getByLabel("Original question").fill("What is 2+2?");
  await page.getByLabel("Candidate answer 1").fill("4");
  await page.getByLabel("Candidate answer 2").fill("5");
  await page
    .locator("summary")
    .filter({ hasText: "Connect your API keys" })
    .click();
  await page
    .getByLabel("OpenRouter", { exact: true })
    .fill("test-only-not-a-real-key");
  await page.getByRole("button", { name: "Start blind comparison" }).click();
  await expect(page.getByText(/This match is incomplete/)).toBeVisible();
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
    count++;
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      await route.fulfill({ status: 429, json: { error: "test" } });
    } catch {
      /* cancelled request */
    }
  });
  await page.goto("/");
  await page
    .getByLabel("What should the models evaluate?")
    .fill("Synthetic retry test");
  await page.getByLabel("What’s the judgment?").fill("Correct?");
  await page
    .locator("summary")
    .filter({ hasText: "Connect your API keys" })
    .click();
  await page
    .getByLabel("OpenRouter", { exact: true })
    .fill("test-only-not-a-real-key");
  await page.getByRole("button", { name: "Compare · pick a model" }).click();
  await page
    .getByLabel("Opponent", { exact: true })
    .selectOption("openrouter:anthropic/claude-sonnet-4.5");
  await page.getByLabel("Estimate threshold (USD)").fill("1");
  await page.getByRole("button", { name: "Start blind comparison" }).click();
  await page.getByRole("button", { name: "Cancel requests" }).click();
  await expect(page.getByText(/This match is incomplete/)).toBeVisible();
  await page.getByRole("button", { name: "Start blind comparison" }).click();
  await expect(
    page.locator("summary").filter({ hasText: "2 attempts in this session" }),
  ).toBeVisible();
  expect(count).toBeLessThanOrEqual(4);
});

test("case guess, JSON export and import never run a model", async ({
  page,
}) => {
  let calls = 0;
  await page.route("https://openrouter.ai/**", (route) => {
    calls++;
    return route.abort();
  });
  await page.goto("/cases/phishing-email");
  await expect(
    page.getByRole("heading", { name: "Your judgment first" }),
  ).toBeVisible();
  await page.locator(".guess-options button").first().click();
  await expect(
    page.getByText(/Reference answers can be disputed/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Share this experiment" }).click();
  const json = await page.locator(".share-preview").textContent();
  expect(json).toBeTruthy();
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
  expect(calls).toBe(0);
});
