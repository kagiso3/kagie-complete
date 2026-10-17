import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Metric, SectionHeading, StatusPill } from "../components/ui";
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
  const [loadMessage, setLoadMessage] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const nextSummary = api.getDashboardSummaryAsync
          ? await api.getDashboardSummaryAsync(user.id)
          : api.getDashboardSummary(user.id);
        if (active) setSummary(nextSummary);
      } catch {
        if (active) {
          setSummary(api.getDashboardSummary(user.id));
          setLoadMessage("Your latest updates could not load. Showing your saved dashboard details.");
        }
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
  const applicationProgress = latest?.forms?.applicationProgress;
  const applicationType = latest?.applicationTypeLabel
    || String((latest?.forms?.applicationType as Record<string, unknown> | undefined)?.label || "")
    || latest?.applicationType
    || "Undergraduate Application";
  const selectedPackage = latest?.selectedPackage && typeof latest.selectedPackage === "object"
    ? latest.selectedPackage
    : null;
  const selectedPackageName = String(
    selectedPackage && "name" in selectedPackage
      ? selectedPackage.name || ""
      : latest?.package?.name || packageUsage?.packageName || ""
  );
  const completionPercentage = applicationProgress?.percentage ?? summary?.readiness ?? 0;
  const submissionDate = latest?.submittedAt ? formatDate(latest.submittedAt) : "Not submitted";
  const missingDocuments = applicationProgress?.missingDocuments
    || (documents.length < 2 ? ["Supporting documents"] : []);
  const latestStatus = String(latest?.status || applicationProgress?.status || "").toLowerCase();
  const needsDetails = latestStatus.includes("pending details") || latestStatus.includes("incomplete");

  return (
    <div className="kg-page-stack">
      {loadMessage ? <div className="kg-inline-message info" role="status">{loadMessage}</div> : null}
      <Card className="kg-hero-card soft">
        <SectionHeading
          eyebrow="Dashboard"
          title="Your Kagie control center"
          copy="Package usage, payment proof, reminders, favorites, service requests, and progress all stay in one place."
        />
        <a href="/payment-history.html">Payment history and receipts</a>
        <div className="kg-metric-grid">
          <Metric label="Selected package" value={selectedPackageName || packageUsage?.packageName || "Not selected"} note="Your current Kagie pack" />
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
                  <strong>{applicationType}</strong>
                  <StatusPill label={latest.paymentStatus || "Payment Pending"} />
                </div>
                <p>
                  Package: {selectedPackageName || "Not selected"}
                  <br />
                  Completion: {completionPercentage}%
                  <br />
                  Current step: {applicationProgress?.currentStep || "Application started"}
                  <br />
                  Missing documents: {missingDocuments.length ? missingDocuments.join(", ") : "None"}
                  <br />
                  Status: {applicationProgress?.status || latest.status || "Draft"}
                  <br />
                  Institutions: {latest.institutions?.length || 0}
                  <br />
                  Submission date: {submissionDate}
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
                {needsDetails ? (
                  <>
                    <div className="kg-journey-notice">
                      Your payment has been received. Please complete the remaining application details before submitting your application for review.
                    </div>
                    <div className="kg-action-row">
                      <Button tone="success" onClick={() => { window.location.hash = "#/application-form"; }}>Complete Application</Button>
                      <Button tone="secondary" onClick={() => { window.location.hash = "#/application-form"; }}>Edit Details</Button>
                      <Button tone="ghost" onClick={() => { window.location.hash = "#/cart"; }}>Payment status</Button>
                    </div>
                  </>
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
            <EmptyState title="No saved favorites" copy="Save institutions and courses in your application workspace to revisit them here." />
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
