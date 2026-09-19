"use client";
import Link from "next/link";
import { Input } from "./ui/input";

export const PUBLIC_COLLECTION = process.env.NEXT_PUBLIC_PUBLIC_COLLECTION_ENABLED === "true";

export function PublicContributionChoice({ checked, onChange, live = false }: { checked: boolean; onChange: (value: boolean) => void; live?: boolean }) {
  if (!PUBLIC_COLLECTION) return null;
  return <section className="public-contribution-choice" aria-label="Contribution preference">
    <label className="check-label"><Input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />Contribute publicly</label>
    <p className="hint">{checked
      ? `${live ? "Voting sends your question, model results and vote" : "Submit & reveal sends your answer and optional reason"} for research and publication after review. No API key. Uncheck to keep this in your tab.`
      : "Private mode: no community submission. Your answer stays in this tab."}</p>
    {checked && <details><summary>Contribution terms</summary><p className="hint">By submitting, you confirm you reviewed the content, removed sensitive data, and have permission to contribute it. Your original additions are CC BY 4.0; source material keeps its own license. Pending records expire after 30 days. Published cases and copies may persist. Keep the deletion receipt to withdraw pending data. <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></p></details>}
  </section>;
}
