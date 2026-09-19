// Operator-only: two paid moderation attempts, no retries. Requires explicit budget approval.
// Test submissions are withdrawn in finally; no keys or deletion tokens are printed.
import { randomBytes, randomUUID } from "node:crypto";

async function main() {
  if (process.env.JEVARENA_CANARY_AUTHORIZED !== "true") throw new Error("Explicit canary approval required");
  const origin = "https://jevarena-lab.vercel.app";
  const receipts: {receiptId:string;deletionToken:string}[] = [];
  const ids: string[] = [];
  const headers = {"Content-Type":"application/json",Origin:origin};
  try {
    for (const [index, content] of ["What is 2 + 2?", "What color is the object in the image? No image is provided."].entries()) {
      const id=randomUUID(), deletionToken=randomBytes(32).toString("base64url");
      // Retain recovery information before transmission, including uncertain delivery.
      receipts.push({receiptId:id,deletionToken}); ids.push(id);
      const response=await fetch(`${origin}/api/contributions`,{method:"POST",headers,signal:AbortSignal.timeout(20000),body:JSON.stringify({
        schemaVersion:1,submissionId:id,deletionToken,
        consent:{version:"2026-09-19-auto-review-v1",research:true,rights:true,reviewed:true,allowPublication:true,publication:"after-ai-review",automatedReview:true,reviewProvider:"vercel"},
        contribution:{schemaVersion:1,id,license:"CC-BY-4.0",status:"community-submitted",runs:[],challenge:{schemaVersion:1,id,title:`Synthetic release check ${index+1}`,language:"en",kind:"judgment",content,question:"Choose the correct answer.",options:(index?["Red","Blue"]:["4","5"]).map((label,i)=>({id:`option${i+1}`,label}))}},
      })});
      console.log(JSON.stringify({step:"intake",index,id,status:response.status}));
      if(response.status!==201) throw new Error("Canary intake failed; no retry");
    }
    await new Promise(resolve=>setTimeout(resolve,20000));
    const response=await fetch(`${origin}/api/community`,{cache:"no-store"});
    if(!response.ok) throw new Error("Public feed unavailable");
    const feed=await response.json();
    console.log(JSON.stringify({step:"feed",allowedVisible:feed.items.some((x:{id:string})=>x.id===ids[0]),missingContextVisible:feed.items.some((x:{id:string})=>x.id===ids[1])}));
  } finally {
    for (const receipt of receipts) {
      const response=await fetch(`${origin}/api/contributions/delete`,{method:"POST",headers,signal:AbortSignal.timeout(20000),body:JSON.stringify(receipt)});
      console.log(JSON.stringify({step:"withdraw",id:receipt.receiptId,status:response.status}));
      if(!response.ok) process.exitCode=1;
    }
    const response=await fetch(`${origin}/api/community`,{cache:"no-store"});
    if(response.ok){const feed=await response.json(); console.log(JSON.stringify({step:"withdrawal-visible",remaining:feed.items.filter((x:{id:string})=>ids.includes(x.id)).length}));}
  }
}
void main().catch(()=>{console.error("Canary did not complete; inspect status without retrying paid calls.");process.exitCode=1;});
