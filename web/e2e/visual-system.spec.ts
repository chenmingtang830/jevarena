import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function renderedFonts(page: Page, selector: string) {
  const session = await page.context().newCDPSession(page);
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  const { root } = await session.send("DOM.getDocument");
  const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  const result = await session.send("CSS.getPlatformFontsForNode", { nodeId });
  await session.detach();
  return result.fonts.filter((font) => font.glyphCount > 0);
}

test("pinned typography loads real font faces across the composer and reading routes", async ({ page }, testInfo) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" && !url.pathname.startsWith("/api/")
      ? route.continue() : route.abort();
  });
  await mkdir("../.impeccable/review", { recursive: true });
  const fontEvidence: unknown[] = [];
  for (const [path, name] of [["/", "home"], ["/cases", "cases"], ["/methodology", "methodology"]]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const evidence = await page.locator("h1").evaluate((heading) => ({
      bodyFamily: getComputedStyle(document.body).fontFamily,
      headingFamily: getComputedStyle(heading).fontFamily,
      loadedFaces: [...document.fonts].filter((face) => face.status === "loaded").map((face) => ({ family: face.family, status: face.status })),
    }));
    expect(evidence.bodyFamily).toMatch(/DM Sans/i);
    expect(evidence.headingFamily).toMatch(/DM Sans/i);
    expect(evidence.loadedFaces.some((face) => /DM Sans/i.test(face.family))).toBe(true);
    const actualHeadingFonts = await renderedFonts(page, "h1");
    expect(actualHeadingFonts.length).toBeGreaterThan(0);
    expect(actualHeadingFonts.every((font) => /DM Sans/i.test(font.familyName) && font.isCustomFont)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    fontEvidence.push({ route: path, ...evidence, actualHeadingFonts });
    await page.screenshot({ path: `../.impeccable/review/${name}-${testInfo.project.name}.png`, fullPage: true });
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Task options", exact: true }).click();
  await page.locator(".option-index").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  const monoFamily = await page.locator(".option-index").first().evaluate((node) => getComputedStyle(node).fontFamily);
  expect(monoFamily).toMatch(/IBM Plex Mono/i);
  const loadedMonoFaces = await page.evaluate(() => [...document.fonts].filter((face) => /IBM Plex Mono/i.test(face.family) && face.status === "loaded").map((face) => face.family));
  expect(loadedMonoFaces.length).toBeGreaterThan(0);
  const actualMonoFonts = await renderedFonts(page, ".option-index");
  expect(actualMonoFonts.length).toBeGreaterThan(0);
  expect(actualMonoFonts.every((font) => /IBM Plex Mono/i.test(font.familyName) && font.isCustomFont)).toBe(true);
  fontEvidence.push({ selector: ".option-index", monoFamily, loadedMonoFaces, actualMonoFonts });
  await testInfo.attach("rendered-font-evidence", { body: JSON.stringify(fontEvidence, null, 2), contentType: "application/json" });
});
