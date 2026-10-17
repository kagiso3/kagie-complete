import { startTransition, useEffect, useState } from "react";
import { ApplicationFormContainer } from "./application-forms/ApplicationFormContainer";
import { ApplicationTypesPage } from "./application-forms/ApplicationTypesPage";
import {
  readSelectedApplicationType,
  saveSelectedApplicationType,
  type ApplicationType
} from "./application-forms/application-form-types";
import { AppShell } from "./components/app-shell";
import { LoadingPanel } from "./components/ui";
import { ensureLegacyRuntime } from "./lib/runtime";
import { clearAuthReturn, readAuthReturn } from "./lib/auth-redirect";
import type { KagieUser, LegacyApi, ProtectedRouteKey, RouteKey } from "./lib/types";
import { AccommodationPage } from "./pages/accommodation-page";
import { CartPage } from "./pages/cart-page";
import { CheckoutPage } from "./pages/checkout-page";
import { DashboardPage } from "./pages/dashboard-page";
import { HomePage } from "./pages/home-page";
import { LoginPage } from "./pages/login-page";
import { SignupPage } from "./pages/signup-page";
import { TransportPage } from "./pages/transport-page";

function readRoute(): RouteKey {
  const raw = window.location.hash.replace(/^#\/?/, "").trim().toLowerCase();
  if (!raw) return "home";
  if (raw === "login" || raw === "signup" || raw === "home" || raw === "apply" || raw === "application-packages" || raw === "application-form" || raw === "cart" || raw === "checkout" || raw === "dashboard" || raw === "accommodation" || raw === "transport") {
    return raw;
  }
  return "home";
}

function writeRoute(route: RouteKey) {
  window.location.hash = route === "home" ? "#/home" : `#/${route}`;
}

function staffDestination(role: string): string | null {
  const value = String(role || "").trim().toLowerCase().replace(/[ -]/g, "_");
  if (["master_admin", "masteradmin", "super_admin", "superadmin", "owner"].includes(value)) return "/master-admin/dashboard.html";
  if (["assistant_admin", "assistantadmin", "assistant", "admin", "staff", "administrator", "support", "support_staff"].includes(value)) return "/assistant/dashboard.html";
  return null;
}

export default function App() {
  const [api, setApi] = useState<LegacyApi | null>(null);
  const [user, setUser] = useState<KagieUser | null>(null);
  const [selectedApplicationType, setSelectedApplicationType] = useState<ApplicationType | null>(null);
  const [route, setRoute] = useState<RouteKey>(readRoute);
  const [authReturn] = useState(readAuthReturn);
  const [authMessage, setAuthMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const onHashChange = () => {
      startTransition(() => {
        setRoute(readRoute());
      });
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const runtime = await ensureLegacyRuntime();
        if (!active) return;
        setApi(runtime);
        let restored: KagieUser | null;
        try {
          restored = authReturn.isCallback ? await runtime.restoreSession() : runtime.currentUser() || (await runtime.restoreSession());
        } catch (sessionError) {
          if (!authReturn.isCallback) throw sessionError;
          restored = null;
        }
        if (!active) return;
        if (authReturn.isCallback) {
          clearAuthReturn();
          if (!restored || authReturn.failed) {
            setAuthMessage("Google sign-in was not completed. Try again or sign in with your email.");
          }
          if (restored && !staffDestination(restored.role)) writeRoute(authReturn.nextRoute);
        }
        setUser(restored);
        const restoredType = restored ? readSelectedApplicationType(restored.id) : null;
        setSelectedApplicationType(restoredType);
      } catch (runtimeError) {
        if (!active) return;
        setError(runtimeError instanceof Error ? runtimeError.message : "Kagie could not start.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authReturn]);

  useEffect(() => {
    if (loading || !api) return;
    const destination = user ? staffDestination(user.role) : null;
    if (destination) {
      window.location.replace(destination);
      return;
    }
    const isAuthRoute = route === "login" || route === "signup";
    if (!user && !isAuthRoute) writeRoute("login");
    if (user && isAuthRoute) writeRoute(authReturn.nextRoute);
  }, [api, authReturn.nextRoute, loading, route, user]);

  async function handleLogout() {
    if (!api) return;
    await api.logout();
    setUser(null);
    setSelectedApplicationType(null);
    writeRoute("login");
  }

  function handleNavigate(nextRoute: RouteKey) {
    setRoute(nextRoute);
    writeRoute(nextRoute);
  }

  function handleAuthSuccess(nextUser: KagieUser) {
    setUser(nextUser);
    const restoredType = readSelectedApplicationType(nextUser.id);
    setSelectedApplicationType(restoredType);
  }

  function handleApplicationTypeSelect(applicationType: ApplicationType) {
    if (!user) return;
    saveSelectedApplicationType(user.id, applicationType);
    setSelectedApplicationType(applicationType);
    setRoute("application-form");
    writeRoute("application-form");
  }

  if (loading) {
    return <LoadingPanel label="Getting Kagie ready..." />;
  }

  if (error || !api) {
    return (
      <div className="kg-launch-error">
        <strong>Kagie could not load.</strong>
        <p>{error || "The runtime did not load."}</p>
      </div>
    );
  }

  if (user && staffDestination(user.role)) {
    return <LoadingPanel label="Opening your staff dashboard..." />;
  }

  if (!user || route === "login" || route === "signup") {
    return route === "signup" ? (
      <SignupPage api={api} onNavigate={handleNavigate} onAuthSuccess={handleAuthSuccess} />
    ) : (
      <LoginPage api={api} onNavigate={handleNavigate} onAuthSuccess={handleAuthSuccess} nextRoute={authReturn.nextRoute} initialMessage={authMessage} />
    );
  }

  let page = <HomePage api={api} user={user} onNavigate={handleNavigate as (route: ProtectedRouteKey) => void} />;

  if (route === "apply") {
    page = <ApplicationTypesPage onSelect={handleApplicationTypeSelect} />;
  } else if (route === "application-form" || route === "application-packages") {
    page = selectedApplicationType ? (
      <ApplicationFormContainer
        key={selectedApplicationType}
        applicationType={selectedApplicationType}
        api={api}
        user={user}
        onNavigate={handleNavigate as (route: ProtectedRouteKey) => void}
      />
    ) : (
      <ApplicationTypesPage onSelect={handleApplicationTypeSelect} />
    );
  } else if (route === "cart") {
    page = <CartPage api={api} user={user} onNavigate={handleNavigate as (route: ProtectedRouteKey) => void} />;
  } else if (route === "checkout") {
    page = <CheckoutPage api={api} user={user} />;
  } else if (route === "dashboard") {
    page = <DashboardPage api={api} user={user} />;
  } else if (route === "accommodation") {
    page = <AccommodationPage api={api} user={user} />;
  } else if (route === "transport") {
    page = <TransportPage api={api} user={user} />;
  }

  return (
    <AppShell user={user} currentRoute={route as ProtectedRouteKey} onNavigate={handleNavigate as (route: ProtectedRouteKey) => void} onLogout={handleLogout}>
      {page}
    </AppShell>
  );
}
