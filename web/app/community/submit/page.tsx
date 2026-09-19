import Link from "next/link";
import { CommunitySubmitForm } from "@/components/community-submit-form";

export const metadata = { title: "Submit a community question" };
export default function SubmitCommunityQuestion() {
  return <main id="main" className="prose-page">
    <Link href="/community">Back to community</Link>
    <h1>Share a question</h1>
    <p>Give others a question to test with their own models.</p>
    <CommunitySubmitForm />
  </main>;
}
