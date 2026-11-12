// Small shared helpers: routing, formatting, data loading, toasts.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type MouseEvent } from "react";
import type { Paise, PublicUser, User } from "./api";

// ---------- money ----------
export function rupees(p: Paise, opts: { sign?: boolean } = {}): string {
  const neg = p < 0;
  const abs = Math.abs(p);
  const r = Math.floor(abs / 100);
  const paise = abs % 100;
  const s = r.toLocaleString("en-IN") + (paise ? "." + String(paise).padStart(2, "0") : "");
  return (neg ? "-" : opts.sign && p > 0 ? "+" : "") + "₹" + s;
}

/** Parses "2,400.50" → 240050 paise. Returns NaN when invalid. */
export function toPaise(s: string): number {
  const clean = s.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return NaN;
  const [w, f = ""] = clean.split(".");
  return Number(w) * 100 + Number((f + "00").slice(0, 2));
}

export function fromPaise(p: Paise): string {
  return p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2);
}

// ---------- dates ----------
export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
}

export function niceDate(d: string): string {
  const dt = new Date(d.length === 10 ? d + "T12:00:00" : d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return niceDate(iso);
}

export function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n, 1);
  return d.toISOString().slice(0, 10);
}

// ---------- names ----------
export function first(name?: string) {
  return (name || "Someone").split(" ")[0];
}

export function groupTitle(g: { kind: string; name: string }, members: PublicUser[] | undefined, meId: string) {
  if (g.kind !== "direct") return g.name;
  const other = members?.find((m) => m.id !== meId);
  return other ? other.name : "Friend";
}

export const CATEGORY: Record<string, { label: string; emoji: string; color: string }> = {
  food: { label: "Food & drinks", emoji: "🍽️", color: "#f97316" },
  groceries: { label: "Groceries", emoji: "🛒", color: "#16a34a" },
  travel: { label: "Travel & stay", emoji: "🏝️", color: "#0ea5e9" },
  transport: { label: "Cabs & fuel", emoji: "🚕", color: "#eab308" },
  rent: { label: "Rent", emoji: "🏠", color: "#8b5cf6" },
  utilities: { label: "Bills & utilities", emoji: "💡", color: "#14b8a6" },
  entertainment: { label: "Entertainment", emoji: "🎬", color: "#ec4899" },
  shopping: { label: "Shopping", emoji: "🛍️", color: "#6366f1" },
  health: { label: "Health", emoji: "💊", color: "#ef4444" },
  other: { label: "Other", emoji: "🧾", color: "#64748b" },
};

// ---------- router ----------
type Listener = () => void;
const listeners = new Set<Listener>();

export function navigate(to: string, replace = false) {
  if (replace) history.replaceState(null, "", to);
  else history.pushState(null, "", to);
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

window.addEventListener("popstate", () => listeners.forEach((l) => l()));

export function usePath(): string {
  const [path, setPath] = useState(location.pathname + location.search);
  useEffect(() => {
    const l = () => setPath(location.pathname + location.search);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return path;
}

/** match("/g/:id", "/g/abc") → { id: "abc" } */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/");
  const a = path.split("?")[0].split("/");
  if (p.length !== a.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) out[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return out;
}

export function Link({ to, children, className, ...rest }: { to: string; children: ReactNode; className?: string; "aria-label"?: string }) {
  return (
    <a
      href={to}
      className={className}
      {...rest}
      onClick={(e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function query(name: string): string {
  return new URLSearchParams(location.search).get(name) || "";
}

// ---------- data loading ----------
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn()
      .then((d) => alive && (setData(d), setError("")))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}

// ---------- session + toasts ----------
export interface AppCtx {
  me: User;
  setMe: (u: User) => void;
  toast: (msg: string, kind?: "ok" | "err") => void;
  refreshBadges: () => void;
  badges: { pending: number; unread: number };
}

export const Ctx = createContext<AppCtx | null>(null);
export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("no app context");
  return c;
}

/** Wraps an async action with error toasts and a busy flag. */
export function useAction() {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(f: () => Promise<T>, okMsg?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const r = await f();
        if (okMsg) toast(okMsg);
        return r;
      } catch (e) {
        toast((e as Error).message, "err");
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast]
  );
  return { busy, run };
}
