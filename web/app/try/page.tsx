import { GuestHome } from "@/components/guest-home";
export const metadata = { title: "Try recorded examples · JevArena" };
export default async function Try({ searchParams }: { searchParams: Promise<{ example?: string }> }) {
  return <GuestHome initialId={(await searchParams).example} />;
}
