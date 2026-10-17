import { useId, useState, type ReactNode } from "react";
import { LoginStory } from "./login-story";
import "../../../css/login-reference.css";

export function AuthShell({ title, copy, children, loginReference = false }: { title: string; copy: string; children: ReactNode; loginReference?: boolean }) {
  if (loginReference) return <div className="kg-auth-shell kg-account-shell auth-reference">
    <a className="kg-skip-link" href="#account-form">Skip to account form</a>
    <div className="auth-page-shell">
      <header className="auth-site-header"><a className="auth-brand" href="/index.html" aria-label="Kagie homepage"><span className="auth-brand-mark" aria-hidden="true">K</span>Kagie</a><span className="auth-header-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 8 10-6 10 6-10 6Z" /><path d="M5 11v7l7 4 7-4v-7M22 8v9" /></svg>Apply once. Go further.</span></header>
      <div className="auth-frame"><LoginStory /><main id="account-form" className="auth-card kg-auth-card kg-account-card" tabIndex={-1} aria-labelledby="authTitle">
        <div className="auth-step-kicker">Your Kagie account</div><h1 id="authTitle">{title}</h1><p className="sub">{copy}</p>{children}
      </main></div>
    </div>
  </div>;
  return (
    <div className="kg-auth-shell kg-account-shell">
      <a className="kg-skip-link" href="#account-form">Skip to account form</a>
      <div className="kg-account-layout">
        <aside className="kg-account-story" aria-label="About your Kagie account">
          <div className="kg-platform-brand">
            <span className="kg-brand-mark" aria-hidden="true">K</span>
            <span className="kg-account-brand">Kagie App<span>Your next chapter starts here</span></span>
          </div>
          <div className="kg-account-story-copy">
            <p className="kg-brand-line">Your tertiary journey</p>
            <h2>Apply once.<br />Reach multiple institutions.</h2>
            <p>Keep your profile, application progress and student support together in one place.</p>
          </div>
          <ul className="kg-account-benefits">
            <li><span className="kg-account-dot gold" aria-hidden="true" /><span><strong>One profile</strong>Save your details for your applications.</span></li>
            <li><span className="kg-account-dot orange" aria-hidden="true" /><span><strong>Clear next steps</strong>Follow your progress from your dashboard.</span></li>
            <li><span className="kg-account-dot sky" aria-hidden="true" /><span><strong>Support along the way</strong>Get help as you plan your future.</span></li>
          </ul>
        </aside>
        <main id="account-form" className="kg-auth-card kg-account-card" tabIndex={-1}>
          <div className="kg-auth-head">
            <p className="kg-brand-line">Kagie account</p>
            <h1>{title}</h1>
            <p>{copy}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export function AccountPasswordField({
  value,
  onChange,
  disabled,
  newPassword = false,
  labelAction
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  newPassword?: boolean;
  labelAction?: ReactNode;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="kg-field kg-account-password-field">
      {labelAction ? <div className="auth-label-row"><label htmlFor={id}>Password</label>{labelAction}</div> : <label htmlFor={id}>Password</label>}
      <div className="kg-account-password">
        <input
          id={id}
          className="kg-input"
          type={visible ? "text" : "password"}
          autoComplete={newPassword ? "new-password" : "current-password"}
          required
          minLength={newPassword ? 6 : undefined}
          aria-describedby={newPassword ? `${id}-hint` : undefined}
          placeholder={newPassword ? "Create a password" : "Enter your password"}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="kg-account-password-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {newPassword ? <small id={`${id}-hint`} className="kg-account-hint">Use at least 6 characters. A longer, unique password helps protect your account.</small> : null}
    </div>
  );
}
