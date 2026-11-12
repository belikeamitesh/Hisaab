import { useState, type FormEvent } from "react";
import { api } from "../api";
import { navigate, useAction } from "../lib";
import { TopBar } from "../components/ui";

export default function AddFriend() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const { busy, run } = useAction();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const g = await run(() => api.addFriend(email, name));
    if (g) navigate(`/g/${g.id}`, true);
  }
  return (
    <div className="page">
      <TopBar title="Add a friend" back="/" />
      <form className="stack" onSubmit={submit}>
        <p className="muted">Keep a 1:1 tab with someone — no group needed. They'll get an email to join.</p>
        <label className="field">
          <span>Their email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Their name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
        </label>
        <button className="btn primary block" disabled={busy}>
          Add friend
        </button>
      </form>
    </div>
  );
}
