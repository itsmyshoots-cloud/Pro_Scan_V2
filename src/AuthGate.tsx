import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, KeyRound, ShieldCheck, UserPlus, Users } from "lucide-react";
import AppDb from "./AppDb";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

type Mode = "signin" | "setup";

export default function AuthGate() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setReady(true); } });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    supabase.from("app_bootstrap_state").select("available").eq("id", true).maybeSingle().then(({ data: state }) => {
      if (active) setBootstrapAvailable(Boolean(state?.available));
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  if (!ready) return <div className="app-shell"><div className="loading-screen">Loading Production Scan V2…</div></div>;
  if (!isSupabaseConfigured || !supabase) return <div className="app-shell"><div className="loading-screen">Supabase environment variables are missing.</div></div>;
  if (session) return <AppDb />;

  async function signIn() {
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setBusy(true); setError(""); setMessage("");
    const { error: authError } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) setError(authError.message);
    setBusy(false);
  }

  async function setupAdmin() {
    if (!bootstrapAvailable) { setError("Factory Admin setup is already completed. Use Sign in."); setMode("signin"); return; }
    if (!name.trim() || !email.trim() || password.length < 8) { setError("Enter your name, a valid email, and a password of at least 8 characters."); return; }
    setBusy(true); setError(""); setMessage("");
    const { data, error: authError } = await supabase!.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin } });
    if (authError) {
      setError(authError.message);
    } else if (data.session) {
      setMessage("Factory Admin created. Opening the production workspace…");
    } else {
      setMessage("Factory Admin account created. Check the email inbox and confirm the address, then return here and sign in.");
      setMode("signin");
      setBootstrapAvailable(false);
    }
    setBusy(false);
  }

  return (
    <div className="app-shell auth-screen">
      <section className="auth-hero">
        <div className="auth-hero-inner">
          <div className="auth-hero-mark"><ShieldCheck size={26} /></div>
          <div className="auth-hero-kicker">GSONS INDUSTRIES · FACTORY OPERATIONS</div>
          <h2>Production control<br /><strong>built around every scan.</strong></h2>
          <p>Plan production, allocate serials, scan finished products, and track every line and shift from one controlled workspace.</p>
          <div className="auth-feature-list">
            <span><CheckCircle2 size={16} /> Serial-level production tracking</span>
            <span><CheckCircle2 size={16} /> Line, shift & manpower control</span>
            <span><CheckCircle2 size={16} /> Duplicate & invalid scan protection</span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="brand-mark"><Users size={22} /></div>
          <div className="auth-kicker">PRODUCTION CONTROL</div>
          <h1>{mode === "setup" ? "Create Factory Admin" : "Welcome back"}</h1>
          <p>{mode === "setup" ? "Create the first administrator account for PRO SCAN V2." : "Sign in to the factory production database."}</p>
          {mode === "setup" && <label className="auth-field"><span>Full name</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Factory administrator" autoComplete="name" /></label>}
          <label className="auth-field"><span>Email address</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@company.com" autoComplete="email" /></label>
          <label className="auth-field"><span>Password</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "setup" ? "Minimum 8 characters" : "Your password"} autoComplete={mode === "setup" ? "new-password" : "current-password"} onKeyDown={e => { if (e.key === "Enter") mode === "setup" ? setupAdmin() : signIn(); }} /></label>
          {error && <div className="auth-message auth-error">{error}</div>}
          {message && <div className="auth-message auth-success"><CheckCircle2 size={16} />{message}</div>}
          <button className="button button-primary auth-submit" onClick={mode === "setup" ? setupAdmin : signIn} disabled={busy}>{busy ? "Please wait…" : mode === "setup" ? <>Create Factory Admin <UserPlus size={16} /></> : <>Sign in <ArrowRight size={16} /></>}</button>
          {mode === "signin" && bootstrapAvailable && <button className="auth-secondary" onClick={() => { setMode("setup"); setError(""); setMessage(""); }}><UserPlus size={15} /> First-time Factory Admin setup</button>}
          {mode === "setup" && <button className="auth-secondary" onClick={() => { setMode("signin"); setError(""); setMessage(""); }}><KeyRound size={15} /> I already have an account</button>}
          <div className="auth-security"><ShieldCheck size={14} /><span>Protected by Supabase Auth and database row-level security.</span></div>
        </div>
      </section>
    </div>
  );
}
