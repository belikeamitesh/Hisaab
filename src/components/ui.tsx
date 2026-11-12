import { useEffect, type ReactNode } from "react";
import { Link, navigate, useApp, usePath } from "../lib";

const COLORS = ["#0f766e", "#7c3aed", "#db2777", "#ea580c", "#2563eb", "#65a30d", "#0891b2", "#c026d3", "#b45309", "#4f46e5"];

export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function Avatar({ id, name, size = 36 }: { id: string; name?: string; size?: number }) {
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, background: colorFor(id), fontSize: size * 0.4 }} aria-hidden>
      {initials}
    </span>
  );
}

export function AvatarStack({ users, max = 4 }: { users: { id: string; name: string }[]; max?: number }) {
  return (
    <span className="avatar-stack">
      {users.slice(0, max).map((u) => (
        <Avatar key={u.id} id={u.id} name={u.name} size={26} />
      ))}
      {users.length > max && <span className="avatar more">+{users.length - max}</span>}
    </span>
  );
}

export function TopBar({ title, back, right, sub }: { title: ReactNode; back?: string | true; right?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="topbar">
      {back && (
        <button className="icon-btn" aria-label="Back" onClick={() => (back === true ? history.back() : navigate(back))}>
          ←
        </button>
      )}
      <div className="topbar-title">
        <h1>{title}</h1>
        {sub && <div className="topbar-sub">{sub}</div>}
      </div>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

export function BottomNav() {
  const path = usePath();
  const { badges } = useApp();
  const items = [
    { to: "/", label: "Home", icon: "🏠" },
    { to: "/approvals", label: "Approvals", icon: "✅", badge: badges.pending },
    { to: "/insights", label: "Insights", icon: "📊" },
    { to: "/profile", label: "Profile", icon: "👤" },
  ];
  return (
    <nav className="bottomnav">
      {items.map((it) => {
        const active = it.to === "/" ? path === "/" : path.startsWith(it.to);
        return (
          <Link key={it.to} to={it.to} className={"bottomnav-item" + (active ? " active" : "")}>
            <span className="bn-icon">
              {it.icon}
              {!!it.badge && <span className="badge">{it.badge}</span>}
            </span>
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="center muted pad">
      <span className="spinner" /> {label}
    </div>
  );
}

export function ErrorBox({ msg, retry }: { msg: string; retry?: () => void }) {
  return (
    <div className="card error-box">
      <p>{msg}</p>
      {retry && (
        <button className="btn ghost" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    pending: ["Waiting for approval", "chip warn"],
    rejected: ["Disputed", "chip err"],
    final: ["", ""],
    pending_confirmation: ["Waiting for confirmation", "chip warn"],
    confirmed: ["Confirmed", "chip ok"],
  };
  const [label, cls] = map[status] || [status, "chip"];
  return label ? <span className={cls}>{label}</span> : null;
}
