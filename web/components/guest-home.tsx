"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import evidence from "../../docs/evidence/openrouter-canary-2026-09-19.json";
import { templates } from "@/lib/cases";
import { communityTasks, communityTaskSource } from "@/lib/community-tasks";
import { modelInput, type CaseContribution } from "@/lib/contracts";
import { ContributionSubmit } from "./contribution-submit";
import { PUBLIC_COLLECTION, PublicContributionChoice } from "./public-contribution-choice";
import { Button } from "@/components/ui/button";
import styles from "./guest-home.module.css";

const examples = [...communityTasks.map(({ challenge }) => challenge), ...templates.filter((task) => task.language !== "zh" && evidence.runs.some((run) => run.challengeId === task.id))];
const source = "https://github.com/chenmingtang830/jevarena/blob/main/docs/evidence/openrouter-canary-2026-09-19.json";
export function GuestHome({ initialId }: { initialId?: string }) {
  const [active, setActive] = useState(examples.find((item) => item.id === initialId) ?? examples[0]);
  const [guess, setGuess] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [publicMode, setPublicMode] = useState(true);
  const [rationale, setRationale] = useState("");
  const [submissions, setSubmissions] = useState<CaseContribution[]>([]);
  const seenAnswers = useRef(new Set<string>());
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const input = modelInput(active);
  const community = communityTasks.find(({ challenge }) => challenge.id === active.id);
  const runs = evidence.runs.filter((run) => run.challengeId === active.id);
  function chooseExample(task: typeof active) { setActive(task); setGuess(null); setRevealed(false); setRationale(""); setShareStatus(""); }
  function reveal(collect = true) {
    const revealedBeforeAnswer = seenAnswers.current.has(active.id);
    if (collect && !revealed && guess && PUBLIC_COLLECTION && publicMode) {
      setSubmissions(current => [...current, {
        schemaVersion: 1, id: crypto.randomUUID(), challenge: active, runs: [],
        humanAnswer: { optionId: guess, revealedBeforeAnswer, ...(rationale.trim() ? { rationale: rationale.trim() } : {}) },
        ...(community ? { sourceAttributions: [{ url: communityTaskSource.data, author: communityTaskSource.author, license: communityTaskSource.license, notice: "Original task from pithings/advocaat. MIT source and copyright notice: https://github.com/pithings/advocaat/blob/46ed82661a41c27efd2a1bddf34f8dc1350d9143/LICENSE" }] } : {}),
        license: "CC-BY-4.0", status: "community-submitted",
      }]);
    }
    seenAnswers.current.add(active.id);
    setRevealed(true); requestAnimationFrame(() => resultHeading.current?.focus());
  }
  return <main id="main" className={styles.page}>
    <header className={styles.intro}>
      <h1>Would you make the same call?</h1>
      <p>Pick an answer. Reveal the recorded result.</p>
      <p className="hint">No account. No API key. No model calls.</p>
    </header>
    <div className={styles.examples} aria-label="Choose an example">
      {examples.map((task) => <Button key={task.id} variant="outline" aria-pressed={active.id === task.id} onClick={() => chooseExample(task)}>{task.id === "decimal-comparison" ? "Which number is larger?" : task.title}</Button>)}
    </div>
    <section className={styles.question} aria-labelledby="guest-question" lang={active.language}>
      <h2 id="guest-question">{active.kind === "comparison" ? active.prompt : community ? active.content : active.question}</h2>
      {active.kind === "comparison" ? <div className={styles.answers}>
        <p><strong>Answer 1</strong><br />{active.answer1}</p>
        <p><strong>Answer 2</strong><br />{active.answer2}</p>
      </div> : community ? <details><summary>Judging criteria</summary><p style={{ whiteSpace: "pre-line" }}>{active.question}</p></details> : <p>{active.content}</p>}
      <fieldset className={styles.choices} disabled={revealed}>
        <legend>{active.kind === "comparison" ? "Which answer is better?" : "Your answer"}</legend>
        {input.options.map((option) => <Button variant={guess === option.id ? "primary" : "outline"} key={option.id} aria-pressed={guess === option.id} onClick={() => setGuess(option.id)}>{option.label}</Button>)}
      </fieldset>
      {!revealed && <div className={styles.revealActions}>
        {PUBLIC_COLLECTION && <div className="full-width">
          <details><summary>Add a reason (optional)</summary><label htmlFor="guest-reason">Why this answer?</label><textarea id="guest-reason" maxLength={2000} value={rationale} onChange={event => setRationale(event.target.value)} /></details>
          <PublicContributionChoice checked={publicMode} onChange={setPublicMode} />
        </div>}
        <Button onClick={() => reveal()} disabled={!guess}>{PUBLIC_COLLECTION && publicMode ? "Submit answer & reveal" : community ? "Reveal recorded result" : "Reveal model answers"} <ArrowRight size={16} /></Button>
        <Button variant="ghost" onClick={() => reveal(false)}>Skip my guess</Button>
      </div>}
    </section>
    {revealed && <section className={styles.results} aria-labelledby="recorded-results">
      <h2 id="recorded-results" tabIndex={-1} ref={resultHeading}>{community ? community.result.disputed ? "No single correct answer" : `Correct answer: ${community.result.reference}` : "Here’s what the models chose"}</h2>
      {community ? <>
        <dl className={styles.resultSummary}>
          <div><dt>Your answer</dt><dd>{guess ? input.options.find((option) => option.id === guess)?.label : "Skipped"}</dd></div>
          <div><dt>Jev chose <span>(author’s run)</span></dt><dd>{community.result.jevChoice}</dd></div>
          <div><dt>{community.result.disputed ? "Author’s answer · disputed" : "Correct answer"}</dt><dd>{community.result.reference}</dd></div>
        </dl>
        <p>{community.result.explanation}</p>
        <details className={styles.sourceDetails}><summary>Source & run details</summary>
          <p>{community.observation}</p>
          <p className="hint">Author-reported, not independently reproduced. <a href={communityTaskSource.post}>@_pi0_ on X</a> · <a href={communityTaskSource.data}>Source record: {community.sourceId}</a>. Live reruns use JevArena’s judging format.</p>
        </details>
      </> : <>
      <p>{guess ? `Your answer: ${input.options.find((option) => option.id === guess)?.label}. ` : ""}Reference answer: {input.options.find((option) => option.id === active.expected)?.label}.</p>
      <details className={styles.sourceDetails}><summary>Why this answer?</summary><p>{active.basis}</p></details>
      <div className={styles.models}>{runs.map((run) => <article key={run.id}>
        <h3>{run.model.startsWith("typesafe/") ? "Jev" : "Gemini 2.5 Flash"}</h3>
        <p className={styles.modelChoice}>{input.options.find((option) => option.id === run.choice)?.label}</p>
        <p className="hint">{(run.latencyMs / 1000).toFixed(2)} s · ${run.cost.usd.toFixed(6)} · provider-reported cost</p>
        <p className="hint">Version: {run.resolvedModel ?? "unknown (requested google/gemini-2.5-flash)"}</p>
      </article>)}</div>
      <details className={styles.sourceDetails}><summary>Source & run details</summary><p className="hint">Recorded September 19, 2026. Local, sequential OpenRouter calls—not a live match or a benchmark. Two examples do not establish which model is better. <a href={source} target="_blank" rel="noreferrer">Inspect the run records</a>.</p></details>
      </>}
      <div className={styles.resultActions}>
        <Button asChild><Link href={`/?case=${active.id}`}>Run this yourself <ArrowRight size={14} /></Link></Button>
        <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/try?example=${encodeURIComponent(active.id)}`); setShareStatus("Link copied. Your answer is not included."); } catch { setShareStatus("Could not copy the link. Please try again."); } }}>Copy link</Button>
        <Button variant="ghost" onClick={() => { chooseExample(examples[(examples.findIndex(task => task.id === active.id) + 1) % examples.length]); requestAnimationFrame(() => document.getElementById("guest-question")?.scrollIntoView({ block: "center" })); }}>Next example <ArrowRight size={14} /></Button>
      </div>
      {shareStatus && <p role="status" className="hint">{shareStatus}</p>}
    </section>}
    {submissions.map(value => <ContributionSubmit key={value.id} value={value} publicCandidate />)}
  </main>;
}
