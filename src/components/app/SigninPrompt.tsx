"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useReadySession } from "@/components/app/Gate";
import { browserClient } from "@/lib/supabase/browser";

// Shown to guests after their first finished quiz, until they sign in or dismiss it.
export function SigninPrompt({ next }: { next: string }) {
  const s = useReadySession();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!s.isAnonymous) return;
    browserClient()
      .from("profiles")
      .select("signin_prompt_dismissed_at")
      .eq("user_id", s.userId)
      .maybeSingle()
      .then(({ data }) => setShow(!data?.signin_prompt_dismissed_at));
  }, [s.isAnonymous, s.userId]);
  if (!show) return null;
  return (
    <div className="notice" style={{ marginBottom: 14 }}>
      <b>Save your progress across devices?</b>
      <p className="small" style={{ margin: "4px 0 10px" }}>
        You&apos;re a guest. Sign in with an email code or Google and everything you&apos;ve done so far comes with you.
      </p>
      <div className="row">
        <Link className="btn primary small" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
        <button
          className="btn small"
          onClick={async () => {
            setShow(false);
            await browserClient().from("profiles").update({ signin_prompt_dismissed_at: new Date().toISOString() }).eq("user_id", s.userId);
          }}
        >
          Continue as guest
        </button>
      </div>
    </div>
  );
}
