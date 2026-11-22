"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignInForm } from "@/components/app/SignInForm";
import { useSession } from "@/lib/useSession";

export function Login() {
  const params = useSearchParams();
  const next = (() => {
    const n = params.get("next");
    return n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
  })();
  const s = useSession();
  const googleMerge = params.get("google_merge") === "1";

  if (s.status === "loading") return <main className="page"><p className="muted">Loading…</p></main>;
  if (s.status === "ready" && !s.isAnonymous) {
    return (
      <main className="page">
        <div className="card auth-card">
          <h1>You&apos;re signed in</h1>
          <p className="muted auth-sub">Signed in as {s.email}.</p>
          <Link className="btn primary block" href={next}>Continue</Link>
          <Link className="btn block" href="/account" style={{ marginTop: 8 }}>Account</Link>
        </div>
      </main>
    );
  }

  const isGuest = s.status === "ready" && s.isAnonymous;
  return (
    <main className="page">
      <div className="card auth-card">
        <h1>{isGuest ? "Save your progress" : "Sign in"}</h1>
        <p className="muted auth-sub">
          {isGuest
            ? "Everything you've done as a guest comes with you. If you already have an account, your guest progress is added to it."
            : "No password needed. We'll email you a sign-in code."}
        </p>
        {googleMerge ? (
          <div className="notice small" style={{ marginBottom: 14 }}>
            That Google account already has an account here. Continue with Google to sign in to it; your guest progress will be
            added.
          </div>
        ) : null}
        <SignInForm next={next} isGuest={isGuest} googleMerge={googleMerge} initialError={params.get("error") ?? ""} />
        <p className="hint auth-legal">
          By continuing you agree to the <Link href="/terms">terms</Link>. See <Link href="/privacy">privacy</Link> for what is stored.
        </p>
      </div>
    </main>
  );
}
