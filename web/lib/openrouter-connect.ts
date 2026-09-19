const CALLBACK_PATH = "/connect/openrouter/callback";
export const CONNECT_MESSAGE = "jevarena:openrouter-code";
const MAX_AGE_MS = 5 * 60 * 1000;

async function readKeyResponse(response: Response): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > 8192 || !response.body) throw new Error("response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) throw new Error("response");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createPkce(cryptoApi: Crypto = crypto) {
  const verifier = base64url(cryptoApi.getRandomValues(new Uint8Array(32)));
  const state = base64url(cryptoApi.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  return { verifier, state, challenge };
}

export function authorizationUrl(origin: string, state: string, challenge: string) {
  const callback = new URL(CALLBACK_PATH, origin);
  callback.searchParams.set("state", state);
  const url = new URL("https://openrouter.ai/auth");
  url.searchParams.set("callback_url", callback.toString());
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("key_label", "JevArena");
  return url.toString();
}

export function validCallback(event: MessageEvent, popup: Window, origin: string, state: string): event is MessageEvent<{type: string; state: string; code: string}> {
  const data: unknown = event.data;
  return event.origin === origin && event.source === popup && typeof data === "object" && data !== null &&
    "type" in data && data.type === CONNECT_MESSAGE && "state" in data && data.state === state &&
    "code" in data && typeof data.code === "string" && data.code.length > 0 && data.code.length <= 4096;
}

/** Call synchronously from a user click, so browsers can open the popup. Never persists credentials. */
export function connectOpenRouter(onConnected: (key: string) => void, onError: (message: string) => void): () => void {
  const popup = window.open("about:blank", "_blank", "popup,width=520,height=720");
  if (!popup) { onError("Allow pop-ups for this site, then try connecting again."); return () => {}; }
  const origin = window.location.origin;
  const controller = new AbortController();
  let active = true;
  let consumed = false;
  let verifier = "";
  let state = "";
  let exchangeTimeout: number | undefined;
  const expires = Date.now() + MAX_AGE_MS;
  const cleanup = () => {
    active = false;
    verifier = "";
    state = "";
    controller.abort();
    window.removeEventListener("message", receive);
    window.clearInterval(poll);
    window.clearTimeout(timeout);
    window.clearTimeout(exchangeTimeout);
    popup.close();
  };
  const fail = (message: string) => { if (!active) return; cleanup(); onError(message); };
  const receive = async (event: MessageEvent) => {
    if (!active || consumed || !state || !validCallback(event, popup, origin, state)) return;
    if (Date.now() >= expires) { fail("Connection expired. Please connect again."); return; }
    consumed = true;
    window.clearInterval(poll);
    window.removeEventListener("message", receive);
    popup.close();
    exchangeTimeout = window.setTimeout(() => fail("OpenRouter took too long to respond. Please connect again."), 20_000);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: event.data.code, code_verifier: verifier, code_challenge_method: "S256" }),
        signal: controller.signal, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", redirect: "error",
      });
      verifier = "";
      if (!response.ok) throw new Error("exchange");
      const data = await readKeyResponse(response);
      if (!data || typeof data !== "object" || !("key" in data) || typeof data.key !== "string" || !data.key.startsWith("sk-or-") || data.key.length > 1024) throw new Error("response");
      if (!active) return;
      cleanup();
      onConnected(data.key);
    } catch { fail("Could not connect to OpenRouter. Try again, or use a key manually."); }
  };
  const poll = window.setInterval(() => { if (popup.closed) fail("Connection closed. You can try again when ready."); }, 500);
  const timeout = window.setTimeout(() => fail("Connection expired. Please connect again."), MAX_AGE_MS);
  window.addEventListener("message", receive);
  void createPkce().then(values => {
    if (!active) return;
    verifier = values.verifier;
    state = values.state;
    popup.location.href = authorizationUrl(origin, state, values.challenge);
  }).catch(() => fail("Could not start a secure connection. Try again in a supported browser."));
  return cleanup;
}
