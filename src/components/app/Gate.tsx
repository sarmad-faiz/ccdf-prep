"use client";
import { createContext, useContext, type ReactNode } from "react";
import { GuestStart } from "@/components/app/GuestStart";
import { SignInForm } from "@/components/app/SignInForm";
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
  const title = next.startsWith("/exam") ? "Take a practice exam" : next.startsWith("/quiz") ? "Take a practice quiz" : "Start practising";
  return (
    <main className="page">
      <div className="card auth-card">
        <h1>{title}</h1>
        <p className="muted auth-sub">Sign in to save your progress on any device, or continue as a guest.</p>
        <SignInForm next={next} isGuest={false} />
        <div className="auth-divider" role="separator"><span>or</span></div>
        {/* the session change re-renders <Gate> with the page itself */}
        <GuestStart variant="button" />
        <p className="hint auth-legal">
          Guest progress stays on this browser and is deleted after 30 days without activity. Sign in any time to keep it.
        </p>
      </div>
    </main>
  );
}
