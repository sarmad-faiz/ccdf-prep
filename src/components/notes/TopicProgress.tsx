"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Inline } from "@/components/Inline";
import { browserClient } from "@/lib/supabase/browser";

// Per-topic quiz progress layered onto the static notes page, only for visitors with a session.
// Crawlers and logged-out visitors get the plain notes.
type Miss = { qid: string; stem: string; answer: string; explanation: string };
type Progress = Record<string, { total: number; seen: number; right: number; misses: Miss[] }>;

const Ctx = createContext<Progress | null>(null);

export function TopicProgressProvider({ moduleId, slug, children }: { moduleId: string; slug: string; children: ReactNode }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => {
    const supabase = browserClient();
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session || cancelled) return;
      const { data: p } = await supabase.rpc("my_topic_progress", { p_module: moduleId });
      if (!cancelled && p) setProgress(p as Progress);
      await supabase.from("profiles").update({ last_note_page: slug }).eq("user_id", data.session.user.id);
    });
    return () => {
      cancelled = true;
    };
  }, [moduleId, slug]);
  return <Ctx value={progress}>{children}</Ctx>;
}

export function TopicStatus({ slug }: { slug: string }) {
  const t = useContext(Ctx)?.[slug];
  if (!t) return null;
  if (!t.seen) return <span className="chip">Not quizzed yet</span>;
  const weak = t.misses.length > 0 || t.right / t.seen < 0.75;
  return (
    <span className={`chip ${t.misses.length ? "bad" : "good"}`} data-weak={weak || undefined}>
      Quiz: {t.right}/{t.seen} right{t.seen < t.total ? ` · ${t.total - t.seen} unseen` : ""}
    </span>
  );
}

export function TopicMisses({ slug }: { slug: string }) {
  const t = useContext(Ctx)?.[slug];
  if (!t?.misses.length) return null;
  // Deep links like /notes/m2#tool-use-schemas open that topic's misses. Read only once data is
  // loaded (client side), so the hash is already set even after a client-side navigation.
  const deepLinked = window.location.hash === `#${slug}`;
  return (
    <details className="miss" open={deepLinked || undefined}>
      <summary>Your misses ({t.misses.length})</summary>
      {t.misses.map((m) => (
        <div key={m.qid} style={{ marginTop: 10 }}>
          <div><Inline text={m.stem} /></div>
          <div className="good-text" style={{ marginTop: 4 }}>✓ <Inline text={m.answer} /></div>
          <div className="why"><Inline text={m.explanation} /></div>
        </div>
      ))}
    </details>
  );
}
