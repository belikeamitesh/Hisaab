import { api } from "../api";
import { navigate, useAction, useLoad } from "../lib";
import { ErrorBox, Spinner } from "../components/ui";

export default function Join({ code }: { code: string }) {
  const { data, error } = useLoad(() => api.previewInvite(code), [code]);
  const { busy, run } = useAction();
  if (error) return <ErrorBox msg="This invite link is invalid or was reset. Ask for a new one." />;
  if (!data) return <Spinner />;
  return (
    <div className="login">
      <div className="card login-card center">
        <div className="big-emoji">🎉</div>
        <h2>Join “{data.name}”</h2>
        <p className="muted">{data.member_count} people are splitting expenses here.</p>
        <button
          className="btn primary block"
          disabled={busy}
          onClick={async () => {
            const g = await run(() => api.joinInvite(code), "You're in!");
            if (g) navigate(`/g/${g.id}`, true);
          }}
        >
          Join group
        </button>
        <button className="btn ghost" onClick={() => navigate("/", true)}>
          Not now
        </button>
      </div>
    </div>
  );
}
