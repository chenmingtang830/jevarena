"use client";
import {useRef,useState} from "react";
import {Challenge,RunRecord,Vote} from "@/lib/contracts";
import {POLICY_VERSION} from "@/lib/policies";
import {Button} from "./ui/button";
export function SaveHistory({challenge,runs,vote}:{challenge:Challenge;runs:RunRecord[];vote?:Vote}) {
  const [open,setOpen]=useState(false),[consent,setConsent]=useState(false),[status,setStatus]=useState(""),[busy,setBusy]=useState(false),[login,setLogin]=useState(false);
  const requestId=useRef<string|null>(null);
  async function save(){
    if(!consent || busy)return;
    setBusy(true); setStatus("");setLogin(false);
    try{
      const session=await fetch("/api/auth/session",{cache:"no-store"}).then(r=>r.json());
      if(!session.enabled){setStatus("Account saving is not available yet. Download your results instead.");return;}
      if(!session.authenticated){setLogin(true);return;}
      requestId.current ??= crypto.randomUUID();
      const response=await fetch("/api/history",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({schemaVersion:1,id:requestId.current,history:{challenge,runs,...(vote?{vote}:{})},consent:{version:POLICY_VERSION,savePrivate:true}})});
      if(!response.ok){setStatus(response.status===401?"Please sign in again, then retry saving.":response.status===409?"This result changed since your last save. Download it instead.":"Could not save. Your results remain in this tab; you can retry or download them.");return;}
      setStatus("Saved privately for 30 days. This is not a research contribution or a public case.");
    }catch{setStatus("Saving failed. Your results remain in this tab.");}finally{setBusy(false);}
  }
  if(process.env.NEXT_PUBLIC_HISTORY_ENABLED!=="true")return null;
  return <section aria-label="Private account history">
    <Button variant="ghost" onClick={()=>setOpen(!open)} aria-expanded={open}>Save to my history</Button>
    {open && <div className="history-save">
      <p>Save this question, answers, model results and vote privately to your account for 30 days. Up to 100 experiments. No API keys. Saving is separate from contributing to research or publishing.</p>
      <label className="check-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Save this experiment to my private history</label>
      <Button disabled={!consent||busy} onClick={save}>{busy?"Saving…":"Save privately"}</Button>
      {login && <p><a href="/login" target="_blank" rel="noopener noreferrer">Sign in with email in a new tab</a>, then return here and click Save privately. This keeps your experiment and key in this tab.</p>}
      <p role="status">{status}</p><a href="/history" target="_blank" rel="noopener noreferrer">Open my history</a>
    </div>}
  </section>;
}
