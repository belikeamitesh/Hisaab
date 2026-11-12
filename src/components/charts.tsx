// Dependency-free SVG charts.
import { rupees } from "../lib";

export interface Slice {
  label: string;
  value: number;
  color: string;
}

export function Donut({ data, size = 180, center }: { data: Slice[]; size?: number; center?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Spending by category">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={22} />
        {total > 0 &&
          data.map((d) => {
            const len = (d.value / total) * c;
            const el = (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={22}
                strokeDasharray={`${Math.max(len - 2, 0.5)} ${c - Math.max(len - 2, 0.5)}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              >
                <title>{`${d.label}: ${rupees(d.value)}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        <text x="50%" y="47%" textAnchor="middle" className="donut-total">
          {center ?? rupees(total)}
        </text>
        <text x="50%" y="60%" textAnchor="middle" className="donut-sub">
          total
        </text>
      </svg>
      <ul className="legend">
        {data.map((d) => (
          <li key={d.label}>
            <span className="dot" style={{ background: d.color }} />
            <span className="legend-label">{d.label}</span>
            <span className="legend-val">{rupees(d.value)}</span>
            <span className="legend-pct">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Columns({ data, height = 150 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="columns" style={{ height: height + 34 }} role="img" aria-label="Spending by month">
      {data.map((d) => (
        <div className="col" key={d.label} title={`${d.label}: ${rupees(d.value)}`}>
          <span className="col-val">{d.value ? shortRupees(d.value) : ""}</span>
          <div className="col-bar" style={{ height: Math.max(2, (d.value / max) * height) }} />
          <span className="col-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBars({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="hbars">
      {data.map((d) => (
        <li key={d.label}>
          <div className="hbar-top">
            <span>{d.label}</span>
            <strong>{rupees(d.value)}</strong>
          </div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color || "var(--brand)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function shortRupees(p: number) {
  const r = p / 100;
  if (r >= 100000) return "₹" + (r / 100000).toFixed(1).replace(/\.0$/, "") + "L";
  if (r >= 1000) return "₹" + (r / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "₹" + Math.round(r);
}
