import { test, expect } from "@playwright/test";

test("email login is optional and requires explicit policy consent before one intercepted request", async ({ page }) => {
  const forms: Record<string, string>[] = [];
  const external: string[] = [];
  await page.route("**/*", route => {
    if (new URL(route.request().url()).hostname !== "127.0.0.1") {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  // Always intercept before the backend: this test must never send an email.
  await page.route("**/auth/email", route => {
    expect(route.request().method()).toBe("POST");
    forms.push(Object.fromEntries(new URLSearchParams(route.request().postData() ?? "")));
    return route.fulfill({ status: 303, headers: { location: "/login?sent=1" } });
  });
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Continue without an account" })).toHaveAttribute("href", "/");
  await expect(page.locator("main")).toContainText("API keys are never saved to your account");
  const email = page.getByLabel("Email", { exact: true });
  const accept = page.getByRole("checkbox", { name: /I agree to the Terms and acknowledge the Privacy Policy/ });
  const submit = page.getByRole("button", { name: "Continue with email", exact: true });
  await expect(email).toHaveAttribute("type", "email");
  await expect(accept).not.toBeChecked();
  await expect(submit).toBeDisabled();
  await email.fill("synthetic-login@example.invalid");
  await email.press("Enter");
  await expect(accept).not.toBeChecked();
  expect(forms).toEqual([]);
  await accept.check();
  await expect(submit).toBeEnabled();
  expect(forms).toEqual([]);
  await submit.click();
  await expect(page).toHaveURL(/\/login\?sent=1$/);
  await expect(page.getByRole("status")).toContainText("If the address is eligible");
  expect(forms).toEqual([{ email: "synthetic-login@example.invalid", policy: "2026-09-19-auto-review-v1" }]);
  await expect(page.locator("main")).not.toContainText("synthetic-login@example.invalid");
  await page.getByRole("link", { name: "Continue without an account" }).click();
  await expect(page.getByLabel("Question and context")).toBeEditable();
  expect(external).toEqual([]);
});

test("invalid email callback fails to a generic notice without leaking error or invoking a provider", async ({ page }) => {
  const unexpected: string[] = [];
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/") || url.pathname === "/auth/email") {
      unexpected.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  // No authorization code: the server rejects locally without contacting Supabase.
  const callback = await page.request.get("/auth/callback?error=SECRET_EMAIL_PROVIDER_DIAGNOSTIC", { maxRedirects: 0 });
  expect(callback.status()).toBe(303);
  expect(callback.headers()["location"]).toBe("https://jevarena-tests.invalid/login?error=signin");
  expect(callback.headers()["cache-control"]).toBe("no-store");
  expect(callback.headers()["referrer-policy"]).toBe("no-referrer");
  // Verify its local page without following the intentionally non-resolving test origin.
  await page.goto("/login?error=signin");
  await expect(page).toHaveURL(/\/login\?error=signin$/);
  await expect(page.locator("main").getByRole("alert")).toContainText("Sign-in did not complete");
  await expect(page.locator("body")).not.toContainText("SECRET_EMAIL_PROVIDER_DIAGNOSTIC");
  await expect(page.getByRole("button", { name: "Continue with email", exact: true })).toBeDisabled();
  expect(unexpected).toEqual([]);
});
