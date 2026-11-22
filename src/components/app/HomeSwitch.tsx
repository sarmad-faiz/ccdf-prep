"use client";
import type { ReactNode } from "react";
import { Dashboard } from "@/components/app/Dashboard";
import { SessionProvider } from "@/components/app/Gate";
import { useSession } from "@/lib/useSession";

// Home page: the public landing page (static, what crawlers see) until the visitor has a session.
// Guests and signed-in users get their dashboard here instead.
export function HomeSwitch({ children }: { children: ReactNode }) {
  const s = useSession();
  if (s.status !== "ready") return <>{children}</>;
  return (
    <SessionProvider session={s}>
      <Dashboard />
    </SessionProvider>
  );
}
