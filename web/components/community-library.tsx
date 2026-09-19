"use client";
import Link from "next/link";
import { authorUrl, communityCases, postUrl } from "@/lib/community-cases";

export function CommunityLibrary() {
  const items = communityCases;
  return (
    <section id="community" aria-labelledby="community-heading">
      <h2 id="community-heading">Community reports</h2>
      <p>
        These posts do not include complete test inputs. They are references, not runnable cases.
      </p>
      <p className="hint" role="status">{items.length} community references · source checked, not reproduced</p>
      <div className="community-list">
        {items.map((item) => (
          <article className="case-entry" key={item.id} id={item.id}>
            <h3><Link href={`/cases/${item.id}`}>{item.title}</Link></h3>
            <p className="community-meta">{item.kind} · {item.evidence}</p>
            <p className="community-meta">
              <a href={authorUrl(item)} rel="noreferrer">{item.author} (@{item.handle})</a>
              {" · "}<time dateTime={item.postedAt}>{item.postedAt.slice(0, 10)}</time>
            </p>
            <p className="community-summary">{item.summary}</p>
            <p className="study-actions">
              <Link href={`/cases/${item.id}`}>Read case study<span className="sr-only">: {item.title}</span></Link>
              <a href={postUrl(item)} rel="noreferrer">Original post on X</a>
            </p>
            <details className="community-metrics">
              <summary>Source snapshot and engagement</summary>
              <p className="hint">
              {item.metrics.views.toLocaleString("en-US")} views · {item.metrics.likes.toLocaleString("en-US")} likes · {item.metrics.reposts.toLocaleString("en-US")} reposts
              <br />X API snapshot: {item.checkedAt}. Popularity is not evidence of correctness.
              </p>
            </details>
          </article>
        ))}
      </div>
      <p className="hint">
        Selected from public links, not a complete or ranked survey of X.
        Summaries are editorial paraphrases; linked sources retain their original
        rights. No posts, images or videos are republished in full. To request a
        correction or removal, <a href="https://github.com/chenmingtang830/jevarena/issues">open an issue</a>.
      </p>
    </section>
  );
}
