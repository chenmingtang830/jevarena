import Link from "next/link";
export const metadata = { title: "Research results · JevArena" };
export default function Results() {
  return (
    <main id="main" className="prose-page">
      <h1>
        Evidence before
        <br />a leaderboard.
      </h1>
      <p>
        No verified model measurements have been published yet. We won’t turn
        example data, synthetic runs, or community votes into performance
        claims.
      </p>
      <section>
        <h2>What will appear here</h2>
        <p>
          Reproducible evaluations across JudgeBench, RM-Bench, and RewardBench
          2, reported under our diagnostic pairwise protocol. These are separate
          from each dataset’s official scoring protocol.
        </p>
        <ul>
          <li>Accuracy and coverage by task and language, with uncertainty.</li>
          <li>
            Cases where Jev and a comparator disagree, checked against evidence.
          </li>
          <li>
            Order sensitivity, probability calibration, and high-confidence
            errors.
          </li>
          <li>
            Latency and cost measured under disclosed, consistent conditions.
          </li>
        </ul>
      </section>
      <section>
        <h2>Community observations are a separate signal</h2>
        <p>
          A user vote expresses preference. An independently checked reference
          supports correctness. Browser-submitted results can be modified; we
          label their verification status and keep them separate from maintained
          research runs.
        </p>
        <p>
          <Link href="/cases">Explore starter challenges</Link> ·{" "}
          <Link href="/methodology">Read the methodology</Link>
        </p>
      </section>
    </main>
  );
}
