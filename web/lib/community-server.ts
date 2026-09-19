import "server-only";

export async function communityRPC(name: "jevarena_claim_moderation" | "jevarena_finish_moderation" | "jevarena_public_questions", body: Record<string,unknown>) {
  const url = process.env.SUPABASE_URL ?? "", key=process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(url) || key.length<32 || /\s/.test(key)) throw new Error("Community unavailable");
  const headers:Record<string,string>={"Content-Type":"application/json",apikey:key};
  if(!key.startsWith("sb_secret_")) headers.Authorization=`Bearer ${key}`;
  const response=await fetch(`${url.replace(/\/$/,"")}/rest/v1/rpc/${name}`,{method:"POST",headers,body:JSON.stringify(body),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
  if(!response.ok || !response.body) throw new Error("Community unavailable");
  const reader=response.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
  try { for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>3_000_000)throw new Error("Response too large");chunks.push(value);} }
  catch(error){await reader.cancel();throw error;}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
