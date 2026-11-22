"use client";
import { Turnstile } from "@marsidev/react-turnstile";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { TURNSTILE_SITE_KEY } from "@/lib/supabase/env";

// Starts a guest (anonymous) session. The captcha, when enabled, is asked for only after the
// visitor chooses to continue as a guest.
export function GuestStart({ variant, onStarted }: { variant: "button" | "link"; onStarted?: () => void }) {
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const needsCaptcha = !!TURNSTILE_SITE_KEY;

  async function start(captchaToken?: string) {
    if (needsCaptcha && !captchaToken) return setShowCaptcha(true);
    setBusy(true);
    setError(undefined);
    const { error } = await browserClient().auth.signInAnonymously({ options: { captchaToken } });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    onStarted?.();
  }

  return (
    <>
      {showCaptcha ? (
        <div style={{ marginBottom: 10 }}>
          <Turnstile siteKey={TURNSTILE_SITE_KEY} onSuccess={(t) => start(t)} options={{ size: "flexible" }} />
        </div>
      ) : null}
      {variant === "button" ? (
        <button className="btn block" onClick={() => start()} disabled={busy}>
          {busy ? "Starting…" : "Continue as guest"}
        </button>
      ) : (
        <p className="guest-link">
          Just looking?{" "}
          <button type="button" className="link-btn" onClick={() => start()} disabled={busy}>
            {busy ? "Starting…" : "Continue as guest →"}
          </button>
        </p>
      )}
      {error ? <p className="bad-text small" role="alert">{error}</p> : null}
    </>
  );
}
