import { startTransition, useEffect, useState } from "react";
import { AppShell } from "./components/app-shell";
import { LoadingPanel } from "./components/ui";
import { ensureLegacyRuntime } from "./lib/runtime";
import type { KagieUser, LegacyApi, ProtectedRouteKey, RouteKey } from "./lib/types";
import { AccommodationPage } from "./pages/accommodation-page";
import { ApplyPage } from "./pages/apply-page";
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
  if (raw === "login" || raw === "signup" || raw === "home" || raw === "apply" || raw === "cart" || raw === "checkout" || raw === "dashboard" || raw === "accommodation" || raw === "transport") {
    return raw;
  }
  return "home";
}

function writeRoute(route: RouteKey) {
  window.location.hash = route === "home" ? "#/home" : `#/${route}`;
}

export default function App() {
  const [api, setApi] = useState<LegacyApi | null>(null);
  const [user, setUser] = useState<KagieUser | null>(null);
  const [route, setRoute] = useState<RouteKey>(readRoute);
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
        const restored = runtime.currentUser() || (await runtime.restoreSession());
        if (!active) return;
        setUser(restored);
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
  }, []);

  useEffect(() => {
    if (loading || !api) return;
    const isAuthRoute = route === "login" || route === "signup";
    if (!user && !isAuthRoute) writeRoute("login");
    if (user && isAuthRoute) writeRoute("home");
  }, [api, loading, route, user]);

  async function handleLogout() {
    if (!api) return;
    await api.logout();
    setUser(null);
    writeRoute("login");
  }

  function handleNavigate(nextRoute: RouteKey) {
    writeRoute(nextRoute);
  }

  if (loading) {
    return <LoadingPanel label="Starting Kagie React..." />;
  }

  if (error || !api) {
    return (
      <div className="kg-launch-error">
        <strong>Kagie could not boot the React app.</strong>
        <p>{error || "The runtime did not load."}</p>
      </div>
    );
  }

  if (!user || route === "login" || route === "signup") {
    return route === "signup" ? (
      <SignupPage api={api} onNavigate={handleNavigate} onAuthSuccess={setUser} />
    ) : (
      <LoginPage api={api} onNavigate={handleNavigate} onAuthSuccess={setUser} />
    );
  }

  let page = <HomePage api={api} user={user} onNavigate={handleNavigate as (route: ProtectedRouteKey) => void} />;

  if (route === "apply") {
    page = <ApplyPage api={api} user={user} onNavigate={handleNavigate as (route: ProtectedRouteKey) => void} />;
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
