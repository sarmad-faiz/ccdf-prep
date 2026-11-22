import type { MetadataRoute } from "next";
import { getModules } from "@/lib/content/queries";
import { SITE_URL } from "@/lib/supabase/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const modules = await getModules();
  const pages = ["", "/notes", "/notes/recall", "/exam-format", "/about", ...modules.map((m) => `/notes/${m.slug}`)];
  return pages.map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : p.startsWith("/notes") ? 0.8 : 0.5,
  }));
}
