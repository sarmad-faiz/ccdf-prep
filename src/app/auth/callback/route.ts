import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/lib/supabase/server";

const safeNext = (value: string | null) => (value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard");

// OAuth (Google) return URL: sign-in, identity linking, and finishing a guest merge.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const errorCode = url.searchParams.get("error_code");

  if (errorCode === "identity_already_exists") {
    // The Google account belongs to an existing user: sign in to it and merge the guest's progress.
    return NextResponse.redirect(new URL(`/login?google_merge=1&next=${encodeURIComponent(next)}`, url.origin));
  }
  if (url.searchParams.get("error")) {
    const msg = url.searchParams.get("error_description") ?? "Sign-in failed";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}`, url.origin));
  }

  const supabase = await serverClient();
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
    }
  }

  const ticket = request.cookies.get("ccdf_merge")?.value;
  const response = NextResponse.redirect(new URL(next, url.origin));
  if (ticket) {
    const { data } = await supabase.auth.getUser();
    if (data.user && !data.user.is_anonymous) {
      await supabase.rpc("claim_merge_ticket", { p_token: ticket });
      response.cookies.delete("ccdf_merge");
    }
  }
  return response;
}
