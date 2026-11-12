import { useState, type FormEvent } from "react";
import { api } from "../api";
import { navigate, useAction } from "../lib";
import { Toggle, TopBar } from "../components/ui";

export default function NewGroup() {
  const [name, setName] = useState("");
  const [rows, setRows] = useState([{ email: "", name: "" }]);
  const [approval, setApproval] = useState(true);
  const [simplify, setSimplify] = useState(true);
  const { busy, run } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const members = rows.filter((r) => r.email.trim());
    const g = await run(() => api.createGroup({ name, members, require_approval: approval, simplify_debts: simplify }), "Group created");
    if (g) navigate(`/g/${g.id}`, true);
  }

  return (
    <div className="page">
      <TopBar title="New group" back="/" />
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Group name</span>
          <input required maxLength={60} placeholder="Flat 302, Goa trip, Office lunch…" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className="card">
          <h3>Add people</h3>
          <p className="hint">They'll get an email. You can also share an invite link later.</p>
          {rows.map((r, i) => (
            <div className="member-row" key={i}>
              <input type="email" placeholder="friend@example.com" value={r.email} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
              <input placeholder="Name (optional)" value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              {rows.length > 1 && (
                <button type="button" className="icon-btn" aria-label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn ghost small" onClick={() => setRows([...rows, { email: "", name: "" }])}>
            + Another person
          </button>
        </div>
        <div className="card">
          <Toggle checked={approval} onChange={setApproval} label="Everyone approves expenses" hint="An expense only counts once everyone in it taps approve. Auto-approves after 48h of silence." />
          <Toggle checked={simplify} onChange={setSimplify} label="Simplify debts" hint="Fewer payments: if A owes B and B owes C, A pays C directly." />
        </div>
        <button className="btn primary block" disabled={busy}>
          {busy ? "Creating…" : "Create group"}
        </button>
      </form>
    </div>
  );
}
