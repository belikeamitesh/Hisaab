import { useState } from "react";
import { api, type Expense, type Users } from "../api";
import { CATEGORY, first, Link, niceDate, rupees, useAction, useApp } from "../lib";
import { StatusChip } from "./ui";

/** My position in an expense: positive = I lent, negative = I borrowed. */
export function myPosition(e: Expense, me: string) {
  const paid = e.payers.filter((p) => p.user_id === me).reduce((s, p) => s + p.amount, 0);
  const share = e.shares.filter((s) => s.user_id === me).reduce((s, x) => s + x.amount, 0);
  return { paid, share, net: paid - share };
}

export function ExpenseCard({ e, users, onChange, showGroupLink }: { e: Expense; users: Users; onChange?: () => void; showGroupLink?: boolean }) {
  const { me, refreshBadges } = useApp();
  const { busy, run } = useAction();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const cat = CATEGORY[e.category] || CATEGORY.other;
  const pos = myPosition(e, me.id);
  const payer = e.payers.length === 1 ? (e.payers[0].user_id === me.id ? "You" : first(users[e.payers[0].user_id]?.name)) : `${e.payers.length} people`;
  const myApproval = e.approvals.find((a) => a.user_id === me.id);
  const needsMe = !e.deleted_at && e.status !== "final" && myApproval?.status === "pending";
  const mine = e.payers.some((p) => p.user_id === me.id);

  const act = async (f: () => Promise<unknown>, msg: string) => {
    const r = await run(f, msg);
    if (r !== undefined) {
      onChange?.();
      refreshBadges();
    }
  };

  return (
    <div className={"expense-card" + (mine ? " mine" : "") + (e.deleted_at ? " deleted" : "")}>
      <Link to={`/e/${e.id}`} className="expense-main">
        <span className="cat-icon" style={{ background: cat.color + "22" }}>
          {cat.emoji}
        </span>
        <span className="expense-text">
          <span className="expense-title">{e.description}</span>
          <span className="muted small">
            {payer} paid {rupees(e.amount)} · {niceDate(e.date)}
            {e.source === "mcp" && " · 🤖 AI draft"}
            {e.source === "plain_words" && " · ✍️"}
            {e.comment_count > 0 && ` · 💬 ${e.comment_count}`}
          </span>
        </span>
        <span className="expense-pos">
          {e.deleted_at ? (
            <span className="muted small">deleted</span>
          ) : pos.net > 0 ? (
            <span className="pos">
              <small>you lent</small>
              {rupees(pos.net)}
            </span>
          ) : pos.net < 0 ? (
            <span className="neg">
              <small>you owe</small>
              {rupees(-pos.net)}
            </span>
          ) : (
            <span className="muted small">not involved</span>
          )}
        </span>
      </Link>
      {(e.status !== "final" || showGroupLink) && !e.deleted_at && (
        <div className="expense-foot">
          <StatusChip status={e.status} />
          {e.status !== "final" && (
            <span className="approvals-mini">
              {e.approvals.map((a) => (
                <span key={a.user_id} className={"appr " + a.status} title={`${users[a.user_id]?.name}: ${a.status}`}>
                  {first(users[a.user_id]?.name).slice(0, 1)}
                </span>
              ))}
            </span>
          )}
          {showGroupLink && (
            <Link to={`/g/${e.group_id}`} className="small link">
              Open group ›
            </Link>
          )}
        </div>
      )}
      {needsMe && !rejecting && (
        <div className="expense-actions">
          <button className="btn ok small" disabled={busy} onClick={() => act(() => api.approve(e.id), "Approved")}>
            ✓ Looks right
          </button>
          <button className="btn ghost small" disabled={busy} onClick={() => setRejecting(true)}>
            ✕ Something's off
          </button>
        </div>
      )}
      {rejecting && (
        <div className="expense-actions">
          <input placeholder="What's wrong? (optional)" value={note} onChange={(ev) => setNote(ev.target.value)} autoFocus />
          <button className="btn danger small" disabled={busy} onClick={() => act(() => api.reject(e.id, note), "Sent to " + first(users[e.created_by]?.name))}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}
