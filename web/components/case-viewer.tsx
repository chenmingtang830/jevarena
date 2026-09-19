"use client";
import Link from "next/link";
import { Challenge, CaseContribution, modelInput } from "@/lib/contracts";
import { Playground } from "./playground";
import { ShareTools } from "./share-tools";
import { REPO } from "./site-shell";
export function CaseViewer({
  challenge,
  contribution,
}: {
  challenge: Challenge;
  contribution?: CaseContribution;
}) {
  const input = modelInput(challenge);
  return (
    <>
      <Playground initial={challenge} />
      <aside className="prose-page" aria-label="Original case details">
      <p><Link href="/cases">Back to cases</Link></p>
      <span className="tag">
        {contribution
          ? "Community submitted · unverified"
          : "Starter template · no measured runs"}
      </span>
      <h2 style={{ marginTop: 18 }}>{challenge.title}</h2>
      <p>
        The original case is loaded in the editable experiment above. Editing or opening it does not call a model. Details and exports below describe the original case.
      </p>
      <details style={{ marginTop: 20 }}>
        <summary>Reference answer and reasoning</summary>
        <div className="notice">
            <p>
              Reference:{" "}
              {input.options.find((o) => o.id === challenge.expected)?.label ??
                "No adjudicated reference available."}
            </p>
            {challenge.basis && <p>{challenge.basis}</p>}
            <p>
              Reference answers can be disputed. This is not a model performance
              result.
            </p>
        </div>
      </details>
      {contribution && contribution.runs.length > 0 && (
        <section>
          <h2>Imported observations · unverified</h2>
          <p>
            These results were imported from a user-controlled file. They have
            not been independently verified. They belong to the original imported task, not edits or new comparisons above.
          </p>
          {contribution.runs.map((r) => (
            <div key={r.id} className="case-entry">
              <h3>{r.model}</h3>
              <p>
                Choice: {input.options.find((option) => option.id === r.choice)?.label ?? r.choice ?? r.status} ·{" "}
                {(r.latencyMs / 1000).toFixed(2)} s ·{" "}
                {r.cost.usd === null
                  ? "Cost unknown"
                  : `$${r.cost.usd.toFixed(6)} (${r.cost.basis})`}
              </p>
            </div>
          ))}
        </section>
      )}
      <section className="inline">
        <a href={`${REPO}/discussions`}>Discuss this case</a>
      </section>
      <ShareTools
        label={contribution?.runs.length ? "Share original observations" : "Share this example"}
        value={
          contribution ?? {
            schemaVersion: 1,
            id: challenge.id,
            challenge,
            runs: [],
            license: "CC-BY-4.0",
            status: "community-submitted",
          }
        }
      />
      </aside>
    </>
  );
}
