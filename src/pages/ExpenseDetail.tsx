import { useState, type FormEvent } from "react";
import { api } from "../api";
import { CATEGORY, first, Link, navigate, niceDate, rupees, timeAgo, useAction, useApp, useLoad } from "../lib";
import { Avatar, ErrorBox, Spinner, StatusChip, TopBar } from "../components/ui";
import { myPosition } from "../components/ExpenseCard";

const APPROVAL_LABEL: Record<string, string> = { pending: "waiting", approved: "approved", rejected: "disputed", auto_approved: "auto-approved" };

export default function ExpenseDetail({ expenseId }: { expenseId: string }) {
  const { me, refreshBadges } = useApp();
  const { data, error, reload } = useLoad(() => api.expense(expenseId), [expenseId]);
  const [comment, setComment] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const { busy, run } = useAction();

  if (error) return <ErrorBox msg={error} retry={reload} />;
  if (!data) return <Spinner />;
  const e = data.expense;
  const u = data.users;
  const cat = CATEGORY[e.category] || CATEGORY.other;
  const name = (id: string) => (id === me.id ? "You" : u[id]?.name || "Someone");
  const mine = e.approvals.find((a) => a.user_id === me.id);
  const pos = myPosition(e, me.id);

  const act = async (f: () => Promise<unknown>, msg?: string) => {
    const r = await run(f, msg);
    if (r !== undefined) {
      reload();
      refreshBadges();
    }
  };

  async function addComment(ev: FormEvent) {
    ev.preventDefault();
    if (!comment.trim()) return;
    const r = await run(() => api.comment(e.id, comment));
    if (r) {
      setComment("");
      reload();
    }
  }

  return (
    <div className="page">
      <TopBar
        title="Expense"
        back={`/g/${e.group_id}`}
        right={
          !e.deleted_at && (
            <Link to={`/e/${e.id}/edit`} className="btn small">
              Edit
            </Link>
          )
        }
      />
      <div className="detail-head">
        <span className="cat-icon big" style={{ background: cat.color + "22" }}>
          {cat.emoji}
        </span>
        <h2>{e.description}</h2>
        <div className="detail-amount">{rupees(e.amount)}</div>
        <div className="muted small">
          {cat.label} · {niceDate(e.date)} · added by {first(name(e.created_by))} {timeAgo(e.created_at)}
          {e.source === "mcp" && " · via AI assistant"}
          {e.source === "plain_words" && " · typed in plain words"}
        </div>
        <StatusChip status={e.status} />
        {e.deleted_at && <span className="chip err">Deleted</span>}
        {pos.net !== 0 && !e.deleted_at && <div className={pos.net > 0 ? "pos big-net" : "neg big-net"}>{pos.net > 0 ? `You lent ${rupees(pos.net)}` : `You owe ${rupees(-pos.net)}`}</div>}
      </div>

      {mine?.status === "pending" && e.status !== "final" && !e.deleted_at && (
        <div className="card highlight">
          <p>
            <strong>Does this look right?</strong> Your share is {rupees(pos.share)}.
          </p>
          {!showReject ? (
            <div className="btn-row">
              <button className="btn ok" disabled={busy} onClick={() => act(() => api.approve(e.id), "Approved")}>
                ✓ Approve
              </button>
              <button className="btn ghost" onClick={() => setShowReject(true)}>
                ✕ Something's off
              </button>
            </div>
          ) : (
            <div className="btn-row">
              <input placeholder="What's wrong?" value={rejectNote} onChange={(ev) => setRejectNote(ev.target.value)} autoFocus />
              <button className="btn danger" disabled={busy} onClick={() => act(() => api.reject(e.id, rejectNote), "Sent")}>
                Send
              </button>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3>Paid by</h3>
        <ul className="list compact">
          {e.payers.map((p) => (
            <li key={p.user_id} className="row">
              <Avatar id={p.user_id} name={u[p.user_id]?.name} size={28} />
              <span className="row-main">{name(p.user_id)}</span>
              <strong>{rupees(p.amount)}</strong>
            </li>
          ))}
        </ul>
        <h3>
          Split {e.split.method === "equal" ? "equally" : e.split.method === "exact" ? "by amounts" : e.split.method === "percent" ? "by %" : "by shares"}
        </h3>
        <ul className="list compact">
          {e.shares.map((s) => {
            const a = e.approvals.find((x) => x.user_id === s.user_id);
            return (
              <li key={s.user_id} className="row">
                <Avatar id={s.user_id} name={u[s.user_id]?.name} size={28} />
                <span className="row-main">
                  {name(s.user_id)}
                  {a && e.status !== "final" && <span className={"appr-label " + a.status}>{APPROVAL_LABEL[a.status]}</span>}
                  {a?.note && <span className="muted small"> “{a.note}”</span>}
                </span>
                <strong>{rupees(s.amount)}</strong>
              </li>
            );
          })}
        </ul>
        {e.notes && <p className="notes">📝 {e.notes}</p>}
      </div>

      <div className="card">
        <h3>Comments</h3>
        {data.comments.length === 0 && <p className="muted small">No comments yet. Ask about the bill here.</p>}
        {data.comments.map((c) => (
          <div key={c.id} className={"msg" + (c.user_id === me.id ? " mine" : "")}>
            {c.user_id !== me.id && <Avatar id={c.user_id} name={u[c.user_id]?.name} size={24} />}
            <div className="bubble">
              {c.user_id !== me.id && <div className="bubble-name">{first(u[c.user_id]?.name)}</div>}
              {c.body}
              <div className="bubble-time">
                {timeAgo(c.created_at)}
                {c.user_id === me.id && (
                  <button className="link small" onClick={() => act(() => api.deleteComment(c.id))}>
                    {" "}
                    delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        <form className="comment-form" onSubmit={addComment}>
          <input placeholder="Add a comment" value={comment} onChange={(ev) => setComment(ev.target.value)} maxLength={1000} />
          <button className="btn small" disabled={busy || !comment.trim()}>
            Send
          </button>
        </form>
      </div>

      <div className="btn-row pad-x">
        {e.deleted_at ? (
          <button className="btn" disabled={busy} onClick={() => act(() => api.restoreExpense(e.id), "Restored")}>
            ↩ Restore
          </button>
        ) : (
          <button
            className="btn danger ghost"
            disabled={busy}
            onClick={async () => {
              if (!confirm("Delete this expense? You can restore it later.")) return;
              const r = await run(() => api.deleteExpense(e.id).then(() => true), "Deleted");
              if (r) navigate(`/g/${e.group_id}`, true);
            }}
          >
            Delete expense
          </button>
        )}
      </div>
    </div>
  );
}
