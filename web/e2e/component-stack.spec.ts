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
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Your claim or question" })).toHaveAttribute("data-slot", "textarea");
  const starter = page.getByRole("button", { name: "Check a claim", exact: true });
  await expect(starter).toHaveAttribute("data-slot", "button");
  await starter.click();
  await expect(page.getByRole("region", { name: "Privacy before you run" })).toBeVisible();
  await page.getByRole("button", { name: "Review & compare" }).click();
  await expect(page.locator('[data-slot="native-select"]').first()).toBeVisible();
  expect(paidRequests).toBe(0);
});
