import type { Metadata } from "next";
import { REPO_URL } from "@/components/SiteChrome";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <main className="page">
      <h1>Privacy</h1>
      <div className="card md" style={{ marginTop: 14 }}>
        <p>CCDF Prep keeps only what it needs to save your study progress.</p>
        <h3>What is stored</h3>
        <ul>
          <li><b>Guests:</b> a random account id, your quiz and exam answers, to-dos, exam date and preferences.</li>
          <li><b>Signed-in users:</b> the same, plus your email address (email code sign-in) or your Google account email.</li>
          <li><b>Question reports</b> you send, including any text you write.</li>
          <li>Aggregate, anonymous counts of how many people answered each question correctly.</li>
        </ul>
        <h3>What is not done</h3>
        <ul>
          <li>No ads, no selling or sharing of personal data, no third-party tracking scripts.</li>
          <li>Guest accounts that are inactive for 30 days are deleted automatically.</li>
        </ul>
        <h3>Your controls</h3>
        <p>
          On the Account page you can download all your data as JSON or delete your account and everything linked to it.
        </p>
        <h3>Processors</h3>
        <p>
          Data is stored with Supabase (database and authentication) and the site is served by Vercel. Sign-in emails are
          sent through the site operator&apos;s email provider. Google sign-in is handled by Google.
        </p>
        <p className="small muted">Questions about privacy: open an issue on <a href={REPO_URL}>GitHub</a>.</p>
      </div>
    </main>
  );
}
