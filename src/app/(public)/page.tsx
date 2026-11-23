import Link from "next/link";
import { HomeSwitch } from "@/components/app/HomeSwitch";
import { getBlueprint, getModules } from "@/lib/content/queries";

export default async function Home() {
  const [modules, bp] = await Promise.all([getModules(), getBlueprint()]);
  const questions = modules.reduce((s, m) => s + m.question_count, 0);
  return (
    <HomeSwitch>
    <main className="page">
      <div className="eyebrow">Unofficial study guide · free and open source</div>
      <h1 style={{ fontSize: 30, margin: "6px 0 10px" }}>Prepare for the Claude Certified Developer – Foundations exam</h1>
      <p className="muted" style={{ fontSize: 16, margin: 0 }}>
        Revision notes for all {modules.length} course modules, free to read with no account. When you&apos;re ready, test
        yourself with {questions} practice quiz questions and {bp.sets.length} timed practice exams in the real format.
      </p>
      <div className="row" style={{ marginTop: 18 }}>
        <Link className="btn primary" href="/exam">Take a practice exam</Link>
        <Link className="btn" href="#quizzes">Take a practice quiz</Link>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        Practice saves your progress: sign in with your email or Google, or continue as a guest.
      </p>

      <h2 className="section" id="quizzes">Study by module</h2>
      <div className="mods">
        {modules.map((m, i) => (
          <div key={m.id} className="card mod" style={{ gridTemplateColumns: "32px 1fr auto" }}>
            <div className="num">{i + 1}</div>
            <div>
              <div className="title">{m.title}</div>
              <div className="meta">Short notes · {m.question_count} quiz questions</div>
            </div>
            <div className="row acts" style={{ flexWrap: "nowrap", gap: 8 }}>
              <Link className="btn" href={`/notes/${m.slug}`}>Notes</Link>
              <Link className="btn primary" href={`/quiz/start?scope=module:${m.id}`}>Quiz</Link>
            </div>
          </div>
        ))}
        <div className="card mod" style={{ gridTemplateColumns: "32px 1fr auto" }}>
          <div className="num">⏱</div>
          <div>
            <div className="title">All modules</div>
            <div className="meta">60-second recall page · mixed quiz of all {questions} questions</div>
          </div>
          <div className="row acts" style={{ flexWrap: "nowrap", gap: 8 }}>
            <Link className="btn" href="/notes/recall">Recall</Link>
            <Link className="btn primary" href="/quiz/start?scope=mixed">Quiz</Link>
          </div>
        </div>
      </div>

      <h2 className="section">Practice exams</h2>
      <div className="card">
        <div className="rt-title">{bp.sets.map((s) => s.name.replace("Practice exam ", "")).join(", ")}: full-length, timed, Pearson VUE style</div>
        <ul className="md" style={{ margin: "10px 0 14px", paddingLeft: 20, listStyle: "disc" }}>
          <li>{bp.items} items, {bp.minutes} minutes, scored 100–1000 with {bp.pass_score} to pass.</li>
          <li>Weighted by the {bp.domains.length} official exam domains, with no shared questions between exams.</li>
          <li>Flag for review, a review screen, &ldquo;Choose two&rdquo; items, and a score by domain at the end.</li>
        </ul>
        <div className="row">
          <Link className="btn primary" href="/exam">Take a practice exam</Link>
          <Link className="btn" href="/exam-format">See the exam format</Link>
        </div>
      </div>

      <div className="notice" style={{ marginTop: 24 }}>
        <b>Not affiliated with Anthropic.</b> These are a learner&apos;s own condensed notes from Anthropic&apos;s official prep
        course and original practice questions. Always check the latest official exam guide. <Link href="/about">Credits and sources</Link>
      </div>
    </main>
    </HomeSwitch>
  );
}
