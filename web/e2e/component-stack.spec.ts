import { openManualKey } from "./manual-key";
import { test, expect } from "@playwright/test";

test("registry components preserve the quick-start and preflight boundary", async ({ page }) => {
  let paidRequests = 0;
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/")) {
      paidRequests++;
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/play");
  await expect(page.getByRole("textbox", { name: "Question and context" })).toHaveAttribute("data-slot", "textarea");
  await expect(page.getByRole("textbox", { name: "Option 1", exact: true })).toHaveAttribute("data-slot", "input");
  const starter = page.getByRole("button", { name: "Phishing email", exact: true });
  await expect(starter).toHaveAttribute("data-slot", "button");
  await starter.click();
  await expect(page.getByRole("region", { name: "Privacy before you run" })).toBeVisible();
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await expect(page.locator("#rival")).not.toBeVisible();
  await expect(page.locator("#preflight-heading")).toBeFocused();
  await openManualKey(page);
  await page.locator("#key-openrouter").fill("test-only-not-a-real-key");
  await expect(page.locator("#rival")).not.toBeVisible();
  await page.locator("summary").filter({ hasText: "Model settings" }).click();
  await expect(page.locator("#rival")).toBeVisible();
  expect(paidRequests).toBe(0);
});
