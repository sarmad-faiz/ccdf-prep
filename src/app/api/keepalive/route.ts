import { connection, NextResponse } from "next/server";
import { publicClient } from "@/lib/supabase/public";

// Called once a day by Vercel Cron (vercel.json). A tiny public read keeps a free-tier
// Supabase project from pausing after a week without activity.
export async function GET() {
  await connection();
  const { data, error } = await publicClient().from("content_releases").select("label").order("id", { ascending: false }).limit(1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, release: data?.[0]?.label ?? null });
}
