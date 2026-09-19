"use client";
import { useState } from "react";
import { Challenge, CaseContribution, modelInput } from "@/lib/contracts";
import { Playground } from "./playground";
import { Button } from "./ui/button";
import { ShareTools } from "./share-tools";
import { REPO } from "./site-shell";
export function CaseViewer({
  challenge,
  contribution,
}: {
  challenge: Challenge;
  contribution?: CaseContribution;
}) {
  const [guess, setGuess] = useState("");
  const [playing, setPlaying] = useState(false);
  if (playing) return <Playground initial={challenge} />;
  const input = modelInput(challenge);
  return (
    <main id="main" className="prose-page">
      <span className="tag">
        {contribution
          ? "Community submitted · unverified"
          : "Starter template · no measured runs"}
      </span>
      <h1 style={{ marginTop: 18 }}>{challenge.title}</h1>
      <p>
        {challenge.kind === "judgment" ? challenge.question : challenge.prompt}
      </p>
      <div className="case-content">
        {challenge.kind === "judgment" ? (
          challenge.content
        ) : (
          <>
            <h3>Candidate answer 1</h3>
            <p>{challenge.answer1}</p>
            <h3 style={{ marginTop: 22 }}>Candidate answer 2</h3>
            <p>{challenge.answer2}</p>
          </>
        )}
      </div>
      <section>
        <h2>Your judgment first</h2>
        <p>What would you choose? No model call is made.</p>
        <div className="guess-options" style={{ marginTop: 16 }}>
          {input.options.map((o) => (
            <Button
              variant="secondary"
              key={o.id}
              onClick={() => setGuess(o.id)}
            >
              {guess === o.id ? "Selected: " : ""}
              {o.label}
            </Button>
          ))}
        </div>
        {guess && (
          <div className="notice">
            <p>
              Your choice: {input.options.find((o) => o.id === guess)?.label}
            </p>
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
        )}
      </section>
      {guess && contribution && contribution.runs.length > 0 && (
        <section>
          <h2>Submitted observations</h2>
          <p>
            These results were imported from a user-controlled file. They have
            not been independently verified.
          </p>
          {contribution.runs.map((r) => (
            <div key={r.id} className="case-entry">
              <h3>{r.model}</h3>
              <p>
                Choice: {r.choice ?? r.status} ·{" "}
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
        <Button onClick={() => setPlaying(true)}>
          Reproduce with your keys
        </Button>
        <a href={`${REPO}/discussions`}>Discuss this case</a>
      </section>
      <ShareTools
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
    </main>
  );
}
