import { describe, it, expect, vi } from "vitest";
import { parseOpenRouterCatalog, fetchOpenRouterCatalog } from "../lib/openrouter-catalog";
import { lookupModel, estimateCost } from "../lib/catalog";
import { buildRequest, validateRequest } from "../lib/providers";
import { templates } from "../lib/cases";
const row = (id:string,created:number,extra={}) => ({id,name:id,created,architecture:{input_modalities:["text"],output_modalities:["text"]},pricing:{prompt:"0.000001",completion:"0.000002"},...extra});
describe("live OpenRouter catalog",()=>{
  it("sorts by listing timestamp and excludes nontext, malformed, duplicate and Jev entries",()=>{
    const models=parseOpenRouterCatalog({data:[row("test/old",1),row("test/new",3),row("test/new",3),row("https://evil.test",5),row("typesafe/jev-1.13",9),row("test/image",6,{architecture:{input_modalities:["text"],output_modalities:["image"]}})]});
    expect(models.map(m=>m.id)).toEqual(["test/new","test/old"]);
    expect(models[0]).toMatchObject({inputPerMillion:1,outputPerMillion:2,compareOnly:true});
  });
  it("keeps unknown and variable prices unknown, never zero",()=>{
    const [model]=parseOpenRouterCatalog({data:[row("test/unknown",1,{pricing:{prompt:"-1",completion:""}})]});
    expect(estimateCost(model,templates[0]).maxUsd).toBeNull();
  });
  it("includes per-request fees",()=>{
    const [model]=parseOpenRouterCatalog({data:[row("test/fee",1,{pricing:{prompt:"0",completion:"0",request:"0.02"}})]});
    expect(estimateCost(model,templates[0]).maxUsd).toBe(.02);
  });
  it("fetches metadata without a key and uses fixed chat endpoint for discovered IDs",async()=>{
    const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValue(Response.json({data:[row("test/latest-catalog",10)]}));
    try {
      await fetchOpenRouterCatalog(new AbortController().signal);
      expect(fetcher.mock.calls[0][1]).not.toHaveProperty("headers");
      expect(fetcher.mock.calls[0][1]).toMatchObject({credentials:"omit",redirect:"error"});
      expect(lookupModel("openrouter","test/latest-catalog").compareOnly).toBe(true);
      const args={provider:"openrouter" as const,model:"test/latest-catalog",apiKey:"test-only-key",challenge:templates[0]};
      expect(validateRequest(args).model).toBe(args.model);
      expect(buildRequest(args).url).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(()=>validateRequest({...args,provider:"vercel"})).toThrow();
      expect(()=>validateRequest({...args,model:"https://evil.test"})).toThrow();
    } finally { fetcher.mockRestore(); }
  });
});
