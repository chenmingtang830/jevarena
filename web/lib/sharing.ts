import { CaseContributionSchema, type CaseContribution } from "./contracts";

export const MAX_SHARE_BYTES = 128000;
export const MAX_FRAGMENT_LENGTH = 12000;
function parse(value: unknown): CaseContribution {
  return CaseContributionSchema.parse(value);
}
export function contributionJson(value: CaseContribution): string {
  const json = JSON.stringify(parse(value), null, 2);
  if (new TextEncoder().encode(json).length > MAX_SHARE_BYTES)
    throw new Error(
      "Case exceeds the 128 KB export limit. Shorten the content.",
    );
  return json;
}
async function boundedRead(
  stream: ReadableStream<Uint8Array>,
  limit: number,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Share data exceeds size limit");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}
export async function encodeShare(value: CaseContribution): Promise<string> {
  const raw = new TextEncoder().encode(contributionJson(value));
  const stream = new Blob([raw])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const bytes = await boundedRead(stream, MAX_SHARE_BYTES);
  const encoded = btoa(
    Array.from(bytes, (c) => String.fromCharCode(c)).join(""),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  if (encoded.length + 3 > MAX_FRAGMENT_LENGTH)
    throw new Error(
      "Link too large. Download and share the JSON file instead.",
    );
  return `v1.${encoded}`;
}
export async function decodeShare(fragment: string): Promise<CaseContribution> {
  const value = fragment.replace(/^#/, "");
  if (value.length > MAX_FRAGMENT_LENGTH || !/^v1\.[A-Za-z0-9_-]+$/.test(value))
    throw new Error("Invalid or oversized share link");
  const raw = atob(value.slice(3).replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const unpacked = await boundedRead(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
    MAX_SHARE_BYTES,
  );
  const result = parse(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(unpacked)),
  );
  return { ...result, status: "community-submitted" };
}
export function importContribution(json: string): CaseContribution {
  if (new TextEncoder().encode(json).length > MAX_SHARE_BYTES)
    throw new Error("File exceeds size limit");
  return { ...parse(JSON.parse(json)), status: "community-submitted" };
}
