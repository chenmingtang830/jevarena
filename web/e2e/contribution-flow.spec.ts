import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

async function experiment(page: Page) {
  await page.route("https://openrouter.ai/**", async (route) => {
    await route.fulfill({ json: route.request().url().includes("/decisions")
      ? { answers: { judgment: { choice: "option1", probabilities: { option1: 0.8, option2: 0.2 } } }, usage: { input_tokens: 10, output_tokens: 0, cost: 0.000001 } }
      : { model: "mock-version", choices: [{ finish_reason: "stop", message: { content: '{"choice":"option1"}' } }], usage: { prompt_tokens: 10, completion_tokens: 4, cost: 0.00001 } },
    });
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Question and context" }).fill("Synthetic research fixture: two plus two equals four.");
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await expect(page.locator("#key-openrouter")).toBeFocused();
  await page.getByLabel("OpenRouter", { exact: true }).fill("test-only-never-collect-key");
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await page.getByRole("button", { name: "Both good", exact: true }).click();
  await page.getByRole("button", { name: "Share this experiment" }).click();
  await expect(page.getByRole("region", { name: "Contribute to research" })).toBeVisible();
}

async function consent(page: Page) {
  await page.getByLabel("I consent to research use of this task, model runs and vote.").check();
  await page.getByLabel("I have the rights to contribute this material under CC BY 4.0.").check();
  await page.getByLabel("I reviewed the preview and removed secrets and personal information.").check();
}

test("research contribution is separate opt-in, private, and returns a deletion receipt", async ({ page }, testInfo) => {
  const bodies: Record<string, any>[] = [];
  await page.route("**/api/contributions", async (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    await route.fulfill({ status: 201, json: { receiptId: body.submissionId, status: "community-submitted", receivedAt: "2026-09-19T00:00:00Z", expiresAt: "2026-10-19T00:00:00Z", deletionToken: body.deletionToken } });
  });
  await experiment(page);
  expect(bodies).toHaveLength(0);
  const submit = page.getByRole("button", { name: "Submit for private research" });
  await expect(submit).toBeDisabled();
  await mkdir("../.impeccable/review", { recursive: true });
  await page.getByRole("region", { name: "Contribute to research" }).screenshot({ path: `../.impeccable/review/contribution-consent-${testInfo.project.name}.png` });
  await page.getByLabel(/I have reviewed this content and am comfortable sharing it/).check();
  await expect(submit).toBeDisabled();
  await consent(page);
  await submit.click();
  await expect(page.getByText(/Received for private review/)).toBeVisible();
  expect(bodies).toHaveLength(1);
  expect(bodies[0].consent).toEqual({ version: "2026-09-19", research: true, rights: true, reviewed: true, allowPublication: false });
  expect(JSON.stringify(bodies[0])).not.toContain("test-only-never-collect-key");
  expect(bodies[0].contribution.vote.value).toBe("both");
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain(bodies[0].deletionToken);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download deletion receipt" }).click();
  const download = await downloadPromise;
  const receipt = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(receipt.receiptId).toBe(bodies[0].submissionId);
  expect(receipt.deletionToken).toBe(bodies[0].deletionToken);
  expect(receipt.expiresAt).toBe("2026-10-19T00:00:00Z");
  await expect(page.locator('time[datetime="2026-10-19T00:00:00Z"]')).toHaveText("2026-10-19T00:00:00.000Z");
  await page.getByRole("button", { name: "Share this experiment" }).click();
  await page.getByRole("button", { name: "Share this experiment" }).click();
  await expect(page.getByRole("button", { name: "Download deletion receipt" })).toBeVisible();
  await mkdir("../.impeccable/review", { recursive: true });
  await page.screenshot({ path: `../.impeccable/review/contribution-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("region", { name: "Contribute to research" }).screenshot({ path: `../.impeccable/review/contribution-receipt-${testInfo.project.name}.png` });
});

test("editing the experiment resets research consent and submission identity", async ({ page }) => {
  const bodies: Record<string, any>[] = [];
  await page.route("**/api/contributions", async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 503, json: { error: "unavailable" } });
  });
  await experiment(page);
  await consent(page);
  await page.getByRole("button", { name: "Submit for private research" }).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await page.getByRole("textbox", { name: "Question and context" }).fill("A different synthetic task for a new submission.");
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await page.getByRole("button", { name: "Both good", exact: true }).click();
  await page.getByRole("button", { name: "Share this experiment" }).click();
  await expect(page.getByRole("button", { name: "Submit for private research" })).toBeDisabled();
  await expect(page.getByLabel("I consent to research use of this task, model runs and vote.")).not.toBeChecked();
  expect(bodies).toHaveLength(1);
  await consent(page);
  await page.getByRole("button", { name: "Submit for private research" }).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[1].submissionId).not.toBe(bodies[0].submissionId);
  expect(bodies[1].deletionToken).not.toBe(bodies[0].deletionToken);
  expect(bodies[1].contribution.challenge.content).toContain("different synthetic task");
});

test("manual retry keeps one identity and error never leaks upstream details", async ({ page }) => {
  const bodies: unknown[] = [];
  await page.route("**/api/contributions", async (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    await route.fulfill(bodies.length === 1
      ? { status: 503, json: { error: "SECRET_SERVER_DIAGNOSTIC" } }
      : { status: 200, json: { receiptId: body.submissionId, status: "community-submitted", receivedAt: "2026-09-19T00:00:00Z", expiresAt: "2026-10-19T00:00:00Z", deletionToken: body.deletionToken } });
  });
  await experiment(page);
  await consent(page);
  await page.getByRole("button", { name: "Submit for private research" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("temporarily unavailable");
  await expect(page.locator("body")).not.toContainText("SECRET_SERVER_DIAGNOSTIC");
  await expect(page.getByRole("button", { name: "Download recovery receipt" })).toBeVisible();
  expect(bodies).toHaveLength(1);
  await page.getByRole("button", { name: "Retry research submission" }).click();
  await expect(page.getByText(/Received for private review/)).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
});

test("withdrawal reads receipt locally then explicitly deletes, with safe retry", async ({ page }) => {
  const receipt = { receiptId: "00000000-0000-4000-8000-000000000001", deletionToken: "a".repeat(43) };
  const bodies: unknown[] = [];
  await page.route("**/api/contributions/delete", async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill(bodies.length === 1 ? { status: 503, json: { error: "TEMPORARY" } } : { json: { deleted: true } });
  });
  await page.goto("/contributions/delete");
  const input = page.getByLabel("Choose your deletion receipt");
  await input.setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"deletionToken":"wrong"}') });
  await expect(page.locator("main").getByRole("alert")).toContainText("valid JevArena");
  expect(bodies).toHaveLength(0);
  await input.setInputFiles({ name: "receipt.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(receipt)) });
  const withdraw = page.getByRole("button", { name: "Withdraw submission" });
  await expect(withdraw).toBeDisabled();
  expect(bodies).toHaveLength(0);
  await expect(page.locator("body")).not.toContainText(receipt.deletionToken);
  expect(page.url()).not.toContain(receipt.deletionToken);
  await page.getByLabel("Delete this research submission from JevArena.").check();
  await withdraw.click();
  await expect(page.locator("main").getByRole("alert")).toContainText("retry");
  await withdraw.click();
  await expect(page.locator("main").getByRole("status")).toContainText("Submission withdrawn");
  expect(bodies).toEqual([receipt, receipt]);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(receipt.deletionToken);
});

test("capacity refusal preserves the experiment and offers an explicit public GitHub fallback", async ({ page }) => {
  let submissions = 0;
  await page.route("**/api/contributions", async (route) => {
    submissions++;
    await route.fulfill({ status: 429, json: { error: "Capacity reached" } });
  });
  await experiment(page);
  await consent(page);
  await page.getByRole("button", { name: "Submit for private research" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Storage or submission capacity reached");
  await expect(page.getByRole("textbox", { name: "Question and context" })).toHaveValue("Synthetic research fixture: two plus two equals four.");
  await expect(page.getByRole("link", { name: "contribute on GitHub", exact: true })).toHaveAttribute("href", "https://github.com/chenmingtang830/jevarena/issues/new/choose");
  await expect(page.getByText("GitHub contributions are public; review the contents first.", { exact: false })).toBeVisible();
  await page.getByLabel(/I have reviewed this content and am comfortable sharing it/).check();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const exported = JSON.parse(await readFile((await (await downloaded).path())!, "utf8"));
  expect(exported.challenge.content).toContain("Synthetic research fixture");
  expect(submissions).toBe(1);
});
