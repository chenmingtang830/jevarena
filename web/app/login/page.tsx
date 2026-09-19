import { LoginForm } from "@/components/login-form";
import { authConfigured } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export const metadata={title:"Optional login · JevArena",robots:{index:false,follow:false}};
export default async function Login({searchParams}:{searchParams:Promise<{error?:string;sent?:string}>}) {
  const {error,sent}=await searchParams;
  return <main id="main" className="prose-page"><h1>Save your experiments.</h1>{error && <p role="alert">Sign-in did not complete. Check your email address, wait a moment and try again; your experiment remains in the original tab.</p>}{sent && <p role="status">If the address is eligible, a login link has been requested. Check your inbox and spam folder. Open the link in this browser, then return to your experiment to save it. Links expire; request a new one if needed.</p>}<LoginForm enabled={authConfigured()}/></main>;
}
