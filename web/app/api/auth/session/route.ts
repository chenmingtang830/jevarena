import { getHistoryContext, authConfigured } from "@/lib/supabase/server";
export async function GET() {
  try { const context = await getHistoryContext(); return Response.json({enabled:authConfigured(),authenticated:Boolean(context)},{headers:{"Cache-Control":"private, no-store"}}); }
  catch { return Response.json({enabled:false,authenticated:false},{status:503,headers:{"Cache-Control":"no-store"}}); }
}
