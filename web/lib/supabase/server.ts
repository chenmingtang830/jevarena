import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function authConfigured() {
  if(process.env.JEVARENA_AUTH_ENABLED !== "true")return false;
  try{
    const url=new URL(process.env.SUPABASE_URL??"");
    const key=process.env.SUPABASE_PUBLISHABLE_KEY??"";
    const publicKey=key.startsWith("sb_publishable_") || (key.split(".").length===3 && JSON.parse(Buffer.from(key.split(".")[1],"base64url").toString()).role==="anon");
    return url.protocol==="https:" && /^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) && url.pathname==="/" && !url.port && !url.username && !url.password && !url.search && !url.hash && publicKey && Boolean(process.env.JEVARENA_SITE_URL) && Boolean(siteOrigin());
  }catch{return false;}
}
export function siteOrigin() {
  const url = new URL(process.env.JEVARENA_SITE_URL ?? "http://localhost:3000");
  if (url.pathname !== "/" || url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost","127.0.0.1"].includes(url.hostname)))) throw new Error("Invalid site origin");
  return url.origin;
}
export async function createAuthClient() {
  if (!authConfigured()) throw new Error("Account service unavailable");
  const jar = await cookies();
  // Public project key plus the user's verified session, never the service-role key.
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
    cookies: { getAll: () => jar.getAll(), setAll: (values) => { for (const {name,value,options} of values) jar.set(name,value,options); } },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000) }) },
  });
}
export async function getHistoryContext() {
  if (!authConfigured()) return null;
  const client = await createAuthClient();
  const {data,error} = await client.auth.getUser();
  if (error || !data.user) return null;
  return { userId: data.user.id, client };
}
