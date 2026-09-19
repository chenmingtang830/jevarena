import { listHistory, saveHistory } from "@/lib/history";
import { getHistoryContext } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(request: Request) { return listHistory(request, getHistoryContext); }
export async function POST(request: Request) { return saveHistory(request, getHistoryContext); }
