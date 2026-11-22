// Validate content/ and load it into Supabase through public.import_content (service role only).
// Run: npm run content:sync   (CI runs this on every push to main before deploying)
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { buildBundle, ContentError, loadContent } from "../src/lib/content/load.ts";
import { supabaseEnv } from "./supabase-env.ts";

function gitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

let content;
try {
  content = loadContent(new URL("../content/", import.meta.url).pathname);
} catch (e) {
  if (e instanceof ContentError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}

const env = supabaseEnv();
if (!env.secretKey) {
  console.error("SUPABASE_SECRET_KEY is required to import content.");
  process.exit(1);
}
console.log(`Importing content into ${env.url}${/127\.0\.0\.1|localhost/.test(env.url) ? " (local)" : " (HOSTED)"}`);
const supabase = createClient(env.url, env.secretKey, { auth: { persistSession: false } });
const bundle = buildBundle(content, gitSha());
const { data, error } = await supabase.rpc("import_content", { payload: bundle });
if (error) {
  console.error("import_content failed:", error.message);
  process.exit(1);
}
console.log(
  data.changed
    ? `content imported: release ${bundle.release.label} (#${data.release_id}), ${data.questions} questions upserted`
    : `content unchanged (release #${data.release_id})`,
);
