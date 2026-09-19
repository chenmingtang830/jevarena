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
  await page.goto("/");
  const privacy = page.getByRole("region", { name: "Privacy before you run" });
  const text = page.getByLabel("Your claim or question");
  await expect(privacy).not.toBeVisible();
  await expect(page.locator("textarea:visible")).toHaveCount(1);
  await mkdir("../.impeccable/review", { recursive: true });
  await page.screenshot({ path: `../.impeccable/review/quickstart-empty-${testInfo.project.name}.png`, fullPage: true });
  const example = page.getByRole("button", { name: "Check a claim", exact: true });
  await example.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".selected-example")).toContainText("Check a claim");
  await expect(privacy).toBeVisible();
  await page.getByRole("button", { name: "Edit text", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(text).toBeFocused();
  const original = await text.inputValue();
  const edited = `${original}\nMy additional context.`;
  await text.fill(edited);
  await page.getByRole("button", { name: "Clear", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(text).toHaveValue("");
  await expect(privacy).not.toBeVisible();
  await page.getByRole("button", { name: "Undo clear", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(text).toHaveValue(edited);
  await expect(page.locator(".selected-example")).toContainText("Check a claim");
  await expect(privacy).toBeVisible();
  const disclosure = page.locator("summary").filter({ hasText: "How your data is handled" });
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure.locator("..")).toHaveAttribute("open", "");
  await expect(privacy).toContainText(/OpenRouter/);
  await expect(privacy).toContainText(/provider/i);
  await expect(page.locator('input[type="password"]:visible')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start blind comparison" })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(requests).toEqual([]);
  await page.screenshot({ path: `../.impeccable/review/quickstart-filled-privacy-${testInfo.project.name}.png`, fullPage: true });
});

test("privacy is contextual for typed and advanced drafts without replacing them", async ({ page }) => {
  const requests: string[] = [];
  await page.route("https://openrouter.ai/**", (route) => { requests.push(route.request().url()); return route.abort(); });
  await page.goto("/");
  const privacy = page.getByRole("region", { name: "Privacy before you run" });
  const simple = page.getByLabel("Your claim or question");
  await simple.fill(" ");
  await expect(privacy).toBeVisible();
  await simple.fill("My private simple draft");
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.getByLabel("What should the models evaluate?").fill("My advanced draft");
  await expect(privacy).toBeVisible();
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await expect(simple).toHaveValue("My private simple draft");
  await expect(privacy).toBeVisible();
  await page.getByRole("button", { name: "Check a claim", exact: true }).click();
  await expect(page.getByRole("button", { name: "Replace draft", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keep draft", exact: true }).click();
  await expect(simple).toHaveValue("My private simple draft");
  expect(requests).toEqual([]);
});

test("composer keyboard shortcuts open review without executing a comparison", async ({ page }) => {
  const requests: string[] = [];
  await page.route("https://openrouter.ai/**", (route) => { requests.push(route.request().url()); return route.abort(); });
  for (const shortcut of ["Control+Enter", "Meta+Enter"]) {
    await page.goto("/");
    const composer = page.getByLabel("Your claim or question");
    await composer.fill("Synthetic keyboard review only");
    await composer.press(shortcut);
    await expect(page.getByRole("heading", { name: "Review models & cost" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Privacy before you run" })).toBeVisible();
    await expect(composer).toHaveValue("Synthetic keyboard review only");
    expect(requests).toEqual([]);
  }
});
