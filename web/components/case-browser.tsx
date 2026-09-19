import Link from "next/link";
import { templates } from "@/lib/cases";
export function CaseBrowser() {
  return <div className="case-grid">{templates.filter((task) => task.language !== "zh").map((task) =>
    <article className="case-entry" key={task.id}>
      <h3><Link href={`/?case=${task.id}`}>{task.title}</Link></h3>
      <p>{task.kind === "judgment" ? task.question : task.prompt}</p>
      <Link href={`/?case=${task.id}`}>Try this question</Link>
    </article>
  )}</div>;
}
