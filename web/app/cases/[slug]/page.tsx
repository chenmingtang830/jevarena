import { notFound } from "next/navigation";
import { templates } from "@/lib/cases";
import { CaseViewer } from "@/components/case-viewer";
export function generateStaticParams() {
  return templates.map((c) => ({ slug: c.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = templates.find((c) => c.id === slug);
  return {
    title: `${c?.title ?? "Case"} · JevArena`,
    description:
      "Explore a judgment challenge and reproduce it with your own API key.",
  };
}
export default async function CasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = templates.find((c) => c.id === slug);
  if (!c) notFound();
  return <CaseViewer challenge={c} />;
}
