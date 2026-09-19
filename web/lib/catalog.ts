import type { Challenge } from "./contracts";

export type Provider = "openrouter" | "vercel" | "typesafe";
export type Tier = "low-cost" | "strong" | "reasoning";
export const PROVIDERS: {
  id: Provider;
  label: string;
  transport: "direct" | "relay";
}[] = [
  { id: "openrouter", label: "OpenRouter", transport: "direct" },
  { id: "vercel", label: "Vercel AI Gateway", transport: "relay" },
  { id: "typesafe", label: "TypeSafe", transport: "relay" },
];
export interface Model {
  id: string;
  provider: Provider;
  label: string;
  kind: "jev" | "chat";
  tier: Tier;
  inputPerMillion: number | null;
  outputPerMillion: number | null;
  priceSource: string;
  verifiedAt: string;
  validation: "contract-only";
}
const date = "2026-09-19";
const make = (
  provider: Provider,
  id: string,
  label: string,
  kind: Model["kind"],
  tier: Tier,
  input: number | null,
  output: number | null,
  source: string,
): Model => ({
  provider,
  id,
  label,
  kind,
  tier,
  inputPerMillion: input,
  outputPerMillion: output,
  priceSource: source,
  verifiedAt: date,
  validation: "contract-only",
});
export const MODELS: Model[] = [
  make(
    "openrouter",
    "typesafe/jev-1.13",
    "Jev 1.13",
    "jev",
    "low-cost",
    0.042,
    0,
    "https://openrouter.ai/api/v1/models/typesafe/jev-1.13/endpoints",
  ),
  make(
    "vercel",
    "typesafe-ai/jev",
    "Jev",
    "jev",
    "low-cost",
    0.042,
    0,
    "https://ai-gateway.vercel.sh/v1/models",
  ),
  make(
    "typesafe",
    "jev-latest",
    "Jev latest",
    "jev",
    "low-cost",
    null,
    null,
    "https://docs.typesafe.ai/api",
  ),
  ...(["openrouter", "vercel"] as Provider[]).flatMap((provider) => [
    make(
      provider,
      "google/gemini-2.5-flash",
      "Gemini 2.5 Flash",
      "chat",
      "low-cost",
      0.3,
      2.5,
      provider === "openrouter"
        ? "https://openrouter.ai/api/v1/models"
        : "https://ai-gateway.vercel.sh/v1/models",
    ),
    make(
      provider,
      "anthropic/claude-sonnet-4.5",
      "Claude Sonnet 4.5",
      "chat",
      "strong",
      3,
      15,
      provider === "openrouter"
        ? "https://openrouter.ai/api/v1/models"
        : "https://ai-gateway.vercel.sh/v1/models",
    ),
  ]),
  make(
    "openrouter",
    "deepseek/deepseek-r1-0528",
    "DeepSeek R1 0528",
    "chat",
    "reasoning",
    0.5,
    2.15,
    "https://openrouter.ai/api/v1/models",
  ),
];
export const getModels = (provider: Provider) =>
  MODELS.filter((m) => m.provider === provider);
export const getJevModel = (provider: Provider) =>
  MODELS.find((m) => m.provider === provider && m.kind === "jev")!;
export function lookupModel(provider: Provider, id: string): Model {
  const model = MODELS.find((m) => m.provider === provider && m.id === id);
  if (!model) throw new Error("Unsupported provider or model.");
  return model;
}
export function estimateCost(
  model: Model,
  challenge: Challenge,
): { minUsd: number | null; maxUsd: number | null; basis: string } {
  if (model.inputPerMillion === null || model.outputPerMillion === null)
    return {
      minUsd: null,
      maxUsd: null,
      basis: "Price unavailable; verify your provider account before running.",
    };
  // UTF-8 byte count is deliberately conservative for multilingual text. This is not a billing cap.
  const bytes =
    new TextEncoder().encode(JSON.stringify(challenge)).length + 1500;
  return {
    minUsd: ((bytes / 6) * model.inputPerMillion) / 1e6,
    maxUsd:
      (bytes * model.inputPerMillion + 4096 * model.outputPerMillion) / 1e6,
    basis: `Illustrative range, not a spending cap. Public standard rates checked ${date}; routing, caching, and tokenization can change billed cost.`,
  };
}
