import {beforeEach,describe,it,expect,vi} from "vitest";
const state=vi.hoisted(()=>({enabled:false,send:vi.fn(),exchange:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({authConfigured:()=>state.enabled,siteOrigin:()=>"https://jevarena.test",createAuthClient:async()=>({auth:{signInWithOtp:state.send,exchangeCodeForSession:state.exchange}})}));
import {POST} from "../app/auth/email/route";
import {GET} from "../app/auth/callback/route";
beforeEach(()=>{state.enabled=false;state.send.mockReset();state.exchange.mockReset();});
describe("email authentication boundaries",()=>{
  const request=(body:string,origin="https://jevarena.test")=>new Request("https://jevarena.test/auth/email",{method:"POST",headers:{origin,"content-type":"application/x-www-form-urlencoded"},body});
  it("guest deployment sends no email",async()=>{expect((await POST(request("email=x%40example.test&policy=2026-09-19-public-v1"))).status).toBe(503);expect(state.send).not.toHaveBeenCalled();});
  it("requires same origin and explicit policy version",async()=>{state.enabled=true;expect((await POST(request("email=x%40example.test","https://evil.test"))).status).toBe(403);await POST(request("email=x%40example.test"));expect(state.send).not.toHaveBeenCalled();});
  it("uses a fixed callback and never echoes email",async()=>{state.enabled=true;state.send.mockResolvedValue({error:null});const response=await POST(request("email=x%40example.test&policy=2026-09-19-public-v1&next=https%3A%2F%2Fevil.test"));expect(response.status).toBe(303);expect(response.headers.get("location")).toBe("https://jevarena.test/login?sent=1");expect(state.send.mock.calls[0][0].options.emailRedirectTo).toBe("https://jevarena.test/auth/callback");expect(await response.text()).not.toContain("x@example.test");});
  it("callback fails closed while auth disabled",async()=>{expect((await GET(new Request("https://jevarena.test/auth/callback?code=fake"))).status).toBe(503);expect(state.exchange).not.toHaveBeenCalled();});
  it("callback ignores attacker redirect and verifies code",async()=>{state.enabled=true;state.exchange.mockResolvedValue({error:null});const response=await GET(new Request("https://jevarena.test/auth/callback?code=fake&next=https://evil.test"));expect(state.exchange).toHaveBeenCalledWith("fake");expect(response.headers.get("location")).toBe("https://jevarena.test/history");});
  it("failed code never leaks authentication details",async()=>{state.enabled=true;state.exchange.mockResolvedValue({error:{message:"secret-provider-error"}});const response=await GET(new Request("https://jevarena.test/auth/callback?code=fake"));expect(response.headers.get("location")).toBe("https://jevarena.test/login?error=signin");expect(await response.text()).not.toContain("secret-provider-error");});
});
