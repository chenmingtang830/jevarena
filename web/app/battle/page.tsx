import Link from "next/link";
export const metadata = { title: "Battle · JevArena", robots: { index: false } };

// Active battles navigate here with the History API and remain only in the
// existing client tree. A reload or copied URL never restores private content
// and must never issue a new paid request.
export default function Battle() {
  return <main id="main" className="prose-page">
    <h1>No active battle</h1>
    <p>Battles stay in the tab that started them. Refreshing clears the results and your API key.</p>
    <Link href="/">Start a new question</Link>
  </main>;
}
