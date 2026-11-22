"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Inline } from "@/components/Inline";
import { ReportButton, StatsLine } from "@/components/app/ReportButton";
import { SigninPrompt } from "@/components/app/SigninPrompt";
import { api, pct, pctClass, type Quiz, type QuizItem } from "@/lib/api";

const KEYS = "ABCD";

export function QuizRunner({ id }: { id: string }) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz>();
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.getQuiz(id).then(
      (q) => {
        setQuiz(q);
        const firstOpen = q.items.findIndex((it) => it.chosen == null);
        setI(firstOpen < 0 ? q.items.length - 1 : firstOpen);
      },
      (e: Error) => setError(e.message),
    );
  }, [id]);

  const finished = quiz && quiz.status !== "in_progress";
  const item = quiz?.items[i];
  const revealed = !!item && item.correct_pos !== undefined;

  const pick = useCallback(
    async (choice: number) => {
      if (!quiz || !item || busy || finished) return;
      if (quiz.feedback_mode === "instant" && item.chosen != null) return; // locked once revealed
      setBusy(true);
      try {
        const res = await api.answerQuiz(quiz.id, item.position, choice);
        const updated: QuizItem = "stem" in res ? (res as QuizItem) : { ...item, chosen: choice };
        setQuiz({ ...quiz, items: quiz.items.map((x) => (x.position === item.position ? updated : x)) });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [quiz, item, busy, finished],
  );

  const finish = useCallback(
    async (completed: boolean) => {
      if (!quiz) return;
      setBusy(true);
      try {
        const res = await api.finishQuiz(quiz.id, completed);
        if (!completed || "deleted" in res) router.push("/dashboard");
        else {
          setQuiz(res as Quiz);
          window.scrollTo(0, 0);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [quiz, router],
  );

  const next = useCallback(() => {
    if (!quiz || !item || item.chosen == null) return;
    if (i < quiz.items.length - 1) setI(i + 1);
    else finish(true);
  }, [quiz, item, i, finish]);

  useEffect(() => {
    if (finished) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (e.metaKey || e.ctrlKey || e.altKey || target?.closest("input, textarea, dialog")) return;
      const k = e.key.toLowerCase();
      const idx = "abcd".indexOf(k) >= 0 ? "abcd".indexOf(k) : "1234".indexOf(k);
      if (idx >= 0 && item && idx < item.options.length) {
        e.preventDefault();
        pick(idx);
      } else if (e.key === "Enter" && target?.tagName !== "BUTTON") {
        e.preventDefault();
        next();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [finished, item, pick, next]);

  if (error) return <main className="page"><p className="bad-text">{error}</p><Link className="btn" href="/dashboard">Dashboard</Link></main>;
  if (!quiz || !item) return <main className="page"><p className="muted">Loading quiz…</p></main>;
  if (finished) return <QuizResults quiz={quiz} />;

  const n = quiz.items.length;
  const answeredHere = item.chosen != null;
  return (
    <main className="page">
      <div className="qtop">
        <button className="btn ghost" onClick={() => finish(false)} disabled={busy}>← Dashboard</button>
        <span className="muted">{quiz.title} · {i + 1} of {n}</span>
      </div>
      <div className="bar"><span style={{ width: `${(100 * (i + (answeredHere ? 1 : 0))) / n}%` }} /></div>
      <div className="card">
        {item.topic ? <span className="chip">{item.topic}</span> : null}
        <p className="qtext"><Inline text={item.stem} /></p>
        <div className="opts" role="radiogroup">
          {item.options.map((text, k) => {
            let cls = "opt";
            if (revealed) {
              cls += " locked";
              if (k === item.correct_pos) cls += " right";
              else if (k === item.chosen) cls += " wrong";
            } else if (k === item.chosen) cls += " sel";
            return (
              <button key={k} className={cls} role="radio" aria-checked={k === item.chosen} onClick={() => pick(k)}
                aria-disabled={revealed || undefined}>
                <span className="key">{KEYS[k]}</span>
                <span><Inline text={text} /></span>
              </button>
            );
          })}
        </div>
        {revealed ? (
          <div className={`explain ${item.correct ? "good" : "bad"}`}>
            <b>{item.correct ? "Correct." : "Not quite."}</b> <Inline text={item.explanation ?? ""} />
            <div className="row between" style={{ marginTop: 6 }}>
              <StatsLine stats={item.stats} />
              <ReportButton qid={item.qid} />
            </div>
          </div>
        ) : null}
      </div>
      <div className="row between" style={{ marginTop: 14 }}>
        <span className="hint">Keys: A–D or 1–4 to answer, Enter for next</span>
        <div className="row">
          {quiz.feedback_mode === "end" && i > 0 ? <button className="btn" onClick={() => setI(i - 1)}>Back</button> : null}
          <button className="btn primary" onClick={next} disabled={!answeredHere || busy}>
            {i === n - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </main>
  );
}

function QuizResults({ quiz }: { quiz: Quiz }) {
  const router = useRouter();
  const answered = quiz.items.filter((x) => x.chosen != null);
  const score = quiz.items.filter((x) => x.correct).length;
  const total = quiz.status === "completed" ? quiz.items.length : answered.length;
  const p = pct(score, total);
  const missed = quiz.items.filter((x) => !x.correct).length;
  const shown = quiz.status === "completed" ? quiz.items : answered;
  return (
    <main className="page">
      <SigninPrompt next={`/quiz/${quiz.id}`} />
      <div className="card score">
        <div className="eyebrow">{quiz.title}{quiz.status === "abandoned" ? " · stopped early" : ""}</div>
        <div className={`big pct ${pctClass(p)}`}>{p}%</div>
        <div className="muted">
          {score} of {total} correct{p >= 75 ? " · solid" : p >= 60 ? " · close, review the misses" : " · worth another pass"}
        </div>
        <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
          {missed && quiz.status === "completed" ? (
            <button className="btn primary" onClick={() => router.push(`/quiz/start?scope=retry&retry=${quiz.id}`)}>
              Retry the {missed} missed
            </button>
          ) : null}
          <Link className="btn" href="/dashboard">Dashboard</Link>
        </div>
      </div>
      <h2 className="section">Review</h2>
      <div className="review">
        {shown.map((it) => (
          <div key={it.position} className="card">
            {it.topic ? <span className="chip">{it.topic}</span> : null}
            {it.changed ? <span className="chip" style={{ marginLeft: 6 }}>Question updated since</span> : null}
            <div style={{ marginTop: 8, fontWeight: 500 }}><Inline text={it.stem} /></div>
            {it.correct ? (
              <div className="ans good">✓ <Inline text={it.options[it.correct_pos ?? 0]} /></div>
            ) : (
              <>
                <div className="ans bad">✗ You: {it.chosen != null ? <Inline text={it.options[it.chosen]} /> : "No answer"}</div>
                <div className="ans good">✓ <Inline text={it.options[it.correct_pos ?? 0]} /></div>
              </>
            )}
            <div className="why"><Inline text={it.explanation ?? ""} /></div>
            <div className="row between" style={{ marginTop: 4 }}>
              <StatsLine stats={it.stats} />
              <ReportButton qid={it.qid} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
