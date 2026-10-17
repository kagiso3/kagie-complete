import type { ReactNode } from "react";
import type { KagieUser, ProtectedRouteKey } from "../lib/types";
import { Button } from "./ui";

const navItems: Array<{ route: ProtectedRouteKey; label: string; icon: string }> = [
  { route: "home", label: "Home", icon: "m3 10 9-7 9 7v10H3z M9 20v-7h6v7" },
  { route: "apply", label: "Apply", icon: "M6 3h9l3 3v15H6z M9 10h6 M9 14h6 M9 18h3" },
  { route: "dashboard", label: "Dashboard", icon: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z" },
  { route: "cart", label: "Cart", icon: "M3 3h2l3 13h11l2-9H6 M9 21h.01 M18 21h.01" },
  { route: "checkout", label: "Checkout", icon: "M3 5h18v14H3z M3 10h18 M7 15h4" },
  { route: "accommodation", label: "Accommodation", icon: "M3 21V8l9-5 9 5v13 M8 21v-7h8v7 M8 9h.01 M16 9h.01" },
  { route: "transport", label: "Transport", icon: "M5 4h14v14H5z M5 11h14 M8 18v3 M16 18v3 M8 15h.01 M16 15h.01" }
];

export function AppShell({
  user,
  currentRoute,
  onNavigate,
  onLogout,
  children
}: {
  user: KagieUser;
  currentRoute: ProtectedRouteKey;
  onNavigate: (route: ProtectedRouteKey) => void;
  onLogout: () => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <div className="kg-app-shell">
      <a className="kg-skip-link" href="#kg-main">Skip to main content</a>
      <header className="kg-topbar">
        <div className="kg-platform-brand">
          <span className="kg-brand-mark" aria-hidden="true">K</span>
          <div>
            <h1>Kagie App</h1>
            <p>Your applications, all in one place.</p>
          </div>
        </div>
        <div className="kg-top-actions">
          <div className="kg-user-chip">
            <strong>{user.fullName || "Student"}</strong>
            <span>{user.email}</span>
          </div>
          <Button tone="ghost" onClick={onLogout} loadingLabel="Signing out...">
            Sign out
          </Button>
        </div>
      </header>

      <div className="kg-shell-layout">
        <aside className="kg-sidebar">
          <div className="kg-side-card">
            <div className="kg-side-title">Navigate Kagie</div>
            <nav className="kg-nav-list" aria-label="Student navigation">
              {navItems.map((item) => {
                const active = item.route === currentRoute || (item.route === "apply" && ["application-packages", "application-form"].includes(currentRoute));
                return (
                <button
                  key={item.route}
                  type="button"
                  className={`kg-nav-link ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate(item.route)}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.icon} /></svg>
                  <span>{item.label}</span>
                </button>
              );})}
            </nav>
          </div>
        </aside>
        <main id="kg-main" className="kg-main" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
