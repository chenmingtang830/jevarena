import { openManualKey } from "./manual-key";
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function judgedExperiment(page: Page) {
  await page.route("https://openrouter.ai/**", route => route.fulfill({ json: route.request().url().includes("/decisions")
    ? { answers: { judgment: { choice: "option1" } }, usage: { input_tokens: 10, output_tokens: 0, cost: 0.000001 } }
    : { model: "mock-version", choices: [{ finish_reason: "stop", message: { content: '{"choice":"option2"}' } }], usage: { prompt_tokens: 10, completion_tokens: 4, cost: 0.00001 } },
  }));
  await page.goto("/play");
  await page.getByLabel("Question and context").fill("Synthetic private history: is 2 + 2 equal to 4?");
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await openManualKey(page);
  await page.getByLabel("OpenRouter", { exact: true }).fill("synthetic-history-key-not-for-storage");
  await page.getByRole("checkbox", { name: "I agree to Terms and acknowledge Privacy", exact: true }).check();
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await expect(page.getByText("Which judgment is better?", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save to my history", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Both good", exact: true }).click();
}

test("private saving is opt-in, guest-safe and manually retryable without credentials", async ({ page }) => {
  let authenticated = false;
  let sessionRequests = 0;
  const saved: Record<string, any>[] = [];
  await page.route("**/api/auth/session", route => {
    sessionRequests++;
    return route.fulfill({ json: { enabled: true, authenticated } });
  });
  await page.route("**/api/history", route => {
    expect(route.request().method()).toBe("POST");
    saved.push(route.request().postDataJSON());
    return route.fulfill(saved.length === 1
      ? { status: 503, json: { error: "SECRET_HISTORY_DIAGNOSTIC" } }
      : { status: 201, json: { id: saved.at(-1)!.id, createdAt: "2026-09-19T00:00:00Z", expiresAt: "2026-10-19T00:00:00Z" } });
  });
  await judgedExperiment(page);
  expect(sessionRequests).toBe(0);
  expect(saved).toEqual([]);
  await page.getByRole("button", { name: "Save to my history", exact: true }).click();
  const region = page.getByRole("region", { name: "Private account history" });
  const consent = region.getByRole("checkbox", { name: "Save this experiment to my private history", exact: true });
  const save = region.getByRole("button", { name: "Save privately", exact: true });
  await expect(consent).not.toBeChecked();
  await expect(save).toBeDisabled();
  await expect(region).toContainText("30 days");
  await expect(region).toContainText("separate from contributing to research or publishing");
  expect(sessionRequests).toBe(0);
  await consent.check();
  expect(sessionRequests).toBe(0);
  await save.click();
  const login = region.getByRole("link", { name: "Sign in with email in a new tab" });
  await expect(login).toHaveAttribute("href", "/login");
  await expect(login).toHaveAttribute("target", "_blank");
  expect(sessionRequests).toBe(1);
  expect(saved).toEqual([]);
  await expect(page).toHaveURL("/play");
  await expect(page.getByLabel("Question and context")).toHaveValue("Synthetic private history: is 2 + 2 equal to 4?");
  // A later explicit click after a mock login is necessary: there is no polling or autosave.
  authenticated = true;
  await save.click();
  await expect(region.getByRole("status")).toContainText("Could not save");
  await expect(page.locator("body")).not.toContainText("SECRET_HISTORY_DIAGNOSTIC");
  expect(saved).toHaveLength(1);
  await save.click();
  await expect(region.getByRole("status")).toContainText("Saved privately for 30 days");
  expect(saved).toHaveLength(2);
  expect(saved[0]).toEqual(saved[1]);
  expect(saved[0].consent).toEqual({ version: "2026-09-19", savePrivate: true });
  expect(saved[0].history.vote.value).toBe("both");
  expect(saved[0].history.runs).toHaveLength(2);
  expect(JSON.stringify(saved)).not.toContain("synthetic-history-key-not-for-storage");
  expect(JSON.stringify(saved)).not.toContain("allowPublication");
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("synthetic-history-key-not-for-storage");
  await page.getByLabel("Question and context").fill("A different synthetic private history task.");
  await page.getByRole("button", { name: "Start judging", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start judging", exact: true }).click();
  await page.getByRole("button", { name: "Both good", exact: true }).click();
  await page.getByRole("button", { name: "Save to my history", exact: true }).click();
  await expect(consent).not.toBeChecked();
  await expect(save).toBeDisabled();
  expect(saved).toHaveLength(2);
  await consent.check();
  await save.click();
  await expect(region.getByRole("status")).toContainText("Saved privately for 30 days");
  expect(saved).toHaveLength(3);
  expect(saved[2].id).not.toBe(saved[0].id);
  expect(saved[2].history.challenge.content).toBe("A different synthetic private history task.");
});

test("history export and deletion are explicit and keep or failed deletion preserves the entry", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000010";
  const item = { id, title: "Synthetic saved experiment", language: "en", kind: "judgment", createdAt: "2026-09-19T00:00:00Z", expiresAt: "2026-10-19T00:00:00Z" };
  const detail = { id, history: { challenge: { schemaVersion: 1, id: "synthetic", title: item.title, language: "en", kind: "judgment", content: "Is 2 + 2 equal to 4?", question: "Choose one option.", options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] }, runs: [] }, createdAt: item.createdAt, expiresAt: item.expiresAt };
  let reads = 0;
  let deletes = 0;
  await page.route("**/api/history", route => route.fulfill({ json: { items: [item], nextCursor: null } }));
  await page.route(`**/api/history/${id}`, route => {
    if (route.request().method() === "DELETE") {
      deletes++;
      return route.fulfill(deletes === 1 ? { status: 503, json: { error: "SECRET_DELETE_DETAIL" } } : { json: { deleted: true } });
    }
    reads++;
    return route.fulfill({ json: detail });
  });
  await page.goto("/history");
  const entry = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: item.title, exact: true }) });
  await expect(entry).toBeVisible();
  expect(reads).toBe(0);
  expect(deletes).toBe(0);
  const downloaded = page.waitForEvent("download");
  await entry.getByRole("button", { name: "Download experiment", exact: true }).click();
  const exported = JSON.parse(await readFile((await (await downloaded).path())!, "utf8"));
  expect(exported).toEqual(detail);
  expect(reads).toBe(1);
  await entry.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(entry.getByRole("group", { name: "Confirm deletion" })).toBeVisible();
  expect(deletes).toBe(0);
  await entry.getByRole("button", { name: "Keep it", exact: true }).click();
  await expect(entry).toBeVisible();
  await expect(entry.getByRole("group", { name: "Confirm deletion" })).toHaveCount(0);
  await entry.getByRole("button", { name: "Delete", exact: true }).click();
  await entry.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Could not delete");
  await expect(entry).toBeVisible();
  await expect(page.locator("body")).not.toContainText("SECRET_DELETE_DETAIL");
  await entry.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Experiment deleted from your active history");
  await expect(entry).toHaveCount(0);
  expect(deletes).toBe(2);
});

