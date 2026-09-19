import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("quickstart editing, clear and undo work by keyboard without sending data", async ({ page }, testInfo) => {
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
  const privacy = page.getByRole("region", { name: "Privacy before you run" });
  const text = page.getByLabel("Question and context");
  await expect(privacy).not.toBeVisible();
  await expect(page.locator("textarea:visible")).toHaveCount(1);
  await mkdir("../.impeccable/review", { recursive: true });
  await page.screenshot({ path: `../.impeccable/review/quickstart-empty-${testInfo.project.name}.png`, fullPage: true });
  const example = page.getByRole("button", { name: "A surprising remainder", exact: true });
  await example.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".selected-example")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit text", exact: true })).toHaveCount(0);
  await expect(privacy).toBeVisible();
  await expect(text).toBeFocused();
  await expect(text).toBeEditable();
  const border = await text.evaluate((node) => {
    const style = getComputedStyle(node);
    return { widths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth], style: style.borderTopStyle };
  });
  expect(border.widths.every((width) => Number.parseFloat(width) > 0)).toBe(true);
  expect(border.style).not.toBe("none");
  const original = await text.inputValue();
  const edited = `${original}\nMy additional context.`;
  await text.fill(edited);
  await page.getByLabel("Option 2", { exact: true }).fill("Not phishing");
  await expect(text).toHaveValue(edited);
  await page.getByRole("button", { name: "Clear", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(text).toHaveValue("");
  await expect(text).toBeFocused();
  await expect(privacy).not.toBeVisible();
  await page.getByRole("button", { name: "Undo clear", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(text).toHaveValue(edited);
  await expect(text).toBeEditable();
  await expect(text).toBeFocused();
  await expect(page.getByLabel("Option 2", { exact: true })).toHaveValue("Not phishing");
  await expect(privacy).toBeVisible();
  const disclosure = page.locator("summary").filter({ hasText: "Privacy: your text goes to model providers" });
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure.locator("..")).toHaveAttribute("open", "");
  await expect(privacy).toContainText(/OpenRouter/);
  await expect(privacy).toContainText(/provider/i);
  await expect(page.locator('input[type="password"]:visible')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Connect OpenRouter" })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(requests).toEqual([]);
  await page.screenshot({ path: `../.impeccable/review/quickstart-filled-privacy-${testInfo.project.name}.png`, fullPage: true });
});

test("privacy is contextual and replacing an edited draft needs confirmation", async ({ page }) => {
  const requests: string[] = [];
  await page.route("https://openrouter.ai/**", (route) => {
    if (route.request().method() === "GET") return route.abort();
    requests.push(route.request().url());
    return route.abort();
  });
  await page.goto("/play");
  const privacy = page.getByRole("region", { name: "Privacy before you run" });
  const simple = page.getByLabel("Question and context");
  await simple.fill(" ");
  await expect(privacy).toBeVisible();
  await simple.fill("My private question");
  await page.getByLabel("Option 1", { exact: true }).fill("My custom answer");
  await expect(privacy).toBeVisible();
  await page.getByRole("button", { name: "A surprising remainder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Replace draft", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keep draft", exact: true }).click();
  await expect(simple).toHaveValue("My private question");
  await expect(page.getByLabel("Option 1", { exact: true })).toHaveValue("My custom answer");
  await expect(simple).toBeFocused();
  expect(requests).toEqual([]);
});

test("composer keyboard shortcuts open review without executing a comparison", async ({ page }) => {
  const requests: string[] = [];
  await page.route("https://openrouter.ai/**", (route) => {
    if (route.request().method() === "GET") return route.abort();
    requests.push(route.request().url());
    return route.abort();
  });
  for (const shortcut of ["Control+Enter", "Meta+Enter"]) {
    await page.goto("/play");
    const composer = page.getByLabel("Question and context");
    await composer.fill("Synthetic keyboard review only");
    await composer.press(shortcut);
    await expect(page.getByRole("heading", { name: "Connect OpenRouter" })).toBeVisible();
    await expect(page.locator("#preflight-heading")).toBeFocused();
    await expect(page.getByRole("button", { name: "Start judging", exact: true })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "I agree to Terms and acknowledge Privacy", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(composer).toBeFocused();
    await expect(page.getByRole("region", { name: "Privacy before you run" })).toBeVisible();
    await expect(composer).toHaveValue("Synthetic keyboard review only");
    expect(requests).toEqual([]);
  }
});
