import Link from "next/link";
import { CaseBrowser } from "@/components/case-browser";
import { CommunityLibrary } from "@/components/community-library";
import { CommunityTasks } from "@/components/community-tasks";
export const metadata = {
  title: "Cases",
  description: "Try judgment templates or explore attributed Jev community case studies, their evidence limits, and proposed reproduction protocols.",
};
export default function Cases() {
  return (
    <main id="main" className="prose-page">
      <h1>Example questions</h1>
      <p>Guess first and reveal a recorded result, or run a fresh comparison with your own key.</p>
      <CommunityTasks />
      <details><summary>More starter templates</summary><section id="templates" aria-labelledby="templates-heading">
        <h2 id="templates-heading">Templates</h2>
        <p>Original starter questions you can try now, not measured model results.</p>
        <CaseBrowser />
      </section></details>
      <details><summary>Community reports and background</summary><CommunityLibrary /></details>
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
