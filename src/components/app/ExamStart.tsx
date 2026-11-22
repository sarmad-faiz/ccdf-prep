"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useReadySession } from "@/components/app/Gate";
import { api } from "@/lib/api";
import { browserClient } from "@/lib/supabase/browser";

type Info = {
  title: string; guide: string; items: number; minutes: number; pass_score: number;
  domains: { id: string; name: string; weight: number; item_count: number }[];
  setName: string | null;
};

export function ExamStart({ set }: { set: string }) {
  const router = useRouter();
  const session = useReadySession();
  const [info, setInfo] = useState<Info>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const db = browserClient();
    (async () => {
      const { data: bp } = await db.from("blueprints").select("*").eq("active", true).maybeSingle();
      if (!bp) return setError("No exam is available right now.");
      const [{ data: domains }, { data: sets }] = await Promise.all([
        db.from("domains").select("id, name, weight, item_count").eq("blueprint_id", bp.id).order("position"),
        db.from("exam_sets").select("id, name").eq("blueprint_id", bp.id),
      ]);
      const setName = set === "mixed" ? "Mixed exam" : (sets ?? []).find((s) => s.id === set)?.name ?? null;
      if (!setName) return setError("Unknown exam.");
      setInfo({ ...bp, domains: domains ?? [], setName });
    })();
  }, [set]);

  async function begin() {
    setBusy(true);
    try {
      const r = await api.startExam(set);
      router.replace(`/exam/${r.attempt_id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (error) return <main className="page"><p className="bad-text">{error}</p><Link className="btn" href="/exam">Back</Link></main>;
  if (!info) return <main className="page"><p className="muted">Loading…</p></main>;
  const fixed = set !== "mixed";

  return (
    <main className="page">
      <div className="qtop">
        <Link className="btn ghost" href="/dashboard">← Dashboard</Link>
        <span className="muted">Exam simulation</span>
      </div>
      {session.isAnonymous ? (
        <div className="notice" style={{ marginBottom: 14 }}>
          <b>You&apos;re about to start a 2-hour exam as a guest.</b>
          <p className="small" style={{ margin: "4px 0 10px" }}>
            Sign in first if you want this result saved to an account you can use on any device. Guest results stay on this
            browser&apos;s guest account.
          </p>
          <Link className="btn small" href={`/login?next=${encodeURIComponent(`/exam/start/${set}`)}`}>Sign in first</Link>
        </div>
      ) : null}
      <div className="card">
        <div className="eyebrow">{info.title} · Pearson VUE style</div>
        <h1 style={{ margin: "2px 0 12px" }}>{info.setName}</h1>
        <ul className="md" style={{ paddingLeft: 20, listStyle: "disc" }}>
          <li><b>{info.items} items, {info.minutes} minutes.</b> The countdown runs on the server from the moment you begin. It keeps running if you leave or refresh; at zero the exam ends and is scored.</li>
          <li><b>Item types:</b> single answer, and multiple response that tells you how many to choose (&ldquo;Choose two&rdquo;). Multiple response is scored all-or-nothing.</li>
          <li><b>Move freely:</b> go back and forth, <b>flag</b> items, and use the <b>review screen</b> to see incomplete and flagged items before you end.</li>
          <li><b>No feedback until the end.</b> Unanswered items count as wrong, so answer everything.</li>
          <li>
            <b>Score:</b> 100–1000, passing {info.pass_score}.{" "}
            {fixed
              ? "This exam always has the same items (in shuffled order), so scores compare across retakes and between people."
              : "Items are drawn at random by domain weight, ones you haven't seen in earlier exams first."}
          </li>
        </ul>
        <div className="tbl">
          <table>
            <thead><tr><th>Domain</th><th>Weight</th><th>Items</th></tr></thead>
            <tbody>
              {info.domains.map((d) => (
                <tr key={d.id}><td>{d.name}</td><td>{Number(d.weight).toFixed(1)}%</td><td>{d.item_count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Format and weights follow {info.guide}. Pearson VUE lists updated exam content from 7 December 2026; check the new
          guide if you sit after that. Scaled scores here are estimates.
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={begin} disabled={busy}>{busy ? "Starting…" : "Begin exam"}</button>
          <Link className="btn" href="/exam">Back</Link>
        </div>
      </div>
    </main>
  );
}
