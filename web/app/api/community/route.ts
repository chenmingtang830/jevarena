import {communityRPC} from "@/lib/community-server";
import {PublicCommunityResponseSchema} from "@/lib/published-community";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
  try {
    const data=PublicCommunityResponseSchema.parse(await communityRPC("jevarena_public_questions",{}));
    return Response.json(data,{headers});
  } catch { return Response.json({error:"Community is temporarily unavailable."},{status:503,headers}); }
}
