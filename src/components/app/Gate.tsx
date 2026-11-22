"use client";
import { Turnstile } from "@marsidev/react-turnstile";
import { createContext, useContext, useState, type ReactNode } from "react";
import { SignInForm } from "@/components/app/SignInForm";
import { browserClient } from "@/lib/supabase/browser";
import { TURNSTILE_SITE_KEY } from "@/lib/supabase/env";
import { useSession, type SessionState } from "@/lib/useSession";

type Ready = Extract<SessionState, { status: "ready" }>;
const SessionCtx = createContext<Ready | null>(null);

export function SessionProvider({ session, children }: { session: Ready; children: ReactNode }) {
  return <SessionCtx value={session}>{children}</SessionCtx>;
}

export function useReadySession(): Ready {
  const s = useContext(SessionCtx);
  if (!s) throw new Error("useReadySession must be used inside <Gate>");
  return s;
}

// App pages need a session. Guests get an anonymous account only when they choose to start,
// never on page view (so bots don't create users).
export function Gate({ children, next }: { children: ReactNode; next: string }) {
  const s = useSession();
  if (s.status === "loading") return <main className="page"><p className="muted">Loading…</p></main>;
  if (s.status === "none") return <GuestGate next={next} />;
  return <SessionCtx value={s}>{children}</SessionCtx>;
}

function GuestGate({ next }: { next: string }) {
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const needsCaptcha = !!TURNSTILE_SITE_KEY;
  const title = next.startsWith("/exam") ? "Take a practice exam" : next.startsWith("/quiz") ? "Take a practice quiz" : "Start practising";

  async function startAsGuest(captchaToken?: string) {
    if (needsCaptcha && !captchaToken) return setShowCaptcha(true); // ask for the captcha only when needed
    setBusy(true);
    setError(undefined);
    const { error } = await browserClient().auth.signInAnonymously({ options: { captchaToken } });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="card auth-card">
        <h1>{title}</h1>
        <p className="muted auth-sub">Sign in to save your progress on any device, or continue as a guest.</p>
        <SignInForm next={next} isGuest={false} />
        <div className="auth-divider" role="separator"><span>or</span></div>
        {showCaptcha ? (
          <div style={{ marginBottom: 10 }}>
            <Turnstile siteKey={TURNSTILE_SITE_KEY} onSuccess={(t) => startAsGuest(t)} options={{ size: "flexible" }} />
          </div>
        ) : null}
        <button className="btn block" onClick={() => startAsGuest()} disabled={busy}>
          {busy ? "Starting…" : "Continue as guest"}
        </button>
        {error ? <p className="bad-text small" role="alert">{error}</p> : null}
        <p className="hint auth-legal">
          Guest progress stays on this browser and is deleted after 30 days without activity. Sign in any time to keep it.
        </p>
      </div>
    </main>
  );
}
