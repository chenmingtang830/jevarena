import { openManualKey } from "./manual-key";
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const consentName = "I agree to Terms and acknowledge Privacy";

test("running requires explicit versioned consent and shortcuts never accept or execute", async ({ page }) => {
  const calls: string[] = [];
  await page.route("https://openrouter.ai/**", async (route) => {
    calls.push(route.request().url());
    await route.fulfill({ json: route.request().url().includes("/decisions")
      ? { answers: { judgment: { choice: "option1" } }, usage: { input_tokens: 12, output_tokens: 0, cost: 0.000001 } }
      : { model: "synthetic-version", choices: [{ finish_reason: "stop", message: { content: '{"choice":"option2"}' } }], usage: { prompt_tokens: 12, completion_tokens: 4, cost: 0.00001 } },
    });
  });
  await page.goto("/play");
  const question = page.getByLabel("Question and context");
  const consent = page.getByRole("checkbox", { name: consentName, exact: true });
  const start = page.getByRole("button", { name: "Start judging", exact: true });
  await expect(consent).toHaveCount(0);
  await question.fill("Synthetic consent test: is 2 + 2 equal to 4?");
  await question.press("Control+Enter");
  await expect(page.locator("#preflight-heading")).toBeFocused();
  await expect(consent).toHaveCount(0);
  expect(calls).toEqual([]);
  await openManualKey(page);
  await expect(consent).not.toBeChecked();
  await expect(start).toBeDisabled();
  await expect(page.locator("[data-policy-version]")).toHaveAttribute("data-policy-version", "2026-09-19");
  for (const [name, href] of [["Read Terms", "/terms"], ["Read Privacy", "/privacy"]]) {
    const link = page.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
  }
  await openManualKey(page);
  await page.getByLabel("OpenRouter", { exact: true }).fill("synthetic-key-never-stored");
  await expect(start).toBeDisabled();
  await page.getByLabel("OpenRouter", { exact: true }).press("Enter");
  await expect(consent).not.toBeChecked();
  expect(calls).toEqual([]);
  for (const shortcut of ["Control+Enter", "Meta+Enter"]) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(question).toBeFocused();
    await question.press(shortcut);
    await expect(consent).not.toBeChecked();
    await expect(start).toBeDisabled();
    expect(calls).toEqual([]);
  }
  await consent.focus();
  await page.keyboard.press("Space");
  await expect(consent).toBeChecked();
  await expect(start).toBeEnabled();
  // Even after consent, composer shortcuts are review-only, not paid execution.
  await page.keyboard.press("Escape");
  await expect(question).toBeFocused();
  await question.press("Meta+Enter");
  expect(calls).toEqual([]);
  await consent.uncheck();
  await expect(start).toBeDisabled();
  await consent.check();
  expect(calls).toEqual([]);
  await start.click();
  await expect(page.getByText("Which judgment is better?", { exact: true })).toBeVisible();
  expect(calls).toHaveLength(2);
  const results = page.getByRole("region", { name: "Comparison results" });
  await expect(results).not.toContainText("synthetic-version");
  await expect(results).not.toContainText("probability");
  await page.getByRole("button", { name: "Both good", exact: true }).click();
  await page.getByRole("button", { name: "Share this experiment" }).click();
  await expect(page.getByLabel("I consent to research use of this task, model runs and vote.")).not.toBeChecked();
  await expect(page.getByLabel(/I have reviewed this content and am comfortable sharing it/)).not.toBeChecked();
  await expect(page.locator(".share-preview")).not.toContainText("synthetic-key-never-stored");
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain("synthetic-key-never-stored");
  expect(stored).not.toContain(consentName);
  await page.reload();
  await expect(page.getByRole("heading", { name: "No active battle" })).toBeVisible();
  expect(calls).toHaveLength(2);
  await page.getByRole("link", { name: "Start a new question" }).click();
  await question.fill("Fresh tab-memory consent check");
  await start.click();
  await expect(consent).toHaveCount(0);
  await openManualKey(page);
  await expect(consent).not.toBeChecked();
  await expect(page.getByLabel("OpenRouter", { exact: true })).toHaveValue("");
  await expect(start).toBeDisabled();
  expect(calls).toHaveLength(2);
});

test("public cases and policy reading do not require consent or infer", async ({ page }) => {
  const unexpected: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/")) {
      unexpected.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  for (const path of ["/cases", "/cases/phishing-email", "/terms", "/privacy"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page).not.toHaveTitle(/404/);
    await expect(page.getByRole("checkbox", { name: consentName, exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(unexpected).toEqual([]);
});

test("model setup is a contained modal and close or Escape restores the draft without calls", async ({ page }, testInfo) => {
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
  const question = page.getByLabel("Question and context");
  const start = page.getByRole("button", { name: "Start judging", exact: true });
  await question.fill("Synthetic modal draft");
  await page.getByLabel("Option 2", { exact: true }).fill("Not supported");
  await start.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#preflight-heading")).toBeFocused();
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await mkdir("../.impeccable/review", { recursive: true });
  await page.screenshot({ path: `../.impeccable/review/model-setup-${testInfo.project.name}.png` });
  await openManualKey(page);
  await page.getByLabel("OpenRouter", { exact: true }).fill("synthetic-modal-key");
  await page.getByRole("checkbox", { name: consentName, exact: true }).check();
  await page.getByRole("button", { name: "Close model setup", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(start).toBeFocused();
  await expect(question).toHaveValue("Synthetic modal draft");
  await expect(page.getByLabel("Option 2", { exact: true })).toHaveValue("Not supported");
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await start.click();
  await expect(page.getByLabel("OpenRouter", { exact: true })).toHaveValue("synthetic-modal-key");
  await expect(page.getByRole("checkbox", { name: consentName, exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(start).toBeFocused();
  expect(requests).toEqual([]);
});
