import { useState } from "react";
import { api } from "../api";
import { navigate, useAction, useApp, useLoad } from "../lib";
import { Avatar, ErrorBox, Spinner, Toggle, TopBar } from "../components/ui";

export default function GroupSettings({ groupId }: { groupId: string }) {
  const { me, toast } = useApp();
  const { data, error, reload, setData } = useLoad(() => api.group(groupId), [groupId]);
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const { busy, run } = useAction();

  if (error) return <ErrorBox msg={error} retry={reload} />;
  if (!data) return <Spinner />;
  const g = data.group;
  const admin = data.my_role === "admin";
  const inviteURL = `${location.origin}/join/${g.invite_code}`;

  async function patch(p: Parameters<typeof api.updateGroup>[1], msg = "Saved") {
    const r = await run(() => api.updateGroup(groupId, p), msg);
    if (r) setData({ ...data!, group: r });
  }

  async function share() {
    const text = `Join "${g.name}" on Hisaab to split expenses: ${inviteURL}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Hisaab", text, url: inviteURL });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(inviteURL);
      toast("Invite link copied");
    } catch {
      prompt("Copy this link", inviteURL);
    }
  }

  return (
    <div className="page">
      <TopBar title="Settings" back={`/g/${groupId}`} />
      <div className="stack">
        {g.kind === "group" && (
          <div className="card">
            <label className="field">
              <span>Group name</span>
              <div className="row">
                <input value={name ?? g.name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                {name !== null && name !== g.name && (
                  <button className="btn small primary" disabled={busy} onClick={() => patch({ name: name! }).then(() => setName(null))}>
                    Save
                  </button>
                )}
              </div>
            </label>
          </div>
        )}
        <div className="card">
          <Toggle checked={g.require_approval} onChange={(v) => patch({ require_approval: v })} label="Everyone approves expenses" hint="Expenses count only after everyone in them approves." />
          {g.require_approval && (
            <label className="field">
              <span>Auto-approve after silence</span>
              <select value={g.auto_approve_hours} onChange={(e) => patch({ auto_approve_hours: Number(e.target.value) })}>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>3 days</option>
                <option value={168}>7 days</option>
                <option value={0}>Never</option>
              </select>
            </label>
          )}
          {g.kind === "group" && <Toggle checked={g.simplify_debts} onChange={(v) => patch({ simplify_debts: v })} label="Simplify debts" hint="Fewest possible payments across the group." />}
        </div>

        {g.kind === "group" && (
          <div className="card">
            <div className="row-between">
              <h3>People ({data.members.length})</h3>
              <button className="btn small primary" onClick={share}>
                Share invite link
              </button>
            </div>
            <ul className="list compact">
              {data.members.map((m) => (
                <li key={m.id} className="row">
                  <Avatar id={m.id} name={m.name} size={32} />
                  <span className="row-main">
                    <span>
                      {m.name} {m.id === me.id && "(you)"} {m.role === "admin" && <span className="chip">admin</span>}
                    </span>
                    <span className="muted small">
                      {m.email}
                      {!m.claimed && " · hasn't joined yet"}
                    </span>
                  </span>
                  {admin && m.id !== me.id && (
                    <button
                      className="icon-btn"
                      aria-label={`Remove ${m.name}`}
                      onClick={() => confirm(`Remove ${m.name}?`) && run(() => api.removeMember(groupId, m.id).then(() => true), "Removed").then((r) => r && reload())}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <form
              className="row"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await run(() => api.addMembers(groupId, [{ email }]), "Added — they'll get an email");
                if (r) {
                  setEmail("");
                  setData(r);
                }
              }}
            >
              <input type="email" required placeholder="Add by email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn small" disabled={busy}>
                Add
              </button>
            </form>
            {admin && (
              <button className="btn ghost small" onClick={() => run(() => api.resetInvite(groupId), "New invite link created; the old one stopped working").then((r) => r && setData({ ...data, group: r }))}>
                Reset invite link
              </button>
            )}
          </div>
        )}

        <div className="card danger-zone">
          {g.kind === "group" && (
            <button
              className="btn danger ghost block"
              disabled={busy}
              onClick={async () => {
                if (!confirm("Leave this group? You need a zero balance first.")) return;
                const r = await run(() => api.removeMember(groupId, me.id).then(() => true), "You left the group");
                if (r) navigate("/", true);
              }}
            >
              Leave group
            </button>
          )}
          {admin && g.kind === "group" && (
            <button className="btn ghost block" disabled={busy} onClick={() => patch({ archived: !g.archived_at }, g.archived_at ? "Group restored" : "Group archived")}>
              {g.archived_at ? "Restore group" : "Archive group"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
