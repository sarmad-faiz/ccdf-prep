import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertSupabaseEnv, SUPABASE_KEY, SUPABASE_URL } from "./env";

// Cookie-based client for Server Actions and Route Handlers (acts as the signed-in user).
export async function serverClient() {
  assertSupabaseEnv();
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, options);
      },
    },
  });
}
