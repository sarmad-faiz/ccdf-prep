"use client";
import Link from "next/link";
import { useSession } from "@/lib/useSession";

// Header account link for signed-in users and guests. Read in the browser so public pages stay static.
export function AuthButton() {
  const s = useSession();
  // Visitors without a session see no sign-in button: they're asked when they start practising.
  if (s.status !== "ready") return null;
  return (
    <Link className="btn small" href="/account">
      {s.isAnonymous ? "Guest" : s.email ?? "Account"}
    </Link>
  );
}
