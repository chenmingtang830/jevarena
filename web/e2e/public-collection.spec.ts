import { test, expect } from "@playwright/test";
import { openManualKey } from "./manual-key";
test.skip(process.env.NEXT_PUBLIC_PUBLIC_COLLECTION_ENABLED !== "true", "Public collection is a separately gated build");

test("public guest answer requires an action, preserves attribution, and returns a receipt", async ({ page }) => {
  const bodies: any[] = [];
  await page.route("**/api/contributions", async route => {
    const body = route.request().postDataJSON(); bodies.push(body);
    await route.fulfill({status:201,json:{receiptId:body.submissionId,deletionToken:body.deletionToken,status:"community-submitted",receivedAt:"2026-09-19T00:00:00Z",expiresAt:"2026-10-19T00:00:00Z"}});
  });
  await page.goto("/try?example=community-export-limit");
  await expect(page.getByLabel("Contribute publicly", {exact:true})).toBeChecked();
  expect(bodies).toHaveLength(0);
  await page.getByRole("button", {name:"question",exact:true}).click();
  expect(bodies).toHaveLength(0);
  await page.getByRole("button", {name:"Submit answer & reveal"}).click();
  await expect(page.getByText("Received for review before publication. Thank you for contributing.")).toBeVisible();
  expect(bodies).toHaveLength(1);
  expect(bodies[0].consent).toMatchObject({version:"2026-09-19-public-v1",allowPublication:true,publication:"after-review"});
  expect(bodies[0].contribution.humanAnswer).toEqual({optionId:"question",revealedBeforeAnswer:false});
  expect(bodies[0].contribution.runs).toEqual([]);
  expect(bodies[0].contribution.sourceAttributions[0].license).toBe("MIT");
  await expect(page.getByRole("button",{name:"Download deletion receipt"})).toBeVisible();
});

for (const contribute of [true, false]) test(`live voting ${contribute ? "submits without credentials" : "respects opt-out"}`, async ({page}) => {
  const submissions: any[] = [];
  await page.route("**/api/contributions", async route => {
    const body = route.request().postDataJSON(); submissions.push(body);
    await route.fulfill({status:201,json:{receiptId:body.submissionId,deletionToken:body.deletionToken,status:"community-submitted",receivedAt:"2026-09-19T00:00:00Z",expiresAt:"2026-10-19T00:00:00Z"}});
  });
  await page.route("https://openrouter.ai/**", route => route.fulfill({json: route.request().url().includes("/decisions")
    ? {answers:{judgment:{choice:"option1",probabilities:{option1:0.8,option2:0.2}}},usage:{input_tokens:10,output_tokens:0,cost:0.000001}}
    : {model:"mock-version",choices:[{finish_reason:"stop",message:{content:'{"choice":"option2"}'}}],usage:{prompt_tokens:10,completion_tokens:4,cost:0.00001}}
  }));
  await page.goto("/play");
  await page.getByLabel("Question and context").fill("SYNTHETIC ONLY: Is 2+2=4?");
  await page.getByRole("button",{name:"Start judging",exact:true}).click();
  await openManualKey(page);
  await page.getByLabel("OpenRouter",{exact:true}).fill("test-only-not-a-real-key");
  await page.getByLabel("Contribute publicly",{exact:true}).setChecked(contribute);
  await page.getByRole("checkbox",{name:"I agree to Terms and acknowledge Privacy",exact:true}).check();
  await page.getByRole("button",{name:"Start judging",exact:true}).click();
  await expect(page.getByText("Which judgment is better?",{exact:true})).toBeVisible();
  expect(submissions).toHaveLength(0);
  await expect(page.getByRole("checkbox",{name:"Contribute publicly",exact:true})).toBeChecked({checked:contribute});
  await page.getByRole("button",{name:"Both good",exact:true}).click();
  if (contribute) {
    await expect(page.getByText("Received for review before publication. Thank you for contributing.")).toBeVisible();
    expect(submissions).toHaveLength(1);
    expect(submissions[0].contribution.runs).toHaveLength(2);
    expect(submissions[0].contribution.vote.revealedBeforeVote).toBe(false);
    expect(JSON.stringify(submissions)).not.toContain("test-only-not-a-real-key");
    await page.getByRole("button",{name:"Edit question",exact:true}).click();
    await page.getByRole("button",{name:"Start judging",exact:true}).click();
    await page.getByRole("button",{name:"Start judging",exact:true}).click();
    await expect(page.getByText("Which judgment is better?",{exact:true})).toBeVisible();
    expect(submissions).toHaveLength(1);
  } else expect(submissions).toHaveLength(0);
});

test("opt-out and skip never submit; visiting another question retains opt-out", async ({page}) => {
  let calls=0;
  await page.route("**/api/contributions", route => { calls++; return route.abort(); });
  await page.goto("/try");
  await page.getByLabel("Contribute publicly",{exact:true}).uncheck();
  await page.getByRole("button",{name:"question",exact:true}).click();
  await page.getByRole("button",{name:"Reveal recorded result"}).click();
  await page.getByRole("button",{name:"Safari login",exact:true}).click();
  await expect(page.getByLabel("Contribute publicly",{exact:true})).not.toBeChecked();
  await page.getByLabel("Contribute publicly",{exact:true}).check();
  await page.getByRole("button",{name:"Skip my guess"}).click();
  expect(calls).toBe(0);
});
