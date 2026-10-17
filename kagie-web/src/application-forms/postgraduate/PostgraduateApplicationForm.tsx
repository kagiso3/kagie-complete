import type { KagieUser, LegacyApi, ProtectedRouteKey } from "../../lib/types";
import { ScaffoldedApplicationForm } from "../shared/ScaffoldedApplicationForm";

export function PostgraduateApplicationForm({
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
        applicationType: "postgraduate",
        title: "Postgraduate Application Form",
        description: "Prepare a postgraduate application with qualification, research, experience, and reference information.",
        specificSectionTitle: "Postgraduate details",
        specificFields: [
          { key: "highestQualification", label: "Highest Qualification", placeholder: "Enter the highest completed qualification." },
          { key: "qualificationInstitution", label: "Qualification Institution", placeholder: "Enter the awarding institution." },
          { key: "graduationYear", label: "Graduation Year", placeholder: "Enter the graduation year.", type: "number" },
          { key: "academicAverage", label: "Academic Average", placeholder: "Enter the academic average.", type: "number" },
          { key: "workExperience", label: "Work Experience", placeholder: "Summarise relevant work experience.", type: "textarea" },
          { key: "researchInterest", label: "Research Interest", placeholder: "Describe the research area of interest.", type: "textarea" },
          { key: "researchTopic", label: "Research Topic", placeholder: "Enter the proposed research topic.", type: "textarea" },
          { key: "reference1Name", label: "Reference 1 Name", placeholder: "Enter the first reference's name." },
          { key: "reference1Phone", label: "Reference 1 Phone Number", placeholder: "Enter the first reference's phone number.", type: "tel" },
          { key: "reference1Email", label: "Reference 1 Email", placeholder: "Enter the first reference's email address.", type: "email" },
          { key: "reference2Name", label: "Reference 2 Name", placeholder: "Enter the second reference's name." },
          { key: "reference2Phone", label: "Reference 2 Phone Number", placeholder: "Enter the second reference's phone number.", type: "tel" },
          { key: "reference2Email", label: "Reference 2 Email", placeholder: "Enter the second reference's email address.", type: "email" }
        ],
        documents: [
          { key: "qualificationCertificate", label: "Qualification Certificate", required: true },
          { key: "academicTranscript", label: "Academic Transcript", required: true },
          { key: "cv", label: "CV", required: true },
          { key: "identityDocument", label: "ID Copy", required: true },
          { key: "researchProposal", label: "Research Proposal", required: false },
          { key: "recommendationLetters", label: "Recommendation Letters", required: false }
        ]
      }}
      api={api}
      user={user}
      onNavigate={onNavigate}
    />
  );
}
