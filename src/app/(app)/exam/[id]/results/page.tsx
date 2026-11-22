import { Suspense } from "react";
import { ExamResultView } from "@/components/app/ExamResultView";
import { Gate } from "@/components/app/Gate";

export default function ExamResultsPage({ params }: PageProps<"/exam/[id]/results">) {
  return (
    <Suspense fallback={<main className="page"><p className="muted">Loading results…</p></main>}>
      {params.then(({ id }) => (
        <Gate next={`/exam/${id}/results`}>
          <ExamResultView id={id} />
        </Gate>
      ))}
    </Suspense>
  );
}
