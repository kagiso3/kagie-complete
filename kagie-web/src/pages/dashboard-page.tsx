import { useEffect, useState } from "react";
import { Card, EmptyState, Metric, SectionHeading, StatusPill } from "../components/ui";
import { formatDate, formatMoney } from "../lib/format";
import type { KagieDashboardSummary, KagieUser, LegacyApi } from "../lib/types";

export function DashboardPage({
  api,
  user
}: {
  api: LegacyApi;
  user: KagieUser;
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

  const latest = summary?.latestApplication;
  const reminders = summary?.reminders || [];
  const favorites = summary?.favorites || [];
  const documents = summary?.documents || [];
  const services = summary?.serviceRequests || [];
  const packageUsage = summary?.packageUsage;
  const aps = summary?.recommendations?.aps;

  return (
    <div className="kg-page-stack">
      <Card className="kg-hero-card soft">
        <SectionHeading
          eyebrow="Dashboard"
          title="Your Kagie control center"
          copy="Package usage, payment proof, reminders, favorites, service requests, and progress all stay in one place."
        />
        <div className="kg-metric-grid">
          <Metric label="Selected package" value={packageUsage?.packageName || "Not selected"} note="Your current Kagie pack" />
          <Metric
            label="Slots"
            value={`${packageUsage?.usedSlots ?? 0} used`}
            note={
              packageUsage?.institutionLimit === "unlimited"
                ? "Unlimited institutions"
                : `${packageUsage?.remainingSlots ?? 0} remaining`
            }
          />
          <Metric
            label="APS"
            value={aps?.total ?? "Pending"}
            note={aps?.withLifeOrientation ? `APS incl. LO: ${aps.withLifeOrientation}` : "Add marks to calculate"}
          />
          <Metric label="Unread alerts" value={summary?.unreadNotifications ?? 0} note="Notifications still waiting for you" />
        </div>
      </Card>

      <div className="kg-grid two">
        <Card>
          <SectionHeading title="Latest application" copy="Your most recent submission and payment lane." />
          {loading ? (
            <div className="kg-loading-inline">Loading application summary...</div>
          ) : latest ? (
            <div className="kg-list-stack">
              <div className="kg-list-card">
                <div className="kg-list-title-row">
                  <strong>{latest.status || "Draft"}</strong>
                  <StatusPill label={latest.paymentStatus || "Payment Pending"} />
                </div>
                <p>
                  Institutions: {latest.institutions?.length || 0}
                  <br />
                  Updated: {formatDate(latest.updatedAt)}
                  <br />
                  Payment amount: {formatMoney(latest.payment?.amount || 0)}
                </p>
                {latest.payment?.proofUploadedAt ? (
                  <p>
                    Proof uploaded: {formatDate(latest.payment.proofUploadedAt)}
                    {latest.payment.rejectionReason ? <><br />Rejection reason: {latest.payment.rejectionReason}</> : null}
                  </p>
                ) : null}
              </div>
              {(summary?.recommendations?.safeAlternatives || []).slice(0, 2).map((item) => (
                <div className="kg-list-card" key={`${item.institutionName}-${item.course}`}>
                  <div className="kg-brand-line">Recommended course</div>
                  <strong>{item.course}</strong>
                  <p>{item.institutionName}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No dashboard data yet" copy="Once your draft is active, Kagie will keep the full journey visible here." />
          )}
        </Card>

        <Card>
          <SectionHeading title="Reminder engine" copy="Deadlines, missing items, proof, and support prompts." />
          {reminders.length ? (
            <div className="kg-list-stack">
              {reminders.slice(0, 6).map((reminder, index) => (
                <div className="kg-list-card" key={`${reminder.title || "reminder"}-${index}`}>
                  <div className="kg-list-title-row">
                    <strong>{reminder.title || "Reminder"}</strong>
                    {reminder.tone ? <StatusPill label={reminder.tone} /> : null}
                  </div>
                  <p>{reminder.message || "Kagie has an update for you."}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No active reminders" copy="Kagie will surface deadlines and missing items here automatically." />
          )}
        </Card>
      </div>

      <div className="kg-grid two">
        <Card>
          <SectionHeading title="Favorites" copy="Saved courses and institutions for faster decision-making." />
          {favorites.length ? (
            <div className="kg-list-stack">
              {favorites.slice(0, 8).map((favorite) => (
                <div className="kg-list-card" key={favorite.id}>
                  <div className="kg-list-title-row">
                    <strong>{favorite.type === "course" ? favorite.course || "Saved course" : favorite.institutionName || "Saved institution"}</strong>
                    <StatusPill label={favorite.type === "course" ? "Course" : "Institution"} />
                  </div>
                  <p>
                    {favorite.institutionName || ""}
                    {favorite.faculty ? <><br />{favorite.faculty}</> : null}
                    {favorite.province ? <><br />{favorite.province}</> : null}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No saved favorites" copy="Use the React application workspace to save institutions and courses you want to revisit." />
          )}
        </Card>

        <Card>
          <SectionHeading title="Documents and services" copy="Proof, uploads, and active Kagie support flows." />
          <div className="kg-list-stack">
            <div className="kg-list-card">
              <div className="kg-list-title-row">
                <strong>Documents</strong>
                <StatusPill label={`${documents.length} file${documents.length === 1 ? "" : "s"}`} />
              </div>
              <p>Secure vault uploads and review statuses stay attached to your Kagie profile.</p>
            </div>
            <div className="kg-list-card">
              <div className="kg-list-title-row">
                <strong>Service requests</strong>
                <StatusPill label={`${services.length} active`} />
              </div>
              <p>Accommodation, transport, funding, and corrections all surface here as one student support lane.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
