"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Main navigation with the current section highlighted. On phones the labels shorten so all
// four fit on one row.
const LINKS = [
  { href: "/notes", label: "Notes", short: "Notes", match: (p: string) => p.startsWith("/notes") },
  { href: "/dashboard", label: "Practice", short: "Practice", match: (p: string) => p.startsWith("/dashboard") || p.startsWith("/quiz") },
  { href: "/exam", label: "Exams", short: "Exams", match: (p: string) => p === "/exam" || p.startsWith("/exam/") },
  { href: "/exam-format", label: "Exam format", short: "Format", match: (p: string) => p.startsWith("/exam-format") },
];

export function NavLinks() {
  const path = usePathname() ?? "/";
  return (
    <nav aria-label="Main" className="site-nav">
      {LINKS.map((l) => {
        const active = l.match(path);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={active ? "active" : undefined}>
            <span className="nav-full">{l.label}</span>
            <span className="nav-short" aria-hidden="true">{l.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
