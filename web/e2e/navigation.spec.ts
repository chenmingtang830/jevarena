import { test, expect } from "@playwright/test";

test("navigation remains named and available on mobile and desktop", async ({ page }) => {
  await page.goto("/cases");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Examples", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Try it", exact: true })).toHaveAttribute("href", "/");
  await expect(nav.getByRole("link", { name: "Test your own", exact: true })).toHaveAttribute("href", "/play");
  await expect(nav.getByRole("link", { name: /Results|Methodology/ })).toHaveCount(0);
  const github = nav.getByRole("link", { name: "JevArena on GitHub (opens in a new tab)", exact: true });
  await expect(github).toBeVisible();
  const bounds = await github.boundingBox();
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Research results" })).toHaveAttribute("href", "/results");
  await footer.getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/methodology$/);
  await expect(footer.getByRole("link", { name: "How it works" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
