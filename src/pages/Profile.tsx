import { useState } from "react";
import { api, API_URL, setToken } from "../api";
import { timeAgo, useAction, useApp, useLoad } from "../lib";
import { Avatar, Sheet, TopBar } from "../components/ui";

export default function Profile() {
  const { me, setMe, toast } = useApp();
  const [name, setName] = useState(me.name);
  const [upi, setUpi] = useState(me.upi_id || "");
  const tokens = useLoad(() => api.tokens(), []);
  const [newToken, setNewToken] = useState("");
  const [tokenName, setTokenName] = useState("Claude");
  const { busy, run } = useAction();

  const dirty = name !== me.name || upi !== (me.upi_id || "");
  const mcpURL = API_URL + "/mcp";

  async function save() {
    const u = await run(() => api.updateMe({ name, upi_id: upi }), "Profile saved");
    if (u) setMe(u);
  }

  async function createToken() {
    const r = await run(() => api.createToken(tokenName));
    if (r) {
      setNewToken(r.token);
      tokens.reload();
    }
  }

  const copy = (s: string) =>
    navigator.clipboard
      .writeText(s)
      .then(() => toast("Copied"))
      .catch(() => prompt("Copy this", s));

  const claudeCode = `claude mcp add --transport http hisaab ${mcpURL} --header "Authorization: Bearer ${newToken || "YOUR_TOKEN"}"`;
  const jsonConfig = JSON.stringify(
    { mcpServers: { hisaab: { type: "http", url: mcpURL, headers: { Authorization: `Bearer ${newToken || "YOUR_TOKEN"}` } } } },
    null,
    2
  );

  return (
    <div className="page">
      <TopBar title="Profile" />
      <div className="stack">
        <div className="card profile-head">
          <Avatar id={me.id} name={me.name} size={56} />
          <div>
            <h2>{me.name}</h2>
            <div className="muted">{me.email}</div>
          </div>
        </div>

        <div className="card">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </label>
          <label className="field">
            <span>UPI ID</span>
            <input value={upi} onChange={(e) => setUpi(e.target.value.trim())} placeholder="yourname@okhdfcbank" autoCapitalize="none" />
            <span className="hint">Friends who owe you get a one-tap “Pay via UPI” button. Only shown to people in your groups when they owe you.</span>
          </label>
          <button className="btn primary" disabled={!dirty || busy} onClick={save}>
            Save
          </button>
        </div>

        <div className="card">
          <h3>🤖 AI assistants (MCP)</h3>
          <p className="muted small">
            Let Claude, Cursor or any MCP client read your balances and draft expenses. Anything an assistant adds still needs your approval here.
          </p>
          <ul className="list compact">
            {(tokens.data || []).map((t) => (
              <li key={t.id} className="row">
                <span className="row-main">
                  <strong>{t.name}</strong>
                  <span className="muted small">created {timeAgo(t.created_at)} · last used {timeAgo(t.last_used_at)}</span>
                </span>
                <button className="btn ghost small" onClick={() => confirm("Revoke this token?") && run(() => api.revokeToken(t.id).then(() => true), "Revoked").then(() => tokens.reload())}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
          <div className="row">
            <input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="Token name" />
            <button className="btn small" disabled={busy} onClick={createToken}>
              Create token
            </button>
          </div>
        </div>

        <button
          className="btn ghost block"
          onClick={async () => {
            await api.logout().catch(() => {});
            setToken(null);
            location.href = "/";
          }}
        >
          Sign out
        </button>
        <p className="muted small center">
          Hisaab is free and open source. <a href="https://github.com/belikeamitesh">GitHub</a>
        </p>
      </div>

      <Sheet open={!!newToken} onClose={() => setNewToken("")} title="Your assistant token">
        <div className="stack">
          <p className="hint">Copy it now — it won't be shown again.</p>
          <code className="code" onClick={() => copy(newToken)}>
            {newToken}
          </code>
          <h3>Claude Code</h3>
          <pre className="code" onClick={() => copy(claudeCode)}>
            {claudeCode}
          </pre>
          <h3>Cursor / Claude Desktop / other clients (JSON)</h3>
          <pre className="code" onClick={() => copy(jsonConfig)}>
            {jsonConfig}
          </pre>
          <p className="hint">Then ask: “What do I owe in Goa trip?” or “Add 1200 for cab split with Rahul to Flat 302”.</p>
          <button className="btn primary block" onClick={() => setNewToken("")}>
            Done
          </button>
        </div>
      </Sheet>
    </div>
  );
}
