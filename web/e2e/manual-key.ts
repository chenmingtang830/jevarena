import { expect, type Page } from "@playwright/test";

export async function openManualKey(page: Page) {
  const summary = page.locator("summary").filter({ hasText: /Use an API key instead|Manage connection/ });
  if (!(await page.getByLabel("OpenRouter", { exact: true }).isVisible())) {
    await summary.click();
  }
  await expect(page.getByLabel("OpenRouter", { exact: true })).toBeVisible();
}
