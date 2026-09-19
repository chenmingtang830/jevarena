import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("first viewport offers a single composer before configuration", async ({ page }, testInfo) => {
  await expect(page.getByLabel("Your claim or question")).toBeInViewport();
  await expect(page.getByRole("button", { name: "Review & compare", exact: true })).toBeInViewport();
  await mkdir("../.impeccable/review", { recursive: true });
  await page.screenshot({ path: `../.impeccable/review/home-${testInfo.project.name}.png`, fullPage: true });
});

test.beforeEach(async ({ page }) => {
  // No real credentials or external calls, including accidental provider requests.
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/");
});

test("task switches preserve independent drafts only in tab memory", async ({ page }) => {
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.getByLabel("What should the models evaluate?").fill("Private judgment draft");
  await page.getByLabel("What’s the judgment?").fill("Is the claim supported?");
  await page.getByLabel("Option 1", { exact: true }).fill("Supported");
  await page.getByLabel("Task language").fill("zh");
  await page.getByRole("button", { name: "Compare two answers", exact: true }).click();
  await page.getByLabel("Original question").fill("Private comparison draft");
  await page.getByLabel("Candidate answer 1").fill("First draft answer");
  await page.getByLabel("Candidate answer 2").fill("Second draft answer");
  await page.getByLabel("Task language").fill("es");
  await page.getByRole("button", { name: "Make a judgment", exact: true }).click();
  await expect(page.getByLabel("What should the models evaluate?")).toHaveValue("Private judgment draft");
  await expect(page.getByLabel("What’s the judgment?")).toHaveValue("Is the claim supported?");
  await expect(page.getByLabel("Option 1", { exact: true })).toHaveValue("Supported");
  await expect(page.getByLabel("Task language")).toHaveValue("zh");
  await page.getByRole("button", { name: "Compare two answers", exact: true }).click();
  await expect(page.getByLabel("Original question")).toHaveValue("Private comparison draft");
  await expect(page.getByLabel("Candidate answer 1")).toHaveValue("First draft answer");
  await expect(page.getByLabel("Candidate answer 2")).toHaveValue("Second draft answer");
  await expect(page.getByLabel("Task language")).toHaveValue("es");
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain("Private");
  await page.reload();
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await expect(page.getByLabel("What should the models evaluate?")).toHaveValue("");
});

test("early examples acknowledge loading, focus content and protect existing drafts", async ({ page }) => {
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  const example = page.getByRole("button", { name: "Try an example", exact: true });
  const content = page.getByLabel("What should the models evaluate?");
  expect((await example.boundingBox())!.y).toBeLessThan((await content.boundingBox())!.y);
  await expect(page.getByRole("link", { name: "Browse cases · no key needed" })).toHaveAttribute("href", "/cases");
  await example.click();
  await expect(content).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Loaded “" })).toBeVisible();
  await content.fill("Keep this custom draft");
  await example.click();
  await expect(page.getByRole("button", { name: "Replace draft", exact: true })).toBeFocused();
  await expect(content).toHaveValue("Keep this custom draft");
  await page.getByRole("button", { name: "Keep draft", exact: true }).click();
  await expect(content).toHaveValue("Keep this custom draft");
  await example.click();
  await page.getByRole("button", { name: "Replace draft", exact: true }).click();
  await expect(content).not.toHaveValue("Keep this custom draft");
  await expect(content).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("invalid fields are described inline and focus progresses to the missing key", async ({ page }) => {
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.getByRole("button", { name: "Models & keys", exact: true }).click();
  const start = page.getByRole("button", { name: "Start blind comparison" });
  const content = page.getByLabel("What should the models evaluate?");
  await start.click();
  await expect(content).toBeFocused();
  await expect(content).toHaveAttribute("aria-invalid", "true");
  await expect(content).toHaveAttribute("aria-describedby", "content-error");
  await expect(page.locator("#content-error")).toBeVisible();
  await content.fill("Synthetic claim");
  await start.click();
  await expect(page.getByLabel("What’s the judgment?")).toBeFocused();
  await page.getByLabel("What’s the judgment?").fill("Supported?");
  await page.getByLabel("Option 1", { exact: true }).fill(" ");
  await start.click();
  await expect(page.getByLabel("Option 1", { exact: true })).toBeFocused();
  await page.getByLabel("Option 1", { exact: true }).fill("Yes");
  await page.getByLabel("Task language").fill("e");
  await start.click();
  await expect(page.getByLabel("Task language")).toBeFocused();
  await page.getByLabel("Task language").fill("en");
  await start.click();
  await expect(page.getByLabel("OpenRouter", { exact: true })).toBeFocused();
  await expect(page.getByLabel("OpenRouter", { exact: true })).toHaveAttribute("aria-describedby", "key-openrouter-error");
  await expect(page.locator("#key-vercel")).toBeDisabled();
  await expect(page.locator("#key-typesafe")).toBeDisabled();
});

test("comparison and length constraints remain enforced before provider calls", async ({ page }) => {
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.getByRole("button", { name: "Models & keys", exact: true }).click();
  await page.getByRole("button", { name: "Compare two answers", exact: true }).click();
  const start = page.getByRole("button", { name: "Start blind comparison" });
  await start.click();
  await expect(page.getByLabel("Original question")).toBeFocused();
  await page.getByLabel("Original question").fill("Question");
  await page.getByLabel("Candidate answer 1").fill("A".repeat(40001));
  await page.getByLabel("Candidate answer 2").fill("B");
  await start.click();
  await expect(page.getByLabel("Candidate answer 1")).toBeFocused();
  await expect(page.locator("#answer1-error")).toContainText("40000");
  await page.getByRole("button", { name: "Make a judgment", exact: true }).click();
  await page.getByLabel("What should the models evaluate?").fill("Claim");
  await page.getByLabel("What’s the judgment?").fill("Valid?");
  await page.getByLabel("Option 1", { exact: true }).fill("A".repeat(2001));
  await start.click();
  await expect(page.getByLabel("Option 1", { exact: true })).toBeFocused();
  await expect(page.locator("#option-0-error")).toContainText("2000");
});
