"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Inline } from "@/components/Inline";
import { LoadError } from "@/components/app/LoadError";
import { api, type ExamState } from "@/lib/api";
import { saveErrorText } from "@/lib/errors";
import { fmtClock } from "@/lib/format";

type Live = Extract<ExamState, { status: "in_progress" }>;
type Item = Live["items"][number];
type SaveChange = Parameters<typeof api.saveExam>[1];
const KEYS = "ABCDE";

const isDone = (it: Item) => it.chosen.length === it.select_count;

export function ExamRunner({ id }: { id: string }) {
  const router = useRouter();
  const [exam, setExam] = useState<Live>();
  const [i, setI] = useState(0);
  const [view, setView] = useState<"item" | "review">("item");
  const [filter, setFilter] = useState<"all" | "inc" | "flag">("all");
  const [left, setLeft] = useState(0);
  const [hint, setHint] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [inFlight, setInFlight] = useState(0); // saves queued or running
  const [unsaved, setUnsaved] = useState(false); // some item's latest save failed
  const [endState, setEndState] = useState<"idle" | "ending">("idle");
  const [endError, setEndError] = useState<string>();
  const offset = useRef(0); // server clock minus local clock
  const ending = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const failed = useRef(new Set<number>()); // positions whose latest save failed
  const examRef = useRef<Live | undefined>(undefined);
  useEffect(() => {
    examRef.current = exam;
  }, [exam]);

  const toResults = useCallback(() => router.replace(`/exam/${id}/results`), [router, id]);

  const load = useCallback(() => {
    api.getExam(id).then(
      (e) => {
        if (e.status !== "in_progress") return toResults();
        offset.current = Date.parse(e.server_now) - Date.now();
        setExam(e);
        setI(e.current_index);
        setView(e.view);
      },
      (err: Error) => setError(err.message),
    );
  }, [id, toResults]);
  useEffect(load, [load]);

  // Saves go out one at a time, in the order they were made. The server keeps the last write,
  // so two overlapping saves for one item could otherwise leave the older answer stored.
  // Item saves always carry the item's full state, so any later success makes it whole again.
  const save = useCallback(
    (change: SaveChange) => {
      setInFlight((n) => n + 1);
      const run = async () => {
        try {
          const r = await api.saveExam(id, change);
          if (change.position != null) failed.current.delete(change.position);
          if (r.status !== "in_progress") toResults();
        } catch (e) {
          if (change.position != null) failed.current.add(change.position);
          setHint(saveErrorText(e));
        } finally {
          setInFlight((n) => n - 1);
          setUnsaved(failed.current.size > 0);
        }
      };
      queue.current = queue.current.then(run);
      return queue.current;
    },
    [id, toResults],
  );

  const retryFailed = useCallback(async () => {
    const ex = examRef.current;
    if (!ex) return;
    for (const pos of [...failed.current]) {
      const it = ex.items.find((x) => x.pos === pos);
      if (it) save({ position: pos, chosen: it.chosen, flagged: it.flagged });
    }
    await queue.current;
  }, [save]);

  // Wait for every queued save, and give failed ones one more try.
  const flush = useCallback(async () => {
    await queue.current;
    if (failed.current.size) await retryFailed();
  }, [retryFailed]);

  // auto: the timer ran out, so submit whatever is saved (the server would expire it anyway).
  const end = useCallback(
    async (auto: boolean) => {
      if (ending.current) return;
      ending.current = true;
      setEndState("ending");
      setEndError(undefined);
      await flush();
      if (!auto && failed.current.size) {
        ending.current = false;
        setEndState("idle");
        setEndError("Some answers aren't saved yet. Check your connection, then end the exam again.");
        return;
      }
      try {
        await api.submitExam(id);
        toResults();
      } catch (e) {
        if (auto) return toResults();
        ending.current = false;
        setEndState("idle");
        setEndError(saveErrorText(e, "end the exam"));
      }
    },
    [flush, id, toResults],
  );

  // countdown against the server's deadline
  useEffect(() => {
    if (!exam) return;
    const tick = () => {
      const ms = Date.parse(exam.ends_at) - (Date.now() + offset.current);
      setLeft(ms);
      if (ms <= 0) end(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [exam, end]);

  const updateItem = useCallback((pos: number, patch: Partial<Item>) => {
    setExam((ex) => (ex ? { ...ex, items: ex.items.map((x) => (x.pos === pos ? { ...x, ...patch } : x)) } : ex));
  }, []);

  const goto = useCallback(
    (k: number, v: "item" | "review" = "item") => {
      setI(k);
      setView(v);
      setConfirming(false);
      setHint("");
      save({ currentIndex: k, view: v });
      window.scrollTo(0, 0);
    },
    [save],
  );

  const pick = useCallback(
    (k: number) => {
      if (!exam) return;
      const it = exam.items[i];
      let next: number[];
      if (it.select_count === 1) next = [k];
      else if (it.chosen.includes(k)) next = it.chosen.filter((x) => x !== k);
      else if (it.chosen.length < it.select_count) next = [...it.chosen, k];
      else {
        setHint(`Only ${it.select_count} can be selected. Clear one first.`);
        return;
      }
      setHint("");
      updateItem(it.pos, { chosen: next });
      save({ position: it.pos, chosen: next, flagged: it.flagged });
    },
    [exam, i, updateItem, save],
  );

  const flag = useCallback(() => {
    if (!exam) return;
    const it = exam.items[i];
    updateItem(it.pos, { flagged: !it.flagged });
    save({ position: it.pos, chosen: it.chosen, flagged: !it.flagged });
  }, [exam, i, updateItem, save]);

  const next = useCallback(() => {
    if (!exam) return;
    if (i < exam.items.length - 1) goto(i + 1);
    else goto(i, "review");
  }, [exam, i, goto]);

  useEffect(() => {
    if (view !== "item") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !exam) return;
      const k = e.key.toLowerCase();
      const idx = "abcde".indexOf(k) >= 0 ? "abcde".indexOf(k) : "12345".indexOf(k);
      if (idx >= 0 && idx < exam.items[i].options.length) { e.preventDefault(); pick(idx); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); goto(i - 1); }
      else if (k === "f") { e.preventDefault(); flag(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [view, exam, i, pick, next, goto, flag]);

  if (error) {
    return (
      <main className="page">
        <LoadError message={error} onRetry={() => { setError(undefined); load(); }} back={{ href: "/exam", label: "Exams" }} />
      </main>
    );
  }
  if (!exam) return <main className="page"><p className="muted">Loading exam…</p></main>;

  const n = exam.items.length;
  const bar = (label: string) => (
    <div className="exam-bar">
      <div><b>{exam.set_name}</b><div className="muted small">{label}</div></div>
      <div className="clock">
        <span className="muted small">Time left</span>
        <span className={`timer ${left < 10 * 60e3 ? "low" : ""}`} role="timer">{fmtClock(left)}</span>
        <span className="small" role="status">
          {unsaved ? (
            <span className="bad-text">
              Not saved ·{" "}
              <button type="button" className="link-btn" onClick={retryFailed} disabled={inFlight > 0}>Retry</button>
            </span>
          ) : inFlight > 0 ? (
            <span className="muted save-status">Saving…</span>
          ) : null}
        </span>
      </div>
    </div>
  );

  if (view === "review") {
    const all = exam.items.map((it, k) => ({ k, done: isDone(it), flag: it.flagged }));
    const inc = all.filter((x) => !x.done).length;
    const fl = all.filter((x) => x.flag).length;
    const shown = all.filter((x) => (filter === "inc" ? !x.done : filter === "flag" ? x.flag : true));
    return (
      <main className="page">
        {bar("Review screen")}
        <div className="card">
          <div><b>{n - inc}</b> of {n} answered · <b>{inc}</b> incomplete · <b>{fl}</b> flagged</div>
          <div className="seg" role="group" aria-label="Show items" style={{ marginTop: 12 }}>
            <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All ({n})</button>
            <button aria-pressed={filter === "inc"} onClick={() => setFilter("inc")}>Incomplete ({inc})</button>
            <button aria-pressed={filter === "flag"} onClick={() => setFilter("flag")}>Flagged ({fl})</button>
          </div>
          <div className="rgrid">
            {shown.length ? (
              shown.map((x) => (
                <button key={x.k} className={`btn rcell ${x.done ? "" : "inc"} ${x.flag ? "flag" : ""}`} onClick={() => goto(x.k)}>
                  <b>{x.k + 1}</b>
                  <span>{x.done ? "Answered" : "Incomplete"}{x.flag ? " · ⚑" : ""}</span>
                </button>
              ))
            ) : (
              <p className="muted">No items in this view.</p>
            )}
          </div>
        </div>
        <div className="exam-nav">
          <button className="btn" onClick={() => goto(i)}>Return to item {i + 1}</button>
          <button className="btn primary" onClick={() => setConfirming(true)}>End exam</button>
        </div>
        {confirming ? (
          <div className="card" style={{ marginTop: 12, borderColor: "var(--accent)" }}>
            <b>End the exam?</b>
            <p style={{ margin: "6px 0 12px", fontSize: 14 }}>
              {inc ? <>You have <b>{inc} incomplete</b> item{inc > 1 ? "s" : ""}, which will be scored as wrong. </> : null}
              {fl ? `${fl} item${fl > 1 ? "s are" : " is"} still flagged. ` : null}
              You can&apos;t change answers after this.
            </p>
            <div className="row">
              <button className="btn primary" onClick={() => end(false)} disabled={endState === "ending"}>
                {endState === "ending" ? "Ending…" : "End exam and see score"}
              </button>
              <button className="btn" onClick={() => setConfirming(false)} disabled={endState === "ending"}>Keep working</button>
            </div>
            {endError ? <p className="bad-text small" role="alert" style={{ marginBottom: 0 }}>{endError}</p> : null}
          </div>
        ) : null}
      </main>
    );
  }

  const it = exam.items[i];
  const answeredCount = exam.items.filter(isDone).length;
  return (
    <main className="page">
      {bar(`Item ${i + 1} of ${n}`)}
      <div className="bar"><span style={{ width: `${(100 * answeredCount) / n}%` }} /></div>
      <div className="card">
        <div className="row between">
          <span className="chip">{it.select_count > 1 ? `Multiple response · choose ${it.select_count}` : "Single answer"}</span>
          <button className="btn small flagbtn" aria-pressed={it.flagged} onClick={flag}>
            {it.flagged ? "⚑ Flagged for review" : "⚐ Flag for review"}
          </button>
        </div>
        <p className="qtext"><Inline text={it.stem} /></p>
        <div className="opts" role={it.select_count > 1 ? "group" : "radiogroup"}>
          {it.options.map((text, k) => {
            const on = it.chosen.includes(k);
            return (
              <button key={k} className={`opt ${it.select_count > 1 ? "multi" : ""} ${on ? "sel" : ""}`}
                role={it.select_count > 1 ? "checkbox" : "radio"} aria-checked={on} onClick={() => pick(k)}>
                <span className="key">{KEYS[k]}</span>
                <span><Inline text={text} /></span>
              </button>
            );
          })}
        </div>
        <div className="hint" role="status">
          {hint ? <span className="bad-text">{hint}</span> : it.select_count > 1 ? `${it.chosen.length} of ${it.select_count} selected.` : ""}
        </div>
      </div>
      <div className="exam-nav">
        <button className="btn" onClick={() => goto(i - 1)} disabled={i === 0}>← Previous</button>
        <button className="btn" onClick={() => goto(i, "review")}>Review screen</button>
        <button className="btn primary" onClick={next}>{i === n - 1 ? "Review & end" : "Next →"}</button>
      </div>
      <div className="row between" style={{ marginTop: 12 }}>
        <span className="hint">Keys: A–E answer · ← → move · F flag</span>
        <button className="btn ghost" onClick={() => router.push("/dashboard")}>Leave (timer keeps running)</button>
      </div>
    </main>
  );
}
