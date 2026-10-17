import { SectionHeading } from "../../components/ui";
import {
  calculateLateAverage,
  getMissingLateDocuments,
  type LateApplicationData,
  type LatePackage
} from "./late-application-model";

function listOrEmpty(values: string[], emptyLabel = "None") {
  const visible = values.map((value) => value.trim()).filter(Boolean);
  return visible.length ? visible.join(", ") : emptyLabel;
}

export function LateApplicationReview({
  data,
  selectedPackage
}: {
  data: LateApplicationData;
  selectedPackage: LatePackage;
}) {
  const documents = Object.values(data.documents).filter(Boolean);
  const missingDocuments = getMissingLateDocuments(data.documents);
  const applicantName = listOrEmpty([data.personal.firstName, data.personal.middleName, data.personal.lastName], "Not completed");
  const previousApplication = data.lateDetails.appliedBefore === "Yes"
    ? `${data.lateDetails.previousInstitution || "Previous institution missing"} (${data.lateDetails.previousApplicationYear || "year missing"})`
    : "No";
  return (
    <>
      <SectionHeading title="Review Late Application" copy="Check every section before accepting the declaration." />
      <div className="kg-journey-review">
        <dl>
          <div><dt>Application Type</dt><dd>Late Application</dd></div>
          <div><dt>Package</dt><dd>{selectedPackage.name} - R{selectedPackage.price.toLocaleString("en-ZA")}</dd></div>
          <div><dt>Institutions Selected</dt><dd>{listOrEmpty(data.institutions.map((institution) => institution.institutionName))}</dd></div>
          <div><dt>Programmes Selected</dt><dd>{listOrEmpty(data.institutions.map((institution) => institution.programme))}</dd></div>
          <div><dt>Personal Information</dt><dd>{applicantName} | {data.personal.identityNumber || "ID/passport missing"}</dd></div>
          <div><dt>Academic Information</dt><dd>{data.academic.currentEducationLevel} | Average {calculateLateAverage(data.academic.subjects)}%</dd></div>
          <div><dt>Documents Prepared</dt><dd>{documents.map((document) => document?.name).filter(Boolean).join(", ") || "None"}</dd></div>
          <div><dt>Missing Required Documents</dt><dd>{missingDocuments.join(", ") || "None"}</dd></div>
          <div><dt>Applied Before</dt><dd>{previousApplication}</dd></div>
          <div><dt>Late Application Reason</dt><dd>{data.lateDetails.reason || "Not completed"}: {data.lateDetails.detailedExplanation || "No explanation added"}</dd></div>
        </dl>
      </div>
    </>
  );
}
