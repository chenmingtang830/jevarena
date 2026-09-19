import { test, expect } from "@playwright/test";

test("OpenRouter popup returns a tab-only key without running models", async ({ page, context }) => {
  const requests: string[] = [];
  let exchangeBody: Record<string, string> | undefined;
  await context.route("https://openrouter.ai/**", async route => {
    const url = new URL(route.request().url());
    requests.push(url.pathname);
    if (url.pathname === "/auth") {
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      const callback = new URL(url.searchParams.get("callback_url")!);
      expect(callback.searchParams.get("state")).toMatch(/^[\w-]{43}$/);
      callback.searchParams.set("code", "synthetic-authorization-code");
      await route.fulfill({ status: 302, headers: { location: callback.toString() } });
    } else if (url.pathname === "/api/v1/auth/keys") {
      exchangeBody = route.request().postDataJSON();
      await route.fulfill({ json: { key: "sk-or-synthetic-connect-test" } });
    } else {
      // Never let an accidental inference request reach a real provider.
      await route.abort();
    }
  });
  await page.goto("/play");
  await page.getByLabel("Question and context").fill("Synthetic test question: is two plus two four?");
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await page.getByRole("button", { name: "Continue to OpenRouter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ready to compare" })).toBeVisible();
  expect(exchangeBody).toMatchObject({ code: "synthetic-authorization-code", code_challenge_method: "S256" });
  expect(exchangeBody?.code_verifier).toMatch(/^[\w-]{43}$/);
  expect(requests).toEqual(["/auth", "/api/v1/auth/keys"]);
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, cookies: document.cookie }))).not.toContain("sk-or-");
  await expect(page.getByRole("checkbox", { name: "I agree to Terms and acknowledge Privacy", exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Close model setup", exact: true }).click();
  await expect(page.getByLabel("Question and context")).toHaveValue("Synthetic test question: is two plus two four?");
  await page.reload();
  await page.getByLabel("Question and context").fill("Another synthetic test question");
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue to OpenRouter", exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
});
