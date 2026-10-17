import type { KagieUser, LegacyApi, ProtectedRouteKey } from "../../lib/types";
import { ScaffoldedApplicationForm } from "../shared/ScaffoldedApplicationForm";

export function TransferApplicationForm({
  api,
  user,
  onNavigate
}: {
  api: LegacyApi;
  user: KagieUser;
  onNavigate: (route: ProtectedRouteKey) => void;
}) {
  return (
    <ScaffoldedApplicationForm
      config={{
        applicationType: "transfer",
        title: "Transfer Application Form",
        description: "Prepare an application to transfer from a current institution or qualification.",
        specificSectionTitle: "Transfer details",
        specificFields: [
          { key: "currentInstitution", label: "Current Institution", placeholder: "Enter the current institution." },
          { key: "studentNumber", label: "Student Number", placeholder: "Enter the current student number." },
          { key: "currentQualification", label: "Current Qualification", placeholder: "Enter the current qualification." },
          { key: "currentProgramme", label: "Current Programme", placeholder: "Enter the current programme." },
          { key: "transferReason", label: "Transfer Reason", placeholder: "Explain the reason for transferring.", type: "textarea" },
          { key: "desiredInstitution", label: "Desired Institution", placeholder: "Enter the desired institution." },
          { key: "desiredProgramme", label: "Desired Programme", placeholder: "Enter the desired programme." }
        ],
        documents: [
          { key: "academicTranscript", label: "Academic Transcript", required: true },
          { key: "studentRecord", label: "Student Record", required: true },
          { key: "identityDocument", label: "ID Copy", required: true }
        ]
      }}
      api={api}
      user={user}
      onNavigate={onNavigate}
    />
  );
}
