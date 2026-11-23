// User-facing text for failed saves. Network failures (offline, dropped connection) surface as a
// browser-specific fetch error, which means nothing to a reader, so they get a plain message.

export function isNetworkError(message: string): boolean {
  return /failed to fetch|networkerror|load failed/i.test(message);
}

export function saveErrorText(e: unknown, what = "save"): string {
  const message = e instanceof Error ? e.message : String(e);
  if (isNetworkError(message)) return `Couldn't ${what}. Check your connection and try again.`;
  return `Couldn't ${what}: ${message.replace(/\.$/, "")}. Try again.`;
}
