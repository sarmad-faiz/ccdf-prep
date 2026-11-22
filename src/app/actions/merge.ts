"use server";
import { cookies } from "next/headers";
import { serverClient } from "@/lib/supabase/server";

// Guest → existing account. While still the guest, prepareMerge() stores a single-use ticket in an
// httpOnly cookie. After signing in to the existing account, claimMerge() moves the guest's data over.
const COOKIE = "ccdf_merge";

export async function prepareMerge(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await serverClient();
  const { data, error } = await supabase.rpc("create_merge_ticket");
  if (error || typeof data !== "string") return { ok: false, error: error?.message ?? "no ticket" };
  (await cookies()).set(COOKIE, data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });
  return { ok: true };
}

export async function claimMerge(): Promise<{ merged: boolean; reason?: string }> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return { merged: false, reason: "no_ticket" };
  const supabase = await serverClient();
  const { data, error } = await supabase.rpc("claim_merge_ticket", { p_token: token });
  store.delete(COOKIE);
  if (error) return { merged: false, reason: error.message };
  return data as { merged: boolean; reason?: string };
}
