import { NextResponse } from "next/server";
import { authConfigured, createAuthClient, siteOrigin } from "@/lib/supabase/server";
import { POLICY_VERSION } from "@/lib/policies";
import { z } from "zod";
import { readLoginForm } from "@/lib/auth-request";
export async function POST(request: Request) {
  if (!authConfigured()) return NextResponse.json({error:"Email login is not available yet. You can still use JevArena without an account."},{status:503});
  try {
    if (request.headers.get("origin") !== siteOrigin() || request.headers.get("sec-fetch-site") === "cross-site") return new Response(null,{status:403});
    if (Number(request.headers.get("content-length") ?? 0) > 1024) return new Response(null,{status:413});
    const form=await readLoginForm(request);
    const email=z.email().max(254).safeParse(form.get("email"));
    if(form.get("policy")!==POLICY_VERSION || !email.success) return NextResponse.redirect(`${siteOrigin()}/login?error=email`,303);
    const client=await createAuthClient();
    const {error}=await client.auth.signInWithOtp({email:email.data,options:{emailRedirectTo:`${siteOrigin()}/auth/callback`,shouldCreateUser:true,data:{termsVersion:POLICY_VERSION,termsAcceptedAt:new Date().toISOString()}}});
    if(error) return NextResponse.redirect(`${siteOrigin()}/login?error=email`,{status:303,headers:{"Cache-Control":"no-store"}});
    // Do not echo addresses or disclose whether an account already exists.
    return NextResponse.redirect(`${siteOrigin()}/login?sent=1`,{status:303,headers:{"Cache-Control":"no-store"}});
  } catch { return NextResponse.json({error:"Could not request a login link. Wait a moment and try again."},{status:503}); }
}
