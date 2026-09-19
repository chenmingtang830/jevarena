import Link from "next/link";
import { CaseBrowser } from "@/components/case-browser";
import { CommunityLibrary } from "@/components/community-library";
export const metadata = {
  title: "Cases",
  description: "Try judgment templates or explore attributed Jev community case studies, their evidence limits, and proposed reproduction protocols.",
};
export default function Cases() {
  return (
    <main id="main" className="prose-page">
      <h1>
        Questions worth
        <br />a second judgment.
      </h1>
      <p>
        Try a ready-to-use judgment template, or explore a community report and
        what it would take to reproduce it. Reading and making a prediction are
        free; running models uses your own API keys.
      </p>
      <nav className="case-jump-nav" aria-label="Case collections">
        <Link href="#templates">Templates</Link>
        <Link href="#community">Community case studies</Link>
      </nav>
      <section id="templates" aria-labelledby="templates-heading">
        <h2 id="templates-heading">Templates</h2>
        <p>Original starter questions you can try now, not measured model results.</p>
        <CaseBrowser />
      </section>
      <CommunityLibrary />
      <section>
        <h2>Found a surprising failure?</h2>
        <p>
          Share the original question, the judgment, and evidence for what went
          wrong. Good counterexamples make this collection more useful.
        </p>
        <p>
          <Link href="/contribute">Contribute a case</Link>
        </p>
      </section>
    </main>
  );
}
