import { type Model, registerOpenRouterModels } from "./catalog";

export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
export const validModelId = (id: string) => id.length <= 160 && /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._:+-]*$/.test(id);
const obj = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
const price = (value: unknown) => typeof value === "string" && /^\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : null;

export function parseOpenRouterCatalog(value: unknown, now = new Date()): Model[] {
  const data = obj(value).data;
  if (!Array.isArray(data) || data.length > 10000) throw new Error("Invalid model catalog.");
  const seen = new Set<string>();
  return data.flatMap(raw => {
    const m = obj(raw), architecture = obj(m.architecture), pricing = obj(m.pricing);
    if (typeof m.id !== "string" || !validModelId(m.id) || seen.has(m.id) || m.id.startsWith("typesafe/") ||
      !Array.isArray(architecture.input_modalities) || !architecture.input_modalities.includes("text") ||
      !Array.isArray(architecture.output_modalities) || !architecture.output_modalities.includes("text")) return [];
    seen.add(m.id);
    const input = price(pricing.prompt), output = price(pricing.completion);
    return [{id:m.id, label: typeof m.name === "string" ? m.name.slice(0,160) : m.id,
      provider:"openrouter", kind:"chat", tier:"low-cost", compareOnly:true, validation:"contract-only",
      created: Number.isSafeInteger(m.created) && m.created >= 0 ? m.created : 0,
      inputPerMillion: input === null || !Number.isFinite(input * 1e6) ? null : input * 1e6,
      outputPerMillion: output === null || !Number.isFinite(output * 1e6) ? null : output * 1e6,
      requestUsd: pricing.request === undefined ? 0 : price(pricing.request),
      priceSource:OPENROUTER_MODELS_URL, verifiedAt:now.toISOString().slice(0,10),
    } satisfies Model];
  }).sort((a,b) => b.created - a.created || a.id.localeCompare(b.id));
}

export async function fetchOpenRouterCatalog(signal: AbortSignal): Promise<Model[]> {
  // No key, prompt or personal data is sent. This endpoint lists metadata only.
  const response = await fetch(OPENROUTER_MODELS_URL,{signal,credentials:"omit",redirect:"error"});
  if (!response.ok || !response.body) throw new Error("Model catalog unavailable.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const {value,done}=await reader.read(); if(done) break; size+=value.length;
      if(size>8_000_000) throw new Error("Model catalog too large."); chunks.push(value); }
  } catch(error) { await reader.cancel(); throw error; }
  const bytes = new Uint8Array(size); let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const models=parseOpenRouterCatalog(JSON.parse(new TextDecoder().decode(bytes)));
  if(!models.length) throw new Error("No text models found.");
  registerOpenRouterModels(models);
  return models;
}
