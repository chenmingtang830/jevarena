import {communityRPC} from "./community-server";
import {moderateContribution} from "./moderation";

// Invoked only after successful intake. No scheduler, retries, or old-data replay.
export async function reviewNewContribution(id:string){
  if(process.env.JEVARENA_AUTOMODERATION_ENABLED!=="true") return;
  const key=process.env.JEVARENA_MODERATION_API_KEY;
  const limit=Number(process.env.JEVARENA_MODERATION_TOTAL_LIMIT_CENTS);
  if(!key || !Number.isSafeInteger(limit) || limit<1 || limit>5000) return;
  try {
    const claim=await communityRPC("jevarena_claim_moderation",{p_id:id,p_total_limit_cents:limit});
    if(claim.ok!==true || claim.id!==id || typeof claim.claimToken!=="string") return;
    const result=await moderateContribution(claim.payload,claim.consent,key,AbortSignal.timeout(45000));
    await communityRPC("jevarena_finish_moderation",{p_id:id,p_claim_token:claim.claimToken,p_publish:result.publish===true && result.status==="screened",p_reason:result.reason,p_model:result.requestedModel});
  } catch {
    // A failed/uncertain job stays unpublished. No payloads or keys in logs.
  }
}
