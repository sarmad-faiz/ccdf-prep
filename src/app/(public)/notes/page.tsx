import type { Metadata } from "next";
import Link from "next/link";
import { getModules } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Revision notes for all 5 modules",
  description: "Short, unofficial revision notes for every module of the Claude Certified Developer – Foundations prep course.",
  alternates: { canonical: "/notes" },
};

export default async function NotesIndex() {
  const modules = await getModules();
  return (
    <main className="page">
      <div className="eyebrow">Revision notes</div>
      <h1>Short notes for every module</h1>
      <p className="muted">Condensed from the official prep course: definitions, steps, tables and the traps that show up in questions.</p>
      <div className="mods" style={{ marginTop: 16 }}>
        {modules.map((m, i) => (
          <Link key={m.id} href={`/notes/${m.slug}`} className="card mod" style={{ textDecoration: "none", gridTemplateColumns: "32px 1fr" }}>
            <div className="num">{i + 1}</div>
            <div>
              <div className="title">{m.title}</div>
              <div className="meta">{m.question_count} quiz questions</div>
            </div>
          </Link>
        ))}
        <Link href="/notes/recall" className="card mod" style={{ textDecoration: "none", gridTemplateColumns: "32px 1fr" }}>
          <div className="num">⏱</div>
          <div>
            <div className="title">Final 60-second recall</div>
            <div className="meta">One page across all modules, for right before the exam</div>
          </div>
        </Link>
      </div>
    </main>
  );
}
