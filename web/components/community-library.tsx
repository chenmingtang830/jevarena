"use client";
import { useState } from "react";
import { authorUrl, communityCases, postUrl } from "@/lib/community-cases";

export function CommunityLibrary() {
  const [query, setQuery] = useState("");
  const items = communityCases.filter((item) =>
    `${item.title} ${item.author} ${item.handle} ${item.kind} ${item.summary}`
      .toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section aria-labelledby="community-heading">
      <h2 id="community-heading">From the Jev community</h2>
      <p>
        Public tests, demos and disagreements, with links to the people behind
        them. These are research leads, not JevArena benchmark results. Complete
        replay inputs are not available in these retrieved posts.
      </p>
      <div className="field">
        <label htmlFor="community-search">Find a community report or author</label>
        <input id="community-search" value={query}
          placeholder="Search topics or @handles…"
          onChange={(event) => setQuery(event.target.value)} />
      </div>
      <p className="hint" role="status">{items.length} community references · source checked, not reproduced</p>
      <div className="case-grid">
        {items.map((item) => (
          <article className="case-entry" key={item.id} id={item.id}>
            <h3>{item.title}</h3>
            <p>{item.kind} · {item.evidence}</p>
            <p>
              <a href={authorUrl(item)} rel="noreferrer">{item.author} (@{item.handle})</a>
              {" · "}<time dateTime={item.postedAt}>{item.postedAt.slice(0, 10)}</time>
            </p>
            <p>{item.summary}</p>
            <p><strong>What is missing:</strong> {item.limitation}</p>
            <details>
              <summary>What to test next</summary>
              <p>{item.nextTest}</p>
            </details>
            <p><a href={postUrl(item)} rel="noreferrer">Read original post on X</a></p>
            <p className="hint">
              {item.metrics.views.toLocaleString("en-US")} views · {item.metrics.likes.toLocaleString("en-US")} likes · {item.metrics.reposts.toLocaleString("en-US")} reposts
              <br />X API snapshot: {item.checkedAt}. Popularity is not evidence of correctness.
            </p>
          </article>
        ))}
      </div>
      {!items.length && <p>No matching reports. Try a topic or author handle.</p>}
      <p className="hint">
        Selected from public links, not a complete or ranked survey of X.
        Summaries are editorial paraphrases; linked sources retain their original
        rights. No posts, images or videos are republished in full. To request a
        correction or removal, <a href="https://github.com/chenmingtang830/jevarena/issues">open an issue</a>.
      </p>
    </section>
  );
}
