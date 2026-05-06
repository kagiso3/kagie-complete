import { useState } from "react";
import type { KagieUser, LegacyApi } from "../lib/types";
import { Button } from "../components/ui";

export function LoginPage({
  api,
  onNavigate,
  onAuthSuccess
}: {
  api: LegacyApi;
  onNavigate: (route: "signup") => void;
  onAuthSuccess: (user: KagieUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success" | "info">("info");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const user = await api.login(email, password);
      onAuthSuccess(user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kagie could not sign you in.");
      setMessageTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleProvider(provider: "google" | "apple") {
    setBusy(true);
    setMessage("");

    try {
      if (provider === "google" && api.signInWithGoogle) {
        await api.signInWithGoogle();
        setMessage("Google sign-in is starting in your browser.");
        setMessageTone("success");
      } else if (provider === "apple" && api.signInWithApple) {
        await api.signInWithApple();
        setMessage("Apple sign-in is starting in your browser.");
        setMessageTone("success");
      } else {
        setMessage(`${provider === "google" ? "Google" : "Apple"} sign-in is not configured yet.`);
        setMessageTone("error");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kagie could not start that sign-in method.");
      setMessageTone("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setMessage("Enter your email address first, then Kagie can send the reset link.");
      setMessageTone("error");
      return;
    }

    if (!api.requestPasswordReset) {
      setMessage("Password reset is not configured in this React shell yet.");
      setMessageTone("error");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await api.requestPasswordReset(email.trim());
      setMessage("Password reset instructions were sent to your email.");
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kagie could not send the password reset email.");
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
          <h1>Welcome back</h1>
          <p>Sign in to continue your South African tertiary application journey.</p>
        </div>

        <div className="kg-provider-grid">
          <button type="button" className="kg-provider-button" onClick={() => handleProvider("google")}>
            <span className="kg-provider-icon google">G</span>
            Continue with Google
          </button>
          <button type="button" className="kg-provider-button" onClick={() => handleProvider("apple")}>
            <span className="kg-provider-icon apple">A</span>
            Continue with Apple
          </button>
        </div>

        <form className="kg-auth-form" onSubmit={handleSubmit}>
          <label className="kg-field">
            <span>Email</span>
            <input
              className="kg-input"
              type="email"
              placeholder="student@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="kg-field">
            <span>Password</span>
            <input
              className="kg-input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <button type="button" className="kg-text-link inline" onClick={() => void handleForgotPassword()}>
          Forgot password?
        </button>

        {message ? <div className={`kg-inline-message ${messageTone}`}>{message}</div> : null}

        <div className="kg-auth-foot">
          <span>New to Kagie?</span>
          <button type="button" className="kg-text-link" onClick={() => onNavigate("signup")}>
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}
