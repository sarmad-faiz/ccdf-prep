import { Suspense } from "react";
import { ExamStart } from "@/components/app/ExamStart";
import { Gate } from "@/components/app/Gate";

export default function ExamStartPage({ params }: PageProps<"/exam/start/[set]">) {
  return (
    <Suspense fallback={<main className="page"><p className="muted">Loading…</p></main>}>
      {params.then(({ set }) => (
        <Gate next={`/exam/start/${set}`}>
          <ExamStart set={set} />
        </Gate>
      ))}
    </Suspense>
  );
}
