// Splitting a notes file into its lead paragraph and `## ` sections (one per quiz topic).

export type NoteSection = { slug: string; title: string; body: string };
export type SplitNotes = { lead: string; sections: NoteSection[] };

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitNotes(markdown: string): SplitNotes {
  const [lead, ...parts] = markdown.replace(/\r\n/g, "\n").split(/^## /m);
  const sections = parts.map((part) => {
    const nl = part.indexOf("\n");
    const title = (nl < 0 ? part : part.slice(0, nl)).trim();
    const body = nl < 0 ? "" : part.slice(nl + 1).trim();
    return { slug: slugify(title), title, body };
  });
  return { lead: lead.trim(), sections };
}
