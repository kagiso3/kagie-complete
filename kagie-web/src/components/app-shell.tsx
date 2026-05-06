import type { ReactNode } from "react";
import type { KagieUser, ProtectedRouteKey } from "../lib/types";
import { Button } from "./ui";

const navItems: Array<{ route: ProtectedRouteKey; label: string }> = [
  { route: "home", label: "Home" },
  { route: "apply", label: "Apply" },
  { route: "cart", label: "Cart" },
  { route: "checkout", label: "Checkout" },
  { route: "dashboard", label: "Dashboard" },
  { route: "accommodation", label: "Accommodation" },
  { route: "transport", label: "Transport" }
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
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="kg-app-shell">
      <header className="kg-topbar">
        <div>
          <div className="kg-brand-line">Kagie React + Node</div>
          <h1>Kagie student platform</h1>
          <p>Guided applications, payments, documents, transport, and housing in one premium flow.</p>
        </div>
        <div className="kg-top-actions">
          <div className="kg-user-chip">
            <strong>{user.fullName || "Student"}</strong>
            <span>{user.email}</span>
          </div>
          <Button tone="ghost" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="kg-shell-layout">
        <aside className="kg-sidebar">
          <div className="kg-side-card">
            <div className="kg-side-title">Navigate Kagie</div>
            <div className="kg-nav-list">
              {navItems.map((item) => (
                <button
                  key={item.route}
                  type="button"
                  className={`kg-nav-link ${item.route === currentRoute ? "active" : ""}`}
                  onClick={() => onNavigate(item.route)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
        <main className="kg-main">{children}</main>
      </div>
    </div>
  );
}
