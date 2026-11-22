import type { Metadata } from "next";

// Per-user pages: never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: LayoutProps<"/">) {
  return children;
}
