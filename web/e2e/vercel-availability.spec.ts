import { openManualKey } from "./manual-key";
import { expect, test } from "@playwright/test";

test("Vercel stays disabled while its required relay setup is pending; opening setup never calls a provider", async ({ page }) => {
  const unexpected: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/")) {
      unexpected.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/play");
  await page.getByLabel("Question and context").fill("Synthetic provider availability check");
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await openManualKey(page);
  const provider = page.getByLabel("API provider", { exact: true });
  await expect(provider).not.toBeVisible();
  await expect(provider).toHaveValue("openrouter");
  await expect(provider.locator('option[value="vercel"]')).toBeDisabled();
  await expect(provider.locator('option[value="vercel"]')).toHaveText("Vercel AI Gateway · setup pending");
  await expect(dialog.getByRole("link", { name: "Use Vercel locally" })).toHaveAttribute("href", "/run-locally");
  await expect(dialog.getByRole("button", { name: "Continue to OpenRouter" })).toHaveCount(0);
  await expect(page.getByLabel("OpenRouter", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Vercel AI Gateway", { exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="password"]:visible')).toHaveCount(1);
  await expect(page.getByRole("checkbox", { name: "I agree to Terms and acknowledge Privacy", exact: true })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Start judging", exact: true })).toBeDisabled();
  expect(unexpected).toEqual([]);
  await page.getByRole("button", { name: "Close model setup", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(unexpected).toEqual([]);
});
