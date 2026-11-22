"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Dashboard } from "@/lib/api";

function MinutesLeft({ endsAt, serverNow }: { endsAt: string; serverNow: string }) {
  const [offset] = useState(() => Date.parse(serverNow) - Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  return <>{Math.max(0, Math.ceil((Date.parse(endsAt) - (now + offset)) / 60000))} min</>;
}

export function ExamCard({ d, reload }: { d: Dashboard; reload: () => void }) {
  const [armed, setArmed] = useState(false);
  const ex = d.exam;
  const bp = ex.blueprint;
  if (!bp) return <div className="card muted">No exam blueprint loaded yet.</div>;
  const running = ex.in_progress;
  const resume = running ? (
    <Link className="btn primary" href={`/exam/${running.id}`}>
      Resume · <MinutesLeft endsAt={running.ends_at} serverNow={d.server_now} /> left
    </Link>
  ) : null;

  return (
    <div className="card">
      <div className="rt-title">Practice exams</div>
      <div className="sub">
        Three fixed full-length exams with no shared questions, in the real format: {bp.items} items · {bp.minutes} minutes ·
        pass {bp.pass_score} of 1000 · weighted by the {bp.domain_count} exam domains.
      </div>
      <div className="extiles">
        {ex.sets.map((s) => {
          const passed = s.best != null && s.best >= bp.pass_score;
          return (
            <div key={s.id} className={`extile ${passed ? "passed" : ""}`}>
              <div style={{ fontWeight: 650 }}>{s.name}</div>
              <div className="exstat">
                {s.tries ? (
                  <>
                    Best <b className={`pct ${passed ? "good" : "bad"}`}>{s.best}</b>{" "}
                    <span className={`badge ${passed ? "pass" : "fail"}`}>{passed ? "PASS" : "FAIL"}</span>
                    <br />
                    <span className="muted">
                      {s.tries} attempt{s.tries > 1 ? "s" : ""} · last {s.last}
                    </span>
                  </>
                ) : (
                  <span className="muted">Not taken yet</span>
                )}
              </div>
              {running?.set_id === s.id ? (
                resume
              ) : running ? (
                <button className="btn" disabled>{s.tries ? "Retake" : "Start"}</button>
              ) : (
                <Link className={`btn ${s.tries ? "" : "primary"}`} href={`/exam/start/${s.id}`}>
                  {s.tries ? "Retake" : "Start"}
                </Link>
              )}
            </div>
          );
        })}
      </div>
      {running ? (
        <div className="row between" style={{ marginTop: 12, fontSize: 13.5 }}>
          <span className="muted">
            {running.set_name} in progress · {running.answered} of {running.total} answered · the timer keeps running
          </span>
          <button
            className={`btn ghost ${armed ? "danger" : ""}`}
            onClick={async () => {
              if (!armed) return setArmed(true);
              await api.discardExam(running.id);
              setArmed(false);
              reload();
            }}
          >
            {armed ? "Click again to discard" : "Discard attempt"}
          </button>
        </div>
      ) : null}
      <div className="row between exmixed">
        <span className="muted">
          Done all three? <b>Mixed exam</b>: {bp.items} random items, ones you haven&apos;t seen first.
        </span>
        {running?.set_id === "mixed" ? resume : running ? (
          <button className="btn" disabled>Mixed exam</button>
        ) : (
          <Link className="btn" href="/exam/start/mixed">Mixed exam</Link>
        )}
      </div>
      {ex.history.length ? (
        <div className="attempts" style={{ marginTop: 14 }}>
          {ex.history.map((h) => (
            <Link key={h.id} className="attempt" href={`/exam/${h.id}/results`}>
              <span>
                {h.set_name}{" "}
                <span className="muted">
                  · {new Date(h.finished_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} ·{" "}
                  {h.correct}/{h.total} correct{h.status === "expired" ? " · time expired" : ""}
                </span>
              </span>
              <span>
                <b className={`pct ${h.passed ? "good" : "bad"}`}>{h.scaled}</b>{" "}
                <span className={`badge ${h.passed ? "pass" : "fail"}`}>{h.passed ? "PASS" : "FAIL"}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}
      {ex.weakest.length ? (
        <div className="weakline">Weakest last time: {ex.weakest.map((w) => `${w.name} ${w.pct}%`).join(" · ")}</div>
      ) : null}
    </div>
  );
}
