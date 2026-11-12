import { useEffect, useState } from "react";
import { api, type Users } from "../api";
import { useApp, useLoad } from "../lib";
import { Empty, ErrorBox, Spinner, TopBar } from "../components/ui";
import { ExpenseCard } from "../components/ExpenseCard";

export default function Approvals() {
  const { data, error, loading, reload } = useLoad(() => api.pending(), []);
  const { refreshBadges } = useApp();
  const [users, setUsers] = useState<Users>({});

  // Expenses come without user objects; fetch the groups' members once.
  useEffect(() => {
    if (!data) return;
    const gids = [...new Set(data.map((e) => e.group_id))];
    Promise.all(gids.map((g) => api.group(g).catch(() => null))).then((views) => {
      const u: Users = {};
      views.forEach((v) => v && Object.assign(u, v.users));
      setUsers(u);
    });
  }, [data]);

  return (
    <div className="page">
      <TopBar title="Approvals" sub="Expenses waiting for your OK" />
      {loading && !data && <Spinner />}
      {error && <ErrorBox msg={error} retry={reload} />}
      {data && data.length === 0 && (
        <Empty icon="✅" title="You're all caught up">
          <p className="muted">When friends add expenses that include you, they'll show up here to approve.</p>
        </Empty>
      )}
      <div className="stack">
        {data?.map((e) => (
          <ExpenseCard
            key={e.id}
            e={e}
            users={users}
            showGroupLink
            onChange={() => {
              reload();
              refreshBadges();
            }}
          />
        ))}
      </div>
    </div>
  );
}
