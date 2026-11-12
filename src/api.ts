// Typed client for the Hisaab Go API.

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:8080";

export type Paise = number;

export interface User {
  id: string;
  email: string;
  name: string;
  upi_id?: string;
  claimed: boolean;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  has_upi: boolean;
  claimed: boolean;
}

export interface Group {
  id: string;
  name: string;
  kind: "group" | "direct";
  require_approval: boolean;
  simplify_debts: boolean;
  auto_approve_hours: number;
  invite_code?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
}

export type SplitMethod = "equal" | "exact" | "percent" | "shares";
export interface SplitEntry { user_id: string; value: number }
export interface Adjustment { user_id: string; amount: Paise }
export interface SplitInput { method: SplitMethod; total?: Paise; entries: SplitEntry[]; adjustments?: Adjustment[] }
export interface Share { user_id: string; amount: Paise }

export type ApprovalStatus = "pending" | "approved" | "rejected" | "auto_approved";
export interface Approval { user_id: string; status: ApprovalStatus; note?: string; decided_at?: string }

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  notes?: string;
  category: string;
  amount: Paise;
  date: string;
  status: "pending" | "final" | "rejected";
  split: SplitInput;
  payers: Share[];
  shares: Share[];
  approvals: Approval[];
  source: "app" | "plain_words" | "mcp";
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  version: number;
  comment_count: number;
}

export interface Settlement {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount: Paise;
  method: string;
  note?: string;
  status: "pending_confirmation" | "confirmed" | "rejected";
  created_by: string;
  created_at: string;
}

export interface Comment { id: string; group_id: string; expense_id?: string; user_id: string; body: string; created_at: string }
export interface Activity { id: string; actor_id: string; kind: string; summary: string; created_at: string }

export interface TimelineItem {
  kind: "expense" | "settlement" | "message" | "activity";
  id: string;
  at: string;
  expense?: Expense;
  settlement?: Settlement;
  message?: Comment;
  activity?: Activity;
}

export type Users = Record<string, PublicUser>;

export interface GroupSummary { group: Group; member_ids: string[]; my_net: Paise; pending_count: number; members: PublicUser[] }
export interface Summary {
  groups: GroupSummary[];
  total_owed_to_me: Paise;
  total_i_owe: Paise;
  friends: { user: PublicUser; net: Paise }[];
  pending_approvals: number;
  unread_notifications: number;
}

export interface MemberView extends PublicUser { role: "admin" | "member" }
export interface GroupView { group: Group; members: MemberView[]; my_role: "admin" | "member"; users: Users }

export interface Debt { from: string; to: string; amount: Paise }
export interface Balances {
  group_id: string;
  simplified: boolean;
  net: Record<string, Paise>;
  debts: Debt[];
  my_net: Paise;
  i_owe: (Debt & { upi_link?: string })[] | null;
  owed_to_me: Debt[] | null;
  pending_payments: Settlement[] | null;
  users: Users;
}

export interface ExpenseView { expense: Expense; comments: Comment[]; users: Users }
export interface Draft {
  description: string;
  amount: Paise;
  category: string;
  payer_id: string;
  split: SplitInput;
  parser: string;
  warnings?: string[];
}
export interface Parsed { draft: Draft; payers: Share[]; shares: Share[]; users: Users; summary: string }

export interface Amount { key: string; amount: Paise; count?: number }
export interface Stats {
  from: string;
  to: string;
  total: Paise;
  my_share: Paise;
  my_paid: Paise;
  count: number;
  by_category: Amount[];
  my_category: Amount[];
  by_month: Amount[];
  by_payer: Amount[];
  by_member: Amount[];
  biggest: Expense[];
  users: Users;
}

export interface Notification { id: string; group_id?: string; kind: string; message: string; ref_type?: string; ref_id?: string; created_at: string; read_at?: string }
export interface TokenInfo { id: string; name: string; created_at: string; expires_at: string; last_used_at: string }
export interface Category { id: string; label: string; emoji: string }

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = "hisaab_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) — session lasts until reload */
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(f: () => void) {
  onUnauthorized = f;
}

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

async function request<T>(method: string, path: string, body?: unknown, opts: { idempotent?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const tok = getToken();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  // One key per logical action, reused across retries, so a flaky network never double-creates.
  if (opts.idempotent) headers["Idempotency-Key"] = newKey();
  let lastErr: unknown;
  for (let attempt = 0; attempt < (opts.idempotent || method === "GET" ? 3 : 1); attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt * attempt));
    let res: Response;
    try {
      res = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      lastErr = new ApiError(0, "Can't reach Hisaab. The free server may be waking up — try again in a few seconds.");
      void e;
      continue;
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data as T;
    if (res.status === 401 && path !== "/api/v1/auth/verify") onUnauthorized();
    const err = new ApiError(res.status, (data as { error?: string }).error || `Request failed (${res.status})`);
    if (res.status >= 500 || res.status === 0) {
      lastErr = err;
      continue;
    }
    throw err;
  }
  throw lastErr;
}

const g = <T,>(p: string) => request<T>("GET", p);

