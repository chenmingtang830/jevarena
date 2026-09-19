import Link from "next/link";
import { authorUrl, postUrl, type CommunityCase } from "@/lib/community-cases";

export function CommunityCaseViewer({ study }: { study: CommunityCase }) {
  return (
    <main id="main" className="prose-page community-study">
      <Link href="/cases#community">Back to community case studies</Link>
      <h1>{study.title}</h1>
      <p className="community-meta">{study.kind} · {study.evidence}</p>
      <p>
        <a href={authorUrl(study)} rel="noreferrer">{study.author} (@{study.handle})</a>
        {" · Posted "}<time dateTime={study.postedAt}>{study.postedAt.slice(0, 10)}</time>
      </p>
      <p><a href={postUrl(study)} rel="noreferrer">Read original post on X</a></p>

      <section className="study-section" aria-labelledby="report-heading">
        <h2 id="report-heading">What the source reports</h2>
        <p>{study.summary}</p>
      </section>
      <section className="study-section" aria-labelledby="evidence-heading">
        <h2 id="evidence-heading">What has been verified</h2>
        <p>
          The source post, author attribution, timestamp, and public engagement
          snapshot were retrieved through the X API on {study.checkedAt}.
          This checks the source of the report, not its experimental conclusions.
          JevArena has not reproduced this report or established a model winner.
        </p>
      </section>
      <section className="study-section" aria-labelledby="limits-heading">
        <h2 id="limits-heading">Evidence limits</h2>
        <p>{study.limitation}</p>
        <p>Complete replay inputs are unavailable in the retrieved source. This case study is not a runnable benchmark fixture.</p>
      </section>
      <section className="study-section" aria-labelledby="protocol-heading">
        <h2 id="protocol-heading">Proposed reproduction protocol</h2>
        <p>{study.nextTest}</p>
        <ol>
          <li>Obtain permitted inputs, expected labels, and the original evaluation configuration. If they remain unavailable, label any new study as an independent adaptation.</li>
          <li>Freeze the input set, model versions, prompts, output choices, and measurement conditions before running the comparison.</li>
          <li>Record actual outputs, failures, sample count, and timing procedure. Evaluate judgment quality separately from latency and cost.</li>
          <li>Publish the permitted evidence and differences from the original report so others can inspect the result.</li>
        </ol>
        <p>This is a proposed study, not a completed experiment. Reading this page makes no model or X API calls.</p>
      </section>
      <details className="community-metrics">
        <summary>Source snapshot and engagement</summary>
        <p>
          {study.metrics.views.toLocaleString("en-US")} views · {study.metrics.likes.toLocaleString("en-US")} likes · {study.metrics.reposts.toLocaleString("en-US")} reposts
        </p>
        <p className="hint">X API snapshot: {study.checkedAt}. Counts can change. Popularity is not evidence of correctness.</p>
      </details>
      <section className="study-section" aria-labelledby="contribution-heading">
        <h2 id="contribution-heading">Help make this reproducible</h2>
        <p>Have permitted inputs or a documented reproduction? Contribute the source, setup, and evidence for review. Keep new results distinct from the author’s original report.</p>
        <p className="study-actions"><Link href="/contribute">Contribute evidence</Link><Link href="/cases#templates">Explore runnable templates</Link></p>
      </section>
      <p className="hint">
        Editorial paraphrase. {study.rights}. The original-template CC-BY-4.0
        license does not apply to linked posts. No full posts or media are
        republished here. <a href="https://github.com/chenmingtang830/jevarena/issues">Request a correction or removal</a>.
      </p>
    </main>
  );
}
