/** No server-side code exchange. The PKCE verifier remains in the original tab. */
export function GET() {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>Connect OpenRouter · JevArena</title></head><body><main><h1>Return to JevArena</h1><p id="status">This connection must be started from your JevArena tab. Close this window and try connecting again there.</p></main><script>
(() => {
  const query = new URLSearchParams(location.search);
  history.replaceState(null, '', location.pathname);
  const code = query.get('code');
  const state = query.get('state');
  if (window.opener && code && code.length <= 4096 && state && /^[A-Za-z0-9_-]{43}$/.test(state)) {
    window.opener.postMessage({type:'jevarena:openrouter-code', code, state}, location.origin);
    document.getElementById('status').textContent = 'Connection returned to your original tab. You can close this window.';
    window.close();
  }
})();
</script></body></html>`, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow",
  }});
}
