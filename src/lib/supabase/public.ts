import "server-only";
import { createClient } from "@supabase/supabase-js";
import { assertSupabaseEnv, SUPABASE_KEY, SUPABASE_URL } from "./env";

// Cookieless client for public content inside `use cache` scopes. It never sees a user session,
// so public pages stay static and never set cookies.
export function publicClient() {
  assertSupabaseEnv();
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
