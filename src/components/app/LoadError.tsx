"use client";
import Link from "next/link";
import { isNetworkError } from "@/lib/errors";

// A page that failed to load: the reason, a retry, and optionally a way back.
export function LoadError({
  message,
  onRetry,
  back,
}: {
  message: string;
  onRetry: () => void;
  back?: { href: string; label: string };
}) {
  return (
    <>
      <p className="bad-text" role="alert">
        {isNetworkError(message) ? "Couldn't load this page. Check your connection and try again." : message}
      </p>
      <div className="row">
        <button className="btn primary" onClick={onRetry}>Try again</button>
        {back ? <Link className="btn" href={back.href}>{back.label}</Link> : null}
      </div>
    </>
  );
}
