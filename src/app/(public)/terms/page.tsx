import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <main className="page">
      <h1>Terms</h1>
      <div className="card md" style={{ marginTop: 14 }}>
        <ul>
          <li>CCDF Prep is a free, unofficial study aid provided as is, with no warranty. It may contain mistakes.</li>
          <li>
            It is not affiliated with Anthropic or Pearson VUE. Passing practice exams here does not predict or guarantee an
            exam result. Follow the official exam guide and the certification program&apos;s rules.
          </li>
          <li>Don&apos;t abuse the service: no automated scraping, load testing or attempts to access other users&apos; data.</li>
          <li>Content is CC BY-NC-SA 4.0 and code is MIT; see the repository for the full licences.</li>
          <li>The service may change or be taken down at any time.</li>
        </ul>
      </div>
    </main>
  );
}
