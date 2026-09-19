import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const blockedRequests = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const requests: string[] = [];
  blockedRequests.set(page, requests);
  // Only local static pages/assets are allowed. None of these tests may infer or collect.
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/")) {
      requests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/");
});
test.afterEach(async ({ page }) => expect(blockedRequests.get(page)).toEqual([]));

async function connect(page: Page) {
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await expect(page.getByLabel("OpenRouter", { exact: true })).toBeFocused();
  await page.getByLabel("OpenRouter", { exact: true }).fill("test-only-not-a-real-key");
}

test("first viewport offers a question, possible answers and start before configuration", async ({ page }, testInfo) => {
  await expect(page.getByLabel("Question and context")).toBeInViewport();
  await expect(page.getByLabel("Option 1", { exact: true })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Start judging", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir("../.impeccable/review", { recursive: true });
  await page.screenshot({ path: `../.impeccable/review/home-${testInfo.project.name}.png`, fullPage: true });
});

test("editable answers support two through ten options and drafts stay in tab memory", async ({ page }) => {
  const question = page.getByLabel("Question and context");
  await question.fill("Private judgment draft");
  await page.getByLabel("Option 1", { exact: true }).fill("Supported");
  await expect(page.getByRole("button", { name: "Remove option 1", exact: true })).toBeDisabled();
  const add = page.getByRole("button", { name: "Add option", exact: true });
  for (let i = 3; i <= 10; i++) {
    await add.click();
    await page.getByLabel(`Option ${i}`, { exact: true }).fill(`Private answer ${i}`);
  }
  await expect(page.getByRole("textbox", { name: /^Option \d+$/ })).toHaveCount(10);
  await expect(add).toBeDisabled();
  await page.getByRole("button", { name: "Remove option 2", exact: true }).click();
  await expect(page.getByLabel("Option 2", { exact: true })).toHaveValue("Private answer 3");
  await expect(add).toBeEnabled();
  for (let i = 9; i > 2; i--) await page.getByRole("button", { name: `Remove option ${i}`, exact: true }).click();
  await expect(page.getByRole("textbox", { name: /^Option \d+$/ })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Remove option 2", exact: true })).toBeDisabled();
  await connect(page);
  await page.locator("summary").filter({ hasText: "Model settings" }).click();
  await page.getByLabel("Task language").fill("zh");
  await page.locator("summary").filter({ hasText: "Model settings" }).click();
  await expect(question).toHaveValue("Private judgment draft");
  await expect(page.getByLabel("Option 1", { exact: true })).toHaveValue("Supported");
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain("Private");
  expect(stored).not.toContain("test-only-not-a-real-key");
  await page.reload();
  await expect(question).toHaveValue("");
  await expect(page.getByLabel("Option 1", { exact: true })).toHaveValue("Yes");
  await expect(page.getByLabel("Option 2", { exact: true })).toHaveValue("No");
  await expect(page.locator('input[type="password"]:visible')).toHaveCount(0);
});

test("examples acknowledge loading, focus the question and protect custom answers", async ({ page }) => {
  const example = page.getByRole("button", { name: "Phishing email", exact: true });
  const question = page.getByLabel("Question and context");
  await expect(page.getByRole("link", { name: "Browse cases without a key" })).toHaveAttribute("href", "/cases");
  await example.click();
  await expect(question).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Example filled in" })).toHaveCount(1);
  await page.getByLabel("Option 1", { exact: true }).fill("Custom response");
  await page.getByRole("button", { name: "Math claim", exact: true }).click();
  await expect(page.getByRole("button", { name: "Replace draft", exact: true })).toBeFocused();
  await expect(page.getByLabel("Option 1", { exact: true })).toHaveValue("Custom response");
  await page.getByRole("button", { name: "Keep draft", exact: true }).click();
  await expect(page.getByLabel("Option 1", { exact: true })).toHaveValue("Custom response");
  await expect(question).toBeFocused();
  await example.click();
  await page.getByRole("button", { name: "Replace draft", exact: true }).click();
  await expect(page.getByLabel("Option 1", { exact: true })).toHaveValue("Yes");
  await expect(question).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("invalid fields and hidden budget or language errors focus the actionable control", async ({ page }) => {
  const start = page.getByRole("button", { name: "Start judging", exact: true });
  const question = page.getByLabel("Question and context");
  await start.click();
  await expect(question).toBeFocused();
  await expect(question).toHaveAttribute("aria-invalid", "true");
  await expect(question).toHaveAttribute("aria-describedby", /content-error/);
  await expect(page.locator("#content-error")).toBeVisible();
  await expect(page.locator('input[type="password"]:visible')).toHaveCount(0);
  await question.fill("Synthetic claim");
  await start.click();
  await expect(start).toBeDisabled();
  const key = page.getByLabel("OpenRouter", { exact: true });
  await key.fill("test-only-not-a-real-key");
  await page.getByLabel("Option 1", { exact: true }).fill(" ");
  await start.click();
  await expect(page.getByLabel("Option 1", { exact: true })).toBeFocused();
  await expect(page.locator("#option-0-error")).toBeVisible();
  await page.getByLabel("Option 1", { exact: true }).fill("Yes");
  const settings = page.locator("summary").filter({ hasText: "Model settings" });
  await settings.click();
  await page.getByLabel("Task language").fill("e");
  await settings.click();
  await start.click();
  await expect(settings.locator("..")).toHaveAttribute("open", "");
  await expect(page.getByLabel("Task language")).toBeFocused();
  await page.getByLabel("Task language").fill("en");
  await page.getByLabel("Estimate threshold (USD)").fill("0");
  await settings.click();
  await start.click();
  await expect(settings.locator("..")).toHaveAttribute("open", "");
  await expect(page.getByLabel("Estimate threshold (USD)")).toBeFocused();
  await expect(page.locator("#budget-error")).toBeVisible();
  await key.fill("");
  await expect(start).toBeDisabled();
  await expect(page.locator("#key-vercel")).toHaveCount(0);
  await expect(page.locator("#key-typesafe")).toHaveCount(0);
  await expect(page.getByLabel("Use Jev through")).not.toBeVisible();
});

test("imported comparisons and answer length limits are enforced before provider calls", async ({ page }) => {
  await page.goto("/cases/decimal-comparison");
  const prompt = page.getByLabel("Original question");
  await expect(prompt).toBeEditable();
  await expect(page.getByLabel("Candidate answer 1")).toBeEditable();
  await expect(page.getByLabel("Candidate answer 2")).toBeEditable();
  await connect(page);
  const start = page.getByRole("button", { name: "Start judging", exact: true });
  await prompt.fill(" ");
  await start.click();
  await expect(prompt).toBeFocused();
  await prompt.fill("Question");
  await page.getByLabel("Candidate answer 1").fill("A".repeat(40001));
  await page.getByLabel("Candidate answer 2").fill("B");
  await start.click();
  await expect(page.getByLabel("Candidate answer 1")).toBeFocused();
  await expect(page.locator("#answer1-error")).toContainText("40000");
  await page.goto("/");
  await page.getByLabel("Question and context").fill("Claim");
  await connect(page);
  await page.getByLabel("Option 1", { exact: true }).fill("A".repeat(2001));
  await start.click();
  await expect(page.getByLabel("Option 1", { exact: true })).toBeFocused();
  await expect(page.locator("#option-0-error")).toContainText("2000");
});

test("an imported whitespace-only rubric reports an editable error instead of an invisible field", async ({ page }) => {
  const value = {
    schemaVersion: 1, id: "synthetic-whitespace-rubric", license: "CC-BY-4.0", status: "community-submitted", runs: [],
    challenge: { schemaVersion: 1, id: "synthetic-import", title: "Whitespace rubric regression", language: "en", kind: "judgment", content: "Synthetic imported statement", question: " ", options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] },
  };
  await page.goto("/share");
  await page.locator("input[type=file]").setInputFiles({ name: "import.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(value)) });
  const question = page.getByLabel("Question and context");
  await expect(question).toHaveValue(" \n\nSynthetic imported statement");
  await connect(page);
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await expect(question).toBeFocused();
  await expect(question).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#content-error")).toContainText("imported question is blank");
  await question.fill("Is this synthetic imported statement supported?");
  await expect(question).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator("#content-error")).toHaveCount(0);
});
