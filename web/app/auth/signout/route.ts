import { NextResponse } from "next/server";
import { createAuthClient, siteOrigin } from "@/lib/supabase/server";
export async function POST(request: Request) {
  try {
    if(request.headers.get("origin") !== siteOrigin() || request.headers.get("sec-fetch-site") === "cross-site") return new Response(null,{status:403});
    const client=await createAuthClient(); const {error}=await client.auth.signOut({scope:"local"});
    if(error) throw new Error("Signout failed");
    return NextResponse.redirect(`${siteOrigin()}/login`,303);
  } catch { return Response.json({error:"Could not sign out. Please try again."},{status:503}); }
}
