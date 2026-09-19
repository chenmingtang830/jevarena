/** Offline repair of preserved canary records; never makes a model call. */
import { readFile } from "node:fs/promises";
import { templates } from "../lib/cases";
import { normalizeResponse } from "../lib/providers";
import { RunRecordSchema, type RunRecord } from "../lib/contracts";

async function main() {
  globalThis.fetch = async () => {
    throw new Error("Network forbidden during replay");
  };
  const path = process.argv[2];
  if (!path) throw new Error("Receipt path required");
  const receipt = JSON.parse(await readFile(path, "utf8"));
  const runs: RunRecord[] = receipt.runs.map((raw: unknown, index: number) => {
    const record = RunRecordSchema.parse(raw);
    const challenge = templates.find((c) => c.id === record.challengeId)!;
    const corrected =
      record.model === "typesafe-ai/jev"
        ? normalizeResponse(
            receipt.observations[index],
            {
              provider: "vercel",
              model: record.model,
              apiKey: "offline-placeholder",
              challenge,
            },
            record,
          )
        : record;
    return RunRecordSchema.parse({
      ...corrected,
      settings: { ...corrected.settings, transport: "direct" },
    });
  });
  console.log(
    JSON.stringify(
      {
        schemaVersion: 1,
        status: "unreviewed-canary",
        startedAt: receipt.startedAt,
        endedAt: receipt.endedAt,
        conditions: receipt.conditions,
        normalization:
          "Offline correction from original returned metadata: preserve billed zero and vendor confidence; transport corrected to local direct. No repeat calls.",
        calls: receipt.calls,
        budgetUsd: receipt.budgetUsd,
        estimatedUpperUsd: receipt.estimatedUpperUsd,
        providerReportedTotalUsd: runs.reduce(
          (n, r) => n + (r.cost.usd ?? 0),
          0,
        ),
        runs,
      },
      null,
      2,
    ),
  );
}
main().catch(() => {
  console.error("Offline replay failed.");
  process.exitCode = 1;
});
