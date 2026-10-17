import type { KagieUser, LegacyApi, ProtectedRouteKey } from "../../lib/types";
import { ScaffoldedApplicationForm } from "../shared/ScaffoldedApplicationForm";

export function BridgingProgrammeForm({
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
        applicationType: "bridging",
        title: "Bridging Programme Form",
        description: "Prepare an application for entry into a bridging or access programme.",
        specificSectionTitle: "Bridging programme details",
        specificFields: [
          { key: "schoolResults", label: "School Results", placeholder: "Summarise the applicant's school results.", type: "textarea" },
          { key: "subjects", label: "Subjects", placeholder: "List the applicant's subjects and marks.", type: "textarea" },
          { key: "desiredBridgingProgramme", label: "Desired Bridging Programme", placeholder: "Enter the desired programme." },
          { key: "studyGoals", label: "Study Goals", placeholder: "Describe the applicant's study goals.", type: "textarea" }
        ],
        documents: [
          { key: "identityDocument", label: "ID Copy", required: true },
          { key: "academicResults", label: "Academic Results", required: true }
        ]
      }}
      api={api}
      user={user}
      onNavigate={onNavigate}
    />
  );
}
