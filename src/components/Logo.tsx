// Brand mark: accent tile with a check, plus the "CCDF Prep" wordmark.
export const SITE_NAME = "CCDF Prep";

export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: "none" }}>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M9 17l5 5 9-11" stroke="var(--accent-ink)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="brand-lockup">
      <LogoMark />
      <span>
        <b>CCDF</b> <span className="brand-light">Prep</span>
      </span>
    </span>
  );
}
