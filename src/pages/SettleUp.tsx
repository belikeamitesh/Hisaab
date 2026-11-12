import { useState } from "react";
import { api } from "../api";
import { first, fromPaise, Link, rupees, toPaise, useAction, useApp, useLoad } from "../lib";
import { Avatar, Empty, ErrorBox, Sheet, Spinner, TopBar } from "../components/ui";

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export default function SettleUp({ groupId }: { groupId: string }) {
  const { me, refreshBadges } = useApp();
  const { data, error, reload } = useLoad(() => api.balances(groupId), [groupId]);
  const { busy, run } = useAction();
  const [record, setRecord] = useState<{ from: string; to: string; amount: string; method: string } | null>(null);

  if (error) return <ErrorBox msg={error} retry={reload} />;
  if (!data) return <Spinner />;
  const u = data.users;
  const iOwe = data.i_owe || [];
  const owedToMe = data.owed_to_me || [];
  const pending = data.pending_payments || [];

  const done = () => {
    reload();
    refreshBadges();
  };

  async function markPaid(to: string, amount: number) {
    const r = await run(() => api.recordPayment(groupId, { from: me.id, to, amount, method: "upi" }), `Marked as paid — ${first(u[to]?.name)} will confirm`);
    if (r) done();
  }

  async function saveRecord() {
    if (!record) return;
    const amt = toPaise(record.amount);
    if (!(amt > 0)) return;
    const r = await run(() => api.recordPayment(groupId, { from: record.from, to: record.to, amount: amt, method: record.method }), "Payment recorded");
    if (r) {
      setRecord(null);
      done();
    }
  }

  return (
    <div className="page">
      <TopBar title="Settle up" back={`/g/${groupId}`} sub={data.simplified ? "Debts simplified to the fewest payments" : "Person-to-person balances"} />

      {pending.length > 0 && (
        <section className="stack">
          <h2 className="section-title">Waiting for confirmation</h2>
          {pending.map((p) => (
            <div key={p.id} className="card settle-card">
              <div className="row">
                <Avatar id={p.from_user} name={u[p.from_user]?.name} />
                <span className="row-main">
                  {p.to_user === me.id ? (
                    <>
                      <strong>{first(u[p.from_user]?.name)}</strong> says they paid you
                    </>
                  ) : (
                    <>You told {first(u[p.to_user]?.name)} you paid</>
                  )}
                </span>
                <strong>{rupees(p.amount)}</strong>
              </div>
              {p.to_user === me.id ? (
                <div className="btn-row">
                  <button className="btn ok" disabled={busy} onClick={() => run(() => api.confirmPayment(p.id), "Confirmed").then((r) => r && done())}>
                    ✓ I got it
                  </button>
                  <button className="btn ghost" disabled={busy} onClick={() => run(() => api.rejectPayment(p.id)).then((r) => r && done())}>
                    Not received
                  </button>
                </div>
              ) : (
                <p className="hint">Balances update once they confirm.</p>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="stack">
        <h2 className="section-title">You pay</h2>
        {iOwe.length === 0 ? (
          <p className="muted pad-x">You don't owe anyone here 🎉</p>
        ) : (
          iOwe.map((d) => (
            <div key={d.to} className="card settle-card">
              <div className="row">
                <Avatar id={d.to} name={u[d.to]?.name} />
                <span className="row-main">
                  <strong>{u[d.to]?.name}</strong>
                  <span className="muted small">{d.upi_link ? "UPI ready" : "hasn't added a UPI ID yet"}</span>
                </span>
                <strong className="neg">{rupees(d.amount)}</strong>
              </div>
              <div className="btn-row">
                {d.upi_link ? (
                  <>
                    <a className="btn primary" href={d.upi_link} onClick={() => !isMobile() && alert("Open Hisaab on your phone to pay with a UPI app.")}>
                      Pay {rupees(d.amount)} via UPI
                    </a>
                    <button className="btn" disabled={busy} onClick={() => markPaid(d.to, d.amount)}>
                      I've paid
                    </button>
                  </>
                ) : (
                  <button className="btn" disabled={busy} onClick={() => markPaid(d.to, d.amount)}>
                    I've paid {first(u[d.to]?.name)}
                  </button>
                )}
                <button className="btn ghost small" onClick={() => setRecord({ from: me.id, to: d.to, amount: fromPaise(d.amount), method: "cash" })}>
                  Other amount / cash
                </button>
              </div>
              {d.upi_link && <p className="hint">Opens GPay, PhonePe, Paytm or your bank app with the amount filled in. Come back and tap “I've paid”.</p>}
            </div>
          ))
        )}
      </section>

      <section className="stack">
        <h2 className="section-title">You get back</h2>
        {owedToMe.length === 0 ? (
          <p className="muted pad-x">Nobody owes you here.</p>
        ) : (
          owedToMe.map((d) => (
            <div key={d.from} className="card settle-card">
              <div className="row">
                <Avatar id={d.from} name={u[d.from]?.name} />
                <span className="row-main">
                  <strong>{u[d.from]?.name}</strong>
                  <span className="muted small">owes you</span>
                </span>
                <strong className="pos">{rupees(d.amount)}</strong>
              </div>
              <div className="btn-row">
                <button className="btn" disabled={busy} onClick={() => run(() => api.nudge(groupId, d.from), `Reminder sent to ${first(u[d.from]?.name)}`)}>
                  🔔 Remind
                </button>
                <button className="btn ghost" onClick={() => setRecord({ from: d.from, to: me.id, amount: fromPaise(d.amount), method: "cash" })}>
                  They paid me
                </button>
              </div>
            </div>
          ))
        )}
        {!me.upi_id && owedToMe.length > 0 && (
          <Link to="/profile" className="banner">
            <span>💡</span>
            <span>Add your UPI ID so friends can pay you in one tap</span>
            <span>›</span>
          </Link>
        )}
      </section>

      {data.debts.length > 0 && (
        <section className="stack">
          <h2 className="section-title">Everyone in the group</h2>
          <ul className="list compact">
            {data.debts.map((d) => (
              <li key={d.from + d.to} className="row">
                <span className="row-main">
                  {d.from === me.id ? "You" : first(u[d.from]?.name)} → {d.to === me.id ? "you" : first(u[d.to]?.name)}
                </span>
                <strong>{rupees(d.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.debts.length === 0 && pending.length === 0 && <Empty icon="🤝" title="All settled up" />}

      <Sheet open={!!record} onClose={() => setRecord(null)} title="Record a payment">
        {record && (
          <div className="stack">
            <p>
              <strong>{record.from === me.id ? "You" : u[record.from]?.name}</strong> paid <strong>{record.to === me.id ? "you" : u[record.to]?.name}</strong>
            </p>
            <div className="amount-input">
              <span>₹</span>
              <input inputMode="decimal" value={record.amount} onChange={(e) => setRecord({ ...record, amount: e.target.value })} aria-label="Amount" />
            </div>
            <div className="segmented">
              {["cash", "upi", "other"].map((m) => (
                <button key={m} type="button" className={record.method === m ? "on" : ""} onClick={() => setRecord({ ...record, method: m })}>
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
            {record.from === me.id && <p className="hint">{first(u[record.to]?.name)} will be asked to confirm.</p>}
            <button className="btn primary block" disabled={busy || !(toPaise(record.amount) > 0)} onClick={saveRecord}>
              Save payment
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
