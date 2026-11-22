"use client";
import { ExamCard } from "@/components/app/ExamCard";
import { useDashboard } from "@/components/app/Dashboard";
import { Gate } from "@/components/app/Gate";

function Hub() {
  const { data, error, reload } = useDashboard();
  if (error) return <p className="bad-text">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  return <ExamCard d={data} reload={reload} />;
}

export default function ExamHubPage() {
  return (
    <Gate next="/exam">
      <main className="page">
        <h1 className="eyebrow" style={{ fontSize: 13, fontWeight: 400, marginBottom: 10 }}>Exam simulation</h1>
        <Hub />
      </main>
    </Gate>
  );
}
