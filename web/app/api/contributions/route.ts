import { handleContribution } from "@/lib/contributions";
import { after } from "next/server";
import { reviewNewContribution } from "@/lib/moderation-worker";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const response = await handleContribution(request);
  if (response.status === 201 && process.env.JEVARENA_AUTOMODERATION_ENABLED === "true") {
    const {receiptId} = await response.clone().json();
    after(() => reviewNewContribution(receiptId));
  }
  return response;
}
