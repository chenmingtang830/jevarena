"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Button} from "./ui/button";
type Item={id:string;title:string;language:string;kind:string;createdAt:string;expiresAt:string};
export function HistoryList(){
  const [items,setItems]=useState<Item[]>([]),[message,setMessage]=useState("Loading…"),[cursor,setCursor]=useState<string|null>(null),[confirm,setConfirm]=useState<string|null>(null),[busy,setBusy]=useState(false),[signedIn,setSignedIn]=useState(false);
  async function load(before?:string){
    setBusy(true);
    try{
      const r=await fetch(`/api/history${before?`?before=${encodeURIComponent(before)}`:""}`,{cache:"no-store"});
      if(!r.ok){setMessage(r.status===401?"Sign in to view your private history.":"History is unavailable. You can still use JevArena as a guest.");return;}
      const data=await r.json();setSignedIn(true);setItems(old=>before?[...old,...data.items]:data.items);setCursor(data.nextCursor??null);setMessage(data.items.length?"":"No saved experiments yet. Saving is always your choice.");
    }catch{setMessage("Could not load history. Try again.");}finally{setBusy(false);}
  }
  useEffect(()=>{void load();},[]);
  async function remove(id:string){
    setBusy(true);try{const r=await fetch(`/api/history/${id}`,{method:"DELETE"});if(!r.ok)throw new Error();setItems(old=>old.filter(x=>x.id!==id));setConfirm(null);setMessage("Experiment deleted from your active history. Backup retention is described in Privacy.");}catch{setMessage("Could not delete. Please try again.");}finally{setBusy(false);}
  }
  async function download(id:string){
    setBusy(true);try{const r=await fetch(`/api/history/${id}`,{cache:"no-store"});if(!r.ok)throw new Error();const data=await r.json();const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=`jevarena-history-${id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setMessage("Could not download. Please try again.");}finally{setBusy(false);}
  }
  return <section><p>Only experiments you explicitly save appear here. They expire after 30 days; download anything you want to keep. Saving does not contribute to research or publish a case.</p><p role="status">{message}</p>
    {!signedIn && <p><Link href="/login">Sign in</Link> · <Link href="/">Continue as guest</Link></p>}
    <ul className="history-list">{items.map(item=><li key={item.id}><h2>{item.title}</h2><p>{item.language} · Saved {new Date(item.createdAt).toLocaleDateString()} · Expires {new Date(item.expiresAt).toLocaleDateString()}</p><Button variant="secondary" disabled={busy} onClick={()=>download(item.id)}>Download experiment</Button> <Button variant="ghost" disabled={busy} onClick={()=>setConfirm(item.id)}>Delete</Button>{confirm===item.id && <div role="group" aria-label="Confirm deletion"><p>Delete this saved experiment? Download it first if you want a copy.</p><Button disabled={busy} onClick={()=>remove(item.id)}>Delete permanently</Button> <Button variant="ghost" onClick={()=>setConfirm(null)}>Keep it</Button></div>}</li>)}</ul>
    {cursor && <Button disabled={busy} onClick={()=>load(cursor)}>Load more</Button>}
    <Button variant="ghost" disabled={busy} onClick={()=>load()}>Refresh history</Button>
    {signedIn && <form method="post" action="/auth/signout"><Button variant="ghost" type="submit">Sign out</Button></form>}
  </section>;
}
