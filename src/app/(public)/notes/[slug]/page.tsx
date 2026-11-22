import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { NoteTabs } from "@/components/notes/NoteTabs";
import { TopicMisses, TopicProgressProvider, TopicStatus } from "@/components/notes/TopicProgress";
import { getModules, getModuleWithTopics } from "@/lib/content/queries";

// Every module slug is prerendered at build time, so this route may block on unknown slugs (404s).
export const instant = false;

export async function generateStaticParams() {
  const modules = await getModules();
  return modules.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: PageProps<"/notes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getModuleWithTopics(slug);
  if (!data) return {};
  const { module: m, topics } = data;
  return {
    title: `${m.title}: revision notes`,
    description: `Short revision notes on ${topics.map((t) => t.title).join(", ")} for the Claude Certified Developer – Foundations exam (unofficial).`,
    alternates: { canonical: `/notes/${m.slug}` },
    openGraph: { title: `${m.title} · CCDF Prep notes`, type: "article" },
  };
}

export default async function ModuleNotes({ params }: PageProps<"/notes/[slug]">) {
  const { slug } = await params;
  const [data, modules] = await Promise.all([getModuleWithTopics(slug), getModules()]);
  if (!data) notFound();
  const { module: m, topics } = data;
  const index = modules.findIndex((x) => x.id === m.id);
  const prev = modules[index - 1];
  const next = modules[index + 1];

  return (
    <main className="page">
      <NoteTabs current={m.slug} modules={modules.map((x, i) => ({ slug: x.slug, label: `M${i + 1}` }))} />
      <header>
        <div className="eyebrow">Module {index + 1}</div>
        <h1 style={{ margin: "2px 0 6px" }}>{m.title}</h1>
        {m.lead_md ? <div className="muted"><Markdown>{m.lead_md}</Markdown></div> : null}
      </header>
      <TopicProgressProvider moduleId={m.id} slug={m.slug}>
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {topics.map((t) => (
            <section key={t.id} id={t.slug} className="card notes-sec">
              <div className="row between" style={{ alignItems: "baseline", marginBottom: 4 }}>
                <h2 style={{ fontSize: 17, fontWeight: 650, margin: 0 }}>
                  <a href={`#${t.slug}`} style={{ textDecoration: "none" }}>{t.title}</a>
                </h2>
                <TopicStatus slug={t.slug} />
              </div>
              <Markdown>{t.body_md}</Markdown>
              <TopicMisses slug={t.slug} />
            </section>
          ))}
        </div>
      </TopicProgressProvider>
      <div className="row between" style={{ marginTop: 18 }}>
        {prev ? <Link className="btn" href={`/notes/${prev.slug}`}>← M{index}</Link> : <span />}
        <div className="row">
          <Link className="btn primary" href={`/quiz/start?scope=module:${m.id}`}>Quiz this module ({m.question_count})</Link>
          {next ? (
            <Link className="btn" href={`/notes/${next.slug}`}>M{index + 2} →</Link>
          ) : (
            <Link className="btn" href="/notes/recall">60-sec recall →</Link>
          )}
        </div>
      </div>
    </main>
  );
}
