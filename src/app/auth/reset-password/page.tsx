"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(!supabaseBrowser);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (supabaseBrowser) {
      void supabaseBrowser.auth.getSession()
        .then(({ data }) => setValidSession(Boolean(data.session)))
        .catch(() => setValidSession(false))
        .finally(() => setSessionChecked(true));
    }
  }, []);

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser) return;
    setBusy(true); setError("");
    try {
      const { error: updateError } = await supabaseBrowser.auth.updateUser({ password });
      if (updateError) { setError(updateError.message); return; }
      await supabaseBrowser.auth.signOut();
      router.replace("/");
    } catch { setError("The account provider could not be reached. Try again."); }
    finally { setBusy(false); }
  }

  return <main className="reset-page"><form className="surface-panel reset-panel" onSubmit={(event) => void updatePassword(event)}><div className="brand-mark reset-mark"><Sparkles size={19} /></div><h1>Choose a new password</h1>{!sessionChecked ? <p>Checking your secure reset link…</p> : !supabaseBrowser ? <p>Supabase is not configured for this workspace.</p> : !validSession ? <p>This reset link is invalid or expired. Request a new one from the sign-in screen.</p> : <><p>{error || "Use at least eight characters. You’ll sign in again with the new password."}</p><label><span className="form-label">New password</span><input className="text-input" type="password" minLength={8} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="primary-button" style={{ width: "100%", marginTop: 14 }} disabled={busy || !password}>{busy && <LoaderCircle className="spin" size={14} />}Update password</button></>}</form></main>;
}