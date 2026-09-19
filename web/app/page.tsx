import { redirect } from "next/navigation";
import { GuestHome } from "@/components/guest-home";
export default async function Home({ searchParams }: { searchParams: Promise<{ example?: string; case?: string }> }) {
  const query = await searchParams;
  if (query.case) redirect(`/play?case=${encodeURIComponent(query.case)}`);
  return <GuestHome initialId={query.example} />;
}
