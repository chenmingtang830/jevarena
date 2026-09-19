import {test,expect} from "@playwright/test";
import {openManualKey} from "./manual-key";
test("current models sort newest first and pasted IDs filter without inference",async({page})=>{
  let inference=0;
  await page.route("https://openrouter.ai/**", async route=>{
    if(route.request().url().endsWith("/api/v1/models")) {
      expect(route.request().headers().authorization).toBeUndefined();
      return route.fulfill({json:{data:[
        {id:"test/old",name:"Older model",created:1},
        {id:"test/new",name:"Newest model",created:10},
      ].map(m=>({...m,architecture:{input_modalities:["text"],output_modalities:["text"]},pricing:{prompt:"0.000001",completion:"0.000002"}}))}});
    }
    inference++; return route.abort();
  });
  await page.goto("/");
  await page.getByLabel("Question and context").fill("Is 2+2=4?");
  await page.getByRole("button",{name:"Start judging",exact:true}).click();
  await openManualKey(page);
  await page.getByLabel("OpenRouter",{exact:true}).fill("test-only-not-a-real-key");
  await expect(page.getByText("2 text models · Newest listed first")).toBeVisible();
  expect(await page.locator('#rival optgroup[label="OpenRouter · newest listed first"] option').allTextContents()).toEqual(["Newest model — test/new","Older model — test/old"]);
  await page.getByLabel("Search models or paste model ID").fill("test/old");
  await page.getByLabel("Opponent",{exact:true}).selectOption("openrouter:test/old");
  await expect(page.getByText("$1 input / $2 output per 1M tokens",{exact:false})).toBeVisible();
  await page.getByLabel("Search models or paste model ID").fill("https://evil.test");
  await expect(page.getByText(/No match. Check the provider\/model ID/)).toBeVisible();
  await expect(page.getByLabel("Opponent",{exact:true})).toHaveValue("openrouter:test/old");
  expect(inference).toBe(0);
});
