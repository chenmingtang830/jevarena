import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("community sources remain attributed, searchable and read-only", async ({ page }, testInfo) => {
  const externalRequests: string[] = [];
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname !== "127.0.0.1") {
      externalRequests.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/cases");
  const library = page.getByRole("region", { name: "From the Jev community" });
  await expect(library.locator("article")).toHaveCount(4);
  await expect(library.getByRole("link", { name: "Malte Ubl (@cramforce)" })).toHaveAttribute("href", "https://x.com/cramforce");
  await expect(library.getByRole("link", { name: "Read original post on X" }).first()).toHaveAttribute("href", "https://x.com/cramforce/status/2100269198727602468");
  await library.getByLabel("Find a community report or author").fill("rauchg");
  await expect(library.locator("article")).toHaveCount(1);
  await library.locator("summary").click();
  await expect(library.getByText(/Never execute the commands/)).toBeVisible();
  await library.getByLabel("Find a community report or author").fill("no-such-source");
  await expect(library.getByText(/No matching reports/)).toBeVisible();
  await library.getByLabel("Find a community report or author").fill("");
  await expect(library.locator("article")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(externalRequests).toEqual([]);
  await mkdir("../.impeccable/review", { recursive: true });
  await page.screenshot({ path: `../.impeccable/review/community-${testInfo.project.name}.png`, fullPage: true });
});
