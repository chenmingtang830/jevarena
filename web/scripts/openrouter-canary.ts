/** Manual-only canary. Explicit budget + credential source required. No retries. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { templates } from "../lib/cases";
import { lookupModel, estimateCost } from "../lib/catalog";
import { executeUpstream } from "../lib/providers";
import type { RunRecord } from "../lib/contracts";

async function main() {
  if (process.env.JEVARENA_OPENROUTER_APPROVED !== "0.05") throw new Error("Approval required");
  const path = process.env.JEVARENA_OPENROUTER_ENV_FILE;
  let apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey && path) {
    const content = await readFile(path, "utf8");
    const match = content.match(/^\s*(?:export\s+)?OPENROUTER_API_KEY\s*=\s*(.+)\s*$/m);
    const value = match?.[1].trim();
    apiKey = value?.startsWith('"') || value?.startsWith("'") ? value.slice(1, -1) : value;
  }
  if (!apiKey?.trim()) throw new Error("Missing OpenRouter key");
  const challenges = ["decimal-comparison", "chinese-negation"].map(id => templates.find(c => c.id === id)!);
  const models = ["typesafe/jev-1.13", "google/gemini-2.5-flash"];
  const estimatedUpperUsd = challenges.reduce((sum, c) => sum + models.reduce((n, id) => n + (estimateCost(lookupModel("openrouter", id), c).maxUsd ?? Infinity), 0), 0);
  if (estimatedUpperUsd > 0.03) throw new Error("Estimate exceeds conservative envelope");
  const startedAt = new Date().toISOString();
  const dir = `../runs/openrouter-canary-${startedAt.replaceAll(":", "-")}`;
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const observations: { endpoint: string; httpStatus: number }[] = [];
  const runs: RunRecord[] = [];
  async function save() {
    const receipt = {
      startedAt, endedAt: new Date().toISOString(), budgetUsd: 0.05,
      callCeiling: 4, calls, estimatedUpperUsd,
      conditions: "Local Node to OpenRouter, sequential, 4096 chat output cap, no retries. Not a browser-origin acceptance test or benchmark.",
      runs, observations,
    };
    const json = JSON.stringify(receipt, null, 2);
    if (json.includes(apiKey!)) throw new Error("Secret export blocked");
    await writeFile(`${dir}/receipt.json`, json, { mode: 0o600 });
  }
  globalThis.fetch = async (input, init) => {
    const endpoint = String(input);
    if (!["https://openrouter.ai/api/alpha/decisions", "https://openrouter.ai/api/v1/chat/completions"].includes(endpoint) || calls >= 4) throw new Error("Request ceiling or host guard");
    calls++;
    await save(); // Preserve attempts even if the process stops mid-request.
    const response = await originalFetch(input, init);
    observations.push({ endpoint, httpStatus: response.status });
    return response;
  };
  try {
    for (const challenge of challenges) {
      for (const model of models) {
        const record = await executeUpstream({ provider: "openrouter", model, apiKey, challenge });
        // The native choice endpoint receives no chat output-token cap.
        if (model === "typesafe/jev-1.13" && record.settings) delete record.settings.maxOutputTokens;
        runs.push(record);
        await save();
        console.log(JSON.stringify({ challenge: challenge.id, model, status: record.status, choice: record.choice, latencyMs: record.latencyMs, cost: record.cost, usage: record.usage }));
        // Stop on any failure or unknown cost; never retry or substitute a model.
        if (record.status !== "success" || record.cost.usd === null || runs.reduce((n, r) => n + (r.cost.usd ?? 0), 0) > 0.03) {
          console.log(JSON.stringify({ stopped: true, calls, receipt: `${dir}/receipt.json` }));
          return;
        }
      }
    }
    console.log(JSON.stringify({ calls, receipt: `${dir}/receipt.json` }));
  } finally { globalThis.fetch = originalFetch; }
}
main().catch(() => { console.error("Canary stopped. Inspect the sanitized local receipt if created; no automatic retry."); process.exitCode = 1; });
