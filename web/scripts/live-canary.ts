/** Explicitly opted-in, four-request maximum, public-template canary. Never retries. */
import { mkdir, writeFile } from "node:fs/promises";
import { templates } from "../lib/cases";
import { lookupModel, estimateCost } from "../lib/catalog";
import { executeUpstream } from "../lib/providers";

async function main() {
  if (process.env.JEVARENA_CANARY_APPROVED !== "0.05")
    throw new Error("Explicit $0.05 canary approval required.");
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("AI_GATEWAY_API_KEY is missing.");
  const challenges = ["decimal-comparison", "chinese-negation"].map(
    (id) => templates.find((c) => c.id === id)!,
  );
  const models = ["typesafe-ai/jev", "deepseek/deepseek-v4.1-flash"];
  const estimatedUpperUsd = challenges.reduce(
    (total, c) =>
      total +
      models.reduce(
        (s, id) =>
          s + (estimateCost(lookupModel("vercel", id), c).maxUsd ?? Infinity),
        0,
      ),
    0,
  );
  if (estimatedUpperUsd > 0.02)
    throw new Error("Estimate exceeds conservative $0.02 envelope.");
  const startedAt = new Date().toISOString();
  const output = `../runs/canary-${startedAt.replaceAll(":", "-")}`;
  await mkdir(output, { recursive: true });
  // Only selected public response fields, never headers or request credentials.
  const transport = globalThis.fetch;
  const observations: unknown[] = [];
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    if (++calls > 4) throw new Error("Four-call ceiling reached.");
    const response = await transport(input, init);
    if (response.ok) {
      const data = (await response.clone().json()) as Record<string, unknown>;
      observations.push({
        endpoint: String(input),
        keys: Object.keys(data),
        answers: data.answers,
        usage: data.usage,
        model: data.model,
        providerMetadataKeys: data.providerMetadata
          ? Object.keys(data.providerMetadata as object)
          : [],
        providerMetadata: data.providerMetadata,
      });
    } else
      observations.push({
        endpoint: String(input),
        httpStatus: response.status,
      });
    return response;
  };
  const runs = [];
  for (const challenge of challenges) {
    for (const model of models) {
      const record = await executeUpstream({
        provider: "vercel",
        model,
        apiKey,
        challenge,
      });
      record.settings = { ...record.settings, transport: "direct" }; // Local Node → Gateway, not deployed relay.
      runs.push(record);
      console.log(JSON.stringify({ challenge: challenge.id, ...record }));
      if (record.status === "error" && record.cost.usd === null) break;
    }
    if (runs.some((r) => r.status === "error" && r.cost.usd === null)) break;
  }
  globalThis.fetch = transport;
  const receipt = {
    startedAt,
    endedAt: new Date().toISOString(),
    callCeiling: 4,
    budgetUsd: 0.05,
    estimatedUpperUsd,
    calls,
    conditions:
      "Local Node, sequential calls, default provider reasoning, max output 4096, no retries. Not a browser test or benchmark.",
    runs,
    observations,
  };
  const serialized = JSON.stringify(receipt, null, 2);
  if (serialized.includes(apiKey))
    throw new Error("Secret redaction guard stopped export.");
  await writeFile(`${output}/receipt.json`, serialized, { mode: 0o600 });
  console.log(
    JSON.stringify({
      receipt: `${output}/receipt.json`,
      calls,
      estimatedUpperUsd,
    }),
  );
}
main().catch(() => {
  console.error(
    "Canary stopped. No automatic retry; inspect sanitized receipts.",
  );
  process.exitCode = 1;
});
