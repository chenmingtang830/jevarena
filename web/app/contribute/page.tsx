import { REPO } from "@/components/site-shell";
export const metadata = { title: "Contribute · JevArena" };
export default function Contribute() {
  return (
    <main id="main" className="prose-page">
      <h1>
        Bring a hard question.
        <br />
        Leave a useful finding.
      </h1>
      <p>
        JevArena grows through real tasks, reproducible failures, and careful
        explanations. You don’t need a surprising result to contribute.
      </p>
      <section>
        <h2>Share an experiment</h2>
        <ol>
          <li>
            Run a comparison with your own key. Vote before revealing model
            details.
          </li>
          <li>
            Review the share preview and remove private or sensitive material.
          </li>
          <li>
            Download the JSON and attach it to a GitHub issue or pull request.
          </li>
          <li>
            Explain your expected judgment and provide evidence. Tell us what
            remains uncertain.
          </li>
        </ol>
        <p>
          <a href={`${REPO}/issues/new/choose`}>Submit a case on GitHub</a> ·{" "}
          <a href={`${REPO}/discussions`}>Join the discussion</a>
        </p>
      </section>
      <section>
        <h2>Make a learning reproducible</h2>
        <p>
          Include the original task, models and settings, observed judgments,
          and evidence for the reference answer. If a rewritten prompt helps,
          keep the original failure and test the change on other examples. A
          single successful rewrite is a hypothesis, not a general improvement.
        </p>
        <p>
          Discuss challenges, failures, and learnings. Cases can be marked
          community-submitted, reproduced, reviewed, or disputed. Never promote
          a user-provided status automatically.
        </p>
      </section>
      <section>
        <h2>License and attribution</h2>
        <p>
          The code is Apache-2.0. Original case contributions are shared under
          CC BY 4.0 with attribution. Only contribute content you have
          permission to share. Third-party datasets retain their original
          licenses and sources; linking is preferable when redistribution rights
          are unclear.
        </p>
      </section>
      <section>
        <h2>Help build the tools</h2>
        <p>
          Provider adapters, accessible interfaces, test coverage, and benchmark
          methodology all welcome careful review. Start with the repository’s
          contribution guide and describe the problem before changing the
          scoring protocol.
        </p>
        <p>
          <a href={REPO}>View the open-source repository</a>
        </p>
      </section>
    </main>
  );
}
