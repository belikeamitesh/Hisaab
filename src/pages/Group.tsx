import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, type Parsed, type TimelineItem, type Users } from "../api";
import { CATEGORY, first, groupTitle, Link, navigate, rupees, timeAgo, useAction, useApp, useLoad } from "../lib";
import { Avatar, ErrorBox, Sheet, Spinner, StatusChip, TopBar } from "../components/ui";
import { ExpenseCard } from "../components/ExpenseCard";

const HAS_AMOUNT = /\d/;

export default function GroupPage({ groupId }: { groupId: string }) {
  const { me, toast } = useApp();
  const group = useLoad(() => api.group(groupId), [groupId]);
  const bal = useLoad(() => api.balances(groupId), [groupId]);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [users, setUsers] = useState<Users>({});
  const [cursor, setCursor] = useState<string | undefined>();
  const [tlErr, setTlErr] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const { busy, run } = useAction();
  const bottom = useRef<HTMLDivElement>(null);

  const loadFirst = useCallback(async () => {
    try {
      const p = await api.timeline(groupId);
      setItems(p.items);
      setUsers((u) => ({ ...u, ...p.users }));
      setCursor(p.next_cursor);
      setTlErr("");
    } catch (e) {
      setTlErr((e as Error).message);
    }
  }, [groupId]);

  useEffect(() => {
    loadFirst().then(() => setTimeout(() => bottom.current?.scrollIntoView(), 50));
    // Light polling keeps the chat fresh without websockets (free hosting friendly).
    const t = setInterval(() => document.visibilityState === "visible" && loadFirst(), 15000);
    return () => clearInterval(t);
  }, [loadFirst]);

  const refresh = () => {
    loadFirst();
    bal.reload();
  };

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const p = await api.timeline(groupId, cursor);
      setItems((x) => [...x, ...p.items]);
      setUsers((u) => ({ ...u, ...p.users }));
      setCursor(p.next_cursor);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setLoadingMore(false);
    }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;
    const r = await run(() => api.postMessage(groupId, body));
    if (r) {
      setText("");
      await loadFirst();
      bottom.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function asExpense() {
    const body = text.trim();
    if (!body) return;
    const p = await run(() => api.parse(groupId, body));
    if (p) setParsed(p);
  }

  async function saveParsed() {
    if (!parsed) return;
    const d = parsed.draft;
    const r = await run(
      () => api.createExpense(groupId, { description: d.description, amount: d.amount, category: d.category, split: d.split, payers: parsed.payers, from_plain_words: true }),
      group.data?.group.require_approval ? "Added — waiting for approvals" : "Expense added"
    );
    if (r) {
      setParsed(null);
      setText("");
      refresh();
      setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 200);
    }
  }

  function editParsed() {
    if (!parsed) return;
    try {
      sessionStorage.setItem("hisaab_draft", JSON.stringify(parsed));
    } catch {
      /* ignore */
    }
    navigate(`/g/${groupId}/add?draft=1`);
  }

  if (group.error) return <ErrorBox msg={group.error} retry={group.reload} />;
  if (!group.data) return <Spinner />;
  const g = group.data.group;
  const allUsers = { ...users, ...group.data.users };
  const title = groupTitle(g, group.data.members, me.id);
  const chrono = [...items].reverse();
  const myNet = bal.data?.my_net ?? 0;

  return (
    <div className="page group-page">
      <TopBar
        title={title}
        back="/"
        sub={g.kind === "group" ? `${group.data.members.length} people${g.require_approval ? " · approvals on" : ""}` : group.data.members.find((m) => m.id !== me.id)?.email}
        right={
          <Link to={`/g/${groupId}/settings`} className="icon-btn" aria-label="Group settings">
            ⚙️
          </Link>
        }
      />

      <div className="group-strip">
        <div className={"strip-balance " + (myNet > 0 ? "pos" : myNet < 0 ? "neg" : "")}>
          {myNet === 0 ? "You're settled up" : myNet > 0 ? `You get back ${rupees(myNet)}` : `You owe ${rupees(-myNet)}`}
        </div>
        <div className="strip-actions">
          <Link to={`/g/${groupId}/settle`} className="btn small primary">
            Settle up
          </Link>
          <Link to={`/g/${groupId}/insights`} className="btn small">
            📊 Insights
          </Link>
          <Link to={`/g/${groupId}/add`} className="btn small">
            + Expense
          </Link>
        </div>
      </div>

      <div className="timeline">
        {cursor && (
          <button className="btn ghost small load-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load earlier"}
          </button>
        )}
        {tlErr && <ErrorBox msg={tlErr} retry={loadFirst} />}
        {chrono.map((it) => (
          <TimelineRow key={it.kind + it.id} it={it} users={allUsers} onChange={refresh} />
        ))}
        {!cursor && !tlErr && !chrono.some((i) => i.kind === "expense") && (
          <div className="empty small">
            <p>No expenses yet. Type one below like a message:</p>
            <p className="example">“Paid 2400 for dinner, {first(group.data.members.find((m) => m.id !== me.id)?.name || "Rahul")} didn't eat”</p>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form className="composer" onSubmit={send}>
        <Link to={`/g/${groupId}/add`} className="icon-btn plus" aria-label="Add expense with form">
          ＋
        </Link>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message, or “paid 600 for cab”"
          maxLength={500}
          aria-label="Message or expense in plain words"
        />
        {HAS_AMOUNT.test(text) && (
          <button type="button" className="btn small primary" disabled={busy} onClick={asExpense} title="Turn this into an expense">
            ₹ Add
          </button>
        )}
        <button className="icon-btn send" disabled={busy || !text.trim()} aria-label="Send message">
          ➤
        </button>
      </form>

      <Sheet open={!!parsed} onClose={() => setParsed(null)} title="Check this expense">
        {parsed && (
          <div className="stack">
            <div className="parsed-head">
              <span className="cat-icon big">{(CATEGORY[parsed.draft.category] || CATEGORY.other).emoji}</span>
              <div>
                <div className="parsed-amount">{rupees(parsed.draft.amount)}</div>
                <div>{parsed.draft.description}</div>
              </div>
            </div>
            <p className="muted">{parsed.summary}</p>
            <ul className="list compact">
              {parsed.shares.map((s) => (
                <li key={s.user_id} className="row">
                  <Avatar id={s.user_id} name={parsed.users[s.user_id]?.name} size={28} />
                  <span className="row-main">
                    {s.user_id === me.id ? "You" : parsed.users[s.user_id]?.name}
                    {s.user_id === parsed.draft.payer_id && <span className="chip ok">paid</span>}
                  </span>
                  <strong>{rupees(s.amount)}</strong>
                </li>
              ))}
            </ul>
            {parsed.draft.warnings?.map((w) => (
              <p key={w} className="hint">
                ℹ️ {w}
              </p>
            ))}
            {g.require_approval && <p className="hint">Everyone involved will be asked to approve before it counts.</p>}
            <button className="btn primary block" disabled={busy} onClick={saveParsed}>
              Looks right — add it
            </button>
            <button className="btn ghost block" onClick={editParsed}>
              Edit details
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function TimelineRow({ it, users, onChange }: { it: TimelineItem; users: Users; onChange: () => void }) {
  const { me } = useApp();
  const { busy, run } = useAction();
  if (it.expense) return <ExpenseCard e={it.expense} users={users} onChange={onChange} />;
  if (it.message) {
    const mine = it.message.user_id === me.id;
    return (
      <div className={"msg" + (mine ? " mine" : "")}>
        {!mine && <Avatar id={it.message.user_id} name={users[it.message.user_id]?.name} size={26} />}
        <div className="bubble">
          {!mine && <div className="bubble-name">{first(users[it.message.user_id]?.name)}</div>}
          {it.message.body}
          <div className="bubble-time">{timeAgo(it.message.created_at)}</div>
        </div>
      </div>
    );
  }
  if (it.settlement) {
    const s = it.settlement;
    const from = s.from_user === me.id ? "You" : first(users[s.from_user]?.name);
    const to = s.to_user === me.id ? "you" : first(users[s.to_user]?.name);
    const canConfirm = s.status === "pending_confirmation" && s.to_user === me.id;
    return (
      <div className={"payment" + (s.status === "rejected" ? " rejected" : "")}>
        <div className="payment-line">
          <span className="pay-icon">💸</span>
          <span>
            <strong>{from}</strong> paid <strong>{to}</strong> {rupees(s.amount)} <span className="muted small">· {s.method} · {timeAgo(s.created_at)}</span>
          </span>
        </div>
        <StatusChip status={s.status} />
        {s.status === "rejected" && <span className="chip err">Not received</span>}
        {canConfirm && (
          <div className="expense-actions">
            <button className="btn ok small" disabled={busy} onClick={() => run(() => api.confirmPayment(s.id), "Payment confirmed").then((r) => r && onChange())}>
              ✓ I got it
            </button>
            <button className="btn ghost small" disabled={busy} onClick={() => run(() => api.rejectPayment(s.id)).then((r) => r && onChange())}>
              Not received
            </button>
          </div>
        )}
      </div>
    );
  }
  if (it.activity) return <div className="activity">{it.activity.summary}</div>;
  return null;
}
