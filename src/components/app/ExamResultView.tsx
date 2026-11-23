"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Inline } from "@/components/Inline";
import { LoadError } from "@/components/app/LoadError";
import { ReportButton, StatsLine } from "@/components/app/ReportButton";
import { SigninPrompt } from "@/components/app/SigninPrompt";
import { api, pct, pctClass, type ExamResult } from "@/lib/api";

const fmtDur = (sec: number) => `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, "0")} s`;

export function ExamResultView({ id }: { id: string }) {
  const [r, setR] = useState<ExamResult>();
  const [error, setError] = useState<string>();
  const [filter, setFilter] = useState<"missed" | "flagged" | "all">("missed");
  const load = useCallback(() => {
    api.examResult(id).then(setR, (e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (error) {
    return (
      <main className="page">
        <LoadError message={error} onRetry={() => { setError(undefined); load(); }} back={{ href: "/exam", label: "Exams" }} />
      </main>
    );
  }
  if (!r) return <main className="page"><p className="muted">Loading results…</p></main>;

  const p = pct(r.correct, r.total);
  const list = r.items.filter((x) => (filter === "missed" ? !x.correct : filter === "flagged" ? x.flagged : true));
  const text = (item: ExamResult["items"][number], ks: number[]) =>
    ks.length ? ks.map((k) => item.options[k]).join("; ") : "No answer";

  return (
    <main className="page">
      <div className="qtop">
        <Link className="btn ghost" href="/dashboard">← Dashboard</Link>
        <span className="muted">
          {new Date(r.finished_at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <SigninPrompt next={`/exam/${r.id}/results`} />
      <div className="card score">
        <div className="eyebrow">{r.set_name}{r.status === "expired" ? " · time expired" : ""}</div>
        <div className={`big pct ${r.passed ? "good" : "bad"}`}>{r.scaled}</div>
        <div className="row" style={{ justifyContent: "center" }}>
          <span className={`badge ${r.passed ? "pass" : "fail"}`}>{r.passed ? "PASS" : "FAIL"}</span>
          <span className="muted">Passing score {r.pass_score}</span>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          {r.correct} of {r.total} correct ({p}%) · {fmtDur(r.time_used_sec)} used
        </div>
        <p className="hint">Scaled score is an estimate (72% correct = 720). Anthropic doesn&apos;t publish its scaling.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link className="btn" href={`/exam/start/${r.set_id}`}>Retake {r.set_name}</Link>
          <Link className="btn" href="/exam">All exams</Link>
        </div>
      </div>

      <h2 className="section">By domain</h2>
      <div className="card">
        <div className="tbl" style={{ margin: 0 }}>
          <table>
            <thead><tr><th>Domain</th><th>Weight</th><th>Correct</th><th style={{ width: "30%" }}>Score</th></tr></thead>
            <tbody>
              {r.domains.map((d) => {
                const dp = pct(d.right, d.total);
                return (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{Number(d.weight).toFixed(1)}%</td>
                    <td>{d.right}/{d.total}</td>
                    <td>
                      <div className="dbar"><span className={pctClass(dp)} style={{ width: `${dp}%` }} /></div>
                      <span className="small muted">{dp}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="section">Answers</h2>
      <div className="seg" role="group" aria-label="Show answers" style={{ marginBottom: 12 }}>
        <button aria-pressed={filter === "missed"} onClick={() => setFilter("missed")}>Missed ({r.items.filter((x) => !x.correct).length})</button>
        <button aria-pressed={filter === "flagged"} onClick={() => setFilter("flagged")}>Flagged ({r.items.filter((x) => x.flagged).length})</button>
        <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All ({r.items.length})</button>
      </div>
      <div className="review">
        {list.length ? (
          list.map((x) => (
            <div key={x.pos} className="card">
              <div className="row">
                <span className="chip">Item {x.pos + 1}</span>
                <span className="chip">{x.domain}</span>
                {x.flagged ? <span className="chip">⚑ Flagged</span> : null}
                {x.changed ? <span className="chip">Question updated since</span> : null}
              </div>
              <div style={{ marginTop: 8, fontWeight: 500 }}><Inline text={x.stem} /></div>
              {x.correct ? (
                <div className="ans good">✓ <Inline text={text(x, x.correct_pos)} /></div>
              ) : (
                <>
                  <div className="ans bad">✗ You: <Inline text={text(x, x.chosen)} /></div>
                  <div className="ans good">✓ <Inline text={text(x, x.correct_pos)} /></div>
                </>
              )}
              <div className="why"><Inline text={x.explanation} /></div>
              <div className="row between" style={{ marginTop: 4 }}>
                <StatsLine stats={x.stats} />
                <ReportButton qid={x.qid} />
              </div>
            </div>
          ))
        ) : (
          <p className="muted">Nothing to show here.</p>
        )}
      </div>
    </main>
  );
}
