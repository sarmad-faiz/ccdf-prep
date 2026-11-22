import { Suspense } from "react";
import { ExamRunner } from "@/components/app/ExamRunner";
import { Gate } from "@/components/app/Gate";

export default function ExamPage({ params }: PageProps<"/exam/[id]">) {
  return (
    <Suspense fallback={<main className="page"><p className="muted">Loading exam…</p></main>}>
      {params.then(({ id }) => (
        <Gate next={`/exam/${id}`}>
          <ExamRunner id={id} />
        </Gate>
      ))}
    </Suspense>
  );
}
