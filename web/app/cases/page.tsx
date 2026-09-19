import Link from "next/link";
import { CaseBrowser } from "@/components/case-browser";
import { CommunityLibrary } from "@/components/community-library";
export const metadata = { title: "Cases · JevArena" };
export default function Cases() {
  return (
    <main id="main" className="prose-page">
      <h1>
        Questions worth
        <br />a second judgment.
      </h1>
      <p>
        Try a task, make your own prediction, then bring your keys to compare
        models. These starter cases are templates, not measured model results.
      </p>
      <CaseBrowser />
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
