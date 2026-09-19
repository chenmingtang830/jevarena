import { test, expect } from "@playwright/test";
test("community triage examples preserve the rubric and never reveal source answers in the composer", async ({ page }) => {
  let calls = 0;
  await page.route("https://openrouter.ai/**", (route) => {
    if (route.request().method() === "GET") return route.abort();
    calls++;
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Retry defaults", exact: true }).click();
  await expect(page.getByLabel("Question and context")).toHaveValue(/Please document the retry defaults/);
  await expect(page.getByLabel("Question and context")).toHaveValue(/The documentation, README/);
  await expect(page.getByLabel("Option 4", { exact: true })).toHaveValue("docs");
  await expect(page.getByText(/Label disagreement/)).toHaveCount(0);
  await page.goto("/?case=community-safari-login");
  await expect(page.getByLabel("Question and context")).toHaveValue(/Does login work in Safari/);
  expect(calls).toBe(0);
});
test("real community input fills without calling models or revealing the author's answer", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (request) => { if (/openrouter.ai|ai-gateway.vercel.sh|api.typesafe.ai/.test(request.url())) calls.push(request.url()); });
  await page.goto("/");
  await page.getByRole("button", { name: "A surprising remainder", exact: true }).click();
  await expect(page.getByLabel("Question and context")).toHaveValue(/What is 6\^3 mod 89/);
  await expect(page.getByLabel("Option 1", { exact: true })).toHaveValue("38");
  await expect(page.getByRole("link", { name: "@_pi0_’s public test" })).toHaveAttribute("href", "https://x.com/_pi0_/status/2100890061713617277");
  await expect(page.getByText(/native TypeSafe run/)).toHaveCount(0);
  expect(calls).toEqual([]);
  await page.goto("/?case=community-remainder-19");
  await expect(page.getByLabel("Question and context")).toHaveValue(/What is 19\^9 mod 7/);
});
test("homepage starts with editable composer and examples; connection methods never overlap", async ({page}) => {
  await page.goto("/");
  await expect(page.getByLabel("Question and context")).toBeEditable();
  await page.getByRole("button", {name:"A surprising remainder",exact:true}).click();
  await expect(page.getByLabel("Question and context")).toHaveValue(/6\^3/);
  await page.getByRole("button", {name:"Start judging",exact:true}).click();
  await expect(page.getByRole("button", {name:"Continue to OpenRouter"})).toBeVisible();
  for (const [name, href] of [["Try without a key", "/try"], ["Run locally", "/run-locally"]]) {
    const link = page.getByRole("dialog").getByRole("link", {name, exact:true});
    await expect(link).toHaveAttribute("data-slot", "button");
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveClass(/secondary/);
    await link.focus();
    await expect(link).toBeFocused();
    expect(await link.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByLabel("OpenRouter", {exact:true})).not.toBeVisible();
  await page.locator("summary").filter({hasText:"Use an API key instead"}).click();
  await expect(page.getByRole("button", {name:"Continue to OpenRouter"})).toHaveCount(0);
  await expect(page.getByLabel("OpenRouter", {exact:true})).toBeVisible();
  await page.locator("summary").filter({hasText:"Back to connection options"}).click();
  await expect(page.getByRole("button", {name:"Continue to OpenRouter"})).toBeVisible();
});
