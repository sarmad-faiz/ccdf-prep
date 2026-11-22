import { Suspense } from "react";
import { Gate } from "@/components/app/Gate";
import { QuizRunner } from "@/components/app/QuizRunner";

export default function QuizPage({ params }: PageProps<"/quiz/[id]">) {
  return (
    <Suspense fallback={<main className="page"><p className="muted">Loading quiz…</p></main>}>
      {params.then(({ id }) => (
        <Gate next={`/quiz/${id}`}>
          <QuizRunner id={id} />
        </Gate>
      ))}
    </Suspense>
  );
}
