"use client";
import { useState } from "react";
import Link from "next/link";
import { POLICY_VERSION } from "@/lib/policies";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function LoginForm({enabled}:{enabled:boolean}) {
  const [agreed,setAgreed]=useState(false);
  return <section>
    <p>Sign in only if you want to save experiments across devices. Nothing is saved automatically, and API keys are never saved to your account.</p>
    {enabled ? <form action="/auth/email" method="post">
      <label htmlFor="login-email">Email</label><Input id="login-email" type="email" name="email" autoComplete="email" maxLength={254} required placeholder="you@example.com"/>
      <label className="check-label"><input type="checkbox" name="policy" value={POLICY_VERSION} checked={agreed} onChange={e=>setAgreed(e.target.checked)} required/> I agree to the <Link href="/terms" target="_blank">Terms</Link> and acknowledge the <Link href="/privacy" target="_blank">Privacy Policy</Link>.</label>
      <Button type="submit" disabled={!agreed}>Continue with email</Button>
    </form> : <p role="status">Email login is not enabled yet. You can still run experiments as a guest and download your results.</p>}
    <p><Link href="/">Continue without an account</Link></p>
  </section>;
}