export const api = {
  requestLink: (email: string, name: string) => request<{ sent: boolean; dev_link?: string }>("POST", "/api/v1/auth/request-link", { email, name }),
  verify: (token: string) => request<{ token: string; user: User }>("POST", "/api/v1/auth/verify", { token }),
  logout: () => request<void>("POST", "/api/v1/auth/logout"),
  me: () => g<User>("/api/v1/me"),
  updateMe: (patch: { name?: string; upi_id?: string }) => request<User>("PATCH", "/api/v1/me", patch),
  summary: () => g<Summary>("/api/v1/me/summary"),
  myStats: (from = "", to = "") => g<Stats>(`/api/v1/me/stats?from=${from}&to=${to}`),
  pending: () => g<Expense[]>("/api/v1/me/pending"),
  tokens: () => g<TokenInfo[]>("/api/v1/me/tokens"),
  createToken: (name: string) => request<{ token: string; info: TokenInfo }>("POST", "/api/v1/me/tokens", { name }),
  revokeToken: (id: string) => request<void>("DELETE", `/api/v1/me/tokens/${id}`),
  notifications: () => g<Notification[]>("/api/v1/notifications"),
  readNotifications: () => request<void>("POST", "/api/v1/notifications/read"),
  categories: () => g<Category[]>("/api/v1/categories"),

  createGroup: (body: { name: string; members: { email: string; name?: string }[]; require_approval: boolean; simplify_debts: boolean }) =>
    request<Group>("POST", "/api/v1/groups", body, { idempotent: true }),
  addFriend: (email: string, name: string) => request<Group>("POST", "/api/v1/friends", { email, name }),
  group: (id: string) => g<GroupView>(`/api/v1/groups/${id}`),
  updateGroup: (id: string, patch: Partial<{ name: string; require_approval: boolean; simplify_debts: boolean; auto_approve_hours: number; archived: boolean }>) =>
    request<Group>("PATCH", `/api/v1/groups/${id}`, patch),
  addMembers: (id: string, members: { email: string; name?: string }[]) => request<GroupView>("POST", `/api/v1/groups/${id}/members`, { members }),
  removeMember: (id: string, uid: string) => request<void>("DELETE", `/api/v1/groups/${id}/members/${uid}`),
  resetInvite: (id: string) => request<Group>("POST", `/api/v1/groups/${id}/invite/reset`),
  previewInvite: (code: string) => g<{ group_id: string; name: string; member_count: number }>(`/api/v1/invites/${code}`),
  joinInvite: (code: string) => request<Group>("POST", `/api/v1/invites/${code}/join`),
  timeline: (id: string, cursor = "") => g<{ items: TimelineItem[]; next_cursor?: string; users: Users }>(`/api/v1/groups/${id}/timeline?limit=30&cursor=${encodeURIComponent(cursor)}`),
  balances: (id: string) => g<Balances>(`/api/v1/groups/${id}/balances`),
  groupStats: (id: string, from = "", to = "") => g<Stats>(`/api/v1/groups/${id}/stats?from=${from}&to=${to}`),
  nudge: (id: string, userId: string) => request<{ sent: boolean }>("POST", `/api/v1/groups/${id}/nudge`, { user_id: userId }),
  postMessage: (id: string, body: string) => request<Comment>("POST", `/api/v1/groups/${id}/messages`, { body }, { idempotent: true }),

  parse: (id: string, text: string) => request<Parsed>("POST", `/api/v1/groups/${id}/expenses/parse`, { text }),
  createExpense: (id: string, body: unknown) => request<Expense>("POST", `/api/v1/groups/${id}/expenses`, body, { idempotent: true }),
  expense: (id: string) => g<ExpenseView>(`/api/v1/expenses/${id}`),
  updateExpense: (id: string, body: unknown) => request<Expense>("PUT", `/api/v1/expenses/${id}`, body),
  deleteExpense: (id: string) => request<void>("DELETE", `/api/v1/expenses/${id}`),
  restoreExpense: (id: string) => request<Expense>("POST", `/api/v1/expenses/${id}/restore`),
  approve: (id: string) => request<Expense>("POST", `/api/v1/expenses/${id}/approve`),
  reject: (id: string, note: string) => request<Expense>("POST", `/api/v1/expenses/${id}/reject`, { note }),
  comment: (id: string, body: string) => request<Comment>("POST", `/api/v1/expenses/${id}/comments`, { body }, { idempotent: true }),
  deleteComment: (id: string) => request<void>("DELETE", `/api/v1/comments/${id}`),

  recordPayment: (id: string, body: { from: string; to: string; amount: Paise; method: string; note?: string }) =>
    request<Settlement>("POST", `/api/v1/groups/${id}/payments`, body, { idempotent: true }),
  confirmPayment: (id: string) => request<Settlement>("POST", `/api/v1/payments/${id}/confirm`),
  rejectPayment: (id: string) => request<Settlement>("POST", `/api/v1/payments/${id}/reject`),
  deletePayment: (id: string) => request<void>("DELETE", `/api/v1/payments/${id}`),
};
