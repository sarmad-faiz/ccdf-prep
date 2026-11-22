import type { Metadata, Viewport } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { SITE_URL } from "@/lib/supabase/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CCDF Prep · Unofficial study notes and practice exams for Claude Certified Developer – Foundations",
    template: "%s · CCDF Prep",
  },
  description:
    "Free, unofficial study notes, module quizzes and timed practice exams for the Claude Certified Developer – Foundations (CCDV-F) exam. Community project, not affiliated with Anthropic.",
  openGraph: { type: "website", siteName: "CCDF Prep" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#171614" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
