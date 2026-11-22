import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildBundle, loadContent, validateContent, type ContentSource } from "./load.ts";
import { slugify, splitNotes } from "./notes.ts";

const CONTENT = fileURLToPath(new URL("../../../content/", import.meta.url));
const fresh = (): ContentSource => structuredClone(loadContent(CONTENT));

describe("content/", () => {
  it("is valid", () => {
    const c = loadContent(CONTENT);
    expect(c.modules.length).toBe(5);
    expect(c.sets.map((s) => s.items.length)).toEqual([53, 53, 53]);
  });

  it("builds a stable bundle whose hash changes with content", () => {
    const a = buildBundle(fresh());
    const b = buildBundle(fresh());
    expect(a.release.content_hash).toBe(b.release.content_hash);
    const changed = fresh();
    changed.moduleQuestions.m1[0].explain += " Updated.";
    expect(buildBundle(changed).release.content_hash).not.toBe(a.release.content_hash);
  });

  it("gives module questions a topic and, when mapped, an exam domain", () => {
    const bundle = buildBundle(fresh());
    const m = bundle.questions.filter((q) => q.kind === "module");
    expect(m.every((q) => q.topic_id)).toBe(true);
    expect(m.filter((q) => !q.domain_id).length).toBeGreaterThan(0); // "Contributing back" is never in exams
  });
});

describe("validateContent catches mistakes", () => {
  it("rejects an answer that isn't an option", () => {
    const c = fresh();
    c.moduleQuestions.m1[0].answer = "z";
    expect(validateContent(c).join("\n")).toMatch(/answer "z" is not one of the options/);
  });

  it("rejects duplicate ids across files", () => {
    const c = fresh();
    c.examQuestions.d1[0].id = c.moduleQuestions.m1[0].id;
    expect(validateContent(c).join("\n")).toMatch(/duplicate id/);
  });

  it("rejects a topic without a notes heading", () => {
    const c = fresh();
    c.moduleQuestions.m2[0].topic = "Not a heading";
    expect(validateContent(c).join("\n")).toMatch(/has no "## Not a heading" heading/);
  });

  it("rejects HTML outside code spans", () => {
    const c = fresh();
    c.moduleQuestions.m1[0].q += " <script>alert(1)</script>";
    expect(validateContent(c).join("\n")).toMatch(/HTML is not allowed/);
  });

  it("rejects a set with the wrong domain mix or overlap", () => {
    const c = fresh();
    c.sets[1].items[0] = c.sets[0].items[0];
    const problems = validateContent(c).join("\n");
    expect(problems).toMatch(/is in both set A and set B/);
  });

  it("requires (Choose two.) on multi-answer stems", () => {
    const c = fresh();
    const multi = Object.values(c.examQuestions).flat().find((q) => Array.isArray(q.answer))!;
    multi.q = multi.q.replace("(Choose two.)", "");
    expect(validateContent(c).join("\n")).toMatch(/must say "\(Choose two\.\)"/);
  });

  it("rejects reusing a retired id", () => {
    const c = fresh();
    c.manifest.retiredIds.push(c.moduleQuestions.m1[0].id);
    expect(validateContent(c).join("\n")).toMatch(/retired/);
  });
});

describe("notes", () => {
  it("slugifies topic titles into stable anchors", () => {
    expect(slugify("Tool use & schemas")).toBe("tool-use-schemas");
    expect(slugify("Module 1 · Foundations")).toBe("module-1-foundations");
  });

  it("splits the lead paragraph from ## sections", () => {
    const n = splitNotes("Lead text.\n\n## First topic\nBody one.\n\n### Sub\nMore.\n\n## Second\nBody two.");
    expect(n.lead).toBe("Lead text.");
    expect(n.sections.map((s) => s.title)).toEqual(["First topic", "Second"]);
    expect(n.sections[0].body).toContain("### Sub");
  });
});