test("unauthenticated history remains optional and never exposes upstream diagnostics", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/history", route => {
    requests++;
    expect(route.request().method()).toBe("GET");
    return route.fulfill({ status: 401, json: { error: "SECRET_AUTH_DIAGNOSTIC" } });
  });
  await page.goto("/history");
  await expect(page.getByRole("status")).toContainText("Sign in to view your private history");
  await expect(page.locator("body")).not.toContainText("SECRET_AUTH_DIAGNOSTIC");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login");
  await page.getByRole("link", { name: "Continue as guest", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Would you make the same call?" })).toBeVisible();
  expect(requests).toBe(1);
});

test("disabled account saving preserves guest results and never posts history", async ({ page }) => {
  let saves = 0;
  await page.route("**/api/auth/session", route => route.fulfill({ json: { enabled: false, authenticated: false } }));
  await page.route("**/api/history", route => { saves++; return route.abort(); });
  await judgedExperiment(page);
  await page.getByRole("button", { name: "Save to my history", exact: true }).click();
  const region = page.getByRole("region", { name: "Private account history" });
  await region.getByRole("checkbox", { name: "Save this experiment to my private history", exact: true }).check();
  await region.getByRole("button", { name: "Save privately", exact: true }).click();
  await expect(region.getByRole("status")).toContainText("Account saving is not available yet");
  await expect(page.getByLabel("Question and context")).toHaveValue("Synthetic private history: is 2 + 2 equal to 4?");
  await expect(page.getByRole("button", { name: "Share this experiment", exact: true })).toBeVisible();
  expect(saves).toBe(0);
});
