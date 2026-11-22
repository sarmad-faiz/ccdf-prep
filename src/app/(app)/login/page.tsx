import type { Metadata } from "next";
import { Suspense } from "react";
import { Login } from "@/components/app/Login";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="page"><p className="muted">Loading…</p></main>}>
      <Login />
    </Suspense>
  );
}
