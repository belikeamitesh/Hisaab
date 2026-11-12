import { useEffect } from "react";
import { api } from "../api";
import { first, groupTitle, Link, rupees, useApp, useLoad } from "../lib";
import { Avatar, AvatarStack, Empty, ErrorBox, Spinner } from "../components/ui";

export default function Home() {
  const { me, badges, refreshBadges } = useApp();
  const { data, error, loading, reload } = useLoad(() => api.summary(), []);
  useEffect(() => {
    refreshBadges();
  }, [refreshBadges]);

  const groups = data?.groups.filter((g) => g.group.kind === "group" && !g.group.archived_at) || [];
  const friends = data?.groups.filter((g) => g.group.kind === "direct") || [];
  const archived = data?.groups.filter((g) => g.group.kind === "group" && g.group.archived_at) || [];

  return (
    <div className="page">
      <header className="home-head">
        <div>
          <div className="muted small">Namaste,</div>
          <h1>{first(me.name)} 👋</h1>
        </div>
        <Link to="/notifications" className="icon-btn bell" aria-label="Notifications">
          🔔{badges.unread > 0 && <span className="badge">{badges.unread}</span>}
        </Link>
      </header>

      {loading && !data && <Spinner />}
      {error && <ErrorBox msg={error} retry={reload} />}

      {data && (
        <>
          <section className="balance-cards">
            <div className="balance-card owed">
              <span>You'll get back</span>
              <strong>{rupees(data.total_owed_to_me)}</strong>
            </div>
            <div className="balance-card owe">
              <span>You owe</span>
              <strong>{rupees(data.total_i_owe)}</strong>
            </div>
          </section>

          {data.pending_approvals > 0 && (
            <Link to="/approvals" className="banner">
              <span>✅</span>
              <span>
                <strong>{data.pending_approvals} expense{data.pending_approvals > 1 ? "s" : ""}</strong> waiting for your approval
              </span>
              <span>›</span>
            </Link>
          )}

          <div className="section-head">
            <h2>Groups</h2>
            <Link to="/groups/new" className="btn small">
              + New group
            </Link>
          </div>
          {groups.length === 0 ? (
            <Empty icon="🏝️" title="No groups yet">
              <p className="muted">Create one for your flat, a trip or office lunches, then share the invite link on WhatsApp.</p>
              <Link to="/groups/new" className="btn primary">
                Create a group
              </Link>
            </Empty>
          ) : (
            <ul className="list">
              {groups.map((g) => (
                <li key={g.group.id}>
                  <Link to={`/g/${g.group.id}`} className="row">
                    <span className="group-icon">{g.group.name.slice(0, 1).toUpperCase()}</span>
                    <span className="row-main">
                      <span className="row-title">
                        {g.group.name} {g.pending_count > 0 && <span className="chip warn">{g.pending_count} to approve</span>}
                      </span>
                      <AvatarStack users={g.members} />
                    </span>
                    <NetLabel net={g.my_net} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="section-head">
            <h2>Friends</h2>
            <Link to="/friends/new" className="btn small">
              + Add friend
            </Link>
          </div>
          {friends.length === 0 && data.friends.length === 0 ? (
            <p className="muted pad-x">Split 1:1 with a friend without making a group.</p>
          ) : (
            <ul className="list">
              {friends.map((g) => {
                const other = g.members.find((m) => m.id !== me.id);
                return (
                  <li key={g.group.id}>
                    <Link to={`/g/${g.group.id}`} className="row">
                      <Avatar id={other?.id || g.group.id} name={other?.name} />
                      <span className="row-main">
                        <span className="row-title">{groupTitle(g.group, g.members, me.id)}</span>
                        <span className="muted small">{other?.email}</span>
                      </span>
                      <NetLabel net={g.my_net} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {data.friends.length > 0 && (
            <>
              <div className="section-head">
                <h2>Across all groups</h2>
              </div>
              <ul className="list compact">
                {data.friends.map((f) => (
                  <li key={f.user.id} className="row">
                    <Avatar id={f.user.id} name={f.user.name} size={30} />
                    <span className="row-main">{f.user.name}</span>
                    <span className={f.net > 0 ? "pos" : "neg"}>
                      {f.net > 0 ? `owes you ${rupees(f.net)}` : `you owe ${rupees(-f.net)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {archived.length > 0 && (
            <details className="archived">
              <summary>Archived groups ({archived.length})</summary>
              <ul className="list compact">
                {archived.map((g) => (
                  <li key={g.group.id}>
                    <Link to={`/g/${g.group.id}`} className="row">
                      {g.group.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

export function NetLabel({ net }: { net: number }) {
  if (net === 0) return <span className="net settled">settled up</span>;
  return net > 0 ? (
    <span className="net pos">
      <small>you get</small>
      {rupees(net)}
    </span>
  ) : (
    <span className="net neg">
      <small>you owe</small>
      {rupees(-net)}
    </span>
  );
}
