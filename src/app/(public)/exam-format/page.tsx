import type { Metadata } from "next";
import Link from "next/link";
import { getBlueprint } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "CCDV-F exam format, domains and weights",
  description:
    "Claude Certified Developer – Foundations (CCDV-F) exam format: number of items, time limit, passing score, question types and the eight domain weights (unofficial summary).",
  alternates: { canonical: "/exam-format" },
};

export default async function ExamFormat() {
  const bp = await getBlueprint();
  return (
    <main className="page">
      <div className="eyebrow">Exam format</div>
      <h1 style={{ margin: "2px 0 12px" }}>{bp.title}</h1>
      <div className="stats" style={{ marginTop: 0 }}>
        <div className="stat"><b>{bp.items}</b><span>items</span></div>
        <div className="stat"><b>{bp.minutes}</b><span>minutes</span></div>
        <div className="stat"><b>{bp.pass_score}</b><span>to pass (of 1000)</span></div>
        <div className="stat"><b>{bp.domains.length}</b><span>domains</span></div>
      </div>

      <h2 className="section">Domains and weights</h2>
      <div className="card tbl" style={{ margin: 0 }}>
        <table>
          <thead><tr><th>Domain</th><th>Weight</th><th>Items in a 53-item exam</th></tr></thead>
          <tbody>
            {bp.domains.map((d) => (
              <tr key={d.id}><td>{d.name}</td><td>{Number(d.weight).toFixed(1)}%</td><td>{d.item_count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section">What to expect</h2>
      <div className="card md">
        <ul>
          <li>Delivered by Pearson VUE, online proctored or at a test centre. Closed book.</li>
          <li>Single-answer items and multiple-response items that say how many to choose (for example &ldquo;Choose two&rdquo;).</li>
          <li>Scaled score from 100 to 1000; {bp.pass_score} passes. The score report shows your percentage per domain.</li>
          <li>Unanswered items count as wrong, so answer everything. You can flag items and review before you end.</li>
        </ul>
      </div>

      <div className="notice" style={{ marginTop: 18 }}>
        This summary follows {bp.guide}. Pearson VUE lists updated exam content from <b>7 December 2026</b>; if you sit after that,
        check the current official exam guide. The practice exams here estimate the scaled score (72% correct ≈ 720) because
        Anthropic doesn&apos;t publish its scaling.
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <Link className="btn primary" href="/exam">Take a practice exam</Link>
        <Link className="btn" href="/notes">Revise first</Link>
      </div>
    </main>
  );
}
