"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExamCard } from "@/components/app/ExamCard";
import { useReadySession } from "@/components/app/Gate";
import { api, pct, pctClass, type Dashboard as Data } from "@/lib/api";
import { browserClient } from "@/lib/supabase/browser";

function daysUntil(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date();
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 864e5);
}

export function useDashboard() {
  const [data, setData] = useState<Data>();
  const [error, setError] = useState<string>();
  const reload = useCallback(() => {
    api.dashboard().then(setData, (e: Error) => setError(e.message));
  }, []);
  useEffect(reload, [reload]);
  return { data, error, reload, setData };
}

export function Dashboard() {
  const session = useReadySession();
  const { data: d, error, reload, setData } = useDashboard();
  const [newTodo, setNewTodo] = useState("");
  const db = browserClient();

  if (error) return <main className="page"><p className="bad-text">{error}</p></main>;
  if (!d) return <main className="page"><p className="muted">Loading your dashboard…</p></main>;

  const days = d.profile.exam_date ? daysUntil(d.profile.exam_date) : null;
  const daysLabel =
    days == null ? "set your exam date" : days > 1 ? "days to exam" : days === 1 ? "day to exam" : days === 0 ? "Exam is today" : "Exam date passed";
  const studiedCount = Object.keys(d.studied).length;
  const weakByModule = (id: string) => d.weak_topics.filter((w) => w.module_id === id).length;
  const lastSlug = d.profile.last_note_page;
  const cur = d.modules.find((m) => m.slug === lastSlug);
  const curIndex = cur ? d.modules.indexOf(cur) : 0;
  const continueHref = lastSlug === "recall" ? "/notes/recall" : `/notes/${(cur ?? d.modules[0])?.slug ?? ""}`;
  const continueLabel = lastSlug === "recall" ? "60-sec recall" : `M${curIndex + 1}`;
  const uid = session.userId;
  // Stat tiles: accuracy on answered questions, and readiness = best score on the fixed exams A/B/C
  // (same items every attempt, so comparable; the random Mixed exam is left out).
  const answered = d.results.right + d.results.mistakes;
  const accuracy = pct(d.results.right, answered);
  const passScore = d.exam.blueprint?.pass_score ?? 720;
  const setBests = d.exam.sets.map((x) => x.best).filter((x): x is number => x != null);
  const bestExam = setBests.length ? Math.max(...setBests) : null;
  const perSet = d.exam.sets.map((x) => `${x.id} ${x.best ?? "—"}`).join(" · ");

  const update = async (fields: Record<string, unknown>) => {
    await db.from("profiles").update(fields).eq("user_id", uid);
    reload();
  };

  return (
    <main className="page">
      {d.is_anonymous ? (
        <div className="notice row between" style={{ marginBottom: 16 }}>
          <span>You&apos;re practising as a guest. Sign in to keep your progress across devices.</span>
          <Link className="btn small" href="/login?next=/dashboard">Save my progress</Link>
        </div>
      ) : null}

      <header className="row between" style={{ alignItems: "flex-end" }}>
        <div>
          <div className="eyebrow">Claude Certified Developer – Foundations</div>
          <h1>Exam prep</h1>
        </div>
        <label className="row small muted" style={{ gap: 8 }}>
          Exam date
          <input
            id="exam-date"
            className="input"
            type="date"
            value={d.profile.exam_date ?? ""}
            onChange={(e) => update({ exam_date: e.target.value || null })}
          />
        </label>
      </header>

      <section className="stats">
        <label className="stat hot" htmlFor="exam-date" title="Set your exam date">
          <b>{days == null ? "–" : Math.max(days, 0)}</b>
          <span>{daysLabel}</span>
        </label>
        <a className="stat" href="#modules">
          <b>{studiedCount}/{d.modules.length}</b>
          <span>modules studied</span>
        </a>
        <Link className="stat" href={d.results.mistakes ? "/quiz/start?scope=mistakes" : "#modules"}
          title={d.results.mistakes ? `Review your ${d.results.mistakes} mistakes` : "Take a module quiz"}>
          {answered ? <b className={`pct ${pctClass(accuracy)}`}>{accuracy}%</b> : <b>–</b>}
          <span>quiz accuracy</span>
          <small className="stat-sub">{answered ? `${answered} of ${d.results.total} questions answered` : "no answers yet"}</small>
        </Link>
        <Link className="stat" href="/exam" title="Practice exams">
          {bestExam != null ? (
            <b className={`pct ${bestExam >= passScore ? "good" : "bad"}`}>
              {bestExam} <span className={`badge ${bestExam >= passScore ? "pass" : "fail"}`}>{bestExam >= passScore ? "PASS" : "FAIL"}</span>
            </b>
          ) : (
            <b>–</b>
          )}
          <span>{bestExam != null ? "best practice exam" : "exam readiness"}</span>
          <small className="stat-sub">{bestExam != null ? perSet : "not taken yet"}</small>
        </Link>
      </section>

      <section className="card revtile" aria-label="Revision notes">
        <div className="rt-top">
          <div>
            <div className="rt-title">Revision notes</div>
            <div className="sub">Short notes for all {d.modules.length} modules + 60-second recall</div>
          </div>
          <Link className="btn primary" href={continueHref}>{lastSlug ? "Continue" : "Start with"} {continueLabel} →</Link>
        </div>
        <div className="pills">
          {d.modules.map((m, i) => {
            const n = weakByModule(m.id);
            return (
              <Link key={m.id} className={`btn pill ${m.slug === lastSlug ? "cur" : ""}`} href={`/notes/${m.slug}`}
                title={`${m.title}${n ? ` · ${n} weak topic${n > 1 ? "s" : ""}` : ""}`}>
                M{i + 1}{n ? <span className="dot" /> : null}
              </Link>
            );
          })}
          <Link className={`btn pill ${lastSlug === "recall" ? "cur" : ""}`} href="/notes/recall">60-sec recall</Link>
        </div>
        {d.weak_topics.length ? (
          <div className="weakline">
            {d.weak_topics.length} weak topic{d.weak_topics.length > 1 ? "s" : ""} ·{" "}
            {d.weak_topics.map((w, i) => {
              const m = d.modules.find((x) => x.id === w.module_id);
              return (
                <span key={`${w.module_id}-${w.slug}`}>
                  {i ? ", " : ""}
                  <Link className="link" href={`/notes/${m?.slug}#${w.slug}`}>{w.topic}</Link>
                </span>
              );
            })}
          </div>
        ) : null}
      </section>

      <h2 className="section" id="modules">Modules</h2>
      <div className="mods">
        {d.modules.map((m, i) => {
          const done = !!d.studied[m.id];
          return (
            <div key={m.id} className={`card mod ${done ? "done" : ""}`}>
              <div className="num">{done ? "✓" : i + 1}</div>
              <div>
                <div className="title">{m.title}</div>
                <div className="meta">
                  {[`${m.minutes} min`, `${m.question_count} questions`, ...(m.tries ? [`best ${m.best}%`, `last ${m.last}%`] : [])].join(" · ")}
                </div>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={async (e) => {
                    const on = e.target.checked;
                    const studied = { ...d.studied };
                    if (on) studied[m.id] = new Date().toISOString();
                    else delete studied[m.id];
                    setData({ ...d, studied }); // optimistic
                    if (on) await db.from("module_progress").insert({ module_id: m.id });
                    else await db.from("module_progress").delete().eq("module_id", m.id).eq("user_id", uid);
                    reload();
                  }}
                />{" "}
                Studied
              </label>
              <div className="row acts" style={{ flexWrap: "nowrap", gap: 8 }}>
                <Link className="btn" href={`/notes/${m.slug}`}>Revise</Link>
                <Link className={`btn ${done ? "primary" : ""}`} href={`/quiz/start?scope=module:${m.id}`}>Quiz</Link>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="section">Exam simulation</h2>
      <ExamCard d={d} reload={reload} />

      <h2 className="section">Practice</h2>
      <div className="card">
        <div className="row">
          <span className="muted small">Show answers</span>
          <div className="seg" role="group" aria-label="When to show answers">
            <button aria-pressed={d.profile.feedback_mode === "instant"} onClick={() => update({ feedback_mode: "instant" })}>
              After each question
            </button>
            <button aria-pressed={d.profile.feedback_mode === "end"} onClick={() => update({ feedback_mode: "end" })}>
              At the end (exam style)
            </button>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          {d.results.mistakes ? (
            <Link className="btn primary" href="/quiz/start?scope=mistakes">Review mistakes ({d.results.mistakes})</Link>
          ) : (
            <button className="btn primary" disabled>Review mistakes (0)</button>
          )}
          <Link className="btn" href="/quiz/start?scope=mixed">Mixed quiz, all modules ({d.results.total})</Link>
        </div>
      </div>

      <h2 className="section">To do</h2>
      <div className="card todos">
        {d.todos.map((t) => (
          <div key={t.id} className="row between" style={{ flexWrap: "nowrap" }}>
            <label className={t.done ? "done" : ""}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={async (e) => {
                  const done = e.target.checked;
                  setData({ ...d, todos: d.todos.map((x) => (x.id === t.id ? { ...x, done } : x)) }); // optimistic
                  await db.from("todos").update({ done }).eq("id", t.id);
                  reload();
                }}
              />
              <span>{t.label}</span>
            </label>
            <button
              className="btn ghost small"
              aria-label={`Delete "${t.label}"`}
              onClick={async () => {
                await db.from("todos").delete().eq("id", t.id);
                reload();
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <form
          className="row"
          style={{ marginTop: 8, flexWrap: "nowrap" }}
          onSubmit={async (e) => {
            e.preventDefault();
            const label = newTodo.trim();
            if (!label) return;
            await db.from("todos").insert({ label, position: d.todos.length });
            setNewTodo("");
            reload();
          }}
        >
          <input className="input" style={{ flex: 1 }} maxLength={200} placeholder="Add a to-do" value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)} aria-label="New to-do" />
          <button className="btn" type="submit">Add</button>
        </form>
      </div>

      <h2 className="section">Recent attempts</h2>
      {d.recent.length ? (
        <div className="attempts">
          {d.recent.map((a) => {
            const p = pct(a.score, a.answered || a.total);
            return (
              <Link key={a.id} className="attempt" href={`/quiz/${a.id}`}>
                <span>
                  {a.title}{" "}
                  <span className="muted">
                    · {new Date(a.finished_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                    {a.status === "abandoned" ? " · stopped early" : ""}
                  </span>
                </span>
                <span>
                  {a.score}/{a.answered || a.total} <span className={`pct ${pctClass(p)}`}>{p}%</span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="muted">No quizzes yet. Start with Module 1.</p>
      )}
    </main>
  );
}
