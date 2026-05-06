import { useEffect, useState } from "react";
import { Card, EmptyState, Metric, SectionHeading, StatusPill } from "../components/ui";
import { firstName, formatMoney } from "../lib/format";
import type { KagieDashboardSummary, KagieUser, LegacyApi, ProtectedRouteKey } from "../lib/types";

export function HomePage({
  api,
  user,
  onNavigate
}: {
  api: LegacyApi;
  user: KagieUser;
  onNavigate: (route: ProtectedRouteKey) => void;
}) {
  const [summary, setSummary] = useState<KagieDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const nextSummary = api.getDashboardSummaryAsync
          ? await api.getDashboardSummaryAsync(user.id)
          : api.getDashboardSummary(user.id);
        if (active) setSummary(nextSummary);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [api, user.id]);

  const latestApplication = summary?.latestApplication;
  const packageUsage = summary?.packageUsage;
  const recommendation = summary?.recommendations?.safeAlternatives?.[0];

  return (
    <div className="kg-page-stack">
      <Card className="kg-hero-card">
        <div className="kg-hero-copy">
          <div className="kg-brand-line">Hello {firstName(user.fullName)}</div>
          <h2>One student platform for applying, paying, tracking, transport, and accommodation.</h2>
          <p>
            Kagie now runs on a React web shell over your current Kagie backend, so the flow stays familiar while the
            browsing experience becomes smoother and faster.
          </p>
          <div className="kg-action-row">
            <button type="button" className="kg-button primary" onClick={() => onNavigate("apply")}>
              Continue application
            </button>
            <button type="button" className="kg-button secondary" onClick={() => onNavigate("apply")}>
              Open application
            </button>
          </div>
        </div>
        <div className="kg-metric-grid">
          <Metric label="Readiness" value={`${summary?.readiness ?? 0}%`} note="Kagie draft completion" />
          <Metric
            label="Package"
            value={packageUsage?.packageName || "Not selected"}
            note={packageUsage?.institutionLimit === "unlimited" ? "Unlimited institutions" : `${packageUsage?.institutionLimit ?? 0} institution slots`}
          />
          <Metric
            label="Payment"
            value={latestApplication?.paymentStatus || "Awaiting payment"}
            note={latestApplication?.payment ? formatMoney(latestApplication.payment.amount || 0) : "No payment yet"}
          />
        </div>
      </Card>

      <div className="kg-grid two">
        <Card>
          <SectionHeading title="Quick actions" copy="Keep moving without digging through separate pages." />
          <div className="kg-action-grid">
            <button type="button" className="kg-quick-action" onClick={() => onNavigate("apply")}>
              <strong>Application workspace</strong>
              <span>Profile, marks, APS, package, institutions</span>
            </button>
            <button type="button" className="kg-quick-action" onClick={() => onNavigate("cart")}>
              <strong>Cart</strong>
              <span>Review package and paid Kagie services</span>
            </button>
            <button type="button" className="kg-quick-action" onClick={() => onNavigate("accommodation")}>
              <strong>Accommodation</strong>
              <span>Browse housing and request booking help</span>
            </button>
            <button type="button" className="kg-quick-action" onClick={() => onNavigate("transport")}>
              <strong>Transport</strong>
              <span>Check intercity options and request support</span>
            </button>
          </div>
        </Card>

        <Card>
          <SectionHeading title="Application pulse" copy="Your latest status and recommendation summary." />
          {loading ? (
            <div className="kg-loading-inline">Loading your Kagie summary...</div>
          ) : latestApplication ? (
            <div className="kg-list-stack">
              <div className="kg-list-card">
                <div className="kg-list-title-row">
                  <strong>{latestApplication.status || "Draft"}</strong>
                  <StatusPill label={latestApplication.paymentStatus || "Payment Pending"} />
                </div>
                <p>
                  {latestApplication.institutions?.length || 0} institution
                  {(latestApplication.institutions?.length || 0) === 1 ? "" : "s"} in your current Kagie journey.
                </p>
              </div>
              {recommendation ? (
                <div className="kg-list-card">
                  <div className="kg-brand-line">Recommended next fit</div>
                  <strong>{recommendation.course}</strong>
                  <p>{recommendation.institutionName}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="No application yet"
              copy="Start your React application workspace and Kagie will build your full control center from there."
            />
          )}
        </Card>
      </div>
    </div>
  );
}
