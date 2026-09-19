import { notFound } from "next/navigation";
import { templates } from "@/lib/cases";
import { CaseViewer } from "@/components/case-viewer";
import { communityCases } from "@/lib/community-cases";
import { CommunityCaseViewer } from "@/components/community-case-viewer";
export function generateStaticParams() {
  return [...templates, ...communityCases].map((c) => ({ slug: c.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = templates.find((c) => c.id === slug);
  const study = communityCases.find((item) => item.id === slug);
  return {
    title: c?.title ?? study?.title ?? "Case",
    description: study
      ? `${study.kind} by ${study.author}. Source checked, not reproduced. Explore the report, evidence limits, and proposed reproduction protocol.`
      : "Explore a judgment challenge and reproduce it with your own API key.",
  };
}
export default async function CasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = templates.find((c) => c.id === slug);
  if (c) return <CaseViewer challenge={c} />;
  const study = communityCases.find((item) => item.id === slug);
  if (study) return <CommunityCaseViewer study={study} />;
  notFound();
}
