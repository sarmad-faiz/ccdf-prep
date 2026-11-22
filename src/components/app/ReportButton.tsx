"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";

const REASONS: [string, string][] = [
  ["wrong_answer", "The marked answer is wrong"],
  ["ambiguous", "More than one answer could be right"],
  ["outdated", "It's out of date"],
  ["typo", "Typo or unclear wording"],
  ["other", "Something else"],
];

export function ReportButton({ qid }: { qid: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("wrong_answer");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function send() {
    setState("sending");
    try {
      await api.report(qid, reason, details);
      setState("sent");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  return (
    <>
      <button className="btn ghost small" onClick={() => ref.current?.showModal()}>
        {state === "sent" ? "Reported ✓" : "Report this question"}
      </button>
      <dialog ref={ref} className="modal" aria-labelledby={`rep-${qid}`}>
        {state === "sent" ? (
          <>
            <b id={`rep-${qid}`}>Thanks, the report was saved.</b>
            <p className="muted small">Reports are reviewed and fixes go out with the next content release.</p>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => ref.current?.close()}>Close</button>
            </div>
          </>
        ) : (
          <form method="dialog" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <b id={`rep-${qid}`}>Report question {qid}</b>
            <div style={{ display: "grid", gap: 6, margin: "12px 0" }}>
              {REASONS.map(([value, label]) => (
                <label key={value} className="row" style={{ gap: 8 }}>
                  <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
                  {label}
                </label>
              ))}
            </div>
            <textarea className="input" style={{ width: "100%", minHeight: 80 }} maxLength={1000}
              placeholder="What's wrong? Point to the course section if you can (don't paste course text)."
              value={details} onChange={(e) => setDetails(e.target.value)} />
            {state === "error" ? <p className="bad-text small">{error}</p> : null}
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => ref.current?.close()}>Cancel</button>
              <button type="submit" className="btn primary" disabled={state === "sending"}>Send report</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

export function StatsLine({ stats }: { stats?: { pct: number; n: number } | null }) {
  if (!stats) return null;
  return <span className="small muted">{stats.pct}% got this right on their first try (n={stats.n})</span>;
}
