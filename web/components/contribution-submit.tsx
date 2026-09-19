"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type CaseContribution } from "@/lib/contracts";
import { contributionJson } from "@/lib/sharing";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { REPO } from "./site-shell";

export type ContributionReceipt = {
  receiptId: string;
  status: "community-submitted";
  receivedAt: string;
  expiresAt: string;
  deletionToken: string;
};
class SubmissionError extends Error {}

function saveReceipt(receipt: Pick<ContributionReceipt, "receiptId" | "deletionToken"> & Partial<ContributionReceipt>) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `jevarena-receipt-${receipt.receiptId}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ContributionSubmit({ value, publicCandidate = false }: { value: CaseContribution; publicCandidate?: boolean }) {
  const [research, setResearch] = useState(publicCandidate);
  const [rights, setRights] = useState(publicCandidate);
  const [reviewed, setReviewed] = useState(publicCandidate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<ContributionReceipt | null>(null);
  const attempt = useRef<{ body: string; receiptId: string; deletionToken: string } | null>(null);
  const started = useRef(false);
  // Mounted only by an explicit answer/vote action after the public-mode notice.
  // Never mount this automatic variant while merely browsing/importing a record.
  useEffect(() => {
    if (publicCandidate && !started.current) { started.current = true; void submit(); }
  }, []);

  async function submit() {
    if (!research || !rights || !reviewed || busy || receipt) return;
    setBusy(true);
    setError("");
    try {
      if (!attempt.current) {
        const deletionToken = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
          .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
        const submissionId = crypto.randomUUID();
        attempt.current = {
          receiptId: submissionId,
          deletionToken,
          body: JSON.stringify({
            schemaVersion: 1,
            submissionId,
            deletionToken,
            consent: publicCandidate
              ? { version: "2026-09-19-public-v1", research: true, rights: true, reviewed: true, allowPublication: true, publication: "after-review" }
              : { version: "2026-09-19", research: true, rights: true, reviewed: true, allowPublication: false },
            contribution: JSON.parse(contributionJson(value)),
          }),
        };
      }
      const response = await fetch("/api/contributions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: attempt.current.body,
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const messages: Record<number, string> = {
          400: "This experiment could not be accepted. Check that its task and run records are complete.",
          403: "This page could not submit the experiment. Open JevArena directly and try again.",
          409: "This submission conflicts with an earlier attempt. Keep this tab open and do not submit another copy.",
          410: "This submission was withdrawn. It will not be submitted again.",
          413: "This experiment is too large to submit. Use the JSON export to review its size.",
          429: "Storage or submission capacity reached. Download the JSON and contribute on GitHub. Your experiment remains in this tab.",
          503: "Research submissions are temporarily unavailable. Your experiment remains in this tab.",
        };
        throw new SubmissionError(messages[response.status] ?? "We could not confirm receipt. Keep this tab open and retry the same submission.");
      }
      const result = await response.json();
      if (result.receiptId !== attempt.current.receiptId || result.status !== "community-submitted" ||
          typeof result.receivedAt !== "string" || typeof result.expiresAt !== "string" ||
          !Number.isFinite(Date.parse(result.receivedAt)) || !Number.isFinite(Date.parse(result.expiresAt)) ||
          result.deletionToken !== attempt.current.deletionToken) {
        throw new SubmissionError("We could not verify the receipt. Keep this tab open and retry the same submission.");
      }
      setReceipt(result);
    } catch (cause) {
      setError(cause instanceof SubmissionError
        ? cause.message
        : "We could not confirm receipt. Keep this tab open and retry the same submission.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="contribution-submit" aria-label={publicCandidate ? "Community contribution" : "Contribute to research"}>
    <h3>{publicCandidate ? "Your community contribution" : "Contribute privately to research"}</h3>
    {!publicCandidate && <p className="hint">Send the preview above to JevArena for research and private review. This is optional and does not publish your experiment. Pending submissions expire after 30 days.</p>}
    {receipt ? <div className="contribution-receipt" role="status">
      <p>{publicCandidate ? "Received for review before publication. Thank you for contributing." : "Received for private review. This is a community-submitted observation, not a verified result."}</p>
      <p className="hint">Receipt: <code>{receipt.receiptId}</code></p>
      <p className="hint">Received: <time dateTime={receipt.receivedAt}>{new Date(receipt.receivedAt).toISOString()}</time><br />Expires: <time dateTime={receipt.expiresAt}>{new Date(receipt.expiresAt).toISOString()}</time></p>
      <p className="hint">Download your receipt now. It contains the deletion token needed to withdraw this submission. Changing experiments or refreshing loses this in-memory copy.</p>
      <div className="inline"><Button variant="secondary" onClick={() => saveReceipt(receipt)}>Download deletion receipt</Button><Link href="/contributions/delete">Withdraw a submission</Link></div>
    </div> : <>
      <fieldset hidden={publicCandidate} disabled={busy} className="contribution-consent">
        <label className="check-label"><Input type="checkbox" checked={research} onChange={(event) => setResearch(event.target.checked)} />I consent to research use of this task, model runs and vote.</label>
        <label className="check-label"><Input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} />I have the rights to contribute this material under CC BY 4.0.</label>
        <label className="check-label"><Input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />I reviewed the preview and removed secrets and personal information.</label>
      </fieldset>
      {!publicCandidate && <p className="hint">Publication requires a separate action and permission. Research consent does not authorize a public case page. No API key is included.</p>}
      <Button disabled={!research || !rights || !reviewed || busy} onClick={submit}>{busy ? "Submitting…" : attempt.current ? "Retry research submission" : "Submit for private research"}</Button>
      {error && <p className="error" role="alert">{error}</p>}
      {error && <p className="hint">You can still download the JSON using the export controls above, then <a href={`${REPO}/issues/new/choose`} target="_blank" rel="noreferrer">contribute on GitHub</a>. GitHub contributions are public; review the contents first.</p>}
      {error && attempt.current && <><p className="hint">If delivery is uncertain, keep a recovery receipt. It can withdraw this submission if it reached the server.</p><Button variant="secondary" onClick={() => attempt.current && saveReceipt({ receiptId: attempt.current.receiptId, deletionToken: attempt.current.deletionToken })}>Download recovery receipt</Button></>}
    </>}
  </section>;
}
