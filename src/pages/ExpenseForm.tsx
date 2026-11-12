import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, ApiError, type Adjustment, type Expense, type GroupView, type Parsed, type SplitMethod } from "../api";
import { CATEGORY, first, fromPaise, navigate, query, rupees, todayIST, toPaise, useAction, useApp } from "../lib";
import { Avatar, ErrorBox, Spinner, TopBar } from "../components/ui";

type Props = { groupId?: string; expenseId?: string };

const METHODS: { id: SplitMethod; label: string }[] = [
  { id: "equal", label: "Equally" },
  { id: "exact", label: "Exact ₹" },
  { id: "percent", label: "%" },
  { id: "shares", label: "Shares" },
];

export default function ExpenseForm({ groupId: gidProp, expenseId }: Props) {
  const { me } = useApp();
  const [gv, setGv] = useState<GroupView | null>(null);
  const [orig, setOrig] = useState<Expense | null>(null);
  const [loadErr, setLoadErr] = useState("");

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayIST());
  const [notes, setNotes] = useState("");
  const [multiPayer, setMultiPayer] = useState(false);
  const [payer, setPayer] = useState(me.id);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [conflict, setConflict] = useState(false);
  const { busy, run } = useAction();

  // Load group + (for edits) the expense, then pre-fill.
  useEffect(() => {
    (async () => {
      try {
        let gid = gidProp;
        let e: Expense | null = null;
        if (expenseId) {
          e = (await api.expense(expenseId)).expense;
          gid = e.group_id;
          setOrig(e);
        }
        const view = await api.group(gid!);
        setGv(view);
        const inc: Record<string, boolean> = {};
        view.members.forEach((m) => (inc[m.id] = true));
        if (e) {
          fill(e.description, e.amount, e.category, e.split.method, e.split.entries, e.split.adjustments || [], e.payers, view);
          setDate(e.date);
          setNotes(e.notes || "");
        } else if (query("draft")) {
          try {
            const p = JSON.parse(sessionStorage.getItem("hisaab_draft") || "null") as Parsed | null;
            if (p) fill(p.draft.description, p.draft.amount, p.draft.category, p.draft.split.method, p.draft.split.entries, p.draft.split.adjustments || [], p.payers, view);
          } catch {
            setIncluded(inc);
          }
        } else {
          setIncluded(inc);
        }
      } catch (err) {
        setLoadErr((err as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gidProp, expenseId]);

  function fill(desc: string, amt: number, cat: string, m: SplitMethod, entries: { user_id: string; value: number }[], adj: Adjustment[], payers: { user_id: string; amount: number }[], view: GroupView) {
    setDescription(desc);
    setAmount(fromPaise(amt));
    setCategory(cat);
    setMethod(m);
    const inc: Record<string, boolean> = {};
    const vals: Record<string, string> = {};
    view.members.forEach((mm) => (inc[mm.id] = false));
    entries.forEach((en) => {
      inc[en.user_id] = true;
      vals[en.user_id] = m === "exact" ? fromPaise(en.value) : m === "percent" ? String(en.value / 100) : String(en.value);
    });
    setIncluded(inc);
    setValues(vals);
    setAdjustments(adj);
    if (payers.length > 1) {
      setMultiPayer(true);
      const pa: Record<string, string> = {};
      payers.forEach((p) => (pa[p.user_id] = fromPaise(p.amount)));
      setPayerAmounts(pa);
    } else if (payers[0]) setPayer(payers[0].user_id);
  }

  // Switching split type pre-fills values that already add up, so the user only tweaks.
  function switchMethod(m: SplitMethod) {
    if (m === method) return;
    const ids = (gv?.members || []).filter((x) => included[x.id]).map((x) => x.id);
    const n = ids.length || 1;
    const t = toPaise(amount);
    const vals: Record<string, string> = {};
    ids.forEach((id, i) => {
      if (m === "exact" && t > 0) vals[id] = fromPaise(Math.floor(t / n) + (i < t % n ? 1 : 0));
      if (m === "shares") vals[id] = "1";
    });
    if (m === "percent" && ids.length) {
      const each = Math.floor(10000 / n);
      ids.forEach((id, i) => (vals[id] = String((each + (i < 10000 - each * n ? 1 : 0)) / 100)));
    }
    setValues(vals);
    setMethod(m);
  }

  const total = toPaise(amount);
  const members = gv?.members || [];
  const chosen = members.filter((m) => included[m.id]);

  // Live preview & validation (the server recomputes exactly; this is for feedback).
  const check = useMemo(() => {
    if (!(total > 0)) return { ok: false, msg: "Enter an amount", preview: {} as Record<string, number> };
    if (chosen.length === 0) return { ok: false, msg: "Pick at least one person", preview: {} };
    const preview: Record<string, number> = {};
    const adjSum = adjustments.reduce((s, a) => s + a.amount, 0);
    if (method === "equal" || method === "shares") {
      const w = chosen.map((m) => (method === "equal" ? 1 : Math.max(0, Number(values[m.id] || 1))));
      const W = w.reduce((a, b) => a + b, 0);
      if (W <= 0) return { ok: false, msg: "Shares must be positive", preview };
      if (adjSum > total) return { ok: false, msg: "Extras are more than the total", preview };
      chosen.forEach((m, i) => (preview[m.id] = Math.round(((total - adjSum) * w[i]) / W)));
      adjustments.forEach((a) => (preview[a.user_id] = (preview[a.user_id] || 0) + a.amount));
      return { ok: true, msg: "", preview };
    }
    if (method === "exact") {
      let sum = 0;
      for (const m of chosen) {
        const v = toPaise(values[m.id] || "0");
        if (isNaN(v)) return { ok: false, msg: "Check the amounts", preview };
        preview[m.id] = v;
        sum += v;
      }
      const diff = total - sum;
      return diff === 0 ? { ok: true, msg: "", preview } : { ok: false, msg: diff > 0 ? `${rupees(diff)} left to assign` : `${rupees(-diff)} too much`, preview };
    }
    let pct = 0;
    for (const m of chosen) {
      const v = Number(values[m.id] || 0);
      pct += v;
      preview[m.id] = Math.round((total * v) / 100);
    }
    return Math.abs(pct - 100) < 0.001 ? { ok: true, msg: "", preview } : { ok: false, msg: `Percentages add up to ${pct}%`, preview };
  }, [total, chosen, method, values, adjustments]);

  const payerCheck = useMemo(() => {
    if (!multiPayer) return "";
    const s = members.reduce((acc, m) => acc + (toPaise(payerAmounts[m.id] || "0") || 0), 0);
    return s === total ? "" : `Payers add up to ${rupees(s)}, expense is ${rupees(total > 0 ? total : 0)}`;
  }, [multiPayer, payerAmounts, members, total]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!check.ok || payerCheck) return;
    const entries = chosen.map((m) => ({
      user_id: m.id,
      value: method === "exact" ? toPaise(values[m.id] || "0") : method === "percent" ? Math.round(Number(values[m.id] || 0) * 100) : method === "shares" ? Math.round(Number(values[m.id] || 1)) : 0,
    }));
    const payers = multiPayer
      ? members.filter((m) => toPaise(payerAmounts[m.id] || "0") > 0).map((m) => ({ user_id: m.id, amount: toPaise(payerAmounts[m.id]) }))
      : [{ user_id: payer, amount: total }];
    const body = {
      description,
      notes,
      category: category || undefined,
      amount: total,
      date,
      split: { method, entries, adjustments: method === "equal" || method === "shares" ? adjustments : [] },
      payers,
      version: orig?.version,
      from_plain_words: query("draft") ? true : undefined,
    };
    try {
      const saved = orig ? await api.updateExpense(orig.id, body) : await run(() => api.createExpense(gv!.group.id, body));
      if (!saved) return;
      try {
        sessionStorage.removeItem("hisaab_draft");
      } catch {
        /* ignore */
      }
      navigate(orig ? `/e/${orig.id}` : `/g/${gv!.group.id}`, true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConflict(true);
      else run(() => Promise.reject(err));
    }
  }

  if (loadErr) return <ErrorBox msg={loadErr} />;
  if (!gv) return <Spinner />;
  const name = (id: string) => (id === me.id ? "You" : members.find((m) => m.id === id)?.name || "Someone");

  return (
    <div className="page">
      <TopBar title={orig ? "Edit expense" : "Add expense"} back={true} />
      {conflict && (
        <div className="card error-box">
          <p>Someone changed this expense while you were editing.</p>
          <button className="btn" onClick={() => location.reload()}>
            Reload latest
          </button>
        </div>
      )}
      <form className="stack" onSubmit={submit}>
        <div className="amount-input">
          <span>₹</span>
          <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" required autoFocus={!orig} />
        </div>
        <label className="field">
          <span>What was it for?</span>
          <input required maxLength={120} placeholder="Dinner at Toit" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="chips-scroll" role="radiogroup" aria-label="Category">
          {Object.entries(CATEGORY).map(([id, c]) => (
            <button type="button" key={id} className={"chip-btn" + (category === id ? " on" : "")} onClick={() => setCategory(category === id ? "" : id)}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        {!category && <p className="hint">No category picked — we'll guess from the description.</p>}

        <div className="card">
          <div className="row-between">
            <h3>Paid by</h3>
            <label className="small">
              <input type="checkbox" checked={multiPayer} onChange={(e) => setMultiPayer(e.target.checked)} /> Multiple people
            </label>
          </div>
          {!multiPayer ? (
            <div className="chips-wrap">
              {members.map((m) => (
                <button type="button" key={m.id} className={"chip-btn" + (payer === m.id ? " on" : "")} onClick={() => setPayer(m.id)}>
                  {name(m.id)}
                </button>
              ))}
            </div>
          ) : (
            <>
              {members.map((m) => (
                <div className="split-row" key={m.id}>
                  <Avatar id={m.id} name={m.name} size={28} />
                  <span className="row-main">{name(m.id)}</span>
                  <input inputMode="decimal" placeholder="0" value={payerAmounts[m.id] || ""} onChange={(e) => setPayerAmounts({ ...payerAmounts, [m.id]: e.target.value })} />
                </div>
              ))}
              {payerCheck && <p className="error-text">{payerCheck}</p>}
            </>
          )}
        </div>

        <div className="card">
          <h3>Split</h3>
          <div className="segmented">
            {METHODS.map((m) => (
              <button type="button" key={m.id} className={method === m.id ? "on" : ""} onClick={() => switchMethod(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          {members.map((m) => (
            <div className={"split-row" + (included[m.id] ? "" : " off")} key={m.id}>
              <input type="checkbox" checked={!!included[m.id]} onChange={(e) => setIncluded({ ...included, [m.id]: e.target.checked })} aria-label={`Include ${m.name}`} />
              <Avatar id={m.id} name={m.name} size={28} />
              <span className="row-main">{name(m.id)}</span>
              {method !== "equal" && included[m.id] && (
                <input
                  inputMode="decimal"
                  className="split-val"
                  placeholder={method === "shares" ? "1" : "0"}
                  value={values[m.id] || ""}
                  onChange={(e) => setValues({ ...values, [m.id]: e.target.value })}
                  aria-label={`${m.name} ${method}`}
                />
              )}
              {method === "percent" && included[m.id] && <span className="muted">%</span>}
              <span className="split-preview">{included[m.id] || check.preview[m.id] ? rupees(check.preview[m.id] || 0) : "—"}</span>
            </div>
          ))}
          {(method === "equal" || method === "shares") && (
            <div className="adjustments">
              {adjustments.map((a, i) => (
                <div className="split-row" key={i}>
                  <span className="muted">+ extra for</span>
                  <select value={a.user_id} onChange={(e) => setAdjustments(adjustments.map((x, j) => (j === i ? { ...x, user_id: e.target.value } : x)))}>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {first(name(m.id))}
                      </option>
                    ))}
                  </select>
                  <input
                    inputMode="decimal"
                    className="split-val"
                    value={fromPaise(a.amount)}
                    onChange={(e) => setAdjustments(adjustments.map((x, j) => (j === i ? { ...x, amount: toPaise(e.target.value) || 0 } : x)))}
                  />
                  <button type="button" className="icon-btn" aria-label="Remove extra" onClick={() => setAdjustments(adjustments.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn ghost small" onClick={() => setAdjustments([...adjustments, { user_id: me.id, amount: 0 }])}>
                + Someone had something extra
              </button>
            </div>
          )}
          {!check.ok && total > 0 && <p className="error-text">{check.msg}</p>}
        </div>

        <div className="grid2">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} maxLength={1000} placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {gv.group.require_approval && <p className="hint">Everyone involved will get a request to approve this.</p>}
        <button className="btn primary block" disabled={busy || !check.ok || !!payerCheck}>
          {orig ? "Save changes" : "Add expense"}
        </button>
      </form>
    </div>
  );
}
