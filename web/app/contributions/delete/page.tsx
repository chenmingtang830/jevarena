"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DeletionReceipt = { receiptId: string; deletionToken: string };

export default function DeleteContribution() {
  const [receipt, setReceipt] = useState<DeletionReceipt | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState("");

  async function load(file?: File) {
    setReceipt(null);
    setConfirmed(false);
    setDeleted(false);
    setError("");
    if (!file) return;
    try {
      if (file.size > 16000) throw new Error();
      const data = JSON.parse(await file.text());
      if (!data || typeof data.receiptId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.receiptId) ||
          typeof data.deletionToken !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(data.deletionToken)) throw new Error();
      setReceipt({ receiptId: data.receiptId, deletionToken: data.deletionToken });
    } catch {
      setError("Choose a valid JevArena deletion or recovery receipt under 16 KB. No request was sent.");
    }
  }

  async function withdraw() {
    if (!receipt || !confirmed || busy || deleted) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contributions/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(receipt), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        setError(response.status === 404
          ? "No matching submission was found for this receipt. Check that you selected the correct receipt."
          : "Withdrawal could not be confirmed. Keep your receipt and retry; the same request is safe to repeat.");
        return;
      }
      const result = await response.json();
      if (result.deleted !== true) throw new Error();
      setDeleted(true);
      setReceipt(null);
    } catch {
      setError("Withdrawal could not be confirmed. Keep your receipt and retry; the same request is safe to repeat.");
    } finally {
      setBusy(false);
    }
  }

  return <main id="main" className="prose-page">
    <h1>Withdraw a submission.</h1>
    <p>Open the deletion receipt you saved when contributing. The receipt stays in this tab until you explicitly withdraw; its token is never put in a URL or browser storage.</p>
    <section>
      <label htmlFor="deletion-receipt">Choose your deletion receipt</label>
      <Input id="deletion-receipt" type="file" accept="application/json,.json" disabled={busy} onChange={(event) => load(event.target.files?.[0])} />
      {receipt && <>
        <p>Ready to withdraw receipt <code>{receipt.receiptId}</code>.</p>
        <label className="check-label"><Input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />Delete this research submission from JevArena.</label>
        <p className="hint">This does not remove copies you exported or shared elsewhere.</p>
        <Button disabled={!confirmed || busy} onClick={withdraw}>{busy ? "Withdrawing…" : "Withdraw submission"}</Button>
      </>}
      {deleted && <p role="status" className="notice">Submission withdrawn. Its stored task and results have been deleted.</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  </main>;
}
