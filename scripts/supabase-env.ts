// Resolve the Supabase URL and keys for scripts: environment variables first (CI / production),
// otherwise the running local stack (`supabase status`), so local work needs no env file.
import { execFileSync } from "node:child_process";

export type ScriptEnv = { url: string; publishableKey: string; secretKey?: string };

export function supabaseEnv(): ScriptEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (url && publishableKey) return { url, publishableKey, secretKey };

  try {
    const out = execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const s = JSON.parse(out.slice(out.indexOf("{")));
    return { url: s.API_URL, publishableKey: s.PUBLISHABLE_KEY, secretKey: s.SECRET_KEY };
  } catch {
    throw new Error(
      "No Supabase settings: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY, " +
        "or start the local stack with `npm run db:start`.",
    );
  }
}
