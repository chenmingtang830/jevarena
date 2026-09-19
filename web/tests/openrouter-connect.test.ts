import { afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { authorizationUrl, connectOpenRouter, CONNECT_MESSAGE, createPkce, validCallback } from "../lib/openrouter-connect";
import { GET } from "../app/connect/openrouter/callback/route";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("OpenRouter popup PKCE", () => {
  it("uses independent cryptographic state and an S256 challenge", async () => {
    const pkce = await createPkce(webcrypto as Crypto);
    expect(pkce.verifier).toMatch(/^[\w-]{43}$/);
    expect(pkce.state).toMatch(/^[\w-]{43}$/);
    expect(pkce.verifier).not.toBe(pkce.state);
    const digest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(pkce.verifier));
    expect(pkce.challenge).toBe(Buffer.from(digest).toString("base64url"));
    const url = new URL(authorizationUrl("https://jevarena.test", pkce.state, pkce.challenge));
    expect(url.origin).toBe("https://openrouter.ai");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(new URL(url.searchParams.get("callback_url")!).searchParams.get("state")).toBe(pkce.state);
    expect(url.toString()).not.toContain(pkce.verifier);
  });

  it("requires matching origin, source, state and bounded code", () => {
    const popup = {} as Window;
    const event = {origin:"https://jevarena.test",source:popup,data:{type:CONNECT_MESSAGE,state:"state",code:"code"}} as MessageEvent;
    expect(validCallback(event,popup,event.origin,"state")).toBe(true);
    expect(validCallback({...event,origin:"https://evil.test"} as MessageEvent,popup,event.origin,"state")).toBe(false);
    expect(validCallback({...event,source:{}} as MessageEvent,popup,event.origin,"state")).toBe(false);
    expect(validCallback(event,popup,event.origin,"wrong")).toBe(false);
    expect(validCallback({...event,data:{...event.data,code:"x".repeat(4097)}} as MessageEvent,popup,event.origin,"state")).toBe(false);
  });

  function harness(blocked = false) {
    vi.useFakeTimers();
    const popup = {closed:false,location:{href:""},close:vi.fn()};
    let listener: ((event: MessageEvent) => Promise<void>) | undefined;
    const win = {open:vi.fn(()=>blocked?null:popup),location:{origin:"https://jevarena.test"},addEventListener:vi.fn((_type,fn)=>{listener=fn;}),removeEventListener:vi.fn(),setInterval,clearInterval,setTimeout,clearTimeout};
    vi.stubGlobal("window",win);
    // Deterministic hash avoids waiting for native WebCrypto with fake timers.
    vi.stubGlobal("crypto",{getRandomValues:(x:Uint8Array)=>webcrypto.getRandomValues(x),subtle:{digest:async()=>new Uint8Array(32).buffer}});
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({key:"sk-or-test-only"})));
    vi.stubGlobal("fetch",fetcher);
    const ok = vi.fn(); const error = vi.fn();
    const cancel = connectOpenRouter(ok,error);
    const message = () => {
      const auth = new URL(popup.location.href);
      const state = new URL(auth.searchParams.get("callback_url")!).searchParams.get("state");
      return {origin:win.location.origin,source:popup,data:{type:CONNECT_MESSAGE,state,code:"test-code"}} as unknown as MessageEvent;
    };
    return {popup,win,fetcher,ok,error,cancel,message,receive:(event:MessageEvent)=>listener!(event)};
  }

  it("opens synchronously, exchanges once directly, and never runs a model", async () => {
    const h=harness();
    expect(h.win.open).toHaveBeenCalledWith("about:blank","_blank",expect.any(String));
    await vi.advanceTimersByTimeAsync(0);
    const event=h.message();
    await h.receive(event); await h.receive(event);
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(h.fetcher.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/auth/keys");
    const opts=h.fetcher.mock.calls[0][1];
    expect(JSON.parse(opts.body)).toMatchObject({code:"test-code",code_challenge_method:"S256"});
    expect(opts.credentials).toBe("omit");
    expect(opts.redirect).toBe("error");
    expect(h.ok).toHaveBeenCalledWith("sk-or-test-only");
    expect(h.error).not.toHaveBeenCalled();
  });

  it("fails safely for blocked, closed and expired popups", async () => {
    const blocked=harness(true); expect(blocked.error).toHaveBeenCalledWith(expect.stringContaining("Allow pop-ups"));
    const closed=harness(); closed.popup.closed=true;
    await vi.advanceTimersByTimeAsync(500); expect(closed.error).toHaveBeenCalledWith(expect.stringContaining("Connection closed"));
    const expired=harness(); await vi.advanceTimersByTimeAsync(5*60*1000);
    expect(expired.error).toHaveBeenCalledWith(expect.stringContaining("expired"));
    expect(expired.fetcher).not.toHaveBeenCalled();
  });

  it("cancel removes listeners and suppresses a late exchange result", async () => {
    const h=harness(); await vi.advanceTimersByTimeAsync(0);
    let resolve!: (value:Response)=>void;
    h.fetcher.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    const pending=h.receive(h.message()); h.cancel();
    resolve(new Response(JSON.stringify({key:"sk-or-late"}))); await pending;
    expect(h.ok).not.toHaveBeenCalled();
    expect(h.win.removeEventListener).toHaveBeenCalled();
  });

  it("does not echo provider errors or accept malformed keys", async () => {
    const h=harness(); await vi.advanceTimersByTimeAsync(0);
    h.fetcher.mockResolvedValue(new Response(JSON.stringify({key:"invalid"})));
    await h.receive(h.message());
    expect(h.ok).not.toHaveBeenCalled(); expect(h.error).toHaveBeenCalledWith(expect.stringContaining("Could not connect"));
  });

  it("bounds provider response bytes even without a Content-Length", async () => {
    const h=harness(); await vi.advanceTimersByTimeAsync(0);
    h.fetcher.mockResolvedValue(new Response("x".repeat(8193)));
    await h.receive(h.message());
    expect(h.ok).not.toHaveBeenCalled(); expect(h.error).toHaveBeenCalledTimes(1);
  });

  it("aborts a slow exchange after twenty seconds", async () => {
    const h=harness(); await vi.advanceTimersByTimeAsync(0);
    h.fetcher.mockImplementation(()=>new Promise(()=>{}));
    void h.receive(h.message()); await vi.advanceTimersByTimeAsync(20_000);
    expect(h.error).toHaveBeenCalledWith(expect.stringContaining("too long"));
    expect(h.fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(h.ok).not.toHaveBeenCalled();
  });

  it("callback is no-store and strips the query before sending to same-origin opener", async () => {
    const response=GET(); const html=await response.text();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(html.indexOf("history.replaceState")).toBeLessThan(html.indexOf("postMessage"));
    expect(html).toContain("}, location.origin)");
    expect(html).not.toMatch(/localStorage|sessionStorage|fetch\(/);
  });
});
