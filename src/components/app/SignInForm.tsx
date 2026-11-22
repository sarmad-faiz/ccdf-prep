"use client";
import { useRouter } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import { useEffect, useState } from "react";
import { claimMerge, prepareMerge } from "@/app/actions/merge";
import { browserClient } from "@/lib/supabase/browser";
import { SUPABASE_KEY, SUPABASE_URL, TURNSTILE_SITE_KEY } from "@/lib/supabase/env";

type Mode = "signin" | "upgrade" | "merge";

// Email code + Google sign-in. Used on /login and inline on the practice gate.
// For a guest, the email is attached to the guest account (same user, progress kept); if the email
// or Google account already has an account, the guest's progress is merged into it.
export function SignInForm({
  next,
  isGuest,
  googleMerge = false,
  initialError = "",
}: {
  next: string;
  isGuest: boolean;
  googleMerge?: boolean;
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [captcha, setCaptcha] = useState<string>();
  const [pending, setPending] = useState<"email" | "verify" | "google" | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [error, setError] = useState(initialError);
  const busy = pending !== null;

  useEffect(() => {
    // Show Google only when it's enabled in Supabase (public auth settings).
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
      .then((r) => r.json())
      .then((s) => setGoogleEnabled(!!s?.external?.google))
      .catch(() => setGoogleEnabled(false));
    // Coming back with the Back button (e.g. from Google) restores the page: reset the buttons.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPending(null);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const supabase = browserClient();
    setPending("email");
    setError("");
    try {
      if (isGuest) {
        const { error } = await supabase.auth.updateUser({ email });
        if (!error) return setMode("upgrade");
        if (error.code !== "email_exists" && !/already/i.test(error.message)) throw error;
        const prep = await prepareMerge();
        if (!prep.ok) throw new Error(prep.error);
        const r = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, captchaToken: captcha } });
        if (r.error) throw r.error;
        return setMode("merge");
      }
      const r = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, captchaToken: captcha } });
      if (r.error) throw r.error;
      setMode("signin");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setPending("verify");
    setError("");
    try {
      const { error } = await browserClient().auth.verifyOtp({
        email,
        token: code.trim(),
        type: mode === "upgrade" ? "email_change" : "email",
      });
      if (error) throw error;
      if (mode === "merge") await claimMerge();
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPending(null);
    }
  }

  async function google() {
    const supabase = browserClient();
    setPending("google");
    setError("");
    try {
      if (isGuest && !googleMerge) {
        const prep = await prepareMerge(); // used only if this Google account already exists
        if (!prep.ok) throw new Error(prep.error);
        const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: redirectTo() } });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
        if (error) throw error;
      }
    } catch (err) {
      setError((err as Error).message);
      setPending(null);
    }
  }

  return (
    <>
      {mode ? (
        <form onSubmit={verify} className="auth-form">
          <label className="auth-field">
            <span>Enter the code we sent to <b>{email}</b></span>
            <input className="input code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}"
              maxLength={10} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </label>
          <button className="btn primary block" disabled={busy || code.length < 6}>{pending === "verify" ? "Checking…" : "Verify and continue"}</button>
          <button type="button" className="btn ghost block" onClick={() => { setMode(null); setCode(""); }}>
            Use a different email
          </button>
          <p className="hint" style={{ textAlign: "center", margin: 0 }}>Can&apos;t find it? Check your spam folder.</p>
        </form>
      ) : (
        <>
          <form onSubmit={sendCode} className="auth-form">
            <label className="auth-field">
              <span>Email</span>
              <input className="input" type="email" autoComplete="email" placeholder="you@example.com" required value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </label>
            {TURNSTILE_SITE_KEY ? <Turnstile siteKey={TURNSTILE_SITE_KEY} onSuccess={setCaptcha} options={{ size: "flexible" }} /> : null}
            <button className="btn primary block" disabled={busy || !email || (!!TURNSTILE_SITE_KEY && !captcha)}>
              {pending === "email" ? "Sending code…" : "Continue with email"}
            </button>
          </form>
          {googleEnabled || googleMerge ? (
            <button type="button" className="btn block google-btn" style={{ marginTop: 10 }} onClick={google} disabled={busy}>
              <GoogleIcon />
              {pending === "google" ? "Redirecting to Google…" : "Continue with Google"}
            </button>
          ) : null}
        </>
      )}
      {error ? <p className="bad-text small" role="alert" style={{ marginBottom: 0 }}>{error}</p> : null}
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
