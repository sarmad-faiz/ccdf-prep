"use client";
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

export type SessionState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "ready"; userId: string; isAnonymous: boolean; email: string | null };

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  useEffect(() => {
    const supabase = browserClient();
    const apply = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) =>
      setState(
        session
          ? { status: "ready", userId: session.user.id, isAnonymous: !!session.user.is_anonymous, email: session.user.email ?? null }
          : { status: "none" },
      );
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}
