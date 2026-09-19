import Link from "next/link";
export const metadata = { title: "Methodology · JevArena" };
export default function Methodology() {
  return (
    <main id="main" className="prose-page">
      <h1>
        Judge the judgment.
        <br />
        Then the tradeoff.
      </h1>
      <p>
        Every match includes Jev. We explore when its decisions hold up, when
        another model earns its extra time and cost, and what kinds of mistakes
        remain.
      </p>
      <section>
        <h2>What a match measures</h2>
        <p>
          Both judges receive the same task, choices, and semantic rubric.
          Reference answers and contributor explanations are excluded from model
          inputs. The two outputs appear together in a uniform format, before
          names, probabilities, cost, or latency are revealed.
        </p>
        <p>
          This is interface-level blinding, not a double-blind experiment:
          someone using their own key can inspect network requests. Compare mode
          also lets users select the other model explicitly.
        </p>
        <p>
          Votes distinguish a better judgment, two good judgments, two bad
          judgments, and uncertainty. A faster response is not automatically
          better. Failed calls never produce a winner.
        </p>
      </section>
      <section>
        <h2>Research and community data</h2>
        <p>When enabled, automated community screening sends only newly authorized contributions to Jev through Vercel. Passing submissions publish automatically. This checks publication risk, not answer correctness: AI-screened is not human-reviewed or independently reproduced. Screening categories are shown as categories, not invented explanations from Jev. Older private or review-only submissions are not enrolled automatically.</p>
        <p>
          Community votes are preferences, not ground truth. Community-submitted
          runs are unverified until reproduced. Reproduced runs and reviewed
          labels are separate properties; a reproducible mistake can still be a
          mistake.
        </p>
        <p>
          Public datasets may already be in model training data. Our held-out
          split prevents our own prompt tuning from leaking across problem
          groups, but cannot establish an uncontaminated model evaluation.
        </p>
        <p>
          We report diagnostic pairwise results separately from official dataset
          protocols. Related variants and swapped orders belong to the same
          problem group for splitting and uncertainty estimates. No single
          composite score hides tradeoffs.
        </p>
      </section>
      <section>
        <h2>Probability, cost, and latency</h2>
        <p>
          Jev’s output probabilities and provider confidence are different
          fields. We do not invent probabilities for chat models or interpret a
          model’s confidence as verified correctness. Calibration requires
          labeled observations.
        </p>
        <p>
          Latency is measured from client request to complete judgment. The
          ordinary website runs two requests concurrently; offline benchmark
          conditions are disclosed separately. Known costs are labeled
          provider-reported or estimated. Missing costs remain unknown, never
          zero.
        </p>
        <p>
          Price estimates use list prices and token estimates. They are a
          planning aid, not a guaranteed provider invoice. Retries require a
          deliberate action and may incur another charge.
        </p>
      </section>
      <section>
        <h2>Your keys and data</h2>
        <p>
          Keys stay in the current browser tab’s memory. OpenRouter requests go
          directly to the provider; supported relay routes forward keys for one
          request without storing them. Connection settings show the route
          before you run. Provider availability is contract-tested, not verified
          against your account.
        </p>
        <p>
          When enabled, public contribution starts on. Uncheck it before answering
          or voting to opt out. Submitted tasks, answers and results enter review
          before publication; API keys are excluded. Existing private submissions
          remain private. Separately creating a share link requires a content
          preview and confirmation. A shared fragment link is readable by anyone
          who receives it. Opening an imported case never starts paid requests.
        </p>
        <p>
          <Link href="/contribute">Contribute a reproducible finding</Link>
        </p>
      </section>
    </main>
  );
}
