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
  // With cacheComponents, Next keeps this page mounted but hidden after navigating away, and
  // re-runs the effect when it is shown again. So guard only the request in flight (dev Strict
  // Mode runs the effect twice), not the page's lifetime, or the next visit would never start.
  const inFlight = useRef<string | null>(null);
  const visible = useRef(false);
  useEffect(() => {
    visible.current = true;
    const hide = () => {
      visible.current = false;
    };
    const key = `${scope}|${retry ?? ""}`;
    if (inFlight.current === key) return hide;
    inFlight.current = key;
    setError(undefined);
    api.startQuiz(scope, retry).then(
      (q) => {
        inFlight.current = null;
        // don't pull the visitor back here if they left while the quiz was being created
        if (visible.current) router.replace(`/quiz/${q.id}`);
      },
      (e: Error) => {
        inFlight.current = null;
        setError(e.message);
      },
    );
    return hide;
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
