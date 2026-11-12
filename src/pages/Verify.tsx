import { useEffect, useRef, useState } from "react";
import { api, setToken, type User } from "../api";
import { navigate, query } from "../lib";
import { Spinner } from "../components/ui";

export default function Verify({ onDone }: { onDone: (u: User) => void }) {
  const [err, setErr] = useState("");
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return; // StrictMode runs effects twice; the token is single-use.
    once.current = true;
    api
      .verify(query("token"))
      .then((r) => {
        setToken(r.token);
        onDone(r.user);
        let next = "/";
        try {
          next = localStorage.getItem("hisaab_next") || "/";
          localStorage.removeItem("hisaab_next");
        } catch {
          /* ignore */
        }
        navigate(next.startsWith("/") && !next.startsWith("/auth") ? next : "/", true);
      })
      .catch((e: Error) => setErr(e.message));
  }, [onDone]);
  if (err)
    return (
      <div className="login">
        <div className="card login-card center">
          <div className="big-emoji">⏰</div>
          <p>{err}</p>
          <button className="btn primary" onClick={() => navigate("/", true)}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  return <Spinner label="Signing you in…" />;
}
