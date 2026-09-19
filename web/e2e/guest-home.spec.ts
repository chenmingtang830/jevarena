import { test, expect } from "@playwright/test";

test("guest can guess and inspect recorded results without a key or provider request", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (request) => { if (/openrouter\.ai|ai-gateway|api\/judge|api\/contributions/.test(request.url())) calls.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Would you make the same call?" })).toBeVisible();
  await expect(page.getByPlaceholder("Paste your API key")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reveal model answers" })).toBeDisabled();
  await page.getByRole("button", { name: "Answer 2 is better", exact: true }).click();
  await page.getByRole("button", { name: "Reveal model answers" }).click();
  await expect(page.getByRole("heading", { name: "Here’s what the models chose" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Gemini 2.5 Flash", exact: true })).toBeVisible();
  await expect(page.getByText(/not a live match or a benchmark/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Inspect the run records" })).toHaveAttribute("href", /openrouter-canary-2026-09-19.json/);
  await page.getByRole("button", { name: "Who can participate? 中文" }).click();
  await expect(page.getByRole("heading", { name: "Here’s what the models chose" })).toHaveCount(0);
  await page.getByRole("button", { name: "Skip my guess" }).click();
  await expect(page.getByText("Reference answer: 不可以.", { exact: true })).toBeVisible();
  expect(calls).toEqual([]);
});

test("shared guest examples do not reveal until requested; rerun opens editable task", async ({ page }) => {
  await page.goto("/?example=chinese-negation");
  await expect(page.getByRole("heading", { name: "依据以上规则，小林可以参加吗？" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jev", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Skip my guess" }).click();
  await page.getByRole("link", { name: "Run this yourself" }).click();
  await expect(page).toHaveURL(/\/play\?case=chinese-negation/);
  await expect(page.getByRole("button", { name: "Start judging", exact: true })).toBeVisible();
});
