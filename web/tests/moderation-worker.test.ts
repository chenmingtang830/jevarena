import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), moderate: vi.fn() }));
vi.mock("../lib/community-server", () => ({ communityRPC: mocks.rpc }));
vi.mock("../lib/moderation", () => ({ moderateContribution: mocks.moderate }));
import { reviewNewContribution } from "../lib/moderation-worker";

const id = "synthetic-contribution";
const claim = { ok: true, id, claimToken: "synthetic-claim-token", payload: { id }, consent: { version: "2026-09-19-auto-review-v1" } };
const screened = { publish: true, status: "screened", reason: "Category template", requestedModel: "typesafe-ai/jev" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("JEVARENA_AUTOMODERATION_ENABLED", "true");
  vi.stubEnv("JEVARENA_MODERATION_API_KEY", "synthetic-not-a-real-key");
  vi.stubEnv("JEVARENA_MODERATION_TOTAL_LIMIT_CENTS", "5000");
});
afterEach(() => vi.unstubAllEnvs());

describe("automatic moderation worker budget and publication gates", () => {
  it.each(["false", ""])("does nothing with enablement %s", async enabled => {
    vi.stubEnv("JEVARENA_AUTOMODERATION_ENABLED", enabled);
    await reviewNewContribution(id);
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.moderate).not.toHaveBeenCalled();
  });
  it.each(["", "0", "5001", "1.5", "Infinity", "not-a-number"])("rejects invalid or excessive limit %s", async limit => {
    vi.stubEnv("JEVARENA_MODERATION_TOTAL_LIMIT_CENTS", limit);
    await reviewNewContribution(id);
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.moderate).not.toHaveBeenCalled();
  });
  it("does nothing without a server key", async () => {
    vi.stubEnv("JEVARENA_MODERATION_API_KEY", "");
    await reviewNewContribution(id); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["budget-exhausted", "old-consent", "withdrawn", "already-claimed"])("does not call model when claim rejects %s", async reason => {
    mocks.rpc.mockResolvedValue({ ok: false, reason });
    await reviewNewContribution(id);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("jevarena_claim_moderation", { p_id: id, p_total_limit_cents: 5000 });
    expect(mocks.moderate).not.toHaveBeenCalled();
  });
  it.each([{ ...claim, id: "different-id" }, { ...claim, claimToken: null }])("rejects malformed or mismatched claims", async invalidClaim => {
    mocks.rpc.mockResolvedValue(invalidClaim);
    await reviewNewContribution(id); expect(mocks.moderate).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("screens once after budget claim and finishes using only claim token and metadata", async () => {
    mocks.rpc.mockResolvedValueOnce(claim).mockResolvedValueOnce({ ok: true });
    mocks.moderate.mockResolvedValue(screened);
    await reviewNewContribution(id);
    expect(mocks.moderate).toHaveBeenCalledExactlyOnceWith(claim.payload, claim.consent, "synthetic-not-a-real-key", expect.any(AbortSignal));
    expect(mocks.rpc).toHaveBeenLastCalledWith("jevarena_finish_moderation", { p_id: id, p_claim_token: claim.claimToken, p_publish: true, p_reason: "Category template", p_model: "typesafe-ai/jev" });
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("synthetic-not-a-real-key");
  });
  it.each([{ ...screened, publish: false }, { ...screened, status: "failed" }, { ...screened, publish: "true" }])("never publishes non-successful moderation", async result => {
    mocks.rpc.mockResolvedValueOnce(claim).mockResolvedValueOnce({ ok: true });
    mocks.moderate.mockResolvedValue(result);
    await reviewNewContribution(id);
    expect(mocks.rpc.mock.calls[1][1].p_publish).toBe(false);
  });
  it("does not retry or publish when screening throws", async () => {
    mocks.rpc.mockResolvedValueOnce(claim);
    mocks.moderate.mockRejectedValue(new Error("synthetic failure"));
    await reviewNewContribution(id);
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.moderate).toHaveBeenCalledTimes(1);
  });
  it("does not retry a failed claim or finalization", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("claim unavailable"));
    await reviewNewContribution(id);
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.moderate).not.toHaveBeenCalled();
    mocks.rpc.mockReset().mockResolvedValueOnce(claim).mockRejectedValueOnce(new Error("finish unavailable"));
    mocks.moderate.mockResolvedValue(screened);
    await reviewNewContribution(id);
    expect(mocks.rpc).toHaveBeenCalledTimes(2); expect(mocks.moderate).toHaveBeenCalledTimes(1);
  });
});
