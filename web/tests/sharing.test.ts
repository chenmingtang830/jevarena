import { describe, it, expect } from "vitest";
import { cases } from "../lib/cases";
import {
  encodeShare,
  decodeShare,
  importContribution,
  contributionJson,
} from "../lib/sharing";
describe("bounded sharing", () => {
  it("round trips and downgrades imported trust", async () => {
    const c = { ...cases[0], status: "reviewed" as const };
    const result = await decodeShare(await encodeShare(c));
    expect(result.challenge).toEqual(c.challenge);
    expect(result.status).toBe("community-submitted");
  });
  it("JSON imports always begin untrusted", () => {
    expect(
      importContribution(
        contributionJson({ ...cases[0], status: "reproduced" }),
      ).status,
    ).toBe("community-submitted");
  });
  it("rejects malformed and oversized fragments", async () => {
    await expect(decodeShare("v1.invalid!")).rejects.toThrow();
    await expect(decodeShare("v1." + "a".repeat(12000))).rejects.toThrow();
  });
  it("rejects extra secret fields before encoding", async () => {
    await expect(
      encodeShare({ ...cases[0], apiKey: "secret" } as never),
    ).rejects.toThrow();
  });
  it("preserves markup as inert text, never evaluates it", async () => {
    const c = {
      ...cases[0],
      challenge: { ...cases[0].challenge, title: "<script>alert(1)</script>" },
    };
    expect((await decodeShare(await encodeShare(c))).challenge.title).toBe(
      c.challenge.title,
    );
  });
  it("stops decompression bombs", async () => {
    const bytes = new Uint8Array(
      await new Response(
        new Blob(["a".repeat(200000)])
          .stream()
          .pipeThrough(new CompressionStream("gzip")),
      ).arrayBuffer(),
    );
    const b64 = btoa(Array.from(bytes, (c) => String.fromCharCode(c)).join(""))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
    await expect(decodeShare("v1." + b64)).rejects.toThrow("size limit");
  });
});
