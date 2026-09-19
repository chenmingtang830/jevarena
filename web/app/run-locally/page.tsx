import Link from "next/link";
export const metadata = { title: "Run locally · JevArena" };
export default function RunLocally() {
  return <main id="main" className="prose-page">
    <h1>Your machine. Your keys.</h1>
    <p>Prefer not to enter a key on a hosted website? Inspect the open-source code and run the same interface on your computer.</p>
    <h2>Start the web app</h2>
    <p>Install Node.js 22 LTS and Git, then run:</p>
    <pre style={{ overflowX: "auto", padding: 20, background: "var(--warm-paper)" }}><code>{`git clone https://github.com/chenmingtang830/jevarena.git\ncd jevarena/web\nnpm ci\nnpm run dev`}</code></pre>
    <p>Open <a href="http://127.0.0.1:3000/play">127.0.0.1:3000/play</a>. Enter a dedicated provider key only when you are ready to run. Keys remain in the tab’s memory and are cleared on refresh.</p>
    <h2>Local does not mean offline</h2>
    <p>Model providers still receive the task and your key, and calls still use your provider balance. Local execution removes the hosted JevArena page from that path; it does not remove the need to trust the code, dependencies, browser, or model provider.</p>
    <h2>Use a Vercel AI Gateway key locally</h2>
    <p>Stop the development server, then restart with the local relay enabled:</p>
    <pre style={{ overflowX: "auto", padding: 20, background: "var(--warm-paper)" }}><code>{`NEXT_PUBLIC_VERCEL_BYOK_ENABLED=true JEVARENA_RELAY_ENABLED=true npm run dev`}</code></pre>
    <p>In the connection dialog, expand “Use an API key instead” and select Vercel AI Gateway. Use an AI Gateway key, not a Vercel account token. Your local server forwards the request to Vercel; the key is not saved. Starting the server does not call a model. Clicking Start judging uses your credits.</p>
    <p>This command binds to your computer only. Do not expose or deploy this relay publicly; public deployment needs separate shared rate limiting and operational review. See the <a href="https://github.com/chenmingtang830/jevarena/blob/main/docs/PROVIDERS.md">provider setup</a>.</p>
    <p>Use a separate low-limit key, revoke it after testing, and never commit it. Research submission and public sharing are separate, optional actions.</p>
    <p><a href="https://github.com/chenmingtang830/jevarena">Inspect the source</a> · <Link href="/">Try examples without a key</Link></p>
  </main>;
}
