import { useState, type FormEvent } from "react";
import { api } from "../api";

export default function Login({ joinCode }: { joinCode?: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      // Remember where to come back to (e.g. an invite link) after the magic link.
      try {
        localStorage.setItem("hisaab_next", joinCode ? `/join/${joinCode}` : location.pathname);
      } catch {
        /* ignore */
      }
      const r = await api.requestLink(email, name);
      setSent(true);
      setDevLink(r.dev_link || "");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-hero">
        <div className="logo">₹</div>
        <h1>Hisaab</h1>
        <p className="tagline">Split bills with friends. Type it like a text, everyone approves, settle with any UPI app.</p>
        {joinCode && <p className="chip ok">You've been invited to a group — sign in to join</p>}
      </div>
      {!sent ? (
        <form className="card login-card" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Your name</span>
            <input autoComplete="name" placeholder="So friends recognise you" value={name} onChange={(e) => setName(e.target.value)} />
            <span className="hint">Only needed the first time. We never ask for a password or phone number.</span>
          </label>
          {err && <p className="error-text">{err}</p>}
          <button className="btn primary block" disabled={busy}>
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      ) : (
        <div className="card login-card center">
          <div className="big-emoji">📬</div>
          <h2>Check your inbox</h2>
          <p className="muted">
            We sent a sign-in link to <strong>{email}</strong>. It works once and expires in 15 minutes.
          </p>
          {devLink && (
            <a className="btn primary block" href={devLink.replace(/^https?:\/\/[^/]+/, "")}>
              Dev mode: open the link
            </a>
          )}
          <button className="btn ghost" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </div>
      )}
      <ul className="features">
        <li>✍️ “Paid 2400 for dinner, Rahul didn't eat” — done</li>
        <li>✅ Nothing counts until everyone involved approves</li>
        <li>⚡ Settle up in one tap with GPay, PhonePe or Paytm</li>
        <li>🤖 Works with Claude & other AI assistants (MCP)</li>
      </ul>
    </div>
  );
}
