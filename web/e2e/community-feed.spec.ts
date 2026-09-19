import { expect, test } from "@playwright/test";

test("community shows a real empty state and never calls models", async ({ page }) => {
  let modelCalls = 0;
  page.on("request", (request) => { if (/openrouter|ai-gateway/.test(request.url())) modelCalls++; });
  await page.route("**/api/community", (route) => route.fulfill({ json: { items: [] } }));
  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "No published questions yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Submit a question" })).toHaveAttribute("href", "/community/submit");
  expect(modelCalls).toBe(0);
});

test("community questions open an editable replay without a model call", async ({ page }) => {
  await page.route("**/api/community", (route) => route.fulfill({ json: { items: [{
    id: "synthetic-community-test", submittedAt: "2026-09-19T12:00:00Z", license: "CC-BY-4.0",
    moderation: { decision: "publish", reason: "Suitable question", model: "typesafe/jev" },
    challenge: { schemaVersion: 1, id: "synthetic-community-test", title: "Synthetic community test", language: "en", kind: "judgment", content: "What is 2 + 2?", question: "Choose a value", options: [{ id: "a", label: "4" }, { id: "b", label: "5" }] },
  }] } }));
  let calls = 0;
  page.on("request", (request) => { if (/openrouter|ai-gateway/.test(request.url())) calls++; });
  await page.goto("/community");
  await expect(page.getByText("AI-screened · not fact-checked", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Choose models & run", exact: true }).click();
  await expect(page).toHaveURL(/\/share#v1\./);
  await expect(page.getByRole("heading", { name: "Synthetic community test", exact: true })).toBeVisible();
  expect(calls).toBe(0);
});

test("community fetch failures are not presented as an empty feed", async ({ page }) => {
  await page.route("**/api/community", (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto("/community");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("could not load");
  await expect(page.getByRole("heading", { name: "No published questions yet" })).toHaveCount(0);
});
