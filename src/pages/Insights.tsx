import { useState } from "react";
import { api } from "../api";
import { CATEGORY, first, Link, monthsAgo, rupees, todayIST, useApp, useLoad } from "../lib";
import { Donut, Columns, HBars } from "../components/charts";
import { Empty, ErrorBox, Spinner, TopBar } from "../components/ui";

const RANGES = [
  { id: "1", label: "This month", from: () => todayIST().slice(0, 8) + "01" },
  { id: "3", label: "3 months", from: () => monthsAgo(2) },
  { id: "12", label: "12 months", from: () => monthsAgo(11) },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Insights({ groupId }: { groupId?: string }) {
  const { me } = useApp();
  const [range, setRange] = useState("3");
  const from = RANGES.find((r) => r.id === range)!.from();
  const { data, error, loading, reload } = useLoad(() => (groupId ? api.groupStats(groupId, from) : api.myStats(from)), [groupId, from]);
  const name = (id: string) => (id === me.id ? "You" : first(data?.users[id]?.name));

  const months = (() => {
    if (!data) return [];
    const byKey = Object.fromEntries(data.by_month.map((m) => [m.key, m.amount]));
    const out: { label: string; value: number }[] = [];
    const start = new Date(from + "T00:00:00");
    const end = new Date(todayIST() + "T00:00:00");
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d.setMonth(d.getMonth() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({ label: MONTHS[d.getMonth()], value: byKey[key] || 0 });
    }
    return out;
  })();

  return (
    <div className="page">
      <TopBar title={groupId ? "Group insights" : "Your spending"} back={groupId ? `/g/${groupId}` : undefined} sub={groupId ? "Final expenses only" : "Your share across all groups"} />
      <div className="segmented pad-x">
        {RANGES.map((r) => (
          <button key={r.id} className={range === r.id ? "on" : ""} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>
      {loading && !data && <Spinner />}
      {error && <ErrorBox msg={error} retry={reload} />}
      {data && data.count === 0 && (
        <Empty icon="📊" title="Nothing to show yet">
          <p className="muted">Charts appear once expenses are approved.</p>
        </Empty>
      )}
      {data && data.count > 0 && (
        <div className="stack">
          <div className="stat-cards">
            <div className="stat">
              <span>{groupId ? "Group spent" : "You spent"}</span>
              <strong>{rupees(data.total)}</strong>
            </div>
            <div className="stat">
              <span>{groupId ? "Your share" : "You paid upfront"}</span>
              <strong>{rupees(groupId ? data.my_share : data.my_paid)}</strong>
            </div>
            <div className="stat">
              <span>Expenses</span>
              <strong>{data.count}</strong>
            </div>
          </div>
          <div className="card">
            <h3>By category</h3>
            <Donut
              data={data.by_category.map((c) => ({
                label: `${(CATEGORY[c.key] || CATEGORY.other).emoji} ${(CATEGORY[c.key] || CATEGORY.other).label}`,
                value: c.amount,
                color: (CATEGORY[c.key] || CATEGORY.other).color,
              }))}
            />
          </div>
          <div className="card">
            <h3>By month</h3>
            <Columns data={months} />
          </div>
          {groupId && data.by_payer.length > 0 && (
            <div className="card">
              <h3>Who paid upfront</h3>
              <HBars data={data.by_payer.map((p) => ({ label: name(p.key), value: p.amount }))} />
              <h3>Who consumed what</h3>
              <HBars data={data.by_member.map((p) => ({ label: name(p.key), value: p.amount, color: "#7c3aed" }))} />
            </div>
          )}
          <div className="card">
            <h3>Biggest expenses</h3>
            <ul className="list compact">
              {data.biggest.map((e) => (
                <li key={e.id}>
                  <Link to={`/e/${e.id}`} className="row">
                    <span className="cat-icon">{(CATEGORY[e.category] || CATEGORY.other).emoji}</span>
                    <span className="row-main">{e.description}</span>
                    <strong>{rupees(e.amount)}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
