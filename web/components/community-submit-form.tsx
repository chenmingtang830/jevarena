"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ChallengeSchema, type CaseContribution } from "@/lib/contracts";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { ContributionSubmit } from "./contribution-submit";
import { AUTO_REVIEW, PUBLIC_COLLECTION } from "./public-contribution-choice";
import styles from "./community-submit-form.module.css";

const ENABLED = PUBLIC_COLLECTION && AUTO_REVIEW && process.env.NEXT_PUBLIC_CONTRIBUTIONS_ENABLED === "true";

export function CommunitySubmitForm() {
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState("");
  const [publicMode, setPublicMode] = useState(true);
  const [error, setError] = useState("");
  const [submission, setSubmission] = useState<CaseContribution | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ENABLED || !publicMode || submission) return;
    setError("");
    const options = answers.split(/\r?\n/).map((label) => label.trim()).filter(Boolean);
    if (!question.trim()) { setError("Enter a question."); return; }
    if (options.length < 2 || options.length > 10) { setError("Add 2–10 possible answers, one per line."); return; }
    if (new Set(options).size !== options.length) { setError("Each possible answer must be different."); return; }
    const id = crypto.randomUUID();
    const parsed = ChallengeSchema.safeParse({
      schemaVersion: 1, id, title: question.trim().split("\n")[0].slice(0, 160),
      language: "und", kind: "judgment", content: question.trim(),
      question: "Which possible answer best answers the question?",
      options: options.map((label, index) => ({ id: `option${index + 1}`, label })),
    });
    if (!parsed.success) { setError("Keep the question under 40,000 characters and each answer under 2,000."); return; }
    setSubmission({ schemaVersion: 1, id, challenge: parsed.data, runs: [], license: "CC-BY-4.0", status: "community-submitted" });
  }

  return <>
    {!ENABLED && <p role="status">Question submissions are temporarily unavailable. You can still <Link href="/">test your question</Link>.</p>}
    <form onSubmit={submit}>
      <fieldset disabled={!!submission || !ENABLED} className={styles.fields}>
        <label htmlFor="community-question">Your question</label>
        <textarea id="community-question" rows={5} maxLength={40000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Include the context someone needs to answer." />
        <label htmlFor="community-answers">Possible answers · one per line</label>
        <textarea id="community-answers" rows={4} maxLength={20100} value={answers} onChange={(event) => setAnswers(event.target.value)} placeholder={"First answer\nSecond answer"} />
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-normal">
          <Checkbox checked={publicMode} onChange={(event) => setPublicMode(event.target.checked)} />
          <span>Contribute publicly</span>
        </label>
        <p className="hint">{publicMode ? "Jev screens your question through Vercel. It publishes if it passes. No API key needed." : "Private mode: nothing will be submitted. Your question stays in this tab."}</p>
        {publicMode && <p className="hint">By submitting, you confirm this is yours to share under CC BY 4.0 and contains no sensitive information. <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link></p>}
        {!submission && <Button type="submit" disabled={!publicMode || !ENABLED}>Submit question</Button>}
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
    {submission && <ContributionSubmit value={submission} publicCandidate />}
  </>;
}
