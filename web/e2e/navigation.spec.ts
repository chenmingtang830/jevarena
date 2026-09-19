import { test, expect } from "@playwright/test";

test("navigation remains named and available on mobile and desktop", async ({ page }) => {
  await page.goto("/cases");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Cases", exact: true })).toHaveAttribute("aria-current", "page");
  const github = nav.getByRole("link", { name: "JevArena on GitHub (opens in a new tab)", exact: true });
  await expect(github).toBeVisible();
  const bounds = await github.boundingBox();
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  await nav.getByRole("link", { name: "Methodology" }).click();
  await expect(page).toHaveURL(/\/methodology$/);
  await expect(nav.getByRole("link", { name: "Methodology" })).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
