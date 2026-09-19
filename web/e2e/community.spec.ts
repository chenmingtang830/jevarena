import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("community sources remain attributed and read-only without search", async ({ page }, testInfo) => {
  const externalRequests: string[] = [];
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname !== "127.0.0.1") {
      externalRequests.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/cases");
  const library = page.getByRole("region", { name: "Community reports" });
  await expect(library.locator("article")).toHaveCount(4);
  await expect(library.getByRole("link", { name: "Malte Ubl (@cramforce)" })).toHaveAttribute("href", "https://x.com/cramforce");
  await expect(library.getByRole("link", { name: "Original post on X", exact: true }).first()).toHaveAttribute("href", "https://x.com/cramforce/status/2100269198727602468");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByText("Negation in Chinese", {exact:true})).toHaveCount(0);
  await expect(library.getByText(/418,197 views/)).not.toBeVisible();
  await library.locator("#command-safety-rauchg").getByText("Source snapshot and engagement", { exact: true }).click();
  await expect(library.getByText(/418,197 views/)).toBeVisible();
  await library.locator("#command-safety-rauchg").getByRole("link", { name: /Read case study/ }).click();
  await expect(page).toHaveURL(/\/cases\/command-safety-rauchg$/);
  await expect(page.getByText(/Never execute the commands/)).toBeVisible();
  await page.getByRole("link", { name: "Back to community case studies" }).click();
  await expect(library.locator("article")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(externalRequests).toEqual([]);
  await mkdir("../.impeccable/review", { recursive: true });
  await page.screenshot({ path: `../.impeccable/review/community-${testInfo.project.name}.png`, fullPage: true });
});

const studies = [
  { id: "classifier-eval-cramforce", author: "Malte Ubl (@cramforce)", handle: "cramforce", post: "2100269198727602468" },
  { id: "command-safety-rauchg", author: "Guillermo Rauch (@rauchg)", handle: "rauchg", post: "2100307962262872105" },
  { id: "computer-use-trycua", author: "Cua (@trycua)", handle: "trycua", post: "2100649543079502213" },
  { id: "classifier-framing-nathanflurry", author: "Nathan Flurry (@NathanFlurry)", handle: "NathanFlurry", post: "2100036101809619314" },
];

for (const study of studies) {
  test(`direct community case study: ${study.id}`, async ({ page }, testInfo) => {
    const unexpectedRequests: string[] = [];
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/")) {
        unexpectedRequests.push(url.href);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(`/cases/${study.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: study.author, exact: true })).toHaveAttribute("href", `https://x.com/${study.handle}`);
    await expect(page.getByRole("link", { name: "Read original post on X" })).toHaveAttribute("href", `https://x.com/${study.handle}/status/${study.post}`);
    await expect(page.getByRole("heading", { name: "Evidence limits" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Proposed reproduction protocol" })).toBeVisible();
    await expect(page.getByText(/not a runnable benchmark fixture/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Contribute evidence" })).toHaveAttribute("href", "/contribute");
    await expect(page.getByText(/CC-BY-4.0 license does not apply/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Start|Run|Replay/ })).toHaveCount(0);
    await expect(page).not.toHaveTitle(/JevArena.*JevArena/);
    expect(await page.locator('meta[name="description"]').getAttribute("content")).toContain("not reproduced");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(unexpectedRequests).toEqual([]);
    if (study.id === "command-safety-rauchg") {
      await mkdir("../.impeccable/review", { recursive: true });
      await page.screenshot({ path: `../.impeccable/review/study-${testInfo.project.name}.png`, fullPage: true });
    }
  });
}
