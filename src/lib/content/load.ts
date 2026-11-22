// Reads content/ from disk, validates it, and builds the payload for public.import_content.
// Used by scripts and tests only (Node), never by the Next.js app at runtime.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  blueprintSchema,
  examQuestionSchema,
  manifestSchema,
  moduleQuestionSchema,
  moduleSchema,
  setSchema,
  type Blueprint,
  type ExamQuestion,
  type ExamSet,
  type Manifest,
  type Module,
  type ModuleQuestion,
} from "./schema.ts";
import { splitNotes } from "./notes.ts";

export type ContentSource = {
  manifest: Manifest;
  modules: Module[];
  notes: Record<string, string>; // m1..m5, recall
  moduleQuestions: Record<string, ModuleQuestion[]>; // by module id
  blueprint: Blueprint;
  examQuestions: Record<string, ExamQuestion[]>; // by domain id
  sets: ExamSet[];
};

export class ContentError extends Error {
  problems: string[];
  constructor(problems: string[]) {
    super(`Content has ${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
    this.problems = problems;
  }
}

function readJson<T>(dir: string, rel: string, schema: z.ZodType<T>, problems: string[]): T | undefined {
  const path = join(dir, rel);
  if (!existsSync(path)) {
    problems.push(`${rel}: file is missing`);
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    problems.push(`${rel}: invalid JSON (${(e as Error).message})`);
    return undefined;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) problems.push(`${rel}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    return undefined;
  }
  return parsed.data;
}

export function loadContent(dir: string): ContentSource {
  const problems: string[] = [];
  const manifest = readJson(dir, "manifest.json", manifestSchema, problems);
  const modules = readJson(dir, "modules.json", z.array(moduleSchema).min(1), problems) ?? [];
  const blueprint = readJson(dir, "exam/blueprint.json", blueprintSchema, problems);
  const sets = readJson(dir, "exam/sets.json", z.array(setSchema), problems) ?? [];

  const notes: Record<string, string> = {};
  for (const name of [...modules.map((m) => m.id), "recall"]) {
    const path = join(dir, "notes", `${name}.md`);
    if (existsSync(path)) notes[name] = readFileSync(path, "utf8");
    else problems.push(`notes/${name}.md: file is missing`);
  }

  const moduleQuestions: Record<string, ModuleQuestion[]> = {};
  for (const m of modules) {
    moduleQuestions[m.id] = readJson(dir, `questions/${m.id}.json`, z.array(moduleQuestionSchema), problems) ?? [];
  }

  const examQuestions: Record<string, ExamQuestion[]> = {};
  for (const d of blueprint?.domains ?? []) {
    examQuestions[d.id] = readJson(dir, `exam/questions/${d.id}.json`, z.array(examQuestionSchema), problems) ?? [];
  }
  const extra = existsSync(join(dir, "exam/questions"))
    ? readdirSync(join(dir, "exam/questions")).filter((f) => !(f.replace(/\.json$/, "") in examQuestions))
    : [];
  for (const f of extra) problems.push(`exam/questions/${f}: no matching domain in blueprint.json`);

  if (problems.length || !manifest || !blueprint) throw new ContentError(problems);
  const source = { manifest, modules, notes, moduleQuestions, blueprint, examQuestions, sets };
  const crossProblems = validateContent(source);
  if (crossProblems.length) throw new ContentError(crossProblems);
  return source;
}

const answers = (q: { answer: string | string[] }) => (Array.isArray(q.answer) ? q.answer : [q.answer]);

/** Rules that span files. Returns a list of human-readable problems (empty when valid). */
export function validateContent(c: ContentSource): string[] {
  const p: string[] = [];
  const seen = new Map<string, string>();
  const retired = new Set(c.manifest.retiredIds);
  const all: { file: string; q: ModuleQuestion | ExamQuestion }[] = [
    ...Object.entries(c.moduleQuestions).flatMap(([m, qs]) => qs.map((q) => ({ file: `questions/${m}.json`, q }))),
    ...Object.entries(c.examQuestions).flatMap(([d, qs]) => qs.map((q) => ({ file: `exam/questions/${d}.json`, q }))),
  ];

  for (const { file, q } of all) {
    const where = `${file} ${q.id}`;
    if (seen.has(q.id)) p.push(`${where}: duplicate id (also in ${seen.get(q.id)})`);
    seen.set(q.id, file);
    if (retired.has(q.id)) p.push(`${where}: id is retired in manifest.json and can't be reused`);
    const ids = q.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) p.push(`${where}: option ids must be unique`);
    const expectedIds = "abcde".slice(0, ids.length).split("");
    if (ids.join() !== expectedIds.join()) p.push(`${where}: option ids must be ${expectedIds.join(", ")} in order`);
    const ans = answers(q);
    for (const a of ans) if (!ids.includes(a)) p.push(`${where}: answer "${a}" is not one of the options`);
    if (new Set(ans).size !== ans.length) p.push(`${where}: duplicate answers`);
    if (Array.isArray(q.answer)) {
      if (q.options.length !== 5) p.push(`${where}: "choose N" items need 5 options`);
      const words = ["", "", "two", "three"];
      if (!q.q.includes(`(Choose ${words[ans.length]}.)`)) p.push(`${where}: stem must say "(Choose ${words[ans.length]}.)"`);
    } else if (q.options.length !== 4) {
      p.push(`${where}: single-answer items need 4 options`);
    }
    for (const text of [q.q, q.explain, ...q.options.map((o) => o.text)]) {
      if (/<\/?[a-z][^>]*>/i.test(text.replace(/`[^`]*`/g, ""))) p.push(`${where}: HTML is not allowed (use backticks for code)`);
    }
  }

  // Every module question's topic is a "## " heading in that module's notes, and every heading has questions.
  for (const m of c.modules) {
    const headings = new Set(splitNotes(c.notes[m.id] ?? "").sections.map((s) => s.title));
    const topics = new Set((c.moduleQuestions[m.id] ?? []).map((q) => q.topic));
    for (const t of topics) if (!headings.has(t)) p.push(`questions/${m.id}.json: topic "${t}" has no "## ${t}" heading in notes/${m.id}.md`);
    for (const h of headings) if (!topics.has(h)) p.push(`notes/${m.id}.md: heading "## ${h}" has no questions in questions/${m.id}.json`);
  }
  for (const [name, md] of Object.entries(c.notes)) {
    if (/<\/?[a-z][^>]*>/i.test(md.replace(/`[^`]*`/g, ""))) p.push(`notes/${name}.md: HTML is not allowed`);
  }

  // Blueprint and sets
  const bp = c.blueprint;
  if (c.manifest.blueprint !== bp.id) p.push(`manifest.json: blueprint "${c.manifest.blueprint}" doesn't match exam/blueprint.json id "${bp.id}"`);
  const weight = bp.domains.reduce((s, d) => s + d.weight, 0);
  if (Math.abs(weight - 100) > 0.5) p.push(`exam/blueprint.json: domain weights add up to ${weight.toFixed(1)}, not 100`);
  const countSum = bp.domains.reduce((s, d) => s + d.count, 0);
  if (countSum !== bp.items) p.push(`exam/blueprint.json: domain counts add up to ${countSum}, not ${bp.items}`);
  const domainIds = new Set(bp.domains.map((d) => d.id));
  const topicKeys = new Set(Object.entries(c.moduleQuestions).flatMap(([m, qs]) => qs.map((q) => `${m}|${q.topic}`)));
  for (const [key, d] of Object.entries(bp.topicDomains)) {
    if (!topicKeys.has(key)) p.push(`exam/blueprint.json: topicDomains "${key}" is not a module topic`);
    if (!domainIds.has(d)) p.push(`exam/blueprint.json: topicDomains "${key}" points at unknown domain "${d}"`);
  }

  const examDomain = new Map<string, string>();
  for (const [d, qs] of Object.entries(c.examQuestions)) for (const q of qs) examDomain.set(q.id, d);
  const used = new Map<string, string>();
  for (const s of c.sets) {
    if (s.items.length !== bp.items) p.push(`exam/sets.json: set ${s.id} has ${s.items.length} items, needs ${bp.items}`);
    const counts: Record<string, number> = {};
    for (const qid of s.items) {
      const d = examDomain.get(qid);
      if (!d) p.push(`exam/sets.json: set ${s.id} lists "${qid}", which is not an exam question`);
      else counts[d] = (counts[d] ?? 0) + 1;
      if (used.has(qid)) p.push(`exam/sets.json: "${qid}" is in both set ${used.get(qid)} and set ${s.id}`);
      used.set(qid, s.id);
    }
    for (const d of bp.domains) {
      if ((counts[d.id] ?? 0) !== d.count) p.push(`exam/sets.json: set ${s.id} has ${counts[d.id] ?? 0} ${d.id} items, needs ${d.count}`);
    }
  }
  return p;
}

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** The payload accepted by public.import_content (see supabase/migrations/*_import_content.sql). */
export function buildBundle(c: ContentSource, gitSha?: string) {
  const topics = c.modules.flatMap((m) =>
    splitNotes(c.notes[m.id]).sections.map((s, i) => ({
      id: `${m.id}.${s.slug}`,
      module_id: m.id,
      slug: s.slug,
      title: s.title,
      position: i,
      body_md: s.body,
      domain_id: c.blueprint.topicDomains[`${m.id}|${s.title}`] ?? null,
    })),
  );
  const topicId = new Map(topics.map((t) => [`${t.module_id}|${t.title}`, t.id]));

  const question = <X extends Record<string, unknown>>(q: ModuleQuestion | ExamQuestion, extra: X) => ({
    id: q.id,
    stem: q.q,
    options: q.options,
    select_count: answers(q).length,
    answer: answers(q),
    explanation: q.explain,
    content_hash: sha({ q: q.q, options: q.options, answer: q.answer, explain: q.explain }),
    ...extra,
  });

  const questions = [
    ...Object.entries(c.moduleQuestions).flatMap(([m, qs]) =>
      qs.map((q) =>
        question(q, {
          kind: "module",
          module_id: m,
          topic_id: topicId.get(`${m}|${q.topic}`),
          domain_id: c.blueprint.topicDomains[`${m}|${q.topic}`] ?? null,
          objective: null,
        }),
      ),
    ),
    ...Object.entries(c.examQuestions).flatMap(([d, qs]) =>
      qs.map((q) => question(q, { kind: "exam", module_id: null, topic_id: null, domain_id: d, objective: q.objective })),
    ),
  ];

  const recall = splitNotes(c.notes.recall);
  const payloadWithoutRelease = {
    modules: c.modules.map((m, i) => ({ ...m, position: i, lead_md: splitNotes(c.notes[m.id]).lead })),
    topics,
    pages: [
      {
        slug: "recall",
        title: "Final 60-second recall",
        lead_md: recall.lead,
        sections: recall.sections.map((s) => ({ slug: s.slug, title: s.title, body_md: s.body })),
      },
    ],
    blueprint: {
      id: c.blueprint.id,
      title: c.blueprint.title,
      guide: c.blueprint.guide,
      effective_from: c.blueprint.effectiveFrom,
      items: c.blueprint.items,
      minutes: c.blueprint.minutes,
      pass_score: c.blueprint.pass,
    },
    domains: c.blueprint.domains.map((d, i) => ({ id: d.id, name: d.name, weight: d.weight, item_count: d.count, position: i })),
    questions,
    sets: c.sets.map((s, i) => ({ id: s.id, name: s.name, position: i, items: s.items })),
  };
  return {
    release: { label: c.manifest.label, git_sha: gitSha ?? "", content_hash: sha(payloadWithoutRelease) },
    ...payloadWithoutRelease,
  };
}
