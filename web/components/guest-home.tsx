"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import evidence from "../../docs/evidence/openrouter-canary-2026-09-19.json";
import { templates } from "@/lib/cases";
import { modelInput } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import styles from "./guest-home.module.css";

const examples = templates.filter((task) => task.language !== "zh" && evidence.runs.some((run) => run.challengeId === task.id));
const source = "https://github.com/chenmingtang830/jevarena/blob/main/docs/evidence/openrouter-canary-2026-09-19.json";
export function GuestHome({ initialId }: { initialId?: string }) {
  const [active, setActive] = useState(examples.find((item) => item.id === initialId) ?? examples[0]);
  const [guess, setGuess] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const input = modelInput(active);
  const runs = evidence.runs.filter((run) => run.challengeId === active.id);
  function reveal() { setRevealed(true); requestAnimationFrame(() => resultHeading.current?.focus()); }
  return <main id="main" className={styles.page}>
    <header className={styles.intro}>
      <h1>Would you make the same call?</h1>
      <p>Pick an answer. See what Jev and another model chose.</p>
      <p className="hint">No account. No API key. No model calls.</p>
    </header>
    <div className={styles.examples} aria-label="Choose an example">
      {examples.map((task) => <Button key={task.id} variant="outline" aria-pressed={active.id === task.id} onClick={() => { setActive(task); setGuess(null); setRevealed(false); setShareStatus(""); }}>{task.id === "decimal-comparison" ? "Which number is larger?" : "Who can participate? 中文"}</Button>)}
    </div>
    <section className={styles.question} aria-labelledby="guest-question" lang={active.language}>
      <h2 id="guest-question">{active.kind === "comparison" ? active.prompt : active.question}</h2>
      {active.kind === "comparison" ? <div className={styles.answers}>
        <p><strong>Answer 1</strong><br />{active.answer1}</p>
        <p><strong>Answer 2</strong><br />{active.answer2}</p>
      </div> : <p>{active.content}</p>}
      <fieldset className={styles.choices} disabled={revealed}>
        <legend>{active.kind === "comparison" ? "Which answer is better?" : "Your answer"}</legend>
        {input.options.map((option) => <Button variant={guess === option.id ? "primary" : "outline"} key={option.id} aria-pressed={guess === option.id} onClick={() => setGuess(option.id)}>{option.label}</Button>)}
      </fieldset>
      {!revealed && <div className={styles.revealActions}>
        <Button onClick={reveal} disabled={!guess}>Reveal model answers <ArrowRight size={16} /></Button>
        <Button variant="ghost" onClick={reveal}>Skip my guess</Button>
      </div>}
    </section>
    {revealed && <section className={styles.results} aria-labelledby="recorded-results">
      <h2 id="recorded-results" tabIndex={-1} ref={resultHeading}>Here’s what the models chose</h2>
      <p>{guess ? `Your answer: ${input.options.find((option) => option.id === guess)?.label}. ` : ""}Reference answer: {input.options.find((option) => option.id === active.expected)?.label}.</p>
      <p>{active.basis}</p>
      <div className={styles.models}>{runs.map((run) => <article key={run.id}>
        <h3>{run.model.startsWith("typesafe/") ? "Jev" : "Gemini 2.5 Flash"}</h3>
        <p className={styles.modelChoice}>{input.options.find((option) => option.id === run.choice)?.label}</p>
        <p className="hint">{(run.latencyMs / 1000).toFixed(2)} s · ${run.cost.usd.toFixed(6)} · provider-reported cost</p>
        <p className="hint">Version: {run.resolvedModel ?? "unknown (requested google/gemini-2.5-flash)"}</p>
      </article>)}</div>
      <p className="hint">Recorded September 19, 2026. Local, sequential OpenRouter calls—not a live match or a benchmark. Two examples do not establish which model is better. <a href={source} target="_blank" rel="noreferrer">Inspect the run records</a>.</p>
      <div className={styles.revealActions}>
        <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/?example=${encodeURIComponent(active.id)}`); setShareStatus("Example link copied. Your guess is not included."); } catch { setShareStatus("Could not copy. Use the example link below."); } }}>Copy example link</Button>
        <Link href={`/?example=${active.id}`}>Example link</Link>
        <Link href={`/play?case=${active.id}`}>Run this yourself <ArrowRight size={14} /></Link>
      </div>
      <p role="status" className="hint">{shareStatus}</p>
    </section>}
    <nav className={styles.next} aria-label="More ways to explore">
      <Link href="/play">Test your own question <ArrowRight size={15} /></Link>
      <Link href="/cases">Explore community cases</Link>
      <Link href="/run-locally">Run locally</Link>
    </nav>
  </main>;
}
