"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useReadySession } from "@/components/app/Gate";
import { api } from "@/lib/api";
import { browserClient } from "@/lib/supabase/browser";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

export function Account() {
  const s = useReadySession();
  const supabase = browserClient();
  const [providers, setProviders] = useState<string[]>([]);
  const [armed, setArmed] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUserIdentities().then(({ data }) => setProviders((data?.identities ?? []).map((i) => i.provider)));
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
      .then((r) => r.json())
      .then((s) => setGoogleEnabled(!!s?.external?.google))
      .catch(() => setGoogleEnabled(false));
  }, [supabase]);

  async function download() {
    const data = await api.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ccdf-prep-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // A full reload, not router.replace: with cacheComponents, pages visited earlier stay mounted
  // (hidden) and would keep the previous user's data and keep calling the API with their session.
  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace("/");
  }

  async function remove() {
    if (!armed) return setArmed(true);
    try {
      await api.deleteAccount();
      await supabase.auth.signOut({ scope: "local" }); // the user no longer exists on the server
      window.location.replace("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function linkGoogle() {
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/account` },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="page">
      <h1>Account</h1>
      <div className="card" style={{ marginTop: 14 }}>
        {s.isAnonymous ? (
          <>
            <b>You&apos;re using a guest account.</b>
            <p className="muted small">Guest progress is deleted after 30 days without activity. Sign in to keep it.</p>
            <Link className="btn primary" href="/login?next=/account">Save my progress</Link>
          </>
        ) : (
          <>
            <b>Signed in as {s.email}</b>
            <p className="muted small">Sign-in methods: {providers.length ? providers.join(", ") : "email"}</p>
            {googleEnabled && !providers.includes("google") ? <button className="btn" onClick={linkGoogle}>Link Google</button> : null}
          </>
        )}
      </div>

      <h2 className="section">Your data</h2>
      <div className="card">
        <div className="row">
          <button className="btn" onClick={download}>Download my data (JSON)</button>
          <button className="btn" onClick={signOut}>Sign out</button>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className={`btn ${armed ? "danger" : ""}`} onClick={remove}>
            {armed ? "Click again to permanently delete everything" : "Delete my account"}
          </button>
          {armed ? <button className="btn ghost" onClick={() => setArmed(false)}>Cancel</button> : null}
        </div>
        {error ? <p className="bad-text small">{error}</p> : null}
      </div>
    </main>
  );
}
