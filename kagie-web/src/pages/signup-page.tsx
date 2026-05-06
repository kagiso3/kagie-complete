import { useState } from "react";
import type { KagieUser, LegacyApi } from "../lib/types";
import { Button } from "../components/ui";

export function SignupPage({
  api,
  onNavigate,
  onAuthSuccess
}: {
  api: LegacyApi;
  onNavigate: (route: "login") => void;
  onAuthSuccess: (user: KagieUser) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success" | "info">("info");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const user = await api.registerUser({
        fullName,
        email,
        phone,
        password,
        dob,
        schoolName
      });
      setMessage("Your Kagie account is ready.");
      setMessageTone("success");
      onAuthSuccess(user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kagie could not create your account.");
      setMessageTone("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kg-auth-shell">
      <div className="kg-auth-card">
        <div className="kg-auth-head">
          <div className="kg-brand-line">Kagie</div>
          <h1>Create account</h1>
          <p>Start your premium student journey with one profile, one dashboard, and one guided application workspace.</p>
        </div>

        <form className="kg-auth-form" onSubmit={handleSubmit}>
          <label className="kg-field">
            <span>Full name</span>
            <input className="kg-input" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label className="kg-field">
            <span>Email</span>
            <input className="kg-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="kg-field">
            <span>Phone</span>
            <input className="kg-input" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="kg-field">
            <span>Password</span>
            <input className="kg-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="kg-field">
            <span>Date of birth</span>
            <input className="kg-input" type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
          </label>
          <label className="kg-field">
            <span>School attended</span>
            <input className="kg-input" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating..." : "Create account"}
          </Button>
        </form>

        {message ? <div className={`kg-inline-message ${messageTone}`}>{message}</div> : null}

        <div className="kg-auth-foot">
          <span>Already registered?</span>
          <button type="button" className="kg-text-link" onClick={() => onNavigate("login")}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
