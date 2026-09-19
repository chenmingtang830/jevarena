import { handleWithdrawal } from "@/lib/contributions";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  return handleWithdrawal(request);
}
