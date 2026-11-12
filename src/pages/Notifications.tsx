import { useEffect } from "react";
import { api, type Notification } from "../api";
import { navigate, timeAgo, useApp, useLoad } from "../lib";
import { Empty, ErrorBox, Spinner, TopBar } from "../components/ui";

function target(n: Notification) {
  if (n.ref_type === "expense" && n.ref_id) return `/e/${n.ref_id}`;
  if (n.kind === "reminder" && n.group_id) return `/g/${n.group_id}/settle`;
  if (n.group_id) return `/g/${n.group_id}`;
  return "/";
}

export default function Notifications() {
  const { refreshBadges } = useApp();
  const { data, error, reload } = useLoad(() => api.notifications(), []);
  useEffect(() => {
    if (data && data.some((n) => !n.read_at)) api.readNotifications().then(refreshBadges).catch(() => {});
  }, [data, refreshBadges]);
  return (
    <div className="page">
      <TopBar title="Notifications" back="/" />
      {error && <ErrorBox msg={error} retry={reload} />}
      {!data && !error && <Spinner />}
      {data && data.length === 0 && <Empty icon="🔔" title="No notifications yet" />}
      <ul className="list">
        {data?.map((n) => (
          <li key={n.id}>
            <button className={"row notif" + (n.read_at ? "" : " unread")} onClick={() => navigate(target(n))}>
              <span className="row-main">
                <span>{n.message}</span>
                <span className="muted small">{timeAgo(n.created_at)}</span>
              </span>
              <span>›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
