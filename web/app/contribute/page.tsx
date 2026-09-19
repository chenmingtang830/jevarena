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
        <h2>Contribute privately to research</h2>
        <p>After a comparison, open “Share this experiment” and review the complete task, runs and vote. When research submissions are enabled, a separate, unchecked consent form lets you submit that preview for private research review under CC BY 4.0. Running a comparison does not submit it.</p>
        <p>Only contribute material you have permission to share, after removing secrets and personal information. Research consent does not authorize publication. Pending submissions expire after 30 days; your receipt shows the exact expiration time. A public case requires a separate contributor action and permission.</p>
        <p>If storage or submission capacity is reached, your experiment stays in the browser. Download its JSON and use the GitHub contribution route below. Review it again before posting publicly.</p>
        <p>Download the deletion receipt after submitting and keep it private. It contains the token needed to <a href="/contributions/delete">withdraw your submission</a>. Receipts and provider keys are not saved in browser storage. If delivery is uncertain, retry the same submission from the open tab or download its recovery receipt.</p>
      </section>
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
