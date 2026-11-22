import Link from "next/link";

export function NoteTabs({ current, modules }: { current: string; modules: { slug: string; label: string }[] }) {
  return (
    <nav className="seg" aria-label="Revision notes" style={{ margin: "0 0 18px" }}>
      {modules.map((m) => (
        <Link key={m.slug} href={`/notes/${m.slug}`} aria-current={m.slug === current ? "page" : undefined}>
          {m.label}
        </Link>
      ))}
      <Link href="/notes/recall" aria-current={current === "recall" ? "page" : undefined}>60-sec recall</Link>
    </nav>
  );
}
