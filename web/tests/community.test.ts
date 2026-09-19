import { describe, expect, it } from "vitest";
import { authorUrl, communityCases, CommunityCaseSchema, postUrl } from "../lib/community-cases";

describe("community references", () => {
  it("keeps provenance separate from model runs and original challenge licenses", () => {
    expect(communityCases.length).toBe(4);
    expect(new Set(communityCases.map((item) => item.id)).size).toBe(4);
    for (const item of communityCases) {
      expect(CommunityCaseSchema.safeParse(item).success).toBe(true);
      expect(item.evidence).toBe("Source checked · not reproduced");
      expect(item).not.toHaveProperty("runs");
      expect(item).not.toHaveProperty("license");
      expect(postUrl(item)).toMatch(/^https:\/\/x.com\/\w+\/status\/\d+$/);
      expect(authorUrl(item)).toBe(`https://x.com/${item.handle}`);
    }
  });
  it("rejects injected links and fabricated reproduction labels", () => {
    for (const change of [{ handle: "evil.com/path" }, { postId: "javascript:1" }, { evidence: "reproduced" }, { runs: [] }]) {
      expect(CommunityCaseSchema.safeParse({ ...communityCases[0], ...change }).success).toBe(false);
    }
  });
});
