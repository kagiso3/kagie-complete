import { Card, SectionHeading } from "../components/ui";
import { applicationTypes, type ApplicationType } from "./application-form-types";

const packageNotes: Record<ApplicationType, string> = {
  undergraduate: "Package: choose an undergraduate application pack before checkout.",
  late: "Package: Quick, Priority, or Emergency late-application support.",
  transfer: "Package: transfer support based on how many institutions you need.",
  bridging: "Package: bridging support for one or more programme choices.",
  postgraduate: "Package: postgraduate support from Basic to Premium."
};

export function ApplicationTypesPage({
  onSelect
}: {
  onSelect: (applicationType: ApplicationType) => void;
}) {
  return (
    <div className="kg-page-stack">
      <Card>
        <SectionHeading
          eyebrow="Application Forms"
          title="Choose an application type"
          copy="Select an application type, choose a package, pay now, and complete the remaining forms later from your Dashboard."
        />
        <div className="kg-journey-notice">
          Complete payment now and finish your application details later. Your application remains Pending Details until every required field is completed and submitted for review.
        </div>

        <div className="kg-action-grid">
          {applicationTypes.map((applicationType) => (
            <button
              key={applicationType.id}
              type="button"
              className="kg-quick-action"
              aria-label={`Open ${applicationType.label}`}
              onClick={() => onSelect(applicationType.id)}
            >
              <strong>{applicationType.label}</strong>
              <span>{applicationType.description}</span>
              <small>{packageNotes[applicationType.id]}</small>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
