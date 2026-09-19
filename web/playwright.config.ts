import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    // Auth forms use isolated synthetic configuration. Tests intercept email and
    // history mutations before the server; never use local or cloud credentials.
    env: {
      JEVARENA_AUTH_ENABLED: "true",
      SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_test_key_not_a_credential",
      JEVARENA_SITE_URL: "https://jevarena-tests.invalid",
    },
  },
});
