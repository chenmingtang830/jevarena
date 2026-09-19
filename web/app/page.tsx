import { redirect } from "next/navigation";
import { Playground } from "@/components/playground";
import { templates } from "@/lib/cases";
import { communityTasks } from "@/lib/community-tasks";
export default async function Home({ searchParams }: { searchParams: Promise<{ example?: string; case?: string }> }) {
  const query = await searchParams;
  if (query.example) redirect(`/try?example=${encodeURIComponent(query.example)}`);
  return <Playground initial={[...templates, ...communityTasks.map((item) => item.challenge)].find((item) => item.id === query.case)} />;
}
