import { NextResponse } from "next/server";
import { authConfigured, createAuthClient, siteOrigin } from "@/lib/supabase/server";
export async function GET(request: Request) {
  if(!authConfigured())return NextResponse.json({error:"Account login is not enabled. Continue as a guest."},{status:503,headers:{"Cache-Control":"no-store"}});
  try {
    const code = new URL(request.url).searchParams.get("code");
    if (!code || code.length > 4096) throw new Error("Missing code");
    const client = await createAuthClient();
    const {error} = await client.auth.exchangeCodeForSession(code);
    if (error) throw new Error("Sign-in failed");
    return NextResponse.redirect(`${siteOrigin()}/history`,{status:303,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
  } catch {
    return NextResponse.redirect(`${siteOrigin()}/login?error=signin`,{status:303,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
  }
}
