import type { Metadata } from "next";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { NoteTabs } from "@/components/notes/NoteTabs";
import { getModules, getRecall } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Final 60-second recall",
  description: "One-page recall of the key facts across all five Claude Certified Developer – Foundations modules (unofficial).",
  alternates: { canonical: "/notes/recall" },
};

export default async function Recall() {
  const [page, modules] = await Promise.all([getRecall(), getModules()]);
  return (
    <main className="page">
      <NoteTabs current="recall" modules={modules.map((m, i) => ({ slug: m.slug, label: `M${i + 1}` }))} />
      <div className="eyebrow">All modules</div>
      <h1 style={{ margin: "2px 0 6px" }}>{page.title}</h1>
      {page.lead_md ? <div className="muted"><Markdown>{page.lead_md}</Markdown></div> : null}
      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        {page.sections.map((s) => (
          <section key={s.slug} id={s.slug} className="card notes-sec">
            <h2 style={{ fontSize: 17, fontWeight: 650, margin: "0 0 4px" }}>{s.title}</h2>
            <Markdown>{s.body_md}</Markdown>
          </section>
        ))}
      </div>
      <div className="row" style={{ marginTop: 18, justifyContent: "flex-end" }}>
        <Link className="btn primary" href="/exam">Take a practice exam</Link>
      </div>
    </main>
  );
}
