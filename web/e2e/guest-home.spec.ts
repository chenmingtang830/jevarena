import { test, expect } from "@playwright/test";

test("guest can guess and inspect recorded results without a key or provider request", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (request) => { if (/openrouter\.ai|ai-gateway|api\/judge|api\/contributions/.test(request.url())) calls.push(request.url()); });
  await page.goto("/try?example=decimal-comparison");
  await expect(page.getByRole("heading", { name: "Would you make the same call?" })).toBeVisible();
  await expect(page.getByPlaceholder("Paste your API key")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reveal model answers" })).toBeDisabled();
  await page.getByRole("button", { name: "Answer 2 is better", exact: true }).click();
  await page.getByRole("button", { name: "Reveal model answers" }).click();
  await expect(page.getByRole("heading", { name: "Here’s what the models chose" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Gemini 2.5 Flash", exact: true })).toBeVisible();
  await page.getByText("Source & run details", { exact: true }).click();
  await expect(page.getByText(/not a live match or a benchmark/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Inspect the run records" })).toHaveAttribute("href", /openrouter-canary-2026-09-19.json/);
  await expect(page.getByRole("button", { name: "Who can participate? 中文" })).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("shared guest examples do not reveal until requested; rerun opens editable task", async ({ page }) => {
  await page.goto("/?example=decimal-comparison");
  await expect(page.getByRole("heading", { name: "Which number is larger, 9.11 or 9.9?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jev", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Skip my guess" }).click();
  await page.getByRole("link", { name: "Run this yourself" }).click();
  await expect(page).toHaveURL(/\/\?case=decimal-comparison/);
  await expect(page.getByRole("button", { name: "Start judging", exact: true })).toBeVisible();
});

test("every community example offers a no-key reveal and a separate live rerun", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", request => { if (/openrouter\.ai|ai-gateway|api\/judge|api\/contributions/.test(request.url())) calls.push(request.url()); });
  for (const id of ["community-export-limit", "community-retry-defaults", "community-safari-login", "community-remainder-6", "community-remainder-19"]) {
    await page.goto("/cases");
    const entry = page.locator("article").filter({ has: page.locator(`a[href="/try?example=${id}"]`) });
    await entry.getByRole("link", { name: "Try without a key" }).click();
    await expect(page.locator("#recorded-results")).toHaveCount(0);
    await page.getByRole("button", { name: "Skip my guess" }).click();
    await expect(page.locator("#recorded-results")).toBeFocused();
    await expect(page.getByText("Jev chose", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Example link", exact: true })).toHaveCount(0);
    await page.getByText("Source & run details", { exact: true }).click();
    await expect(page.getByText(/Author-reported, not independently reproduced/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Gemini 2.5 Flash" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Run this yourself" })).toHaveAttribute("href", `/?case=${id}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(calls).toEqual([]);
});

test("community reveal separates disputed answers from verified arithmetic", async ({ page }) => {
  await page.goto("/try?example=community-export-limit");
  await page.getByRole("button", { name: "Skip my guess" }).click();
  await expect(page.getByRole("heading", { name: "No single correct answer" })).toBeVisible();
  await expect(page.getByText("Author’s answer · disputed")).toBeVisible();
  await expect(page.getByText(/Label disagreement:/)).not.toBeVisible();
  await page.goto("/try?example=community-remainder-6");
  await page.getByRole("button", { name: "Skip my guess" }).click();
  await expect(page.getByRole("heading", { name: "Correct answer: 38" })).toBeVisible();
  await expect(page.getByText("6³ = 216; 216 − 2 × 89 = 38.")).toBeVisible();
  await page.getByRole("button", { name: "Next example" }).click();
  await expect(page.getByRole("heading", { name: "What is 19^9 mod 7?" })).toBeVisible();
  await expect(page.locator("#recorded-results")).toHaveCount(0);
});
