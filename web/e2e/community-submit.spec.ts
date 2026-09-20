import { expect, test } from "@playwright/test";

test.skip(process.env.NEXT_PUBLIC_AUTO_REVIEW_ENABLED !== "true" || process.env.NEXT_PUBLIC_PUBLIC_COLLECTION_ENABLED !== "true" || process.env.NEXT_PUBLIC_CONTRIBUTIONS_ENABLED !== "true", "Automated community intake is deployment gated");

test("a visitor submits a question once without a provider key", async ({ page }) => {
  const submissions: Record<string, any>[] = [];
  let modelCalls = 0;
  page.on("request", (request) => { if (/openrouter|ai-gateway/.test(request.url())) modelCalls++; });
  await page.route("**/api/contributions", async (route) => {
    const body = route.request().postDataJSON(); submissions.push(body);
    await route.fulfill({ status: 201, json: { receiptId: body.submissionId, deletionToken: body.deletionToken, status: "community-submitted", receivedAt: "2026-09-19T12:00:00Z", expiresAt: "2026-10-19T12:00:00Z" } });
  });
  await page.goto("/community/submit");
  await expect(page.getByRole("checkbox", { name: "Contribute publicly" })).toBeChecked();
  await page.getByLabel("Your question").fill("What is 2 + 2?");
  await page.getByLabel("Possible answers").fill("4\n5");
  expect(submissions).toHaveLength(0);
  await page.getByRole("checkbox", { name: "Contribute publicly" }).uncheck();
  await expect(page.getByRole("button", { name: "Submit question", exact: true })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Contribute publicly" }).check();
  await page.getByRole("button", { name: "Submit question", exact: true }).click();
  await expect(page.getByText("Submitted for AI screening. It will publish if it passes.")).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0].consent).toMatchObject({ version: "2026-09-19-auto-review-v1", automatedReview: true, reviewProvider: "vercel", publication: "after-ai-review" });
  expect(submissions[0].contribution.runs).toEqual([]);
  expect(submissions[0].contribution.challenge.content).toBe("What is 2 + 2?");
  expect(JSON.stringify(submissions[0])).not.toContain("apiKey");
  await expect(page.getByLabel("Your question")).toBeDisabled();
  expect(modelCalls).toBe(0);
});

test("question submission validates answers before upload", async ({ page }) => {
  await page.goto("/community/submit");
  await page.getByLabel("Your question").fill("Question");
  await page.getByLabel("Possible answers").fill("Only one");
  await expect(page.getByRole("button", { name: "Submit question", exact: true })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Question quality" })).toContainText("Add at least two possible answers");
});
