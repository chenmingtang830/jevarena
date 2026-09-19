import { deleteHistory, readHistory } from "@/lib/history";
import { getHistoryContext } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: RouteContext) { return readHistory(request, (await params).id, getHistoryContext); }
export async function DELETE(request: Request, { params }: RouteContext) { return deleteHistory(request, (await params).id, getHistoryContext); }
