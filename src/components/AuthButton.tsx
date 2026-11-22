"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/useSession";

// Header account area, read in the browser so public pages stay static.
// Logged out: "Sign in" (returning users on a new device need it). Guest: a dot hints progress
// isn't saved to an account yet. Signed in: the email, linking to the account page.
export function AuthButton() {
  const s = useSession();
  const path = usePathname() ?? "/";
  if (s.status === "loading") return <span className="auth-slot" aria-hidden="true" />;
  if (s.status === "none") {
    const next = path.startsWith("/login") ? "/dashboard" : path;
    return (
      <Link className="btn small auth-btn" href={`/login?next=${encodeURIComponent(next)}`}>
        Sign in
      </Link>
    );
  }
  return (
    <Link
      className="btn small auth-btn"
      href="/account"
      title={s.isAnonymous ? "Guest: sign in to keep your progress on any device" : "Your account"}
    >
      {s.isAnonymous ? (
        <>
          Guest <span className="guest-dot" aria-label="progress not saved to an account" />
        </>
      ) : (
        <span className="auth-email">{s.email ?? "Account"}</span>
      )}
    </Link>
  );
}
