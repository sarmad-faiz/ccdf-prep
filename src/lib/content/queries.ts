import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicClient } from "@/lib/supabase/public";

// Public content, cached. Content changes when a new release is imported (npm run deploy:db) and the site rebuilds.

export type ModuleRow = { id: string; slug: string; position: number; title: string; minutes: number; lead_md: string; question_count: number };
export type TopicRow = { id: string; module_id: string; slug: string; title: string; position: number; body_md: string };
export type DomainRow = { id: string; name: string; weight: number; item_count: number; position: number };
export type Blueprint = {
  id: string; title: string; guide: string; effective_from: string | null; items: number; minutes: number; pass_score: number;
  domains: DomainRow[]; sets: { id: string; name: string; position: number }[];
};
export type RecallPage = { slug: string; title: string; lead_md: string; sections: { slug: string; title: string; body_md: string }[] };

function fail(what: string, message?: string): never {
  throw new Error(`Could not load ${what}: ${message ?? "no data"}. Is Supabase running and content synced?`);
}

export async function getModules(): Promise<ModuleRow[]> {
  "use cache";
  cacheLife("days");
  cacheTag("content");
  const { data, error } = await publicClient().from("modules").select("*").order("position");
  if (error || !data) fail("modules", error?.message);
  return data;
}

export async function getModuleWithTopics(slug: string): Promise<{ module: ModuleRow; topics: TopicRow[] } | null> {
  "use cache";
  cacheLife("days");
  cacheTag("content");
  const db = publicClient();
  const { data: mod, error } = await db.from("modules").select("*").eq("slug", slug).maybeSingle();
  if (error) fail(`module ${slug}`, error.message);
  if (!mod) return null;
  const { data: topics, error: tErr } = await db
    .from("topics")
    .select("id, module_id, slug, title, position, body_md")
    .eq("module_id", mod.id)
    .order("position");
  if (tErr || !topics) fail(`topics for ${slug}`, tErr?.message);
  return { module: mod, topics };
}

export async function getRecall(): Promise<RecallPage> {
  "use cache";
  cacheLife("days");
  cacheTag("content");
  const { data, error } = await publicClient().from("pages").select("*").eq("slug", "recall").maybeSingle();
  if (error || !data) fail("recall page", error?.message);
  return data;
}

export async function getBlueprint(): Promise<Blueprint> {
  "use cache";
  cacheLife("days");
  cacheTag("content");
  const db = publicClient();
  const { data: bp, error } = await db.from("blueprints").select("*").eq("active", true).maybeSingle();
  if (error || !bp) fail("exam blueprint", error?.message);
  const [{ data: domains }, { data: sets }] = await Promise.all([
    db.from("domains").select("id, name, weight, item_count, position").eq("blueprint_id", bp.id).order("position"),
    db.from("exam_sets").select("id, name, position").eq("blueprint_id", bp.id).order("position"),
  ]);
  return { ...bp, domains: domains ?? [], sets: sets ?? [] };
}

export async function getRelease(): Promise<{ label: string; git_sha: string | null; imported_at: string } | null> {
  "use cache";
  cacheLife("days");
  cacheTag("content");
  const { data } = await publicClient()
    .from("content_releases")
    .select("label, git_sha, imported_at")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
