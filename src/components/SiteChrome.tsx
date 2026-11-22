import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/components/AuthButton";
import { Logo, SITE_NAME } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { getRelease } from "@/lib/content/queries";

export const REPO_URL = "https://github.com/sarmad-faiz/ccdf-prep";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="inner">
        <Link href="/" className="brand" aria-label={`${SITE_NAME} home`}><Logo /></Link>
        <NavLinks />
        <div className="site-account"><AuthButton /></div>
      </div>
    </header>
  );
}

async function Release() {
  const r = await getRelease();
  if (!r) return null;
  return (
    <span>
      Content {r.label}
      {r.git_sha ? ` · ${r.git_sha}` : ""} · updated {new Date(r.imported_at).toISOString().slice(0, 10)}
    </span>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="inner">
        <span>
          <b>Unofficial.</b> {SITE_NAME} is a community study tool for the Claude Certified Developer – Foundations exam. It is
          not affiliated with, endorsed by, or sponsored by Anthropic. &ldquo;Claude&rdquo; is a trademark of Anthropic.
        </span>
        <span className="row" style={{ gap: 12 }}>
          <Link href="/about">About &amp; credits</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href={REPO_URL}>Source on GitHub</a>
          <Suspense fallback={null}>
            <Release />
          </Suspense>
        </span>
      </div>
    </footer>
  );
}
