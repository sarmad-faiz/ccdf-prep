import type { Metadata } from "next";
import { REPO_URL } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "About and credits",
  description: "Who made CCDF Prep, where the content comes from, and how to contribute.",
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <main className="page">
      <h1>About and credits</h1>
      <div className="card md" style={{ marginTop: 14 }}>
        <p>
          <b>CCDF Prep is an unofficial, community-made study tool</b> for the Claude Certified Developer – Foundations
          (CCDV-F) exam. It is not affiliated with, endorsed by, or sponsored by Anthropic, PBC. &ldquo;Claude&rdquo; and
          &ldquo;Anthropic&rdquo; are trademarks of Anthropic.
        </p>
        <h3>Where the content comes from</h3>
        <ul>
          <li>
            <b>Revision notes</b> are a learner&apos;s own condensed summaries of Anthropic&apos;s official CCDV-F prep course
            (five modules). They are not copies of the course; read the official course for the full material.
          </li>
          <li>
            <b>Quiz and exam questions</b> are original practice questions written from the course content and checked against
            it. They are not real exam questions and don&apos;t reproduce the course&apos;s own quizzes.
          </li>
          <li>
            <b>Exam format and domain weights</b> follow Exam Guide v1.0 (July 2026) as reported by third-party sites. Pearson VUE
            lists updated exam content from 7 December 2026. Always check the current official guide.
          </li>
          <li>
            <b>Scaled scores</b> in the practice exams are estimates (72% correct ≈ 720). Anthropic doesn&apos;t publish its
            scaling.
          </li>
        </ul>
        <h3>Licences</h3>
        <p>
          Code is MIT licensed. Notes and questions are licensed{" "}
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>: share and adapt with credit,
          non-commercially, under the same licence.
        </p>
        <h3>Contribute or report a problem</h3>
        <p>
          Spotted a wrong answer or an outdated fact? Use &ldquo;Report this question&rdquo; under any reviewed question, or open
          an issue or pull request on <a href={REPO_URL}>GitHub</a>. If you represent Anthropic and want any content changed or
          removed, open an issue and it will be handled promptly.
        </p>
      </div>
    </main>
  );
}
