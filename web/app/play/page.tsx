import { Playground } from "@/components/playground";
import { templates } from "@/lib/cases";
export const metadata = { title: "Test your own question · JevArena" };
export default async function Play({ searchParams }: { searchParams: Promise<{ case?: string }> }) {
  const query = await searchParams;
  return <Playground initial={templates.find((item) => item.id === query.case)} />;
}
