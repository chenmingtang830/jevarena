"use client";
import { useEffect, useRef, useState } from "react";
import { connectOpenRouter } from "@/lib/openrouter-connect";
import { Button } from "./ui/button";

export function OpenRouterConnect({ onConnected, disabled = false }: { onConnected: (key: string) => void; disabled?: boolean }) {
  const cancel = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => () => cancel.current?.(), []);
  useEffect(() => {
    if (disabled) { cancel.current?.(); setBusy(false); setMessage(""); }
  }, [disabled]);
  function connect() {
    cancel.current?.();
    setBusy(true);
    setMessage("Continue in the OpenRouter window.");
    cancel.current = connectOpenRouter(key => {
      setBusy(false);
      setMessage("Connected for this tab. Review the cost, then start judging.");
      onConnected(key);
    }, error => { setBusy(false); setMessage(error); });
  }
  return <div className="openrouter-connect">
    <Button type="button" onClick={connect} disabled={disabled || busy}>{busy ? "Connecting…" : "Continue to OpenRouter"}</Button>
    {busy && <Button type="button" variant="ghost" onClick={() => { cancel.current?.(); setBusy(false); setMessage("Connection cancelled. Your question is unchanged."); }}>Cancel connection</Button>}
    {message && <p className="hint" role="status" aria-live="polite">{message}</p>}
  </div>;
}
