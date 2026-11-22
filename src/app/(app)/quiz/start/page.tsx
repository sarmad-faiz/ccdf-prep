"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Gate } from "@/components/app/Gate";
import { api } from "@/lib/api";

function Starter() {
  const router = useRouter();
  const params = useSearchParams();
  const scope = params.get("scope") ?? "mixed";
  const retry = params.get("retry") ?? undefined;
  const [error, setError] = useState<string>();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api.startQuiz(scope, retry).then(
      (q) => router.replace(`/quiz/${q.id}`),
      (e: Error) => setError(e.message),
    );
  }, [router, scope, retry]);
  return (
    <main className="page">
      {error ? <p className="bad-text">{error}</p> : <p className="muted">Preparing your quiz…</p>}
    </main>
  );
}

function StartWithGate() {
  const params = useSearchParams();
  return (
    <Gate next={`/quiz/start?${params.toString()}`}>
      <Starter />
    </Gate>
  );
}

export default function QuizStartPage() {
  return (
    <Suspense fallback={<main className="page"><p className="muted">Loading…</p></main>}>
      <StartWithGate />
    </Suspense>
  );
}
