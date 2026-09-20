// Operator-only human publication queue. It never calls a model or prints credentials.
// `decide` needs an explicit approval environment flag, in addition to a recorded reviewer and reason.
type Args = Record<string, string | undefined>;

function argumentsFrom(argv: string[]): Args {
  const result: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    result[token.slice(2)] = value;
    index += 1;
  }
  return result;
}

function settings() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(url) || key.length < 32 || /\s/.test(key))
    throw new Error("A valid server-side Supabase configuration is required.");
  return { url: url.replace(/\/$/, ""), key };
}

async function rpc(name: string, body: Record<string, unknown>) {
  const { url, key } = settings();
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: key };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("Moderation queue is unavailable.");
  return response.json() as Promise<unknown>;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = argumentsFrom(rest);
  if (command === "list") {
    const limit = Number(args.limit ?? "25");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("--limit must be an integer from 1 to 100.");
    console.log(JSON.stringify(await rpc("jevarena_list_held_moderation", { p_limit: limit }), null, 2));
    return;
  }
  if (command === "decide") {
    if (process.env.JEVARENA_HUMAN_REVIEW_APPROVED !== "true") throw new Error("Set JEVARENA_HUMAN_REVIEW_APPROVED=true after personally reviewing this held item.");
    const { id, decision, reviewer, reason } = args;
    if (!id || (decision !== "publish" && decision !== "reject") || !reviewer || !reason) throw new Error("Usage: decide --id UUID --decision publish|reject --reviewer NAME --reason TEXT");
    const result = await rpc("jevarena_resolve_held_moderation", { p_id: id, p_decision: decision, p_reviewer: reviewer, p_reason: reason });
    if (!result || typeof result !== "object" || (result as { ok?: unknown }).ok !== true) throw new Error("The held item was not resolved. It may have expired, been withdrawn, or already been reviewed.");
    console.log(JSON.stringify(result));
    return;
  }
  throw new Error("Usage: review-moderation.ts list [--limit N] | decide --id UUID --decision publish|reject --reviewer NAME --reason TEXT");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Moderation queue command failed.");
  process.exitCode = 1;
});
