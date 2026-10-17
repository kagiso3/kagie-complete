import { useEffect, useRef, useState, type FormEvent } from "react";
import type { KagieUser, LegacyApi, ProtectedRouteKey } from "../lib/types";
import { AuthShell, AccountPasswordField } from "../components/auth-shell";
import { Button } from "../components/ui";
import { showKagieSplash } from "../lib/splash";
import { googleAuthRedirect } from "../lib/auth-redirect";

export function LoginPage({
  api,
  onNavigate,
  onAuthSuccess,
  nextRoute = "home",
  initialMessage = ""
}: {
  api: LegacyApi;
  onNavigate: (route: "signup") => void;
  onAuthSuccess: (user: KagieUser) => void;
  nextRoute?: ProtectedRouteKey;
  initialMessage?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(() => Boolean(api.shouldRememberLogin?.()));
  const [resetMode, setResetMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [providerPending, setProviderPending] = useState(false);
  const providerPendingRef = useRef(false);
  const providerAttemptRef = useRef(0);
  const busyRef = useRef(false);
  const [message, setMessage] = useState(initialMessage);
  const [messageTone, setMessageTone] = useState<"error" | "success" | "info">("info");

  useEffect(() => {
    function restoreFromBrowserBack(event: PageTransitionEvent) {
      if (!event.persisted) return;
      busyRef.current = false;
      providerPendingRef.current = false;
      providerAttemptRef.current += 1;
      setBusy(false);
      setProviderPending(false);
      setMessage("");
    }
    window.addEventListener("pageshow", restoreFromBrowserBack);
    return () => window.removeEventListener("pageshow", restoreFromBrowserBack);
  }, []);

  useEffect(() => {
    if (!providerPending) return;
    function recoverNativeSignIn(event: Event, failed: boolean) {
      const detail = (event as CustomEvent<{ version?: number }>).detail;
      if (detail?.version !== 1 || !providerPendingRef.current) return;
      providerPendingRef.current = false;
      providerAttemptRef.current += 1;
      busyRef.current = false;
      setBusy(false);
      setProviderPending(false);
      setMessage(failed ? "Kagie could not open your browser. Please try again or sign in with your email." : "Google sign-in was not completed. Try again or sign in with your email.");
      setMessageTone(failed ? "error" : "info");
    }
    const onNativeError = (event: Event) => recoverNativeSignIn(event, true);
    const onNativeResume = (event: Event) => recoverNativeSignIn(event, false);
    window.addEventListener("kagie:native-oauth-error", onNativeError);
    window.addEventListener("kagie:native-oauth-resume", onNativeResume);
    return () => {
      window.removeEventListener("kagie:native-oauth-error", onNativeError);
      window.removeEventListener("kagie:native-oauth-resume", onNativeResume);
    };
  }, [providerPending]);

  function friendlyError(error: unknown, action: "login" | "reset" | "provider") {
    const text = error instanceof Error ? error.message : String(error || "");
    if (/rate|too many|over.*limit/i.test(text)) return "There have been several attempts. Please wait a little, then try again.";
    if (/network|fetch|offline|connection|timeout/i.test(text)) return "We could not connect to Kagie. Check your connection and try again.";
    if (action === "login" && /invalid login|invalid email or password|incorrect email|wrong password/i.test(text)) {
      return "Your email or password does not match. Check your details and try again.";
    }
    if (action === "login" && /email.*confirm|email_not_confirmed/i.test(text)) return "Check your email for your account confirmation link, then sign in.";
    if (action === "reset") return "We could not send a reset link right now. Please try again or contact Kagie support.";
    if (action === "provider" && /updated kagie app|update the app|update.*kagie|outdated.*app/i.test(text)) return "Google sign-in needs the updated Kagie app. Update the app or sign in with your email.";
    if (action === "provider") return "We could not start that sign-in method. Please try again or sign in with your email.";
    return "We could not sign you in right now. Please try again.";
  }

  function beginBusy() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    return true;
  }

  function endBusy() {
    busyRef.current = false;
    setBusy(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!beginBusy()) return;
    const splash = showKagieSplash("Signing in to Kagie");
    try {
      const user = await api.login(email.trim(), password, { persist: rememberSession });
      await splash?.finish();
      onAuthSuccess(user);
    } catch (error) {
      splash?.cancel();
      setMessage(friendlyError(error, "login"));
      setMessageTone("error");
    } finally {
      endBusy();
    }
  }

  async function handleGoogleSignIn() {
    if (!beginBusy()) return;
    const attempt = ++providerAttemptRef.current;
    providerPendingRef.current = true;
    setProviderPending(true);
    try {
      if (!api.signInWithGoogle) throw new Error("Sign-in provider is unavailable");
      await api.signInWithGoogle({ persist: rememberSession, redirectTo: googleAuthRedirect(nextRoute) });
      if (attempt !== providerAttemptRef.current || !providerPendingRef.current) return;
      setMessage("Google sign-in is starting in your browser.");
      setMessageTone("info");
    } catch (error) {
      if (attempt !== providerAttemptRef.current || !providerPendingRef.current) return;
      providerPendingRef.current = false;
      setMessage(friendlyError(error, "provider"));
      setMessageTone("error");
      setProviderPending(false);
      endBusy();
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!api.requestPasswordReset) {
      setMessage("Password reset is unavailable right now. Please try again later or contact Kagie support.");
      setMessageTone("error");
      return;
    }
    if (!beginBusy()) return;
    try {
      const result = await api.requestPasswordReset(email.trim());
      if (result && typeof result === "object" && "localOnly" in result && result.localOnly) {
        setMessage("Email recovery is unavailable for this account on this device. No email was sent. Please contact Kagie support.");
        setMessageTone("info");
      } else {
        setMessage("If an account uses this email, a reset link is on its way. Check your inbox and spam folder.");
        setMessageTone("success");
      }
    } catch (error) {
      setMessage(friendlyError(error, "reset"));
      setMessageTone("error");
    } finally {
      endBusy();
    }
  }

  function changeMode(nextResetMode: boolean) {
    if (busyRef.current) return;
    setResetMode(nextResetMode);
    setMessage("");
  }

  return (
    <AuthShell
      loginReference
      title={resetMode ? "Reset your password" : "Welcome back"}
      copy={resetMode ? "Enter the email you use for Kagie. We’ll help you get back to your account." : "Log in to manage your applications and your next steps."}
    >
      {!resetMode && api.signInWithGoogle ? (
        <>
          <div className="kg-provider-grid">
            <button type="button" className="kg-provider-button" disabled={busy} aria-busy={providerPending} onClick={() => void handleGoogleSignIn()}>
              <span className="kg-provider-icon google" aria-hidden="true">
                <svg viewBox="0 0 48 48" width="20" height="20" focusable="false">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.87 46.98 24.55Z" />
                  <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.28-3.13.78-4.59l-7.98-6.19A23.71 23.71 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
                </svg>
              </span>{providerPending ? "Opening Google..." : "Continue with Google"}
            </button>
          </div>
          <div className="kg-account-divider"><span>or sign in with email</span></div>
        </>
      ) : null}

      <form className="kg-auth-form" onSubmit={resetMode ? handlePasswordReset : handleSubmit} aria-busy={busy}>
        <label className="kg-field">
          <span>Email address</span>
          <input
            className="kg-input"
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {!resetMode ? <>
          <AccountPasswordField value={password} onChange={setPassword} disabled={busy} labelAction={<button type="button" className="kg-text-link kg-account-forgot" disabled={busy} onClick={() => changeMode(true)}>Forgot password?</button>} />
          <label className="remember-row"><input type="checkbox" checked={rememberSession} disabled={busy} onChange={(event) => setRememberSession(event.target.checked)} /><span className="remember-copy"><span className="remember-title">Keep me logged in</span><span className="remember-note">Use this on your personal device.</span></span></label>
        </> : <p className="kg-account-hint">Use your account email and check your spam folder if the link does not arrive.</p>}
        {message ? <div className={`kg-inline-message ${messageTone}`} role={messageTone === "error" ? "alert" : "status"} aria-live="polite">{message}</div> : null}
        <Button type="submit" disabled={busy} loading={busy && !providerPending} loadingLabel={resetMode ? "Sending reset link..." : "Signing in..."}>
          {resetMode ? "Send reset link" : <>Log in <svg className="auth-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg></>}
        </Button>
      </form>

      <div className="kg-auth-foot kg-account-foot">
        {resetMode ? <button type="button" className="kg-text-link" disabled={busy} onClick={() => changeMode(false)}>Back to sign in</button> : <>
          <span>New to Kagie?</span>
          <button type="button" className="kg-text-link" disabled={busy} onClick={() => onNavigate("signup")}>Create an account</button>
        </>}
      </div>
    </AuthShell>
  );
}
