import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, getToken, setToken, setUnauthorizedHandler, type User } from "./api";
import { Ctx, match, navigate, usePath } from "./lib";
import { BottomNav, Spinner } from "./components/ui";
import Login from "./pages/Login";
import Verify from "./pages/Verify";
import Home from "./pages/Home";
import NewGroup from "./pages/NewGroup";
import AddFriend from "./pages/AddFriend";
import GroupPage from "./pages/Group";
import ExpenseForm from "./pages/ExpenseForm";
import ExpenseDetail from "./pages/ExpenseDetail";
import SettleUp from "./pages/SettleUp";
import Insights from "./pages/Insights";
import GroupSettings from "./pages/GroupSettings";
import Join from "./pages/Join";
import Profile from "./pages/Profile";
import Approvals from "./pages/Approvals";
import Notifications from "./pages/Notifications";

export default function App() {
  const path = usePath();
  const [me, setMe] = useState<User | null>(null);
  const [booting, setBooting] = useState(!!getToken());
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const [badges, setBadges] = useState({ pending: 0, unread: 0 });
  const tid = useRef(0);

  const toast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 5000 : 2600);
  }, []);

  const refreshBadges = useCallback(() => {
    api
      .summary()
      .then((s) => setBadges({ pending: s.pending_approvals, unread: s.unread_notifications }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setMe(null);
    });
    if (!getToken()) return;
    api
      .me()
      .then((u) => {
        setMe(u);
        refreshBadges();
      })
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, [refreshBadges]);

  const ctx = useMemo(() => (me ? { me, setMe, toast, badges, refreshBadges } : null), [me, toast, badges, refreshBadges]);

  // Public routes
  if (match("/auth/verify", path)) {
    return (
      <Verify
        onDone={(u) => {
          setMe(u);
          refreshBadges();
        }}
      />
    );
  }
  if (booting) return <Spinner label="Opening Hisaab…" />;
  if (!me || !ctx) {
    const joinCode = match("/join/:code", path)?.code;
    return <Login joinCode={joinCode} />;
  }

  let page: ReactNode;
  let m: Record<string, string> | null;
  let showNav = false;
  if (path === "/" || path.startsWith("/?")) {
    page = <Home />;
    showNav = true;
  } else if (path.startsWith("/approvals")) {
    page = <Approvals />;
    showNav = true;
  } else if (path.startsWith("/insights")) {
    page = <Insights />;
    showNav = true;
  } else if (path.startsWith("/profile")) {
    page = <Profile />;
    showNav = true;
  } else if (path.startsWith("/notifications")) page = <Notifications />;
  else if (path === "/groups/new") page = <NewGroup />;
  else if (path === "/friends/new") page = <AddFriend />;
  else if ((m = match("/join/:code", path))) page = <Join code={m.code} />;
  else if ((m = match("/g/:id/add", path))) page = <ExpenseForm groupId={m.id} />;
  else if ((m = match("/g/:id/settle", path))) page = <SettleUp groupId={m.id} />;
  else if ((m = match("/g/:id/insights", path))) page = <Insights groupId={m.id} />;
  else if ((m = match("/g/:id/settings", path))) page = <GroupSettings groupId={m.id} />;
  else if ((m = match("/g/:id", path))) page = <GroupPage groupId={m.id} />;
  else if ((m = match("/e/:id/edit", path))) page = <ExpenseForm expenseId={m.id} />;
  else if ((m = match("/e/:id", path))) page = <ExpenseDetail expenseId={m.id} />;
  else {
    page = (
      <div className="pad center">
        <p>Page not found.</p>
        <button className="btn" onClick={() => navigate("/")}>
          Go home
        </button>
      </div>
    );
  }

  return (
    <Ctx.Provider value={ctx}>
      <div className={"app" + (showNav ? " with-nav" : "")}>
        <main key={path.split("?")[0]}>{page}</main>
        {showNav && <BottomNav />}
      </div>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={"toast " + t.kind}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
