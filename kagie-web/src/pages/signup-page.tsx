import { useRef, useState, type FormEvent } from "react";
import type { KagieUser, LegacyApi } from "../lib/types";
import { AuthShell, AccountPasswordField } from "../components/auth-shell";
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
  const busyRef = useRef(false);
  const [message, setMessage] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  function formatSignupMessage(error: unknown) {
    const text = error instanceof Error ? error.message : String(error || "");
    if (/already registered|already been registered|already exists|user already exists|account with this email/i.test(text)) {
      return "We could not create an account with these details. If you already have a Kagie account, sign in or reset your password.";
    }
    if (/network|fetch|offline|connection|timeout/i.test(text)) return "We could not connect to Kagie. Check your connection and try again.";
    if (/rate|too many|over.*limit/i.test(text)) return "There have been several attempts. Please wait a little, then try again.";
    if (/password.*(?:least|short|weak|characters)/i.test(text)) return "Use a password with at least 6 characters. A longer, unique password helps protect your account.";
    if (/email.*confirm|email_not_confirmed/i.test(text)) return "Check your email for your Kagie confirmation link, then sign in.";
    return "We could not create your account right now. Please try again.";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const user = await api.registerUser({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        dob,
        schoolName: schoolName.trim()
      });
      const sessionApi = api as LegacyApi & { getSupabaseSession?: () => unknown | Promise<unknown> };
      let confirmationRequired = Boolean(user.verificationRequired || user.emailConfirmationRequired);
      if (user.source === "supabase" && !confirmationRequired && sessionApi.getSupabaseSession) {
        try {
          confirmationRequired = !(await sessionApi.getSupabaseSession());
        } catch {
          // Keep the existing flow when optional session inspection is unavailable.
        }
      }
      if (confirmationRequired) {
        setNeedsConfirmation(true);
      } else {
        onAuthSuccess(user);
      }
    } catch (error) {
      setMessage(formatSignupMessage(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={needsConfirmation ? "Check your email" : "Create your account"}
      copy={needsConfirmation ? "One more step before you sign in to Kagie." : "Start with your details. You can complete your application profile from your dashboard."}
    >
      {needsConfirmation ? (
        <div className="kg-account-confirmation">
          <div className="kg-inline-message info" role="status">
            Your account was created. Check {email} for a confirmation link, including your spam folder.
          </div>
          <p className="kg-account-hint">Open the confirmation link, then return here to sign in with your email and password.</p>
          <Button onClick={() => onNavigate("login")}>Back to sign in</Button>
        </div>
      ) : (
        <form className="kg-auth-form kg-account-signup-form" onSubmit={handleSubmit} aria-busy={busy}>
          <div className="kg-account-form-grid">
            <label className="kg-field kg-account-full-width">
              <span>Full name</span>
              <input className="kg-input" name="fullName" autoComplete="name" required placeholder="Your first and last name" value={fullName} disabled={busy} onChange={(event) => setFullName(event.target.value)} />
            </label>
            <label className="kg-field kg-account-full-width">
              <span>Email</span>
              <input className="kg-input" name="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <div className="kg-account-full-width">
              <AccountPasswordField value={password} onChange={setPassword} disabled={busy} newPassword />
            </div>
            <label className="kg-field">
              <span>Phone <small className="kg-account-optional">Optional</small></span>
              <input className="kg-input" name="phone" type="tel" autoComplete="tel" placeholder="e.g. 071 234 5678" value={phone} disabled={busy} onChange={(event) => setPhone(event.target.value)} />
            </label>
            <label className="kg-field">
              <span>Date of birth <small className="kg-account-optional">Optional</small></span>
              <input className="kg-input" name="dob" type="date" autoComplete="bday" value={dob} disabled={busy} onChange={(event) => setDob(event.target.value)} />
            </label>
            <label className="kg-field kg-account-full-width">
              <span>School attended <small className="kg-account-optional">Optional</small></span>
              <input className="kg-input" name="schoolName" autoComplete="organization" placeholder="Your school name" value={schoolName} disabled={busy} onChange={(event) => setSchoolName(event.target.value)} />
            </label>
          </div>
          {message ? <div className="kg-inline-message error" role="alert" aria-live="polite">{message}</div> : null}
          <Button type="submit" disabled={busy} loading={busy} loadingLabel="Creating account...">Create account</Button>
          <p className="kg-account-hint">If email confirmation is requested, check your inbox before signing in.</p>
        </form>
      )}
      <div className="kg-auth-foot kg-account-foot">
        <span>Already have an account?</span>
        <button type="button" className="kg-text-link" disabled={busy} onClick={() => onNavigate("login")}>Sign in</button>
      </div>
    </AuthShell>
  );
}
