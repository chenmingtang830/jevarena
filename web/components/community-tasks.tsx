import Link from "next/link";
import { communityTasks, communityTaskSource as source } from "@/lib/community-tasks";

export function CommunityTasks() {
  return <section aria-labelledby="real-tasks-heading">
    <h2 id="real-tasks-heading">Real community tests</h2>
    <p>Actual inputs from <a href={source.account}>@_pi0_</a>’s <a href={source.post}>Jev experiments on X</a>. Click to try them yourself.</p>
    {communityTasks.map(({ challenge, observation, sourceId }) => <article className="case-entry" key={challenge.id}>
      <h3><Link href={`/?case=${challenge.id}`}>{challenge.title}</Link></h3>
      <p>{challenge.kind === "judgment" && challenge.content}</p>
      <Link href={`/?case=${challenge.id}`}>Try this question →</Link>
      <details><summary>Author’s recorded result</summary>
        <p>{observation}</p>
        <p className="hint">2026-09-18 · Author-reported, not independently reproduced. Reruns use JevArena’s prompt format, not an exact replay. <a href={source.data}>Raw record: {sourceId}</a> · MIT.</p>
      </details>
    </article>)}
  </section>;
}
