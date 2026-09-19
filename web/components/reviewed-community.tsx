"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { communityTasks, communityTaskSource } from "@/lib/community-tasks";
import { PublicCommunityResponseSchema, questionForReplay, questionPrompt, type PublishedQuestion } from "@/lib/published-community";
import { encodeShare } from "@/lib/sharing";
import styles from "./reviewed-community.module.css";

function PublishedQuestionRow({ item }: { item: PublishedQuestion }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [opening, setOpening] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(questionPrompt(item.challenge)); setMessage("Prompt copied."); }
    catch { setMessage("Copy unavailable. Select the question text instead."); }
  }
  async function replay() {
    setOpening(true);
    try { router.push(`/share#${await encodeShare(questionForReplay(item))}`); }
    catch { setMessage("This question is too large to open as a link. Copy its prompt instead."); setOpening(false); }
  }
  return <article className={styles.question}>
    <h2>{item.challenge.title}</h2>
    <p className={styles.meta}><time dateTime={item.submittedAt}>{item.submittedAt.slice(0, 10)}</time> · AI-screened · not fact-checked</p>
    <p className={styles.prompt}>{questionPrompt(item.challenge)}</p>
    <div className={styles.actions}>
      <Button onClick={replay} disabled={opening}>{opening ? "Opening…" : "Choose models & run"}</Button>
      <Button variant="secondary" onClick={copy}>Copy prompt</Button>
    </div>
    <p role="status" className={styles.meta}>{message}</p>
    <details><summary>Source and review</summary>
      <p className={styles.meta}>{item.moderation.reason} · Screened by {item.moderation.model}. Original contributions: {item.license}.</p>
      {item.sourceAttributions?.map((source) => <p key={source.url}><a href={source.url}>{source.author}</a> · {source.license}{source.notice && <span> · {source.notice}</span>}</p>)}
    </details>
  </article>;
}

export function ReviewedCommunity() {
  const [items, setItems] = useState<PublishedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load(signal?: AbortSignal) {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/community", { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      const value = PublicCommunityResponseSchema.parse(await response.json());
      if (!signal?.aborted) setItems(value.items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
    } catch {
      if (!signal?.aborted) setError("Questions could not load. Please refresh to try again.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, []);
  return <>
    <header className={styles.header}>
      <h1>Community questions</h1>
      <p>Copy a question, choose your models, and try it yourself.</p>
      <div className={styles.actions}>
        <Button asChild><Link href="/community/submit">Submit a question</Link></Button>
        <Button asChild variant="secondary"><a href="https://github.com/chenmingtang830/jevarena/discussions">Join the discussion</a></Button>
        <Button variant="ghost" disabled={loading} onClick={() => void load()}>{loading ? "Loading…" : "Refresh"}</Button>
      </div>
    </header>
    {error && <p role="alert">{error}</p>}
    {items.length ? items.map((item) => <PublishedQuestionRow key={item.id} item={item} />) : !loading && !error &&
      <section className={styles.empty} aria-labelledby="empty-questions">
        <h2 id="empty-questions">No published questions yet</h2>
        <p>Community submissions appear here after passing Jev’s publication screening.</p>
      </section>}
    <details className={styles.sources}>
      <summary>Try questions from published research</summary>
      <p>These are imported examples from <a href={communityTaskSource.account}>@_pi0_</a>, not submissions to this community.</p>
      {communityTasks.map(({ challenge }) => <article key={challenge.id} className={styles.sourceRow}>
        <h3>{challenge.title}</h3>
        <p>{challenge.kind === "judgment" ? challenge.content : challenge.prompt}</p>
        <Link href={`/?case=${challenge.id}`}>Choose models & run</Link>
      </article>)}
      <p><a href={communityTaskSource.post}>Original post</a> · <a href={communityTaskSource.data}>Source data</a> · MIT</p>
    </details>
  </>;
}
